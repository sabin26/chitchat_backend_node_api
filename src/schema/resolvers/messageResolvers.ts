import { withFilter } from 'apollo-server';
import { getRepository } from 'typeorm';
import { contextType, pubSub } from '..';
import { returnError } from '../../config/errorHandling';
import { INVALID_PAGE, NO_CHAT, NO_MESSAGE, UN_AUTHROIZED } from '../../config/errorMessages';
import Chat from '../../entity/Chat';
import Message from '../../entity/Message';
import { validate as uuidValidate } from 'uuid';
import { fcmServerKey } from '../../config/fcm_server_key';
const gcm = require('node-gcm');

const resolvers = {
  Mutation: {
    createNewMessage,
    updateMessage,
    deleteMessage,
    sendMessage,
  },
  Query: {
    getMessages,
  },
  Subscription: {
    getNewMessage: {
      subscribe: getNewMessage(),
    },
  },
};

// Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
var sender = new gcm.Sender(fcmServerKey.key);

async function sendMessage(_: any, { chatId, messageId, text }: { chatId: string, messageId: string, text: string }, { user }: contextType) {
  if (!user) return returnError('sendMessage', UN_AUTHROIZED);

  const isValidUuidChat = uuidValidate(chatId || '');
  if (!isValidUuidChat) return returnError('sendMessage', NO_CHAT);

  const isValidUuidMessage = uuidValidate(messageId || '');
  if (!isValidUuidMessage) return returnError('sendMessage', NO_MESSAGE);

  const chat = await getChatRepo(chatId);
  if (!chat) return returnError('sendMessage', NO_CHAT);

  chat.lastMessage = text;

  const messageObject = await getMessageRepo(messageId);
  if (!messageObject || messageObject.sender.id !== user.id) return returnError('sendMessage', NO_MESSAGE);

  messageObject.text = text;
  await messageObject.save();
  await chat.save();

  const membersToken = [];
  chat.members.forEach(({ fcmTokens }) => {
    if (fcmTokens) {
      fcmTokens.forEach(token => membersToken.push(token));
    }
  });

  // Prepare a message to be sent
  var notificationMsg = new gcm.Message({
    data: { type: 'follow', dataId: chat.id, userId: user.id, userName: user.name, userAvatar: user.avatar },
    notification: {
      title: 'ChitChat',
      icon: 'ic_launcher',
      body: user.name + ' sent a message',
      sound: 'default'
    }
  });

  sender.send(notificationMsg, { registrationTokens: membersToken }, function (err, response) {
    if (err) {
      console.log('Something has gone wrong!', err);
    } else {
      console.log('Successfully sent with response: ', response);
    }
  });

  await triggerSubscription(user.id, chatId, messageObject);
  return { isSuccess: true, data: { ...messageObject, me: true } }
}

async function getMessageRepo(messageId: string) {
  const messageRepo = await getRepository(Message).findOne({ relations: ['sender'], where: { id: messageId } });
  return messageRepo;
}

async function deleteMessage(_: any, { messageId }: { messageId: string }, { user }: contextType) {
  if (!user) return returnError('deleteMessage', UN_AUTHROIZED);

  const isValidUuid = uuidValidate(messageId || '');
  if (!isValidUuid) return returnError('deleteMessage', NO_MESSAGE);

  const message = await getMessageRepo(messageId);

  if (!message || message.sender.id !== user.id) return returnError('deleteMessage', NO_MESSAGE);

  await message.remove();
  return { isSuccess: true };
}

async function createNewMessage(_: any, { chatId }: { chatId: string }, { user }: contextType) {
  if (!user) return returnError('createNewMessage', UN_AUTHROIZED);

  const isValidUuid = uuidValidate(chatId || '');
  if (!isValidUuid) return returnError('createNewMessage', NO_CHAT);

  const chat = await getChatRepo(chatId);
  if (!chat) return returnError('createNewMessage', NO_CHAT);

  const message = Message.create({ sender: user, chat: chat });
  await message.save();
  return { isSuccess: true, data: { ...message, me: true } };
}

async function updateMessage(_: any, { text, messageId }: { text: string, messageId: string }, { user }: contextType) {
  if (!user) return returnError('updateMessage', UN_AUTHROIZED);

  const isValidUuid = uuidValidate(messageId || '');
  if (!isValidUuid) return returnError('updateMessage', NO_MESSAGE);

  if (!text) text = '';

  const messageObj = await getMessageRepo(messageId);
  if (!messageObj || messageObj.sender.id !== user.id) return returnError('updateMessage', NO_MESSAGE);

  messageObj.text = text;
  await messageObj.save();

  return { isSuccess: true, data: { ...messageObj, me: true } };
}

async function triggerSubscription(senderId: string, chatId: string, message: Message) {
  await pubSub.publish(GET_CHAT_SUB, { getNewMessage: { ...message, me: null }, chatId, senderId });
  return null;
}

async function getMessages(_: any, { chatId, page }: { chatId: string, page: number }, { user }: contextType) {
  if (!user) return returnError('getMessages', UN_AUTHROIZED);
  if (!page || page < 1) return returnError('getMessages', INVALID_PAGE);

  const isValidUuid = uuidValidate(chatId || '');
  if (!isValidUuid) return returnError('getMessages', NO_CHAT);

  const chat = await getChatRepo(chatId);
  if (!chat) return returnError('getMessages', NO_CHAT);

  if (!chat.members.some(({ id }) => id === user.id)) {
    return returnError('getMessages', UN_AUTHROIZED);
  }

  const messagesObj = await getRepository(Message)
    .find({
      relations: ['sender', 'chat'],
      where: { chat: chat },
      order: { updatedAt: "DESC" },
      skip: (page - 1) * 30,
      take: 30
    });

  let messages = messagesObj
    .map(message => {
      if (message.sender.id === user.id) return { ...message, me: true };
      return { ...message, me: false };
    });

  return { isSuccess: true, data: messages };
}

async function getChatRepo(chatId: string) {
  const chatRepo = getRepository(Chat);
  return await chatRepo.findOne({
    relations: ['members'],
    where: { id: chatId },
  });
}

function getNewMessage() {
  return withFilter(
    () => pubSub.asyncIterator(GET_CHAT_SUB),
    (payload, variable, context, info) => {
      payload.getNewMessage.me = context.id === payload.senderId;
      return payload.chatId === variable.chatId;
    }
  );
}

export const GET_CHAT_SUB = 'GET_CHAT_SUB';

export default resolvers;

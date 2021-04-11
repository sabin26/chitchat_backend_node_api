import { getRepository } from 'typeorm';
import { contextType } from '..';
import { returnError } from '../../config/errorHandling';
import { DUPLICATE_CHAT, INVALID_PAGE, NO_CHAT, NO_USER, UN_AUTHROIZED } from '../../config/errorMessages';
import Chat from '../../entity/Chat';
import User from '../../entity/User';
import { validate as uuidValidate } from 'uuid';
import Message from '../../entity/Message';

const resolvers = {
  Mutation: {
    createChat,
    deleteChat,
  },
  Query: {
    getChats,
  },
};
/* -------------------CREATE_CHAT---------------------------- */
async function createChat(
  _: any,
  { membersId, name }: { membersId: string[]; name: string },
  { user }: contextType
) {
  if (!user) return returnError('createChat', UN_AUTHROIZED);
  if (!membersId || membersId.length == 0) return returnError('createChat', NO_USER);
  let isValid = true;
  membersId.forEach(memberId => {
    if (!uuidValidate(memberId))
      isValid = false;
  });
  if (!isValid) return returnError('createChat', NO_USER);

  const constainsMe = membersId.includes(user.id);
  if (constainsMe && membersId.length == 1) return returnError('createChat', NO_USER);

  if ((!constainsMe && membersId.length == 1) || (constainsMe && membersId.length == 2)) {
    const userR = await getUserRepo(user.id);

    const otherUserIdIndex = membersId.findIndex((memberId) => memberId != user.id);

    for (let chat of userR.chats) {
      if (chat.members.length == 2) {
        const chatExist = chat.members.filter(mem => mem.id === membersId[otherUserIdIndex]);
        if (chatExist.length >= 1) return { isSuccess: true, data: chat };
      }
    }
  }

  const members = await getUserObject(membersId);
  const users = members.filter<User>(isUser);

  const chat = await createNewChat(constainsMe ? users : [...users, user], name);
  return { isSuccess: true, data: chat };
}

async function getUserRepo(userId: string) {
  const userRepo = getRepository(User);

  const user = await userRepo.findOne({
    relations: ['chats', 'chats.members'],
    where: { id: userId },
  });

  return user;
}

let isUser = (obj: any): obj is User => {
  return obj instanceof User;
}

async function createNewChat(members: User[], name: string) {
  const chat = Chat.create({});
  await chat.save();

  chat.members = members;
  if (name) chat.name = name;

  await chat.save();
  return chat;
}

//get the user object from the user ids and then create a chat
async function getUserObject(membersId: string[]) {
  const members = await Promise.all(
    membersId.map(async memberId => {
      const user = await User.findOne({ where: { id: memberId } });
      return user;
    })
  );
  return members;
}

/* -------------------GET_CHAT---------------------------- */

async function getChats(_: any, { page }: { page: number }, { user }: contextType) {
  if (!user) return returnError('getChats', UN_AUTHROIZED);
  if (!page || page < 1) return returnError('getChats', INVALID_PAGE);

  const userR = await getUserRepo(user.id);

  let startVal = (page - 1) * 15;
  if (userR.chats.length < startVal) return { isSuccess: true, data: [] };

  let endVal = startVal + 15;
  endVal = endVal < userR.chats.length ? endVal : userR.chats.length;

  const slicedChats = userR.chats.slice(startVal, endVal);

  const chats = [];
  for (let chat of slicedChats) {
    if (chat.members.length == 1) {
      await chat.remove();
    } else {
      const lastMessage = await getRepository(Message)
        .findOne({
          where: { chat: chat },
          order: { updatedAt: "DESC" }
        });
      var lastMessageId;
      if (!lastMessage) {
        lastMessageId = null;
      } else {
        lastMessageId = lastMessage.id;
      }
      if (!chat.name) {
        const mem = chat.members.filter(member => member.id !== user.id)[0];
        chats.push({ ...chat, name: mem.name, lastMessageId: lastMessageId });
      } else {
        chats.push({ ...chat, lastMessageId: lastMessageId });
      }
    }
  }

  return { isSuccess: true, data: chats };
}

async function getChatRepo(chatId: string) {
  const chatRepo = getRepository(Chat);
  return await chatRepo.findOne({
    relations: ['members'],
    where: { id: chatId },
  });
}

async function deleteChat(_: any, { chatId }: { chatId: string }, { user }: contextType) {
  if (!user) return returnError('deleteChat', UN_AUTHROIZED);

  const isValidUuid = uuidValidate(chatId || '');
  if (!isValidUuid) return returnError('deleteChat', NO_CHAT);

  const chat = await getChatRepo(chatId);
  if (!chat) return returnError('deleteChat', NO_CHAT);

  if (!chat.members.some(({ id }) => id === user.id)) {
    return returnError('deleteChat', UN_AUTHROIZED);
  }

  await chat.remove();
  return { isSuccess: true };
}

export default resolvers;

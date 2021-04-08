import { withFilter } from 'apollo-server';
import { getRepository } from 'typeorm';
import { contextType, pubSub } from '..';
import { returnError } from '../../config/errorHandling';
import { INVALID_PAGE, NO_COMMENT, NO_POST, UN_AUTHROIZED } from '../../config/errorMessages';
import Comment from '../../entity/Comment';
import Post from '../../entity/Post';
import User from '../../entity/User';
import { validate as uuidValidate } from 'uuid';
import { fcmServerKey } from '../../config/fcm_server_key';
const gcm = require('node-gcm');

const resolvers = {
    Mutation: {
        comment,
        updateComment,
        deleteComment,
    },
    Query: {
        getComments,
    },
    Subscription: {
        getNewComment: {
            subscribe: getNewComment(),
        },
    },
};

// Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
var sender = new gcm.Sender(fcmServerKey.key);

async function getPostRepo(postId: string) {
    const postRepo = getRepository(Post);
    return await postRepo.findOne({
        relations: ['from_user'],
        where: { id: postId },
    });
}

async function getCommentRepo(commentId: string) {
    const commentRepo = getRepository(Comment);
    return await commentRepo.findOne({
        relations: ['from_user'],
        where: { id: commentId },
    });
}

async function comment(_: any, { text, postId }: { text: string, postId: string }, { user }: contextType) {
    if (!user) return returnError('comment', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('comment', NO_POST);

    const post = await getPostRepo(postId);;
    if (!post) return returnError('comment', NO_POST);

    const commentObj = await createNewComment(text, user, post);

    if (post.from_user.id != user.id) {
        const membersToken = [];
        post.from_user.fcmTokens.forEach(token => membersToken.push(token));

        // Prepare a message to be sent
        var notificationMsg = new gcm.Message({
            data: { type: 'comment', dataId: post.id },
            notification: {
                title: 'ChitChat',
                icon: 'ic_launcher',
                body: user.name + ' commented on your post',
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
    }
    await triggerSubscription(commentObj, post);
    return { isSuccess: true, data: commentObj };
}

async function updateComment(_: any, { text, commentId }: { text: string, commentId: string }, { user }: contextType) {
    if (!user) return returnError('updateComment', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(commentId || '');
    if (!isValidUuid) return returnError('updateComment', NO_COMMENT);

    if (!text) text = '';

    const commentObj = await getCommentRepo(commentId);

    if (!commentObj || commentObj.from_user.id !== user.id) return returnError('updateComment', NO_COMMENT);

    commentObj.text = text;
    await commentObj.save();

    return { isSuccess: true, data: commentObj };
}

async function deleteComment(_: any, { commentId }: { commentId: string }, { user }: contextType) {
    if (!user) return returnError('deleteComment', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(commentId || '');
    if (!isValidUuid) return returnError('deleteComment', NO_COMMENT);

    const comment = await getCommentRepo(commentId);

    if (!comment || comment.from_user.id !== user.id) return returnError('deleteComment', NO_COMMENT);

    await comment.remove();
    return { isSuccess: true };
}

async function createNewComment(text: string, user: User, post: Post) {
    const comment = Comment.create({ text: text, from_user: user, to_post: post });
    await comment.save();
    return comment;
}

async function triggerSubscription(comment: Comment, post: Post) {
    await pubSub.publish(GET_COMMENT_SUB, { getNewComment: comment, post_id: post.id });
    return null;
}

async function getComments(_: any, { postId, page }: { postId: string, page: number }, { user }: contextType) {
    if (!user) return returnError('getComments', UN_AUTHROIZED);
    if (!page || page < 1) return returnError('getComments', INVALID_PAGE);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('getComments', NO_POST);

    const post = await getPostRepo(postId);;
    if (!post) return returnError('getComments', NO_POST);

    const comments = await getRepository(Comment)
        .find({
            relations: ['from_user', 'to_post'],
            where: { to_post: post },
            order: { updatedAt: "DESC" },
            skip: (page - 1) * 15,
            take: 15
        });

    return { isSuccess: true, data: comments };
}

function getNewComment() {
    return withFilter(
        () => pubSub.asyncIterator(GET_COMMENT_SUB),
        (payload, variable) => payload.post_id === variable.postId
    );
}

export const GET_COMMENT_SUB = 'GET_COMMENT_SUB';

export default resolvers;

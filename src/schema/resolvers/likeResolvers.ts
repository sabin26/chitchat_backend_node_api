import { withFilter } from 'apollo-server';
import { getRepository } from 'typeorm';
import { contextType, pubSub } from '..';
import { returnError } from '../../config/errorHandling';
import { INVALID_PAGE, NO_POST, UN_AUTHROIZED } from '../../config/errorMessages';
import Like from '../../entity/Like';
import Post from '../../entity/Post';
import User from '../../entity/User';
import { validate as uuidValidate } from 'uuid';
import { fcmServerKey } from '../../config/fcm_server_key';
const gcm = require('node-gcm');

const resolvers = {
    Mutation: {
        like,
    },
    Query: {
        getLikes,
    },
    Subscription: {
        getNewLike: {
            subscribe: getNewLike(),
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

async function like(_: any, { postId }: { postId: string }, { user }: contextType) {
    if (!user) return returnError('like', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('like', NO_POST);

    const post = await getPostRepo(postId);
    if (!post) return returnError('like', NO_POST);

    const like = await getRepository(Like)
        .findOne({
            relations: ['from_user', 'to_post'],
            where: { from_user: user, to_post: post },
        });

    if (like) {
        await like.remove();
        return { isSuccess: true };
    }

    const likeObj = await createNewLike(user, post);

    if (post.from_user.id != user.id) {
        const membersToken = [];
        post.from_user.fcmTokens.forEach(token => membersToken.push(token));

        // Prepare a message to be sent
        var notificationMsg = new gcm.Message({
            data: { type: 'like', dataId: post.id },
            notification: {
                title: 'ChitChat',
                icon: 'ic_launcher',
                body: user.name + ' liked your post',
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
    await triggerSubscription(likeObj, post);
    return { isSuccess: true, data: likeObj };
}

async function createNewLike(user: User, post: Post) {
    const like = Like.create({ from_user: user, to_post: post });
    await like.save();
    return like;
}

async function triggerSubscription(like: Like, post: Post) {
    await pubSub.publish(GET_LIKE_SUB, { getNewLike: like, post_id: post.id });
    return null;
}

async function getLikes(_: any, { postId, page }: { postId: string, page: number }, { user }: contextType) {
    if (!user) return returnError('getLikes', UN_AUTHROIZED);
    if (!page || page < 1) return returnError('getLikes', INVALID_PAGE);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('getLikes', NO_POST);

    const post = await getPostRepo(postId);
    if (!post) return returnError('getLikes', NO_POST);

    const likes = await getRepository(Like)
        .find({
            relations: ['from_user', 'to_post'],
            where: { to_post: post },
            order: { updatedAt: "DESC" },
            skip: (page - 1) * 15,
            take: 15
        });

    return { isSuccess: true, data: likes };
}

function getNewLike() {
    return withFilter(
        () => pubSub.asyncIterator(GET_LIKE_SUB),
        (payload, variable) => payload.post_id === variable.postId
    );
}

export const GET_LIKE_SUB = 'GET_LIKE_SUB';

export default resolvers;

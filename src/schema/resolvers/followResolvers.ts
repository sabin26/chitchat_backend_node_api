import { withFilter } from 'apollo-server';
import { getRepository } from 'typeorm';
import { contextType, pubSub } from '..';
import { returnError } from '../../config/errorHandling';
import { FOLLOWING_LIMIT_REACHED, INVALID_PAGE, NO_USER, UN_AUTHROIZED } from '../../config/errorMessages';
import Follow from '../../entity/Follow';
import User from '../../entity/User';
import { validate as uuidValidate } from 'uuid';
import { fcmServerKey } from '../../config/fcm_server_key';
const gcm = require('node-gcm');

const resolvers = {
    Mutation: {
        follow,
    },
    Query: {
        getFollowers,
        getFollowings,
    },
    Subscription: {
        getNewFollower: {
            subscribe: getNewFollower(),
        },
    },
};

// Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
var sender = new gcm.Sender(fcmServerKey.key);

async function getUserRepo(userId: string) {
    const userRepo = await getRepository(User).findOne({
        relations: ['followers'],
        where: { id: userId }
    });
    return userRepo;
}

async function follow(_: any, { userId }: { userId: string }, { user }: contextType) {
    if (!user) return returnError('follow', UN_AUTHROIZED);
    if (!userId) return returnError('follow', NO_USER);
    if (user.id === userId) return returnError('follow', NO_USER);

    const isValidUuid = uuidValidate(userId || '');
    if (!isValidUuid) return returnError('follow', NO_USER);

    const otherUser = await getUserRepo(userId);

    if (!otherUser) return returnError('follow', NO_USER);

    const following = await getRepository(Follow)
        .findOne({
            relations: ['follower', 'following'],
            where: { follower: user, following: otherUser },
        });

    if (following) {
        await following.remove();
        return { isSuccess: true };
    }

    if (otherUser.followers.length >= 100) return returnError('follow', FOLLOWING_LIMIT_REACHED);

    const followObj = await createNewFollowObject(user, otherUser);

    const membersToken = [];
    otherUser.fcmTokens.forEach(token => membersToken.push(token));

    // Prepare a message to be sent
    var notificationMsg = new gcm.Message({
        data: { text: user.name + ' started following you' },
        notification: {
            title: 'ChitChat',
            icon: 'ic_launcher',
            body: user.name + ' started following you',
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
    await triggerSubscription(followObj, otherUser);
    return { isSuccess: true, data: followObj };
}

async function createNewFollowObject(follower: User, following: User) {
    const follow = Follow.create({ follower: follower, following: following });
    await follow.save();
    return follow;
}

async function triggerSubscription(follow: Follow, following_user: User) {
    await pubSub.publish(GET_FOLLOW_SUB, { getNewFollower: follow, following_user_id: following_user.id });
    return null;
}

async function getFollowers(_: any, { user_id, page }: { user_id: string, page: number }, { user }: contextType) {
    if (!user) return returnError('getFollowers', UN_AUTHROIZED);
    if (!page || page < 1) return returnError('getFollowers', INVALID_PAGE);

    const isValidUuid = uuidValidate(user_id || '');
    if (!isValidUuid) return returnError('getFollowers', NO_USER);

    const of_user = await getUserRepo(user_id);
    if (!of_user) return returnError('getFollowers', NO_USER);

    const followObj = await getRepository(Follow)
        .find({
            relations: ['follower', 'following'],
            where: { following: of_user },
            order: { updatedAt: "DESC" },
            skip: (page - 1) * 15,
            take: 15
        });

    return { isSuccess: true, data: followObj };
}

async function getFollowings(_: any, { user_id, page }: { user_id: string, page: number }, { user }: contextType) {
    if (!user) return returnError('getFollowings', UN_AUTHROIZED);
    if (!page || page < 1) return returnError('getFollowings', INVALID_PAGE);

    const isValidUuid = uuidValidate(user_id || '');
    if (!isValidUuid) return returnError('getFollowings', NO_USER);

    const of_user = await getUserRepo(user_id);
    if (!of_user) return returnError('getFollowings', NO_USER);

    const followObj = await getRepository(Follow)
        .find({
            relations: ['follower', 'following'],
            where: { follower: of_user },
            order: { updatedAt: "DESC" },
            skip: (page - 1) * 15,
            take: 15
        });

    return { isSuccess: true, data: followObj };
}

function getNewFollower() {
    return withFilter(
        () => pubSub.asyncIterator(GET_FOLLOW_SUB),
        (payload, variable) => payload.following_user_id === variable.user_id
    );
}

export const GET_FOLLOW_SUB = 'GET_FOLLOW_SUB';

export default resolvers;

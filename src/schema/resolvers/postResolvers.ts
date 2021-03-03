import { getRepository, In } from 'typeorm';
import { contextType } from '..';
import { returnError } from '../../config/errorHandling';
import { INVALID_PAGE, NO_POST, NO_POST_URL, NO_USER, UN_AUTHROIZED } from '../../config/errorMessages';
import Follow from '../../entity/Follow';
import Post from '../../entity/Post';
import User from '../../entity/User';
import { validate as uuidValidate } from 'uuid';

const resolvers = {
    Mutation: {
        createPost,
        updatePost,
        deletePost,
    },
    Query: {
        getPost,
        getPosts,
        getPostsOfUser,
    },
};

async function createPost(_: any, { caption, url }: { caption: string, url: string }, { user }: contextType) {
    if (!user) return returnError('createPost', UN_AUTHROIZED);

    if (!url) return returnError('createPost', NO_POST_URL);

    const postObj = await createNewPost(caption ?? '', url, user);

    return { isSuccess: true, data: { ...postObj, likesCount: 0, commentsCount: 0 } };
}

async function getPostRepo(postId: string) {
    const postRepo = getRepository(Post);
    return await postRepo.findOne({
        relations: ['from_user', 'likes', 'comments'],
        where: { id: postId },
    });
}

async function updatePost(_: any, { caption, postId }: { caption: string, postId: string }, { user }: contextType) {
    if (!user) return returnError('updatePost', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('updatePost', NO_POST);

    if (!caption) caption = '';

    const postObj = await getPostRepo(postId);
    if (!postObj || postObj.from_user.id !== user.id) return returnError('updatePost', NO_POST);

    postObj.caption = caption;
    await postObj.save();

    return { isSuccess: true, data: { ...postObj, likesCount: postObj.likes.length, commentsCount: postObj.comments.length } };
}

async function deletePost(_: any, { postId }: { postId: string }, { user }: contextType) {
    if (!user) return returnError('deletePost', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('deletePost', NO_POST);

    const post = await getPostRepo(postId);
    if (!post || post.from_user.id !== user.id) return returnError('deletePost', NO_POST);

    await post.remove();

    return { isSuccess: true };
}

async function createNewPost(caption: string, url: string, user: User) {
    const post = Post.create({ caption: caption, url: url, from_user: user });
    await post.save();
    return post;
}

async function getPost(_: any, { postId }: { postId: string }, { user }: contextType) {
    if (!user) return returnError('getPost', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('getPost', NO_POST);

    const postObj = await getPostRepo(postId);
    if (!postObj) return returnError('getPost', NO_POST);

    return { isSuccess: true, data: { ...postObj, likesCount: postObj.likes.length, commentsCount: postObj.comments.length } };
}

async function getPostsOfUser(_: any, { userId, page }: { userId: string, page: number }, { user }: contextType) {
    if (!user) return returnError('getPostsOfUser', UN_AUTHROIZED);
    if (!page || page < 1) return returnError('getPostsOfUser', INVALID_PAGE);

    const isValidUuid = uuidValidate(userId || '');
    if (!isValidUuid) return returnError('getPostsOfUser', NO_USER);

    const ofUser = await User.findOne({ where: { id: userId } });
    if (!ofUser) return returnError('getPostsOfUser', NO_USER);

    let posts: {
        likesCount: number;
        commentsCount: number;
        id: string;
        caption: string;
        url: string;
        from_user: User;
        createdAt: string;
        updatedAt: string;
    }[] = [];

    const postRepo = await getRepository(Post).find({
        relations: ['from_user', 'likes', 'comments'],
        where: { from_user: ofUser },
        order: { updatedAt: "DESC" },
        skip: (page - 1) * 15,
        take: 15,
    });

    postRepo.forEach(post => {
        const value = { ...post, likesCount: post.likes.length, commentsCount: post.comments.length };
        posts.push(value);
    });

    return { isSuccess: true, data: posts };
}

async function getPosts(_: any, { page }: { page: number }, { user }: contextType) {
    if (!user) return returnError('getPosts', UN_AUTHROIZED);
    if (!page || page < 1) return returnError('getPosts', INVALID_PAGE);

    let posts: {
        likesCount: number;
        commentsCount: number;
        id: string;
        caption: string;
        url: string;
        from_user: User;
        createdAt: string;
        updatedAt: string;
    }[] = [];

    const followObjs = await getRepository(Follow).find({
        relations: ['follower', 'following'],
        where: { follower: user }
    });

    let followings: string[] = [];
    followObjs.forEach(follow => followings.push(follow.following.id));

    const postRepo = await getRepository(Post).find({
        relations: ['from_user', 'likes', 'comments'],
        where: [{ from_user: In(followings) }, { from_user: user }],
        order: { updatedAt: "DESC" },
        skip: (page - 1) * 15,
        take: 15
    });

    postRepo.forEach(post => {
        const value = { ...post, likesCount: post.likes.length, commentsCount: post.comments.length };
        posts.push(value);
    });

    return { isSuccess: true, data: posts };
}

export default resolvers;

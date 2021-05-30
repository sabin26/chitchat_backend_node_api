import { getRepository, In } from 'typeorm';
import { contextType } from '..';
import { returnError } from '../../config/errorHandling';
import { INVALID_PAGE, INVALID_POST_TYPE, NO_POST, NO_POST_URL, NO_USER, UN_AUTHROIZED } from '../../config/errorMessages';
import Follow from '../../entity/Follow';
import Post from '../../entity/Post';
import User from '../../entity/User';
import { validate as uuidValidate } from 'uuid';
import Like from '../../entity/Like';

const resolvers = {
    Mutation: {
        createPost,
        updatePost,
        deletePost,
        deletePostByAdmin,
    },
    Query: {
        getPost,
        getPosts,
        getPostsOfUser,
    },
};

async function createPost(_: any, { caption, url, type }: { caption: string, url: string, type: string }, { user }: contextType) {
    if (!user) return returnError('createPost', UN_AUTHROIZED);

    if (!url) return returnError('createPost', NO_POST_URL);

    const isValidType = type === 'photo' || type === 'video';

    if (!isValidType) return returnError('createPost', INVALID_POST_TYPE);

    const postObj = await createNewPost(caption ?? '', url, user, type);

    return { isSuccess: true, data: { ...postObj, likesCount: 0, isLiked: false, commentsCount: 0 } };
}

/* -----------------------DELELTE_POST BY ADMIN------------------------- */
async function deletePostByAdmin(_: any, { secret, postId }: { secret: string, postId: string }) {
    if (!secret) return returnError('deletePostByAdmin', UN_AUTHROIZED);
    if (!postId) return returnError('deletePostByAdmin', NO_POST);
    let isValidPostId = uuidValidate(postId);
    if (!isValidPostId) return returnError('deletePostByAdmin', NO_POST);
    if (secret === process.env.KILL_SWITCH) {
        let post = await Post.findOne({ where: { id: postId } });
        if (!post) return returnError('deletePostByAdmin', NO_POST);
        await post.remove();
        return { isSuccess: true };
    } else {
        return returnError('deletePostByAdmin', UN_AUTHROIZED);
    }
}

async function getPostRepo(postId: string) {
    const postRepo = await getRepository(Post).findOne({
        relations: ['from_user', 'likes', 'comments', 'likes.from_user'],
        where: { id: postId },
    });
    return postRepo;
}

async function getLikeRepo(post: Post, from_user: User) {
    const likeRepo = getRepository(Like);
    return await likeRepo.findOne({
        relations: ['from_user', 'to_post'],
        where: { to_post: post, from_user: from_user },
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

    const likeObj = await getLikeRepo(postObj, user);

    const isNotLiked = !likeObj;

    return { isSuccess: true, data: { ...postObj, isLiked: !isNotLiked, likesCount: postObj.likes.length, commentsCount: postObj.comments.length } };
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

async function createNewPost(caption: string, url: string, user: User, type: string) {
    const post = Post.create({ caption: caption, url: url, from_user: user, type: type });
    await post.save();
    return post;
}

async function getPost(_: any, { postId }: { postId: string }, { user }: contextType) {
    if (!user) return returnError('getPost', UN_AUTHROIZED);

    const isValidUuid = uuidValidate(postId || '');
    if (!isValidUuid) return returnError('getPost', NO_POST);

    const postObj = await getPostRepo(postId);
    if (!postObj) return returnError('getPost', NO_POST);

    const likeObj = await getLikeRepo(postObj, user);

    const isNotLiked = !likeObj;

    return { isSuccess: true, data: { ...postObj, isLiked: !isNotLiked, likesCount: postObj.likes.length, commentsCount: postObj.comments.length } };
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
        createdAt: Date;
        updatedAt: Date;
        type: string;
    }[] = [];

    const postRepo = await getRepository(Post).find({
        relations: ['from_user', 'likes', 'comments', 'likes.from_user'],
        where: { from_user: ofUser },
        order: { updatedAt: "DESC" },
        skip: (page - 1) * 15,
        take: 15,
    });

    postRepo.forEach(post => {
        const isLiked = post.likes.findIndex((like) => like.from_user.id === user.id) != -1;
        const value = { ...post, isLiked: isLiked, likesCount: post.likes.length, commentsCount: post.comments.length };
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
        createdAt: Date;
        updatedAt: Date;
        type: string;
    }[] = [];

    const followObjs = await getRepository(Follow).find({
        relations: ['follower', 'following'],
        where: { follower: user }
    });

    let followings: string[] = [];
    followObjs.forEach(follow => followings.push(follow.following.id));

    const postRepo = await getRepository(Post).find({
        relations: ['from_user', 'likes', 'comments', 'likes.from_user'],
        where: [{ from_user: In(followings) }, { from_user: user }],
        order: { updatedAt: "DESC" },
        skip: (page - 1) * 15,
        take: 15
    });

    postRepo.forEach(post => {
        const isLiked = post.likes.findIndex((like) => like.from_user.id === user.id) != -1;
        const value = { ...post, isLiked: isLiked, likesCount: post.likes.length, commentsCount: post.comments.length };
        posts.push(value);
    });

    return { isSuccess: true, data: posts };
}

export default resolvers;

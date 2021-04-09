import { sign } from 'jsonwebtoken';
import { contextType } from '..';
import { returnError } from '../../config/errorHandling';
import {
  DUPLICATE_USER,
  INVALID_AVATAR_URL,
  INVALID_FCM_TOKEN,
  INVALID_HASH,
  INVALID_OTP,
  INVALID_PAGE,
  INVALID_PHONE,
  INVALID_USER_NAME,
  SMS_FAILED_TO_SEND,
  UN_AUTHROIZED,
} from '../../config/errorMessages';
import Chat from '../../entity/Chat';
import Message from '../../entity/Message';
import User from '../../entity/User';
import crypto = require("crypto");
import https = require('https');
const key = process.env.OTP_SECRET || '';
import { getRepository, In, Not } from 'typeorm';
import Like from '../../entity/Like';
import Comment from '../../entity/Comment';
import Follow from '../../entity/Follow';
import Post from '../../entity/Post';
import axios from 'axios';

const resolvers = {
  Query: {
    getUsers,
    me,
    getNotifications,
  },
  Mutation: {
    sendOtp,
    authenticate,
    deleteUser,
    shredData,
    renameUser,
    searchUser,
    updatePhone,
    updateAvatar,
  },
};

//Query
/* ---------------------ME-------------------------- */
async function me(_: any, { }, { user }: contextType) {
  if (!user) return returnError('me', UN_AUTHROIZED);
  return { isSuccess: true, data: user };
}

/* ---------------------GET_USERS-------------------------- */

async function getUsers(_: any, { }, { user }: contextType) {
  if (!user) return returnError('getUsers', UN_AUTHROIZED);

  let users = await User.find();
  users = users.filter(us => us.id !== user.id);
  return { isSuccess: true, data: users };
}

//Mutation
/* --------------------AUTHENTICATE-------------------------- */

async function authenticate(_: any, { phone, fcmToken, hash, otp }: { phone: string, fcmToken: string, hash: string, otp: string }) {

  if (!phone) return returnError('authenticate', INVALID_PHONE);
  if (!hash) return returnError('authenticate', INVALID_HASH);
  if (!otp) return returnError('authenticate', INVALID_OTP);
  if (!fcmToken) return returnError('authenticate', INVALID_FCM_TOKEN);

  const { isOtpVerified } = await verifyOtp(phone, hash, otp);
  if (!isOtpVerified) return returnError('authenticate', INVALID_OTP);

  let user = await User.findOne({ where: { phone: phone } });
  if (user) {
    if (user.fcmTokens.findIndex(token => token === fcmToken) == -1) {
      user.fcmTokens.push(fcmToken);
      await user.save();
    }
  }
  else {
    user = await User.create({
      phone: phone,
      fcmTokens: [fcmToken],
    }).save();
  }

  const token = sign({ id: user.id }, process.env.JWT_SECRET_TOKEN || '');

  return { isSuccess: true, data: { token: token, user: user } };
}

/* -----------------------DELELTE_USER------------------------- */
async function deleteUser(_: any, { }, { user }: contextType) {
  if (!user) return returnError('deleteUser', UN_AUTHROIZED);
  await user.remove();
  return { isSuccess: true };
}

/* ---------------------SHRED DATA------------------------- */
async function shredData(_: any, { secret }: { secret: string }) {
  if (secret === process.env.KILL_SWITCH && secret) {
    await Chat.clear();
    await User.clear();
    await Message.clear();
    return true;
  }
  return false;
}

/* ---------------------SEND OTP------------------------- */
async function sendOtp(_: any, { phone }: { phone: string }) {
  if (!phone) return returnError('sendOtp', INVALID_PHONE);
  return await getPhoneInformation(phone).then(async (result) => {
    if (!result.valid) return returnError('sendOtp', INVALID_PHONE);
    const otp = Math.floor(100000 + Math.random() * 900000)
    const ttl = 2 * 60 * 1000; //2 Minutes in miliseconds
    const expires = Date.now() + ttl; //timestamp to 5 minutes in the future
    const data = `${phone}.${otp}.${expires}`; // phone.otp.expiry_timestamp
    const hash = crypto.createHmac("sha256", key).update(data).digest("hex"); // creating SHA256 hash of the data
    const fullHash = `${hash}.${expires}`; // Hash.expires, format to send to the user
    const output = await sendSMS(phone, otp.toString(), fullHash);
    return output;
  });
}

/* ---------------------SEND SMS------------------------- */
async function sendSMS(phone: string, otp: string, fullHash: string) {
  return axios
    .post(
      //Uncomment in production
      //process.env.SEND_SMS_URL
      '', {
      "phone_number": phone,
      "passCode": otp,
      "apiKey": process.env.API_KEY || ''
    })
    .then(res => {
      return {
        isSuccess: true,
        data: {
          hash: fullHash + "::" + otp, // remove otp in production
        }
      };
    })
    .catch(error => {
      // Uncomment in production
      //return returnError('sendOtp', SMS_FAILED_TO_SEND);
      return {
        isSuccess: true,
        data: {
          hash: fullHash + "::" + otp, // remove this block on production
        }
      };
    });
}

/* ---------------------VERIFY OTP------------------------- */
async function verifyOtp(phone: string, hash: string, otp: string) {

  // Seperate Hash value and expires from the hash returned from the user
  let [hashValue, expires] = hash.split(".");
  // Check if expiry time has passed
  let now = Date.now();
  if (now > parseInt(expires)) return { isOtpVerified: false };
  // Calculate new hash with the same key and the same algorithm
  let data = `${phone}.${otp}.${expires}`;
  let newCalculatedHash = crypto.createHmac("sha256", key).update(data).digest("hex");
  // Match the hashes
  if (newCalculatedHash === hashValue) {
    return { isOtpVerified: true };
  }
  return { isOtpVerified: false };
}

/* ---------------------GET PHONE INFORMATION------------------------- */
async function getPhoneInformation(phone: string) {
  return new Promise<any>((resolve, reject) => {
    https.get("https://phonevalidation.abstractapi.com/v1/?api_key="
      .concat(process.env.ABSTRACT_API_KEY || '')
      .concat("&phone=").concat(phone), (resp) => {
        let data = "";

        // A chunk of data has been received.
        resp.on("data", (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on("end", () => {
          resolve(JSON.parse(data));
        });

      }).on("error", (err) => {
        reject(err.message);
      });
  });
}

/* ---------------------SEARCH USER------------------------- */
async function searchUser(_: any, { name, page }: { name: string, page: number }, { user }: contextType) {
  if (!user) return returnError('searchUser', UN_AUTHROIZED);
  if (!name) return returnError('searchUser', INVALID_USER_NAME);
  if (!page || page < 1) return returnError('searchUser', INVALID_PAGE);
  var users = await getRepository(User)
    .createQueryBuilder('user')
    .where('LOWER(user.name) like :name', { name: `%${name.toLowerCase()}%` })
    .andWhere('user.id != :id', { id: `${user.id}` })
    .skip((page - 1) * 15)
    .take(15)
    .getMany();
  return { isSuccess: true, data: users };
}

/* ---------------------RENAME_USER------------------------- */
async function renameUser(_: any, { name }: { name: string }, { user }: contextType) {
  if (!user) return returnError('renameUser', UN_AUTHROIZED);
  if (!name) return returnError('renameUser', INVALID_USER_NAME);

  const words = name.split(' ');
  const fullName = words.map((word) => {
    return word[0].toUpperCase() + word.substring(1);
  }).join(' ');
  user.name = fullName;
  await user.save();
  return { isSuccess: true, data: user };
}

/* ---------------------UPDATE_USER_AVATAR------------------------- */
async function updateAvatar(_: any, { avatarUrl }: { avatarUrl: string }, { user }: contextType) {
  if (!user) return returnError('updateAvatar', UN_AUTHROIZED);
  if (!avatarUrl) return returnError('updateAvatar', INVALID_AVATAR_URL);

  user.avatar = avatarUrl;
  await user.save();
  return { isSuccess: true, data: user };
}

/* ---------------------UPDATE_USER_PHONE------------------------- */
async function updatePhone(_: any, { phone, hash, otp }: { phone: string, hash: string, otp: string }, { user }: contextType) {
  if (!user) return returnError('updatePhone', UN_AUTHROIZED);
  if (!phone) return returnError('updatePhone', INVALID_PHONE);
  if (!hash) return returnError('updatePhone', INVALID_HASH);
  if (!otp) return returnError('updatePhone', INVALID_OTP);

  const userExist = await User.findOne({ where: { phone: phone } });
  if (userExist) return returnError('updatePhone', DUPLICATE_USER);

  const { isOtpVerified } = await verifyOtp(phone, hash, otp);
  if (!isOtpVerified) return returnError('updatePhone', INVALID_OTP);

  user.phone = phone;
  await user.save();
  return { isSuccess: true };
}

async function getNotifications(_: any, { page }: { page: number }, { user }: contextType) {
  if (!user) return returnError('getNotifications', UN_AUTHROIZED);
  if (!page || page < 1) return returnError('getNotifications', INVALID_PAGE);

  const postRepo = await getRepository(Post)
    .find({
      relations: ['from_user'],
      where: { from_user: user }
    });

  let posts: string[] = [];
  postRepo.forEach(post => posts.push(post.id));

  const likes = await getRepository(Like)
    .find({
      relations: ['from_user', 'to_post'],
      where: { to_post: In(posts), from_user: Not(user.id) },
      order: { createdAt: "DESC" },
      skip: (page - 1) * 15,
      take: 15
    });

  const comments = await getRepository(Comment)
    .find({
      relations: ['from_user', 'to_post'],
      where: { to_post: In(posts), from_user: Not(user.id) },
      order: { createdAt: "DESC" },
      skip: (page - 1) * 15,
      take: 15
    });

  const followObj = await getRepository(Follow)
    .find({
      relations: ['follower', 'following'],
      where: { following: user, from_user: Not(user.id) },
      order: { createdAt: "DESC" },
      skip: (page - 1) * 15,
      take: 15
    });

  let notifications: {
    type: string,
    from_user: User,
    postUrl?: string,
    createdAt: Date,
  }[] = [];

  likes.forEach(like => {
    const notification = { type: 'like', from_user: like.from_user, postUrl: like.to_post.url, createdAt: like.createdAt };
    notifications.push(notification);
  });
  comments.forEach(comment => {
    const notification = { type: 'comment', from_user: comment.from_user, postUrl: comment.to_post.url, createdAt: comment.createdAt };
    notifications.push(notification);
  });
  followObj.forEach(follow => {
    const notification = { type: 'follow', from_user: follow.follower, createdAt: follow.createdAt };
    notifications.push(notification);
  });

  notifications.sort((a, b) => (new Date(b.createdAt)).valueOf() - (new Date(a.createdAt)).valueOf());
  const results = notifications.length > 15 ? notifications.slice(0, 15) : notifications
  return { isSuccess: true, data: results };
}

export default resolvers;

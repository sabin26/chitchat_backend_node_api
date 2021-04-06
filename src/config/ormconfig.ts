import { ConnectionOptions } from 'typeorm';
import Chat from '../entity/Chat';
import Comment from '../entity/Comment';
import Follow from '../entity/Follow';
import Like from '../entity/Like';
import Message from '../entity/Message';
import Post from '../entity/Post';
import User from '../entity/User';

export const dbconfig: ConnectionOptions = {
    url: process.env.DATABASE_URL,
    type: 'postgres',
    logging: false,
    ssl: {
        rejectUnauthorized: false
    },
    entities: [Chat, User, Message, Follow, Post, Like, Comment],
    migrations: ['src/migration/**/*.ts'],
    subscribers: ['src/subscriber/**/*.ts'],
    cli: {
        entitiesDir: '../entity',
        migrationsDir: 'src/migration',
        subscribersDir: 'src/subscriber',
    },
};

//export = dbconfig;
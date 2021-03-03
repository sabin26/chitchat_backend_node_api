import { ConnectionOptions } from 'typeorm';
import Chat from '../entity/Chat';
import Comment from '../entity/Comment';
import Follow from '../entity/Follow';
import Like from '../entity/Like';
import Message from '../entity/Message';
import Post from '../entity/Post';
import User from '../entity/User';

export const dbconfig: ConnectionOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_NUMBER || '4000'),
    username: process.env.DB_USERNAME || 'user',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'social_media_db',
    type: 'postgres',
    logging: false,
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
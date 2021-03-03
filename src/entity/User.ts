import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Chat from './Chat';
import Comment from './Comment';
import Follow from './Follow';
import Like from './Like';
import Message from './Message';
import Post from './Post';
import { EncryptionTransformer } from "typeorm-encrypted";
import { MyEncryptionTransformerConfig } from './../config/encryptionConfig';

@Entity('users')
export default class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '' })
  name: string;

  @Column({ unique: true, transformer: new EncryptionTransformer(MyEncryptionTransformerConfig) })
  phone: string;

  @Column({ default: '' })
  avatar: string;

  @ManyToMany(type => Chat, chat => chat.members, { onDelete: 'CASCADE' })
  chats: Chat[];

  @OneToMany(type => Message, message => message.sender, { onDelete: 'CASCADE' })
  messages: Message[];

  @OneToMany(type => Post, post => post.from_user, { onDelete: 'CASCADE' })
  posts: Post[];

  @OneToMany(type => Like, like => like.from_user, { onDelete: 'CASCADE' })
  likes: Like[];

  @OneToMany(type => Comment, comment => comment.from_user, { onDelete: 'CASCADE' })
  comments: Comment[];

  @OneToMany(type => Follow, follow => follow.following, { onDelete: 'CASCADE' })
  followers: Follow[];

  @OneToMany(type => Follow, follow => follow.follower, { onDelete: 'CASCADE' })
  followings: Follow[];

  @Column('simple-array', { default: [] })
  fcmTokens: string[];

  @CreateDateColumn()
  createdAt: string;

  @UpdateDateColumn()
  updatedAt: string;
}

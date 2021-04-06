import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Message from './Message';
import User from './User';

@Entity()
export default class Chat extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(type => Message, messages => messages.chat, { onDelete: 'CASCADE' })
  messages: Message[];

  @ManyToMany(type => User, member => member.chats, { onDelete: 'CASCADE' })
  @JoinTable({ name: 'Chat_Members' })
  members: User[];

  @Column({ default: '' })
  lastMessage: string;

  @Column({ default: '' })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

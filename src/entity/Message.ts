import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import Chat from './Chat';
import User from './User';

@Entity()
export default class Message extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '' })
  text: string;

  @ManyToOne(type => User, user => user.messages, { onDelete: 'CASCADE' })
  sender: User;

  @ManyToOne(type => Chat, chat => chat.messages, { onDelete: 'CASCADE' })
  chat: Chat;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

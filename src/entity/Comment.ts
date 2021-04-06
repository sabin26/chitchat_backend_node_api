import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import Post from './Post';
import User from './User';

@Entity()
export default class Comment extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    text: string;

    @ManyToOne(type => User, user => user.comments, { onDelete: 'CASCADE' })
    from_user: User;

    @ManyToOne(type => Post, post => post.comments, { onDelete: 'CASCADE' })
    to_post: Post;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

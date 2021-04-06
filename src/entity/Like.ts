import {
    BaseEntity,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import Post from './Post';
import User from './User';

@Entity()
export default class Like extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(type => User, user => user.likes, { onDelete: 'CASCADE' })
    from_user: User;

    @ManyToOne(type => Post, post => post.likes, { onDelete: 'CASCADE' })
    to_post: Post;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

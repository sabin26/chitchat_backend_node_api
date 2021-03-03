import {
    BaseEntity,
    Column,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    OneToMany,
    UpdateDateColumn,
    CreateDateColumn,
} from 'typeorm';
import Comment from './Comment';
import Like from './Like';
import User from './User';

@Entity()
export default class Post extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ default: '' })
    caption: string;

    @Column()
    url: string;

    @ManyToOne(type => User, user => user.posts, { onDelete: 'CASCADE' })
    from_user: User;

    @OneToMany(type => Like, like => like.to_post, { onDelete: 'CASCADE' })
    likes: Like[];

    @OneToMany(type => Comment, comment => comment.to_post, { onDelete: 'CASCADE' })
    comments: Comment[];

    @CreateDateColumn()
    createdAt: string;

    @UpdateDateColumn()
    updatedAt: string;
}

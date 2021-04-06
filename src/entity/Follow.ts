import {
    BaseEntity,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import User from './User';

@Entity()
export default class Follow extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(type => User, user => user.followings, { onDelete: 'CASCADE' })
    follower: User;

    @ManyToOne(type => User, user => user.followers, { onDelete: 'CASCADE' })
    following: User;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;
}

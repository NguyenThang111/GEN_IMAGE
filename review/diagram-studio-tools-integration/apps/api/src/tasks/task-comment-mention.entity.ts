import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { TaskComment } from './task-comment.entity';

@Entity('task_comment_mentions')
export class TaskCommentMention {
  @PrimaryColumn({ type: 'uuid' }) commentId!: string;
  @PrimaryColumn({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => TaskComment, (comment) => comment.mentions, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'commentId' }) comment!: TaskComment;
  @ManyToOne(() => User) @JoinColumn({ name: 'userId' }) user!: User;
}

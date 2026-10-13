import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { WorklogComment } from './worklog-comment.entity';

@Entity('worklog_comment_mentions')
export class WorklogCommentMention {
  @PrimaryColumn({ type: 'uuid' }) commentId!: string;
  @PrimaryColumn({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => WorklogComment, (comment) => comment.mentions, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'commentId' }) comment!: WorklogComment;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user!: User;
}

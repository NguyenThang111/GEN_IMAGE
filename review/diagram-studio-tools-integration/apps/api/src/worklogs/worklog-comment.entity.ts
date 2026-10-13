import { AfterLoad, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Worklog } from './worklog.entity';
import { WorklogCommentMention } from './worklog-comment-mention.entity';

@Entity('worklog_comments')
export class WorklogComment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) worklogId!: string;
  @ManyToOne(() => Worklog, (worklog) => worklog.comments, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'worklogId' }) worklog!: Worklog;
  @Column({ type: 'uuid' }) authorId!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'authorId' }) author!: User;
  @Column({ type: 'text' }) body!: string;
  @Column({ type: 'varchar', nullable: true }) imageMimeType!: string | null;
  @Column({ type: 'integer', nullable: true }) imageByteSize!: number | null;
  @Column({ type: 'bytea', nullable: true, select: false }) imageData!: Buffer | null;
  imageUrl!: string | null;
  @OneToMany(() => WorklogCommentMention, (mention) => mention.comment, { cascade: ['insert'] }) mentions!: WorklogCommentMention[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;

  @AfterLoad()
  setImageUrl() { this.imageUrl = this.imageMimeType ? `/api/worklogs/comments/${this.id}/image` : null; }
}

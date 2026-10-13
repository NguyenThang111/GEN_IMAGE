import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Task } from './task.entity';
import { TaskCommentMention } from './task-comment-mention.entity';

@Entity('task_comments')
export class TaskComment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) taskId!: string;
  @ManyToOne(() => Task, (task) => task.comments, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'taskId' }) task!: Task;
  @Column({ type: 'uuid' }) authorId!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'authorId' }) author!: User;
  @Column({ type: 'text' }) body!: string;
  @Column({ type: 'varchar', nullable: true }) imageMimeType!: string | null;
  @Column({ type: 'integer', nullable: true }) imageByteSize!: number | null;
  @Column({ type: 'bytea', nullable: true, select: false }) imageData!: Buffer | null;
  @OneToMany(() => TaskCommentMention, (mention) => mention.comment, { cascade: ['insert'] }) mentions!: TaskCommentMention[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { TaskComment } from './task-comment.entity';
import { TaskEvent } from './task-event.entity';
import { Task } from './task.entity';

export enum TaskNotificationType {
  MENTION = 'TASK_MENTION',
  COMMENT = 'TASK_COMMENT',
  EVENT = 'TASK_EVENT',
}

@Entity('task_notifications')
@Unique(['recipientId', 'commentId'])
export class TaskNotification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) recipientId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'recipientId' }) recipient!: User;
  @Column({ type: 'uuid' }) taskId!: string;
  @ManyToOne(() => Task, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'taskId' }) task!: Task;
  @Column({ type: 'varchar', length: 32, default: TaskNotificationType.MENTION }) type!: TaskNotificationType;
  @Column({ type: 'uuid', nullable: true }) commentId!: string | null;
  @ManyToOne(() => TaskComment, { nullable: true, onDelete: 'CASCADE' }) @JoinColumn({ name: 'commentId' }) comment!: TaskComment | null;
  @Column({ type: 'uuid', nullable: true }) eventId!: string | null;
  @ManyToOne(() => TaskEvent, { nullable: true, onDelete: 'CASCADE' }) @JoinColumn({ name: 'eventId' }) event!: TaskEvent | null;
  @Column({ type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

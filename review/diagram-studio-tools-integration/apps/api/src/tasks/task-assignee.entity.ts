import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Task } from './task.entity';

@Entity('task_assignees')
export class TaskAssignee {
  @PrimaryColumn('uuid') taskId!: string;
  @PrimaryColumn('uuid') userId!: string;
  @ManyToOne(() => Task, (task) => task.assignees, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'taskId' }) task!: Task;
  @ManyToOne(() => User) @JoinColumn({ name: 'userId' }) user!: User;
  @CreateDateColumn({ type: 'timestamptz' }) assignedAt!: Date;
  @Column('uuid') assignedById!: string;
  @Column({ type: 'smallint', default: 0 }) position!: number;
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 }) sharePercent!: string;
}

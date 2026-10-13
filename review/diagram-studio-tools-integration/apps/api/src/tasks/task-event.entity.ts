import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';

export enum TaskEventType { CREATED='CREATED', EDITED='EDITED', ASSIGNED='ASSIGNED', RISK_REPORTED='RISK_REPORTED', DONE='DONE', REVIEWED='REVIEWED', REOPENED='REOPENED', COMPLETED='COMPLETED', DELETED='DELETED', ARCHIVED='ARCHIVED' }

@Entity('task_events')
export class TaskEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) taskId!: string;
  @Column({ type: 'uuid' }) actorId!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'actorId' }) actor!: User;
  @Column({ type: 'enum', enum: TaskEventType }) type!: TaskEventType;
  @Column({ type: 'jsonb', nullable: true }) payload!: Record<string, unknown> | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

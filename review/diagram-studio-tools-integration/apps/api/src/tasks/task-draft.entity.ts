import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TaskPriority } from './task-priority';

export type TaskDraftPointFactors = {
  outputScope: number;
  complexity: number;
  uncertainty: number;
  risk: number;
  verification: number;
};

@Entity('task_drafts')
export class TaskDraft {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 80 }) topic!: string;
  @Column({ type: 'varchar', length: 10, default: TaskPriority.NORMAL }) priority!: TaskPriority;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'text', nullable: true }) suggestion!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) assigneeIds!: string[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) criteria!: string[];
  @Column({ type: 'jsonb', nullable: true }) pointFactors!: TaskDraftPointFactors | null;
  @Column({ type: 'date', nullable: true }) dueDate!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) sourceStatus!: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) sourcePriority!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true, unique: true }) importKey!: string | null;
  @Column({ type: 'uuid' }) createdById!: string;
  @Column({ type: 'uuid', nullable: true }) deletedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

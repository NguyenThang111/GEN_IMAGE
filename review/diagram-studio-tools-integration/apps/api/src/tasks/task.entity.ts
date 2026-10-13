import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TaskAssignee } from './task-assignee.entity';
import { TaskComment } from './task-comment.entity';
import { TaskCriterion } from './task-criterion.entity';
import { TaskPriority } from './task-priority';

export enum TaskStatus { BACKLOG = 'BACKLOG', ACTIVE = 'ACTIVE', DONE = 'DONE', COMPLETE = 'COMPLETE', ARCHIVED = 'ARCHIVED' }
export enum TaskReviewResult { PENDING = 'PENDING', FAILED = 'FAILED' }

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() title!: string;
  @Column({ type: 'varchar', length: 10, default: TaskPriority.NORMAL }) priority!: TaskPriority;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'text', nullable: true }) suggestion!: string | null;
  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.BACKLOG }) status!: TaskStatus;
  @Column({ type: 'varchar', length: 16, nullable: true }) reviewResult!: TaskReviewResult | null;
  @Column({ type: 'date', nullable: true }) dueDate!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) point!: string | null;
  @Column({ type: 'smallint', nullable: true }) outputScopeScore!: number | null;
  @Column({ type: 'smallint', nullable: true }) complexityScore!: number | null;
  @Column({ type: 'smallint', nullable: true }) uncertaintyScore!: number | null;
  @Column({ type: 'smallint', nullable: true }) riskScore!: number | null;
  @Column({ type: 'smallint', nullable: true }) verificationScore!: number | null;
  @Column({ type: 'uuid' }) createdById!: string;
  @Column({ type: 'uuid', nullable: true }) doneById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) doneAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) completedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) basePoint!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true }) earnedPoint!: string | null;
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) completionRate!: string | null;
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) dueRate!: string | null;
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) qualityRate!: string | null;
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) reliabilityRate!: string | null;
  @Column({ type: 'boolean', nullable: true }) wasLate!: boolean | null;
  @Column({ type: 'date', nullable: true }) evaluatedDueDate!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) evaluatedDoneAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) riskReportedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) riskReportedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) archivedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) archivedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) deletedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
  @OneToMany(() => TaskAssignee, (assignment) => assignment.task, { cascade: ['insert'] }) assignees!: TaskAssignee[];
  @OneToMany(() => TaskCriterion, (criterion) => criterion.task, { cascade: ['insert'] }) criteria!: TaskCriterion[];
  @OneToMany(() => TaskComment, (comment) => comment.task) comments!: TaskComment[];
  commentCount?: number;
  worklogCount?: number;
  worklogHours?: number;
  failedReview?: { reason: string | null; reviewedAt: Date; reviewerName: string | null } | null;
}

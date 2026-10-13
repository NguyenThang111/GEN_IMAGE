import { Column, CreateDateColumn, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { WorklogComment } from './worklog-comment.entity';

export enum WorklogStatus {
  BACKLOG = 'BACKLOG',
  OPEN = 'OPEN',
  ENDED = 'ENDED',
  DONE = 'DONE',
}

export enum WorklogValueLevel {
  BASIC = 'BASIC',
  DEV = 'DEV',
  RND = 'RND',
}

export enum WorklogType {
  NORMAL = 'NORMAL',
  BUGFIX = 'BUGFIX',
  REOPEN = 'REOPEN',
}

export enum WorklogStabilityStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
}

export type WorklogOutputCriterion = {
  id: string;
  expected: string;
  actual: string | null;
  achieved: boolean | null;
};

@Entity('worklogs')
@Index(['userId', 'startedAt'])
export class Worklog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'userId' }) user!: User;
  @Column({ type: 'uuid' }) createdById!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'createdById' }) createdBy!: User;
  @ManyToMany(() => Task)
  @JoinTable({
    name: 'worklog_tasks',
    joinColumn: { name: 'worklogId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'taskId', referencedColumnName: 'id' },
  })
  tasks!: Task[];
  @Column({ type: 'uuid', nullable: true }) primaryTaskId!: string | null;
  @ManyToOne(() => Task, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primaryTaskId' })
  primaryTask!: Task | null;
  @OneToMany(() => WorklogComment, (comment) => comment.worklog) comments!: WorklogComment[];
  @Column({ type: 'text' }) input!: string;
  @Column({ type: 'text', nullable: true }) output!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) outputCriteria!: WorklogOutputCriterion[];
  @Column({ type: 'smallint', default: 1 }) resultModelVersion!: number;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) links!: string[];
  @Column({ type: 'varchar', length: 16, default: WorklogType.NORMAL }) workType!: WorklogType;
  @Column({ type: 'uuid', nullable: true }) reopenedWorklogId!: string | null;
  @ManyToOne(() => Worklog, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reopenedWorklogId' })
  reopenedWorklog!: Worklog | null;
  @Column({ type: 'enum', enum: WorklogStatus, default: WorklogStatus.OPEN }) status!: WorklogStatus;
  @Column({ type: 'timestamptz' }) startedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) endedAt!: Date | null;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) hoursWorked!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) valueLevel!: WorklogValueLevel | null;
  @Column({ type: 'integer', nullable: true }) valueRate!: number | null;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) standardHours!: string | null;
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) completionRate!: string | null;
  @Column({ type: 'integer', default: 0 }) reopenBaseCount!: number;
  @Column({ type: 'integer', nullable: true }) reopenCount!: number | null;
  @Column({ type: 'varchar', length: 16, default: WorklogStabilityStatus.PENDING }) stabilityStatus!: WorklogStabilityStatus;
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) stabilityRate!: string | null;
  @Column({ type: 'integer', nullable: true }) point!: number | null;
  @Column({ type: 'uuid', nullable: true }) scoredById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) scoredAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) deletedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

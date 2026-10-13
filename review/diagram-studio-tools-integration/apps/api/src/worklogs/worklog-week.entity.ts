import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum WorklogWeekStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export type WorklogWeekSnapshot = {
  worklogCount: number;
  totalHours: number;
  outputAchieved: number;
  outputTotal: number;
  point: number;
  pendingStabilityPoint: number;
  taskCount: number;
  taskTitles: string[];
  summary: unknown[];
};

@Entity('worklog_weeks')
@Index(['weekStart'], { unique: true })
export class WorklogWeek {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'date' }) weekStart!: string;
  @Column({ type: 'date' }) weekEnd!: string;
  @Column({ type: 'text', nullable: true }) goal!: string | null;
  @Column({ type: 'varchar', length: 16, default: WorklogWeekStatus.OPEN }) status!: WorklogWeekStatus;
  @Column({ type: 'jsonb', nullable: true }) summarySnapshot!: WorklogWeekSnapshot | null;
  @Column({ type: 'uuid', nullable: true }) closedById!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closedById' })
  closedBy!: User | null;
  @Column({ type: 'timestamptz', nullable: true }) closedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

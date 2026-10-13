import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type EmailEventType = 'BACKLOG_ASSIGNED' | 'TASK_ASSIGNED' | 'TASK_CLAIMED' | 'TASK_COMMENTED' | 'TASK_MENTIONED' | 'PURCHASE_REQUEST_CREATED';
export type EmailOutboxStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED';

@Entity('email_outbox')
export class EmailOutbox {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) recipientUserId!: string;
  @Column({ type: 'varchar', nullable: true }) recipientEmail!: string | null;
  @Column({ type: 'varchar', length: 40 }) eventType!: EmailEventType;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 180 }) dedupeKey!: string;
  @Column({ type: 'varchar', length: 240 }) subject!: string;
  @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status!: EmailOutboxStatus;
  @Column({ type: 'smallint', default: 0 }) attemptCount!: number;
  @Column({ type: 'text', nullable: true }) lastError!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) availableAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) sentAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type PerformanceShare = { userId: string; percent: number };

@Entity('performance_periods')
export class PerformancePeriod {
  @PrimaryColumn({ type: 'varchar', length: 7 }) month!: string;
  @Column({ type: 'date' }) effectiveDate!: string;
  @Column({ type: 'integer' }) targetPoint!: number;
  @Column({ type: 'jsonb' }) memberIds!: string[];
  @Column({ type: 'uuid' }) createdById!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('performance_plans')
export class PerformancePlan {
  @PrimaryColumn({ type: 'uuid' }) taskId!: string;
  @Column({ type: 'integer' }) point!: number;
  @Column({ type: 'decimal', precision: 8, scale: 2 }) standardHours!: string;
  @Column({ type: 'jsonb' }) shares!: PerformanceShare[];
  @Column({ type: 'uuid' }) createdById!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('performance_attestations')
export class PerformanceAttestation {
  @PrimaryColumn({ type: 'varchar', length: 7 }) month!: string;
  @PrimaryColumn({ type: 'uuid' }) userId!: string;
  @Column({ type: 'varchar', length: 64 }) fingerprint!: string;
  @Column({ type: 'uuid' }) verifiedById!: string;
  @Column({ type: 'timestamptz' }) verifiedAt!: Date;
}

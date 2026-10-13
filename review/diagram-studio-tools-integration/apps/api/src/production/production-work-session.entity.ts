import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('production_work_sessions')
@Index(['userId', 'workDate'], { unique: true })
export class ProductionWorkSession {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'date' }) workDate!: string;
  @Column({ default: false }) isRegistered!: boolean;
  @Column({ type: 'varchar', length: 5, nullable: true }) plannedStartTime!: string | null;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) hoursWorked!: string | null;
  @Column({ type: 'text', nullable: true }) sourceKey!: string | null;
  @Column({ type: 'uuid' }) updatedById!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

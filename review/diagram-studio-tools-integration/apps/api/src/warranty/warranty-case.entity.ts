import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum WarrantyStatus {
  RECEIVED = 'RECEIVED',
  REPAIRED = 'REPAIRED',
  TESTED = 'TESTED',
  RETURNED = 'RETURNED',
}

@Entity('warranty_cases')
@Index(['status', 'updatedAt'])
export class WarrantyCase {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true, length: 32 }) code!: string;
  @Column({ length: 160 }) customerReference!: string;
  @Column({ type: 'varchar', length: 160, nullable: true }) customerName!: string | null;
  @Column({ type: 'varchar', length: 320, nullable: true }) customerAddress!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) shippingCarrier!: string | null;
  @Column({ length: 120 }) productName!: string;
  @Column({ length: 240 }) receivedItems!: string;
  @Column({ type: 'text' }) issue!: string;
  @Column({ type: 'text', nullable: true }) repairResult!: string | null;
  @Column({ type: 'varchar', length: 16, default: WarrantyStatus.RECEIVED }) status!: WarrantyStatus;
  @Column({ default: false }) isChargeable!: boolean;
  @Column({ type: 'uuid', nullable: true }) assigneeId!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneeId' })
  assignee!: User | null;
  @Column({ type: 'uuid' }) createdById!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User;
  @Column({ type: 'uuid' }) updatedById!: string;
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updatedById' })
  updatedBy!: User;
  @Column({ type: 'timestamptz', nullable: true }) repairedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) testedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) returnedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PurchaseRequestStatus { REQUESTED='REQUESTED', ORDERED='ORDERED', RECEIVED='RECEIVED', CANCELLED='CANCELLED' }
export enum PurchasePaymentStatus { UNPAID='UNPAID', PARTIAL='PARTIAL', PAID='PAID' }

@Entity('purchase_requests')
export class PurchaseRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) itemId!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) requestedQty!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3, nullable: true }) receivedQty!: string | null;
  @Column({ type: 'enum', enum: PurchaseRequestStatus, default: PurchaseRequestStatus.REQUESTED }) status!: PurchaseRequestStatus;
  @Column({ type: 'enum', enum: PurchasePaymentStatus, enumName: 'purchase_payment_status', default: PurchasePaymentStatus.UNPAID }) paymentStatus!: PurchasePaymentStatus;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'text', nullable: true }) orderUrl!: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) orderCode!: string | null;
  @Column({ type: 'uuid' }) requesterId!: string;
  @Column({ type: 'uuid', nullable: true }) assignedBuyerId!: string | null;
  @Column({ type: 'uuid' }) updatedById!: string;
  @Column({ type: 'timestamptz', nullable: true }) orderedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) receivedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

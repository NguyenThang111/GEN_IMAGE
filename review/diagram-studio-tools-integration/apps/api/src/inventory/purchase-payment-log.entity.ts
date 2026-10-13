import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { PurchasePaymentStatus } from './purchase-request.entity';

@Entity('purchase_payment_logs')
export class PurchasePaymentLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) requestId!: string;
  @Column({ type: 'enum', enum: PurchasePaymentStatus, enumName: 'purchase_payment_status' }) fromStatus!: PurchasePaymentStatus;
  @Column({ type: 'enum', enum: PurchasePaymentStatus, enumName: 'purchase_payment_status' }) toStatus!: PurchasePaymentStatus;
  @Column({ type: 'uuid' }) actorId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

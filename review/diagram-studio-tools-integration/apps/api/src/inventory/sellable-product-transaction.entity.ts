import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { FinishedProductTransactionType } from './finished-product-transaction.entity';

@Entity('sellable_product_transactions')
export class SellableProductTransaction {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) productId!: string;
  @Column({ type: 'enum', enum: FinishedProductTransactionType }) type!: FinishedProductTransactionType;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) quantity!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) balanceBefore!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) balanceAfter!: string;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'text', nullable: true }) reference!: string | null;
  @Column({ type: 'uuid' }) actorId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

export enum InventoryTransactionType { IN='IN', OUT='OUT', ADJUSTMENT='ADJUSTMENT', STOCK_COUNT='STOCK_COUNT' }

@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) itemId!: string;
  @ManyToOne(() => InventoryItem, (item) => item.transactions, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'itemId' }) item!: InventoryItem;
  @Column({ type: 'enum', enum: InventoryTransactionType }) type!: InventoryTransactionType;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) quantity!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3, nullable: true }) balanceBefore!: string | null;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) balanceAfter!: string;
  @Column() unit!: string;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'text', nullable: true }) reference!: string | null;
  @Column({ type: 'uuid' }) actorId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

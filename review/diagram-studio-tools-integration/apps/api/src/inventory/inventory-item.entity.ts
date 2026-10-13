import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { InventoryTransaction } from './inventory-transaction.entity';

export enum InventoryBomKind {
  BOARD_COMPONENT = 'BOARD_COMPONENT',
  OTHER = 'OTHER',
}

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() groupName!: string;
  @Column() name!: string;
  @Column({ type: 'text', nullable: true, unique: true }) sku!: string | null;
  @Column({ type: 'text', default: 'unit' }) unit!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3, nullable: true }) onHandQty!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true }) easycanQtyPerBoard!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true }) scanboxQtyPerBoard!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true }) easyscuQtyPerBoard!: string | null;
  @Column({ type: 'enum', enum: InventoryBomKind, nullable: true }) bomKind!: InventoryBomKind | null;
  @Column({ type: 'text', nullable: true }) purchaseUrl!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) purchaseLinks!: string[];
  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true }) price!: string | null;
  @Column({ type: 'text', nullable: true }) location!: string | null;
  @Column({ type: 'decimal', precision: 16, scale: 3, default: 100 }) minimumStock!: string;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) lastCountedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) lastCountedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) checkRequestedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) checkRequestedById!: string | null;
  @Column({ type: 'uuid', nullable: true }) checkAssignedToId!: string | null;
  @Column({ type: 'text', nullable: true }) checkRequestNote!: string | null;
  @Column({ type: 'text', nullable: true }) sourceSpreadsheetId!: string | null;
  @Column({ type: 'text', nullable: true }) sourceSheetName!: string | null;
  @Column({ type: 'integer', nullable: true }) sourceRow!: number | null;
  @Column({ type: 'text', nullable: true }) sourceStockText!: string | null;
  @Column({ type: 'jsonb', nullable: true }) sourceSnapshot!: Record<string, unknown> | null;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
  @OneToMany(() => InventoryTransaction, (transaction) => transaction.item) transactions!: InventoryTransaction[];
}

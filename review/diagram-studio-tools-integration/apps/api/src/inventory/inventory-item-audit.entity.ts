import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventory_item_audits')
export class InventoryItemAudit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) itemId!: string;
  @Column({ type: 'uuid' }) actorId!: string;
  @Column({ type: 'jsonb' }) changes!: Record<string,{before:unknown;after:unknown}>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

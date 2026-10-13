import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sellable_products')
export class SellableProduct {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3, default: 0 }) onHandQty!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3, default: 0 }) minimumStock!: string;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

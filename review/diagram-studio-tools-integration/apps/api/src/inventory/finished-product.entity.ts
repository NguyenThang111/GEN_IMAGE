import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum FinishedProductCategory {
  PCB = 'PCB',
  CABLE = 'CABLE',
  DEVICE = 'DEVICE',
  OTHER = 'OTHER',
}

@Entity('finished_products')
export class FinishedProduct {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'text', nullable: true, unique: true }) sku!: string | null;
  @Column() name!: string;
  @Column({ type: 'text', default: FinishedProductCategory.OTHER }) category!: FinishedProductCategory;
  @Column({ type: 'decimal', precision: 16, scale: 3, default: 0 }) onHandQty!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3, default: 0 }) minimumStock!: string;
  @Column({ type: 'text', nullable: true }) location!: string | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ default: true }) isProductionOutput!: boolean;
  @Column({ default: true }) productionReady!: boolean;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

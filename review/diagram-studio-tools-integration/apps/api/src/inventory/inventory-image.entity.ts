import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum InventoryImageOwnerType {
  MATERIAL = 'MATERIAL',
  FINISHED_PRODUCT = 'FINISHED_PRODUCT',
  SELLABLE_PRODUCT = 'SELLABLE_PRODUCT',
}

@Entity('inventory_images')
@Index(['ownerType', 'ownerId'], { unique: true })
export class InventoryImage {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 30 }) ownerType!: InventoryImageOwnerType;
  @Column({ type: 'uuid' }) ownerId!: string;
  @Column({ type: 'varchar', length: 40 }) mimeType!: string;
  @Column({ type: 'integer' }) byteSize!: number;
  @Column({ type: 'bytea', select: false }) data!: Buffer;
  @Column({ type: 'uuid' }) uploadedById!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

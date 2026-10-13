import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('sellable_product_bom_items')
@Unique(['productId','finishedProductId'])
export class SellableProductBomItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) productId!: string;
  @Column({ type: 'uuid' }) finishedProductId!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) quantityPerProduct!: string;
}

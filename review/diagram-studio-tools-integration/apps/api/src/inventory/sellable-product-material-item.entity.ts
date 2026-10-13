import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('sellable_product_material_items')
@Unique(['productId','itemId'])
export class SellableProductMaterialItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) productId!: string;
  @Column({ type: 'uuid' }) itemId!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) quantityPerProduct!: string;
}

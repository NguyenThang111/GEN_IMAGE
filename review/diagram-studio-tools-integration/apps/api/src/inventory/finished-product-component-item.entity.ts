import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('finished_product_component_items')
@Unique(['productId','componentProductId'])
export class FinishedProductComponentItem {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) productId!: string;
  @Column({ type: 'uuid' }) componentProductId!: string;
  @Column({ type: 'decimal', precision: 16, scale: 3 }) quantityPerProduct!: string;
}

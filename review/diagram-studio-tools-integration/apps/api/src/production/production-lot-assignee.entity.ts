import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('production_lot_assignees')
@Unique(['lotId', 'userId'])
export class ProductionLotAssignee {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) lotId!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('production_entry_lots')
@Unique(['entryId','lotId'])
export class ProductionEntryLot {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) entryId!: string;
  @Column({ type: 'uuid' }) lotId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

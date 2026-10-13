import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('production_runs')
export class ProductionRun {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) createdById!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DiagramCircuit } from './diagram-circuit.entity';

export enum DiagramProjectStatus { ACTIVE = 'ACTIVE', ARCHIVED = 'ARCHIVED' }

@Entity('diagram_projects')
export class DiagramProject {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 120 }) vehicleId!: string;
  @Column({ length: 180 }) vehicleTitle!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) manufacturer!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) modelYear!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) ecmId!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) scuId!: string | null;
  @Column({ type: 'varchar', length: 16, default: DiagramProjectStatus.ACTIVE }) status!: DiagramProjectStatus;
  @Column({ type: 'uuid' }) createdById!: string;
  @Column({ type: 'uuid' }) updatedById!: string;
  @OneToMany(() => DiagramCircuit, circuit => circuit.project) circuits!: DiagramCircuit[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

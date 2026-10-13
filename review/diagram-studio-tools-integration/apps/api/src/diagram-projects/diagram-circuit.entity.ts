import type { ImagePreparation } from './image-preparation';
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DiagramProject } from './diagram-project.entity';

export enum DiagramCircuitStatus { REGISTERED = 'REGISTERED', MISSING_OUTPUT = 'MISSING_OUTPUT', NEEDS_REVIEW = 'NEEDS_REVIEW', DRAFT_READY = 'DRAFT_READY', LAYOUT_REVIEWED = 'LAYOUT_REVIEWED', ELECTRICALLY_REVIEWED = 'ELECTRICALLY_REVIEWED' }

@Entity('diagram_circuits')
@Index(['projectId', 'circuitKey'], { unique: true })
export class DiagramCircuit {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) projectId!: string;
  @ManyToOne(() => DiagramProject, project => project.circuits, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'projectId' }) project!: DiagramProject;
  @Column({ length: 100 }) circuitKey!: string;
  @Column({ length: 180 }) circuitTitle!: string;
  @Column({ type: 'integer', default: 0 }) position!: number;
  @Column({ default: true }) required!: boolean;
  @Column({ type: 'varchar', length: 24, default: DiagramCircuitStatus.REGISTERED }) status!: DiagramCircuitStatus;
  @Column({ type: 'varchar', length: 255, nullable: true }) sourceFileName!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) sourceMimeType!: string | null;
  @Column({ type: 'integer', nullable: true }) sourceByteSize!: number | null;
  @Column({ type: 'bytea', nullable: true, select: false }) sourceImage!: Buffer | null;
  @Column({ type: 'jsonb', nullable: true }) schema!: Record<string, unknown> | null;
  @Column({ type: 'jsonb', nullable: true }) aiReview!: { warnings: string[]; uncertainItems: string[]; preparation?: ImagePreparation } | null;
  @Column({ type: 'jsonb', nullable: true }) validationErrors!: string[] | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) generatedByModel!: string | null;
  @Column({ type: 'uuid', nullable: true }) updatedById!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

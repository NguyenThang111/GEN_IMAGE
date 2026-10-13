import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ProductionModule { CABLE='CABLE', DEVICE='DEVICE', PACKING='PACKING', TEST='TEST', SUPPORT='SUPPORT' }
export enum ProductionOutputType { FINISHED_PRODUCT='FINISHED_PRODUCT', SELLABLE_PRODUCT='SELLABLE_PRODUCT', LABEL='LABEL' }
export type ProductionReportItem={lotId:string;stage:'ASSEMBLE'|'SOLDER'|'PACK'|'TEST'|'OTHER';quantity:number;result:'PASSED'|'FAILED'|'IN_PROGRESS';note?:string};

@Entity('production_entries')
export class ProductionEntry {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'date' }) workDate!: string;
  @Column({ type: 'enum', enum: ProductionModule, enumName: 'production_module' }) module!: ProductionModule;
  @Column({ type: 'text' }) workType!: string;
  @Column({ type: 'enum', enum: ProductionOutputType, enumName: 'production_output_type', default: ProductionOutputType.LABEL }) outputType!: ProductionOutputType;
  @Column({ type: 'uuid', nullable: true }) outputId!: string | null;
  @Column({ type: 'text' }) outputLabel!: string;
  @Column({ type: 'integer', nullable: true }) quantity!: number | null;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) progressPercent!: string | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'text', nullable: true }) rawText!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) reportItems!: ProductionReportItem[];
  @Column({ default: false }) needsReview!: boolean;
  @Index({ unique: true }) @Column({ type: 'text', nullable: true }) sourceKey!: string | null;
  @Column({ type: 'uuid' }) createdById!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

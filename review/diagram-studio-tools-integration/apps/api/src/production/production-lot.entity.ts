import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProductionOutputType } from './production-entry.entity';

export enum ProductionLotStatus { NEW='NEW', IN_PROGRESS='IN_PROGRESS', WAITING_TEST='WAITING_TEST', TESTING='TESTING', DONE='DONE' }
export enum ProductionLotActionType { ASSEMBLE='ASSEMBLE', PACK='PACK', TEST='TEST', SOLDER='SOLDER' }

@Entity('production_lots')
export class ProductionLot {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) runId!: string;
  @Index({ unique: true }) @Column({ type: 'text' }) code!: string;
  @Column({ type: 'enum', enum: ProductionOutputType, enumName: 'production_output_type' }) outputType!: ProductionOutputType;
  @Column({ type: 'text', default: ProductionLotActionType.ASSEMBLE }) actionType!: ProductionLotActionType;
  @Column({ type: 'uuid' }) outputId!: string;
  @Column({ type: 'text' }) outputLabel!: string;
  @Column({ type: 'integer' }) targetQuantity!: number;
  @Column({ type: 'enum', enum: ProductionLotStatus, enumName: 'production_lot_status', default: ProductionLotStatus.NEW }) status!: ProductionLotStatus;
  @Column({ type: 'integer', nullable: true }) completedQuantity!: number | null;
  @Column({ type: 'integer', nullable: true }) producedQuantity!: number | null;
  @Column({ type: 'integer', nullable: true }) failedQuantity!: number | null;
  @Column({ type: 'integer', default: 0 }) accumulatedMinutes!: number;
  @Column({ type: 'uuid', nullable: true }) activeById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) activeStartedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) workStartedAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) workEndedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) note!: string | null;
  @Column({ type: 'uuid' }) createdById!: string;
  @Column({ type: 'uuid', nullable: true }) completedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) testedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) testedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) testClaimedById!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) testClaimedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) testProfileKey!: string | null;
  @Column({ type: 'integer', nullable: true }) testProfileVersion!: number | null;
  @Column({ type: 'uuid', nullable: true }) testStationId!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) deviceTestStartedAt!: Date | null;
  @Column({ type: 'integer', nullable: true }) deviceTestTargetPassCount!: number | null;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) deletedById!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

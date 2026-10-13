import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ProductionLotEventType { CREATED='CREATED', CLAIMED='CLAIMED', STARTED='STARTED', PAUSED='PAUSED', PRODUCTION_FINISHED='PRODUCTION_FINISHED', TEST_CLAIMED='TEST_CLAIMED', TESTED='TESTED', REPORT_LINKED='REPORT_LINKED', NOTE_UPDATED='NOTE_UPDATED', DONE='DONE', UNDONE='UNDONE', DELETED='DELETED' }

@Entity('production_lot_events')
export class ProductionLotEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) lotId!: string;
  @Column({ type: 'enum', enum: ProductionLotEventType, enumName: 'production_lot_event_type' }) type!: ProductionLotEventType;
  @Column({ type: 'uuid' }) actorId!: string;
  @Column({ type: 'jsonb', nullable: true }) payload!: Record<string, unknown> | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

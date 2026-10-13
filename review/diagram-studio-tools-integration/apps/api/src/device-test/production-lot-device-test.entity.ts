import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum DeviceTestResult { PASS='PASS', FAIL='FAIL' }

@Entity('production_lot_device_tests')
@Index(['stationId','testRunId'],{unique:true})
@Index(['lotId'])
export class ProductionLotDeviceTest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) lotId!: string;
  @Column({ type: 'uuid' }) stationId!: string;
  @Column({ type: 'text' }) testRunId!: string;
  @Column({ type: 'text' }) testProfileKey!: string;
  @Column({ type: 'integer' }) testProfileVersion!: number;
  @Column({ type: 'text' }) result!: DeviceTestResult;
  @Column({ type: 'jsonb', nullable: true }) measurements!: Record<string, unknown> | null;
  @Column({ type: 'text', nullable: true }) requestHash!: string | null;
  @Column({ type: 'timestamptz' }) testedAt!: Date;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt!: Date;
}

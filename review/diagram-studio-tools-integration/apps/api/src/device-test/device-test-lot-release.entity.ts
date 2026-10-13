import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('device_test_lot_releases')
@Index(['stationId','releaseRequestId'],{unique:true})
@Index(['lotId'])
export class DeviceTestLotRelease {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({type:'uuid'}) lotId!: string;
  @Column({type:'uuid'}) stationId!: string;
  @Column({type:'text'}) releaseRequestId!: string;
  @CreateDateColumn({type:'timestamptz'}) releasedAt!: Date;
}

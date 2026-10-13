import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('device_test_stations')
export class DeviceTestStation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ type: 'text' }) stationCode!: string;
  @Column({ type: 'text' }) displayName!: string;
  @Column({ type: 'text' }) apiKeyHash!: string;
  @Column({ type: 'boolean', default: true }) isActive!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

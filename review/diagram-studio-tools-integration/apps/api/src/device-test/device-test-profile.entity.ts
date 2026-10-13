import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ProductionOutputType } from '../production/production-entry.entity';

@Entity('device_test_profiles')
@Index(['outputType','outputId'],{unique:true})
export class DeviceTestProfile {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type:'enum',enum:ProductionOutputType,enumName:'production_output_type' }) outputType!: ProductionOutputType;
  @Column({ type:'uuid' }) outputId!: string;
  @Column({ type:'text' }) testProfileKey!: string;
  @Column({ type:'integer' }) testProfileVersion!: number;
  @Column({ type:'boolean',default:true }) isActive!: boolean;
  @CreateDateColumn({ type:'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type:'timestamptz' }) updatedAt!: Date;
}

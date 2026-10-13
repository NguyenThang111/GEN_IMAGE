import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum ProductionPaymentStatus { REQUESTED='REQUESTED', PAID='PAID' }

@Entity('production_payment_requests')
export class ProductionPaymentRequest{
  @PrimaryGeneratedColumn('uuid') id!:string;
  @Column({type:'text',unique:true}) batchKey!:string;
  @Column({type:'uuid'}) userId!:string;
  @Column({type:'uuid',array:true}) sessionIds!:string[];
  @Column({type:'decimal',precision:6,scale:2}) totalHours!:string;
  @Column({type:'jsonb',default:()=>"'[]'::jsonb"}) workSummary!:{date:string;outputs:{label:string;quantity:number|null}[]}[];
  @Column({type:'enum',enum:ProductionPaymentStatus,enumName:'production_payment_status',default:ProductionPaymentStatus.REQUESTED}) status!:ProductionPaymentStatus;
  @Column({type:'uuid',nullable:true}) paidById!:string|null;
  @Column({type:'timestamptz',nullable:true}) paidAt!:Date|null;
  @CreateDateColumn({type:'timestamptz'}) createdAt!:Date;
  @UpdateDateColumn({type:'timestamptz'}) updatedAt!:Date;
}

import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
export type ActivationProduct='EASYSCAN'|'SCANBOX'|'KEYSCAN';
export type ActivationPaymentStatus='PAID'|'UNPAID';
@Entity('activation_codes') @Index(['series','product','packageCode'])
export class ActivationCode {
  @PrimaryGeneratedColumn('uuid') id!:string;
  @Column({length:32}) series!:string;
  @Column({length:16}) product!:ActivationProduct;
  @Column({length:40}) packageCode!:string;
  @Column({type:'bigint'}) activationCode!:string;
  @Column({length:80}) source!:string;
  @Column({length:16}) paymentStatus!:ActivationPaymentStatus;
  @Column({type:'uuid'}) createdById!:string;
  @ManyToOne(()=>User,{onDelete:'RESTRICT'}) @JoinColumn({name:'createdById'}) createdBy!:User;
  @CreateDateColumn({type:'timestamptz'}) createdAt!:Date;
}

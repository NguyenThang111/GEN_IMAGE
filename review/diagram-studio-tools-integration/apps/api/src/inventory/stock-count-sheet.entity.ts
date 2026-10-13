import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum StockCountSheetStatus { DRAFT='DRAFT', SUBMITTED='SUBMITTED', FINALIZED='FINALIZED' }
export type StockCountLine={
  ownerType:'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';
  ownerId:string;
  label:string;
  systemQuantity:number;
  countedQuantity:number|null;
  note:string|null;
};

@Entity('stock_count_sheets')
export class StockCountSheet {
  @PrimaryGeneratedColumn('uuid') id!:string;
  @Column({unique:true}) code!:string;
  @Column({type:'date'}) periodStart!:string;
  @Column({type:'date'}) dueDate!:string;
  @Column({type:'enum',enum:StockCountSheetStatus,default:StockCountSheetStatus.DRAFT}) status!:StockCountSheetStatus;
  @Column({type:'uuid'}) assigneeId!:string;
  @Column({type:'uuid'}) createdById!:string;
  @Column({type:'uuid',nullable:true}) submittedById!:string|null;
  @Column({type:'timestamptz',nullable:true}) submittedAt!:Date|null;
  @Column({type:'uuid',nullable:true}) finalizedById!:string|null;
  @Column({type:'timestamptz',nullable:true}) finalizedAt!:Date|null;
  @Column({type:'jsonb',default:()=>"'[]'::jsonb"}) lines!:StockCountLine[];
  @CreateDateColumn({type:'timestamptz'}) createdAt!:Date;
  @UpdateDateColumn({type:'timestamptz'}) updatedAt!:Date;
}

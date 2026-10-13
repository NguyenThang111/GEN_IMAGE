import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PcbLayoutProduct { KEYSCAN='KEYSCAN', EASYSCAN='EASYSCAN', SCANBOX='SCANBOX' }

@Entity('pcb_layouts')
export class PcbLayout {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type:'varchar', length:16, unique:true }) product!: PcbLayoutProduct;
  @Column({ type:'varchar', length:180 }) fileName!: string;
  @Column({ type:'varchar', length:80, default:'text/html' }) mimeType!: string;
  @Column({ type:'integer' }) byteSize!: number;
  @Column({ type:'bytea', select:false }) html!: Buffer;
  @Column({ type:'jsonb', default:()=>"'{}'::jsonb" }) progress!: Record<string,string>;
  @Column({ type:'integer', default:0 }) progressVersion!: number;
  @Column({ type:'uuid' }) createdById!: string;
  @Column({ type:'uuid' }) updatedById!: string;
  @CreateDateColumn({ type:'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type:'timestamptz' }) updatedAt!: Date;
}

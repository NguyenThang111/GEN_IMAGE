import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole { MEMBER = 'MEMBER', ADMIN = 'ADMIN' }

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) username!: string;
  @Column() displayName!: string;
  @Column({ type: 'varchar', nullable: true, unique: true }) email!: string | null;
  @Column({ select: false }) passwordHash!: string;
  @Column({ type: 'integer', default: 0, select: false }) sessionVersion!: number;
  @Column({ type: 'text', nullable: true, select: false }) avatarDataUrl!: string | null;
  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER }) role!: UserRole;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

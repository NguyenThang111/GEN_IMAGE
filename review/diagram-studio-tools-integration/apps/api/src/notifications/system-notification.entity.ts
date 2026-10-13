import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';

export enum SystemNotificationModule {
  INVENTORY = 'INVENTORY',
  PURCHASING = 'PURCHASING',
  PRODUCTION = 'PRODUCTION',
  WORKLOG = 'WORKLOG',
}

@Entity('system_notifications')
@Unique(['recipientId', 'dedupeKey'])
export class SystemNotification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) recipientId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'recipientId' }) recipient!: User;
  @Column({ type: 'uuid' }) actorId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'actorId' }) actor!: User;
  @Column({ type: 'varchar', length: 32 }) module!: SystemNotificationModule;
  @Column({ type: 'varchar', length: 64 }) eventType!: string;
  @Column({ type: 'varchar', length: 40 }) entityType!: string;
  @Column({ type: 'uuid' }) entityId!: string;
  @Column({ type: 'varchar', length: 200 }) entityLabel!: string;
  @Column({ type: 'varchar', length: 180 }) message!: string;
  @Column({ type: 'text', nullable: true }) bodyPreview!: string | null;
  @Column({ type: 'varchar', length: 220 }) dedupeKey!: string;
  @Column({ type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

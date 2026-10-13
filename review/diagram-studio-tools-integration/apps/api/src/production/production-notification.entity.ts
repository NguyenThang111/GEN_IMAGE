import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { ProductionPaymentRequest } from './production-payment-request.entity';

@Entity('production_notifications')
@Unique(['recipientId', 'paymentRequestId'])
export class ProductionNotification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) recipientId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'recipientId' }) recipient!: User;
  @Column({ type: 'uuid' }) paymentRequestId!: string;
  @ManyToOne(() => ProductionPaymentRequest, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'paymentRequestId' }) paymentRequest!: ProductionPaymentRequest;
  @Column({ type: 'timestamptz', nullable: true }) readAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { EmailOutbox } from './email-outbox.entity';
import { EmailService } from './email.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailOutbox, User])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { SystemNotification } from './system-notification.entity';
import { SystemNotificationsController } from './system-notifications.controller';
import { SystemNotificationsService } from './system-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemNotification, User]), AuthModule],
  controllers: [SystemNotificationsController],
  providers: [SystemNotificationsService],
  exports: [SystemNotificationsService],
})
export class SystemNotificationsModule {}

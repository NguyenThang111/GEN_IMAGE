import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemNotificationsService } from './system-notifications.service';

type AuthRequest = Request & { user: AuthUser };

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class SystemNotificationsController {
  constructor(private readonly notifications: SystemNotificationsService) {}
  @Get() find(@Req() request: AuthRequest) { return this.notifications.find(request.user); }
  @Patch('read-all') readAll(@Req() request: AuthRequest) { return this.notifications.readAll(request.user); }
  @Patch(':id/read') read(@Param('id') id: string, @Req() request: AuthRequest) { return this.notifications.read(id, request.user); }
}

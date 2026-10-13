import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateWarrantyCaseDto, UpdateWarrantyCaseDto } from './warranty.dto';
import { WarrantyService } from './warranty.service';

type AuthRequest = Request & { user: AuthUser };

@UseGuards(JwtAuthGuard)
@Controller('warranty')
export class WarrantyController {
  constructor(private readonly warranty: WarrantyService) {}
  @Get() list() { return this.warranty.list(); }
  @Post() create(@Body() dto: CreateWarrantyCaseDto, @Req() req: AuthRequest) { return this.warranty.create(dto, req.user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateWarrantyCaseDto, @Req() req: AuthRequest) { return this.warranty.update(id, dto, req.user); }
}

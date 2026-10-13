import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { AttestPerformanceDto, CreatePerformancePeriodDto, CreatePerformancePlanDto } from './performance.dto';
import { PerformanceService } from './performance.service';
import { performanceMonth } from './performance.policy';

@UseGuards(JwtAuthGuard)
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}
  @Get() dashboard(@Query('month') month?: string) { return this.performance.dashboard(month??performanceMonth(new Date())); }
  @Post('periods') createPeriod(@Body() dto:CreatePerformancePeriodDto,@Req() req:Request&{user:AuthUser}) { return this.performance.createPeriod(dto,req.user); }
  @Post('plans') createPlan(@Body() dto:CreatePerformancePlanDto,@Req() req:Request&{user:AuthUser}) { return this.performance.createPlan(dto,req.user); }
  @Post(':month/members/:userId/attest') attest(@Param('month') month:string,@Param('userId',ParseUUIDPipe) userId:string,@Body() dto:AttestPerformanceDto,@Req() req:Request&{user:AuthUser}) { return this.performance.attest(month,userId,dto.fingerprint,req.user); }
}

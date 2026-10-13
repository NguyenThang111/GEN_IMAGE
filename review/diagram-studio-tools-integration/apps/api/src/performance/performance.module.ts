import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({imports:[AuthModule,TasksModule],controllers:[PerformanceController],providers:[PerformanceService]})
export class PerformanceModule {}

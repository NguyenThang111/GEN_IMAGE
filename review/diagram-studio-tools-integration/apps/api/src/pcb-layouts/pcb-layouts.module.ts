import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { PcbLayout } from './pcb-layout.entity';
import { PcbLayoutsController } from './pcb-layouts.controller';
import { PcbLayoutsService } from './pcb-layouts.service';

@Module({imports:[TypeOrmModule.forFeature([PcbLayout]),TasksModule],controllers:[PcbLayoutsController],providers:[PcbLayoutsService]})
export class PcbLayoutsModule{}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { SharedDocument } from './shared-document.entity';
import { SharedDocumentsController } from './shared-documents.controller';
import { SharedDocumentsService } from './shared-documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([SharedDocument]), TasksModule],
  controllers: [SharedDocumentsController],
  providers: [SharedDocumentsService],
})
export class SharedDocumentsModule {}

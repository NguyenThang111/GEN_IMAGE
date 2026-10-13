import { Module } from '@nestjs/common';
import { DiagramAiController } from './diagram-ai.controller';
import { DiagramAiService } from './diagram-ai.service';

@Module({ controllers: [DiagramAiController], providers: [DiagramAiService] })
export class DiagramAiModule {}

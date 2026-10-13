import { BadRequestException, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { DiagramAiService } from './diagram-ai.service';

type AuthRequest = Request & { user: AuthUser };
type UploadedDiagram = { buffer: Buffer; mimetype: string; originalname: string; size: number };

@UseGuards(JwtAuthGuard)
@Controller('diagram-ai')
export class DiagramAiController {
  constructor(private readonly diagramAi: DiagramAiService) {}

  @Post('draft')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } }))
  draft(@UploadedFile() file: UploadedDiagram | undefined, @Req() req: AuthRequest) {
    if (!file) throw new BadRequestException('Ảnh sơ đồ là bắt buộc');
    return this.diagramAi.generateDraft(file, req.user);
  }
}

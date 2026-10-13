import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ArchiveDiagramProjectDto, CreateDiagramProjectDto, DiagramCircuitInputDto, UpdateDiagramCircuitStatusDto, UpdateDiagramProjectDto } from './diagram-projects.dto';
import { DiagramProjectsService } from './diagram-projects.service';
type AuthRequest = Request & { user: AuthUser }; type Upload = { buffer: Buffer; mimetype: string; originalname: string; size: number };

@UseGuards(JwtAuthGuard) @Controller('diagram-projects')
export class DiagramProjectsController {
  constructor(private readonly service: DiagramProjectsService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() dto: CreateDiagramProjectDto, @Req() req: AuthRequest) { return this.service.create(dto, req.user); }
  @Get(':id') detail(@Param('id') id: string) { return this.service.detail(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDiagramProjectDto, @Req() req: AuthRequest) { return this.service.update(id, dto, req.user); }
  @Post(':id/archive') archive(@Param('id') id: string, @Body() dto: ArchiveDiagramProjectDto, @Req() req: AuthRequest) { return this.service.archive(id, dto.confirmationTitle, req.user); }
  @Post(':id/circuits') addCircuit(@Param('id') id: string, @Body() dto: DiagramCircuitInputDto, @Req() req: AuthRequest) { return this.service.addCircuit(id, dto, req.user); }
  @Put('circuits/:id/draft') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024 } })) saveDraft(@Param('id') id: string, @UploadedFile() file: Upload | undefined, @Body() body: Record<string, string>, @Req() req: AuthRequest) { if (!file) throw new BadRequestException('Ảnh nguồn là bắt buộc'); try { return this.service.saveDraft(id, { schema: JSON.parse(body.schema), warnings: JSON.parse(body.warnings || '[]'), uncertainItems: JSON.parse(body.uncertainItems || '[]'), validationErrors: JSON.parse(body.validationErrors || '[]'), model: body.model || 'unknown', preparation: body.preparation ? JSON.parse(body.preparation) : undefined }, file, req.user); } catch (error) { if (error instanceof SyntaxError) throw new BadRequestException('Draft payload JSON không hợp lệ'); throw error; } }
  @Get('circuits/:id/source') async source(@Param('id') id: string, @Res() response: Response) { const row = await this.service.source(id); response.type(row.sourceMimeType!); response.send(row.sourceImage); }
  @Patch('circuits/:id/status') status(@Param('id') id: string, @Body() dto: UpdateDiagramCircuitStatusDto, @Req() req: AuthRequest) { return this.service.updateStatus(id, dto.status, req.user); }
}

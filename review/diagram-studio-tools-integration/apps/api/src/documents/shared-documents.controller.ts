import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSharedDocumentDto, UpdateSharedDocumentDto } from './shared-document.dto';
import { SharedDocumentsService } from './shared-documents.service';

type AuthRequest = Request & { user: AuthUser };

@UseGuards(JwtAuthGuard)
@Controller('documents/shared')
export class SharedDocumentsController {
  constructor(private readonly documents: SharedDocumentsService) {}
  @Get() list() { return this.documents.list(); }
  @Post() create(@Body() dto: CreateSharedDocumentDto, @Req() req: AuthRequest) { return this.documents.create(dto, req.user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateSharedDocumentDto, @Req() req: AuthRequest) { return this.documents.update(id, dto, req.user); }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: AuthRequest) { return this.documents.remove(id, req.user); }
}

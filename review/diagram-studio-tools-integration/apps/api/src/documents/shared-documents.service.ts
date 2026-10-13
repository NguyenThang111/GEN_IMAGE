import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { CreateSharedDocumentDto, UpdateSharedDocumentDto } from './shared-document.dto';
import { SharedDocument } from './shared-document.entity';

@Injectable()
export class SharedDocumentsService {
  constructor(
    @InjectRepository(SharedDocument) private readonly documents: Repository<SharedDocument>,
    private readonly realtime: RealtimeGateway,
  ) {}

  list() {
    return this.documents.find({ where: { deletedAt: IsNull() }, order: { updatedAt: 'DESC' } });
  }

  async create(dto: CreateSharedDocumentDto, actor: AuthUser) {
    const saved = await this.documents.save(this.documents.create({
      title: dto.title.trim(), url: dto.url.trim(), description: dto.description?.trim() || null,
      createdById: actor.id, updatedById: actor.id, deletedById: null, deletedAt: null,
    }));
    this.realtime.emitTask('document.updated', saved);
    return saved;
  }

  async update(id: string, dto: UpdateSharedDocumentDto, actor: AuthUser) {
    const document = await this.requireEditable(id, actor);
    if (dto.title !== undefined) document.title = dto.title.trim();
    if (dto.url !== undefined) document.url = dto.url.trim();
    if (dto.description !== undefined) document.description = dto.description.trim() || null;
    document.updatedById = actor.id;
    const saved = await this.documents.save(document);
    this.realtime.emitTask('document.updated', saved);
    return saved;
  }

  async remove(id: string, actor: AuthUser) {
    const document = await this.requireEditable(id, actor);
    document.deletedAt = new Date();
    document.deletedById = actor.id;
    document.updatedById = actor.id;
    await this.documents.save(document);
    this.realtime.emitTask('document.updated', { id });
    return { id };
  }

  private async requireEditable(id: string, actor: AuthUser) {
    const document = await this.documents.findOneBy({ id, deletedAt: IsNull() });
    if (!document) throw new NotFoundException('Shared document not found');
    if (actor.role !== UserRole.ADMIN && document.createdById !== actor.id) throw new ForbiddenException('Only creator or Admin can edit this document');
    return document;
  }
}

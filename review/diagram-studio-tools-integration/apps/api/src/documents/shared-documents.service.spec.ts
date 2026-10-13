import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { SharedDocument } from './shared-document.entity';
import { SharedDocumentsService } from './shared-documents.service';

function actor(id: string, role = UserRole.MEMBER): AuthUser {
  return { id, username: id, displayName: id.toUpperCase(), role };
}

describe('SharedDocumentsService', () => {
  const document = { id: 'doc-1', title: 'Sơ đồ cáp', url: 'https://example.com', description: null, createdById: 'phu', updatedById: 'phu', deletedAt: null, deletedById: null } as SharedDocument;
  const realtime = { emitTask: jest.fn() } as unknown as RealtimeGateway;

  beforeEach(() => jest.clearAllMocks());

  it('allows the creator to update a shared link', async () => {
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({ ...document }),
      save: jest.fn().mockImplementation(async (value) => value),
    } as unknown as Repository<SharedDocument>;
    const service = new SharedDocumentsService(repository, realtime);
    const saved = await service.update(document.id, { title: 'Sơ đồ cáp mới' }, actor('phu'));
    expect(saved.title).toBe('Sơ đồ cáp mới');
    expect(realtime.emitTask).toHaveBeenCalledWith('document.updated', saved);
  });

  it('allows Admin to delete a link created by another member', async () => {
    const save = jest.fn().mockImplementation(async (value) => value);
    const repository = { findOneBy: jest.fn().mockResolvedValue({ ...document }), save } as unknown as Repository<SharedDocument>;
    const service = new SharedDocumentsService(repository, realtime);
    await expect(service.remove(document.id, actor('admin', UserRole.ADMIN))).resolves.toEqual({ id: document.id });
    expect(save.mock.calls[0][0].deletedById).toBe('admin');
  });

  it('blocks a different member from editing the link', async () => {
    const repository = { findOneBy: jest.fn().mockResolvedValue({ ...document }) } as unknown as Repository<SharedDocument>;
    const service = new SharedDocumentsService(repository, realtime);
    await expect(service.update(document.id, { title: 'Không hợp lệ' }, actor('vinh'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { InventoryImage, InventoryImageOwnerType } from './inventory-image.entity';
import { InventoryService } from './inventory.service';

describe('InventoryService image replacement', () => {
  const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
  const ownerType = InventoryImageOwnerType.FINISHED_PRODUCT;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: 'image/jpeg', size: 4 };

  function createService() {
    const saved = { id: 'new-image-id', ownerType, ownerId, mimeType: file.mimetype, byteSize: file.size, updatedAt: new Date('2026-08-15T12:00:00Z') };
    const manager = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((_entity, value) => value),
      save: jest.fn().mockResolvedValue(saved),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime });
    (service as unknown as { requireImageOwner: jest.Mock }).requireImageOwner = jest.fn().mockResolvedValue({ id: ownerId });
    return { service, dataSource, manager, realtime, saved };
  }

  it('deletes every old owner image and inserts exactly one new image in one transaction', async () => {
    const { service, dataSource, manager, realtime, saved } = createService();

    await expect(service.saveImage(ownerType, ownerId, file, actor)).resolves.toEqual({
      id: saved.id,
      ownerType,
      ownerId,
      mimeType: file.mimetype,
      byteSize: file.size,
      updatedAt: saved.updatedAt,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.delete).toHaveBeenCalledWith(InventoryImage, { ownerType, ownerId });
    expect(manager.create).toHaveBeenCalledWith(InventoryImage, {
      ownerType,
      ownerId,
      mimeType: file.mimetype,
      byteSize: file.size,
      data: file.buffer,
      uploadedById: actor.id,
    });
    expect(manager.delete.mock.invocationCallOrder[0]).toBeLessThan(manager.save.mock.invocationCallOrder[0]);
    expect(realtime.emitInventory).toHaveBeenCalledWith('inventory.image.updated', { ownerType, ownerId });
  });

  it('keeps the old image when the replacement fails validation', async () => {
    const { service, dataSource, manager } = createService();
    const invalid = { buffer: Buffer.from('not-an-image'), mimetype: 'image/jpeg', size: 12 };

    await expect(service.saveImage(ownerType, ownerId, invalid, actor)).rejects.toThrow('Image content does not match its file type');

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });
});

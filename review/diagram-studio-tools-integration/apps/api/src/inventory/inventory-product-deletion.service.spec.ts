import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { InventoryService } from './inventory.service';

describe('InventoryService product deletion', () => {
  const admin: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
  const member: AuthUser = { id: 'member-1', username: 'member', displayName: 'Member', role: UserRole.MEMBER };

  function createService(manager: Record<string, jest.Mock>) {
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime });
    return { service, realtime };
  }

  it('allows only Admin to delete finished products', async () => {
    const { service } = createService({});
    await expect(service.removeProduct('finished-1', member)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes a referenced finished product and detaches parent BOM lines', async () => {
    const product = { id: 'finished-1', name: 'Device EasyScan', isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValue(product),
      exists: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const { service } = createService(manager);

    await service.removeProduct(product.id, admin);

    expect(product.isActive).toBe(false);
    expect(manager.delete).toHaveBeenNthCalledWith(1, expect.any(Function), { componentProductId: product.id });
    expect(manager.delete).toHaveBeenNthCalledWith(2, expect.any(Function), { finishedProductId: product.id });
  });

  it('soft deletes an unreferenced finished product', async () => {
    const product = { id: 'finished-1', name: 'Device EasyScan', isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValue(product),
      exists: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const { service, realtime } = createService(manager);

    const saved = await service.removeProduct(product.id, admin);

    expect(saved.isActive).toBe(false);
    expect(manager.save).toHaveBeenCalledWith(product);
    expect(realtime.emitInventory).toHaveBeenCalledWith('inventory.product.updated', product);
  });

  it('blocks a finished product used by an unfinished production lot', async () => {
    const product = { id: 'finished-1', name: 'Device EasyScan', isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValue(product),
      exists: jest.fn().mockResolvedValue(true),
    };
    const { service } = createService(manager);

    await expect(service.removeProduct(product.id, admin)).rejects.toThrow('đang có Lô sản xuất chưa hoàn thành');
    expect(product.isActive).toBe(true);
  });

  it('blocks a sellable product used by an unfinished production lot', async () => {
    const product = { id: 'sellable-1', name: 'Máy đọc lỗi EasyScan', isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValue(product),
      exists: jest.fn().mockResolvedValue(true),
    };
    const { service } = createService(manager);

    await expect(service.removeSellableProduct(product.id, admin)).rejects.toThrow('đang có Lô sản xuất chưa hoàn thành');
    expect(product.isActive).toBe(true);
  });

  it('soft deletes a sellable product without an active production lot', async () => {
    const product = { id: 'sellable-1', name: 'Máy đọc lỗi EasyScan', isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValue(product),
      exists: jest.fn().mockResolvedValue(false),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const { service, realtime } = createService(manager);

    const saved = await service.removeSellableProduct(product.id, admin);

    expect(saved.isActive).toBe(false);
    expect(realtime.emitInventory).toHaveBeenCalledWith('inventory.sellable-product.updated', product);
  });
});

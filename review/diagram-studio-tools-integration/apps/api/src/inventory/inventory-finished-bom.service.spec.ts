import { DataSource, Repository } from 'typeorm';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { FinishedProductComponentItem } from './finished-product-component-item.entity';
import { InventoryService } from './inventory.service';
import { ProductBomItem } from './product-bom-item.entity';

describe('InventoryService finished product BOM', () => {
  function createService(componentLines: Partial<FinishedProductComponentItem>[] = []) {
    const manager = { delete: jest.fn(), save: jest.fn(), create: jest.fn((_entity, value) => value) };
    const dataSource = { transaction: jest.fn(async callback => callback(manager)) } as unknown as DataSource;
    const componentBomItems = { find: jest.fn().mockResolvedValue(componentLines) } as unknown as Repository<FinishedProductComponentItem>;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, {
      dataSource,
      componentBomItems,
      realtime,
      requireProduct: jest.fn(async (id: string) => ({ id, isActive: true })),
      requireItem: jest.fn(async () => ({ id: 'material-1', isActive: true })),
    });
    jest.spyOn(service, 'findProducts').mockResolvedValue([]);
    return { service, manager, dataSource };
  }

  it('keeps existing component products when an old client only replaces materials', async () => {
    const { service, manager } = createService([{ productId: 'device', componentProductId: 'board' }]);

    await service.replaceBom('device', { items: [{ itemId: 'material-1', quantity: 1 }] });

    expect(manager.delete).toHaveBeenCalledWith(ProductBomItem, { productId: 'device' });
    expect(manager.delete).not.toHaveBeenCalledWith(FinishedProductComponentItem, { productId: 'device' });
  });

  it('replaces component products together with materials', async () => {
    const { service, manager } = createService();

    await service.replaceBom('device', { items: [], components: [{ componentProductId: 'board', quantity: 1 }] });

    expect(manager.delete).toHaveBeenCalledWith(FinishedProductComponentItem, { productId: 'device' });
    expect(manager.save).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ productId: 'device', componentProductId: 'board' })]));
  });

  it('rejects a component cycle before changing stored BOM lines', async () => {
    const { service, dataSource } = createService([{ productId: 'board', componentProductId: 'device' }]);

    await expect(service.replaceBom('device', { items: [], components: [{ componentProductId: 'board', quantity: 1 }] })).rejects.toThrow('tạo vòng lặp');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});

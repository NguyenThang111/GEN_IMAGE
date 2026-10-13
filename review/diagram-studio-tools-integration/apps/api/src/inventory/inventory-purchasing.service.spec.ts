import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { EmailService } from '../email/email.service';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { UserRole } from '../users/user.entity';
import { InventoryService } from './inventory.service';
import { PurchasePaymentStatus, PurchaseRequestStatus } from './purchase-request.entity';
import { PurchasePaymentLog } from './purchase-payment-log.entity';
import { SystemNotificationsService } from '../notifications/system-notifications.service';

describe('InventoryService purchasing rules', () => {
  const systemNotifications = { create: jest.fn().mockResolvedValue(undefined) } as unknown as SystemNotificationsService;
  beforeEach(()=>jest.clearAllMocks());
  it('receives an ORDERED request, pays and rejects a duplicate receipt',async()=>{
    const request={id:'receipt-1',itemId:'item-1',status:PurchaseRequestStatus.ORDERED,paymentStatus:PurchasePaymentStatus.UNPAID,requestedQty:'200.000',requesterId:'member-1'};
    const item={id:'item-1',name:'Jack',unit:'unit',onHandQty:'29.000'};
    const manager={findOne:jest.fn().mockImplementation(async(entity,options)=>options.where.id==='receipt-1'?request:item),create:jest.fn().mockImplementation((entity,value)=>({id:'log-1',...value})),save:jest.fn().mockImplementation(async value=>value)};
    const service=Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service,{dataSource:{transaction:async(callback:any)=>callback(manager)},lockItem:jest.fn().mockResolvedValue(item),realtime:{emitInventory:jest.fn()},systemNotifications});
    const actor:AuthUser={id:'member-1',username:'giang',displayName:'GIANG',role:UserRole.MEMBER};
    const saved=await service.updatePurchaseRequest(request.id,{status:PurchaseRequestStatus.RECEIVED,receivedQuantity:180},actor);
    expect(saved).toMatchObject({status:PurchaseRequestStatus.RECEIVED,paymentStatus:PurchasePaymentStatus.PAID,receivedQty:'180.000',updatedById:actor.id});
    expect(saved.receivedAt).toBeInstanceOf(Date);
    expect(item.onHandQty).toBe('209.000');
    expect(manager.create).toHaveBeenCalledWith(PurchasePaymentLog,expect.objectContaining({fromStatus:PurchasePaymentStatus.UNPAID,toStatus:PurchasePaymentStatus.PAID,actorId:actor.id}));
    const saves=manager.save.mock.calls.length;
    await expect(service.updatePurchaseRequest(request.id,{status:PurchaseRequestStatus.RECEIVED,receivedQuantity:180},actor)).rejects.toThrow('Invalid purchase request transition');
    expect(manager.save).toHaveBeenCalledTimes(saves);
    expect(item.onHandQty).toBe('209.000');
    expect(manager.findOne).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({lock:{mode:'pessimistic_write'}}));
  });
  it('rejects receiving a request before it has been ordered',async()=>{
    const request={id:'receipt-1',itemId:'item-1',status:PurchaseRequestStatus.REQUESTED,paymentStatus:PurchasePaymentStatus.UNPAID,requestedQty:'200.000',requesterId:'member-1'};
    const manager={findOne:jest.fn().mockResolvedValue(request),create:jest.fn(),save:jest.fn()};
    const service=Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service,{dataSource:{transaction:async(callback:any)=>callback(manager)},realtime:{emitInventory:jest.fn()},systemNotifications});
    const actor:AuthUser={id:'member-1',username:'giang',displayName:'GIANG',role:UserRole.MEMBER};
    await expect(service.updatePurchaseRequest(request.id,{status:PurchaseRequestStatus.RECEIVED,receivedQuantity:200},actor)).rejects.toThrow('Phải xác nhận đã đặt hàng trước khi nhận hàng');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('commits the request and queues one deduplicated email for Purchasing Admin', async () => {
    const item = { id: 'item-1', name: 'Trở 330R', onHandQty: '20.000', minimumStock: '100.000' };
    const admin = { id: 'admin-1', username: 'admin', displayName: 'Admin', email: null, isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(item).mockResolvedValueOnce(admin),
      create: jest.fn().mockImplementation((_entity, value) => ({ id: 'request-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const email = { queue: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, email, realtime, systemNotifications });
    const actor: AuthUser = { id: 'phu-1', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };

    const saved = await service.createPurchaseRequest(item.id, { quantity: 25, note: 'Thiếu hàng' }, actor);

    expect(saved.id).toBe('request-1');
    expect(email.queue).toHaveBeenCalledTimes(1);
    expect((email.queue as jest.Mock).mock.calls[0][1]).toEqual([
      expect.objectContaining({
        recipient: admin,
        recipientEmail: 'easyscan.marketplace@gmail.com',
        eventType: 'PURCHASE_REQUEST_CREATED',
        dedupeKey: 'purchase-request:request-1:created',
      }),
    ]);
    expect(realtime.emitInventory).toHaveBeenCalledWith('inventory.purchase.updated', saved);
    expect(systemNotifications.create).toHaveBeenCalledWith(manager,expect.objectContaining({eventType:'PURCHASE_REQUEST_CREATED',entityId:'request-1',entityLabel:'Trở 330R'}));
  });

  it('assigns an active buyer when creating a request and notifies that buyer', async () => {
    const item = { id: 'item-1', name: 'Relay 5 chân', onHandQty: '5.000', minimumStock: '20.000' };
    const buyer = { id: 'vinh-1', username: 'vinh', displayName: 'VINH', isActive: true };
    const admin = { id: 'admin-1', username: 'admin', displayName: 'Admin', email: null, isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(item).mockResolvedValueOnce(buyer).mockResolvedValueOnce(admin),
      create: jest.fn().mockImplementation((_entity, value) => ({ id: 'request-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const email = { queue: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, email, realtime, systemNotifications });
    const actor: AuthUser = { id: 'phu-1', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };

    const saved = await service.createPurchaseRequest(item.id, { quantity: 20, assignedBuyerId: buyer.id }, actor);

    expect(saved.assignedBuyerId).toBe(buyer.id);
    expect(systemNotifications.create).toHaveBeenCalledWith(manager, expect.objectContaining({
      eventType: 'PURCHASE_REQUEST_CREATED',
      relatedUserIds: [buyer.id],
      message: 'đã giao bạn phụ trách mua',
    }));
  });

  it('allows reassigning an active request and notifies the new buyer', async () => {
    const request = {
      id: 'request-1', itemId: 'item-1', requestedQty: '20.000', note: null,
      status: PurchaseRequestStatus.ORDERED, paymentStatus: PurchasePaymentStatus.UNPAID,
      orderUrl: 'https://example.com/order', orderCode: null, requesterId: 'phu-1',
      assignedBuyerId: null, updatedById: 'phu-1',
    };
    const buyer = { id: 'vinh-1', username: 'vinh', displayName: 'VINH', isActive: true };
    const item = { id: 'item-1', name: 'Relay 5 chân' };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(request).mockResolvedValueOnce(buyer).mockResolvedValueOnce(item),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    const saved = await service.updatePurchaseRequest(request.id, { assignedBuyerId: buyer.id }, actor);

    expect(saved.assignedBuyerId).toBe(buyer.id);
    expect(systemNotifications.create).toHaveBeenCalledWith(manager, expect.objectContaining({
      eventType: 'PURCHASE_BUYER_ASSIGNED',
      relatedUserIds: ['phu-1', buyer.id],
    }));
  });

  it('rejects an inactive buyer', async () => {
    const request = {
      id: 'request-1', itemId: 'item-1', requestedQty: '20.000', note: null,
      status: PurchaseRequestStatus.REQUESTED, paymentStatus: PurchasePaymentStatus.UNPAID,
      orderUrl: null, orderCode: null, requesterId: 'phu-1', assignedBuyerId: null,
    };
    const manager = { findOne: jest.fn().mockResolvedValueOnce(request).mockResolvedValueOnce(null) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    await expect(service.updatePurchaseRequest(request.id, { assignedBuyerId: 'inactive-1' }, actor))
      .rejects.toThrow('Người phụ trách mua không hợp lệ');
  });

  it('locks buyer assignment after the request is received', async () => {
    const request = { id: 'request-1', status: PurchaseRequestStatus.RECEIVED, assignedBuyerId: 'vinh-1' };
    const manager = { findOne: jest.fn().mockResolvedValue(request) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    await expect(service.updatePurchaseRequest(request.id, { assignedBuyerId: 'phu-1' }, actor))
      .rejects.toThrow('Chỉ gán người mua khi Request đang hoạt động');
  });

  it('edits item, quantity and note only while REQUESTED and keeps requester', async () => {
    const request = { id: 'request-1', itemId: 'old-item', requestedQty: '10.000', note: null, requesterId: 'phu-1', updatedById: 'phu-1', status: PurchaseRequestStatus.REQUESTED, paymentStatus: PurchasePaymentStatus.UNPAID };
    const newItem = { id: 'new-item', isActive: true };
    const manager = {
      findOne: jest.fn().mockResolvedValueOnce(request).mockResolvedValueOnce(newItem),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });
    const actor: AuthUser = { id: 'vinh-1', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER };

    const saved = await service.updatePurchaseRequest(request.id, { itemId: newItem.id, quantity: 25, note: 'Đổi mã mua' }, actor);

    expect(saved).toEqual(expect.objectContaining({ itemId: newItem.id, requestedQty: '25.000', note: 'Đổi mã mua', requesterId: 'phu-1', updatedById: 'vinh-1' }));
    expect(systemNotifications.create).toHaveBeenCalledWith(manager,expect.objectContaining({eventType:'PURCHASE_REQUEST_EDITED',relatedUserIds:['phu-1']}));
    expect(systemNotifications.create).toHaveBeenCalledTimes(1);
  });

  it.each([PurchaseRequestStatus.ORDERED, PurchaseRequestStatus.RECEIVED, PurchaseRequestStatus.CANCELLED])('rejects content edits after status is %s', async (status) => {
    const request = { id: 'request-1', status };
    const manager = { findOne: jest.fn().mockResolvedValue(request) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });
    const actor: AuthUser = { id: 'phu-1', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };

    await expect(service.updatePurchaseRequest(request.id, { quantity: 99 }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires an order link or code when moving to ORDERED', async () => {
    const request = { id: 'request-1', status: PurchaseRequestStatus.REQUESTED, orderUrl: null, orderCode: null };
    const manager = { findOne: jest.fn().mockResolvedValue(request) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    await expect(service.updatePurchaseRequest(request.id, { status: PurchaseRequestStatus.ORDERED }, actor)).rejects.toThrow('Cần link hoặc mã đơn hàng');
    expect(request.status).toBe(PurchaseRequestStatus.REQUESTED);
  });

  it.each([
    { orderUrl: 'https://example.com/orders/123', orderCode: null },
    { orderUrl: null, orderCode: 'ORDER-123' },
  ])('moves to ORDERED with an order reference', async (reference) => {
    const request = { id: 'request-1', status: PurchaseRequestStatus.REQUESTED, orderUrl: null, orderCode: null, updatedById: 'phu-1' };
    const manager = { findOne: jest.fn().mockResolvedValue(request), save: jest.fn().mockImplementation(async (value) => value) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    const saved = await service.updatePurchaseRequest(request.id, { status: PurchaseRequestStatus.ORDERED, ...reference }, actor);

    expect(saved).toEqual(expect.objectContaining({ status: PurchaseRequestStatus.ORDERED, ...reference }));
    expect(systemNotifications.create).toHaveBeenCalledWith(manager,expect.objectContaining({eventType:'PURCHASE_REQUEST_ORDERED'}));
  });

  it('edits the order reference while ORDERED and locks it after RECEIVED', async () => {
    const ordered = { id: 'request-1', status: PurchaseRequestStatus.ORDERED, orderUrl: 'https://example.com/old', orderCode: null, updatedById: 'phu-1' };
    const manager = { findOne: jest.fn().mockResolvedValueOnce(ordered), save: jest.fn().mockImplementation(async (value) => value) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    const saved = await service.updatePurchaseRequest(ordered.id, { orderUrl: null, orderCode: 'NEW-456' }, actor);
    expect(saved).toEqual(expect.objectContaining({ orderUrl: null, orderCode: 'NEW-456' }));

    const received = { ...saved, status: PurchaseRequestStatus.RECEIVED };
    manager.findOne.mockResolvedValueOnce(received);
    await expect(service.updatePurchaseRequest(received.id, { orderCode: 'LATE-EDIT' }, actor)).rejects.toThrow('Chỉ sửa đơn mua khi Request đang Đang mua');
  });

  it('does not allow clearing the final order reference while ORDERED', async () => {
    const request = { id: 'request-1', status: PurchaseRequestStatus.ORDERED, orderUrl: null, orderCode: 'ORDER-123' };
    const manager = { findOne: jest.fn().mockResolvedValue(request) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });
    const actor: AuthUser = { id: 'admin-1', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    await expect(service.updatePurchaseRequest(request.id, { orderCode: null }, actor)).rejects.toThrow('Cần link hoặc mã đơn hàng');
  });

  it('allows a member to update payment and records the actor in a dedicated log', async () => {
    const request = { id: 'request-1', status: PurchaseRequestStatus.ORDERED, paymentStatus: PurchasePaymentStatus.UNPAID, updatedById: 'admin-1' };
    const manager = {
      findOne: jest.fn().mockResolvedValue(request),
      create: jest.fn().mockImplementation((_entity, value) => ({ id: 'payment-log-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });
    const actor: AuthUser = { id: 'vinh-1', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER };

    const saved = await service.updatePurchaseRequest(request.id, { paymentStatus: PurchasePaymentStatus.PARTIAL }, actor);

    expect(saved.paymentStatus).toBe(PurchasePaymentStatus.PARTIAL);
    expect(manager.create).toHaveBeenCalledWith(PurchasePaymentLog, {
      requestId: request.id,
      fromStatus: PurchasePaymentStatus.UNPAID,
      toStatus: PurchasePaymentStatus.PARTIAL,
      actorId: actor.id,
    });
  });

  it('does not create a duplicate payment log when the status is unchanged', async () => {
    const request = { id: 'request-1', itemId:'item-1', requestedQty:'10.000', note:null, status: PurchaseRequestStatus.ORDERED, paymentStatus: PurchasePaymentStatus.PARTIAL, orderUrl:'https://example.com/order', orderCode:null, requesterId:'phu-1', updatedById: 'phu-1' };
    const manager = {
      findOne: jest.fn().mockResolvedValue(request),
      create: jest.fn(),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });
    const actor: AuthUser = { id: 'phu-1', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };

    await service.updatePurchaseRequest(request.id, { paymentStatus: PurchasePaymentStatus.PARTIAL }, actor);

    expect(manager.create).not.toHaveBeenCalled();
    expect(systemNotifications.create).not.toHaveBeenCalled();
  });

  it('blocks payment updates after a request is cancelled', async () => {
    const request = { id: 'request-1', status: PurchaseRequestStatus.CANCELLED, paymentStatus: PurchasePaymentStatus.UNPAID };
    const manager = { findOne: jest.fn().mockResolvedValue(request) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });
    const actor: AuthUser = { id: 'nam-1', username: 'nam', displayName: 'NAM', role: UserRole.MEMBER };

    await expect(service.updatePurchaseRequest(request.id, { paymentStatus: PurchasePaymentStatus.PAID }, actor)).rejects.toThrow('Purchase request is cancelled');
  });

  it.each([PurchaseRequestStatus.REQUESTED, PurchaseRequestStatus.CANCELLED])('deletes a %s request', async (status) => {
    const request = { id: 'request-1', status };
    const manager = { findOne: jest.fn().mockResolvedValue(request), delete: jest.fn().mockResolvedValue({ affected: 1 }) };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const realtime = { emitInventory: jest.fn() } as unknown as RealtimeGateway;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, realtime, systemNotifications });

    await expect(service.removePurchaseRequest(request.id)).resolves.toEqual({ id: request.id });
    expect(manager.delete).toHaveBeenCalledTimes(1);
  });

  it.each([PurchaseRequestStatus.ORDERED, PurchaseRequestStatus.RECEIVED])('blocks delete after status is %s', async (status) => {
    const manager = { findOne: jest.fn().mockResolvedValue({ id: 'request-1', status }), delete: jest.fn() };
    const dataSource = { transaction: jest.fn().mockImplementation(async (callback) => callback(manager)) } as unknown as DataSource;
    const service = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(service, { dataSource, systemNotifications });

    await expect(service.removePurchaseRequest('request-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(manager.delete).not.toHaveBeenCalled();
  });
});

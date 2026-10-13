import { Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { SystemNotificationModule } from '../notifications/system-notification.entity';
import { SystemNotificationsService } from '../notifications/system-notifications.service';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { User, UserRole } from '../users/user.entity';
import { ProductionEntry, ProductionModule, ProductionOutputType } from './production-entry.entity';
import { ProductionEntryLot } from './production-entry-lot.entity';
import { ProductionLot, ProductionLotStatus } from './production-lot.entity';
import { ProductionLotAssignee } from './production-lot-assignee.entity';
import { ProductionPaymentRequest, ProductionPaymentStatus } from './production-payment-request.entity';
import { ProductionService } from './production.service';

describe('ProductionService activity notifications',()=>{
  const member:AuthUser={id:'member-1',username:'nam',displayName:'NAM',role:UserRole.MEMBER};
  const admin:AuthUser={id:'admin-1',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
  const systemNotifications={create:jest.fn().mockResolvedValue(undefined)} as unknown as SystemNotificationsService;
  const realtime={emitInventory:jest.fn()} as unknown as RealtimeGateway;
  beforeEach(()=>jest.clearAllMocks());

  it('notifies Admin when a member submits a production report',async()=>{
    const manager={} as never;
    const lotId='11111111-1111-4111-8111-111111111111';
    const saved={id:'entry-1',userId:member.id,workDate:'2026-08-11',rawText:'Đóng 5 bộ cáp',outputLabel:'Việc đã làm'};
    const entries={manager} as unknown as Repository<ProductionEntry>;
    const users={exist:jest.fn().mockResolvedValue(true),findOneBy:jest.fn().mockResolvedValue({id:member.id,displayName:'NAM'})} as unknown as Repository<User>;
    const transactionManager={
      findBy:jest.fn(async(entity:Function)=>entity===ProductionLotAssignee?[{lotId,userId:member.id}]:entity===ProductionLot?[{id:lotId,status:ProductionLotStatus.IN_PROGRESS}]:[]),
      create:jest.fn((_entity,value)=>value),
      save:jest.fn(async value=>Array.isArray(value)?value:'outputLabel' in value?saved:value),
    };
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{entries,users,finished:{},sellable:{},dataSource:{transaction:jest.fn(callback=>callback(transactionManager))},systemNotifications,realtime,assertUnlocked:jest.fn(),ensurePaymentRequest:jest.fn().mockResolvedValue(null)});

    await service.createEntry({userId:member.id,workDate:'2026-08-11',module:ProductionModule.SUPPORT,workType:'Báo cáo tự do',outputType:ProductionOutputType.LABEL,outputLabel:'Việc đã làm',rawText:'Đóng 5 bộ cáp'},member);

    expect(systemNotifications.create).toHaveBeenCalledWith(manager,expect.objectContaining({module:SystemNotificationModule.PRODUCTION,eventType:'PRODUCTION_REPORT_CREATED',entityId:'entry-1',relatedUserIds:[member.id]}));
    expect(realtime.emitInventory).toHaveBeenCalledWith('production.updated',saved);
  });

  it('rejects a production report without an Incharge Lot',async()=>{
    const users={exist:jest.fn().mockResolvedValue(true)} as unknown as Repository<User>;
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{users,finished:{},sellable:{},assertUnlocked:jest.fn(),dataSource:{transaction:jest.fn(callback=>callback({findBy:jest.fn().mockResolvedValue([])}))}});
    await expect(service.createEntry({userId:member.id,workDate:'2026-08-11',module:ProductionModule.SUPPORT,workType:'Báo cáo tự do',outputType:ProductionOutputType.LABEL,outputLabel:'Việc đã làm',rawText:'Việc không có Lô'},member)).rejects.toThrow('Cần đăng ký ít nhất một Lô đang sản xuất trước khi báo cáo');
  });

  it('updates the existing daily report and replaces its Lot links',async()=>{
    const lotId='11111111-1111-4111-8111-111111111111';
    const newLotId='22222222-2222-4222-8222-222222222222';
    const existing={id:'entry-1',userId:member.id,workDate:'2026-08-11',module:ProductionModule.SUPPORT,workType:'Báo cáo tự do',outputType:ProductionOutputType.LABEL,outputId:null,outputLabel:'Việc đã làm',quantity:null,progressPercent:null,note:null,rawText:'Cũ',needsReview:true,updatedAt:new Date('2026-08-11T09:00:00Z')};
    const lot={id:lotId,code:'SX-1',status:ProductionLotStatus.IN_PROGRESS};
    const manager={
      findOne:jest.fn(async(entity:Function)=>entity===ProductionEntry?existing:null),
      findBy:jest.fn(async(entity:Function)=>entity===ProductionEntryLot?[{entryId:existing.id,lotId}]:entity===ProductionLotAssignee?[{lotId:newLotId,userId:member.id}]:entity===ProductionLot?[{id:newLotId,status:ProductionLotStatus.IN_PROGRESS}]:[]),
      create:jest.fn((_entity,value)=>value),
      save:jest.fn(async value=>{if(!Array.isArray(value)&&'rawText' in value)value.updatedAt=new Date('2026-08-11T10:00:00Z');return value;}),
      delete:jest.fn().mockResolvedValue(undefined),
    };
    const entries={manager,findOneBy:jest.fn().mockResolvedValue(existing)} as unknown as Repository<ProductionEntry>;
    const users={findOneBy:jest.fn().mockResolvedValue({id:member.id,displayName:'NAM'})} as unknown as Repository<User>;
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{entries,users,finished:{},sellable:{},dataSource:{transaction:jest.fn(callback=>callback(manager))},systemNotifications,realtime,assertUnlocked:jest.fn()});

    const saved=await service.updateEntry(existing.id,{userId:member.id,workDate:'2026-08-11',module:ProductionModule.SUPPORT,workType:'Báo cáo tự do',outputType:ProductionOutputType.LABEL,outputLabel:'Việc đã làm',rawText:'Đã sửa',needsReview:true},member);

    expect(saved.rawText).toBe('Đã sửa');
    expect(manager.delete).toHaveBeenCalledWith(ProductionEntryLot,{entryId:existing.id});
    expect(manager.save).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({entryId:existing.id,lotId}),expect.objectContaining({entryId:existing.id,lotId:newLotId})]));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({lotId:newLotId,type:'REPORT_LINKED'}));
    expect(systemNotifications.create).toHaveBeenCalledWith(manager,expect.objectContaining({eventType:'PRODUCTION_REPORT_UPDATED',entityId:existing.id}));
  });

  it('notifies the member when Admin confirms settlement payment',async()=>{
    const manager={} as never;
    const row={id:'payment-1',userId:member.id,totalHours:'12.00',workSummary:[{date:'2026-08-01',outputs:[]}],status:ProductionPaymentStatus.REQUESTED,paidById:null,paidAt:null};
    const payments={manager,findOneBy:jest.fn().mockResolvedValue(row),save:jest.fn().mockImplementation(async value=>value)} as unknown as Repository<ProductionPaymentRequest>;
    const users={findOneBy:jest.fn().mockResolvedValue({id:member.id,displayName:'NAM'})} as unknown as Repository<User>;
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{payments,users,systemNotifications,realtime});

    const saved=await service.markPaid(row.id,admin);

    expect(saved.status).toBe(ProductionPaymentStatus.PAID);
    expect(systemNotifications.create).toHaveBeenCalledWith(manager,expect.objectContaining({eventType:'PRODUCTION_PAYMENT_PAID',entityId:row.id,relatedUserIds:[member.id]}));
  });
});

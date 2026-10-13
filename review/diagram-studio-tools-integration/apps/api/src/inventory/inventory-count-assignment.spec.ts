import { validate } from 'class-validator';
import { AuthUser } from '../auth/auth.types';
import { UserRole } from '../users/user.entity';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './inventory-item.entity';
import { InventoryTransactionType } from './inventory-transaction.entity';
import { RequestInventoryCountDto } from './inventory.dto';

const actor:AuthUser={id:'requester',username:'requester',displayName:'Người giao',role:UserRole.MEMBER};
function setup(){
  const item={id:'material',name:'Trở',unit:'unit',isActive:true,onHandQty:'88.000',checkRequestedAt:null,checkRequestedById:null,checkAssignedToId:null,checkRequestNote:null} as unknown as InventoryItem;
  const manager={findOne:jest.fn().mockResolvedValue(item),findOneBy:jest.fn().mockResolvedValue({id:'assignee',displayName:'Người kiểm'}),create:jest.fn((entity,value)=>({id:'event-id',...value})),save:jest.fn(async value=>value)};
  const create=jest.fn().mockResolvedValue(undefined);
  const emitInventory=jest.fn();
  const service=Object.create(InventoryService.prototype) as InventoryService;
  Object.assign(service,{dataSource:{transaction:async(callback:any)=>callback(manager)},systemNotifications:{create},realtime:{emitInventory}});
  return {service,item,manager,create,emitInventory};
}

describe('Inventory count assignment',()=>{
  it('validates a required UUID and bounds notes',async()=>{
    expect((await validate(Object.assign(new RequestInventoryCountDto(),{}))).length).toBeGreaterThan(0);
    expect((await validate(Object.assign(new RequestInventoryCountDto(),{assigneeId:'bad',note:'a'.repeat(501)}))).length).toBe(2);
    expect(await validate(Object.assign(new RequestInventoryCountDto(),{assigneeId:'12345678-1234-4123-8123-123456789012',note:'Kiểm lại'}))).toEqual([]);
  });
  it('locks the material and notifies the assignee in the same transaction',async()=>{
    const {service,item,manager,create,emitInventory}=setup();
    await service.requestCount(item.id,{assigneeId:'assignee',note:' Kiểm lại '},actor);
    expect(manager.findOne).toHaveBeenCalledWith(InventoryItem,{where:{id:item.id},lock:{mode:'pessimistic_write'}});
    expect(item).toMatchObject({checkAssignedToId:'assignee',checkRequestedById:actor.id,checkRequestNote:'Kiểm lại',onHandQty:'88.000'});
    expect(create).toHaveBeenCalledWith(manager,expect.objectContaining({relatedUserIds:['assignee'],eventType:'INVENTORY_COUNT_ASSIGNED',entityId:item.id,module:'INVENTORY'}));
    expect(emitInventory).toHaveBeenCalledTimes(1);
    // A retry or competing assignment must not send another notification.
    await expect(service.requestCount(item.id,{assigneeId:'assignee'},actor)).rejects.toThrow('đã có người');
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('allows an old unassigned request to gain an assignee',async()=>{
    const {service,item}=setup();item.checkRequestedAt=new Date();item.checkRequestedById='old-requester';
    await service.requestCount(item.id,{assigneeId:'assignee'},actor);
    expect(item.checkAssignedToId).toBe('assignee');
  });
  it('rejects an inactive recipient without writing',async()=>{
    const {service,manager,create}=setup();manager.findOneBy.mockResolvedValue(null);
    await expect(service.requestCount('material',{assigneeId:'assignee'},actor)).rejects.toThrow('không còn hoạt động');
    expect(manager.save).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
  });
  it('rejects an inactive material',async()=>{
    const {service,item,manager}=setup();item.isActive=false;
    await expect(service.requestCount(item.id,{assigneeId:'assignee'},actor)).rejects.toThrow('ngừng sử dụng');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('includes a member assigning the count to themselves',async()=>{
    const {service,manager,create}=setup();manager.findOneBy.mockResolvedValue({id:actor.id,displayName:actor.displayName});
    await service.requestCount('material',{assigneeId:actor.id},actor);
    expect(create).toHaveBeenCalledWith(manager,expect.objectContaining({includeActor:true,relatedUserIds:[actor.id]}));
  });
  it('propagates notification failure out of the transaction without broadcasting success',async()=>{
    const {service,create,emitInventory}=setup();create.mockRejectedValue(new Error('notification failed'));
    await expect(service.requestCount('material',{assigneeId:'assignee'},actor)).rejects.toThrow('notification failed');
    expect(emitInventory).not.toHaveBeenCalled();
  });
  it('completes on STOCK_COUNT, records the actual checker, and notifies the requester once',async()=>{
    const {service,item,manager,create}=setup();
    await service.requestCount(item.id,{assigneeId:'assignee'},actor);create.mockClear();
    const checker={...actor,id:'assignee'};
    await service.movement(item.id,{type:InventoryTransactionType.STOCK_COUNT,quantity:90,note:'Đã đếm'},checker);
    expect(item).toMatchObject({onHandQty:'90.000',lastCountedById:'assignee',checkAssignedToId:null,checkRequestedById:null,checkRequestedAt:null,checkRequestNote:null});
    expect(create).toHaveBeenCalledWith(manager,expect.objectContaining({relatedUserIds:[actor.id],eventType:'INVENTORY_COUNT_COMPLETED',bodyPreview:'Tồn thực tế: 90 unit · Đã đếm'}));
    await service.movement(item.id,{type:InventoryTransactionType.STOCK_COUNT,quantity:90},checker);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('rejects count completion when its notification fails, before broadcasting',async()=>{
    const {service,item,create,emitInventory}=setup();
    await service.requestCount(item.id,{assigneeId:'assignee'},actor);
    create.mockRejectedValue(new Error('notification failed'));emitInventory.mockClear();
    await expect(service.movement(item.id,{type:InventoryTransactionType.STOCK_COUNT,quantity:90},{...actor,id:'assignee'})).rejects.toThrow('notification failed');
    expect(emitInventory).not.toHaveBeenCalled();
    expect(item.checkAssignedToId).toBe('assignee');
  });
  it('keeps a pending request during ordinary stock movements',async()=>{
    const {service,item,create}=setup();
    await service.requestCount(item.id,{assigneeId:'assignee'},actor);create.mockClear();
    await service.movement(item.id,{type:InventoryTransactionType.IN,quantity:2},actor);
    expect(item.checkAssignedToId).toBe('assignee');expect(create).not.toHaveBeenCalled();
  });
});

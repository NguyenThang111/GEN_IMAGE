import { ProductionService } from './production.service';
import { ProductionLot, ProductionLotStatus } from './production-lot.entity';
import { ProductionLotEvent, ProductionLotEventType } from './production-lot-event.entity';
import { AuthUser } from '../auth/auth.types';
import { UserRole } from '../users/user.entity';

describe('Production Test method isolation', () => {
  const actor: AuthUser = { id:'tester', username:'phongbk', displayName:'PHONG BK', role:UserRole.MEMBER };
  function setup(status=ProductionLotStatus.WAITING_TEST, cloud=false) {
    const lot={id:'lot-20',code:'SX-20',status,targetQuantity:20,producedQuantity:20,testProfileKey:cloud?'CABLE_RED':null,testProfileVersion:cloud?1:null} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),exists:jest.fn().mockResolvedValue(true),save:jest.fn(async value=>value),create:jest.fn((_entity,value)=>value)};
    const service=Object.create(ProductionService.prototype) as ProductionService;
    const impact={inventoryChanged:false,output:{},components:[],warnings:[]};
    Object.assign(service,{dataSource:{transaction:async(callback:Function)=>callback(manager)},realtime:{emitInventory:jest.fn()},buildLotImpact:jest.fn().mockResolvedValue(impact),applyLotImpact:jest.fn(),recordWorkedMinutes:jest.fn()});
    return {service,lot,manager};
  }
  it('persists the standalone claim with the same lot ID, tester and timestamp',async()=>{
    const {service,lot,manager}=setup();
    await service.claimTest(lot.id,actor);
    expect(lot).toMatchObject({id:'lot-20',status:ProductionLotStatus.TESTING,testClaimedById:actor.id,testClaimedAt:expect.any(Date),testProfileKey:null});
    expect(manager.create).toHaveBeenCalledWith(ProductionLotEvent,expect.objectContaining({lotId:lot.id,actorId:actor.id,payload:expect.objectContaining({testMethod:'STANDALONE',source:'WEB',claimedAt:expect.any(String)})}));
    await expect(service.publishDeviceTest(lot.id,actor)).rejects.toMatchObject({status:410});
  });
  it('does not allow another operator to claim a standalone lot again',async()=>{
    const {service,lot}=setup();await service.claimTest(lot.id,actor);
    await expect(service.claimTest(lot.id,{...actor,id:'other'})).rejects.toThrow('chưa chờ Test');
    expect(lot.testClaimedById).toBe(actor.id);
  });
  it('persists standalone result and completion on the server only once',async()=>{
    const {service,lot,manager}=setup();await service.claimTest(lot.id,actor);
    const dto={testedQuantity:20,passedQuantity:18,failedQuantity:2,note:'2 cáp lỗi'};
    await service.completeTest(lot.id,dto,actor);
    expect(lot).toMatchObject({status:ProductionLotStatus.DONE,completedQuantity:18,failedQuantity:2,testedById:actor.id,testedAt:expect.any(Date)});
    expect(manager.create).toHaveBeenCalledWith(ProductionLotEvent,expect.objectContaining({lotId:lot.id,type:ProductionLotEventType.TESTED,payload:expect.objectContaining({source:'WEB',testMethod:'STANDALONE',testedQuantity:20,passedQuantity:18,failedQuantity:2,note:'2 cáp lỗi'})}));
    const saves=manager.save.mock.calls.length;
    await expect(service.completeTest(lot.id,dto,actor)).rejects.toThrow('chưa được nhận Test');
    expect(manager.save).toHaveBeenCalledTimes(saves);
  });
  it('rejects manual results for cloud lots, including Admin',async()=>{
    const {service,lot,manager}=setup(ProductionLotStatus.TESTING,true);
    await expect(service.completeTest(lot.id,{testedQuantity:20,passedQuantity:20,failedQuantity:0},{...actor,role:UserRole.ADMIN})).rejects.toThrow('migration');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('rejects mismatched totals and a different tester without saving',async()=>{
    const {service,lot,manager}=setup(ProductionLotStatus.TESTING);lot.testClaimedById='other';
    await expect(service.completeTest(lot.id,{testedQuantity:20,passedQuantity:19,failedQuantity:0},actor)).rejects.toThrow('Số đạt + lỗi');
    await expect(service.completeTest(lot.id,{testedQuantity:20,passedQuantity:20,failedQuantity:0},actor)).rejects.toThrow('Chỉ người nhận Test');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it.each([false,true])('locks quantity and mode after choosing a test method (cloud=%s)',async cloud=>{
    const {service,lot,manager}=setup(cloud?ProductionLotStatus.WAITING_TEST:ProductionLotStatus.TESTING,cloud);
    const admin={...actor,role:UserRole.ADMIN};
    await expect(service.updateLot(lot.id,{producedQuantity:10},admin)).rejects.toThrow('không đổi số lượng');
    await expect(service.updateLot(lot.id,{status:ProductionLotStatus.IN_PROGRESS},admin)).rejects.toThrow();
    expect(manager.save).not.toHaveBeenCalled();
    await expect(service.updateLot(lot.id,{status:lot.status,targetQuantity:20,producedQuantity:20,note:'Giữ nguyên số lượng'},admin)).resolves.toMatchObject({note:'Giữ nguyên số lượng'});
  });
  it('requires the explicit test action instead of the Admin status dropdown',async()=>{
    const {service,lot}=setup();
    await expect(service.updateLot(lot.id,{status:ProductionLotStatus.TESTING},{...actor,role:UserRole.ADMIN})).rejects.toThrow('Nhận Test');
  });
  it('rejects new Cloud profiles without starting a write transaction',async()=>{
    const {service,lot,manager}=setup();
    await expect(service.updateLot(lot.id,{testProfileKey:'CABLE_RED',testProfileVersion:1},{...actor,role:UserRole.ADMIN})).rejects.toMatchObject({status:410});
    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('allows a participant to save notes without changing the locked test state',async()=>{
    const {service,lot}=setup(ProductionLotStatus.TESTING);
    await expect(service.updateLot(lot.id,{status:lot.status,note:'Đang kiểm tra'},actor)).resolves.toMatchObject({status:ProductionLotStatus.TESTING,note:'Đang kiểm tra'});
  });
});

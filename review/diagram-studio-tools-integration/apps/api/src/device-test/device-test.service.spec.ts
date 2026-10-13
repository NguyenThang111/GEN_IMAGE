import { ConflictException } from '@nestjs/common';
import { IsNull, Not } from 'typeorm';
import { ProductionLot, ProductionLotStatus } from '../production/production-lot.entity';
import { DeviceTestService } from './device-test.service';
import { DeviceTestStation } from './device-test-station.entity';
import { DeviceTestResult, ProductionLotDeviceTest } from './production-lot-device-test.entity';
import { DeviceTestLotRelease } from './device-test-lot-release.entity';

describe('DeviceTestService',()=>{
  const station={id:'station-1',stationCode:'ESP32-TEST-01'} as DeviceTestStation;
  const baseLot=()=>({id:'lot-1',code:'SX-1',outputId:'out-1',outputLabel:'Cáp ECM Đỏ',status:ProductionLotStatus.TESTING,testProfileKey:'CABLE_ECM_RED',testProfileVersion:1,testStationId:station.id,deviceTestTargetPassCount:20,targetQuantity:20,producedQuantity:20,deletedAt:null} as ProductionLot);
  const dto={testRunId:'ESP32-TEST-01-000182',testProfileKey:'CABLE_ECM_RED',testProfileVersion:1,result:DeviceTestResult.PASS,testedAt:'2026-09-07T09:29:55.000Z'};

  function setup(lot=baseLot(),options:{prior?:ProductionLotDeviceTest|null;priorRelease?:DeviceTestLotRelease|null;passCount?:number;failCount?:number;otherLot?:ProductionLot|null}={}){
    const manager={
      findOne:jest.fn(async(entity:Function)=>entity===ProductionLot?lot:options.prior??null),
      findOneBy:jest.fn(async(entity:Function)=>entity===ProductionLotDeviceTest?options.prior??null:entity===DeviceTestLotRelease?options.priorRelease??null:entity===ProductionLot?options.otherLot??null:null),
      countBy:jest.fn(async(_entity:Function,where:{result:DeviceTestResult})=>where.result===DeviceTestResult.PASS?(options.passCount??0):(options.failCount??0)),
      save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value),
    };
    const production={finalizeDeviceTestLot:jest.fn(async()=>{lot.status=ProductionLotStatus.DONE;return {lot};})};
    const service=Object.create(DeviceTestService.prototype) as DeviceTestService;
    const realtime={emitInventory:jest.fn()};
    Object.assign(service,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager)),manager},production,realtime});
    return {service,manager,production,realtime};
  }

  it('claims a waiting lot and snapshots its target',async()=>{
    const lot={...baseLot(),status:ProductionLotStatus.WAITING_TEST,testStationId:null,deviceTestTargetPassCount:null} as ProductionLot;
    const {service,manager}=setup(lot);
    manager.findOneBy.mockResolvedValue(null);
    const result=await service.claim(lot.id,station);
    expect(lot).toMatchObject({status:ProductionLotStatus.TESTING,testStationId:station.id,deviceTestTargetPassCount:20});
    expect(result).toMatchObject({targetPassCount:20,passCount:0,remainingCount:20,claimedByThisStation:true});
  });

  it('does not expose standalone lots to the station queue',async()=>{
    const {service}=setup();const findAndCount=jest.fn().mockResolvedValue([[],0]);
    Object.assign(service,{lots:{findAndCount}});
    await service.findLots(station);
    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({take:16,where:[
      {status:ProductionLotStatus.WAITING_TEST,testProfileKey:Not(IsNull()),deletedAt:IsNull()},
      {status:ProductionLotStatus.TESTING,testProfileKey:Not(IsNull()),testStationId:station.id,deletedAt:IsNull()},
    ]}));
  });

  it('rejects a station claiming a standalone lot',async()=>{
    const lot={...baseLot(),testProfileKey:null,testProfileVersion:null,testStationId:null,testClaimedById:'tester'} as ProductionLot;
    const {service,manager}=setup(lot);
    await expect(service.claim(lot.id,station)).rejects.toMatchObject({response:{code:'LOT_NOT_READY'}});
    await expect(service.submitResult(lot.id,dto,station)).rejects.toMatchObject({response:{code:'LOT_NOT_CLAIMED_BY_STATION'}});
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('returns current progress when the same station claims again',async()=>{
    const {service,manager}=setup(baseLot(),{passCount:13,failCount:2});
    const result=await service.claim('lot-1',station);
    expect(result).toMatchObject({passCount:13,failCount:2,remainingCount:7});
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a lot claimed by another station',async()=>{
    const lot={...baseLot(),testStationId:'station-2'} as ProductionLot;
    const {service}=setup(lot);
    await expect(service.claim(lot.id,station)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a second active lot for the same station',async()=>{
    const lot={...baseLot(),id:'lot-2',status:ProductionLotStatus.WAITING_TEST,testStationId:null} as ProductionLot;
    const {service}=setup(lot,{otherLot:baseLot()});
    await expect(service.claim(lot.id,station)).rejects.toMatchObject({response:{code:'STATION_HAS_ACTIVE_LOT'}});
  });

  it('stores FAIL without increasing pass progress or finalizing',async()=>{
    const {service,manager,production}=setup(baseLot(),{passCount:4,failCount:3});
    const result=await service.submitResult('lot-1',{...dto,result:DeviceTestResult.FAIL},station);
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({result:DeviceTestResult.FAIL,testRunId:dto.testRunId}));
    expect(result).toMatchObject({passCount:4,failCount:3,lotStatus:ProductionLotStatus.TESTING});
    expect(production.finalizeDeviceTestLot).not.toHaveBeenCalled();
  });

  it('finalizes automatically when the unique PASS reaches target',async()=>{
    const lot={...baseLot(),deviceTestTargetPassCount:20} as ProductionLot;
    const {service,production}=setup(lot,{passCount:20,failCount:2});
    const result=await service.submitResult(lot.id,dto,station);
    expect(production.finalizeDeviceTestLot).toHaveBeenCalledWith(expect.anything(),lot,20,2,station);
    expect(result).toMatchObject({passCount:20,remainingCount:0,lotStatus:ProductionLotStatus.DONE});
  });

  it('returns duplicate progress without inserting or finalizing',async()=>{
    const prior={lotId:'lot-1',stationId:station.id,testRunId:dto.testRunId,testProfileKey:dto.testProfileKey,testProfileVersion:dto.testProfileVersion,result:dto.result,testedAt:new Date(dto.testedAt),measurements:null,requestHash:null} as ProductionLotDeviceTest;
    const {service,manager,production}=setup(baseLot(),{prior,passCount:14,failCount:2});
    const result=await service.submitResult('lot-1',dto,station);
    expect(result).toMatchObject({accepted:true,duplicate:true,passCount:14});
    expect(manager.save).not.toHaveBeenCalled();
    expect(production.finalizeDeviceTestLot).not.toHaveBeenCalled();
  });

  it('rejects reusing a testRunId with a changed payload',async()=>{
    const prior={lotId:'lot-1',stationId:station.id,testRunId:dto.testRunId,testProfileKey:dto.testProfileKey,testProfileVersion:dto.testProfileVersion,result:DeviceTestResult.FAIL,testedAt:new Date(dto.testedAt),measurements:null,requestHash:null} as ProductionLotDeviceTest;
    const {service}=setup(baseLot(),{prior});
    await expect(service.submitResult('lot-1',dto,station)).rejects.toMatchObject({response:{code:'TEST_RUN_ID_CONFLICT'}});
  });

  it('releases and preserves Cloud progress for a later claim',async()=>{
    const lot=baseLot();const {service}=setup(lot,{passCount:13,failCount:2});
    const released=await service.release(lot.id,{releaseRequestId:'REL-001'},station);
    expect(lot).toMatchObject({status:ProductionLotStatus.WAITING_TEST,testStationId:null,deviceTestTargetPassCount:20});
    expect(released).toMatchObject({released:true,duplicate:false,lot:{passCount:13,failCount:2}});
    const claimed=await service.claim(lot.id,station);
    expect(claimed).toMatchObject({passCount:13,failCount:2,remainingCount:7});
  });

  it('ACKs a retried release without mutating a later claim',async()=>{
    const lot={...baseLot(),testStationId:'station-2'} as ProductionLot;
    const priorRelease={lotId:lot.id,stationId:station.id,releaseRequestId:'REL-001'} as DeviceTestLotRelease;
    const {service,manager}=setup(lot,{priorRelease,passCount:13});
    const result=await service.release(lot.id,{releaseRequestId:'REL-001'},station);
    expect(result).toMatchObject({released:true,duplicate:true});
    expect(lot.testStationId).toBe('station-2');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects a result after release instead of assigning it elsewhere',async()=>{
    const lot={...baseLot(),status:ProductionLotStatus.WAITING_TEST,testStationId:null} as ProductionLot;
    const {service,manager}=setup(lot);
    await expect(service.submitResult(lot.id,dto,station)).rejects.toMatchObject({response:{code:'LOT_NOT_READY'}});
    expect(manager.findOne).toHaveBeenCalledWith(ProductionLot,expect.objectContaining({lock:{mode:'pessimistic_write'}}));
  });

  it('serializes release on the same pessimistic lot lock used by results',async()=>{
    const {service,manager}=setup();
    await service.release('lot-1',{releaseRequestId:'REL-LOCK-001'},station);
    expect(manager.findOne).toHaveBeenCalledWith(ProductionLot,expect.objectContaining({lock:{mode:'pessimistic_write'}}));
  });

  it('rejects reusing a testRunId for another lot',async()=>{
    const prior={lotId:'lot-other',stationId:station.id,testRunId:dto.testRunId} as ProductionLotDeviceTest;
    const {service}=setup(baseLot(),{prior});
    await expect(service.submitResult('lot-1',dto,station)).rejects.toMatchObject({response:{code:'TEST_RUN_ID_CONFLICT'}});
  });
});

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { ProductionLot, ProductionLotStatus } from '../production/production-lot.entity';
import { ProductionLotEvent, ProductionLotEventType } from '../production/production-lot-event.entity';
import { ProductionService } from '../production/production.service';
import { ListDeviceTestLotsDto, ReleaseDeviceTestLotDto, SubmitDeviceTestResultDto } from './device-test.dto';
import { DeviceTestLotRelease } from './device-test-lot-release.entity';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { DeviceTestStation } from './device-test-station.entity';
import { DeviceTestResult, ProductionLotDeviceTest } from './production-lot-device-test.entity';

@Injectable()
export class DeviceTestService {
  constructor(
    private readonly dataSource:DataSource,
    @InjectRepository(ProductionLot) private readonly lots:Repository<ProductionLot>,
    private readonly production:ProductionService,
    private readonly realtime:RealtimeGateway,
  ){}

  async findLots(station:DeviceTestStation,query:ListDeviceTestLotsDto={}){
    const page=query.page??1;const limit=query.limit??16;
    const [lots,total]=await this.lots.findAndCount({
      where:[
        {status:ProductionLotStatus.WAITING_TEST,testProfileKey:Not(IsNull()),deletedAt:IsNull()},
        {status:ProductionLotStatus.TESTING,testProfileKey:Not(IsNull()),testStationId:station.id,deletedAt:IsNull()},
      ],
      order:{createdAt:'ASC'},skip:(page-1)*limit,take:limit,
    });
    return {apiVersion:1,serverTime:new Date().toISOString(),lots:await Promise.all(lots.map(lot=>this.snapshot(lot,station.id))),pagination:{page,limit,total,hasMore:page*limit<total}};
  }

  async findActiveLot(station:DeviceTestStation){
    const lot=await this.lots.findOne({where:{status:ProductionLotStatus.TESTING,testStationId:station.id,deletedAt:IsNull()},order:{deviceTestStartedAt:'ASC'}});
    return {apiVersion:1,serverTime:new Date().toISOString(),lot:lot?await this.snapshot(lot,station.id):null};
  }

  async claim(lotId:string,station:DeviceTestStation){
    const response=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id:lotId,deletedAt:IsNull()},lock:{mode:'pessimistic_write'}});
      if(!lot)throw new NotFoundException({code:'LOT_NOT_FOUND',message:'Lot was not found'});
      if(!lot.testProfileKey||!lot.testProfileVersion)throw new BadRequestException({code:'LOT_NOT_READY',message:'Lot has no device test profile'});
      if(lot.status===ProductionLotStatus.TESTING&&lot.testStationId===station.id)return this.snapshotWithManager(manager,lot,station.id);
      if(lot.status===ProductionLotStatus.TESTING)throw new ConflictException({code:'LOT_ALREADY_CLAIMED',message:'Lot is claimed by another station'});
      if(lot.status!==ProductionLotStatus.WAITING_TEST)throw new BadRequestException({code:'LOT_NOT_READY',message:'Lot is not waiting for test'});
      const other=await manager.findOneBy(ProductionLot,{status:ProductionLotStatus.TESTING,testStationId:station.id,deletedAt:IsNull()});
      if(other&&other.id!==lot.id)throw new ConflictException({code:'STATION_HAS_ACTIVE_LOT',message:'Station must finish or release its active lot first'});
      const target=Number(lot.deviceTestTargetPassCount??lot.producedQuantity??lot.targetQuantity);
      if(target<1)throw new BadRequestException({code:'LOT_NOT_READY',message:'Lot target pass count is invalid'});
      lot.status=ProductionLotStatus.TESTING;
      lot.testStationId=station.id;
      lot.deviceTestStartedAt=new Date();
      lot.deviceTestTargetPassCount=target;
      await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:lot.id,type:ProductionLotEventType.TEST_CLAIMED,actorId:lot.createdById,payload:{source:'DEVICE_TEST',stationId:station.id,stationCode:station.stationCode,targetPassCount:target}}));
      return this.snapshotWithManager(manager,lot,station.id);
    });
    this.realtime.emitInventory('production.updated',{lotId,source:'DEVICE_TEST_CLAIM'});
    return response;
  }

  async submitResult(lotId:string,dto:SubmitDeviceTestResultDto,station:DeviceTestStation){
    const response=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id:lotId,deletedAt:IsNull()},lock:{mode:'pessimistic_write'}});
      if(!lot)throw new NotFoundException({code:'LOT_NOT_FOUND',message:'Lot was not found'});
      const prior=await manager.findOneBy(ProductionLotDeviceTest,{stationId:station.id,testRunId:dto.testRunId});
      if(prior){
        if(prior.lotId!==lot.id||this.storedResultHash(prior)!==this.resultHash(dto))throw new ConflictException({code:'TEST_RUN_ID_CONFLICT',message:'testRunId was already used with a different lot or payload'});
        return this.resultResponse(manager,lot,true);
      }
      if(lot.status===ProductionLotStatus.DONE)throw new ConflictException({code:'LOT_ALREADY_DONE',message:'Lot is already done'});
      if(lot.status!==ProductionLotStatus.TESTING)throw new BadRequestException({code:'LOT_NOT_READY',message:'Lot is not being tested'});
      if(lot.testStationId!==station.id)throw new ConflictException({code:'LOT_NOT_CLAIMED_BY_STATION',message:'Lot is not claimed by this station'});
      if(dto.testProfileKey!==lot.testProfileKey)throw new BadRequestException({code:'PROFILE_MISMATCH',message:'Firmware test profile does not match this lot'});
      if(dto.testProfileVersion!==lot.testProfileVersion)throw new BadRequestException({code:'PROFILE_VERSION_MISMATCH',message:'Firmware test profile is not compatible with this lot'});
      await manager.save(manager.create(ProductionLotDeviceTest,{
        lotId:lot.id,stationId:station.id,testRunId:dto.testRunId,testProfileKey:dto.testProfileKey,
        testProfileVersion:dto.testProfileVersion,result:dto.result,measurements:dto.measurements??null,requestHash:this.resultHash(dto),testedAt:new Date(dto.testedAt),
      }));
      const passCount=await manager.countBy(ProductionLotDeviceTest,{lotId:lot.id,result:DeviceTestResult.PASS});
      const target=Number(lot.deviceTestTargetPassCount??lot.producedQuantity??lot.targetQuantity);
      if(passCount>=target){
        const failCount=await manager.countBy(ProductionLotDeviceTest,{lotId:lot.id,result:DeviceTestResult.FAIL});
        await this.production.finalizeDeviceTestLot(manager,lot,passCount,failCount,station);
      }
      return this.resultResponse(manager,lot,false);
    });
    this.realtime.emitInventory('production.updated',{lotId,source:'DEVICE_TEST_RESULT'});
    return response;
  }

  async release(lotId:string,dto:ReleaseDeviceTestLotDto,station:DeviceTestStation){
    const response=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id:lotId,deletedAt:IsNull()},lock:{mode:'pessimistic_write'}});
      if(!lot)throw new NotFoundException({code:'LOT_NOT_FOUND',message:'Lot was not found'});
      const prior=await manager.findOneBy(DeviceTestLotRelease,{stationId:station.id,releaseRequestId:dto.releaseRequestId});
      if(prior){
        if(prior.lotId!==lot.id)throw new ConflictException({code:'RELEASE_REQUEST_ID_CONFLICT',message:'releaseRequestId was already used for another lot'});
        return {released:true,duplicate:true,lot:await this.snapshotWithManager(manager,lot,station.id)};
      }
      if(lot.status===ProductionLotStatus.DONE)throw new ConflictException({code:'LOT_ALREADY_DONE',message:'Lot is already done'});
      if(lot.status!==ProductionLotStatus.TESTING||lot.testStationId!==station.id)throw new ConflictException({code:'LOT_NOT_CLAIMED_BY_STATION',message:'Lot is not claimed by this station'});
      await manager.save(manager.create(DeviceTestLotRelease,{lotId:lot.id,stationId:station.id,releaseRequestId:dto.releaseRequestId}));
      lot.status=ProductionLotStatus.WAITING_TEST;lot.testStationId=null;lot.deviceTestStartedAt=null;
      await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:lot.id,type:ProductionLotEventType.NOTE_UPDATED,actorId:lot.createdById,payload:{source:'DEVICE_TEST',action:'RELEASED',stationId:station.id,stationCode:station.stationCode,releaseRequestId:dto.releaseRequestId}}));
      return {released:true,duplicate:false,lot:await this.snapshotWithManager(manager,lot,station.id)};
    });
    this.realtime.emitInventory('production.updated',{lotId,source:'DEVICE_TEST_RELEASE'});
    return response;
  }

  private canonical(value:unknown):string{
    if(Array.isArray(value))return `[${value.map(item=>this.canonical(item)).join(',')}]`;
    if(value&&typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${this.canonical(item)}`).join(',')}}`;
    return JSON.stringify(value);
  }

  private resultHash(dto:SubmitDeviceTestResultDto){return createHash('sha256').update(this.canonical({...dto,measurements:dto.measurements??null,testedAt:new Date(dto.testedAt).toISOString()})).digest('hex');}
  private storedResultHash(row:ProductionLotDeviceTest){return row.requestHash??this.resultHash({testRunId:row.testRunId,testProfileKey:row.testProfileKey,testProfileVersion:row.testProfileVersion,result:row.result,testedAt:row.testedAt.toISOString(),measurements:row.measurements});}

  private async snapshot(lot:ProductionLot,stationId:string){return this.snapshotWithManager(this.dataSource.manager,lot,stationId);}

  private async snapshotWithManager(manager:EntityManager,lot:ProductionLot,stationId:string){
    const [passCount,failCount]=await Promise.all([
      manager.countBy(ProductionLotDeviceTest,{lotId:lot.id,result:DeviceTestResult.PASS}),
      manager.countBy(ProductionLotDeviceTest,{lotId:lot.id,result:DeviceTestResult.FAIL}),
    ]);
    const targetPassCount=Number(lot.deviceTestTargetPassCount??lot.producedQuantity??lot.targetQuantity);
    return {lotId:lot.id,lotCode:lot.code,outputId:lot.outputId,outputLabel:lot.outputLabel,testProfileKey:lot.testProfileKey,testProfileVersion:lot.testProfileVersion,targetPassCount,passCount,failCount,remainingCount:Math.max(0,targetPassCount-passCount),status:lot.status,claimedByThisStation:lot.testStationId===stationId};
  }

  private async resultResponse(manager:EntityManager,lot:ProductionLot,duplicate:boolean){
    const [passCount,failCount]=await Promise.all([
      manager.countBy(ProductionLotDeviceTest,{lotId:lot.id,result:DeviceTestResult.PASS}),
      manager.countBy(ProductionLotDeviceTest,{lotId:lot.id,result:DeviceTestResult.FAIL}),
    ]);
    const targetPassCount=Number(lot.deviceTestTargetPassCount??lot.producedQuantity??lot.targetQuantity);
    return {accepted:true,duplicate,passCount,failCount,targetPassCount,remainingCount:Math.max(0,targetPassCount-passCount),lotStatus:lot.status};
  }
}

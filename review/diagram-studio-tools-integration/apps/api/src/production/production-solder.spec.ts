import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {AuthUser} from '../auth/auth.types';
import {FinishedProduct,FinishedProductCategory} from '../inventory/finished-product.entity';
import {InventoryItem} from '../inventory/inventory-item.entity';
import {ProductBomItem} from '../inventory/product-bom-item.entity';
import {UserRole} from '../users/user.entity';
import {CreateProductionRunDto} from './production.dto';
import {ProductionOutputType} from './production-entry.entity';
import {ProductionLot,ProductionLotActionType,ProductionLotStatus} from './production-lot.entity';
import {ProductionLotEvent} from './production-lot-event.entity';
import {ProductionRun} from './production-run.entity';
import {ProductionService} from './production.service';

describe('Solder production Worklogs',()=>{
  const actor:AuthUser={id:'minh',username:'minhbk',displayName:'MINH BK',role:UserRole.MEMBER};
  const input={actionType:ProductionLotActionType.SOLDER,outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:'board',targetQuantity:20};
  function setup(overrides:Partial<FinishedProduct>={}){
    const board={id:'board',name:'Board KeyScan',category:FinishedProductCategory.PCB,isActive:true,isProductionOutput:false,productionReady:true,onHandQty:'3.000',...overrides};
    const manager={
      create:jest.fn((entity:Function,data:object)=>Object.assign(new (entity as any)(),{id:entity===ProductionRun?'run':'lot'},data)),
      save:jest.fn(async(value:any)=>value),
      findOneBy:jest.fn(async(_entity:Function,where:any)=>board.isActive&&where.id===board.id?board:null),
      findOne:jest.fn(),findBy:jest.fn(),exists:jest.fn().mockResolvedValue(true),findOneByOrFail:jest.fn(),
    };
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{dataSource:{transaction:async(callback:Function)=>callback(manager)},realtime:{emitInventory:jest.fn()},recordWorkedMinutes:jest.fn()});
    return {service,board,manager};
  }
  it('accepts SOLDER in the nested API DTO',async()=>{
    const dto=plainToInstance(CreateProductionRunDto,{lots:[{...input,outputId:'82de0f6a-47de-4833-9fe4-313986db2070'}]});
    expect(await validate(dto)).toEqual([]);
  });
  it('creates HM for an active PCB even when excluded from the legacy cable output list',async()=>{
    const {service,board,manager}=setup();
    const {lots}=await service.createRun({lots:[input]},actor);
    expect(lots[0]).toMatchObject({actionType:'SOLDER',outputId:'board',status:'NEW',targetQuantity:20});
    expect(lots[0].code).toMatch(/^HM-\d{8}-[A-F0-9]{6}$/);
    expect(manager.findOneBy).toHaveBeenCalledWith(FinishedProduct,{id:'board',isActive:true});
    expect(board.onHandQty).toBe('3.000');
    expect(manager.save.mock.calls.every(([value])=>value instanceof ProductionLot||value instanceof ProductionRun||value instanceof ProductionLotEvent)).toBe(true);
  });
  it.each([ProductionLotActionType.SOLDER,ProductionLotActionType.ASSEMBLE])('allows LocBK to create %s without Admin role',async actionType=>{
    const {service}=setup({isProductionOutput:true,category:actionType===ProductionLotActionType.SOLDER?FinishedProductCategory.PCB:FinishedProductCategory.CABLE});
    const loc:AuthUser={id:'loc',username:'LocBK',displayName:'LỘC BK',role:UserRole.MEMBER};
    const {lots}=await service.createRun({lots:[{...input,actionType}]},loc);
    expect(lots[0].actionType).toBe(actionType);
    expect(lots[0].code).toMatch(actionType===ProductionLotActionType.SOLDER?/^HM-/:/^SX-/);
  });
  it('does not grant production access to unrelated members',async()=>{
    const {service,manager}=setup();
    await expect(service.createRun({lots:[input]},{id:'other',username:'other',displayName:'OTHER',role:UserRole.MEMBER})).rejects.toThrow('Chỉ đội Sản xuất');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it.each([ProductionLotActionType.ASSEMBLE,ProductionLotActionType.PACK,ProductionLotActionType.TEST])('keeps SX for %s',async actionType=>{
    const {service}=setup({isProductionOutput:true});
    const outputType=actionType==='PACK'?ProductionOutputType.SELLABLE_PRODUCT:ProductionOutputType.FINISHED_PRODUCT;
    const {lots}=await service.createRun({lots:[{...input,actionType,outputType}]},actor);
    expect(lots[0].code).toMatch(/^SX-/);
  });
  it.each([FinishedProductCategory.CABLE,FinishedProductCategory.DEVICE,FinishedProductCategory.OTHER])('rejects non-PCB %s',async category=>{
    const {service}=setup({category});
    await expect(service.createRun({lots:[input]},actor)).rejects.toThrow('Hàn mạch phải chọn board');
  });
  it('rejects sellable, inactive and unready outputs',async()=>{
    await expect(setup().service.createRun({lots:[{...input,outputType:ProductionOutputType.SELLABLE_PRODUCT}]},actor)).rejects.toThrow('Thành phẩm');
    await expect(setup({isActive:false}).service.createRun({lots:[input]},actor)).rejects.toThrow('không hợp lệ');
    await expect(setup({productionReady:false}).service.createRun({lots:[input]},actor)).rejects.toThrow('chưa đủ cấu hình');
  });
  it('does not relax the legacy ASSEMBLE output gate',async()=>{
    await expect(setup().service.createRun({lots:[{...input,actionType:ProductionLotActionType.ASSEMBLE}]},actor)).rejects.toThrow('không phải đầu ra');
  });
  it('finishes soldering into WAITING_TEST without stock writes and blocks direct DONE',async()=>{
    const {service,board,manager}=setup();
    const lot={id:'lot',...input,code:'HM-EXISTING',status:ProductionLotStatus.IN_PROGRESS} as ProductionLot;
    manager.findOne.mockResolvedValue(lot);
    await service.finishProduction(lot.id,{quantity:20},actor);
    expect(lot).toMatchObject({status:'WAITING_TEST',code:'HM-EXISTING',producedQuantity:20});
    expect(board.onHandQty).toBe('3.000');
    expect(manager.findBy).not.toHaveBeenCalled();
    await expect(service.updateLot(lot.id,{status:ProductionLotStatus.DONE},actor)).rejects.toThrow('kết quả Test');
    await expect(service.completeTest(lot.id,{testedQuantity:20,passedQuantity:20,failedQuantity:0},actor)).rejects.toThrow('chưa được nhận Test');
  });
  it('adds only PASS boards and deducts their BOM on Test completion; never double-posts',async()=>{
    const {service,board,manager}=setup();
    const lot={id:'lot',...input,code:'HM-EXISTING',status:ProductionLotStatus.WAITING_TEST,producedQuantity:20,testProfileKey:null} as ProductionLot;
    const material={id:'pcb',name:'PCB trần',isActive:true,onHandQty:'50.000',unit:'unit'};
    manager.findOne.mockImplementation(async(entity:Function)=>entity===ProductionLot?lot:entity===FinishedProduct?board:entity===InventoryItem?material:null);
    manager.findBy.mockImplementation(async(entity:Function)=>entity===ProductBomItem?[{itemId:material.id,quantityPerProduct:'1.000'}]:[]);
    manager.findOneByOrFail.mockImplementation(async(entity:Function)=>entity===FinishedProduct?board:material);
    await service.claimTest(lot.id,actor);
    expect(board.onHandQty).toBe('3.000');
    await service.completeTest(lot.id,{testedQuantity:20,passedQuantity:18,failedQuantity:2},actor);
    expect(lot).toMatchObject({status:'DONE',completedQuantity:18,failedQuantity:2,code:'HM-EXISTING'});
    expect(board.onHandQty).toBe('21.000');expect(material.onHandQty).toBe('32.000');
    await expect(service.completeTest(lot.id,{testedQuantity:20,passedQuantity:18,failedQuantity:2},actor)).rejects.toThrow();
    expect(board.onHandQty).toBe('21.000');
  });
  it('keeps the missing-BOM guard for solder boards',async()=>{
    const {service,manager,board}=setup();
    manager.findOne.mockResolvedValue(board);manager.findBy.mockResolvedValue([]);
    await expect((service as any).buildLotImpact(manager,{...input},20,false)).rejects.toThrow('chưa có Cấu thành');
  });
});

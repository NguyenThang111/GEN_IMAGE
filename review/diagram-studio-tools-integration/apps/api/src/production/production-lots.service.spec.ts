import { BadRequestException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { FinishedProduct } from '../inventory/finished-product.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { ProductBomItem } from '../inventory/product-bom-item.entity';
import { FinishedProductComponentItem } from '../inventory/finished-product-component-item.entity';
import { SellableProduct } from '../inventory/sellable-product.entity';
import { SellableProductBomItem } from '../inventory/sellable-product-bom-item.entity';
import { SellableProductMaterialItem } from '../inventory/sellable-product-material-item.entity';
import { UserRole } from '../users/user.entity';
import { ProductionEntry, ProductionOutputType } from './production-entry.entity';
import { ProductionEntryLot } from './production-entry-lot.entity';
import { ProductionLot, ProductionLotActionType, ProductionLotStatus } from './production-lot.entity';
import { ProductionLotAssignee } from './production-lot-assignee.entity';
import { ProductionLotEvent, ProductionLotEventType } from './production-lot-event.entity';
import { ProductionService } from './production.service';

describe('Production Lot inventory sync',()=>{
  const admin:AuthUser={id:'admin',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
  const giang:AuthUser={id:'giang',username:'giang',displayName:'GIANG',role:UserRole.MEMBER};
  const nam:AuthUser={id:'nam',username:'nam',displayName:'NAM',role:UserRole.MEMBER};
  const my:AuthUser={id:'my',username:'my',displayName:'MỸ',role:UserRole.MEMBER};
  const quang:AuthUser={id:'quang',username:'quangbk',displayName:'QUANG BK',role:UserRole.MEMBER};
  const thanh:AuthUser={id:'thanh',username:'thanhbk',displayName:'THANH BK',role:UserRole.MEMBER};
  const phong:AuthUser={id:'phong',username:'phongbk',displayName:'PHONG BK',role:UserRole.MEMBER};
  const minh:AuthUser={id:'minh',username:'minhbk',displayName:'MINH BK',role:UserRole.MEMBER};
  const dev:AuthUser={id:'phu',username:'phu',displayName:'PHÚ',role:UserRole.MEMBER};
  const service=Object.create(ProductionService.prototype) as ProductionService;

  it('allows Admin to DONE any Lot without an Incharge lookup',async()=>{
    const manager={findBy:jest.fn(),exists:jest.fn()};
    await expect((service as any).assertCanCompleteLot(manager,'lot-1',admin)).resolves.toBeUndefined();
    expect(manager.exists).not.toHaveBeenCalled();
  });

  it.each([giang,my,nam,quang,thanh,phong,minh])('allows an Incharge production member to DONE a Lot',async actor=>{
    const manager={exists:jest.fn().mockResolvedValue(true)};
    await expect((service as any).assertCanCompleteLot(manager,'lot-1',actor)).resolves.toBeUndefined();
    expect(manager.exists).toHaveBeenCalledWith(ProductionLotAssignee,{where:{lotId:'lot-1',userId:actor.id}});
  });

  it('rejects an unlinked production member and a non-production member',async()=>{
    const manager={exists:jest.fn().mockResolvedValue(false)};
    await expect((service as any).assertCanCompleteLot(manager,'lot-1',nam)).rejects.toThrow('Chỉ thành viên đang Incharge Lô này được DONE');
    await expect((service as any).assertCanCompleteLot(manager,'lot-1',dev)).rejects.toThrow('Chỉ đội Sản xuất và Admin được DONE Lô');
  });

  it('lets a production member claim a NEW Lot directly',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.NEW} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),findBy:jest.fn().mockResolvedValue([]),exists:jest.fn().mockResolvedValue(false),save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await isolated.claimLot(lot.id,giang);
    expect(manager.create).toHaveBeenCalledWith(ProductionLotAssignee,{lotId:lot.id,userId:giang.id});
    expect(manager.create).toHaveBeenCalledWith(ProductionLotEvent,expect.objectContaining({lotId:lot.id,type:ProductionLotEventType.CLAIMED,actorId:giang.id}));
    expect(lot.status).toBe(ProductionLotStatus.IN_PROGRESS);
  });

  it('keeps the existing participants when another production member joins',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.IN_PROGRESS} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),exists:jest.fn().mockResolvedValue(false),save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value),delete:jest.fn()};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await isolated.claimLot(lot.id,thanh);
    expect(manager.create).toHaveBeenCalledWith(ProductionLotAssignee,{lotId:lot.id,userId:thanh.id});
    expect(manager.delete).not.toHaveBeenCalled();
    expect(lot.status).toBe(ProductionLotStatus.IN_PROGRESS);
  });

  it('recognizes THANH BK as a production operator who can create Worklogs',()=>{
    expect((service as any).isProductionOperator(thanh)).toBe(true);
  });

  it('does not infer Chờ Test when produced quantity reaches the target',async()=>{
    const lot={id:'lot-1',targetQuantity:40,producedQuantity:0,note:null,status:ProductionLotStatus.IN_PROGRESS} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),exists:jest.fn().mockResolvedValue(true),save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await isolated.updateLot(lot.id,{producedQuantity:40},giang);
    expect(lot).toMatchObject({producedQuantity:40,targetQuantity:40,status:ProductionLotStatus.IN_PROGRESS});
    expect(manager.create).not.toHaveBeenCalledWith(ProductionLotEvent,expect.objectContaining({type:ProductionLotEventType.PRODUCTION_FINISHED}));
  });

  it('moves to Chờ Test only after an explicit status update',async()=>{
    const lot={id:'lot-1',targetQuantity:40,producedQuantity:40,note:null,status:ProductionLotStatus.IN_PROGRESS,activeById:null,activeStartedAt:null} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),exists:jest.fn().mockResolvedValue(true),save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await isolated.updateLot(lot.id,{status:ProductionLotStatus.WAITING_TEST},giang);
    expect(lot.status).toBe(ProductionLotStatus.WAITING_TEST);
    expect(manager.create).toHaveBeenCalledWith(ProductionLotEvent,expect.objectContaining({type:ProductionLotEventType.PRODUCTION_FINISHED,payload:expect.objectContaining({source:'STATUS_DROPDOWN'})}));
  });

  it.each([null,'CABLE_ECM_YAMAHA'])('rejects Cloud publish even for old clients (profile=%s)',async testProfileKey=>{
    const transaction=jest.fn();
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction}});
    await expect(isolated.publishDeviceTest('lot-1',admin)).rejects.toMatchObject({status:410,response:{code:'DEVICE_TEST_RETIRED'}});
    expect(transaction).not.toHaveBeenCalled();
  });

  it('requires migration before manually claiming an old Cloud lot',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.WAITING_TEST,testProfileKey:'CABLE_ECM_YAMAHA'} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))}});
    await expect(isolated.claimTest(lot.id,giang)).rejects.toThrow('migration');
  });

  it('allows only an Incharge member or Admin to confirm TEST',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.IN_PROGRESS,testedAt:null,testedById:null} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),exists:jest.fn().mockResolvedValue(false),save:jest.fn(),create:jest.fn()};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await expect(isolated.testLot(lot.id,nam)).rejects.toThrow('Chỉ thành viên đang Incharge Lô này được xác nhận TEST');
    expect(lot.testedAt).toBeNull();
  });

  it('blocks DONE before the Lot is confirmed as tested',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.IN_PROGRESS,testedAt:null} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await expect(isolated.completeLot(lot.id,{quantity:1},admin)).rejects.toThrow('Lô cần xác nhận ĐÃ TEST trước khi DONE');
  });

  it('calculates Finished Product output and material deductions, including negative-stock warning',async()=>{
    const output={id:'finished-1',name:'Cáp Honda 4P',onHandQty:'10.000',productionReady:true,isActive:true};
    const material={id:'material-1',name:'JACK Honda 4P',onHandQty:'20.000',unit:'unit',isActive:true};
    const manager={
      findOne:jest.fn(async(entity:Function,input:{where:{id:string}})=>entity===FinishedProduct&&input.where.id===output.id?output:entity===InventoryItem&&input.where.id===material.id?material:null),
      findBy:jest.fn(async(entity:Function)=>entity===ProductBomItem?[{productId:output.id,itemId:material.id,quantityPerProduct:'1.000'}]:[]),
    };
    const lot={outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:output.id} as ProductionLot;
    const impact=await (service as any).buildLotImpact(manager,lot,50,false);
    expect(impact.output).toMatchObject({label:'Cáp Honda 4P',change:50,before:10,after:60});
    expect(impact.components[0]).toMatchObject({label:'JACK Honda 4P',change:-50,before:20,after:-30});
    expect(impact.warnings).toEqual(['JACK Honda 4P: thiếu 30 unit']);
  });

  it('records a Finished Product test Lot without changing inventory',async()=>{
    const manager={findOne:jest.fn(),findBy:jest.fn()};
    const lot={actionType:ProductionLotActionType.TEST,outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:'device-1',outputLabel:'Device ScanBox hoàn thiện'} as ProductionLot;
    const impact=await (service as any).buildLotImpact(manager,lot,5,false);
    expect(impact).toEqual({inventoryChanged:false,output:{kind:'FINISHED_PRODUCT',id:'device-1',label:'Device ScanBox hoàn thiện',before:0,change:0,after:0},components:[],warnings:[]});
    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.findBy).not.toHaveBeenCalled();
  });

  it('DONEs a test Lot without applying an inventory transaction',async()=>{
    const lot={id:'test-lot-1',code:'SX-TEST',actionType:ProductionLotActionType.TEST,outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:'device-1',outputLabel:'Device ScanBox hoàn thiện',status:ProductionLotStatus.NEW,testedAt:new Date(),completedQuantity:null,completedById:null,completedAt:null} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    const applyImpact=jest.spyOn(isolated as any,'applyLotImpact');
    const result=await isolated.completeLot(lot.id,{quantity:5},admin);
    expect(result.impact.inventoryChanged).toBe(false);
    expect(applyImpact).not.toHaveBeenCalled();
    expect(lot).toMatchObject({status:ProductionLotStatus.DONE,completedQuantity:5,completedById:admin.id});
  });

  it('deducts a ready Board and assembly materials when Device is DONE',async()=>{
    const output={id:'device-1',name:'Device ScanBox hoàn thiện',onHandQty:'0.000',productionReady:true,isActive:true};
    const board={id:'board-1',name:'Board mạch ScanBox',onHandQty:'8.000',isActive:true};
    const housing={id:'material-1',name:'Hộp đen',onHandQty:'10.000',unit:'unit',isActive:true};
    const manager={
      findOne:jest.fn(async(entity:Function,input:{where:{id:string}})=>entity===FinishedProduct&&input.where.id===output.id?output:entity===FinishedProduct&&input.where.id===board.id?board:entity===InventoryItem&&input.where.id===housing.id?housing:null),
      findBy:jest.fn(async(entity:Function)=>entity===ProductBomItem?[{productId:output.id,itemId:housing.id,quantityPerProduct:'1.000'}]:entity===FinishedProductComponentItem?[{productId:output.id,componentProductId:board.id,quantityPerProduct:'1.000'}]:[]),
    };
    const impact=await (service as any).buildLotImpact(manager,{outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:output.id} as ProductionLot,5,false);
    expect(impact.output).toMatchObject({label:'Device ScanBox hoàn thiện',change:5,after:5});
    expect(impact.components).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'MATERIAL',label:'Hộp đen',change:-5,after:5}),
      expect.objectContaining({kind:'FINISHED_PRODUCT',label:'Board mạch ScanBox',change:-5,after:3}),
    ]));
  });

  it('calculates Sellable Product output, Finished Product and direct packing material deductions',async()=>{
    const output={id:'sellable-1',name:'Máy EasyScan',onHandQty:'2.000',isActive:true};
    const component={id:'finished-1',name:'Board EasyScan',onHandQty:'40.000',isActive:true};
    const suitcase={id:'material-1',name:'Vali nhỏ',onHandQty:'35.000',unit:'unit',isActive:true};
    const manager={
      findOne:jest.fn(async(entity:Function,input:{where:{id:string}})=>entity===SellableProduct&&input.where.id===output.id?output:entity===FinishedProduct&&input.where.id===component.id?component:entity===InventoryItem&&input.where.id===suitcase.id?suitcase:null),
      findBy:jest.fn(async(entity:Function)=>entity===SellableProductBomItem?[{productId:output.id,finishedProductId:component.id,quantityPerProduct:'1.000'}]:entity===SellableProductMaterialItem?[{productId:output.id,itemId:suitcase.id,quantityPerProduct:'1.000'}]:[]),
    };
    const lot={outputType:ProductionOutputType.SELLABLE_PRODUCT,outputId:output.id} as ProductionLot;
    const impact=await (service as any).buildLotImpact(manager,lot,30,false);
    expect(impact.output).toMatchObject({label:'Máy EasyScan',change:30,before:2,after:32});
    expect(impact.components).toEqual(expect.arrayContaining([
      expect.objectContaining({label:'Board EasyScan',change:-30,before:40,after:10}),
      expect.objectContaining({label:'Vali nhỏ',change:-30,before:35,after:5}),
    ]));
    expect(impact.warnings).toEqual([]);
  });

  it('blocks DONE when the output has no configured structure',async()=>{
    const manager={findOne:jest.fn().mockResolvedValue({id:'finished-1',name:'Cáp',onHandQty:'0',productionReady:true,isActive:true}),findBy:jest.fn().mockResolvedValue([])};
    const lot={outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:'finished-1'} as ProductionLot;
    await expect((service as any).buildLotImpact(manager,lot,10,false)).rejects.toThrow('Thành phẩm chưa có Cấu thành');
  });

  it('rejects a second DONE before any inventory mutation',async()=>{
    const manager={findOne:jest.fn().mockResolvedValue({id:'lot-1',status:ProductionLotStatus.DONE})};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    await expect(isolated.completeLot('lot-1',{quantity:50},admin)).rejects.toThrow('không thể nhập kho lần hai');
  });

  it('allows only Admin to Undo',async()=>{
    await expect(service.undoLot('lot-1',giang)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds the stock reversal from current balances',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.DONE} as ProductionLot;
    const done={payload:{impact:{output:{kind:'FINISHED_PRODUCT',id:'finished-1',label:'Device ScanBox',before:0,change:3,after:3},components:[{kind:'MATERIAL',id:'material-1',label:'Hộp đen',before:10,change:-6,after:4}],warnings:[]}}};
    const manager={findOne:jest.fn(async(entity:Function,input:{where:{id?:string;type?:ProductionLotEventType}})=>entity===ProductionLotEvent?done:entity===FinishedProduct?{id:'finished-1',onHandQty:'5.000'}:entity===InventoryItem?{id:'material-1',onHandQty:'2.000'}:null)};
    const impact=await (service as any).buildReverseLotImpact(manager,lot,false);
    expect(impact.output).toMatchObject({change:-3,before:5,after:2});
    expect(impact.components[0]).toMatchObject({change:6,before:2,after:8});
  });

  it('blocks stock reversal when completed output was already consumed',async()=>{
    const lot={id:'lot-1',status:ProductionLotStatus.DONE} as ProductionLot;
    const done={payload:{impact:{output:{kind:'SELLABLE_PRODUCT',id:'sellable-1',label:'Máy ScanBox',before:0,change:5,after:5},components:[],warnings:[]}}};
    const manager={findOne:jest.fn(async(entity:Function)=>entity===ProductionLotEvent?done:entity===SellableProduct?{id:'sellable-1',onHandQty:'2.000'}:null)};
    await expect((service as any).buildReverseLotImpact(manager,lot,false)).rejects.toThrow('Tồn sản phẩm không đủ để đảo Kho');
  });

  it('allows only Admin to delete a Lot',async()=>{
    await expect(service.deleteLot('lot-1',giang)).rejects.toThrow('Chỉ Admin được xoá Đợt');
  });

  it('soft-deletes an active Lot without changing stock or reports',async()=>{
    const lot={id:'lot-1',code:'SX-1',outputLabel:'Cáp Honda',status:ProductionLotStatus.IN_PROGRESS,deletedAt:null,deletedById:null} as ProductionLot;
    const manager={findOne:jest.fn().mockResolvedValue(lot),countBy:jest.fn().mockResolvedValue(2),save:jest.fn(async(value:unknown)=>value),create:jest.fn((_entity:Function,value:unknown)=>value)};
    const isolated=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(isolated,{dataSource:{transaction:jest.fn(async(callback:(value:unknown)=>unknown)=>callback(manager))},realtime:{emitInventory:jest.fn()}});
    const result=await isolated.deleteLot('lot-1',admin);
    expect(result.stockImpact).toBeNull();
    expect(lot.deletedById).toBe(admin.id);
    expect(lot.deletedAt).toBeInstanceOf(Date);
    expect(manager.countBy).toHaveBeenCalled();
    expect(manager.save).toHaveBeenCalledTimes(2);
  });
});

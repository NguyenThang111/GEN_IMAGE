import { ProductionService } from './production.service';
import { ProductionLot, ProductionLotStatus } from './production-lot.entity';
import { ProductionOutputType } from './production-entry.entity';
import { ProductionLotEvent, ProductionLotEventType } from './production-lot-event.entity';
import { FinishedProduct } from '../inventory/finished-product.entity';
import { SellableProduct } from '../inventory/sellable-product.entity';
import { SellableProductBomItem } from '../inventory/sellable-product-bom-item.entity';
import { UserRole } from '../users/user.entity';

describe('Test with an inactive configured finished product',()=>{
  const actor={id:'admin',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
  function setup(missing=false){
    const lot={id:'lot',code:'SX-14',outputType:ProductionOutputType.SELLABLE_PRODUCT,outputId:'easyscan',outputLabel:'Máy đọc lỗi Easyscan',status:ProductionLotStatus.TESTING,producedQuantity:14,testClaimedById:actor.id,testClaimedAt:new Date(),testProfileKey:null} as ProductionLot;
    const output={id:'easyscan',name:lot.outputLabel,isActive:true,onHandQty:'2.000'};
    const component={id:'component',name:'Thành phẩm đã ngừng hoạt động',isActive:false,onHandQty:'50.000'};
    const resolve=(entity:Function)=>entity===ProductionLot?lot:entity===SellableProduct?output:entity===FinishedProduct&&!missing?component:null;
    const manager={
      findOne:jest.fn(async(entity:Function)=>resolve(entity)),
      findOneByOrFail:jest.fn(async(entity:Function)=>resolve(entity)),
      findBy:jest.fn(async(entity:Function)=>entity===SellableProductBomItem?[{finishedProductId:component.id,quantityPerProduct:'2.000'}]:[]),
      save:jest.fn(async(value:unknown)=>value),
      create:jest.fn((_entity:Function,value:unknown)=>value),
    };
    const service=Object.create(ProductionService.prototype) as ProductionService;
    Object.assign(service,{dataSource:{transaction:async(callback:Function)=>callback(manager)},realtime:{emitInventory:jest.fn()},recordWorkedMinutes:jest.fn()});
    return {service,manager,lot,output,component};
  }
  it('previews the configured deduction even if the referenced product is inactive',async()=>{
    const {service,manager,lot}=setup();
    const impact=await (service as any).buildLotImpact(manager,lot,14);
    expect(impact.components).toEqual([expect.objectContaining({id:'component',before:50,change:-28,after:22})]);
    expect(impact.output).toMatchObject({before:2,change:14,after:16});
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('saves Test with real inventory calculations and does not duplicate stock on retry',async()=>{
    const {service,manager,lot,output,component}=setup();
    const dto={testedQuantity:14,passedQuantity:14,failedQuantity:0};
    await service.completeTest(lot.id,dto,actor);
    expect(output.onHandQty).toBe('16.000');
    expect(component.onHandQty).toBe('22.000');
    expect(component.isActive).toBe(false);
    expect(lot.status).toBe(ProductionLotStatus.DONE);
    expect(manager.create).toHaveBeenCalledWith(ProductionLotEvent,expect.objectContaining({type:ProductionLotEventType.TESTED,payload:expect.objectContaining({passedQuantity:14,impact:expect.objectContaining({components:[expect.objectContaining({id:'component',change:-28})]})})}));
    const saves=manager.save.mock.calls.length;
    await expect(service.completeTest(lot.id,dto,actor)).rejects.toThrow('chưa được nhận Test');
    expect(manager.save).toHaveBeenCalledTimes(saves);
  });
  it('does not create stock when the component record is missing entirely',async()=>{
    const {service,manager,lot}=setup(true);
    await expect(service.completeTest(lot.id,{testedQuantity:14,passedQuantity:14,failedQuantity:0},actor)).rejects.toThrow('Không tìm thấy thành phẩm cấu hình: component');
    expect(manager.save).not.toHaveBeenCalled();
    expect(lot.status).toBe(ProductionLotStatus.TESTING);
  });
});

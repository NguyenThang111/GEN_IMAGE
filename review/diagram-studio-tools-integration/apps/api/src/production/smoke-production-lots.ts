import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { DataSource, Like } from 'typeorm';
import { AppModule } from '../app.module';
import { InventoryItem, InventoryBomKind } from '../inventory/inventory-item.entity';
import { InventoryTransaction } from '../inventory/inventory-transaction.entity';
import { FinishedProduct } from '../inventory/finished-product.entity';
import { FinishedProductTransaction } from '../inventory/finished-product-transaction.entity';
import { ProductBomItem } from '../inventory/product-bom-item.entity';
import { FinishedProductComponentItem } from '../inventory/finished-product-component-item.entity';
import { SellableProduct } from '../inventory/sellable-product.entity';
import { SellableProductBomItem } from '../inventory/sellable-product-bom-item.entity';
import { SellableProductMaterialItem } from '../inventory/sellable-product-material-item.entity';
import { SellableProductTransaction } from '../inventory/sellable-product-transaction.entity';
import { SystemNotification } from '../notifications/system-notification.entity';
import { User, UserRole } from '../users/user.entity';
import { ProductionEntry, ProductionModule, ProductionOutputType } from './production-entry.entity';
import { ProductionEntryLot } from './production-entry-lot.entity';
import { ProductionLot, ProductionLotActionType } from './production-lot.entity';
import { ProductionLotEvent } from './production-lot-event.entity';
import { ProductionRun } from './production-run.entity';
import { ProductionService } from './production.service';

async function smoke(){
  const app=await NestFactory.createApplicationContext(AppModule,{logger:false});
  const dataSource=app.get(DataSource);const production=app.get(ProductionService);const suffix=randomUUID().slice(0,8);
  let material:InventoryItem|undefined;let packing:InventoryItem|undefined;let board:FinishedProduct|undefined;let finished:FinishedProduct|undefined;let sellable:SellableProduct|undefined;let runId:string|undefined;let lotIds:string[]=[];let entryId:string|undefined;
  try{
    const admin=await dataSource.getRepository(User).findOneBy({role:UserRole.ADMIN,isActive:true});
    const giang=await dataSource.getRepository(User).findOneBy({username:'giang',isActive:true});
    if(!admin||!giang)throw new Error('Smoke requires active Admin and GIANG users');
    material=await dataSource.getRepository(InventoryItem).save(dataSource.getRepository(InventoryItem).create({name:`SMOKE Material ${suffix}`,groupName:'SMOKE',sku:`SMOKE-M-${suffix}`,unit:'unit',onHandQty:'0.000',bomKind:InventoryBomKind.OTHER,purchaseLinks:[],minimumStock:'0.000',isActive:true}));
    packing=await dataSource.getRepository(InventoryItem).save(dataSource.getRepository(InventoryItem).create({name:`SMOKE Packing ${suffix}`,groupName:'SMOKE',sku:`SMOKE-P-${suffix}`,unit:'unit',onHandQty:'5.000',bomKind:InventoryBomKind.OTHER,purchaseLinks:[],minimumStock:'0.000',isActive:true}));
    board=await dataSource.getRepository(FinishedProduct).save(dataSource.getRepository(FinishedProduct).create({sku:`SMOKE-B-${suffix}`,name:`SMOKE Board ${suffix}`,onHandQty:'5.000',minimumStock:'0.000',location:null,note:null,isProductionOutput:false,productionReady:true,isActive:true}));
    finished=await dataSource.getRepository(FinishedProduct).save(dataSource.getRepository(FinishedProduct).create({sku:`SMOKE-F-${suffix}`,name:`SMOKE Device ${suffix}`,onHandQty:'0.000',minimumStock:'0.000',location:null,note:null,isProductionOutput:true,productionReady:true,isActive:true}));
    await dataSource.getRepository(ProductBomItem).save(dataSource.getRepository(ProductBomItem).create({productId:finished.id,itemId:material.id,quantityPerProduct:'2.000'}));
    await dataSource.getRepository(FinishedProductComponentItem).save(dataSource.getRepository(FinishedProductComponentItem).create({productId:finished.id,componentProductId:board.id,quantityPerProduct:'1.000'}));
    sellable=await dataSource.getRepository(SellableProduct).save(dataSource.getRepository(SellableProduct).create({name:`SMOKE Sellable ${suffix}`,onHandQty:'0.000',minimumStock:'0.000',note:null,isActive:true}));
    await dataSource.getRepository(SellableProductBomItem).save(dataSource.getRepository(SellableProductBomItem).create({productId:sellable.id,finishedProductId:finished.id,quantityPerProduct:'1.000'}));
    await dataSource.getRepository(SellableProductMaterialItem).save(dataSource.getRepository(SellableProductMaterialItem).create({productId:sellable.id,itemId:packing.id,quantityPerProduct:'1.000'}));
    const created=await production.createRun({lots:[{actionType:ProductionLotActionType.ASSEMBLE,outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:finished.id,targetQuantity:3},{actionType:ProductionLotActionType.PACK,outputType:ProductionOutputType.SELLABLE_PRODUCT,outputId:sellable.id,targetQuantity:2}]},admin);
    runId=created.run.id;lotIds=created.lots.map(lot=>lot.id);
    const entry=await production.createEntry({userId:giang.id,workDate:'2099-12-31',module:ProductionModule.SUPPORT,workType:'Báo cáo tự do',outputType:ProductionOutputType.LABEL,outputLabel:'Việc đã làm',rawText:'SMOKE Production Lot',lotIds},giang);entryId=entry.id;
    const active=await production.findLots(false);const linked=active.filter(lot=>lotIds.includes(lot.id));if(linked.length!==2||linked.some(lot=>lot.participants.length!==1||lot.participants[0].username!=='giang'))throw new Error('Report did not mark GIANG incharge on both Lots');
    const finishedResult=await production.completeLot(lotIds[0],{quantity:3},giang);if(finishedResult.impact.output.after!==3||finishedResult.impact.components.find(line=>line.kind==='MATERIAL')?.after!==-6||finishedResult.impact.components.find(line=>line.id===board!.id)?.after!==2||finishedResult.impact.warnings.length!==1)throw new Error('Finished Product impact mismatch');
    let duplicateBlocked=false;try{await production.completeLot(lotIds[0],{quantity:3},admin);}catch{duplicateBlocked=true;}if(!duplicateBlocked)throw new Error('Duplicate DONE was not blocked');
    const sellableResult=await production.completeLot(lotIds[1],{quantity:2},admin);if(sellableResult.impact.output.after!==2||!sellableResult.impact.components.some(line=>line.id===finished!.id&&line.after===1)||!sellableResult.impact.components.some(line=>line.id===packing!.id&&line.after===3))throw new Error('Sellable Product impact mismatch');
    const deletePreview=await production.previewDeleteLot(lotIds[1],admin);if(deletePreview.linkedReportCount!==1||deletePreview.stockImpact?.output.change!==-2)throw new Error('Delete preview did not include report and stock reversal');
    await production.deleteLot(lotIds[1],admin);const afterDelete=await production.findLots(true);if(afterDelete.some(lot=>lot.id===lotIds[1]))throw new Error('Soft-deleted Lot is still visible');
    if(!await dataSource.getRepository(ProductionEntryLot).exist({where:{entryId:entry.id,lotId:lotIds[1]}}))throw new Error('Delete removed the linked daily report');
    await production.undoLot(lotIds[0],admin);
    material=await dataSource.getRepository(InventoryItem).findOneByOrFail({id:material.id});packing=await dataSource.getRepository(InventoryItem).findOneByOrFail({id:packing.id});board=await dataSource.getRepository(FinishedProduct).findOneByOrFail({id:board.id});finished=await dataSource.getRepository(FinishedProduct).findOneByOrFail({id:finished.id});sellable=await dataSource.getRepository(SellableProduct).findOneByOrFail({id:sellable.id});
    if(Number(material.onHandQty)!==0||Number(packing.onHandQty)!==5||Number(board.onHandQty)!==5||Number(finished.onHandQty)!==0||Number(sellable.onHandQty)!==0)throw new Error('Undo did not restore all balances');
    process.stdout.write('Production Lot smoke PASS: inventory sync, report link, permission, Undo, Admin soft-delete and stock reversal\n');
  }finally{
    await dataSource.transaction(async manager=>{
      for(const lotId of lotIds){await manager.delete(InventoryTransaction,{reference:Like(`production-lot:${lotId}:%`)});await manager.delete(FinishedProductTransaction,{reference:Like(`production-lot:${lotId}:%`)});await manager.delete(SellableProductTransaction,{reference:Like(`production-lot:${lotId}:%`)});}
      if(entryId){await manager.delete(SystemNotification,{entityId:entryId});await manager.delete(ProductionEntryLot,{entryId});await manager.delete(ProductionEntry,{id:entryId});}
      for(const id of lotIds){await manager.delete(ProductionLotEvent,{lotId:id});await manager.delete(ProductionEntryLot,{lotId:id});await manager.delete(ProductionLot,{id});}
      if(runId)await manager.delete(ProductionRun,{id:runId});
      if(sellable){await manager.delete(SellableProductMaterialItem,{productId:sellable.id});await manager.delete(SellableProductBomItem,{productId:sellable.id});await manager.delete(SellableProduct,{id:sellable.id});}
      if(finished){await manager.delete(ProductBomItem,{productId:finished.id});await manager.delete(FinishedProductComponentItem,{productId:finished.id});await manager.delete(FinishedProduct,{id:finished.id});}
      if(board)await manager.delete(FinishedProduct,{id:board.id});
      if(material)await manager.delete(InventoryItem,{id:material.id});
      if(packing)await manager.delete(InventoryItem,{id:packing.id});
    });
    await app.close();
  }
}

void smoke();

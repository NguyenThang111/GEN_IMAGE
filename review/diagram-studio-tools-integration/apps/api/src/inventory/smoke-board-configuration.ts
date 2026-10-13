import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { BOARD_DEFINITIONS } from './board-bom.config';
import { FinishedProduct, FinishedProductCategory } from './finished-product.entity';
import { InventoryItem } from './inventory-item.entity';
import { InventoryService } from './inventory.service';
import {
  EASYSCAN_DIRECT_MATERIALS,
  EASYSCAN_SUPPORT_FINISHED_PRODUCTS,
  OBSOLETE_PACKAGING_FINISHED_PRODUCTS,
  SCANBOX_DIRECT_MATERIALS,
  SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS,
  SCANBOX_REUSED_SUPPORT_FINISHED_PRODUCT_NAMES,
} from './inventory-bom-bootstrap.service';
import { ProductBomItem } from './product-bom-item.entity';
import { SellableProduct } from './sellable-product.entity';
import { SellableProductBomItem } from './sellable-product-bom-item.entity';
import { SellableProductMaterialItem } from './sellable-product-material-item.entity';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run(){
  const app=await NestFactory.createApplicationContext(AppModule,{logger:['error']});
  const products=app.get<Repository<FinishedProduct>>(getRepositoryToken(FinishedProduct));
  const items=app.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem));
  const bom=app.get<Repository<ProductBomItem>>(getRepositoryToken(ProductBomItem));
  const sellable=app.get<Repository<SellableProduct>>(getRepositoryToken(SellableProduct));
  const sellableBom=app.get<Repository<SellableProductBomItem>>(getRepositoryToken(SellableProductBomItem));
  const sellableMaterials=app.get<Repository<SellableProductMaterialItem>>(getRepositoryToken(SellableProductMaterialItem));
  const inventory=app.get(InventoryService);
  const boardProducts=await products.findBy(BOARD_DEFINITIONS.map(board=>({sku:board.sku})));
  check(boardProducts.length===3,'Expected all three Board finished products');
  check(boardProducts.every(product=>product.category===FinishedProductCategory.PCB),'All Board finished products must have the PCB category');
  const easyBoard=boardProducts.find(product=>product.sku==='BOARD-EASYSCAN');
  check(easyBoard,'EasyScan Board is missing');
  const easyLines=await bom.findBy({productId:easyBoard.id});
  const materialById=new Map((await items.findBy({id:In(easyLines.map(line=>line.itemId))})).map(item=>[item.id,item]));
  const expected:Record<string,number>={'SS34 cho MC':1,'1N4007':2,'Trở 150R 0603':1,'Trở 330R':1,'PCB trần EasyScan':1};
  for(const [name,quantity] of Object.entries(expected)){
    const line=easyLines.find(candidate=>materialById.get(candidate.itemId)?.name===name);
    check(line&&Number(line.quantityPerProduct)===quantity,`${name} must equal ${quantity}`);
  }
  const sellableProducts=await sellable.find();
  const easyScan=sellableProducts.find(product=>product.name==='Máy đọc lỗi Easyscan');
  check(easyScan,'Sellable EasyScan product is missing');
  const easyDevice=await products.findOneBy({sku:'DEVICE-EASYSCAN'});
  check(easyDevice,'Device EasyScan is missing');
  check(easyDevice.category===FinishedProductCategory.DEVICE,'Device EasyScan must have the DEVICE category');
  check(await sellableBom.exist({where:{productId:easyScan.id,finishedProductId:easyDevice.id}}),'Sellable EasyScan must include Device EasyScan');
  check(!await sellableBom.exist({where:{productId:easyScan.id,finishedProductId:easyBoard.id}}),'Sellable EasyScan must not directly include Board mạch EasyScan');
  const easyScanLines=await sellableBom.findBy({productId:easyScan.id});
  const easyScanComponentIds=new Set(easyScanLines.map(line=>line.finishedProductId));
  for(const definition of EASYSCAN_SUPPORT_FINISHED_PRODUCTS){
    const component=await products.findOneBy({name:definition.name});
    check(component,`${definition.name} is missing`);
    check(component.category===FinishedProductCategory.CABLE,`${definition.name} must have the CABLE category`);
    check(easyScanComponentIds.has(component.id),`Sellable EasyScan must include ${definition.name}`);
    const componentLines=await bom.findBy({productId:component.id});
    check(componentLines.length===definition.materials.length,`${definition.name} must have ${definition.materials.length} material lines`);
  }
  const easyDirectLines=await sellableMaterials.findBy({productId:easyScan.id});
  const easyDirectItems=await items.findBy({id:In(easyDirectLines.map(line=>line.itemId))});
  check(EASYSCAN_DIRECT_MATERIALS.every(name=>easyDirectItems.some(item=>item.name===name)),'Sellable EasyScan has an incorrect direct packing material mapping');
  for(const [productName,deviceSku] of [['Máy đọc lỗi ScanBox','DEVICE-SCANBOX'],['Máy KeyScan','DEVICE-KEYSCAN']]){
    const product=sellableProducts.find(candidate=>candidate.name===productName);
    const device=await products.findOneBy({sku:deviceSku});
    check(product,`${productName} is missing`);
    check(device,`${deviceSku} is missing`);
    check(await sellableBom.exist({where:{productId:product.id,finishedProductId:device.id}}),`${productName} must include ${deviceSku}`);
  }
  const scanBox=sellableProducts.find(product=>product.name==='Máy đọc lỗi ScanBox');
  check(scanBox,'Sellable ScanBox product is missing');
  const scanBoxLines=await sellableBom.findBy({productId:scanBox.id});
  const scanBoxComponentIds=new Set(scanBoxLines.map(line=>line.finishedProductId));
  const expectedScanBoxSupportNames=[
    ...SCANBOX_REUSED_SUPPORT_FINISHED_PRODUCT_NAMES,
    ...SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS.map(definition=>definition.name),
  ];
  for(const name of expectedScanBoxSupportNames){
    const component=await products.findOneBy({name});
    check(component,`${name} is missing`);
    check(scanBoxComponentIds.has(component.id),`Sellable ScanBox must include ${name}`);
  }
  check(scanBoxLines.length===7,'Sellable ScanBox must have exactly 7 real finished components');
  const scanDirectLines=await sellableMaterials.findBy({productId:scanBox.id});
  const scanDirectItems=await items.findBy({id:In(scanDirectLines.map(line=>line.itemId))});
  check(SCANBOX_DIRECT_MATERIALS.every(name=>scanDirectItems.some(item=>item.name===name)),'Sellable ScanBox has an incorrect direct packing material mapping');
  for(const definition of SCANBOX_NEW_SUPPORT_FINISHED_PRODUCTS){
    const component=await products.findOneBy({name:definition.name});
    check(component,`${definition.name} is missing`);
    const componentLines=await bom.findBy({productId:component.id});
    const componentMaterials=await items.findBy({id:In(componentLines.map(line=>line.itemId))});
    check(componentLines.length===definition.materials.length,`${definition.name} must have ${definition.materials.length} material lines`);
    check(definition.materials.every(name=>componentMaterials.some(material=>material.name===name)),`${definition.name} has an incorrect material mapping`);
  }
  for(const name of OBSOLETE_PACKAGING_FINISHED_PRODUCTS){
    const obsolete=await products.findOneBy({name});
    if(obsolete)check(!obsolete.isActive,`${name} must not remain an active Finished Product`);
  }
  const audit=await inventory.bomAudit();
  process.stdout.write(`${JSON.stringify({boards:audit.boards,sellableProducts:sellableProducts.map(product=>product.name),easyScanComponents:easyScanLines.length,audit:audit.summary})}\n`);
  await app.close();
}
void run();

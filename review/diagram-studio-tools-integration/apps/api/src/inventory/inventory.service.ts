import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { InventoryBomKind, InventoryItem } from './inventory-item.entity';
import { InventoryItemAudit } from './inventory-item-audit.entity';
import { calculateBalance, suggestNormalization } from './inventory.policy';
import { InventoryTransaction, InventoryTransactionType } from './inventory-transaction.entity';
import { RequestInventoryCountDto, CreateFinishedProductDto, CreateInventoryItemDto, CreateMovementDto, CreatePurchaseRequestDto, CreateSellableProductDto, CreateStockCountSheetDto, FinishedProductMovementDto, MaterialPlanDto, NormalizeInventoryBatchDto, OpeningBalanceDto, ReplaceBomDto, ReplaceSellableProductBomDto, UpdateFinishedProductDto, UpdateInventoryItemDto, UpdatePurchaseRequestDto, UpdateSellableProductDto, UpdateStockCountSheetDto } from './inventory.dto';
import { PurchasePaymentStatus, PurchaseRequest, PurchaseRequestStatus } from './purchase-request.entity';
import { FinishedProduct } from './finished-product.entity';
import { FinishedProductTransaction, FinishedProductTransactionType } from './finished-product-transaction.entity';
import { ProductBomItem } from './product-bom-item.entity';
import { FinishedProductComponentItem } from './finished-product-component-item.entity';
import { SellableProduct } from './sellable-product.entity';
import { SellableProductBomItem } from './sellable-product-bom-item.entity';
import { SellableProductTransaction } from './sellable-product-transaction.entity';
import { SellableProductMaterialItem } from './sellable-product-material-item.entity';
import { BOARD_CATALOG, BOARD_COMPONENT_GROUPS, BOARD_DEFINITIONS, SOURCE_DOUBLE_CHECKS } from './board-bom.config';
import { duplicateMaterialGroups, matchesCatalogMaterial, normalizeMaterialName, unassignedBoardComponents } from './board-bom.policy';
import { InventoryImage, InventoryImageOwnerType } from './inventory-image.entity';
import { validateInventoryImage } from './inventory-image.policy';
import { EmailService } from '../email/email.service';
import { User, UserRole } from '../users/user.entity';
import { PurchasePaymentLog } from './purchase-payment-log.entity';
import { randomUUID } from 'node:crypto';
import { SystemNotificationModule } from '../notifications/system-notification.entity';
import { SystemNotificationsService } from '../notifications/system-notifications.service';
import { ProductionOutputType } from '../production/production-entry.entity';
import { ProductionLot, ProductionLotStatus } from '../production/production-lot.entity';
import { calculateMaterialPlan } from './inventory-material-plan.policy';
import { StockCountLine, StockCountSheet, StockCountSheetStatus } from './stock-count-sheet.entity';

export type CatalogImportRecord = Pick<InventoryItem, 'groupName'|'name'|'sourceStockText'|'sourceSnapshot'> & {
  sourceSpreadsheetId:string; sourceSheetName:string; sourceRow:number;
} & Partial<Pick<InventoryItem, 'easycanQtyPerBoard'|'scanboxQtyPerBoard'|'easyscuQtyPerBoard'|'purchaseUrl'|'price'>>;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private readonly items: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction) private readonly transactions: Repository<InventoryTransaction>,
    @InjectRepository(InventoryItemAudit) private readonly audits: Repository<InventoryItemAudit>,
    @InjectRepository(PurchaseRequest) private readonly requests: Repository<PurchaseRequest>,
    @InjectRepository(PurchasePaymentLog) private readonly paymentLogs: Repository<PurchasePaymentLog>,
    @InjectRepository(FinishedProduct) private readonly products: Repository<FinishedProduct>,
    @InjectRepository(FinishedProductTransaction) private readonly productTransactions: Repository<FinishedProductTransaction>,
    @InjectRepository(ProductBomItem) private readonly bomItems: Repository<ProductBomItem>,
    @InjectRepository(FinishedProductComponentItem) private readonly componentBomItems: Repository<FinishedProductComponentItem>,
    @InjectRepository(SellableProduct) private readonly sellableProducts: Repository<SellableProduct>,
    @InjectRepository(SellableProductBomItem) private readonly sellableBomItems: Repository<SellableProductBomItem>,
    @InjectRepository(SellableProductMaterialItem) private readonly sellableMaterialItems: Repository<SellableProductMaterialItem>,
    @InjectRepository(SellableProductTransaction) private readonly sellableTransactions: Repository<SellableProductTransaction>,
    @InjectRepository(InventoryImage) private readonly images: Repository<InventoryImage>,
    @InjectRepository(StockCountSheet) private readonly stockCountSheets:Repository<StockCountSheet>,
    private readonly dataSource: DataSource,
    private readonly realtime: RealtimeGateway,
    private readonly email: EmailService,
    private readonly systemNotifications: SystemNotificationsService,
  ) {}

  async findStockCountSheets(){return this.stockCountSheets.find({order:{createdAt:'DESC'},take:30});}

  async createStockCountSheet(dto:CreateStockCountSheetDto,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được tạo phiếu kiểm kho');
    const assignee=await this.dataSource.getRepository(User).findOneBy({id:dto.assigneeId,isActive:true});
    if(!assignee)throw new BadRequestException('Người phụ trách không còn hoạt động');
    const open=await this.stockCountSheets.findOne({where:[{status:StockCountSheetStatus.DRAFT},{status:StockCountSheetStatus.SUBMITTED}]});
    if(open)throw new BadRequestException(`Phiếu ${open.code} chưa được chốt`);
    const [products,sellable]=await Promise.all([this.products.find({where:{isActive:true},order:{name:'ASC'}}),this.sellableProducts.find({where:{isActive:true},order:{name:'ASC'}})]);
    const periodStart=this.vietnamDate();
    const due=new Date(`${periodStart}T00:00:00+07:00`);due.setDate(due.getDate()+4);
    const dueDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(due);
    const sequence=await this.stockCountSheets.count({where:{periodStart}})+1;
    const lines:StockCountLine[]=[...products.map(item=>({ownerType:'FINISHED_PRODUCT' as const,ownerId:item.id,label:item.name,systemQuantity:Number(item.onHandQty),countedQuantity:null,note:null})),...sellable.map(item=>({ownerType:'SELLABLE_PRODUCT' as const,ownerId:item.id,label:item.name,systemQuantity:Number(item.onHandQty),countedQuantity:null,note:null}))];
    if(!lines.length)throw new BadRequestException('Không có Thành phẩm hoặc Sản phẩm đang hoạt động');
    const saved=await this.stockCountSheets.save(this.stockCountSheets.create({code:`KKTP-${periodStart.replaceAll('-','')}-${String(sequence).padStart(2,'0')}`,periodStart,dueDate,status:StockCountSheetStatus.DRAFT,assigneeId:assignee.id,createdById:actor.id,submittedById:null,submittedAt:null,finalizedById:null,finalizedAt:null,lines}));
    this.realtime.emitInventory('inventory.product.updated',{stockCountSheetId:saved.id});return saved;
  }

  async updateStockCountSheet(id:string,dto:UpdateStockCountSheetDto,actor:AuthUser){
    const sheet=await this.requireStockCountSheet(id);this.assertCanEditStockCountSheet(sheet,actor);
    const input=new Map(dto.lines.map(line=>[`${line.ownerType}:${line.ownerId}`,line]));
    if(input.size!==sheet.lines.length||sheet.lines.some(line=>!input.has(`${line.ownerType}:${line.ownerId}`)))throw new BadRequestException('Danh sách hàng hóa của phiếu không hợp lệ');
    sheet.lines=sheet.lines.map(line=>{const value=input.get(`${line.ownerType}:${line.ownerId}`)!;return {...line,countedQuantity:value.countedQuantity===undefined?null:value.countedQuantity,note:value.note?.trim()||null};});
    const saved=await this.stockCountSheets.save(sheet);this.realtime.emitInventory('inventory.product.updated',{stockCountSheetId:saved.id});return saved;
  }

  async submitStockCountSheet(id:string,actor:AuthUser){
    const sheet=await this.requireStockCountSheet(id);this.assertCanEditStockCountSheet(sheet,actor);
    if(sheet.lines.some(line=>line.countedQuantity===null))throw new BadRequestException('Cần nhập Thực đếm cho tất cả hàng hóa');
    sheet.status=StockCountSheetStatus.SUBMITTED;sheet.submittedById=actor.id;sheet.submittedAt=new Date();
    const saved=await this.stockCountSheets.save(sheet);this.realtime.emitInventory('inventory.product.updated',{stockCountSheetId:saved.id});return saved;
  }

  async finalizeStockCountSheet(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được chốt phiếu kiểm kho');
    const saved=await this.dataSource.transaction(async manager=>{
      const sheet=await manager.findOne(StockCountSheet,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!sheet)throw new NotFoundException('Không tìm thấy phiếu kiểm kho');
      if(sheet.status!==StockCountSheetStatus.SUBMITTED)throw new BadRequestException('Phiếu phải được gửi trước khi chốt');
      for(const line of sheet.lines){
        const counted=line.countedQuantity;if(counted===null)throw new BadRequestException('Phiếu còn thiếu Thực đếm');
        if(line.ownerType==='FINISHED_PRODUCT'){
          const product=await manager.findOne(FinishedProduct,{where:{id:line.ownerId},lock:{mode:'pessimistic_write'}});if(!product)throw new NotFoundException(`Không tìm thấy ${line.label}`);
          const before=Number(product.onHandQty);product.onHandQty=counted.toFixed(3);await manager.save(product);
          await manager.save(manager.create(FinishedProductTransaction,{productId:product.id,type:FinishedProductTransactionType.ADJUSTMENT,quantity:(counted-before).toFixed(3),balanceBefore:before.toFixed(3),balanceAfter:counted.toFixed(3),note:`Kiểm kho ${sheet.code}${line.note?` · ${line.note}`:''}`,reference:sheet.id,actorId:actor.id}));
        }else{
          const product=await manager.findOne(SellableProduct,{where:{id:line.ownerId},lock:{mode:'pessimistic_write'}});if(!product)throw new NotFoundException(`Không tìm thấy ${line.label}`);
          const before=Number(product.onHandQty);product.onHandQty=counted.toFixed(3);await manager.save(product);
          await manager.save(manager.create(SellableProductTransaction,{productId:product.id,type:FinishedProductTransactionType.ADJUSTMENT,quantity:(counted-before).toFixed(3),balanceBefore:before.toFixed(3),balanceAfter:counted.toFixed(3),note:`Kiểm kho ${sheet.code}${line.note?` · ${line.note}`:''}`,reference:sheet.id,actorId:actor.id}));
        }
      }
      sheet.status=StockCountSheetStatus.FINALIZED;sheet.finalizedById=actor.id;sheet.finalizedAt=new Date();return manager.save(sheet);
    });
    this.realtime.emitInventory('inventory.product.updated',{stockCountSheetId:saved.id});return saved;
  }

  async findItems(includeInactive=false) {
    const items=await this.items.find({ where: includeInactive ? {} : { isActive: true }, order: { groupName: 'ASC', name: 'ASC' } });
    const open=await this.requests.find({where:[{status:PurchaseRequestStatus.REQUESTED},{status:PurchaseRequestStatus.ORDERED}]});
    const incoming=new Map<string,number>();for(const request of open)incoming.set(request.itemId,(incoming.get(request.itemId)??0)+(request.status===PurchaseRequestStatus.ORDERED?Number(request.requestedQty):0));
    const staleBefore=Date.now()-10*86400000;
    return items.map(item=>({...item,normalizationSuggestion:item.onHandQty===null?suggestNormalization(item.sourceStockText,item.groupName):null,isLowStock:item.onHandQty!==null&&Number(item.onHandQty)<Number(item.minimumStock),needsCount:!!item.checkRequestedAt||!item.lastCountedAt||item.lastCountedAt.getTime()<staleBefore,expectedIncoming:incoming.get(item.id)??0}));
  }

  async materialPlan(dto:MaterialPlanDto) {
    const [items,finishedProducts,sellableProducts]=await Promise.all([this.findItems(),this.findProducts(),this.findSellableProducts()]);
    try {
      return calculateMaterialPlan({outputType:dto.outputType,outputId:dto.outputId,quantity:dto.quantity,items,finishedProducts,sellableProducts});
    } catch (error) {
      if(error instanceof Error&&['Sellable product not found','Finished product not found'].includes(error.message))throw new NotFoundException(error.message);
      throw error;
    }
  }

  async createItem(dto:CreateInventoryItemDto,actor:AuthUser){
    const item=await this.items.save(this.items.create({groupName:dto.groupName.trim(),name:dto.name.trim(),sku:dto.sku?.trim()||null,unit:'unit',onHandQty:null,bomKind:dto.bomKind??InventoryBomKind.OTHER,location:dto.location?.trim()||null,note:dto.note?.trim()||null,minimumStock:(dto.minimumStock??100).toFixed(3),price:dto.price?.toFixed(2)??null,purchaseLinks:dto.purchaseLinks??[],purchaseUrl:dto.purchaseLinks?.[0]??null,isActive:true}));
    await this.audits.save(this.audits.create({itemId:item.id,actorId:actor.id,changes:{created:{before:null,after:{name:item.name,sku:item.sku}}}}));
    if(dto.openingQuantity!==undefined)await this.record(item.id,InventoryTransactionType.STOCK_COUNT,dto.openingQuantity,actor,'Initial physical count');
    this.realtime.emitInventory('inventory.item.updated',item);return this.requireItem(item.id);
  }

  async findTransactions(itemId:string) {
    await this.requireItem(itemId);
    return this.transactions.find({ where: { itemId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async openingBalance(id:string,dto:OpeningBalanceDto,actor:AuthUser) {
    return this.record(id,InventoryTransactionType.ADJUSTMENT,dto.quantity,actor,dto.note??'Opening balance',undefined,dto.unit.trim(),true);
  }

  async movement(id:string,dto:CreateMovementDto,actor:AuthUser) {
    return this.record(id,dto.type,dto.quantity,actor,dto.note,dto.reference);
  }

  async update(id:string,dto:UpdateInventoryItemDto,actor:AuthUser) {
    if(dto.isActive!==undefined&&actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được thay đổi trạng thái vật tư');
    const item=await this.requireItem(id);
    const changes:Record<string,{before:unknown;after:unknown}>={};
    const set=<K extends keyof InventoryItem>(key:K,value:InventoryItem[K])=>{if(item[key]!==value){changes[String(key)]={before:item[key],after:value};item[key]=value;}};
    if(dto.unit!==undefined)set('unit',dto.unit.trim());if(dto.sku!==undefined)set('sku',dto.sku.trim()||null);if(dto.name!==undefined)set('name',dto.name.trim());if(dto.groupName!==undefined)set('groupName',dto.groupName.trim());if(dto.bomKind!==undefined)set('bomKind',dto.bomKind);if(dto.location!==undefined)set('location',dto.location.trim()||null);if(dto.note!==undefined)set('note',dto.note.trim()||null);if(dto.minimumStock!==undefined)set('minimumStock',dto.minimumStock.toFixed(3));if(dto.price!==undefined)set('price',dto.price.toFixed(2));if(dto.purchaseLinks!==undefined){set('purchaseLinks',dto.purchaseLinks);set('purchaseUrl',dto.purchaseLinks[0]??null);}if(dto.isActive!==undefined)set('isActive',dto.isActive);
    const saved=await this.items.save(item);
    if(Object.keys(changes).length)await this.audits.save(this.audits.create({itemId:id,actorId:actor.id,changes}));
    this.realtime.emitInventory('inventory.item.updated',saved);
    return saved;
  }

  async removeItem(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được xóa vật tư');
    const saved=await this.dataSource.transaction(async manager=>{
      const item=await this.lockItem(manager,id);
      if(!item.isActive)return item;
      if(await manager.exists(ProductBomItem,{where:{itemId:id}}))throw new BadRequestException('Không thể xóa: vật tư đang nằm trong Cấu thành thành phẩm');
      if(await manager.exists(PurchaseRequest,{where:[{itemId:id,status:PurchaseRequestStatus.REQUESTED},{itemId:id,status:PurchaseRequestStatus.ORDERED}]}))throw new BadRequestException('Không thể xóa: vật tư đang có Request mua active');
      item.isActive=false;
      await manager.save(item);
      await manager.save(manager.create(InventoryItemAudit,{itemId:id,actorId:actor.id,changes:{isActive:{before:true,after:false}}}));
      return item;
    });
    this.realtime.emitInventory('inventory.item.updated',saved);
    return saved;
  }

  async normalizeBatch(dto:NormalizeInventoryBatchDto,actor:AuthUser) {
    const uniqueIds=new Set(dto.items.map(item=>item.itemId));
    if(uniqueIds.size!==dto.items.length)throw new BadRequestException('Normalization batch contains duplicate items');
    const result=await this.dataSource.transaction(async manager=>{
      const normalized=[];
      for(const input of dto.items){
        const item=await this.lockItem(manager,input.itemId);
        if(item.onHandQty!==null)throw new BadRequestException(`${item.name} is already normalized`);
        const after=calculateBalance(InventoryTransactionType.ADJUSTMENT,input.quantity,null);
        item.unit=input.unit;
        item.onHandQty=after.toFixed(3);
        await manager.save(item);
        const transaction=await manager.save(manager.create(InventoryTransaction,{itemId:item.id,type:InventoryTransactionType.ADJUSTMENT,quantity:after.toFixed(3),balanceBefore:null,balanceAfter:after.toFixed(3),unit:input.unit,note:dto.note?.trim()||'Inventory normalization',reference:null,actorId:actor.id}));
        normalized.push({item,transaction});
      }
      return normalized;
    });
    this.realtime.emitInventory('inventory.normalized',result);
    return {normalized:result.length,results:result};
  }

  async importCatalog(records:CatalogImportRecord[],actor:AuthUser) {
    const result=await this.dataSource.transaction(async manager=>{
      let created=0,updated=0;
      for(const record of records){
        let item=await manager.findOne(InventoryItem,{where:{sourceSpreadsheetId:record.sourceSpreadsheetId,sourceSheetName:record.sourceSheetName,sourceRow:record.sourceRow}});
        if(item){
          item.groupName=record.groupName;item.name=record.name;item.sourceStockText=record.sourceStockText;item.sourceSnapshot=record.sourceSnapshot;
          item.easycanQtyPerBoard=record.easycanQtyPerBoard??null;item.scanboxQtyPerBoard=record.scanboxQtyPerBoard??null;item.easyscuQtyPerBoard=record.easyscuQtyPerBoard??null;item.purchaseUrl=record.purchaseUrl??null;item.price=record.price??null;
          if(item.bomKind===null&&[record.easycanQtyPerBoard,record.scanboxQtyPerBoard,record.easyscuQtyPerBoard].some(value=>value!==null&&value!==undefined&&Number(value)>0))item.bomKind=InventoryBomKind.BOARD_COMPONENT;updated++;
        }else{
          const mapped=[record.easycanQtyPerBoard,record.scanboxQtyPerBoard,record.easyscuQtyPerBoard].some(value=>value!==null&&value!==undefined&&Number(value)>0);
          item=manager.create(InventoryItem,{...record,isActive:true,onHandQty:null,unit:'unit',sku:null,bomKind:mapped||BOARD_COMPONENT_GROUPS.has(record.groupName.trim().toLocaleUpperCase('vi-VN'))?InventoryBomKind.BOARD_COMPONENT:InventoryBomKind.OTHER});created++;
        }
        await manager.save(item);
      }
      return {created,updated,total:records.length};
    });
    this.realtime.emitInventory('inventory.imported',result);
    return result;
  }

  async requestCount(id:string,dto:RequestInventoryCountDto,actor:AuthUser){
    const saved=await this.dataSource.transaction(async manager=>{
      const item=await this.lockItem(manager,id);
      if(!item.isActive)throw new BadRequestException('Vật tư đã ngừng sử dụng');
      if(item.checkAssignedToId)throw new BadRequestException('Vật tư đã có người được giao kiểm');
      const assignee=await manager.findOneBy(User,{id:dto.assigneeId,isActive:true});
      if(!assignee)throw new BadRequestException('Người kiểm không còn hoạt động');
      item.checkRequestedAt=new Date();item.checkRequestedById=actor.id;
      item.checkAssignedToId=assignee.id;item.checkRequestNote=dto.note?.trim()||null;
      await manager.save(item);
      const audit=await manager.save(manager.create(InventoryItemAudit,{itemId:id,actorId:actor.id,changes:{checkAssignedToId:{before:null,after:assignee.id},checkRequestNote:{before:null,after:item.checkRequestNote}}}));
      await this.systemNotifications.create(manager,{
        actor,relatedUserIds:[assignee.id],includeActor:assignee.id===actor.id,
        module:SystemNotificationModule.INVENTORY,eventType:'INVENTORY_COUNT_ASSIGNED',entityType:'INVENTORY_ITEM',entityId:id,entityLabel:item.name,
        message:`đã giao ${assignee.displayName} kiểm tồn thực tế`,bodyPreview:item.checkRequestNote,
        dedupeKey:`inventory-count:${audit.id}:assigned`,
      });
      return item;
    });
    this.realtime.emitInventory('inventory.item.updated',saved);return saved;
  }
  async findAudits(id:string){await this.requireItem(id);return this.audits.find({where:{itemId:id},order:{createdAt:'DESC'},take:200});}
  async findPurchaseRequests(){
    const requests=await this.requests.find({order:{createdAt:'DESC'},take:300});
    if(!requests.length)return requests;
    const logs=await this.paymentLogs.find({where:{requestId:In(requests.map(request=>request.id))},order:{createdAt:'DESC'}});
    return requests.map(request=>({...request,paymentLogs:logs.filter(log=>log.requestId===request.id)}));
  }
  async createPurchaseRequest(id:string,dto:CreatePurchaseRequestDto,actor:AuthUser){
    const result=await this.dataSource.transaction(async manager=>{
      const item=await manager.findOne(InventoryItem,{where:{id}});if(!item)throw new NotFoundException('Inventory item not found');
      if(dto.assignedBuyerId)await this.requireActiveBuyer(manager,dto.assignedBuyerId);
      const saved=await manager.save(manager.create(PurchaseRequest,{itemId:id,requestedQty:dto.quantity.toFixed(3),receivedQty:null,status:PurchaseRequestStatus.REQUESTED,paymentStatus:PurchasePaymentStatus.UNPAID,note:dto.note?.trim()||null,orderUrl:null,orderCode:null,requesterId:actor.id,assignedBuyerId:dto.assignedBuyerId??null,updatedById:actor.id,orderedAt:null,receivedAt:null}));
      const admin=await manager.findOne(User,{where:{username:'admin',isActive:true}});
      if(admin)await this.email.queue(manager,[{recipient:admin,recipientEmail:process.env.PURCHASING_ADMIN_EMAIL??'easyscan.marketplace@gmail.com',eventType:'PURCHASE_REQUEST_CREATED',dedupeKey:`purchase-request:${saved.id}:created`,subject:`[Auto2Tech] Request mua ${item.name}`,payload:{actorName:actor.displayName,itemName:item.name,requestedQty:dto.quantity,onHandQty:item.onHandQty,minimumStock:item.minimumStock,bodyPreview:saved.note,appUrl:process.env.APP_PUBLIC_URL}}]);
      await this.systemNotifications.create(manager,{actor,relatedUserIds:saved.assignedBuyerId?[saved.assignedBuyerId]:[],module:SystemNotificationModule.PURCHASING,eventType:'PURCHASE_REQUEST_CREATED',entityType:'PURCHASE_REQUEST',entityId:saved.id,entityLabel:item.name,message:saved.assignedBuyerId?'đã giao bạn phụ trách mua':'đã tạo Request mua',bodyPreview:`${dto.quantity.toLocaleString('vi-VN')} unit${saved.note?` · ${saved.note}`:''}`,dedupeKey:`purchase-request:${saved.id}:created`});
      return saved;
    });
    this.realtime.emitInventory('inventory.purchase.updated',result);return result;
  }
  async updatePurchaseRequest(id:string,dto:UpdatePurchaseRequestDto,actor:AuthUser){
    const saved=await this.dataSource.transaction(async manager=>{
      const request=await manager.findOne(PurchaseRequest,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!request)throw new NotFoundException('Purchase request not found');
      if(request.status===PurchaseRequestStatus.CANCELLED)throw new BadRequestException('Purchase request is cancelled');
      const before={itemId:request.itemId,requestedQty:request.requestedQty,note:request.note,status:request.status,paymentStatus:request.paymentStatus,orderUrl:request.orderUrl,orderCode:request.orderCode,assignedBuyerId:request.assignedBuyerId};
      const previousPaymentStatus=request.paymentStatus;
      const editing=dto.itemId!==undefined||dto.quantity!==undefined||dto.note!==undefined;
      const editingOrderReference=dto.orderUrl!==undefined||dto.orderCode!==undefined;
      const assigningBuyer=dto.assignedBuyerId!==undefined;
      const orderingNow=request.status===PurchaseRequestStatus.REQUESTED&&dto.status===PurchaseRequestStatus.ORDERED;
      if(editing&&request.status!==PurchaseRequestStatus.REQUESTED)throw new BadRequestException('Chỉ sửa được Request đang chờ mua');
      if(editingOrderReference&&!orderingNow&&!(request.status===PurchaseRequestStatus.ORDERED&&dto.status===undefined))throw new BadRequestException('Chỉ sửa đơn mua khi Request đang Đang mua');
      if(assigningBuyer&&![PurchaseRequestStatus.REQUESTED,PurchaseRequestStatus.ORDERED].includes(request.status))throw new BadRequestException('Chỉ gán người mua khi Request đang hoạt động');
      if(dto.itemId!==undefined){const item=await manager.findOne(InventoryItem,{where:{id:dto.itemId,isActive:true}});if(!item)throw new NotFoundException('Inventory item not found');request.itemId=item.id;}
      if(dto.quantity!==undefined)request.requestedQty=dto.quantity.toFixed(3);
      if(dto.note!==undefined)request.note=dto.note.trim()||null;
      if(dto.assignedBuyerId!==undefined){if(dto.assignedBuyerId)await this.requireActiveBuyer(manager,dto.assignedBuyerId);request.assignedBuyerId=dto.assignedBuyerId;}
      if(orderingNow||editingOrderReference){
        const orderUrl=dto.orderUrl===undefined?request.orderUrl:dto.orderUrl?.trim()||null;
        const orderCode=dto.orderCode===undefined?request.orderCode:dto.orderCode?.trim()||null;
        if(!orderUrl&&!orderCode)throw new BadRequestException('Cần link hoặc mã đơn hàng');
        request.orderUrl=orderUrl;request.orderCode=orderCode;
      }
      if(dto.status!==undefined){
        if(request.status===PurchaseRequestStatus.REQUESTED&&dto.status===PurchaseRequestStatus.RECEIVED)throw new BadRequestException('Phải xác nhận đã đặt hàng trước khi nhận hàng');
        const allowed=request.status===PurchaseRequestStatus.REQUESTED?[PurchaseRequestStatus.ORDERED,PurchaseRequestStatus.CANCELLED]:request.status===PurchaseRequestStatus.ORDERED?[PurchaseRequestStatus.RECEIVED,PurchaseRequestStatus.CANCELLED]:[];
        if(!allowed.includes(dto.status))throw new BadRequestException('Invalid purchase request transition');
      }
      if(dto.status===PurchaseRequestStatus.ORDERED)request.orderedAt=new Date();
      if(dto.status===PurchaseRequestStatus.RECEIVED){
        if(!Number.isFinite(dto.receivedQuantity)||!dto.receivedQuantity||dto.receivedQuantity<=0)throw new BadRequestException('Received quantity is required');
        const item=await this.lockItem(manager,request.itemId);
        if(!item.unit)throw new BadRequestException('Unit must be normalized first');
        const before=item.onHandQty===null?0:Number(item.onHandQty);
        const after=calculateBalance(InventoryTransactionType.IN,dto.receivedQuantity,before);
        item.onHandQty=after.toFixed(3);
        await manager.save(item);
        await manager.save(manager.create(InventoryTransaction,{itemId:item.id,type:InventoryTransactionType.IN,quantity:dto.receivedQuantity.toFixed(3),balanceBefore:before.toFixed(3),balanceAfter:after.toFixed(3),unit:item.unit,note:'Purchase received',reference:request.id,actorId:actor.id}));
        request.receivedQty=dto.receivedQuantity.toFixed(3);
        request.receivedAt=new Date();
      }
      if(dto.status!==undefined)request.status=dto.status;
      if(dto.paymentStatus!==undefined)request.paymentStatus=dto.paymentStatus;
      if(dto.status===PurchaseRequestStatus.RECEIVED)request.paymentStatus=PurchasePaymentStatus.PAID;
      request.updatedById=actor.id;
      const savedRequest=await manager.save(request);
      let paymentLogId:string|null=null;
      if(request.paymentStatus!==previousPaymentStatus){
        const paymentLog=await manager.save(manager.create(PurchasePaymentLog,{requestId:request.id,fromStatus:previousPaymentStatus,toStatus:request.paymentStatus,actorId:actor.id}));
        paymentLogId=paymentLog.id;
      }
      const changes=this.purchaseRequestChanges(before,savedRequest);
      if(changes.length){
        const item=await manager.findOne(InventoryItem,{where:{id:savedRequest.itemId}});
        const event=this.purchaseNotificationEvent(before,savedRequest);
        await this.systemNotifications.create(manager,{actor,relatedUserIds:[savedRequest.requesterId,savedRequest.assignedBuyerId].filter((userId):userId is string=>Boolean(userId)),module:SystemNotificationModule.PURCHASING,eventType:event.type,entityType:'PURCHASE_REQUEST',entityId:savedRequest.id,entityLabel:item?.name??'Vật tư',message:event.message,bodyPreview:changes.join(' · '),dedupeKey:`purchase-request:${savedRequest.id}:${event.type}:${paymentLogId??randomUUID()}`});
      }
      return savedRequest;
    });
    this.realtime.emitInventory('inventory.purchase.updated',saved);
    return saved;
  }

  private purchaseRequestChanges(before:Pick<PurchaseRequest,'itemId'|'requestedQty'|'note'|'status'|'paymentStatus'|'orderUrl'|'orderCode'|'assignedBuyerId'>,after:PurchaseRequest){
    const changes:string[]=[];
    if(before.itemId!==after.itemId)changes.push('Đổi vật tư');
    if(Number(before.requestedQty)!==Number(after.requestedQty))changes.push(`Số lượng ${Number(before.requestedQty).toLocaleString('vi-VN')} → ${Number(after.requestedQty).toLocaleString('vi-VN')} unit`);
    if(before.note!==after.note)changes.push('Đã sửa ghi chú');
    if(before.status!==after.status)changes.push(`Mua hàng: ${this.purchaseStatusLabel(before.status)} → ${this.purchaseStatusLabel(after.status)}`);
    if(before.paymentStatus!==after.paymentStatus)changes.push(`Thanh toán: ${this.paymentStatusLabel(before.paymentStatus)} → ${this.paymentStatusLabel(after.paymentStatus)}`);
    if(before.orderUrl!==after.orderUrl||before.orderCode!==after.orderCode)changes.push('Đã cập nhật link/mã đơn mua');
    if(before.assignedBuyerId!==after.assignedBuyerId)changes.push('Đã đổi người phụ trách mua');
    return changes;
  }

  private purchaseNotificationEvent(before:Pick<PurchaseRequest,'status'|'paymentStatus'|'orderUrl'|'orderCode'|'assignedBuyerId'>,after:PurchaseRequest){
    if(before.status!==after.status){
      if(after.status===PurchaseRequestStatus.ORDERED)return {type:'PURCHASE_REQUEST_ORDERED',message:'đã đặt mua'};
      if(after.status===PurchaseRequestStatus.RECEIVED)return {type:'PURCHASE_REQUEST_RECEIVED',message:'đã xác nhận nhận hàng'};
      if(after.status===PurchaseRequestStatus.CANCELLED)return {type:'PURCHASE_REQUEST_CANCELLED',message:'đã huỷ Request mua'};
    }
    if(before.paymentStatus!==after.paymentStatus)return {type:'PURCHASE_PAYMENT_UPDATED',message:'đã đổi trạng thái thanh toán'};
    if(before.orderUrl!==after.orderUrl||before.orderCode!==after.orderCode)return {type:'PURCHASE_ORDER_REFERENCE_UPDATED',message:'đã cập nhật đơn mua'};
    if(before.assignedBuyerId!==after.assignedBuyerId)return {type:'PURCHASE_BUYER_ASSIGNED',message:after.assignedBuyerId?'đã giao bạn phụ trách mua':'đã bỏ người phụ trách mua'};
    return {type:'PURCHASE_REQUEST_EDITED',message:'đã sửa Request mua'};
  }

  private async requireActiveBuyer(manager:EntityManager,userId:string){
    const buyer=await manager.findOne(User,{where:{id:userId,isActive:true}});
    if(!buyer)throw new BadRequestException('Người phụ trách mua không hợp lệ');
    return buyer;
  }

  private purchaseStatusLabel(status:PurchaseRequestStatus){return {REQUESTED:'Request mua',ORDERED:'Đang mua',RECEIVED:'Đã nhận',CANCELLED:'Đã huỷ'}[status];}
  private paymentStatusLabel(status:PurchasePaymentStatus){return {UNPAID:'Chưa thanh toán',PARTIAL:'Thanh toán một phần',PAID:'Đã thanh toán'}[status];}
  async removePurchaseRequest(id:string){
    const result=await this.dataSource.transaction(async manager=>{
      const request=await manager.findOne(PurchaseRequest,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!request)throw new NotFoundException('Purchase request not found');
      if(![PurchaseRequestStatus.REQUESTED,PurchaseRequestStatus.CANCELLED].includes(request.status))throw new BadRequestException('Chỉ xóa được Request đang chờ mua hoặc đã hủy');
      await manager.delete(PurchaseRequest,{id});
      return {id};
    });
    this.realtime.emitInventory('inventory.purchase.updated',result);
    return result;
  }

  async findProducts(){const products=await this.products.find({where:{isActive:true},order:{name:'ASC'}});const [bom,componentBom]=await Promise.all([this.bomItems.find(),this.componentBomItems.find()]);return products.map(product=>({...product,bom:bom.filter(line=>line.productId===product.id),componentBom:componentBom.filter(line=>line.productId===product.id)}));}
  async createProduct(dto:CreateFinishedProductDto,actor:AuthUser){const product=await this.products.save(this.products.create({sku:dto.sku?.trim()||null,name:dto.name.trim(),category:dto.category,onHandQty:(dto.openingQuantity??0).toFixed(3),minimumStock:(dto.minimumStock??0).toFixed(3),location:null,note:dto.note?.trim()||null,isActive:true}));if((dto.openingQuantity??0)>0)await this.productTransactions.save(this.productTransactions.create({productId:product.id,type:FinishedProductTransactionType.ADJUSTMENT,quantity:dto.openingQuantity!.toFixed(3),balanceBefore:'0.000',balanceAfter:dto.openingQuantity!.toFixed(3),note:'Opening balance',actorId:actor.id}));this.realtime.emitInventory('inventory.product.updated',product);return product;}
  async updateProduct(id:string,dto:UpdateFinishedProductDto){const product=await this.requireProduct(id);Object.assign(product,{...(dto.sku!==undefined?{sku:dto.sku.trim()}:{}),...(dto.name!==undefined?{name:dto.name.trim()}:{}),...(dto.category!==undefined?{category:dto.category}:{}),...(dto.location!==undefined?{location:dto.location.trim()||null}:{}),...(dto.note!==undefined?{note:dto.note.trim()||null}:{}),...(dto.minimumStock!==undefined?{minimumStock:dto.minimumStock.toFixed(3)}:{}),...(dto.isActive!==undefined?{isActive:dto.isActive}:{})});const saved=await this.products.save(product);this.realtime.emitInventory('inventory.product.updated',saved);return saved;}
  async removeProduct(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được xóa thành phẩm');
    const saved=await this.dataSource.transaction(async manager=>{
      const product=await manager.findOne(FinishedProduct,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!product)throw new NotFoundException('Finished product not found');
      if(!product.isActive)return product;
      if(await manager.exists(ProductionLot,{where:{outputType:ProductionOutputType.FINISHED_PRODUCT,outputId:id,status:Not(ProductionLotStatus.DONE)}}))throw new BadRequestException('Không thể xóa: thành phẩm đang có Lô sản xuất chưa hoàn thành');
      await manager.delete(FinishedProductComponentItem,{componentProductId:id});
      await manager.delete(SellableProductBomItem,{finishedProductId:id});
      product.isActive=false;
      return manager.save(product);
    });
    this.realtime.emitInventory('inventory.product.updated',saved);
    return saved;
  }
  async productHistory(id:string){await this.requireProduct(id);return this.productTransactions.find({where:{productId:id},order:{createdAt:'DESC'},take:200});}
  async productMovement(id:string,dto:FinishedProductMovementDto,actor:AuthUser){const result=await this.dataSource.transaction(async manager=>{const product=await manager.findOne(FinishedProduct,{where:{id},lock:{mode:'pessimistic_write'}});if(!product)throw new NotFoundException('Finished product not found');const before=Number(product.onHandQty);const after=dto.type===FinishedProductTransactionType.ADJUSTMENT?dto.quantity:dto.type===FinishedProductTransactionType.OUT?before-dto.quantity:before+dto.quantity;if(after<0)throw new BadRequestException('Finished product stock cannot be negative');product.onHandQty=after.toFixed(3);await manager.save(product);const quantity=dto.type===FinishedProductTransactionType.ADJUSTMENT?after-before:dto.quantity;const transaction=await manager.save(manager.create(FinishedProductTransaction,{productId:id,type:dto.type,quantity:quantity.toFixed(3),balanceBefore:before.toFixed(3),balanceAfter:after.toFixed(3),note:dto.note?.trim()||null,actorId:actor.id}));return {product,transaction};});this.realtime.emitInventory('inventory.product.updated',result);return result;}
  async replaceBom(id:string,dto:ReplaceBomDto){
    await this.requireProduct(id);
    if(new Set(dto.items.map(i=>i.itemId)).size!==dto.items.length)throw new BadRequestException('Cấu thành có vật tư trùng');
    for(const line of dto.items){const item=await this.requireItem(line.itemId);if(!item.isActive)throw new BadRequestException('Vật tư trong Cấu thành đã ngưng sử dụng');}
    if(dto.components){
      if(new Set(dto.components.map(line=>line.componentProductId)).size!==dto.components.length)throw new BadRequestException('Cấu thành có thành phẩm con trùng');
      if(dto.components.some(line=>line.componentProductId===id))throw new BadRequestException('Thành phẩm không thể chứa chính nó');
      for(const line of dto.components){const component=await this.requireProduct(line.componentProductId);if(!component.isActive)throw new BadRequestException('Thành phẩm con trong Cấu thành đã ngưng sử dụng');}
      const existing=await this.componentBomItems.find();
      const graph=new Map<string,string[]>();
      for(const line of existing){if(line.productId!==id)graph.set(line.productId,[...(graph.get(line.productId)??[]),line.componentProductId]);}
      graph.set(id,dto.components.map(line=>line.componentProductId));
      const visits=new Set<string>();const active=new Set<string>();
      const hasCycle=(node:string):boolean=>{if(active.has(node))return true;if(visits.has(node))return false;visits.add(node);active.add(node);for(const child of graph.get(node)??[]){if(hasCycle(child))return true;}active.delete(node);return false;};
      if(hasCycle(id))throw new BadRequestException('Cấu thành thành phẩm tạo vòng lặp');
    }
    await this.dataSource.transaction(async manager=>{
      await manager.delete(ProductBomItem,{productId:id});
      if(dto.items.length)await manager.save(dto.items.map(line=>manager.create(ProductBomItem,{productId:id,itemId:line.itemId,quantityPerProduct:line.quantity.toFixed(3)})));
      if(dto.components){
        await manager.delete(FinishedProductComponentItem,{productId:id});
        if(dto.components.length)await manager.save(dto.components.map(line=>manager.create(FinishedProductComponentItem,{productId:id,componentProductId:line.componentProductId,quantityPerProduct:line.quantity.toFixed(3)})));
      }
    });
    this.realtime.emitInventory('inventory.product.updated',{id});return this.findProducts();
  }

  async bomAudit(){
    const [items,products,bomLines]=await Promise.all([this.items.find(),this.products.find({where:{isActive:true}}),this.bomItems.find()]);
    const activeItems=items.filter(item=>item.isActive);
    const boardProducts=BOARD_DEFINITIONS.map(board=>({board,product:products.find(product=>product.sku===board.sku)}));
    const boardProductIds=new Set(boardProducts.flatMap(({product})=>product?[product.id]:[]));
    const boardLines=bomLines.filter(line=>boardProductIds.has(line.productId));
    const assignedIds=new Set(boardLines.map(line=>line.itemId));
    const issues:Array<Record<string,unknown>>=[];

    for(const group of duplicateMaterialGroups(items))issues.push({type:'DUPLICATE_MATERIAL',itemId:group[0].id,itemName:group[0].name,message:`Có ${group.length} mã vật tư đang hoạt động cùng tên.`,duplicateItemIds:group.map(item=>item.id)});
    for(const item of unassignedBoardComponents(items,assignedIds))issues.push({type:'UNASSIGNED_COMPONENT',itemId:item.id,itemName:item.name,message:'Linh kiện board chưa được dùng trong Cấu thành của EasyScan, ScanBox hoặc KeyScan.'});

    for(const {board} of boardProducts){
      const expected=new Map(BOARD_CATALOG.filter(record=>Number(record[board.quantityField])>0).map(record=>[normalizeMaterialName(record.name),record]));
      for(const record of expected.values())if(!activeItems.some(item=>matchesCatalogMaterial(item,record)))issues.push({type:'BOM_MISSING_MATERIAL',boardKey:board.key,itemName:record.name,sourceSheet:'Kho',sourceRow:record.sourceRow,message:`Cấu thành ${board.name} có dòng chưa tìm thấy mã vật tư đang hoạt động.`});
    }
    issues.push(...SOURCE_DOUBLE_CHECKS);

    return {
      boards:boardProducts.map(({board,product})=>{
        const lines=product?boardLines.filter(line=>line.productId===product.id):[];
        return {key:board.key,sku:board.sku,name:board.name,productId:product?.id??null,configuredLines:lines.length,totalUnits:lines.reduce((sum,line)=>sum+Number(line.quantityPerProduct),0),issueCount:issues.filter(issue=>issue.boardKey===board.key).length};
      }),
      issues,
      summary:{total:issues.length,missing:issues.filter(issue=>issue.type==='BOM_MISSING_MATERIAL').length,duplicates:issues.filter(issue=>issue.type==='DUPLICATE_MATERIAL').length,unassigned:issues.filter(issue=>issue.type==='UNASSIGNED_COMPONENT').length,sourceConflicts:issues.filter(issue=>issue.type==='SOURCE_CONFLICT').length},
    };
  }

  async findSellableProducts(){const products=await this.sellableProducts.find({where:{isActive:true},order:{name:'ASC'}});const [bom,materialBom]=await Promise.all([this.sellableBomItems.find(),this.sellableMaterialItems.find()]);return products.map(product=>({...product,bom:bom.filter(line=>line.productId===product.id),materialBom:materialBom.filter(line=>line.productId===product.id)}));}
  async createSellableProduct(dto:CreateSellableProductDto,actor:AuthUser){const product=await this.sellableProducts.save(this.sellableProducts.create({name:dto.name.trim(),onHandQty:(dto.openingQuantity??0).toFixed(3),minimumStock:(dto.minimumStock??0).toFixed(3),note:dto.note?.trim()||null,isActive:true}));if((dto.openingQuantity??0)>0)await this.sellableTransactions.save(this.sellableTransactions.create({productId:product.id,type:FinishedProductTransactionType.ADJUSTMENT,quantity:dto.openingQuantity!.toFixed(3),balanceBefore:'0.000',balanceAfter:dto.openingQuantity!.toFixed(3),note:'Opening balance',actorId:actor.id}));this.realtime.emitInventory('inventory.sellable-product.updated',product);return product;}
  async updateSellableProduct(id:string,dto:UpdateSellableProductDto){const product=await this.requireSellableProduct(id);Object.assign(product,{...(dto.name!==undefined?{name:dto.name.trim()}:{}),...(dto.note!==undefined?{note:dto.note.trim()||null}:{}),...(dto.minimumStock!==undefined?{minimumStock:dto.minimumStock.toFixed(3)}:{}),...(dto.isActive!==undefined?{isActive:dto.isActive}:{})});const saved=await this.sellableProducts.save(product);this.realtime.emitInventory('inventory.sellable-product.updated',saved);return saved;}
  async removeSellableProduct(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new ForbiddenException('Chỉ Admin được xóa sản phẩm');
    const saved=await this.dataSource.transaction(async manager=>{
      const product=await manager.findOne(SellableProduct,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!product)throw new NotFoundException('Sellable product not found');
      if(!product.isActive)return product;
      if(await manager.exists(ProductionLot,{where:{outputType:ProductionOutputType.SELLABLE_PRODUCT,outputId:id,status:Not(ProductionLotStatus.DONE)}}))throw new BadRequestException('Không thể xóa: sản phẩm đang có Lô sản xuất chưa hoàn thành');
      product.isActive=false;
      return manager.save(product);
    });
    this.realtime.emitInventory('inventory.sellable-product.updated',saved);
    return saved;
  }
  async sellableProductHistory(id:string){await this.requireSellableProduct(id);return this.sellableTransactions.find({where:{productId:id},order:{createdAt:'DESC'},take:200});}
  async sellableProductMovement(id:string,dto:FinishedProductMovementDto,actor:AuthUser){const result=await this.dataSource.transaction(async manager=>{const product=await manager.findOne(SellableProduct,{where:{id},lock:{mode:'pessimistic_write'}});if(!product)throw new NotFoundException('Sellable product not found');const before=Number(product.onHandQty);const after=dto.type===FinishedProductTransactionType.ADJUSTMENT?dto.quantity:dto.type===FinishedProductTransactionType.OUT?before-dto.quantity:before+dto.quantity;if(after<0)throw new BadRequestException('Sellable product stock cannot be negative');product.onHandQty=after.toFixed(3);await manager.save(product);const quantity=dto.type===FinishedProductTransactionType.ADJUSTMENT?after-before:dto.quantity;const transaction=await manager.save(manager.create(SellableProductTransaction,{productId:id,type:dto.type,quantity:quantity.toFixed(3),balanceBefore:before.toFixed(3),balanceAfter:after.toFixed(3),note:dto.note?.trim()||null,actorId:actor.id}));return {product,transaction};});this.realtime.emitInventory('inventory.sellable-product.updated',result);return result;}
  async replaceSellableProductBom(id:string,dto:ReplaceSellableProductBomDto){await this.requireSellableProduct(id);const materials=dto.materials??[];if(new Set(dto.items.map(i=>i.finishedProductId)).size!==dto.items.length)throw new BadRequestException('Cấu thành có thành phẩm trùng');if(new Set(materials.map(i=>i.itemId)).size!==materials.length)throw new BadRequestException('Cấu thành có vật tư trùng');for(const line of dto.items){const component=await this.requireProduct(line.finishedProductId);if(!component.isActive)throw new BadRequestException('Thành phẩm trong Cấu thành đã ngưng sử dụng');}for(const line of materials){const item=await this.requireItem(line.itemId);if(!item.isActive)throw new BadRequestException('Vật tư trong Cấu thành đã ngưng sử dụng');}await this.dataSource.transaction(async manager=>{await manager.delete(SellableProductBomItem,{productId:id});await manager.delete(SellableProductMaterialItem,{productId:id});if(dto.items.length)await manager.save(dto.items.map(line=>manager.create(SellableProductBomItem,{productId:id,finishedProductId:line.finishedProductId,quantityPerProduct:line.quantity.toFixed(3)})));if(materials.length)await manager.save(materials.map(line=>manager.create(SellableProductMaterialItem,{productId:id,itemId:line.itemId,quantityPerProduct:line.quantity.toFixed(3)})));});this.realtime.emitInventory('inventory.sellable-product.updated',{id});return this.findSellableProducts();}

  async getImage(ownerType:InventoryImageOwnerType,ownerId:string){this.assertImageOwnerType(ownerType);await this.requireImageOwner(ownerType,ownerId);const image=await this.images.createQueryBuilder('image').addSelect('image.data').where('image.ownerType = :ownerType',{ownerType}).andWhere('image.ownerId = :ownerId',{ownerId}).getOne();if(!image)throw new NotFoundException('Image not found');return image;}
  async saveImage(ownerType:InventoryImageOwnerType,ownerId:string,file:{buffer:Buffer;mimetype:string;size:number},actor:AuthUser){this.assertImageOwnerType(ownerType);await this.requireImageOwner(ownerType,ownerId);validateInventoryImage(file);const saved=await this.dataSource.transaction(async manager=>{await manager.delete(InventoryImage,{ownerType,ownerId});return manager.save(manager.create(InventoryImage,{ownerType,ownerId,mimeType:file.mimetype,byteSize:file.size,data:file.buffer,uploadedById:actor.id}));});this.realtime.emitInventory('inventory.image.updated',{ownerType,ownerId});return {id:saved.id,ownerType,ownerId,mimeType:saved.mimeType,byteSize:saved.byteSize,updatedAt:saved.updatedAt};}
  async removeImage(ownerType:InventoryImageOwnerType,ownerId:string){this.assertImageOwnerType(ownerType);await this.requireImageOwner(ownerType,ownerId);await this.images.delete({ownerType,ownerId});this.realtime.emitInventory('inventory.image.updated',{ownerType,ownerId});return {ownerType,ownerId};}

  private async record(id:string,type:InventoryTransactionType,quantity:number,actor:AuthUser,note?:string,reference?:string,openingUnit?:string,openingOnly=false){
    const result=await this.dataSource.transaction(async manager=>{
      const item=await this.lockItem(manager,id);
      const before=item.onHandQty===null?null:Number(item.onHandQty);
      if(openingOnly&&before!==null)throw new BadRequestException('Opening balance already exists');
      const after=calculateBalance(type,quantity,before);
      const unit=openingUnit??item.unit;
      if(!unit)throw new BadRequestException('Unit must be normalized first');
      if(openingUnit)item.unit=openingUnit;
      item.onHandQty=after.toFixed(3);
      await manager.save(item);
      const recordedQuantity=type===InventoryTransactionType.ADJUSTMENT||type===InventoryTransactionType.STOCK_COUNT?(before===null?after:after-before):quantity;
      const transaction=await manager.save(manager.create(InventoryTransaction,{itemId:id,type,quantity:recordedQuantity.toFixed(3),balanceBefore:before===null?null:before.toFixed(3),balanceAfter:after.toFixed(3),unit,note:note?.trim()||null,reference:reference?.trim()||null,actorId:actor.id}));
      if(type===InventoryTransactionType.STOCK_COUNT){
        if(item.checkAssignedToId&&item.checkRequestedById){
          await this.systemNotifications.create(manager,{
            actor,relatedUserIds:[item.checkRequestedById],includeActor:item.checkRequestedById===actor.id,
            module:SystemNotificationModule.INVENTORY,eventType:'INVENTORY_COUNT_COMPLETED',entityType:'INVENTORY_ITEM',entityId:id,entityLabel:item.name,
            message:'đã hoàn tất kiểm tồn thực tế',bodyPreview:`Tồn thực tế: ${after} ${unit}${note?.trim()?` · ${note.trim()}`:''}`,
            dedupeKey:`inventory-count:${transaction.id}:completed`,
          });
        }
        item.lastCountedAt=new Date();item.lastCountedById=actor.id;
        item.checkRequestedAt=null;item.checkRequestedById=null;item.checkAssignedToId=null;item.checkRequestNote=null;
        await manager.save(item);
      }
      return {item,transaction};
    });
    this.realtime.emitInventory('inventory.movement.created',result);
    return result;
  }

  private async requireItem(id:string){const item=await this.items.findOneBy({id});if(!item)throw new NotFoundException('Inventory item not found');return item;}
  private async requireProduct(id:string){const product=await this.products.findOneBy({id});if(!product)throw new NotFoundException('Finished product not found');return product;}
  private async requireSellableProduct(id:string){const product=await this.sellableProducts.findOneBy({id});if(!product)throw new NotFoundException('Sellable product not found');return product;}
  private async requireStockCountSheet(id:string){const sheet=await this.stockCountSheets.findOneBy({id});if(!sheet)throw new NotFoundException('Không tìm thấy phiếu kiểm kho');return sheet;}
  private assertCanEditStockCountSheet(sheet:StockCountSheet,actor:AuthUser){if(sheet.status!==StockCountSheetStatus.DRAFT)throw new BadRequestException('Chỉ sửa được phiếu Chờ kiểm');if(actor.role!==UserRole.ADMIN&&sheet.assigneeId!==actor.id)throw new ForbiddenException('Bạn không phải người phụ trách phiếu này');}
  private vietnamDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  private assertImageOwnerType(ownerType:InventoryImageOwnerType){if(!Object.values(InventoryImageOwnerType).includes(ownerType))throw new BadRequestException('Invalid image owner type');}
  private async requireImageOwner(ownerType:InventoryImageOwnerType,ownerId:string){if(ownerType===InventoryImageOwnerType.MATERIAL)return this.requireItem(ownerId);if(ownerType===InventoryImageOwnerType.FINISHED_PRODUCT)return this.requireProduct(ownerId);return this.requireSellableProduct(ownerId);}
  private async lockItem(manager:EntityManager,id:string){const item=await manager.findOne(InventoryItem,{where:{id},lock:{mode:'pessimistic_write'}});if(!item)throw new NotFoundException('Inventory item not found');return item;}
}

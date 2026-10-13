import { BadRequestException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Between, DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { FinishedProduct, FinishedProductCategory } from '../inventory/finished-product.entity';
import { FinishedProductTransaction, FinishedProductTransactionType } from '../inventory/finished-product-transaction.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryTransaction, InventoryTransactionType } from '../inventory/inventory-transaction.entity';
import { ProductBomItem } from '../inventory/product-bom-item.entity';
import { FinishedProductComponentItem } from '../inventory/finished-product-component-item.entity';
import { SellableProduct } from '../inventory/sellable-product.entity';
import { SellableProductBomItem } from '../inventory/sellable-product-bom-item.entity';
import { SellableProductTransaction } from '../inventory/sellable-product-transaction.entity';
import { SellableProductMaterialItem } from '../inventory/sellable-product-material-item.entity';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { User } from '../users/user.entity';
import { CreateProductionEntryDto, CreateProductionRunDto, FinishProductionDto, ProductionLotQuantityDto, ProductionTestResultDto, UpdateProductionLotDto, UpdateProductionLotNoteDto, UpsertWorkSessionDto } from './production.dto';
import { ProductionEntry, ProductionOutputType } from './production-entry.entity';
import { ProductionEntryLot } from './production-entry-lot.entity';
import { ProductionLotAssignee } from './production-lot-assignee.entity';
import { ProductionLot, ProductionLotActionType, ProductionLotStatus } from './production-lot.entity';
import { ProductionLotEvent, ProductionLotEventType } from './production-lot-event.entity';
import { ProductionRun } from './production-run.entity';
import { ProductionWorkSession } from './production-work-session.entity';
import { ProductionPaymentRequest, ProductionPaymentStatus } from './production-payment-request.entity';
import { missingRegistrationTime, nextPaymentBatch } from './production.policy';
import { UserRole } from '../users/user.entity';
import { ProductionNotification } from './production-notification.entity';
import { SystemNotificationModule } from '../notifications/system-notification.entity';
import { SystemNotificationsService } from '../notifications/system-notifications.service';
import { evaluateProductivity, ProductivityObservation } from './production-productivity.policy';
import { DeviceTestStation } from '../device-test/device-test-station.entity';
import { DeviceTestResult, ProductionLotDeviceTest } from '../device-test/production-lot-device-test.entity';

type LotImpactLine={kind:'MATERIAL'|'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';id:string;label:string;before:number;change:number;after:number};
type LotImpact={inventoryChanged:boolean;output:LotImpactLine;components:LotImpactLine[];warnings:string[]};

@Injectable()
export class ProductionService {
  constructor(
    private readonly dataSource:DataSource,
    @InjectRepository(ProductionWorkSession) private readonly sessions:Repository<ProductionWorkSession>,
    @InjectRepository(ProductionEntry) private readonly entries:Repository<ProductionEntry>,
    @InjectRepository(ProductionRun) private readonly runs:Repository<ProductionRun>,
    @InjectRepository(ProductionLot) private readonly lots:Repository<ProductionLot>,
    @InjectRepository(ProductionLotAssignee) private readonly lotAssignees:Repository<ProductionLotAssignee>,
    @InjectRepository(ProductionEntryLot) private readonly entryLots:Repository<ProductionEntryLot>,
    @InjectRepository(ProductionLotEvent) private readonly lotEvents:Repository<ProductionLotEvent>,
    @InjectRepository(ProductionPaymentRequest) private readonly payments:Repository<ProductionPaymentRequest>,
    @InjectRepository(ProductionNotification) private readonly notifications:Repository<ProductionNotification>,
    @InjectRepository(User) private readonly users:Repository<User>,
    @InjectRepository(FinishedProduct) private readonly finished:Repository<FinishedProduct>,
    @InjectRepository(SellableProduct) private readonly sellable:Repository<SellableProduct>,
    @InjectRepository(ProductionLotDeviceTest) private readonly deviceTestResults:Repository<ProductionLotDeviceTest>,
    private readonly realtime:RealtimeGateway,
    private readonly systemNotifications:SystemNotificationsService,
  ){}

  private normalized(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
  private isProductionOperator(actor:AuthUser){return actor.role===UserRole.ADMIN||['giang','my','nam','quangbk','thanhbk','phongbk','minhbk','locbk'].includes(this.normalized(actor.username))||['giang','my','nam','quang bk','thanh bk','phong bk','minh bk','loc bk'].includes(this.normalized(actor.displayName));}
  private assertProductionOperator(actor:AuthUser){if(!this.isProductionOperator(actor))throw new BadRequestException('Chỉ đội Sản xuất và Admin được thao tác Lô');}
  private async assertCanCompleteLot(manager:EntityManager,lotId:string,actor:AuthUser){
    if(actor.role===UserRole.ADMIN)return;
    if(!this.isProductionOperator(actor))throw new BadRequestException('Chỉ đội Sản xuất và Admin được DONE Lô');
    const incharge=await manager.exists(ProductionLotAssignee,{where:{lotId,userId:actor.id}});
    if(!incharge)throw new BadRequestException('Chỉ thành viên đang Incharge Lô này được DONE');
  }

  private async assignedActiveLotIds(manager:EntityManager,userId:string){
    const assignments=await manager.findBy(ProductionLotAssignee,{userId});
    if(!assignments.length)return [];
    const lots=await manager.findBy(ProductionLot,{id:In(assignments.map(row=>row.lotId)),status:Not(ProductionLotStatus.DONE)});
    return lots.map(lot=>lot.id);
  }

  private async reportLotIds(manager:EntityManager,dto:CreateProductionEntryDto,userId:string,legacyLotIds:string[]=[]){
    const assigned=await this.assignedActiveLotIds(manager,userId);
    if(!dto.reportItems?.length)return [...new Set([...legacyLotIds,...assigned])];
    const requested=[...new Set(dto.reportItems.map(item=>item.lotId))];
    if(requested.some(id=>!assigned.includes(id)))throw new BadRequestException('Chỉ được báo công cho Worklog Sản xuất đang tham gia');
    return requested;
  }

  private dateKey(value:string|Date){
    if(typeof value==='string')return value.slice(0,10);
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
    const part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(item=>item.type===type)?.value??'';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private async recordWorkedMinutes(userId:string,at:Date,minutes:number,actor:AuthUser){
    if(minutes<=0)return;
    const workDate=this.dateKey(at);const session=await this.sessions.findOneBy({userId,workDate});
    if(!session?.isRegistered)return;
    session.hoursWorked=(Number(session.hoursWorked??0)+minutes/60).toFixed(2);session.updatedById=actor.id;await this.sessions.save(session);await this.ensurePaymentRequest(userId);
  }

  private range(from?:string,to?:string){
    const end=to??new Date().toISOString().slice(0,10);const start=from??new Date(Date.now()-30*86400000).toISOString().slice(0,10);
    if(start>end)throw new BadRequestException('Khoảng ngày không hợp lệ');return {start,end};
  }

  async overview(from:string|undefined,to:string|undefined,actor:AuthUser){
    const {start,end}=this.range(from,to);
    const [sessions,entries,paymentRequests]=await Promise.all([
      this.sessions.find({where:{workDate:Between(start,end)},order:{workDate:'DESC',createdAt:'ASC'}}),
      this.entries.find({where:{workDate:Between(start,end)},order:{workDate:'DESC',createdAt:'DESC'}}),
      this.payments.find({order:{createdAt:'DESC'}}),
    ]);
    const settledIds=new Set(paymentRequests.flatMap(payment=>payment.sessionIds));
    const sessionViews=sessions.map(row=>({...row,workDate:this.dateKey(row.workDate),registrationTimeMissing:missingRegistrationTime({...row,workDate:this.dateKey(row.workDate)},settledIds.has(row.id))}));
    const summary=new Map<string,{userId:string;hours:number;sessions:number;entries:number;outputs:Record<string,number>}>();
    for(const row of sessionViews){const value=summary.get(row.userId)??{userId:row.userId,hours:0,sessions:0,entries:0,outputs:{}};if(!row.registrationTimeMissing){value.hours+=Number(row.hoursWorked??0);if(row.isRegistered&&row.hoursWorked!==null)value.sessions+=1;}summary.set(row.userId,value);}
    for(const row of entries){const value=summary.get(row.userId)??{userId:row.userId,hours:0,sessions:0,entries:0,outputs:{}};value.entries+=1;if(row.quantity!==null&&Number(row.progressPercent??100)>=100)value.outputs[row.outputLabel]=(value.outputs[row.outputLabel]??0)+row.quantity;summary.set(row.userId,value);}
    const productivityWarnings=actor.role===UserRole.ADMIN?await this.productivityWarnings(start,end):[];
    return {from:start,to:end,sessions:sessionViews,entries:entries.map(row=>({...row,workDate:this.dateKey(row.workDate)})),paymentRequests,summary:[...summary.values()],productivityWarnings};
  }

  private async productivityWarnings(start:string,end:string){
    const historicalEntries=await this.entries.createQueryBuilder('entry').where('entry."workDate" <= :end',{end}).andWhere("jsonb_array_length(entry.\"reportItems\") > 0").orderBy('entry."workDate"','DESC').addOrderBy('entry."createdAt"','DESC').take(1000).getMany();
    if(!historicalEntries.length)return [];
    const userIds=[...new Set(historicalEntries.map(entry=>entry.userId))];
    const sessions=await this.sessions.find({where:{userId:In(userIds)}});const sessionMap=new Map(sessions.map(session=>[`${session.userId}:${this.dateKey(session.workDate)}`,Number(session.hoursWorked??0)]));
    const lotIds=[...new Set(historicalEntries.flatMap(entry=>(entry.reportItems??[]).map(item=>item.lotId)))];
    const lots=lotIds.length?await this.lots.findBy({id:In(lotIds)}):[];
    const observations:ProductivityObservation[]=historicalEntries.map(entry=>({entryId:entry.id,userId:entry.userId,workDate:this.dateKey(entry.workDate),hours:sessionMap.get(`${entry.userId}:${this.dateKey(entry.workDate)}`)??0,items:entry.reportItems??[]}));
    return evaluateProductivity(observations,lots.map(lot=>({id:lot.id,outputType:lot.outputType,outputId:lot.outputId,outputLabel:lot.outputLabel})),start,end);
  }

  private async assertUnlocked(userId:string,workDate:string,actor:AuthUser){
    if(actor.role===UserRole.ADMIN)return;
    const session=await this.sessions.findOneBy({userId,workDate});
    if(!session)return;
    const locked=await this.payments.createQueryBuilder('payment').where(':id = ANY(payment."sessionIds")',{id:session.id}).getExists();
    if(locked)throw new BadRequestException('Buổi này đã kết công, không thể sửa');
  }

  private async ensurePaymentRequest(userId:string){
    const [sessions,entries,payments]=await Promise.all([
      this.sessions.find({where:{userId,isRegistered:true},order:{workDate:'ASC'}}),
      this.entries.find({where:{userId},order:{workDate:'ASC'}}),
      this.payments.find({where:{userId}}),
    ]);
    const isDailyReport=(entry:ProductionEntry)=>Boolean(entry.rawText?.trim())&&(entry.workType==='Báo cáo tự do'||entry.workType==='Báo cáo theo Worklog');
    const reportDates=new Set(entries.filter(isDailyReport).map(entry=>this.dateKey(entry.workDate)));
    const valid=sessions.filter(session=>!missingRegistrationTime({...session,workDate:this.dateKey(session.workDate)})&&session.hoursWorked!==null&&Number(session.hoursWorked)>0&&reportDates.has(this.dateKey(session.workDate))).map(session=>({...session,workDate:this.dateKey(session.workDate)}));
    const consumed=new Set(payments.flatMap(payment=>payment.sessionIds));
    const batch=nextPaymentBatch(valid,consumed);
    if(!batch.length)return null;
    const batchKey=`${userId}:${batch.map(row=>row.id).join(':')}`;
    const workSummary=batch.map(session=>({date:session.workDate,outputs:entries.filter(entry=>this.dateKey(entry.workDate)===session.workDate&&isDailyReport(entry)).map(entry=>({label:entry.rawText?.trim()||entry.outputLabel,quantity:entry.quantity}))}));
    const row=this.payments.create({batchKey,userId,sessionIds:batch.map(item=>item.id),totalHours:batch.reduce((sum,item)=>sum+Number(item.hoursWorked??0),0).toFixed(2),workSummary,status:ProductionPaymentStatus.REQUESTED,paidById:null,paidAt:null});
    let saved:ProductionPaymentRequest|null=null;
    try{saved=await this.payments.save(row);}catch(error){if(await this.payments.exist({where:{batchKey}}))return this.payments.findOneBy({batchKey});throw error;}
    await this.createPaymentNotifications(saved);
    return saved;
  }

  private async createPaymentNotifications(payment:ProductionPaymentRequest){
    const admins=await this.users.find({where:{role:UserRole.ADMIN,isActive:true}});
    const recipientIds=[...new Set([...admins.map(admin=>admin.id),payment.userId])];
    if(!recipientIds.length)return;
    await this.notifications.createQueryBuilder().insert().values(recipientIds.map(recipientId=>({recipientId,paymentRequestId:payment.id,readAt:null}))).orIgnore().execute();
  }

  async findNotifications(actor:AuthUser){
    const notifications=await this.notifications.find({where:{recipientId:actor.id},relations:{paymentRequest:true},order:{createdAt:'DESC'}});
    const userIds=[...new Set(notifications.map(notification=>notification.paymentRequest.userId))];
    const users=userIds.length?await this.users.findBy({id:In(userIds)}):[];
    const names=new Map(users.map(user=>[user.id,user.displayName]));
    return notifications.map(notification=>this.notificationView(notification,names.get(notification.paymentRequest.userId)??'Thành viên'));
  }

  async readNotification(id:string,actor:AuthUser){
    const notification=await this.notifications.findOne({where:{id,recipientId:actor.id},relations:{paymentRequest:true}});
    if(!notification)throw new NotFoundException();
    if(!notification.readAt){notification.readAt=new Date();await this.notifications.save(notification);}
    const member=await this.users.findOneBy({id:notification.paymentRequest.userId});
    return this.notificationView(notification,member?.displayName??'Thành viên');
  }

  async readAllNotifications(actor:AuthUser){
    const readAt=new Date();
    await this.notifications.update({recipientId:actor.id,readAt:IsNull()},{readAt});
    return {readAt};
  }

  private notificationView(notification:ProductionNotification,memberName:string){
    return {kind:'PRODUCTION_PAYMENT_READY' as const,id:notification.id,paymentRequestId:notification.paymentRequestId,memberName,totalHours:notification.paymentRequest.totalHours,sessionDates:notification.paymentRequest.workSummary.map(item=>item.date),readAt:notification.readAt,createdAt:notification.createdAt};
  }

  async upsertSession(dto:UpsertWorkSessionDto,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN&&dto.userId!==actor.id)throw new BadRequestException('Chỉ được đăng ký và báo cáo cho chính mình');
    await this.assertUnlocked(dto.userId,dto.workDate,actor);
    if(!await this.users.exist({where:{id:dto.userId,isActive:true}}))throw new NotFoundException('Không tìm thấy thành viên');
    let row=await this.sessions.findOneBy({userId:dto.userId,workDate:dto.workDate});
    const plannedStartTime=dto.isRegistered?(dto.plannedStartTime===undefined?row?.plannedStartTime??null:dto.plannedStartTime):null;
    if(dto.isRegistered&&(!row?.isRegistered||dto.plannedStartTime!==undefined)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedStartTime??''))throw new BadRequestException('Chọn giờ bắt đầu dự kiến trước khi đăng ký');
    row=this.sessions.create({...row,userId:dto.userId,workDate:dto.workDate,isRegistered:dto.isRegistered,plannedStartTime,hoursWorked:dto.hoursWorked===undefined?row?.hoursWorked??null:dto.hoursWorked===null?null:dto.hoursWorked.toFixed(2),updatedById:actor.id});
    const saved=await this.sessions.save(row);await this.ensurePaymentRequest(dto.userId);this.realtime.emitInventory('production.updated',saved);return saved;
  }

  async createRun(dto:CreateProductionRunDto,actor:AuthUser){
    this.assertProductionOperator(actor);
    const saved=await this.dataSource.transaction(async manager=>{
      const run=await manager.save(manager.create(ProductionRun,{createdById:actor.id}));
      const lots:ProductionLot[]=[];
      for(const input of dto.lots){
        if(input.outputType===ProductionOutputType.LABEL)throw new BadRequestException('Lô phải tạo Thành phẩm hoặc Sản phẩm');
        if(input.actionType===ProductionLotActionType.PACK&&input.outputType!==ProductionOutputType.SELLABLE_PRODUCT)throw new BadRequestException('Đóng bộ máy phải chọn Sản phẩm');
        if(input.actionType!==ProductionLotActionType.PACK&&input.outputType!==ProductionOutputType.FINISHED_PRODUCT)throw new BadRequestException('Lắp, Hàn hoặc Test phải chọn Thành phẩm');
        const output=input.outputType===ProductionOutputType.FINISHED_PRODUCT
          ?await manager.findOneBy(FinishedProduct,{id:input.outputId,isActive:true})
          :await manager.findOneBy(SellableProduct,{id:input.outputId,isActive:true});
        if(!output)throw new BadRequestException('Đầu ra của Lô không hợp lệ');
        if(input.outputType===ProductionOutputType.FINISHED_PRODUCT){
          const finishedOutput=output as FinishedProduct;
          if(input.actionType===ProductionLotActionType.SOLDER){
            if(finishedOutput.category!==FinishedProductCategory.PCB)throw new BadRequestException('Hàn mạch phải chọn board thuộc nhóm PCB');
          }else if(!finishedOutput.isProductionOutput)throw new BadRequestException('Thành phẩm này không phải đầu ra của đội Sản xuất');
          if([ProductionLotActionType.ASSEMBLE,ProductionLotActionType.SOLDER].includes(input.actionType)&&!finishedOutput.productionReady)throw new BadRequestException('Thành phẩm chưa đủ cấu hình để sản xuất');
        }
        const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()).replaceAll('-','');
        const prefix=input.actionType===ProductionLotActionType.SOLDER?'HM':'SX';
        const lot=await manager.save(manager.create(ProductionLot,{runId:run.id,code:`${prefix}-${date}-${randomUUID().slice(0,6).toUpperCase()}`,actionType:input.actionType,outputType:input.outputType,outputId:input.outputId,outputLabel:output.name,targetQuantity:input.targetQuantity,status:ProductionLotStatus.NEW,completedQuantity:null,note:null,createdById:actor.id,completedById:null,completedAt:null,testedById:null,testedAt:null}));
        await manager.save(manager.create(ProductionLotEvent,{lotId:lot.id,type:ProductionLotEventType.CREATED,actorId:actor.id,payload:{targetQuantity:lot.targetQuantity,actionType:lot.actionType,outputType:lot.outputType,outputId:lot.outputId,outputLabel:lot.outputLabel}}));
        lots.push(lot);
      }
      return {run,lots};
    });
    this.realtime.emitInventory('production.updated',saved);
    return saved;
  }

  async findLots(includeDone=false){
    const lots=await this.lots.find({where:includeDone?{}:{status:Not(ProductionLotStatus.DONE)},order:{createdAt:'DESC'},take:200});
    if(!lots.length)return [];
    const lotIds=lots.map(lot=>lot.id);
    const [links,assignments,deviceTestCounts]=await Promise.all([
      this.entryLots.findBy({lotId:In(lotIds)}),this.lotAssignees.findBy({lotId:In(lotIds)}),
      this.deviceTestResults.createQueryBuilder('result').select('result.lotId','lotId').addSelect(`COUNT(*) FILTER (WHERE result.result = '${DeviceTestResult.PASS}')`,'passCount').addSelect(`COUNT(*) FILTER (WHERE result.result = '${DeviceTestResult.FAIL}')`,'failCount').where('result.lotId IN (:...lotIds)',{lotIds}).groupBy('result.lotId').getRawMany<{lotId:string;passCount:string;failCount:string}>(),
    ]);
    const entryIds=[...new Set(links.map(link=>link.entryId))];
    const entries=entryIds.length?await this.entries.findBy({id:In(entryIds)}):[];
    const userIds=[...new Set([...entries.map(entry=>entry.userId),...assignments.map(row=>row.userId)])];
    const users=userIds.length?await this.users.findBy({id:In(userIds)}):[];
    const events=await this.lotEvents.find({where:{lotId:In(lotIds)},order:{createdAt:'DESC'}});
    const userMap=new Map(users.map(user=>[user.id,user]));
    const entryMap=new Map(entries.map(entry=>[entry.id,entry]));
    const deviceTestCountMap=new Map(deviceTestCounts.map(row=>[row.lotId,{passCount:Number(row.passCount),failCount:Number(row.failCount)}]));
    return lots.map(lot=>{
      const reportEntries=links.filter(link=>link.lotId===lot.id).map(link=>entryMap.get(link.entryId)).filter((entry):entry is ProductionEntry=>Boolean(entry));
      const participantIds=[...new Set(assignments.filter(row=>row.lotId===lot.id).map(row=>row.userId))];
      const lotEventRows=events.filter(event=>event.lotId===lot.id);const doneEvent=lot.status===ProductionLotStatus.DONE?lotEventRows.find(event=>event.type===ProductionLotEventType.DONE):undefined;const syncWarnings=((doneEvent?.payload as {impact?:LotImpact}|null)?.impact?.warnings??[]);
      const deviceTestProgress=deviceTestCountMap.get(lot.id)??{passCount:0,failCount:0};
      return {...lot,deviceTestPassCount:deviceTestProgress.passCount,deviceTestFailCount:deviceTestProgress.failCount,deviceTestRemainingCount:Math.max(0,Number(lot.deviceTestTargetPassCount??lot.producedQuantity??lot.targetQuantity)-deviceTestProgress.passCount),syncWarnings,participants:participantIds.map(id=>userMap.get(id)).filter(Boolean).map(user=>({id:user!.id,username:user!.username,displayName:user!.displayName})),reports:reportEntries.map(entry=>({id:entry.id,userId:entry.userId,workDate:this.dateKey(entry.workDate),rawText:entry.rawText,reportItems:entry.reportItems??[],createdAt:entry.createdAt})),events:lotEventRows};
    });
  }

  async claimLot(id:string,actor:AuthUser){
    this.assertProductionOperator(actor);
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!lot)throw new NotFoundException('Không tìm thấy Lô');
      if(![ProductionLotStatus.NEW,ProductionLotStatus.IN_PROGRESS].includes(lot.status))throw new BadRequestException('Worklog không còn ở trạng thái sản xuất');
      const exists=await manager.exists(ProductionLotAssignee,{where:{lotId:id,userId:actor.id}});
      if(!exists){
        await manager.save(manager.create(ProductionLotAssignee,{lotId:id,userId:actor.id}));
        await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.CLAIMED,actorId:actor.id,payload:{userId:actor.id}}));
      }
      lot.status=ProductionLotStatus.IN_PROGRESS;lot.activeById=null;lot.activeStartedAt=null;await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.STARTED,actorId:actor.id,payload:{source:'WORKLOG_CREATED'}}));
      return lot;
    });
    this.realtime.emitInventory('production.updated',result);return result;
  }

  async pauseLot(id:string,actor:AuthUser){
    this.assertProductionOperator(actor);
    let workedMinutes=0;let workedAt=new Date();
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Worklog');
      if(lot.activeById!==actor.id&&actor.role!==UserRole.ADMIN)throw new BadRequestException('Chỉ người đang làm được tạm dừng');
      if(!lot.activeStartedAt)return lot;
      workedAt=lot.activeStartedAt;const minutes=Math.max(0,Math.round((Date.now()-lot.activeStartedAt.getTime())/60000));workedMinutes=minutes;lot.accumulatedMinutes+=minutes;lot.activeById=null;lot.activeStartedAt=null;await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.PAUSED,actorId:actor.id,payload:{minutes,reason:'MANUAL'}}));return lot;
    });
    await this.recordWorkedMinutes(actor.id,workedAt,workedMinutes,actor);
    this.realtime.emitInventory('production.updated',result);return result;
  }

  async finishProduction(id:string,dto:FinishProductionDto,actor:AuthUser){
    this.assertProductionOperator(actor);
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Worklog');
      if(lot.status!==ProductionLotStatus.IN_PROGRESS)throw new BadRequestException('Worklog chưa ở trạng thái đang làm');
      if(actor.role!==UserRole.ADMIN&&!await manager.exists(ProductionLotAssignee,{where:{lotId:id,userId:actor.id}}))throw new BadRequestException('Chỉ người đang làm được hoàn thành sản xuất');
      lot.activeById=null;lot.activeStartedAt=null;lot.workStartedAt=null;lot.workEndedAt=null;lot.accumulatedMinutes=0;lot.producedQuantity=dto.quantity;lot.status=ProductionLotStatus.WAITING_TEST;await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.PRODUCTION_FINISHED,actorId:actor.id,payload:{quantity:dto.quantity,source:'MEMBER_CONFIRMATION'}}));return lot;
    });
    this.realtime.emitInventory('production.updated',result);return result;
  }

  async updateLot(id:string,dto:UpdateProductionLotDto,actor:AuthUser){
    this.assertProductionOperator(actor);
    if(dto.testProfileKey!==undefined||dto.testProfileVersion!==undefined)throw new GoneException({code:'DEVICE_TEST_RETIRED',message:'Không còn cấu hình Test Cloud/ESP32.'});
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!lot)throw new NotFoundException('Không tìm thấy Worklog');
      const isAdmin=actor.role===UserRole.ADMIN;
      const isParticipant=await manager.exists(ProductionLotAssignee,{where:{lotId:id,userId:actor.id}});
      if(!isAdmin&&!isParticipant)throw new BadRequestException('Chỉ người phụ trách hoặc Admin được sửa Worklog');
      if(lot.status===ProductionLotStatus.DONE&&!isAdmin)throw new BadRequestException('Worklog đã hoàn thành');
      if(dto.status===ProductionLotStatus.DONE)throw new BadRequestException('Hoàn thành phải được chốt bằng kết quả Test');
      if(!isAdmin&&dto.status&&dto.status!==lot.status&&![ProductionLotStatus.IN_PROGRESS,ProductionLotStatus.WAITING_TEST].includes(dto.status))throw new BadRequestException('Thành viên chỉ được cập nhật tới Chờ Test');
      if(dto.status===ProductionLotStatus.WAITING_TEST&&Number(dto.producedQuantity??lot.producedQuantity??0)<1)throw new BadRequestException('Cần nhập số lượng đã làm trước khi gửi Test');
      if(dto.status===ProductionLotStatus.TESTING&&lot.status!==ProductionLotStatus.TESTING)throw new BadRequestException('Hãy dùng Nhận Test');
      if(lot.testProfileKey&&dto.status&&dto.status!==lot.status)throw new BadRequestException('Lô ESP32 cũ chưa chuyển đổi; cần chạy migration ngừng Test Cloud');
      if(lot.status===ProductionLotStatus.TESTING&&dto.status&&dto.status!==lot.status)throw new BadRequestException('Lô đang Test; hãy chốt bằng kết quả Test');
      if((lot.testProfileKey||lot.status===ProductionLotStatus.TESTING)&&(
        (dto.targetQuantity!==undefined&&Number(dto.targetQuantity)!==Number(lot.targetQuantity))||
        (dto.producedQuantity!==undefined&&Number(dto.producedQuantity)!==Number(lot.producedQuantity))
      ))throw new BadRequestException('Lô đang Test; không đổi số lượng');
      const nextTarget=dto.targetQuantity??lot.targetQuantity;
      const nextProduced=dto.producedQuantity??lot.producedQuantity;
      if(nextTarget<Number(nextProduced??0))throw new BadRequestException('Mục tiêu không được nhỏ hơn số lượng đã làm');
      const before={targetQuantity:lot.targetQuantity,producedQuantity:lot.producedQuantity,note:lot.note,status:lot.status,testProfileKey:lot.testProfileKey,testProfileVersion:lot.testProfileVersion};
      lot.targetQuantity=nextTarget;lot.producedQuantity=nextProduced;
      if(dto.note!==undefined)lot.note=dto.note.trim()||null;
      const statusBefore=lot.status;
      if(dto.status&&dto.status!==lot.status){
        if(dto.status===ProductionLotStatus.WAITING_TEST){lot.activeById=null;lot.activeStartedAt=null;}
        if(dto.status===ProductionLotStatus.TESTING){lot.testClaimedById=actor.id;lot.testClaimedAt=new Date();}
        lot.status=dto.status;
      }
      await manager.save(lot);
      if(statusBefore!==lot.status&&lot.status===ProductionLotStatus.IN_PROGRESS)await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.STARTED,actorId:actor.id,payload:{source:'STATUS_DROPDOWN',from:statusBefore,to:lot.status}}));
      if(statusBefore!==lot.status&&lot.status===ProductionLotStatus.WAITING_TEST)await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.PRODUCTION_FINISHED,actorId:actor.id,payload:{quantity:lot.producedQuantity,source:'STATUS_DROPDOWN',from:statusBefore,to:lot.status}}));
      if(statusBefore!==lot.status&&lot.status===ProductionLotStatus.TESTING)await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.TEST_CLAIMED,actorId:actor.id,payload:{source:'STATUS_DROPDOWN',from:statusBefore,to:lot.status}}));
      if(dto.participantIds!==undefined){
        if(!isAdmin)throw new BadRequestException('Chỉ Admin được thay đổi danh sách người làm');
        const participantIds=[...new Set(dto.participantIds)];
        if(participantIds.length){const validCount=await manager.count(User,{where:{id:In(participantIds)}});if(validCount!==participantIds.length)throw new BadRequestException('Danh sách người làm không hợp lệ');}
        const oldRows=await manager.findBy(ProductionLotAssignee,{lotId:id});
        await manager.delete(ProductionLotAssignee,{lotId:id});
        if(participantIds.length)await manager.save(participantIds.map(userId=>manager.create(ProductionLotAssignee,{lotId:id,userId})));
        await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.NOTE_UPDATED,actorId:actor.id,payload:{action:'ASSIGNEES_UPDATED',before:oldRows.map(row=>row.userId),after:participantIds}}));
      }
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.NOTE_UPDATED,actorId:actor.id,payload:{action:'WORKLOG_EDITED',before,after:{targetQuantity:lot.targetQuantity,producedQuantity:lot.producedQuantity,note:lot.note,status:lot.status,testProfileKey:lot.testProfileKey,testProfileVersion:lot.testProfileVersion}}}));
      if(dto.comment?.trim())await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.NOTE_UPDATED,actorId:actor.id,payload:{action:'COMMENT',text:dto.comment.trim()}}));
      return lot;
    });
    this.realtime.emitInventory('production.updated',result);return result;
  }

  async claimTest(id:string,actor:AuthUser){
    this.assertProductionOperator(actor);
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Worklog');
      if(lot.testProfileKey)throw new BadRequestException('Lô ESP32 cũ chưa chuyển đổi; cần chạy migration ngừng Test Cloud');
      if(lot.status!==ProductionLotStatus.WAITING_TEST)throw new BadRequestException('Worklog chưa chờ Test');
      if(Number(lot.producedQuantity??0)<1)throw new BadRequestException('Cần nhập số lượng đã làm trước khi nhận Test');
      lot.status=ProductionLotStatus.TESTING;lot.testClaimedById=actor.id;lot.testClaimedAt=new Date();await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.TEST_CLAIMED,actorId:actor.id,payload:{source:'WEB',testMethod:'STANDALONE',claimedAt:lot.testClaimedAt.toISOString()}}));return lot;
    });
    this.realtime.emitInventory('production.updated',result);return result;
  }

  async publishDeviceTest(_id:string,actor:AuthUser){
    this.assertProductionOperator(actor);
    throw new GoneException({code:'DEVICE_TEST_RETIRED',message:'Test Cloud/ESP32 đã ngừng. Hãy dùng Nhận Test và nhập kết quả.'});
  }

  async completeTest(id:string,dto:ProductionTestResultDto,actor:AuthUser){
    this.assertProductionOperator(actor);
    if(dto.passedQuantity+dto.failedQuantity!==dto.testedQuantity)throw new BadRequestException('Số đạt + lỗi phải bằng số đã Test');
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Worklog');
      if(lot.testProfileKey)throw new BadRequestException('Lô ESP32 cũ chưa chuyển đổi; cần chạy migration ngừng Test Cloud');
      if(lot.status!==ProductionLotStatus.TESTING)throw new BadRequestException('Worklog chưa được nhận Test');
      if(actor.role!==UserRole.ADMIN&&lot.testClaimedById!==actor.id)throw new BadRequestException('Chỉ người nhận Test được chốt kết quả');
      if(dto.testedQuantity>Number(lot.producedQuantity??lot.targetQuantity))throw new BadRequestException('Số Test vượt số lượng đã sản xuất');
      return this.finalizeTestLot(manager,lot,dto.passedQuantity,dto.failedQuantity,actor.id,{source:'WEB',testMethod:'STANDALONE',testedById:actor.id,completedById:actor.id,note:dto.note??null,testedQuantity:dto.testedQuantity});
    });
    const testLot=result.lot;const testMinutes=testLot.testClaimedAt?Math.max(0,Math.round((testLot.testedAt!.getTime()-testLot.testClaimedAt.getTime())/60000)):0;await this.recordWorkedMinutes(actor.id,testLot.testClaimedAt??testLot.testedAt!,testMinutes,actor);
    this.realtime.emitInventory('production.updated',result);this.realtime.emitInventory('inventory.product.updated',result);this.realtime.emitInventory('inventory.sellable-product.updated',result);return result;
  }

  async finalizeDeviceTestLot(manager:EntityManager,lot:ProductionLot,passedQuantity:number,failedQuantity:number,station:DeviceTestStation){
    return this.finalizeTestLot(manager,lot,passedQuantity,failedQuantity,lot.createdById,{source:'DEVICE_TEST',testedById:null,completedById:null,stationId:station.id,stationCode:station.stationCode,testedQuantity:passedQuantity+failedQuantity});
  }

  private async finalizeTestLot(manager:EntityManager,lot:ProductionLot,passedQuantity:number,failedQuantity:number,actorId:string,metadata:Record<string,unknown>&{testedById:string|null;completedById:string|null}){
    if(lot.status===ProductionLotStatus.DONE)throw new BadRequestException('Lô đã DONE, không thể nhập kho lần hai');
    const impact=await this.buildLotImpact(manager,lot,passedQuantity,true);const reference=`production-worklog:${lot.id}:test:${randomUUID()}`;const note=`TEST ${lot.code} · ${lot.outputLabel}${metadata.note?` · ${metadata.note}`:''}`;
    if(impact.inventoryChanged&&passedQuantity>0)await this.applyLotImpact(manager,impact,{id:actorId} as AuthUser,reference,note);
    lot.status=ProductionLotStatus.DONE;lot.completedQuantity=passedQuantity;lot.failedQuantity=failedQuantity;lot.completedById=metadata.completedById;lot.completedAt=new Date();lot.testedById=metadata.testedById;lot.testedAt=lot.completedAt;await manager.save(lot);
    await manager.save(manager.create(ProductionLotEvent,{lotId:lot.id,type:ProductionLotEventType.TESTED,actorId,payload:{...metadata,passedQuantity,failedQuantity,reference,impact}}));
    await manager.save(manager.create(ProductionLotEvent,{lotId:lot.id,type:ProductionLotEventType.DONE,actorId,payload:{source:metadata.source,stationId:metadata.stationId??null,quantity:passedQuantity,reference,impact}}));return {lot,impact};
  }

  async testLot(id:string,actor:AuthUser){
    this.assertProductionOperator(actor);
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!lot)throw new NotFoundException('Không tìm thấy Lô');
      if(lot.status===ProductionLotStatus.DONE)throw new BadRequestException('Lô đã DONE');
      if(actor.role!==UserRole.ADMIN&&!await manager.exists(ProductionLotAssignee,{where:{lotId:id,userId:actor.id}}))throw new BadRequestException('Chỉ thành viên đang Incharge Lô này được xác nhận TEST');
      lot.testedById=actor.id;lot.testedAt=new Date();await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.TESTED,actorId:actor.id,payload:{testedAt:lot.testedAt.toISOString()}}));
      return lot;
    });
    this.realtime.emitInventory('production.updated',result);return result;
  }

  async updateLotNote(id:string,dto:UpdateProductionLotNoteDto,actor:AuthUser){
    this.assertProductionOperator(actor);
    const lot=await this.lots.findOneBy({id});if(!lot)throw new NotFoundException('Không tìm thấy Lô');
    const before=lot.note;lot.note=dto.note.trim()||null;
    const saved=await this.lots.save(lot);
    await this.lotEvents.save(this.lotEvents.create({lotId:id,type:ProductionLotEventType.NOTE_UPDATED,actorId:actor.id,payload:{before,after:saved.note}}));
    this.realtime.emitInventory('production.updated',saved);return saved;
  }

  private async buildLotImpact(manager:EntityManager,lot:ProductionLot,quantity:number,lock=false):Promise<LotImpact>{
    const find=<T extends object>(entity:new()=>T,id:string)=>manager.findOne(entity,{where:{id} as never,...(lock?{lock:{mode:'pessimistic_write' as const}}:{})});
    const warnings:string[]=[];
    if(lot.actionType===ProductionLotActionType.TEST){
      return {inventoryChanged:false,output:{kind:'FINISHED_PRODUCT',id:lot.outputId,label:lot.outputLabel,before:0,change:0,after:0},components:[],warnings};
    }
    if(lot.outputType===ProductionOutputType.FINISHED_PRODUCT){
      const output=await find(FinishedProduct,lot.outputId);if(!output||!output.isActive)throw new BadRequestException('Thành phẩm của Lô không còn hoạt động');
      if(!output.productionReady)throw new BadRequestException('Thành phẩm chưa đủ cấu hình để sản xuất');
      const [bom,componentBom]=await Promise.all([manager.findBy(ProductBomItem,{productId:lot.outputId}),manager.findBy(FinishedProductComponentItem,{productId:lot.outputId})]);if(!bom.length&&!componentBom.length)throw new BadRequestException('Thành phẩm chưa có Cấu thành');
      const components:LotImpactLine[]=[];
      for(const line of bom){const item=await find(InventoryItem,line.itemId);if(!item||!item.isActive)throw new BadRequestException('Cấu thành có vật tư không hợp lệ');const before=Number(item.onHandQty??0);const change=-Number(line.quantityPerProduct)*quantity;const after=before+change;if(after<0)warnings.push(`${item.name}: thiếu ${Math.abs(after).toLocaleString('vi-VN')} ${item.unit}`);components.push({kind:'MATERIAL',id:item.id,label:item.name,before,change,after});}
      for(const line of componentBom){const item=await find(FinishedProduct,line.componentProductId);if(!item||!item.isActive)throw new BadRequestException('Cấu thành có thành phẩm con không hợp lệ');const before=Number(item.onHandQty);const change=-Number(line.quantityPerProduct)*quantity;const after=before+change;if(after<0)warnings.push(`${item.name}: thiếu ${Math.abs(after).toLocaleString('vi-VN')} unit`);components.push({kind:'FINISHED_PRODUCT',id:item.id,label:item.name,before,change,after});}
      const before=Number(output.onHandQty);return {inventoryChanged:true,output:{kind:'FINISHED_PRODUCT',id:output.id,label:output.name,before,change:quantity,after:before+quantity},components,warnings};
    }
    if(lot.outputType===ProductionOutputType.SELLABLE_PRODUCT){
      const output=await find(SellableProduct,lot.outputId);if(!output||!output.isActive)throw new BadRequestException('Sản phẩm của Lô không còn hoạt động');
      const [bom,materialBom]=await Promise.all([manager.findBy(SellableProductBomItem,{productId:lot.outputId}),manager.findBy(SellableProductMaterialItem,{productId:lot.outputId})]);if(!bom.length&&!materialBom.length)throw new BadRequestException('Sản phẩm chưa có Cấu hình');
      const components:LotImpactLine[]=[];
      for(const line of bom){const item=await find(FinishedProduct,line.finishedProductId);if(!item)throw new BadRequestException(`Không tìm thấy thành phẩm cấu hình: ${line.finishedProductId}`);const before=Number(item.onHandQty);const change=-Number(line.quantityPerProduct)*quantity;const after=before+change;if(after<0)warnings.push(`${item.name}: thiếu ${Math.abs(after).toLocaleString('vi-VN')} unit`);components.push({kind:'FINISHED_PRODUCT',id:item.id,label:item.name,before,change,after});}
      for(const line of materialBom){const item=await find(InventoryItem,line.itemId);if(!item||!item.isActive)throw new BadRequestException('Cấu hình có vật tư không hợp lệ');const before=Number(item.onHandQty??0);const change=-Number(line.quantityPerProduct)*quantity;const after=before+change;if(after<0)warnings.push(`${item.name}: thiếu ${Math.abs(after).toLocaleString('vi-VN')} ${item.unit}`);components.push({kind:'MATERIAL',id:item.id,label:item.name,before,change,after});}
      const before=Number(output.onHandQty);return {inventoryChanged:true,output:{kind:'SELLABLE_PRODUCT',id:output.id,label:output.name,before,change:quantity,after:before+quantity},components,warnings};
    }
    throw new BadRequestException('Loại đầu ra của Lô không hợp lệ');
  }

  async previewLot(id:string,dto:ProductionLotQuantityDto){
    const lot=await this.lots.findOneBy({id});if(!lot)throw new NotFoundException('Không tìm thấy Lô');if(lot.status===ProductionLotStatus.DONE)throw new BadRequestException('Lô đã DONE');
    return this.dataSource.transaction(manager=>this.buildLotImpact(manager,lot,dto.quantity));
  }

  private async applyLotImpact(manager:EntityManager,impact:LotImpact,actor:AuthUser,reference:string,note:string){
    for(const line of impact.components){
      if(line.kind==='MATERIAL'){
        const item=await manager.findOneByOrFail(InventoryItem,{id:line.id});item.onHandQty=line.after.toFixed(3);await manager.save(item);
        await manager.save(manager.create(InventoryTransaction,{itemId:item.id,type:InventoryTransactionType.OUT,quantity:Math.abs(line.change).toFixed(3),balanceBefore:line.before.toFixed(3),balanceAfter:line.after.toFixed(3),unit:item.unit,note,reference,actorId:actor.id}));
      }else{
        const item=await manager.findOneByOrFail(FinishedProduct,{id:line.id});item.onHandQty=line.after.toFixed(3);await manager.save(item);
        await manager.save(manager.create(FinishedProductTransaction,{productId:item.id,type:FinishedProductTransactionType.OUT,quantity:Math.abs(line.change).toFixed(3),balanceBefore:line.before.toFixed(3),balanceAfter:line.after.toFixed(3),note,reference,actorId:actor.id}));
      }
    }
    if(impact.output.kind==='FINISHED_PRODUCT'){
      const output=await manager.findOneByOrFail(FinishedProduct,{id:impact.output.id});output.onHandQty=impact.output.after.toFixed(3);await manager.save(output);
      await manager.save(manager.create(FinishedProductTransaction,{productId:output.id,type:FinishedProductTransactionType.PRODUCED,quantity:impact.output.change.toFixed(3),balanceBefore:impact.output.before.toFixed(3),balanceAfter:impact.output.after.toFixed(3),note,reference,actorId:actor.id}));
    }else{
      const output=await manager.findOneByOrFail(SellableProduct,{id:impact.output.id});output.onHandQty=impact.output.after.toFixed(3);await manager.save(output);
      await manager.save(manager.create(SellableProductTransaction,{productId:output.id,type:FinishedProductTransactionType.PRODUCED,quantity:impact.output.change.toFixed(3),balanceBefore:impact.output.before.toFixed(3),balanceAfter:impact.output.after.toFixed(3),note,reference,actorId:actor.id}));
    }
  }

  private async buildReverseLotImpact(manager:EntityManager,lot:ProductionLot,lock=false):Promise<LotImpact>{
    const done=await manager.findOne(ProductionLotEvent,{where:{lotId:lot.id,type:ProductionLotEventType.DONE},order:{createdAt:'DESC'}});
    const original=(done?.payload as {impact?:LotImpact}|null)?.impact;
    if(!original)throw new BadRequestException('Không tìm thấy dữ liệu giao dịch để đảo Kho');
    if(original.inventoryChanged===false)return original;
    const find=<T extends object>(entity:new()=>T,id:string)=>manager.findOne(entity,{where:{id} as never,...(lock?{lock:{mode:'pessimistic_write' as const}}:{})});
    let output:LotImpactLine;
    if(original.output.kind==='FINISHED_PRODUCT'){
      const row=await find(FinishedProduct,original.output.id);if(!row)throw new NotFoundException('Không tìm thấy thành phẩm đã nhập');const before=Number(row.onHandQty);const change=-original.output.change;const after=before+change;if(after<0)throw new BadRequestException('Tồn thành phẩm không đủ để đảo Kho');output={...original.output,before,change,after};
    }else{
      const row=await find(SellableProduct,original.output.id);if(!row)throw new NotFoundException('Không tìm thấy sản phẩm đã nhập');const before=Number(row.onHandQty);const change=-original.output.change;const after=before+change;if(after<0)throw new BadRequestException('Tồn sản phẩm không đủ để đảo Kho');output={...original.output,before,change,after};
    }
    const components:LotImpactLine[]=[];
    for(const line of original.components){
      const change=Math.abs(line.change);
      if(line.kind==='MATERIAL'){
        const row=await find(InventoryItem,line.id);if(!row)throw new NotFoundException('Không tìm thấy vật tư cần hoàn lại');const before=Number(row.onHandQty??0);components.push({...line,before,change,after:before+change});
      }else{
        const row=await find(FinishedProduct,line.id);if(!row)throw new NotFoundException('Không tìm thấy thành phẩm cần hoàn lại');const before=Number(row.onHandQty);components.push({...line,before,change,after:before+change});
      }
    }
    return {inventoryChanged:true,output,components,warnings:[]};
  }

  private async applyReverseLotImpact(manager:EntityManager,impact:LotImpact,actor:AuthUser,reference:string,note:string){
    if(impact.output.kind==='FINISHED_PRODUCT'){
      const output=await manager.findOneByOrFail(FinishedProduct,{id:impact.output.id});output.onHandQty=impact.output.after.toFixed(3);await manager.save(output);await manager.save(manager.create(FinishedProductTransaction,{productId:output.id,type:FinishedProductTransactionType.OUT,quantity:Math.abs(impact.output.change).toFixed(3),balanceBefore:impact.output.before.toFixed(3),balanceAfter:impact.output.after.toFixed(3),note,reference,actorId:actor.id}));
    }else{
      const output=await manager.findOneByOrFail(SellableProduct,{id:impact.output.id});output.onHandQty=impact.output.after.toFixed(3);await manager.save(output);await manager.save(manager.create(SellableProductTransaction,{productId:output.id,type:FinishedProductTransactionType.OUT,quantity:Math.abs(impact.output.change).toFixed(3),balanceBefore:impact.output.before.toFixed(3),balanceAfter:impact.output.after.toFixed(3),note,reference,actorId:actor.id}));
    }
    for(const line of impact.components){
      if(line.kind==='MATERIAL'){
        const item=await manager.findOneByOrFail(InventoryItem,{id:line.id});item.onHandQty=line.after.toFixed(3);await manager.save(item);await manager.save(manager.create(InventoryTransaction,{itemId:item.id,type:InventoryTransactionType.IN,quantity:line.change.toFixed(3),balanceBefore:line.before.toFixed(3),balanceAfter:line.after.toFixed(3),unit:item.unit,note,reference,actorId:actor.id}));
      }else{
        const item=await manager.findOneByOrFail(FinishedProduct,{id:line.id});item.onHandQty=line.after.toFixed(3);await manager.save(item);await manager.save(manager.create(FinishedProductTransaction,{productId:item.id,type:FinishedProductTransactionType.PRODUCED,quantity:line.change.toFixed(3),balanceBefore:line.before.toFixed(3),balanceAfter:line.after.toFixed(3),note,reference,actorId:actor.id}));
      }
    }
  }

  async completeLot(id:string,dto:ProductionLotQuantityDto,actor:AuthUser){
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Lô');if(lot.status===ProductionLotStatus.DONE)throw new BadRequestException('Lô đã DONE, không thể nhập kho lần hai');
      await this.assertCanCompleteLot(manager,lot.id,actor);
      if(!lot.testedAt)throw new BadRequestException('Lô cần xác nhận ĐÃ TEST trước khi DONE');
      const impact=await this.buildLotImpact(manager,lot,dto.quantity,true);const reference=`production-lot:${lot.id}:done:${randomUUID()}`;const note=`DONE ${lot.code} · ${lot.outputLabel}`;
      if(impact.inventoryChanged)await this.applyLotImpact(manager,impact,actor,reference,note);
      lot.status=ProductionLotStatus.DONE;lot.completedQuantity=dto.quantity;lot.completedById=actor.id;lot.completedAt=new Date();await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:lot.id,type:ProductionLotEventType.DONE,actorId:actor.id,payload:{quantity:dto.quantity,reference,impact}}));
      return {lot,impact};
    });
    this.realtime.emitInventory('production.updated',result);this.realtime.emitInventory('inventory.product.updated',result);this.realtime.emitInventory('inventory.sellable-product.updated',result);return result;
  }

  async undoLot(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new BadRequestException('Chỉ Admin được Undo Lô');
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Lô');if(lot.status!==ProductionLotStatus.DONE)throw new BadRequestException('Lô chưa DONE');
      const impact=await this.buildReverseLotImpact(manager,lot,true);
      const reference=`production-lot:${lot.id}:undo:${randomUUID()}`;const note=`UNDO ${lot.code} · ${lot.outputLabel}`;
      if(impact.inventoryChanged)await this.applyReverseLotImpact(manager,impact,actor,reference,note);
      lot.status=ProductionLotStatus.IN_PROGRESS;lot.completedQuantity=null;lot.completedById=null;lot.completedAt=null;lot.testedById=null;lot.testedAt=null;await manager.save(lot);await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.UNDONE,actorId:actor.id,payload:{reference,impact}}));return lot;
    });
    this.realtime.emitInventory('production.updated',result);this.realtime.emitInventory('inventory.product.updated',result);this.realtime.emitInventory('inventory.sellable-product.updated',result);return result;
  }

  async previewDeleteLot(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new BadRequestException('Chỉ Admin được xoá Đợt');
    const lot=await this.lots.findOneBy({id});if(!lot)throw new NotFoundException('Không tìm thấy Lô');
    const linkedReportCount=await this.entryLots.countBy({lotId:id});
    const reverseImpact=lot.status===ProductionLotStatus.DONE?await this.dataSource.transaction(manager=>this.buildReverseLotImpact(manager,lot)):null;
    const stockImpact=reverseImpact?.inventoryChanged?reverseImpact:null;
    return {lotId:lot.id,code:lot.code,status:lot.status,linkedReportCount,stockImpact};
  }

  async deleteLot(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new BadRequestException('Chỉ Admin được xoá Đợt');
    const result=await this.dataSource.transaction(async manager=>{
      const lot=await manager.findOne(ProductionLot,{where:{id},lock:{mode:'pessimistic_write'}});if(!lot)throw new NotFoundException('Không tìm thấy Lô');
      const linkedReportCount=await manager.countBy(ProductionEntryLot,{lotId:id});
      const previousStatus=lot.status;let stockImpact:LotImpact|null=null;let reference:string|null=null;
      if(lot.status===ProductionLotStatus.DONE){
        const reverseImpact=await this.buildReverseLotImpact(manager,lot,true);reference=`production-lot:${lot.id}:delete:${randomUUID()}`;
        if(reverseImpact.inventoryChanged){stockImpact=reverseImpact;await this.applyReverseLotImpact(manager,stockImpact,actor,reference,`XOÁ ĐỢT ${lot.code} · ${lot.outputLabel}`);}
      }
      lot.deletedAt=new Date();lot.deletedById=actor.id;await manager.save(lot);
      await manager.save(manager.create(ProductionLotEvent,{lotId:id,type:ProductionLotEventType.DELETED,actorId:actor.id,payload:{previousStatus,linkedReportCount,stockReversed:Boolean(stockImpact),reference,impact:stockImpact}}));
      return {id:lot.id,deletedAt:lot.deletedAt,stockImpact};
    });
    this.realtime.emitInventory('production.updated',result);this.realtime.emitInventory('inventory.product.updated',result);this.realtime.emitInventory('inventory.sellable-product.updated',result);return result;
  }

  async createEntry(dto:CreateProductionEntryDto,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN&&dto.userId!==actor.id)throw new BadRequestException('Chỉ được báo cáo công việc của chính mình');
    await this.assertUnlocked(dto.userId,dto.workDate,actor);
    if(!await this.users.exist({where:{id:dto.userId,isActive:true}}))throw new NotFoundException('Không tìm thấy thành viên');
    if(dto.outputType===ProductionOutputType.FINISHED_PRODUCT&&(!dto.outputId||!await this.finished.exist({where:{id:dto.outputId,isActive:true}})))throw new BadRequestException('Thành phẩm không hợp lệ');
    if(dto.outputType===ProductionOutputType.SELLABLE_PRODUCT&&(!dto.outputId||!await this.sellable.exist({where:{id:dto.outputId,isActive:true}})))throw new BadRequestException('Sản phẩm không hợp lệ');
    const entryValue={userId:dto.userId,workDate:dto.workDate,module:dto.module,workType:dto.workType.trim(),outputType:dto.outputType,outputId:dto.outputId??null,outputLabel:dto.outputLabel.trim(),quantity:dto.quantity??null,progressPercent:dto.progressPercent===undefined||dto.progressPercent===null?null:dto.progressPercent.toFixed(2),note:dto.note?.trim()||null,rawText:dto.rawText?.trim()||null,reportItems:dto.reportItems??[],needsReview:dto.needsReview??false,createdById:actor.id};
    const saved=await this.dataSource.transaction(async manager=>{
      const lotIds=await this.reportLotIds(manager,dto,dto.userId);
      if(!lotIds.length)throw new BadRequestException('Cần đăng ký ít nhất một Lô đang sản xuất trước khi báo cáo');
      const entry=await manager.save(manager.create(ProductionEntry,entryValue));
      await manager.save(lotIds.map(lotId=>manager.create(ProductionEntryLot,{entryId:entry.id,lotId})));
      for(const lotId of lotIds)await manager.save(manager.create(ProductionLotEvent,{lotId,type:ProductionLotEventType.REPORT_LINKED,actorId:actor.id,payload:{entryId:entry.id,userId:dto.userId,workDate:dto.workDate}}));
      return entry;
    });
    await this.ensurePaymentRequest(dto.userId);
    const member=await this.users.findOneBy({id:dto.userId});
    await this.systemNotifications.create(this.entries.manager,{actor,relatedUserIds:[dto.userId],module:SystemNotificationModule.PRODUCTION,eventType:'PRODUCTION_REPORT_CREATED',entityType:'PRODUCTION_ENTRY',entityId:saved.id,entityLabel:`${member?.displayName??'Thành viên'} · ${dto.workDate}`,message:'đã gửi báo cáo Sản xuất',bodyPreview:saved.rawText??saved.outputLabel,dedupeKey:`production-entry:${saved.id}:created`});
    this.realtime.emitInventory('production.updated',saved);return saved;
  }

  async updateEntry(id:string,dto:CreateProductionEntryDto,actor:AuthUser){
    const existing=await this.entries.findOneBy({id});
    if(!existing)throw new NotFoundException('Không tìm thấy báo cáo');
    if(actor.role!==UserRole.ADMIN&&existing.userId!==actor.id)throw new BadRequestException('Chỉ được sửa báo cáo công việc của chính mình');
    if(dto.userId!==existing.userId||dto.workDate!==this.dateKey(existing.workDate))throw new BadRequestException('Không được đổi thành viên hoặc ngày của báo cáo');
    await this.assertUnlocked(existing.userId,this.dateKey(existing.workDate),actor);
    if(dto.outputType===ProductionOutputType.FINISHED_PRODUCT&&(!dto.outputId||!await this.finished.exist({where:{id:dto.outputId,isActive:true}})))throw new BadRequestException('Thành phẩm không hợp lệ');
    if(dto.outputType===ProductionOutputType.SELLABLE_PRODUCT&&(!dto.outputId||!await this.sellable.exist({where:{id:dto.outputId,isActive:true}})))throw new BadRequestException('Sản phẩm không hợp lệ');
    const entryValue={module:dto.module,workType:dto.workType.trim(),outputType:dto.outputType,outputId:dto.outputId??null,outputLabel:dto.outputLabel.trim(),quantity:dto.quantity??null,progressPercent:dto.progressPercent===undefined||dto.progressPercent===null?null:dto.progressPercent.toFixed(2),note:dto.note?.trim()||null,rawText:dto.rawText?.trim()||null,reportItems:dto.reportItems??existing.reportItems??[],needsReview:dto.needsReview??false};
    const saved=await this.dataSource.transaction(async manager=>{
      const entry=await manager.findOne(ProductionEntry,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!entry)throw new NotFoundException('Không tìm thấy báo cáo');
      const oldLinks=await manager.findBy(ProductionEntryLot,{entryId:id});
      const oldLotIds=new Set(oldLinks.map(link=>link.lotId));
      const lotIds=await this.reportLotIds(manager,dto,existing.userId,[...oldLotIds]);
      if(!lotIds.length)throw new BadRequestException('Cần đăng ký ít nhất một Lô đang sản xuất trước khi báo cáo');
      Object.assign(entry,entryValue);const updated=await manager.save(entry);
      await manager.delete(ProductionEntryLot,{entryId:id});
      await manager.save(lotIds.map(lotId=>manager.create(ProductionEntryLot,{entryId:id,lotId})));
      for(const lotId of lotIds)if(!oldLotIds.has(lotId))await manager.save(manager.create(ProductionLotEvent,{lotId,type:ProductionLotEventType.REPORT_LINKED,actorId:actor.id,payload:{entryId:id,userId:existing.userId,workDate:this.dateKey(existing.workDate)}}));
      return updated;
    });
    const member=await this.users.findOneBy({id:existing.userId});
    await this.systemNotifications.create(this.entries.manager,{actor,relatedUserIds:[existing.userId],module:SystemNotificationModule.PRODUCTION,eventType:'PRODUCTION_REPORT_UPDATED',entityType:'PRODUCTION_ENTRY',entityId:saved.id,entityLabel:`${member?.displayName??'Thành viên'} · ${this.dateKey(existing.workDate)}`,message:'đã cập nhật báo cáo Sản xuất',bodyPreview:saved.rawText??saved.outputLabel,dedupeKey:`production-entry:${saved.id}:updated:${saved.updatedAt.toISOString()}`});
    this.realtime.emitInventory('production.updated',saved);return saved;
  }

  async markPaid(id:string,actor:AuthUser){
    if(actor.role!==UserRole.ADMIN)throw new BadRequestException('Chỉ Admin được xác nhận đã thanh toán');
    const row=await this.payments.findOneBy({id});if(!row)throw new NotFoundException('Không tìm thấy request thanh toán');
    row.status=ProductionPaymentStatus.PAID;row.paidById=actor.id;row.paidAt=new Date();
    const saved=await this.payments.save(row);
    const member=await this.users.findOneBy({id:saved.userId});
    await this.systemNotifications.create(this.payments.manager,{actor,relatedUserIds:[saved.userId],module:SystemNotificationModule.PRODUCTION,eventType:'PRODUCTION_PAYMENT_PAID',entityType:'PRODUCTION_PAYMENT_REQUEST',entityId:saved.id,entityLabel:member?.displayName??'Thành viên',message:'đã xác nhận thanh toán Kết công',bodyPreview:`${Number(saved.totalHours).toLocaleString('vi-VN')} giờ · ${saved.workSummary.map(item=>this.dateKey(item.date)).join(' · ')}`,dedupeKey:`production-payment:${saved.id}:paid`});
    this.realtime.emitInventory('production.updated',saved);return saved;
  }
}

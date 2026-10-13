import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { User, UserRole } from '../users/user.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { TaskEvent, TaskEventType } from '../tasks/task-event.entity';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { Worklog } from '../worklogs/worklog.entity';
import { vietnamWorkDate } from '../worklogs/worklog.policy';
import { CreatePerformancePeriodDto, CreatePerformancePlanDto } from './performance.dto';
import { PerformanceAttestation, PerformancePeriod, PerformancePlan } from './performance.entity';
import { evaluatePerformance, isCompletion, isFailure, performanceMonth } from './performance.policy';

export function requirePerformanceAdmin(actor: AuthUser) {
  if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được cấu hình/xác nhận xét thưởng');
}
export function validatePerformancePeriod(dto: CreatePerformancePeriodDto, now = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(dto.month)) throw new BadRequestException('Tháng không hợp lệ');
  const date = new Date(`${dto.effectiveDate}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || vietnamWorkDate(date) !== dto.effectiveDate || dto.effectiveDate.slice(0,7) !== dto.month || dto.effectiveDate < vietnamWorkDate(now)) throw new BadRequestException('Ngày áp dụng phải thuộc tháng và không trước hôm nay; không hồi tố');
}
export function validatePerformanceShares(dto: CreatePerformancePlanDto, members: string[], assignees: string[]) {
  const ids = dto.shares.map(share=>share.userId);
  if (new Set(ids).size!==ids.length || dto.shares.reduce((sum,share)=>sum+share.percent,0)!==100 || ids.some(id=>!members.includes(id)||!assignees.includes(id))) throw new BadRequestException('Phân bổ phải đủ 100%, không trùng và thuộc Dev được giao Task');
}

@Injectable()
export class PerformanceService {
  constructor(private readonly db: DataSource, private readonly realtime: RealtimeGateway) {}

  async dashboard(month: string, now = new Date()) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Tháng không hợp lệ');
    const [periods, plans, tasks, events, logs, users, attestations] = await this.db.transaction('REPEATABLE READ',manager=>Promise.all([
      manager.getRepository(PerformancePeriod).find({order:{month:'ASC'}}),
      manager.getRepository(PerformancePlan).find({order:{taskId:'ASC'}}),
      manager.getRepository(Task).find({relations:{assignees:{user:true}},order:{id:'ASC'}}),
      manager.getRepository(TaskEvent).find({relations:{actor:true},order:{createdAt:'ASC',id:'ASC'}}),
      manager.getRepository(Worklog).find({where:{deletedAt:IsNull()},relations:{tasks:true},order:{id:'ASC'}}),
      manager.getRepository(User).find({order:{id:'ASC'}}),
      manager.getRepository(PerformanceAttestation).find({where:{month}}),
    ]));
    const period=periods.find(row=>row.month===month)??null;
    const candidates=users.filter(user=>user.isActive && ['thang','phu'].includes(user.username.toLowerCase()));
    const members=(period?users.filter(user=>period.memberIds.includes(user.id)):candidates).map(({id,username,displayName})=>({id,username,displayName}));
    const assessment=evaluatePerformance({month,period,trialStart:periods[0]?.effectiveDate??null,plans,tasks,events,logs,members,attestations,now});
    const enrolled=new Set(plans.map(plan=>plan.taskId));
    const worked=new Set(logs.flatMap(log=>[...log.tasks.map(task=>task.id),...(log.primaryTaskId?[log.primaryTaskId]:[])]));
    const started=new Set(events.filter(event=>isCompletion(event)||isFailure(event)||event.type===TaskEventType.REOPENED||
      (event.payload?.changes as {status?:{to?:string}}|undefined)?.status?.to===TaskStatus.ACTIVE).map(event=>event.taskId));
    return {...assessment,
      candidates:candidates.map(({id,displayName,username})=>({id,displayName,username})),
      availableTasks:tasks.filter(task=>!task.deletedAt&&task.status===TaskStatus.BACKLOG&&!enrolled.has(task.id)&&!worked.has(task.id)&&!started.has(task.id))
        .map(task=>({id:task.id,title:task.title,assigneeIds:task.assignees.map(a=>a.userId)})),
    };
  }

  async createPeriod(dto: CreatePerformancePeriodDto, actor: AuthUser) {
    requirePerformanceAdmin(actor); validatePerformancePeriod(dto);
    const members=await this.db.getRepository(User).findBy({id:In(dto.memberIds),isActive:true});
    if (members.length!==2 || members.some(user=>!['thang','phu'].includes(user.username.toLowerCase()))) throw new BadRequestException('Chọn hai tài khoản Dev THẮNG và PHÚ đang hoạt động');
    try { await this.db.getRepository(PerformancePeriod).insert({...dto,createdById:actor.id}); }
    catch(error) { if ((error as {code?:string}).code==='23505') throw new ConflictException('Tháng đã chốt cấu hình; không đổi mốc sau khi công bố'); throw error; }
    this.realtime.emitTask('performance.updated',{month:dto.month});
    return this.dashboard(dto.month);
  }

  async createPlan(dto: CreatePerformancePlanDto, actor: AuthUser) {
    requirePerformanceAdmin(actor);
    const month=performanceMonth(new Date());
    await this.db.transaction(async manager=>{
      const period=await manager.findOneBy(PerformancePeriod,{month});
      if (!period || period.effectiveDate>vietnamWorkDate(new Date())) throw new BadRequestException('Cần cấu hình tháng đang áp dụng trước');
      const task=await manager.findOne(Task,{where:{id:dto.taskId,deletedAt:IsNull()},lock:{mode:'pessimistic_write'}});
      if (!task || task.status!==TaskStatus.BACKLOG) throw new BadRequestException('Chỉ chốt baseline cho Task Backlog chưa bắt đầu');
      if (await manager.existsBy(PerformancePlan,{taskId:dto.taskId})) throw new ConflictException('Task đã có Point/giờ chuẩn cố định');
      const fullTask=await manager.findOneOrFail(Task,{where:{id:dto.taskId},relations:{assignees:true}});
      validatePerformanceShares(dto,period.memberIds,fullTask.assignees.map(a=>a.userId));
      const history=await manager.findBy(TaskEvent,{taskId:dto.taskId});
      if (history.some(event=>isCompletion(event)||isFailure(event)||event.type===TaskEventType.REOPENED||
        (event.payload?.changes as {status?:{to?:string}}|undefined)?.status?.to===TaskStatus.ACTIVE)) throw new BadRequestException('Task đã có lịch sử làm; không chốt Point hồi tố');
      const work=await manager.createQueryBuilder(Worklog,'w').leftJoin('w.tasks','t').where('t.id = :id OR w.primaryTaskId = :id',{id:dto.taskId}).getCount();
      if (work) throw new BadRequestException('Task đã có Worklog; không chốt Point hồi tố');
      await manager.insert(PerformancePlan,{...dto,standardHours:dto.standardHours.toFixed(2),createdById:actor.id});
      await manager.insert(TaskEvent,{taskId:dto.taskId,actorId:actor.id,type:TaskEventType.EDITED,payload:{source:'PERFORMANCE_BASELINE',point:dto.point,standardHours:dto.standardHours,shares:dto.shares}});
    });
    this.realtime.emitTask('performance.updated',{taskId:dto.taskId});
    return this.dashboard(month);
  }

  async attest(month: string, userId: string, fingerprint: string, actor: AuthUser) {
    requirePerformanceAdmin(actor);
    const report=await this.dashboard(month);
    const row=report.members.find(member=>member.userId===userId);
    if (!row || !report.period) throw new BadRequestException('Thành viên/tháng chưa cấu hình');
    if (row.fingerprint!==fingerprint) throw new ConflictException('Dữ liệu đã thay đổi. Tải lại và kiểm tra trước khi xác nhận');
    if (row.dataIssues.length) throw new BadRequestException('Cần bổ sung dữ liệu còn thiếu trước khi xác nhận');
    await this.db.getRepository(PerformanceAttestation).upsert({month,userId,fingerprint,verifiedById:actor.id,verifiedAt:new Date()},['month','userId']);
    this.realtime.emitTask('performance.updated',{month,userId});
    return this.dashboard(month);
  }
}

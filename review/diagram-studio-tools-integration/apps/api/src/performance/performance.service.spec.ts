import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../users/user.entity';
import { PerformanceController } from './performance.controller';
import { PerformanceService, validatePerformancePeriod, validatePerformanceShares } from './performance.service';
import { CreatePerformancePeriodDto, CreatePerformancePlanDto } from './performance.dto';
import { PerformancePeriod, PerformancePlan } from './performance.entity';
import { Task } from '../tasks/task.entity';
import { TaskEvent } from '../tasks/task-event.entity';
import { Worklog } from '../worklogs/worklog.entity';
import { vietnamWorkDate } from '../worklogs/worklog.policy';

const admin={id:'admin',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
const dto={month:'2026-10',effectiveDate:'2026-10-03',targetPoint:1000,memberIds:['thang','phu']};
const plan={taskId:'task',point:400,standardHours:4,shares:[{userId:'thang',percent:100}]};
describe('performance API gates',()=>{
  it('requires workspace authentication for every endpoint',()=>{
    expect(Reflect.getMetadata(GUARDS_METADATA,PerformanceController)).toContain(JwtAuthGuard);
  });
  it('rejects member writes before touching the database',async()=>{
    const db={getRepository:jest.fn(),transaction:jest.fn()};const service=new PerformanceService(db as never,{} as never);
    const member={...admin,role:UserRole.MEMBER};
    await expect(service.createPeriod(dto,member)).rejects.toThrow('Chỉ Admin');
    await expect(service.createPlan(plan,member)).rejects.toThrow('Chỉ Admin');
    await expect(service.attest(dto.month,'thang','hash',member)).rejects.toThrow('Chỉ Admin');
    expect(db.getRepository).not.toHaveBeenCalled();expect(db.transaction).not.toHaveBeenCalled();
  });
  it('rejects retrospective/invalid dates and mismatched month',()=>{
    const now=new Date('2026-10-03T03:00:00Z');
    expect(()=>validatePerformancePeriod(dto,now)).not.toThrow();
    for(const effectiveDate of ['2026-10-02','2026-11-01','2026-10-99']) expect(()=>validatePerformancePeriod({...dto,effectiveDate},now)).toThrow();
  });
  it('requires unique assignees whose shares sum exactly to 100',()=>{
    expect(()=>validatePerformanceShares(plan,['thang','phu'],['thang'])).not.toThrow();
    for(const shares of [[{userId:'outsider',percent:100}],[{userId:'thang',percent:50}],[{userId:'thang',percent:50},{userId:'thang',percent:50}]]) expect(()=>validatePerformanceShares({...plan,shares},['thang','phu'],['thang'])).toThrow();
  });
  it('validates numbers and nested allocation before service invocation',async()=>{
    const invalid=plainToInstance(CreatePerformancePlanDto,{...plan,point:-1,standardHours:0,shares:[{userId:'not-uuid',percent:101}]});
    expect((await validate(invalid)).length).toBeGreaterThan(0);
    const invalidPeriod=plainToInstance(CreatePerformancePeriodDto,{...dto,targetPoint:0,memberIds:[]});
    expect((await validate(invalidPeriod)).length).toBeGreaterThan(0);
  });
  it('refuses changed fingerprints or incomplete-data attestations',async()=>{
    const upsert=jest.fn();const service=new PerformanceService({getRepository:()=>({upsert})} as never,{} as never);
    jest.spyOn(service,'dashboard').mockResolvedValue({period:dto,members:[{userId:'thang',fingerprint:'new',dataIssues:[]}]} as never);
    await expect(service.attest(dto.month,'thang','old',admin)).rejects.toThrow('Dữ liệu đã thay đổi');
    jest.spyOn(service,'dashboard').mockResolvedValue({period:dto,members:[{userId:'thang',fingerprint:'new',dataIssues:['Thiếu giờ']}]} as never);
    await expect(service.attest(dto.month,'thang','new',admin)).rejects.toThrow('Cần bổ sung');expect(upsert).not.toHaveBeenCalled();
  });
  it('locks the Task and refuses a baseline if Worklogs exist, including legacy/deleted logs',async()=>{
    const manager={findOneBy:jest.fn(async()=>({...dto,effectiveDate:'2020-01-01'})),findOne:jest.fn(async()=>({id:'task',status:'BACKLOG'})),existsBy:jest.fn(async()=>false),findOneOrFail:jest.fn(async()=>({assignees:[{userId:'thang'}]})),findBy:jest.fn(async()=>[]),insert:jest.fn(),createQueryBuilder:jest.fn()};
    const query={leftJoin:jest.fn().mockReturnThis(),where:jest.fn().mockReturnThis(),getCount:jest.fn(async()=>1)};manager.createQueryBuilder.mockReturnValue(query);
    const service=new PerformanceService({transaction:async(fn:(manager:unknown)=>unknown)=>fn(manager)} as never,{} as never);
    await expect(service.createPlan(plan,admin)).rejects.toThrow('đã có Worklog');
    expect(manager.findOne).toHaveBeenCalledWith(Task,expect.objectContaining({lock:{mode:'pessimistic_write'}}));expect(manager.insert).not.toHaveBeenCalled();
    manager.existsBy.mockResolvedValue(true);
    await expect(service.createPlan(plan,admin)).rejects.toThrow('cố định');
    expect(manager.existsBy).toHaveBeenCalledWith(PerformancePlan,{taskId:'task'});
    expect(manager.findOneBy).toHaveBeenCalledWith(PerformancePeriod,expect.anything());
  });
  it('creates an immutable baseline and audit without changing Task or Worklog points',async()=>{
    const manager={findOneBy:jest.fn(async()=>({...dto,effectiveDate:'2020-01-01'})),findOne:jest.fn(async()=>({id:'task',status:'BACKLOG'})),existsBy:jest.fn(async()=>false),findOneOrFail:jest.fn(async()=>({assignees:[{userId:'thang'}]})),findBy:jest.fn(async()=>[]),insert:jest.fn(),createQueryBuilder:jest.fn()};
    const query={leftJoin:jest.fn().mockReturnThis(),where:jest.fn().mockReturnThis(),getCount:jest.fn(async()=>0)};manager.createQueryBuilder.mockReturnValue(query);
    const realtime={emitTask:jest.fn()};
    const service=new PerformanceService({transaction:async(fn:(manager:unknown)=>unknown)=>fn(manager)} as never,realtime as never);
    jest.spyOn(service,'dashboard').mockResolvedValue({} as never);
    await service.createPlan(plan,admin);
    expect(manager.insert.mock.calls.map(call=>call[0])).toEqual([PerformancePlan,TaskEvent]);
    expect(manager.insert).toHaveBeenCalledWith(PerformancePlan,expect.objectContaining({point:400,standardHours:'4.00',createdById:'admin'}));
    expect(realtime.emitTask).toHaveBeenCalledWith('performance.updated',{taskId:'task'});
  });
  it('does not let a later configuration overwrite a published monthly target',async()=>{
    const insert=jest.fn().mockRejectedValue({code:'23505'});
    const service=new PerformanceService({getRepository:()=>({findBy:async()=>[{username:'thang'},{username:'phu'}],insert})} as never,{} as never);
    const today=vietnamWorkDate(new Date());
    await expect(service.createPeriod({...dto,month:today.slice(0,7),effectiveDate:today},admin)).rejects.toThrow('không đổi mốc');
  });
  it('uses one consistent read snapshot and returns public projections, not account details',async()=>{
    const repositories=new Map<unknown,unknown[]>([[PerformancePeriod,[]],[PerformancePlan,[]],[Task,[]],[TaskEvent,[]],[Worklog,[]]]);
    const manager={getRepository:(entity:unknown)=>({find:async()=>repositories.get(entity)??[]})};
    const transaction=jest.fn(async(_isolation:string,fn:(manager:unknown)=>unknown)=>fn(manager));
    const service=new PerformanceService({transaction} as never,{} as never);
    const report=await service.dashboard('2026-10');
    expect(transaction).toHaveBeenCalledWith('REPEATABLE READ',expect.any(Function));expect(report.members).toEqual([]);expect(report.period).toBeNull();
  });
});

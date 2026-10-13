import {validate} from 'class-validator';
import {ForbiddenException,NotFoundException} from '@nestjs/common';
import {IsNull} from 'typeorm';
import {UserRole} from '../users/user.entity';
import {ADMIN_TASK_STATUSES,UpdateTaskStatusDto} from './task.dto';
import {Task,TaskReviewResult,TaskStatus} from './task.entity';
import {TaskEventType} from './task-event.entity';
import {TasksService} from './tasks.service';

const admin={id:'admin-id',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
function setup(status:TaskStatus){
  const task={id:'task-id',status,doneById:'old-user',doneAt:new Date('2026-09-01'),completedById:'old-admin',completedAt:new Date('2026-09-02'),reviewResult:TaskReviewResult.FAILED,
    earnedPoint:'120',basePoint:'150',completionRate:'0.8',criteria:[{passed:true}],assignees:[{userId:'member'}],worklogs:[{point:42}],note:'Keep description'};
  const manager={findOne:jest.fn().mockResolvedValue(task),save:jest.fn(async value=>value)};
  const dataSource={transaction:jest.fn(async callback=>callback(manager))};
  const audit=jest.fn().mockResolvedValue(undefined);
  const realtime={emitTask:jest.fn()};
  const service=Object.create(TasksService.prototype) as TasksService;
  Object.assign(service,{dataSource,audit,realtime,getVisible:jest.fn(async()=>task)});
  return {service,task,manager,dataSource,audit,realtime};
}

describe('Admin direct Task status',()=>{
  const transitions=ADMIN_TASK_STATUSES.flatMap(from=>ADMIN_TASK_STATUSES.filter(to=>to!==from).map(to=>[from,to]));
  it.each(transitions)('allows %s -> %s without changing work or points',async(from,to)=>{
    const {service,task,manager,audit,realtime}=setup(from);
    const before={...task};
    const result=await service.setStatus(task.id,to,admin);
    expect(result.status).toBe(to);
    expect(manager.findOne).toHaveBeenCalledWith(Task,{where:{id:task.id,deletedAt:IsNull()},lock:{mode:'pessimistic_write'}});
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(task).toMatchObject({earnedPoint:before.earnedPoint,basePoint:before.basePoint,completionRate:before.completionRate,criteria:before.criteria,assignees:before.assignees,worklogs:before.worklogs,note:before.note});
    expect(task.reviewResult).toBe(to===TaskStatus.DONE?TaskReviewResult.PENDING:null);
    if(to===TaskStatus.BACKLOG||to===TaskStatus.ACTIVE){expect(task.doneAt).toBeNull();expect(task.doneById).toBeNull();}
    else {expect(task.doneAt).toBeInstanceOf(Date);expect(task.doneById).toBeTruthy();}
    if(to===TaskStatus.COMPLETE){expect(task.completedAt).toBeInstanceOf(Date);expect(task.completedById).toBe(admin.id);}
    else {expect(task.completedAt).toBeNull();expect(task.completedById).toBeNull();}
    expect(audit).toHaveBeenCalledWith(manager,task.id,admin.id,TaskEventType.EDITED,expect.objectContaining({source:'ADMIN_STATUS_CHANGE',changes:{status:{from,to}},previousMilestones:expect.objectContaining({completedAt:before.completedAt})}));
    expect(realtime.emitTask).toHaveBeenCalledWith('task.updated',result);
  });
  it.each(ADMIN_TASK_STATUSES)('does not write or notify when already %s',async status=>{
    const {service,task,manager,audit,realtime}=setup(status);
    await service.setStatus(task.id,status,admin);
    expect(manager.save).not.toHaveBeenCalled();expect(audit).not.toHaveBeenCalled();expect(realtime.emitTask).not.toHaveBeenCalled();
  });
  it('rejects members before opening a transaction',async()=>{
    const {service,dataSource}=setup(TaskStatus.COMPLETE);
    await expect(service.setStatus('task-id',TaskStatus.BACKLOG,{...admin,role:UserRole.MEMBER})).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid targets and archived tasks',async()=>{
    const {service,manager}=setup(TaskStatus.ARCHIVED);
    await expect(service.setStatus('task-id',TaskStatus.ARCHIVED,admin)).rejects.toThrow('không hợp lệ');
    await expect(service.setStatus('task-id','UNKNOWN' as TaskStatus,admin)).rejects.toThrow('không hợp lệ');
    await expect(service.setStatus('task-id',TaskStatus.ACTIVE,admin)).rejects.toThrow('lưu trữ');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('does not revive missing or deleted tasks',async()=>{
    const {service,manager}=setup(TaskStatus.COMPLETE);manager.findOne.mockResolvedValue(null);
    await expect(service.setStatus('task-id',TaskStatus.BACKLOG,admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('does not broadcast if the transactional audit fails',async()=>{
    const {service,audit,realtime}=setup(TaskStatus.COMPLETE);audit.mockRejectedValue(new Error('audit failed'));
    await expect(service.setStatus('task-id',TaskStatus.BACKLOG,admin)).rejects.toThrow('audit failed');
    expect(realtime.emitTask).not.toHaveBeenCalled();
  });
  it('validates the endpoint payload against the four allowed states',async()=>{
    for(const status of ADMIN_TASK_STATUSES)expect(await validate(Object.assign(new UpdateTaskStatusDto(),{status}))).toHaveLength(0);
    for(const status of [undefined,null,'',TaskStatus.ARCHIVED,'active'])expect((await validate(Object.assign(new UpdateTaskStatusDto(),{status}))).length).toBeGreaterThan(0);
  });
});

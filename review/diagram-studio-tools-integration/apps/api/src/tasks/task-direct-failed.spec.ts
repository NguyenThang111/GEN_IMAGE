import { validate } from 'class-validator';
import { TasksService } from './tasks.service';
import { TaskStatus, TaskReviewResult } from './task.entity';
import { TaskComment } from './task-comment.entity';
import { TaskEventType } from './task-event.entity';
import { FailTaskReviewDto } from './task.dto';
import { UserRole } from '../users/user.entity';

const admin={id:'admin',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
function setup(status:TaskStatus,reviewResult:TaskReviewResult|null=null){
  const task={id:'task',status,reviewResult,doneAt:null,doneById:null,completedAt:new Date('2026-09-01'),completedById:'old-admin',earnedPoint:'120',worklogs:[{id:'worklog',hours:4}]};
  const manager={save:jest.fn(async(value)=>({id:'saved',...value})),create:jest.fn((_entity,value)=>value),find:jest.fn(async()=>[]),delete:jest.fn()};
  const transaction=jest.fn(async(action)=>action(manager)),audit=jest.fn();
  const service=Object.create(TasksService.prototype) as TasksService;
  Object.assign(service,{dataSource:{transaction},audit,lock:jest.fn(async()=>task),getVisible:jest.fn(async()=>task),realtime:{emitTask:jest.fn()}});
  return {service,task,manager,transaction,audit};
}
describe('Direct Không đạt transition',()=>{
  it.each([TaskStatus.BACKLOG,TaskStatus.ACTIVE,TaskStatus.DONE,TaskStatus.COMPLETE])('allows Admin from %s and adds a comment without a reason form',async status=>{
    const {service,task,manager,audit}=setup(status);
    const previousCompletedAt=task.completedAt;
    await service.failReview(task.id,{},admin);
    expect(task).toMatchObject({status:TaskStatus.DONE,reviewResult:TaskReviewResult.FAILED,completedAt:null,completedById:null,earnedPoint:'120',worklogs:[{id:'worklog',hours:4}]});
    expect(manager.create).toHaveBeenCalledWith(TaskComment,{taskId:task.id,authorId:admin.id,body:'Task không đạt'});
    expect(audit).toHaveBeenCalledWith(manager,task.id,admin.id,TaskEventType.REVIEWED,expect.objectContaining({reason:'Task không đạt',changes:{status:{from:status,to:TaskStatus.DONE}},previousMilestones:expect.objectContaining({completedAt:previousCompletedAt})}));
    expect(manager.delete).not.toHaveBeenCalled();
  });
  it('does not duplicate comments or events on retries',async()=>{
    const {service,task,manager,audit}=setup(TaskStatus.DONE,TaskReviewResult.FAILED);
    await service.failReview(task.id,{},admin);
    expect(manager.save).not.toHaveBeenCalled();expect(audit).not.toHaveBeenCalled();
  });
  it('rejects members and archived tasks',async()=>{
    const {service,transaction,manager}=setup(TaskStatus.ARCHIVED);
    await expect(service.failReview('task',{}, {...admin,role:UserRole.MEMBER})).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
    await expect(service.failReview('task',{},admin)).rejects.toThrow('lưu trữ');
    expect(manager.save).not.toHaveBeenCalled();
  });
  it('accepts omitted or empty reasons but still rejects invalid payloads',async()=>{
    for(const reason of [undefined,'',' ']) expect(await validate(Object.assign(new FailTaskReviewDto(),{reason}))).toHaveLength(0);
    for(const reason of [123,'x'.repeat(4001)]) expect((await validate(Object.assign(new FailTaskReviewDto(),{reason}))).length).toBeGreaterThan(0);
  });
});

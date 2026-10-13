import { TasksService } from './tasks.service';
import { TaskStatus } from './task.entity';
import { TaskAssignee } from './task-assignee.entity';
import { TaskEventType } from './task-event.entity';
import { UserRole } from '../users/user.entity';

describe('Admin unassigns Task',()=>{
  const actor={id:'admin',username:'admin',displayName:'Admin',role:UserRole.ADMIN};
  function setup(){
    const task={id:'task',title:'Topic',note:'Work',status:TaskStatus.ACTIVE};
    const manager={find:jest.fn(async()=>[{userId:'old'}]),delete:jest.fn(),save:jest.fn(async value=>value),create:jest.fn((_entity,value)=>value)};
    const service=Object.create(TasksService.prototype) as TasksService;
    const audit=jest.fn(),assertWorkplaceAssignees=jest.fn();
    Object.assign(service,{dataSource:{transaction:async(action:any)=>action(manager)},lock:async()=>task,getVisible:async()=>task,audit,assertWorkplaceAssignees,realtime:{emitTask:jest.fn()}});
    return {service,manager,task,audit,assertWorkplaceAssignees};
  }
  it('clears assignments and audits old IDs without changing status or Worklogs',async()=>{
    const {service,manager,task,audit,assertWorkplaceAssignees}=setup();
    await service.update('task',{assigneeIds:[]},actor);
    expect(manager.delete).toHaveBeenCalledTimes(1);expect(manager.delete).toHaveBeenCalledWith(TaskAssignee,{taskId:'task'});
    expect(manager.save).toHaveBeenCalledTimes(1);expect(manager.save).toHaveBeenCalledWith(task);
    expect(assertWorkplaceAssignees).not.toHaveBeenCalled();expect(task.status).toBe(TaskStatus.ACTIVE);
    expect(audit).toHaveBeenCalledWith(manager,'task','admin',TaskEventType.EDITED,expect.objectContaining({changes:{assigneeIds:{from:['old'],to:[]}}}));
  });
  it('keeps assignments when field omitted',async()=>{const {service,manager}=setup();await service.update('task',{title:'New'},actor);expect(manager.delete).not.toHaveBeenCalled();});
  it('allows assigning again with the existing validation and shares',async()=>{
    const {service,manager,assertWorkplaceAssignees}=setup();await service.update('task',{assigneeIds:['new']},actor);
    expect(assertWorkplaceAssignees).toHaveBeenCalledWith(manager,['new']);expect(manager.create).toHaveBeenCalledWith(TaskAssignee,expect.objectContaining({userId:'new',sharePercent:'100'}));
  });
  it('rejects Member changes',async()=>{const {service,manager}=setup();await expect(service.update('task',{assigneeIds:[]},{...actor,role:UserRole.MEMBER})).rejects.toThrow();expect(manager.delete).not.toHaveBeenCalled();});
});

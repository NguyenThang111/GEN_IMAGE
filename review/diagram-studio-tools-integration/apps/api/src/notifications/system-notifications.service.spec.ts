import { NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { UserRole } from '../users/user.entity';
import { SystemNotification, SystemNotificationModule } from './system-notification.entity';
import { SystemNotificationsService } from './system-notifications.service';

describe('SystemNotificationsService', () => {
  const actor:AuthUser={id:'member-1',username:'phu',displayName:'PHÚ',role:UserRole.MEMBER};

  it('notifies every Admin and related user except the actor', async () => {
    const execute=jest.fn().mockResolvedValue(undefined);
    const values=jest.fn().mockReturnValue({orIgnore:()=>({execute})});
    const manager={
      findBy:jest.fn().mockResolvedValue([{id:'admin-1'},{id:'admin-2'}]),
      createQueryBuilder:jest.fn().mockReturnValue({insert:()=>({into:()=>({values})})}),
    } as unknown as EntityManager;
    const service=Object.create(SystemNotificationsService.prototype) as SystemNotificationsService;

    await service.create(manager,{actor,relatedUserIds:['member-1','member-2'],module:SystemNotificationModule.PURCHASING,eventType:'PURCHASE_REQUEST_CREATED',entityType:'PURCHASE_REQUEST',entityId:'request-1',entityLabel:'Trở 330R',message:'đã tạo Request mua',dedupeKey:'request-1:created'});

    expect(values).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({recipientId:'admin-1'}),
      expect.objectContaining({recipientId:'admin-2'}),
      expect.objectContaining({recipientId:'member-2'}),
    ]));
    expect(values.mock.calls[0][0]).toHaveLength(3);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not let a user read another recipient notification', async () => {
    const repository={findOne:jest.fn().mockResolvedValue(null)} as unknown as Repository<SystemNotification>;
    const service=Object.create(SystemNotificationsService.prototype) as SystemNotificationsService;
    Object.assign(service,{notifications:repository});

    await expect(service.read('notification-1',actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findOne).toHaveBeenCalledWith(expect.objectContaining({where:{id:'notification-1',recipientId:actor.id}}));
  });

  it('keeps an independent Admin recipient even for their own or excluded events', async () => {
    const values=jest.fn().mockReturnValue({orIgnore:()=>({execute:jest.fn()})});
    const manager={findBy:jest.fn().mockResolvedValue([{id:'admin-1'}]),createQueryBuilder:()=>({insert:()=>({into:()=>({values})})})} as unknown as EntityManager;
    const service=Object.create(SystemNotificationsService.prototype) as SystemNotificationsService;
    await service.create(manager,{actor:{...actor,id:'admin-1',role:UserRole.ADMIN},includeAdmins:false,excludeUserIds:['admin-1'],relatedUserIds:['member-2'],module:SystemNotificationModule.WORKLOG,eventType:'WORKLOG_MENTION',entityType:'WORKLOG',entityId:'worklog-1',entityLabel:'Test',message:'mentioned',dedupeKey:'event-1'});
    expect(values).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({recipientId:'admin-1',readAt:null}),expect.objectContaining({recipientId:'member-2',readAt:null})]));
  });

  it('keeps the member recipient for an explicitly self-assigned count', async () => {
    const values=jest.fn().mockReturnValue({orIgnore:()=>({execute:jest.fn()})});
    const manager={findBy:jest.fn().mockResolvedValue([]),createQueryBuilder:()=>({insert:()=>({into:()=>({values})})})} as unknown as EntityManager;
    const service=Object.create(SystemNotificationsService.prototype) as SystemNotificationsService;
    await service.create(manager,{actor,includeActor:true,relatedUserIds:[actor.id],module:SystemNotificationModule.INVENTORY,eventType:'INVENTORY_COUNT_ASSIGNED',entityType:'INVENTORY_ITEM',entityId:'material-1',entityLabel:'Trở',message:'đã giao kiểm',dedupeKey:'count-1'});
    expect(values).toHaveBeenCalledWith([expect.objectContaining({recipientId:actor.id,readAt:null})]);
  });

  it('marks only the acting Admin own inbox as read', async () => {
    const update=jest.fn();
    const service=Object.create(SystemNotificationsService.prototype) as SystemNotificationsService;
    Object.assign(service,{notifications:{update}});
    await service.readAll({...actor,id:'admin-1',role:UserRole.ADMIN});
    expect(update).toHaveBeenCalledWith(expect.objectContaining({recipientId:'admin-1'}),expect.objectContaining({readAt:expect.any(Date)}));
  });
});

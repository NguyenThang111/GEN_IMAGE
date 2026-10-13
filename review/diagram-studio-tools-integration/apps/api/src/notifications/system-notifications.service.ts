import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { User, UserRole } from '../users/user.entity';
import { SystemNotification, SystemNotificationModule } from './system-notification.entity';

export type CreateSystemNotification = {
  actor: AuthUser;
  relatedUserIds?: string[];
  excludeUserIds?: string[];
  includeAdmins?: boolean;
  includeActor?: boolean;
  module: SystemNotificationModule;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  message: string;
  bodyPreview?: string | null;
  dedupeKey: string;
};

@Injectable()
export class SystemNotificationsService {
  constructor(@InjectRepository(SystemNotification) private readonly notifications: Repository<SystemNotification>) {}

  async create(manager: EntityManager, input: CreateSystemNotification) {
    const admins = await manager.findBy(User, { role: UserRole.ADMIN, isActive: true });
    const recipientIds = new Set([...admins.map((admin) => admin.id), ...(input.relatedUserIds ?? [])]);
    if (!input.includeActor) recipientIds.delete(input.actor.id);
    for (const userId of input.excludeUserIds ?? []) recipientIds.delete(userId);
    for (const admin of admins) recipientIds.add(admin.id);
    if (!recipientIds.size) return;
    await manager.createQueryBuilder().insert().into(SystemNotification).values([...recipientIds].map((recipientId) => ({
      recipientId,
      actorId: input.actor.id,
      module: input.module,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      entityLabel: input.entityLabel.slice(0, 200),
      message: input.message.slice(0, 180),
      bodyPreview: input.bodyPreview?.slice(0, 300) || null,
      dedupeKey: input.dedupeKey,
      readAt: null,
    }))).orIgnore().execute();
  }

  async find(actor: AuthUser) {
    const rows = await this.notifications.find({ where: { recipientId: actor.id }, relations: { actor: true }, order: { createdAt: 'DESC' } });
    return rows.map((row) => this.view(row));
  }

  async read(id: string, actor: AuthUser) {
    const row = await this.notifications.findOne({ where: { id, recipientId: actor.id }, relations: { actor: true } });
    if (!row) throw new NotFoundException();
    if (!row.readAt) { row.readAt = new Date(); await this.notifications.save(row); }
    return this.view(row);
  }

  async readAll(actor: AuthUser) {
    const readAt = new Date();
    await this.notifications.update({ recipientId: actor.id, readAt: IsNull() }, { readAt });
    return { readAt };
  }

  private view(row: SystemNotification) {
    return {
      kind: 'SYSTEM_EVENT' as const,
      id: row.id,
      module: row.module,
      eventType: row.eventType,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      message: row.message,
      bodyPreview: row.bodyPreview,
      actorName: row.actor.displayName,
      personalKind: row.module === SystemNotificationModule.WORKLOG && row.eventType === 'WORKLOG_MENTION' ? 'MENTION' as const : null,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}

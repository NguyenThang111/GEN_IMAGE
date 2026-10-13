import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { User, UserRole } from '../users/user.entity';
import { RealtimeGateway } from './realtime.gateway';
import { TaskAssignee } from './task-assignee.entity';
import { TaskCriterion } from './task-criterion.entity';
import { TaskDraft } from './task-draft.entity';
import { TaskPriority } from './task-priority';
import { TaskEvent, TaskEventType } from './task-event.entity';
import { Task, TaskReviewResult, TaskStatus } from './task.entity';
import { ADMIN_TASK_STATUSES, CreateTaskCommentDto, CreateTaskDraftDto, CreateTaskDto, FailTaskReviewDto, ReviewTaskDto, TaskPointFactorsDto, UpdateTaskDraftDto, UpdateTaskDto } from './task.dto';
import { TaskComment } from './task-comment.entity';
import { TaskCommentMention } from './task-comment-mention.entity';
import { TaskNotification, TaskNotificationType } from './task-notification.entity';
import { assigneeShares, calculateBasePoint, canDoneTask, personalTaskNotificationKind, requireAdmin, requireTaskCommentable, requireTaskEditable } from './task.policy';
import { EmailService } from '../email/email.service';
import { Worklog, WorklogStatus } from '../worklogs/worklog.entity';

const WORKPLACE_DEVELOPERS = new Set(['thang', 'vinh', 'phu']);

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(TaskDraft) private readonly drafts: Repository<TaskDraft>,
    @InjectRepository(TaskComment) private readonly comments: Repository<TaskComment>,
    @InjectRepository(TaskNotification) private readonly notifications: Repository<TaskNotification>,
    private readonly dataSource: DataSource,
    private readonly realtime: RealtimeGateway,
    private readonly email: EmailService,
  ) {}

  async findTrash() { return this.withCommentCounts(await this.tasks.find({ where: [{ status: TaskStatus.BACKLOG, deletedAt: IsNull() }, { status: TaskStatus.ACTIVE, deletedAt: IsNull() }, { status: TaskStatus.DONE, deletedAt: IsNull() }], relations: { assignees: { user: true }, criteria: true }, order: { createdAt: 'DESC' } })); }
  async findTruck() { return this.withCommentCounts(await this.tasks.find({ where: { status: TaskStatus.COMPLETE, deletedAt: IsNull() }, relations: { assignees: { user: true }, criteria: true }, order: { completedAt: 'DESC' } })); }

  async findNotifications(actor: AuthUser) {
    const notifications = await this.notifications.find({
      where: { recipientId: actor.id },
      relations: { task: true, comment: { author: true }, event: { actor: true } },
      order: { createdAt: 'DESC' },
    });
    return notifications.map((notification) => this.notificationView(notification));
  }

  async readNotification(id: string, actor: AuthUser) {
    const notification = await this.notifications.findOne({
      where: { id, recipientId: actor.id },
      relations: { task: true, comment: { author: true }, event: { actor: true } },
    });
    if (!notification) throw new NotFoundException();
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notifications.save(notification);
    }
    return this.notificationView(notification);
  }

  async readAllNotifications(actor: AuthUser) {
    const readAt = new Date();
    await this.notifications.update({ recipientId: actor.id, readAt: IsNull() }, { readAt });
    return { readAt };
  }

  async findDrafts() {
    const drafts = await this.drafts.find({ where: { deletedAt: IsNull() }, order: { createdAt: 'DESC' } });
    const userIds = [...new Set(drafts.flatMap((draft) => draft.assigneeIds))];
    const users = userIds.length ? await this.dataSource.getRepository(User).findBy({ id: In(userIds) }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return drafts.map((draft) => ({ ...draft, basePoint: draft.pointFactors ? calculateBasePoint(draft.pointFactors) : null, assignees: draft.assigneeIds.map((id) => byId.get(id)).filter(Boolean) }));
  }

  async createDraft(dto: CreateTaskDraftDto, actor: AuthUser) {
    this.assertAdmin(actor);
    const assigneeIds = [...new Set(dto.assigneeIds ?? [])];
    if (assigneeIds.length) await this.assertWorkplaceAssignees(this.dataSource.manager, assigneeIds);
    const topic = dto.topic.trim();
    if (!topic) throw new BadRequestException('Topic is required');
    const draft = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(manager.create(TaskDraft, {
        topic,
        priority: TaskPriority.NORMAL,
        description: dto.description?.trim() || null,
        assigneeIds,
        criteria: dto.criteria ? this.normalizeCriteria(dto.criteria) : [],
        pointFactors: dto.pointFactors ?? null,
        dueDate: dto.dueDate ?? null,
        sourceStatus: null,
        sourcePriority: null,
        importKey: null,
        createdById: actor.id,
        deletedById: null,
        deletedAt: null,
      }));
      const recipients = assigneeIds.length ? await manager.findBy(User, { id: In(assigneeIds) }) : [];
      await this.email.queue(manager, recipients.map((recipient) => ({ recipient, eventType: 'BACKLOG_ASSIGNED', dedupeKey: `backlog-assigned:${saved.id}:${recipient.id}`, subject: `[Auto2Tech] Việc mới trong Backlog: ${topic}`, payload: { actorName: actor.displayName, topic, appUrl: this.appUrl() } })));
      return saved;
    });
    this.realtime.emitTask('task.draft.updated', draft);
    return draft;
  }

  async updateDraft(id: string, dto: UpdateTaskDraftDto, actor: AuthUser) {
    this.assertAdmin(actor);
    const topic = dto.topic.trim();
    if (!topic) throw new BadRequestException('Topic is required');
    const result = await this.dataSource.transaction(async (manager) => {
      const draft = await manager.findOne(TaskDraft, { where: { id, deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } });
      if (!draft) throw new NotFoundException('Draft was already completed or removed');
      const assigneeIds = [...new Set(dto.assigneeIds)];
      if (assigneeIds.length) assigneeShares(assigneeIds.length);
      const addedIds = assigneeIds.filter(userId => !draft.assigneeIds.includes(userId));
      if (addedIds.length) await this.assertWorkplaceAssignees(manager, addedIds);
      const criteria = dto.criteria.some((text) => text.trim()) ? this.normalizeCriteria(dto.criteria) : [];
      Object.assign(draft, { topic, description: dto.description.trim() || null, suggestion: dto.suggestion.trim() || null, assigneeIds, criteria });
      return manager.save(draft);
    });
    this.realtime.emitTask('task.draft.updated', result);
    return result;
  }

  async promoteDraft(id: string, dto: CreateTaskDto, actor: AuthUser) {
    this.assertAdmin(actor);
    const taskId = await this.dataSource.transaction(async (manager) => {
      const draft = await manager.findOne(TaskDraft, { where: { id, deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } });
      if (!draft) throw new NotFoundException();
      const task = await this.createBacklogTask(manager, dto, actor, { draftId: draft.id, sourceStatus: draft.sourceStatus }, draft.priority ?? TaskPriority.NORMAL);
      await this.queueTaskAssigned(manager, task.id, dto.title, dto.assigneeIds, actor);
      draft.deletedAt = new Date();
      draft.deletedById = actor.id;
      await manager.save(draft);
      return task.id;
    });
    const result = await this.getVisible(taskId);
    this.realtime.emitTask('task.created', result);
    this.realtime.emitTask('task.draft.updated', { id });
    return result;
  }

  async claimDraft(id: string, actor: AuthUser) {
    const taskId = await this.dataSource.transaction(async (manager) => {
      const draft = await manager.findOne(TaskDraft, { where: { id, deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } });
      if (!draft) throw new NotFoundException('Draft was already claimed or removed');
      if (!WORKPLACE_DEVELOPERS.has(actor.username)) throw new ForbiddenException('Only Workplace Dev may claim a draft');
      const assigneeIds = draft.assigneeIds.length ? draft.assigneeIds : [actor.id];
      if (draft.assigneeIds.length && !draft.assigneeIds.includes(actor.id)) throw new ForbiddenException('Draft is assigned to another member');
      if (!draft.description?.trim() || !draft.criteria.length) throw new BadRequestException('Draft needs Output and Acceptance before self-claim');
      const task = await this.createBacklogTask(manager, {
        title: draft.topic,
        note: draft.description,
        suggestion: draft.suggestion,
        assigneeIds,
        criteria: draft.criteria,
      }, actor, { draftId: draft.id, sourceStatus: draft.sourceStatus, selfClaimed: true }, draft.priority ?? TaskPriority.NORMAL);
      const recipient = await manager.findOneByOrFail(User, { id: actor.id });
      await this.email.queue(manager, [{ recipient, eventType: 'TASK_CLAIMED', dedupeKey: `task-claimed:${task.id}:${recipient.id}`, subject: `[Auto2Tech] Đã nhận việc: ${draft.topic}`, payload: { actorName: actor.displayName, topic: draft.topic, appUrl: this.appUrl() } }]);
      draft.deletedAt = new Date();
      draft.deletedById = actor.id;
      await manager.save(draft);
      return task.id;
    });
    const result = await this.getVisible(taskId);
    this.realtime.emitTask('task.created', result);
    this.realtime.emitTask('task.draft.updated', { id });
    return result;
  }

  async removeDraft(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const draft = await this.drafts.findOneBy({ id, deletedAt: IsNull() });
    if (!draft) throw new NotFoundException();
    draft.deletedAt = new Date();
    draft.deletedById = actor.id;
    await this.drafts.save(draft);
    this.realtime.emitTask('task.draft.updated', { id });
    return { id };
  }

  async scoreboard(month: string) {
    const start = new Date(`${month}-01T00:00:00+07:00`);
    const [year, monthNumber] = month.split('-').map(Number);
    const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
    const end = new Date(`${nextMonth}-01T00:00:00+07:00`);
    const developers = await this.dataSource.getRepository(User).createQueryBuilder('user')
      .where('user.username IN (:...usernames)', { usernames: [...WORKPLACE_DEVELOPERS] })
      .andWhere('user.isActive = true')
      .orderBy("CASE user.username WHEN 'thang' THEN 1 WHEN 'vinh' THEN 2 ELSE 3 END")
      .getMany();
    const ids = developers.map((developer) => developer.id);
    if (!ids.length) return { month, targetPoint: 1200, members: [] };

    const assignedRows = await this.dataSource.getRepository(TaskAssignee).createQueryBuilder('assignment')
      .innerJoin('assignment.task', 'task')
      .select('assignment.userId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('assignment.userId IN (:...ids)', { ids })
      .andWhere('assignment.assignedAt >= :start AND assignment.assignedAt < :end', { start, end })
      .andWhere('task.deletedAt IS NULL')
      .groupBy('assignment.userId')
      .getRawMany<{ userId: string; count: string }>();
    const doneTasks = await this.tasks.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignees', 'assignment')
      .where('task.doneAt >= :start AND task.doneAt < :end', { start, end })
      .andWhere('task.deletedAt IS NULL')
      .getMany();
    const completedTasks = await this.tasks.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignees', 'assignment')
      .where('task.completedAt >= :start AND task.completedAt < :end', { start, end })
      .andWhere('task.deletedAt IS NULL')
      .getMany();
    const assigned = new Map(assignedRows.map((row) => [row.userId, Number(row.count)]));
    return {
      month,
      targetPoint: 1200,
      members: developers.map((developer) => {
        const doneCount = doneTasks.filter((task) => task.assignees.some((assignment) => assignment.userId === developer.id)).length;
        const earnedPoint = completedTasks.reduce((total, task) => {
          const assignment = task.assignees.find((item) => item.userId === developer.id);
          return total + (assignment && task.earnedPoint ? Number(task.earnedPoint) * Number(assignment.sharePercent) / 100 : 0);
        }, 0);
        return { userId: developer.id, username: developer.username, displayName: developer.displayName, assignedTasks: assigned.get(developer.id) ?? 0, doneTasks: doneCount, earnedPoint: Number(earnedPoint.toFixed(2)), progressPercent: Number((earnedPoint / 1200 * 100).toFixed(1)) };
      }),
    };
  }

  async detail(id: string) {
    const task = await this.getVisible(id);
    const [comments, events, worklogs] = await Promise.all([
      this.comments.find({ where: { taskId: id }, relations: { author: true, mentions: { user: true } }, order: { createdAt: 'ASC' } }),
      this.dataSource.getRepository(TaskEvent).find({ where: { taskId: id }, relations: { actor: true }, order: { createdAt: 'ASC' } }),
      this.dataSource.getRepository(Worklog).createQueryBuilder('worklog')
        .innerJoin('worklog.tasks', 'sourceTask', 'sourceTask.id = :id', { id })
        .leftJoinAndSelect('worklog.user', 'user')
        .leftJoinAndSelect('worklog.createdBy', 'createdBy')
        .leftJoinAndSelect('worklog.comments', 'worklogComment')
        .leftJoinAndSelect('worklogComment.author', 'worklogCommentAuthor')
        .where('worklog.deletedAt IS NULL')
        .orderBy('worklog.startedAt', 'DESC')
        .addOrderBy('worklogComment.createdAt', 'ASC')
        .getMany(),
    ]);
    const timeline = [
      ...events.map((event) => ({ kind: 'ACTIVITY' as const, id: event.id, type: event.type, actor: event.actor, payload: event.payload, createdAt: event.createdAt })),
      ...comments.map((comment) => ({ kind: 'COMMENT' as const, id: comment.id, body: comment.body, imageUrl: comment.imageMimeType ? `/api/tasks/comments/${comment.id}/image` : null, author: comment.author, mentions: comment.mentions.map((mention) => mention.user), createdAt: comment.createdAt })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { task, timeline, worklogs, canComment: [TaskStatus.BACKLOG, TaskStatus.ACTIVE, TaskStatus.DONE].includes(task.status) };
  }

  async comment(id: string, dto: CreateTaskCommentDto, actor: AuthUser, image?: Express.Multer.File) {
    const body = (dto.body ?? '').trim();
    if (!body && !image) throw new BadRequestException('Comment hoặc ảnh là bắt buộc');
    const mentionedUserIds = [...new Set(dto.mentionedUserIds ?? [])];
    const comment = await this.dataSource.transaction(async (manager) => {
      const task = await this.lock(manager, id);
      requireTaskCommentable(task.status);
      if (mentionedUserIds.length) {
        const activeCount = await manager.createQueryBuilder(User, 'u').where('u.id IN (:...ids)', { ids: mentionedUserIds }).andWhere('u.isActive = true').getCount();
        if (activeCount !== mentionedUserIds.length) throw new BadRequestException('Every mentioned user must be active');
      }
      const saved = await manager.save(manager.create(TaskComment, { taskId: id, authorId: actor.id, body, imageMimeType: image?.mimetype ?? null, imageByteSize: image?.size ?? null, imageData: image?.buffer ?? null }));
      if (mentionedUserIds.length) await manager.save(mentionedUserIds.map((userId) => manager.create(TaskCommentMention, { commentId: saved.id, userId })));
      const notificationRecipients = new Map<string, TaskNotificationType>();
      for (const userId of mentionedUserIds) if (userId !== actor.id) notificationRecipients.set(userId, TaskNotificationType.MENTION);
      const admins = await manager.findBy(User, { role: UserRole.ADMIN, isActive: true });
      for (const admin of admins) if (!notificationRecipients.has(admin.id)) notificationRecipients.set(admin.id, TaskNotificationType.COMMENT);
      if (notificationRecipients.size) await manager.save([...notificationRecipients].map(([recipientId, type]) => manager.create(TaskNotification, {
        recipientId,
        taskId: id,
        commentId: saved.id,
        eventId: null,
        type,
        readAt: null,
      })));
      const assignments = await manager.find(TaskAssignee, { where: { taskId: id }, relations: { user: true } });
      const mentioned = mentionedUserIds.length ? await manager.findBy(User, { id: In(mentionedUserIds) }) : [];
      const recipients = new Map<string, User>();
      for (const assignment of assignments) if (assignment.userId !== actor.id) recipients.set(assignment.userId, assignment.user);
      for (const user of mentioned) if (user.id !== actor.id) recipients.set(user.id, user);
      await this.email.queue(manager, [...recipients.values()].map((recipient) => ({
        recipient,
        eventType: mentionedUserIds.includes(recipient.id) ? 'TASK_MENTIONED' : 'TASK_COMMENTED',
        dedupeKey: `task-comment:${saved.id}:${recipient.id}`,
        subject: `[Auto2Tech] ${mentionedUserIds.includes(recipient.id) ? 'Bạn được nhắc tới' : 'Cập nhật'}: ${task.title}`,
        payload: { actorName: actor.displayName, topic: task.title, bodyPreview: body.slice(0, 240), appUrl: this.appUrl() },
      })));
      return saved;
    });
    const result = await this.comments.findOne({ where: { id: comment.id }, relations: { author: true, mentions: { user: true } } });
    this.realtime.emitTask('task.comment.created', result);
    return result;
  }

  async commentImage(commentId: string) {
    const comment = await this.comments.createQueryBuilder('comment').addSelect('comment.imageData').where('comment.id = :commentId', { commentId }).getOne();
    if (!comment?.imageData || !comment.imageMimeType) throw new NotFoundException('Không tìm thấy ảnh comment');
    return { mimeType: comment.imageMimeType, data: comment.imageData };
  }

  async create(dto: CreateTaskDto, actor: AuthUser) {
    const task = await this.dataSource.transaction(async (manager) => {
      const created = await this.createBacklogTask(manager, dto, actor);
      await this.queueTaskAssigned(manager, created.id, dto.title, dto.assigneeIds, actor);
      return created;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.created', result);
    return result;
  }

  async done(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    return this.complete(id, actor);
  }

  async setDraftPriority(id: string, priority: TaskPriority, actor: AuthUser) {
    this.assertAdmin(actor);
    if (!Object.values(TaskPriority).includes(priority)) throw new BadRequestException('Mức ưu tiên không hợp lệ');
    const { draft, changed } = await this.dataSource.transaction(async manager => {
      const draft = await manager.findOne(TaskDraft, { where: { id, deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } });
      if (!draft) throw new NotFoundException('Draft was already completed or removed');
      if (draft.priority === priority) return { draft, changed: false };
      draft.priority = priority;
      return { draft: await manager.save(draft), changed: true };
    });
    if (changed) this.realtime.emitTask('task.draft.updated', draft);
    return draft;
  }

  async setPriority(id: string, priority: TaskPriority, actor: AuthUser) {
    this.assertAdmin(actor);
    if (!Object.values(TaskPriority).includes(priority)) throw new BadRequestException('Mức ưu tiên không hợp lệ');
    const changed = await this.dataSource.transaction(async manager => {
      const task = await this.lock(manager, id);
      if (task.status === TaskStatus.ARCHIVED) throw new BadRequestException('Không đổi ưu tiên Task đã lưu trữ');
      if (task.priority === priority) return false;
      const from = task.priority;
      task.priority = priority;
      await manager.save(task);
      await this.audit(manager, id, actor.id, TaskEventType.EDITED, { changes: { priority: { from, to: priority } } });
      return true;
    });
    const result = await this.getVisible(id);
    if (changed) this.realtime.emitTask('task.updated', result);
    return result;
  }

  async setStatus(id: string, status: TaskStatus, actor: AuthUser) {
    this.assertAdmin(actor);
    if (!ADMIN_TASK_STATUSES.includes(status)) throw new BadRequestException('Trạng thái Task không hợp lệ');
    const changed = await this.dataSource.transaction(async manager => {
      const task = await this.lock(manager, id);
      if (!ADMIN_TASK_STATUSES.includes(task.status)) throw new BadRequestException('Không đổi trạng thái Task đã lưu trữ');
      if (task.status === status) return false;
      const from = task.status;
      const previousMilestones = { doneById: task.doneById, doneAt: task.doneAt, completedById: task.completedById, completedAt: task.completedAt, reviewResult: task.reviewResult };
      const now = new Date();
      task.status = status;
      task.reviewResult = status === TaskStatus.DONE ? TaskReviewResult.PENDING : null;
      if (status === TaskStatus.BACKLOG || status === TaskStatus.ACTIVE) {
        task.doneById = null;
        task.doneAt = null;
      } else {
        task.doneById = status === TaskStatus.COMPLETE ? task.doneById ?? actor.id : actor.id;
        task.doneAt = status === TaskStatus.COMPLETE ? task.doneAt ?? now : now;
      }
      task.completedById = status === TaskStatus.COMPLETE ? actor.id : null;
      task.completedAt = status === TaskStatus.COMPLETE ? now : null;
      await manager.save(task);
      await this.audit(manager, id, actor.id, TaskEventType.EDITED, {
        source: 'ADMIN_STATUS_CHANGE', changes: { status: { from, to: status } }, previousMilestones,
      });
      return true;
    });
    const result = await this.getVisible(id);
    if (changed) this.realtime.emitTask('task.updated', result);
    return result;
  }

  async moveToBacklog(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const task = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      if (![TaskStatus.ACTIVE, TaskStatus.DONE].includes(locked.status)) throw new BadRequestException('Only active task may return to Backlog');
      const from = locked.status;
      locked.status = TaskStatus.BACKLOG;
      locked.doneById = null;
      locked.doneAt = null;
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.EDITED, { changes: { status: { from, to: TaskStatus.BACKLOG } } });
      return locked;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.updated', result);
    return result;
  }

  async start(id: string, actor: AuthUser) {
    const task = await this.mutate(id, actor, TaskStatus.BACKLOG, async (manager, locked) => {
      locked.status = TaskStatus.ACTIVE;
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.EDITED, { changes: { status: { from: TaskStatus.BACKLOG, to: TaskStatus.ACTIVE } } });
    });
    this.realtime.emitTask('task.updated', task);
    return task;
  }

  async startFromWorklog(taskIds: string[], actor: AuthUser, worklogId: string) {
    const ids = [...new Set(taskIds)];
    if (!ids.length) return [];
    const startedIds = await this.dataSource.transaction(async (manager) => {
      const linkedTasks = await manager.createQueryBuilder(Task, 'task')
        .setLock('pessimistic_write')
        .where('task.id IN (:...ids)', { ids })
        .andWhere('task.deletedAt IS NULL')
        .getMany();
      const tasksToStart = linkedTasks.filter((task) => [TaskStatus.BACKLOG, TaskStatus.DONE].includes(task.status));
      for (const task of tasksToStart) {
        const from = task.status;
        task.status = TaskStatus.ACTIVE;
        task.doneById = null;
        task.doneAt = null;
        await manager.save(task);
        await this.audit(manager, task.id, actor.id, from === TaskStatus.DONE ? TaskEventType.REOPENED : TaskEventType.EDITED, {
          changes: { status: { from, to: TaskStatus.ACTIVE } },
          source: 'WORKLOG_LINKED',
          worklogId,
        });
      }
      return tasksToStart.map((task) => task.id);
    });
    const started = await Promise.all(startedIds.map((id) => this.getVisible(id)));
    for (const task of started) this.realtime.emitTask('task.updated', task);
    return started;
  }

  async requestReviewFromWorklog(id: string, actor: AuthUser, worklogId: string) {
    const task = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      if (locked.status === TaskStatus.DONE) return locked;
      if (![TaskStatus.BACKLOG, TaskStatus.ACTIVE].includes(locked.status)) throw new BadRequestException('Chỉ Task đang mở mới được gửi Review');
      const from = locked.status;
      locked.status = TaskStatus.DONE;
      locked.reviewResult = TaskReviewResult.PENDING;
      locked.doneById = actor.id;
      locked.doneAt = new Date();
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.REVIEWED, {
        from,
        to: TaskStatus.DONE,
        source: 'WORKLOG',
        worklogId,
      });
      return locked;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.updated', result);
    return result;
  }

  async requestReview(id: string, actor: AuthUser) {
    const task = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      if (locked.status === TaskStatus.DONE) return locked;
      if (![TaskStatus.BACKLOG, TaskStatus.ACTIVE].includes(locked.status)) throw new BadRequestException('Chỉ Task đang mở mới được gửi Review');
      const assigned = await manager.getRepository(TaskAssignee).exist({ where: { taskId: id, userId: actor.id } });
      if (!canDoneTask(actor.role, assigned)) throw new ForbiddenException('Chỉ Admin hoặc người được giao Task mới được gửi Review');
      const completedWorklogs = await manager.getRepository(Worklog).createQueryBuilder('worklog')
        .innerJoin('worklog.tasks', 'sourceTask', 'sourceTask.id = :taskId', { taskId: id })
        .where('worklog.deletedAt IS NULL')
        .andWhere('worklog.status = :status', { status: WorklogStatus.DONE })
        .getCount();
      if (!completedWorklogs) throw new BadRequestException('Task cần ít nhất một Worklog HOÀN THÀNH trước khi gửi Review');
      const from = locked.status;
      locked.status = TaskStatus.DONE;
      locked.reviewResult = TaskReviewResult.PENDING;
      locked.doneById = actor.id;
      locked.doneAt = new Date();
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.REVIEWED, { from, to: TaskStatus.DONE, source: 'TASK_MENU' });
      return locked;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.updated', result);
    return result;
  }

  async update(id: string, dto: UpdateTaskDto, actor: AuthUser) {
    this.assertAdmin(actor);
    await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      requireTaskEditable(locked.status);
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      if (dto.title !== undefined) {
        const title = dto.title.trim();
        if (!title) throw new BadRequestException('Title is required');
        if (title !== locked.title) changes.title = { from: locked.title, to: title };
        locked.title = title;
      }
      if (dto.note !== undefined) {
        const note = dto.note.trim();
        if (!note) throw new BadRequestException('Description is required');
        if (note !== locked.note) changes.note = { from: locked.note, to: note };
        locked.note = note;
      }
      if (dto.suggestion !== undefined) {
        const suggestion = dto.suggestion?.trim() || null;
        if (suggestion !== locked.suggestion) changes.suggestion = { from: locked.suggestion, to: suggestion };
        locked.suggestion = suggestion;
      }
      if (dto.assigneeIds !== undefined) {
        const uniqueIds = [...new Set(dto.assigneeIds)];
        if (uniqueIds.length) assigneeShares(uniqueIds.length);
        const previous = await manager.find(TaskAssignee, { where: { taskId: id }, order: { position: 'ASC' } });
        const previousIds = previous.map((assignment) => assignment.userId);
        const addedIds = uniqueIds.filter(userId => !previousIds.includes(userId));
        if (addedIds.length) await this.assertWorkplaceAssignees(manager, addedIds);
        if (previousIds.join(',') !== uniqueIds.join(',')) {
          changes.assigneeIds = { from: previousIds, to: uniqueIds };
          const shares = uniqueIds.length ? assigneeShares(uniqueIds.length) : [];
          await manager.delete(TaskAssignee, { taskId: id });
          if (uniqueIds.length) await manager.save(uniqueIds.map((userId, position) => manager.create(TaskAssignee, { taskId: id, userId, position, sharePercent: shares[position].toString(), assignedById: actor.id })));
        }
      }
      if (dto.criteria !== undefined) {
        const existing = await manager.find(TaskCriterion, { where: { taskId: id } });
        const criteria = this.normalizeCriteria(dto.criteria);
        const previousCriteria = existing.sort((a, b) => a.position - b.position).map((criterion) => criterion.text);
        if (previousCriteria.join('\n') !== criteria.join('\n')) changes.criteria = { from: previousCriteria, to: criteria };
        await manager.delete(TaskCriterion, { taskId: id });
        await manager.save(criteria.map((text, position) => manager.create(TaskCriterion, { taskId: id, text, position })));
      }
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.EDITED, { ...dto, changes });
    });
    const result = await this.getVisible(id);
    this.realtime.emitTask('task.updated', result);
    return result;
  }

  async reopen(id: string, actor: AuthUser) {
    const task = await this.mutate(id, actor, TaskStatus.DONE, async (manager, locked) => {
      if(actor.role!==UserRole.ADMIN){
        const assigned=await manager.existsBy(TaskAssignee,{taskId:id,userId:actor.id});
        if(!assigned||locked.reviewResult!==TaskReviewResult.FAILED)throw new ForbiddenException('Dev chỉ mở lại Task được giao khi Review KHÔNG ĐẠT');
      }
      locked.status = TaskStatus.ACTIVE; locked.doneById = null; locked.doneAt = null;
      locked.reviewResult=null;
      await manager.save(locked); await this.audit(manager, id, actor.id, TaskEventType.REOPENED,{source:'STATUS_DROPDOWN',reviewResult:TaskReviewResult.FAILED});
    });
    this.realtime.emitTask('task.reopened', task); return task;
  }

  async reportRisk(id: string, actor: AuthUser) {
    const task = await this.mutate(id, actor, TaskStatus.ACTIVE, async (manager, locked) => {
      const assigned = await manager.existsBy(TaskAssignee, { taskId: id, userId: actor.id });
      if (!canDoneTask(actor.role, assigned)) throw new ForbiddenException('Only an assignee or Admin may report risk');
      if (!locked.riskReportedAt) {
        locked.riskReportedAt = new Date();
        locked.riskReportedById = actor.id;
        await manager.save(locked);
        await this.audit(manager, id, actor.id, TaskEventType.RISK_REPORTED);
      }
    });
    this.realtime.emitTask('task.updated', task);
    return task;
  }

  async review(id: string, dto: ReviewTaskDto, actor: AuthUser) {
    void dto;
    return this.complete(id, actor);
  }

  async failReview(id: string, dto: FailTaskReviewDto, actor: AuthUser) {
    this.assertAdmin(actor);
    const reason = dto.reason?.trim() || 'Task không đạt';
    const task = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      if (locked.status === TaskStatus.ARCHIVED) throw new BadRequestException('Không đổi trạng thái Task đã lưu trữ');
      if (locked.status === TaskStatus.DONE && locked.reviewResult === TaskReviewResult.FAILED) return locked;
      const from = locked.status;
      const previousMilestones = { doneAt: locked.doneAt, doneById: locked.doneById, completedAt: locked.completedAt, completedById: locked.completedById };
      locked.status = TaskStatus.DONE;
      locked.reviewResult = TaskReviewResult.FAILED;
      locked.doneAt ??= new Date(); locked.doneById ??= actor.id;
      locked.completedAt = null; locked.completedById = null;
      await manager.save(locked);
      const comment = await manager.save(manager.create(TaskComment, { taskId: id, authorId: actor.id, body: dto.reason?.trim() ? `KHÔNG ĐẠT: ${reason}` : reason }));
      const assignments = await manager.find(TaskAssignee, { where: { taskId: id } });
      const recipients = assignments.filter((assignment) => assignment.userId !== actor.id);
      if (recipients.length) await manager.save(recipients.map((assignment) => manager.create(TaskNotification, {
        recipientId: assignment.userId,
        taskId: id,
        commentId: comment.id,
        eventId: null,
        type: TaskNotificationType.COMMENT,
        readAt: null,
      })));
      await this.audit(manager, id, actor.id, TaskEventType.REVIEWED, { result: TaskReviewResult.FAILED, reason, taskTitle: locked.title, assigneeIds: assignments.map(assignment => assignment.userId), changes: { status: { from, to: TaskStatus.DONE } }, previousMilestones });
      return locked;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.updated', result);
    return result;
  }

  async resetReview(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const task = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      if (locked.status !== TaskStatus.DONE) throw new BadRequestException('Task cần ở trạng thái CHỜ REVIEW');
      locked.reviewResult = TaskReviewResult.PENDING;
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.REVIEWED, { result: TaskReviewResult.PENDING });
      return locked;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.updated', result);
    return result;
  }

  async complete(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const task = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lock(manager, id);
      if (locked.status !== TaskStatus.DONE) throw new BadRequestException('Task cần ở trạng thái CHỜ REVIEW trước khi Complete');
      const from = locked.status;
      locked.status = TaskStatus.COMPLETE;
      locked.reviewResult = null;
      locked.doneById = actor.id;
      locked.doneAt = new Date();
      locked.completedById = actor.id;
      locked.completedAt = new Date();
      await manager.save(locked);
      await this.audit(manager, id, actor.id, TaskEventType.COMPLETED, { from, to: TaskStatus.COMPLETE });
      return locked;
    });
    const result = await this.getVisible(task.id);
    this.realtime.emitTask('task.completed', result);
    return result;
  }

  async undoComplete(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const task = await this.mutate(id, actor, TaskStatus.COMPLETE, async (manager, locked) => {
      locked.status = TaskStatus.ACTIVE;
      locked.doneById = null;
      locked.doneAt = null;
      locked.completedById = null;
      locked.completedAt = null;
      locked.basePoint = null;
      locked.earnedPoint = null;
      locked.completionRate = null;
      locked.dueRate = null;
      locked.qualityRate = null;
      locked.reliabilityRate = null;
      locked.wasLate = null;
      locked.evaluatedDueDate = null;
      locked.evaluatedDoneAt = null;
      await manager.save(locked);
      await manager.update(TaskCriterion, { taskId: id }, { passed: false, firstReviewPassed: null });
      await this.audit(manager, id, actor.id, TaskEventType.REOPENED, { reason: 'Admin undid Complete', from: TaskStatus.COMPLETE, to: TaskStatus.ACTIVE });
    });
    this.realtime.emitTask('task.reopened', task);
    return task;
  }

  async remove(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const task = await this.dataSource.transaction(async (manager) => { const locked = await this.lock(manager, id); locked.deletedAt = new Date(); locked.deletedById = actor.id; await manager.save(locked); await this.audit(manager, id, actor.id, TaskEventType.DELETED); return locked; });
    this.realtime.emitTask('task.deleted', { id: task.id }); return { id: task.id };
  }

  async archive(id: string, actor: AuthUser) {
    this.assertAdmin(actor);
    const task = await this.mutate(id, actor, TaskStatus.COMPLETE, async (manager, locked) => { locked.status = TaskStatus.ARCHIVED; locked.archivedAt = new Date(); locked.archivedById = actor.id; await manager.save(locked); await this.audit(manager, id, actor.id, TaskEventType.ARCHIVED); });
    this.realtime.emitTask('task.archived', { id: task.id }); return { id: task.id };
  }

  private assertAdmin(actor: AuthUser) { requireAdmin(actor.role); }
  private notificationView(notification: TaskNotification) {
    if (notification.comment) {
      const mention = notification.type === TaskNotificationType.MENTION;
      return {
        kind: mention ? TaskNotificationType.MENTION : TaskNotificationType.COMMENT,
        personalKind: personalTaskNotificationKind({ notificationType: notification.type, recipientId: notification.recipientId }),
        id: notification.id,
        taskId: notification.taskId,
        commentId: notification.commentId,
        eventType: null,
        topic: notification.task.title,
        message: mention ? 'nhắc bạn trong' : 'đã bình luận trong',
        bodyPreview: notification.comment.body.slice(0, 160),
        actorName: notification.comment.author.displayName,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      };
    }
    if (!notification.event) throw new Error('Task notification source is missing');
    return {
      kind: TaskNotificationType.EVENT,
      personalKind: personalTaskNotificationKind({ notificationType: notification.type, recipientId: notification.recipientId, eventType: notification.event.type, payload: notification.event.payload }),
      id: notification.id,
      taskId: notification.taskId,
      commentId: null,
      eventType: notification.event.type,
      topic: notification.task.title,
      message: this.eventMessage(notification.event),
      bodyPreview: this.eventPreview(notification.event),
      actorName: notification.event.actor.displayName,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
  private eventMessage(event: TaskEvent) {
    if (event.type === TaskEventType.CREATED) return event.payload?.selfClaimed ? 'đã nhận' : 'đã giao';
    if (event.type === TaskEventType.EDITED) return 'đã cập nhật';
    if (event.type === TaskEventType.RISK_REPORTED) return 'đã báo rủi ro cho';
    if (event.type === TaskEventType.DONE) return 'đã báo Done';
    if (event.type === TaskEventType.REVIEWED) return 'đã gửi Review';
    if (event.type === TaskEventType.REOPENED) return 'đã mở lại';
    if (event.type === TaskEventType.COMPLETED) return 'đã Complete';
    return 'đã cập nhật';
  }
  private eventPreview(event: TaskEvent) {
    const payload = event.payload ?? {};
    if (event.type === TaskEventType.EDITED) {
      const changes = (payload.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
      const parts: string[] = [];
      if (changes.point) parts.push(`Point ${changes.point.from ?? '—'} → ${changes.point.to ?? '—'}`);
      if (changes.dueDate) parts.push(`Due date ${changes.dueDate.from ?? '—'} → ${changes.dueDate.to ?? '—'}`);
      if (changes.suggestion) parts.push('Gợi ý đã thay đổi');
      if (changes.criteria) parts.push('Xong khi đã thay đổi');
      if (changes.assigneeIds) parts.push('Người phụ trách đã thay đổi');
      if (changes.status) parts.push(`Trạng thái ${changes.status.from} → ${changes.status.to}`);
      if (changes.priority) {
        const labels: Record<string, string> = { HIGH: 'Cao', NORMAL: 'Bình thường', LOW: 'Thấp' };
        parts.push(`Ưu tiên ${labels[String(changes.priority.from)] ?? 'Bình thường'} → ${labels[String(changes.priority.to)] ?? changes.priority.to}`);
      }
      return parts.join(' · ');
    }
    if (event.type === TaskEventType.CREATED) return event.payload?.selfClaimed ? 'Task đã được chuyển từ Backlog vào Đang làm' : 'Task mới đã được giao';
    if (event.type === TaskEventType.RISK_REPORTED) return 'Task cần Admin chú ý';
    if (event.type === TaskEventType.DONE) return 'Task đang chờ Admin review';
    if (event.type === TaskEventType.REVIEWED) return 'Task đang chờ Admin review';
    if (event.type === TaskEventType.REOPENED) return String(payload.reason ?? 'Task cần tiếp tục xử lý');
    if (event.type === TaskEventType.COMPLETED) return 'Task đã được Admin Complete';
    return '';
  }
  private async createBacklogTask(manager: EntityManager, dto: CreateTaskDto, actor: AuthUser, source: Record<string, unknown> = {}, priority = TaskPriority.NORMAL) {
    const uniqueIds = [...new Set(dto.assigneeIds)];
    await this.assertWorkplaceAssignees(manager, uniqueIds);
    const criteria = this.normalizeCriteria(dto.criteria);
    const shares = assigneeShares(uniqueIds.length);
    const created = manager.create(Task, {
      title: dto.title.trim(),
      priority,
      note: dto.note.trim(),
      suggestion: dto.suggestion?.trim() || null,
      status: TaskStatus.BACKLOG,
      dueDate: null,
      point: null,
      ...this.factorColumns(),
      createdById: actor.id,
      assignees: uniqueIds.map((userId, position) => manager.create(TaskAssignee, { userId, position, sharePercent: shares[position].toString(), assignedById: actor.id })),
      criteria: criteria.map((text, position) => manager.create(TaskCriterion, { text, position })),
    });
    const saved = await manager.save(created);
    await this.audit(manager, saved.id, actor.id, TaskEventType.CREATED, { assigneeIds: uniqueIds, criteriaCount: criteria.length, ...source });
    return saved;
  }
  private async getVisible(id: string) { const task = await this.tasks.findOne({ where: { id, deletedAt: IsNull() }, relations: { assignees: { user: true }, criteria: true } }); if (!task) throw new NotFoundException(); return (await this.withCommentCounts([task]))[0]; }
  private async withCommentCounts(tasks: Task[]) {
    if (!tasks.length) return tasks;
    const ids = tasks.map((task) => task.id);
    const failedIds = tasks.filter(task => task.status === TaskStatus.DONE && task.reviewResult === TaskReviewResult.FAILED).map(task => task.id);
    const [commentRows, worklogRows, failedReviewRows] = await Promise.all([
      this.comments.createQueryBuilder('comment').select('comment.taskId', 'taskId').addSelect('COUNT(*)', 'count').where('comment.taskId IN (:...ids)', { ids }).groupBy('comment.taskId').getRawMany<{ taskId: string; count: string }>(),
      this.dataSource.getRepository(Worklog).createQueryBuilder('worklog')
        .innerJoin('worklog.tasks', 'sourceTask')
        .select('sourceTask.id', 'taskId')
        .addSelect('COUNT(DISTINCT worklog.id)', 'count')
        .addSelect('COALESCE(SUM(worklog.hoursWorked), 0)', 'hours')
        .where('sourceTask.id IN (:...ids)', { ids })
        .andWhere('worklog.deletedAt IS NULL')
        .groupBy('sourceTask.id')
        .getRawMany<{ taskId: string; count: string; hours: string }>(),
      failedIds.length ? this.dataSource.getRepository(TaskEvent).createQueryBuilder('event')
        .distinctOn(['event.taskId'])
        .select('event.taskId', 'taskId')
        .addSelect("event.payload ->> 'reason'", 'reason')
        .addSelect('event.createdAt', 'reviewedAt')
        .leftJoin('event.actor', 'actor')
        .addSelect('actor.displayName', 'reviewerName')
        .where('event.taskId IN (:...failedIds)', { failedIds })
        .andWhere('event.type = :type', { type: TaskEventType.REVIEWED })
        .andWhere("event.payload ->> 'result' = :result", { result: TaskReviewResult.FAILED })
        .orderBy('event.taskId', 'ASC').addOrderBy('event.createdAt', 'DESC').addOrderBy('event.id', 'DESC')
        .getRawMany<{ taskId: string; reason: string | null; reviewedAt: Date; reviewerName: string | null }>() : [],
    ]);
    const failedReviews = new Map(failedReviewRows.map(({ taskId, ...review }) => [taskId, review]));
    const commentCounts = new Map(commentRows.map((row) => [row.taskId, Number(row.count)]));
    const worklogCounts = new Map(worklogRows.map((row) => [row.taskId, { count: Number(row.count), hours: Number(row.hours) }]));
    for (const task of tasks) {
      const evidence = worklogCounts.get(task.id);
      task.commentCount = commentCounts.get(task.id) ?? 0;
      task.worklogCount = evidence?.count ?? 0;
      task.worklogHours = evidence?.hours ?? 0;
      task.failedReview = failedReviews.get(task.id) ?? null;
      task.assignees?.sort((a, b) => a.position - b.position);
      task.criteria?.sort((a, b) => a.position - b.position);
    }
    return tasks;
  }
  private normalizeCriteria(values: string[]) {
    const criteria = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    if (!criteria.length) throw new BadRequestException('Task needs at least one acceptance criterion');
    if (criteria.length > 10) throw new BadRequestException('Task supports up to 10 acceptance criteria');
    return criteria;
  }
  private factorColumns(factors?: TaskPointFactorsDto) {
    return {
      outputScopeScore: factors?.outputScope ?? null,
      complexityScore: factors?.complexity ?? null,
      uncertaintyScore: factors?.uncertainty ?? null,
      riskScore: factors?.risk ?? null,
      verificationScore: factors?.verification ?? null,
    };
  }
  private async assertWorkplaceAssignees(manager: EntityManager, ids: string[]) {
    assigneeShares(ids.length);
    const users = await manager.createQueryBuilder(User, 'user').where('user.id IN (:...ids)', { ids }).andWhere('user.isActive = true').getMany();
    if (users.length !== ids.length) throw new BadRequestException('Every assignee must be an active user');
    if (users.some((user) => !WORKPLACE_DEVELOPERS.has(user.username))) throw new BadRequestException('Workplace Dev only includes THẮNG, VINH and PHÚ');
  }
  private async queueTaskAssigned(manager: EntityManager, taskId: string, topic: string, assigneeIds: string[], actor: AuthUser) {
    const recipients = await manager.findBy(User, { id: In([...new Set(assigneeIds)]) });
    await this.email.queue(manager, recipients.filter((recipient) => recipient.id !== actor.id).map((recipient) => ({
      recipient,
      eventType: 'TASK_ASSIGNED',
      dedupeKey: `task-assigned:${taskId}:${recipient.id}`,
      subject: `[Auto2Tech] Task mới: ${topic}`,
      payload: { actorName: actor.displayName, topic, appUrl: this.appUrl() },
    })));
  }
  private appUrl() { return process.env.APP_PUBLIC_URL ?? 'https://auto2tech-app-production.up.railway.app'; }
  private async lock(manager: EntityManager, id: string) { const task = await manager.findOne(Task, { where: { id, deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } }); if (!task) throw new NotFoundException(); return task; }
  private async mutate(id: string, actor: AuthUser, expected: TaskStatus, action: (manager: EntityManager, task: Task) => Promise<void>) { await this.dataSource.transaction(async (manager) => { const task = await this.lock(manager, id); if (task.status !== expected) throw new BadRequestException(`Task must be ${expected}`); await action(manager, task); }); return this.getVisible(id); }
  private async audit(manager: EntityManager, taskId: string, actorId: string, type: TaskEventType, payload: Record<string, unknown> | null = null) {
    const event = await manager.save(manager.create(TaskEvent, { taskId, actorId, type, payload }));
    await this.createEventNotifications(manager, event);
    return event;
  }
  private async createEventNotifications(manager: EntityManager, event: TaskEvent) {
    const supported = new Set([TaskEventType.CREATED, TaskEventType.EDITED, TaskEventType.RISK_REPORTED, TaskEventType.DONE, TaskEventType.REVIEWED, TaskEventType.REOPENED, TaskEventType.COMPLETED]);
    if (!supported.has(event.type)) return;
    const changes = ((event.payload ?? {}).changes ?? {}) as Record<string, unknown>;
    const materialFields = ['title', 'note', 'suggestion', 'criteria', 'assigneeIds', 'status'];
    if (event.type === TaskEventType.EDITED && !materialFields.some((field) => changes[field] !== undefined)) return;

    const recipientIds = new Set<string>();
    const admins = await manager.findBy(User, { role: UserRole.ADMIN, isActive: true });
    for (const admin of admins) recipientIds.add(admin.id);

    if ([TaskEventType.CREATED, TaskEventType.EDITED, TaskEventType.REOPENED, TaskEventType.COMPLETED].includes(event.type)) {
      const assignments = await manager.find(TaskAssignee, { where: { taskId: event.taskId } });
      for (const assignment of assignments) if (assignment.userId !== event.actorId) recipientIds.add(assignment.userId);
      if (event.type === TaskEventType.EDITED) {
        const previousAssignees = (changes.assigneeIds as { from?: unknown[] } | undefined)?.from ?? [];
        for (const userId of previousAssignees) if (typeof userId === 'string' && userId !== event.actorId) recipientIds.add(userId);
      }
    }
    if (!recipientIds.size) return;
    await manager.createQueryBuilder().insert().into(TaskNotification).values([...recipientIds].map((recipientId) => ({
      recipientId,
      taskId: event.taskId,
      commentId: null,
      eventId: event.id,
      type: TaskNotificationType.EVENT,
      readAt: null,
    }))).orIgnore().execute();
  }
}

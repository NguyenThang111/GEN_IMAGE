import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../auth/auth.types';
import { SystemNotificationModule } from '../notifications/system-notification.entity';
import { SystemNotificationsService } from '../notifications/system-notifications.service';
import { RealtimeGateway } from '../tasks/realtime.gateway';
import { Task, TaskReviewResult, TaskStatus } from '../tasks/task.entity';
import { TasksService } from '../tasks/tasks.service';
import { User, UserRole } from '../users/user.entity';
import { CreateWorklogCommentDto, SaveWorklogDto, SaveWorklogWeekDto, ScoreWorklogDto } from './worklog.dto';
import { WorklogCommentMention } from './worklog-comment-mention.entity';
import { WorklogComment } from './worklog-comment.entity';
import { Worklog, WorklogOutputCriterion, WorklogStabilityStatus, WorklogStatus, WorklogType } from './worklog.entity';
import { WorklogWeek, WorklogWeekSnapshot, WorklogWeekStatus } from './worklog-week.entity';
import { calculateWorklogPoint, isMemberCreatableVietnamWorkDate, isWorklogDev, summarizeWorklogs, vietnamSprintStart, vietnamWorkDate, WORKLOG_VALUE_RATE, worklogStabilityRate } from './worklog.policy';

@Injectable()
export class WorklogsService {
  constructor(
    @InjectRepository(Worklog) private readonly worklogs: Repository<Worklog>,
    @InjectRepository(WorklogWeek) private readonly worklogWeeks: Repository<WorklogWeek>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly taskLifecycle: TasksService,
    private readonly realtime: RealtimeGateway,
    private readonly dataSource: DataSource,
    private readonly systemNotifications: SystemNotificationsService,
  ) {}

  private monthKey(month?: string) {
    const currentParts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const currentYear = currentParts.find((part) => part.type === 'year')?.value;
    const currentMonth = currentParts.find((part) => part.type === 'month')?.value;
    const value = month ?? `${currentYear}-${currentMonth}`;
    if (!/^\d{4}-\d{2}$/.test(value)) throw new BadRequestException('Tháng không hợp lệ');
    const [year, number] = value.split('-').map(Number);
    if (number < 1 || number > 12) throw new BadRequestException('Tháng không hợp lệ');
    const next = new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7);
    return { value, from: new Date(`${value}-01T00:00:00+07:00`), to: new Date(`${next}-01T00:00:00+07:00`) };
  }

  private weekRange(weekStart: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || vietnamSprintStart(`${weekStart}T12:00:00+07:00`) !== weekStart) {
      throw new BadRequestException('Sprint phải bắt đầu đúng chu kỳ 14 ngày');
    }
    const end = new Date(`${weekStart}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 13);
    const weekEnd = end.toISOString().slice(0, 10);
    return {
      weekStart,
      weekEnd,
      from: new Date(`${weekStart}T00:00:00+07:00`),
      to: new Date(`${weekEnd}T23:59:59.999+07:00`),
    };
  }

  private async weekRows(weekStart: string) {
    const range = this.weekRange(weekStart);
    return this.worklogs.createQueryBuilder('worklog')
      .leftJoinAndSelect('worklog.tasks', 'task')
      .where('worklog.startedAt >= :from AND worklog.startedAt <= :to', { from: range.from, to: range.to })
      .andWhere('worklog.deletedAt IS NULL')
      .orderBy('worklog.startedAt', 'DESC')
      .getMany();
  }

  private weekSnapshot(rows: Worklog[], members: User[]): WorklogWeekSnapshot {
    const summary = summarizeWorklogs(rows, members.map((member) => ({ id: member.id, username: member.username, displayName: member.displayName })));
    const taskTitles = [...new Set(rows.flatMap((row) => row.tasks ?? []).map((task) => task.title))];
    const outputCriteria = rows.flatMap((row) => row.outputCriteria ?? []);
    return {
      worklogCount: rows.length,
      totalHours: Number(rows.reduce((sum, row) => sum + Number(row.hoursWorked ?? 0), 0).toFixed(2)),
      outputAchieved: outputCriteria.filter((criterion) => criterion.achieved === true).length,
      outputTotal: outputCriteria.length,
      point: summary.reduce((sum, member) => sum + member.point, 0),
      pendingStabilityPoint: summary.reduce((sum, member) => sum + member.pendingStabilityPoint, 0),
      taskCount: taskTitles.length,
      taskTitles,
      summary,
    };
  }

  private async assertMemberWeekOpen(value: Date | string, actor: AuthUser) {
    if (actor.role === UserRole.ADMIN) return;
    const cycle = await this.worklogWeeks.findOneBy({ weekStart: vietnamSprintStart(value) });
    if (cycle?.status === WorklogWeekStatus.CLOSED) throw new ForbiddenException('Sprint đã chốt; Member chỉ được xem Worklog');
  }

  private async assertCurrentSprintOpenForCreate(value:Date|string){
    const requestedSprint=vietnamSprintStart(value);
    if(requestedSprint!==vietnamSprintStart(new Date()))throw new ForbiddenException('Chỉ được tạo Worklog trong Sprint hiện tại');
    const cycle=await this.worklogWeeks.findOneBy({weekStart:requestedSprint});
    if(cycle?.status===WorklogWeekStatus.CLOSED)throw new ForbiddenException('Sprint đã chốt; không thể tạo Worklog mới');
  }

  async dashboard(month?: string, sprintStart?: string) {
    const range = this.monthKey(month);
    const requestedSprint = sprintStart ? this.weekRange(sprintStart) : null;
    const rowsFrom = requestedSprint?.from ?? range.from;
    const rowsTo = requestedSprint ? new Date(requestedSprint.to.getTime() + 1) : range.to;
    const cycleQuery = this.worklogWeeks.createQueryBuilder('week').leftJoinAndSelect('week.closedBy', 'closedBy');
    if (requestedSprint) cycleQuery.where('week.weekStart = :sprintStart', { sprintStart: requestedSprint.weekStart });
    else cycleQuery.where('week.weekEnd >= :from AND week.weekStart < :to', { from: range.value + '-01', to: range.to.toISOString().slice(0, 10) });
    const [members, rows, reopenCandidates, threadRows, weekCycles] = await Promise.all([
      this.users.find({ where: { isActive: true }, order: { displayName: 'ASC' } }),
      this.worklogs.createQueryBuilder('worklog')
        .leftJoinAndSelect('worklog.user', 'user')
        .leftJoinAndSelect('worklog.createdBy', 'createdBy')
        .leftJoinAndSelect('worklog.tasks', 'task')
        .leftJoinAndSelect('worklog.primaryTask', 'primaryTask')
        .leftJoinAndSelect('worklog.reopenedWorklog', 'reopenedWorklog')
        .leftJoinAndSelect('worklog.comments', 'comment')
        .leftJoinAndSelect('comment.author', 'commentAuthor')
        .leftJoinAndSelect('comment.mentions', 'commentMention')
        .leftJoinAndSelect('commentMention.user', 'commentMentionUser')
        .where('worklog.startedAt >= :from AND worklog.startedAt < :to', { from: rowsFrom, to: rowsTo })
        .andWhere('worklog.deletedAt IS NULL')
        .orderBy('worklog.startedAt', 'DESC')
        .addOrderBy('comment.createdAt', 'ASC')
        .getMany(),
      this.worklogs.createQueryBuilder('worklog')
        .leftJoinAndSelect('worklog.user', 'user')
        .where('worklog.status = :status', { status: WorklogStatus.DONE })
        .andWhere('worklog.workType <> :workType', { workType: WorklogType.REOPEN })
        .andWhere('worklog.deletedAt IS NULL')
        .orderBy('worklog.startedAt', 'DESC')
        .take(100)
        .getMany(),
      this.worklogs.createQueryBuilder('worklog')
        .leftJoinAndSelect('worklog.primaryTask', 'primaryTask')
        .leftJoinAndSelect('worklog.user', 'threadUser')
        .where('worklog.primaryTaskId IS NOT NULL')
        .andWhere('worklog.deletedAt IS NULL')
        .orderBy('worklog.startedAt', 'ASC')
        .getMany(),
      cycleQuery.orderBy('week.weekStart', 'DESC').getMany(),
    ]);
    const summaryMembers = members.map((member) => ({ id: member.id, username: member.username, displayName: member.displayName }));
    const rowsByWeek = new Map<string, Worklog[]>();
    for (const row of rows) {
      const key = vietnamSprintStart(row.startedAt);
      rowsByWeek.set(key, [...(rowsByWeek.get(key) ?? []), row]);
    }
    const cyclesByStart = new Map(weekCycles.map((cycle) => [cycle.weekStart, cycle]));
    const currentWeekStart = vietnamSprintStart(new Date());
    if (requestedSprint && !rowsByWeek.has(requestedSprint.weekStart)) rowsByWeek.set(requestedSprint.weekStart, []);
    else if (!requestedSprint && range.value === vietnamWorkDate(new Date()).slice(0, 7) && !rowsByWeek.has(currentWeekStart)) rowsByWeek.set(currentWeekStart, []);
    const weekStarts = [...new Set([...rowsByWeek.keys(), ...cyclesByStart.keys()])].sort((left, right) => right.localeCompare(left));
    const weeks = weekStarts.map((weekStart) => {
      const weekRange = this.weekRange(weekStart);
      const cycle = cyclesByStart.get(weekStart);
      const liveSnapshot = this.weekSnapshot(rowsByWeek.get(weekStart) ?? [], members);
      const snapshot = cycle?.status === WorklogWeekStatus.CLOSED && cycle.summarySnapshot ? cycle.summarySnapshot : liveSnapshot;
      return {
        weekStart,
        weekEnd: weekRange.weekEnd,
        goal: cycle?.goal ?? null,
        status: cycle?.status ?? WorklogWeekStatus.OPEN,
        closedAt: cycle?.closedAt ?? null,
        closedBy: cycle?.closedBy ?? null,
        ...snapshot,
      };
    });
    return {
      month: range.value,
      logs: rows,
      reopenCandidates,
      summary: summarizeWorklogs(rows, summaryMembers),
      weeks,
      threads: this.summarizeThreads(threadRows),
    };
  }

  async updateWeek(weekStart: string, dto: SaveWorklogWeekDto, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được cập nhật Goal Sprint');
    const range = this.weekRange(weekStart);
    const existing = await this.worklogWeeks.findOneBy({ weekStart });
    if (existing?.status === WorklogWeekStatus.CLOSED) throw new BadRequestException('Hãy mở lại Sprint trước khi sửa Goal');
    const row = existing ?? this.worklogWeeks.create({ weekStart, weekEnd: range.weekEnd, status: WorklogWeekStatus.OPEN });
    row.goal = dto.goal.trim() || null;
    return this.worklogWeeks.save(row);
  }

  async closeWeek(weekStart: string, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được chốt Sprint');
    const range = this.weekRange(weekStart);
    const [members, rows, existing] = await Promise.all([
      this.users.find({ where: { isActive: true }, order: { displayName: 'ASC' } }),
      this.weekRows(weekStart),
      this.worklogWeeks.findOneBy({ weekStart }),
    ]);
    const row = existing ?? this.worklogWeeks.create({ weekStart, weekEnd: range.weekEnd });
    row.status = WorklogWeekStatus.CLOSED;
    row.summarySnapshot = this.weekSnapshot(rows, members);
    row.closedById = actor.id;
    row.closedAt = new Date();
    const saved = await this.worklogWeeks.save(row);
    this.realtime.emitWorklog('worklog.updated', { weekStart, status: saved.status });
    return saved;
  }

  async reopenWeek(weekStart: string, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được mở lại Sprint');
    this.weekRange(weekStart);
    const row = await this.worklogWeeks.findOneBy({ weekStart });
    if (!row) throw new NotFoundException('Sprint chưa được chốt');
    row.status = WorklogWeekStatus.OPEN;
    row.summarySnapshot = null;
    row.closedById = null;
    row.closedAt = null;
    const saved = await this.worklogWeeks.save(row);
    this.realtime.emitWorklog('worklog.updated', { weekStart, status: saved.status });
    return saved;
  }

  private summarizeThreads(rows: Worklog[]) {
    const grouped = new Map<string, {
      task: Task;
      users: Map<string, { id: string; username: string; displayName: string }>;
      worklogCount: number;
      totalHours: number;
      doneHours: number;
      endedHours: number;
      openCount: number;
      firstActivityAt: Date;
      lastActivityAt: Date;
    }>();
    for (const row of rows) {
      if (!row.primaryTaskId || !row.primaryTask) continue;
      const startedAt = new Date(row.startedAt);
      const current = grouped.get(row.primaryTaskId) ?? {
        task: row.primaryTask,
        users: new Map(),
        worklogCount: 0,
        totalHours: 0,
        doneHours: 0,
        endedHours: 0,
        openCount: 0,
        firstActivityAt: startedAt,
        lastActivityAt: startedAt,
      };
      current.users.set(row.userId, { id: row.user.id, username: row.user.username, displayName: row.user.displayName });
      current.worklogCount += 1;
      const hours = Number(row.hoursWorked ?? 0);
      current.totalHours += hours;
      if (row.status === WorklogStatus.DONE) current.doneHours += hours;
      if (row.status === WorklogStatus.ENDED) current.endedHours += hours;
      if ([WorklogStatus.BACKLOG, WorklogStatus.OPEN].includes(row.status)) current.openCount += 1;
      if (startedAt < current.firstActivityAt) current.firstActivityAt = startedAt;
      if (startedAt > current.lastActivityAt) current.lastActivityAt = startedAt;
      grouped.set(row.primaryTaskId, current);
    }
    return [...grouped.values()].map((value) => ({
      task: value.task,
      members: [...value.users.values()],
      worklogCount: value.worklogCount,
      totalHours: Number(value.totalHours.toFixed(2)),
      doneHours: Number(value.doneHours.toFixed(2)),
      endedHours: Number(value.endedHours.toFixed(2)),
      openCount: value.openCount,
      firstActivityAt: value.firstActivityAt,
      lastActivityAt: value.lastActivityAt,
      calendarDays: Math.max(1, Math.floor((value.lastActivityAt.getTime() - value.firstActivityAt.getTime()) / 86_400_000) + 1),
    })).sort((left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime());
  }

  async detail(id: string) {
    const row = await this.worklogs.createQueryBuilder('worklog')
      .leftJoinAndSelect('worklog.user', 'user')
      .leftJoinAndSelect('worklog.createdBy', 'createdBy')
      .leftJoinAndSelect('worklog.tasks', 'task')
      .leftJoinAndSelect('worklog.primaryTask', 'primaryTask')
      .leftJoinAndSelect('worklog.reopenedWorklog', 'reopenedWorklog')
      .leftJoinAndSelect('worklog.comments', 'comment')
      .leftJoinAndSelect('comment.author', 'commentAuthor')
      .leftJoinAndSelect('comment.mentions', 'commentMention')
      .leftJoinAndSelect('commentMention.user', 'commentMentionUser')
      .where('worklog.id = :id', { id })
      .andWhere('worklog.deletedAt IS NULL')
      .orderBy('comment.createdAt', 'ASC')
      .getOne();
    if (!row) throw new NotFoundException('Không tìm thấy Worklog');
    return row;
  }

  async comment(id: string, dto: CreateWorklogCommentDto, actor: AuthUser, image?: Express.Multer.File) {
    const worklog = await this.worklogs.findOne({ where: { id, deletedAt: IsNull() }, relations: { user: true } });
    if (!worklog) throw new NotFoundException('Không tìm thấy Worklog');
    await this.assertMemberWeekOpen(worklog.startedAt, actor);
    const body = dto.body?.trim() ?? '';
    if (!body && !image) throw new BadRequestException('Cần nhập comment hoặc đính kèm ảnh');
    const mentionedUserIds = [...new Set(dto.mentionedUserIds ?? [])];
    const saved = await this.dataSource.transaction(async (manager) => {
      if (mentionedUserIds.length) {
        const activeCount = await manager.createQueryBuilder(User, 'user').where('user.id IN (:...ids)', { ids: mentionedUserIds }).andWhere('user.isActive = true').getCount();
        if (activeCount !== mentionedUserIds.length) throw new BadRequestException('Mọi người được mention phải đang active');
      }
      const comment = await manager.save(manager.create(WorklogComment, {
        worklogId: id,
        authorId: actor.id,
        body,
        imageMimeType: image?.mimetype ?? null,
        imageByteSize: image?.size ?? null,
        imageData: image?.buffer ?? null,
      }));
      if (mentionedUserIds.length) await manager.save(mentionedUserIds.map((userId) => manager.create(WorklogCommentMention, { commentId: comment.id, userId })));

      const mentionRecipients = mentionedUserIds.filter((userId) => userId !== actor.id);
      if (mentionRecipients.length) await this.systemNotifications.create(manager, {
        actor,
        relatedUserIds: mentionRecipients,
        includeAdmins: false,
        module: SystemNotificationModule.WORKLOG,
        eventType: 'WORKLOG_MENTION',
        entityType: 'WORKLOG',
        entityId: id,
        entityLabel: worklog.input,
        message: 'nhắc bạn trong Worklog',
        bodyPreview: body || 'Đã gửi ảnh',
        dedupeKey: `worklog-comment:${comment.id}:mention`,
      });
      await this.systemNotifications.create(manager, {
        actor,
        relatedUserIds: worklog.userId === actor.id ? [] : [worklog.userId],
        excludeUserIds: mentionRecipients,
        module: SystemNotificationModule.WORKLOG,
        eventType: 'WORKLOG_COMMENT',
        entityType: 'WORKLOG',
        entityId: id,
        entityLabel: worklog.input,
        message: 'đã bình luận trong Worklog',
        bodyPreview: body || 'Đã gửi ảnh',
        dedupeKey: `worklog-comment:${comment.id}:comment`,
      });
      return comment;
    });
    const result = await this.dataSource.getRepository(WorklogComment).findOne({ where: { id: saved.id }, relations: { author: true, mentions: { user: true } } });
    this.realtime.emitWorklog('worklog.comment.created', result);
    return result;
  }

  async commentImage(commentId: string) {
    const comment = await this.dataSource.getRepository(WorklogComment).createQueryBuilder('comment').addSelect('comment.imageData').where('comment.id = :commentId', { commentId }).getOne();
    if (!comment?.imageData || !comment.imageMimeType) throw new NotFoundException('Không tìm thấy ảnh comment');
    return { mimeType: comment.imageMimeType, data: comment.imageData };
  }

  private async linkedTasks(taskIds: string[], allowEmpty = false) {
    const ids = [...new Set(taskIds)];
    if (!ids.length) {
      if (allowEmpty) return [];
      throw new BadRequestException('Cần chọn ít nhất một Task nguồn');
    }
    const tasks = await this.tasks.find({ where: { id: In(ids), deletedAt: IsNull() } });
    if (tasks.length !== ids.length || tasks.some((task) => ![TaskStatus.BACKLOG, TaskStatus.ACTIVE, TaskStatus.DONE].includes(task.status))) {
      throw new BadRequestException('Task nguồn phải chưa Complete');
    }
    const byId = new Map(tasks.map((task) => [task.id, task]));
    return ids.map((id) => byId.get(id)!);
  }

  private async linkedTaskContext(dto: SaveWorklogDto, allowEmptyPrimary: boolean) {
    const ids = [...new Set([...(dto.primaryTaskId ? [dto.primaryTaskId] : []), ...dto.taskIds])];
    const tasks = await this.linkedTasks(ids, allowEmptyPrimary && !dto.primaryTaskId);
    const primaryTask = dto.primaryTaskId ? tasks.find((task) => task.id === dto.primaryTaskId) ?? null : null;
    if (!allowEmptyPrimary && !primaryTask) throw new BadRequestException('Cần chọn một Task / Thread chính');
    return { tasks, primaryTask };
  }

  private async linkedReopenedWorklog(workType: WorklogType, reopenedWorklogId?: string, currentId?: string) {
    if (workType !== WorklogType.REOPEN) {
      if (reopenedWorklogId) throw new BadRequestException('Chỉ Worklog RE-OPEN được chọn Worklog gốc');
      return null;
    }
    if (!reopenedWorklogId) throw new BadRequestException('RE-OPEN cần chọn Worklog gốc');
    if (reopenedWorklogId === currentId) throw new BadRequestException('Worklog không thể tự RE-OPEN chính nó');
    const original = await this.worklogs.findOneBy({ id: reopenedWorklogId, deletedAt: IsNull() });
    if (!original || original.status !== WorklogStatus.DONE || original.workType === WorklogType.REOPEN) {
      throw new BadRequestException('Worklog gốc phải là Worklog DONE và không phải RE-OPEN');
    }
    return original;
  }

  private async linkedReopenCount(worklogId: string) {
    return this.worklogs.count({ where: { reopenedWorklogId: worklogId, workType: WorklogType.REOPEN, deletedAt: IsNull() } });
  }

  private async refreshOriginalQuality(worklogId: string) {
    const original = await this.worklogs.findOneBy({ id: worklogId, deletedAt: IsNull() });
    if (!original) return;
    const reopenCount = (original.reopenBaseCount ?? 0) + await this.linkedReopenCount(worklogId);
    original.reopenCount = reopenCount;
    if (reopenCount > 0) original.stabilityStatus = WorklogStabilityStatus.PENDING;
    if (original.valueLevel && original.standardHours !== null && original.completionRate !== null) {
      const confirmed = original.stabilityStatus === WorklogStabilityStatus.CONFIRMED;
      original.stabilityRate = worklogStabilityRate(reopenCount, confirmed).toFixed(2);
      original.point = calculateWorklogPoint(original.valueLevel, Number(original.standardHours), Number(original.completionRate), reopenCount, confirmed);
    }
    const saved = await this.worklogs.save(original);
    this.realtime.emitWorklog('worklog.updated', saved);
  }

  private applyForm(row: Worklog, dto: SaveWorklogDto) {
    const startedAt = new Date(dto.startedAt);
    const isFinished = [WorklogStatus.DONE, WorklogStatus.ENDED].includes(dto.status);
    if (isFinished && dto.hoursWorked === undefined) {
      throw new BadRequestException('Worklog không hoàn thành cần số H thực tế');
    }
    row.input = dto.input.trim();
    row.startedAt = startedAt;
    row.status = dto.status;
    row.output = dto.output?.trim() || null;
    if (dto.links !== undefined) row.links = [...new Set(dto.links.map((link) => link.trim()).filter(Boolean))];
    else if (!row.links) row.links = [];
    row.workType = dto.workType ?? WorklogType.NORMAL;
    row.reopenedWorklogId = dto.reopenedWorklogId ?? null;
    row.endedAt = null;
    row.hoursWorked = dto.hoursWorked === undefined ? null : dto.hoursWorked.toFixed(2);
    row.valueLevel = dto.valueLevel;
    const autoScored = dto.status === WorklogStatus.DONE;
    const hoursWorked = dto.hoursWorked ?? 0;
    row.valueRate = autoScored ? WORKLOG_VALUE_RATE[dto.valueLevel] : null;
    row.standardHours = autoScored ? hoursWorked.toFixed(2) : null;
    row.completionRate = autoScored ? '1.00' : null;
    row.reopenCount = autoScored ? 0 : null;
    row.stabilityStatus = WorklogStabilityStatus.PENDING;
    row.stabilityRate = autoScored ? '0.80' : null;
    row.point = dto.status === WorklogStatus.ENDED || (row.workType === WorklogType.REOPEN && autoScored)
      ? 0
      : autoScored
        ? calculateWorklogPoint(dto.valueLevel, hoursWorked, 1, 0, false)
        : null;
    row.scoredById = null;
    row.scoredAt = isFinished ? new Date() : null;
    return row;
  }

  private normalizedOutputCriteria(dto: SaveWorklogDto, isFinished: boolean) {
    if (!dto.outputCriteria?.length) throw new BadRequestException('Cần ít nhất một OUT kỳ vọng');
    const seen = new Set<string>();
    return dto.outputCriteria.map((criterion) => {
      const id = criterion.id.trim();
      const expected = criterion.expected.trim();
      const actual = criterion.actual?.trim() || null;
      if (!id || seen.has(id)) throw new BadRequestException('Mỗi OUT cần mã riêng');
      if (!expected) throw new BadRequestException('OUT kỳ vọng không được để trống');
      seen.add(id);
      return { id, expected, actual, achieved: isFinished ? criterion.achieved === true : typeof criterion.achieved === 'boolean' ? criterion.achieved : null } satisfies WorklogOutputCriterion;
    });
  }

  private applyV2Form(row: Worklog, dto: SaveWorklogDto) {
    const requestedFinish = [WorklogStatus.DONE, WorklogStatus.ENDED].includes(dto.status);
    const criteria = this.normalizedOutputCriteria(dto, requestedFinish);
    if (requestedFinish && dto.hoursWorked === undefined) throw new BadRequestException('Khi kết thúc cần số H thực tế');
    if (dto.hoursWorked !== undefined && Math.abs(dto.hoursWorked * 2 - Math.round(dto.hoursWorked * 2)) > 0.000_001) {
      throw new BadRequestException('Worklog mới ghi số H theo bước 0.5 giờ');
    }
    const completionRate = requestedFinish ? criteria.filter((criterion) => criterion.achieved).length / criteria.length : null;
    const startedAt = new Date(dto.startedAt);
    row.input = dto.input.trim();
    row.startedAt = startedAt;
    row.output = null;
    row.outputCriteria = criteria;
    row.resultModelVersion = 2;
    row.links = dto.links === undefined ? row.links ?? [] : [...new Set(dto.links.map((link) => link.trim()).filter(Boolean))];
    row.workType = dto.workType ?? WorklogType.NORMAL;
    row.reopenedWorklogId = dto.reopenedWorklogId ?? null;
    row.hoursWorked = dto.hoursWorked === undefined ? null : dto.hoursWorked.toFixed(2);
    row.valueLevel = dto.valueLevel;
    row.endedAt = requestedFinish ? new Date() : null;
    row.status = requestedFinish ? WorklogStatus.DONE : dto.status;
    row.valueRate = requestedFinish ? WORKLOG_VALUE_RATE[dto.valueLevel] : null;
    row.standardHours = requestedFinish ? dto.hoursWorked!.toFixed(2) : null;
    row.completionRate = requestedFinish ? completionRate!.toFixed(2) : null;
    row.reopenCount = requestedFinish ? 0 : null;
    row.stabilityStatus = WorklogStabilityStatus.PENDING;
    row.stabilityRate = requestedFinish ? '0.80' : null;
    row.point = !requestedFinish
      ? null
      : row.workType === WorklogType.REOPEN
        ? 0
        : calculateWorklogPoint(dto.valueLevel, dto.hoursWorked!, completionRate!, 0, false);
    row.scoredById = null;
    row.scoredAt = requestedFinish ? new Date() : null;
    return row;
  }

  async create(dto: SaveWorklogDto, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN && !isWorklogDev(actor.username)) throw new ForbiddenException('Tài khoản chưa thuộc pilot Worklog');
    if (actor.role !== UserRole.ADMIN && !isMemberCreatableVietnamWorkDate(dto.startedAt)) throw new ForbiddenException('Member không được tạo Worklog cho ngày tương lai');
    await this.assertCurrentSprintOpenForCreate(dto.startedAt);
    const userId = actor.role === UserRole.ADMIN && dto.userId ? dto.userId : actor.id;
    const owner = await this.users.findOneBy({ id: userId, isActive: true });
    if (!owner) throw new NotFoundException('Không tìm thấy thành viên active');
    const workType = dto.workType ?? WorklogType.NORMAL;
    await this.linkedReopenedWorklog(workType, dto.reopenedWorklogId);
    const taskContext = await this.linkedTaskContext(dto, actor.role === UserRole.ADMIN);
    const row = this.worklogs.create({
      userId,
      createdById: actor.id,
      tasks: taskContext.tasks,
      primaryTaskId: taskContext.primaryTask?.id ?? null,
      primaryTask: taskContext.primaryTask,
      reopenBaseCount: 0,
      deletedById: null,
      deletedAt: null,
    });
    const saved = await this.worklogs.save(this.applyV2Form(row, dto));
    await this.taskLifecycle.startFromWorklog(saved.tasks.map((task) => task.id), actor, saved.id);
    if (saved.reopenedWorklogId) await this.refreshOriginalQuality(saved.reopenedWorklogId);
    if (saved.status === WorklogStatus.DONE && saved.workType !== WorklogType.REOPEN) await this.refreshOriginalQuality(saved.id);
    this.realtime.emitWorklog('worklog.updated', saved);
    return saved;
  }

  async update(id: string, dto: SaveWorklogDto, actor: AuthUser) {
    const row = await this.worklogs.findOneBy({ id, deletedAt: IsNull() });
    if (!row) throw new NotFoundException('Không tìm thấy Worklog');
    if(row.primaryTaskId&&!row.primaryTask)row.primaryTask=await this.tasks.findOneBy({id:row.primaryTaskId})??null;
    if (row.userId !== actor.id && actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ owner hoặc Admin được cập nhật Worklog');
    const memberResubmittingFailedReview=actor.role!==UserRole.ADMIN&&row.userId===actor.id&&row.primaryTask?.status===TaskStatus.DONE&&row.primaryTask.reviewResult===TaskReviewResult.FAILED;
    if(!memberResubmittingFailedReview)await this.assertMemberWeekOpen(row.startedAt, actor);
    if (row.scoredAt && [WorklogStatus.DONE, WorklogStatus.ENDED].includes(row.status) && actor.role !== UserRole.ADMIN && !memberResubmittingFailedReview) throw new BadRequestException('Worklog đã kết thúc chỉ sửa được khi Task Review không đạt');
    if (actor.role !== UserRole.ADMIN && vietnamWorkDate(dto.startedAt) !== vietnamWorkDate(row.startedAt)) throw new ForbiddenException('Member không được đổi ngày Worklog');
    if (actor.role === UserRole.ADMIN && dto.userId && dto.userId !== row.userId) {
      const owner = await this.users.findOneBy({ id: dto.userId, isActive: true });
      if (!owner) throw new NotFoundException('Không tìm thấy thành viên active');
      row.userId = owner.id;
    }
    const previousReopenedWorklogId = row.reopenedWorklogId;
    const workType = dto.workType ?? WorklogType.NORMAL;
    await this.linkedReopenedWorklog(workType, dto.reopenedWorklogId, row.id);
    const taskContext = await this.linkedTaskContext(dto, actor.role === UserRole.ADMIN);
    row.tasks = taskContext.tasks;
    row.primaryTaskId = taskContext.primaryTask?.id ?? null;
    row.primaryTask = taskContext.primaryTask;
    const effectiveDto=memberResubmittingFailedReview?{...dto,startedAt:row.startedAt.toISOString(),hoursWorked:row.hoursWorked===null?undefined:Number(row.hoursWorked),valueLevel:row.valueLevel!,status:WorklogStatus.DONE}:dto;
    const saved = await this.worklogs.save(row.resultModelVersion === 2 || effectiveDto.outputCriteria ? this.applyV2Form(row, effectiveDto) : this.applyForm(row, effectiveDto));
    if(memberResubmittingFailedReview){
      const comments=this.dataSource.getRepository(WorklogComment);
      await comments.save(comments.create({worklogId:saved.id,authorId:actor.id,body:'Đã cập nhật Worklog sau kết quả Review KHÔNG ĐẠT và gửi lại bằng chứng.',mentions:[]}));
    }
    await this.taskLifecycle.startFromWorklog(saved.tasks.map((task) => task.id), actor, saved.id);
    const affectedOriginalIds = [...new Set([previousReopenedWorklogId, saved.reopenedWorklogId].filter((value): value is string => Boolean(value)))];
    for (const originalId of affectedOriginalIds) await this.refreshOriginalQuality(originalId);
    if (saved.status === WorklogStatus.DONE && saved.workType !== WorklogType.REOPEN) await this.refreshOriginalQuality(saved.id);
    this.realtime.emitWorklog('worklog.updated', saved);
    return saved;
  }

  async score(id: string, dto: ScoreWorklogDto, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được chấm Point Worklog');
    const row = await this.worklogs.findOneBy({ id, deletedAt: IsNull() });
    if (!row) throw new NotFoundException('Không tìm thấy Worklog');
    if (row.resultModelVersion === 2) throw new BadRequestException('Worklog V2 tự tính Point theo OUT; hãy sửa Worklog nếu cần');
    if (row.status !== WorklogStatus.DONE) throw new BadRequestException('Chỉ Worklog DONE được chấm Point');
    if (row.workType === WorklogType.REOPEN) throw new BadRequestException('Worklog RE-OPEN ghi nhận H nhưng không nhận Point');
    const reopenCount = (row.reopenBaseCount ?? 0) + await this.linkedReopenCount(row.id);
    const stabilityConfirmed = Boolean(dto.stabilityConfirmed) && reopenCount === 0;
    row.valueLevel = dto.valueLevel;
    row.valueRate = WORKLOG_VALUE_RATE[dto.valueLevel];
    row.standardHours = dto.standardHours.toFixed(2);
    row.completionRate = dto.completionRate.toFixed(2);
    row.reopenCount = reopenCount;
    row.stabilityStatus = stabilityConfirmed ? WorklogStabilityStatus.CONFIRMED : WorklogStabilityStatus.PENDING;
    row.stabilityRate = worklogStabilityRate(reopenCount, stabilityConfirmed).toFixed(2);
    row.point = calculateWorklogPoint(dto.valueLevel, dto.standardHours, dto.completionRate, reopenCount, stabilityConfirmed);
    row.scoredById = actor.id;
    row.scoredAt = new Date();
    const saved = await this.worklogs.save(row);
    this.realtime.emitWorklog('worklog.updated', saved);
    return saved;
  }

  async confirmStability(id: string, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được chốt Worklog ổn định');
    const row = await this.worklogs.findOne({ where: { id, deletedAt: IsNull() }, relations: { primaryTask: true } });
    if (!row) throw new NotFoundException('Không tìm thấy Worklog');
    if (![WorklogStatus.DONE, WorklogStatus.ENDED].includes(row.status) || row.workType === WorklogType.REOPEN || !row.scoredAt || !row.valueLevel || row.standardHours === null || row.completionRate === null) {
      throw new BadRequestException('Worklog cần được chấm Point trước khi chốt ổn định');
    }
    if (row.primaryTaskId && row.primaryTask?.status !== TaskStatus.COMPLETE) {
      throw new BadRequestException('Task nguồn chính cần được Admin Complete trước khi chốt Point ổn định');
    }
    const reopenCount = (row.reopenBaseCount ?? 0) + await this.linkedReopenCount(row.id);
    if (reopenCount > 0) throw new BadRequestException('Worklog đã phát sinh RE-OPEN nên không thể chốt 100%');
    row.reopenCount = 0;
    row.stabilityStatus = WorklogStabilityStatus.CONFIRMED;
    row.stabilityRate = '1.00';
    row.point = calculateWorklogPoint(row.valueLevel, Number(row.standardHours), Number(row.completionRate), 0, true);
    row.scoredById = actor.id;
    row.scoredAt = new Date();
    const saved = await this.worklogs.save(row);
    this.realtime.emitWorklog('worklog.updated', saved);
    return saved;
  }

  async requestTaskReview(id: string, taskId: string, actor: AuthUser) {
    const row = await this.worklogs.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { tasks: true },
    });
    if (!row) throw new NotFoundException('Không tìm thấy Worklog');
    await this.assertMemberWeekOpen(row.startedAt, actor);
    if (actor.role !== UserRole.ADMIN && row.userId !== actor.id) throw new ForbiddenException('Chỉ owner Worklog hoặc Admin được gửi Review');
    if (row.status !== WorklogStatus.DONE) throw new BadRequestException('Chỉ Worklog DONE mới được gửi Task sang Review');
    if (!row.tasks.some((task) => task.id === taskId)) throw new BadRequestException('Task không thuộc nguồn của Worklog này');
    return this.taskLifecycle.requestReviewFromWorklog(taskId, actor, row.id);
  }

  async remove(id: string, actor: AuthUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException('Chỉ Admin được xoá Worklog');
    const row = await this.worklogs.findOneBy({ id, deletedAt: IsNull() });
    if (!row) throw new NotFoundException('Không tìm thấy Worklog');
    const reopenedWorklogId = row.reopenedWorklogId;
    row.deletedById = actor.id;
    row.deletedAt = new Date();
    await this.worklogs.save(row);
    if (reopenedWorklogId) await this.refreshOriginalQuality(reopenedWorklogId);
    this.realtime.emitWorklog('worklog.updated', { id: row.id, deletedAt: row.deletedAt });
    return { id: row.id };
  }
}

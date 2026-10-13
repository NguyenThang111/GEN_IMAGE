import { createHash } from 'node:crypto';
import { Task, TaskStatus } from '../tasks/task.entity';
import { TaskEvent, TaskEventType } from '../tasks/task-event.entity';
import { Worklog, WorklogStatus, WorklogType } from '../worklogs/worklog.entity';
import { vietnamWorkDate } from '../worklogs/worklog.policy';
import { PerformanceAttestation, PerformancePeriod, PerformancePlan } from './performance.entity';

export type PerformanceMember = { id: string; displayName: string; username: string };
export const performanceMonth = (value: Date | string) => vietnamWorkDate(value).slice(0, 7);
export function isCompletion(event: TaskEvent) {
  const changes = event.payload?.changes as { status?: { to?: string } } | undefined;
  return event.type === TaskEventType.COMPLETED || (event.payload?.source === 'ADMIN_STATUS_CHANGE' && changes?.status?.to === TaskStatus.COMPLETE);
}
export const isFailure = (event: TaskEvent) => event.type === TaskEventType.REVIEWED && event.payload?.result === 'FAILED';
const time = (value: Date | string) => new Date(value).getTime();
const round = (value: number) => Math.round(value * 100) / 100;
const hours = (log: Worklog) => Number(log.hoursWorked ?? 0);
export function worklogTaskId(log: Worklog) {
  return log.primaryTaskId ?? (log.tasks?.length === 1 ? log.tasks[0].id : null);
}
const hasEvidence = (log: Worklog) => Boolean(log.output?.trim() || log.links?.length || log.outputCriteria?.some(out => out.actual?.trim()));

export type PerformanceInput = {
  month: string; period: PerformancePeriod | null; trialStart: string | null;
  members: PerformanceMember[]; tasks: Task[]; events: TaskEvent[]; logs: Worklog[];
  plans: PerformancePlan[]; attestations: PerformanceAttestation[]; now?: Date;
};

export function evaluatePerformance(input: PerformanceInput) {
  const { month, period, plans, members } = input;
  const now = input.now ?? new Date();
  const monthClosed = month < performanceMonth(now);
  const through = monthClosed ? `${month}-31` : vietnamWorkDate(now);
  const events = input.events.filter(e => vietnamWorkDate(e.createdAt) <= through).sort((a,b) => time(a.createdAt)-time(b.createdAt) || a.id.localeCompare(b.id));
  const logs = input.logs.filter(log => !log.deletedAt && log.status !== WorklogStatus.BACKLOG && vietnamWorkDate(log.startedAt) <= through);
  const firstCompletion = new Map<string, TaskEvent>();
  for (const event of events) if (isCompletion(event) && !firstCompletion.has(event.taskId)) firstCompletion.set(event.taskId, event);
  const reworkForFailure=(log:Worklog,event:TaskEvent)=>{
    const next=events.find(e=>e.taskId===event.taskId && time(e.createdAt)>time(event.createdAt) && (isFailure(e)||isCompletion(e)));
    return worklogTaskId(log)===event.taskId && time(log.createdAt)>=time(event.createdAt) && (!next||time(log.createdAt)<=time(next.createdAt)) &&
      vietnamWorkDate(log.startedAt)>=vietnamWorkDate(event.createdAt) && (!next||vietnamWorkDate(log.startedAt)<=vietnamWorkDate(next.createdAt));
  };
  const planByTask = new Map(plans.map(plan => [plan.taskId, plan]));
  const taskById = new Map(input.tasks.map(task => [task.id, task]));
  const failures = events.filter(isFailure).map(event => {
    const task = taskById.get(event.taskId);
    const plan = planByTask.get(event.taskId);
    const snapshotIds = event.payload?.assigneeIds as string[] | undefined;
    const userIds = snapshotIds ?? plan?.shares.map(share => share.userId) ?? task?.assignees?.map(assignment => assignment.userId) ?? [];
    const completion = events.find(e => e.taskId === event.taskId && isCompletion(e) && time(e.createdAt) > time(event.createdAt));
    return {
      id: event.id, taskId: event.taskId, title: String(event.payload?.taskTitle ?? task?.title ?? 'Task không còn trong danh sách'),
      reason: String(event.payload?.reason ?? 'Task không đạt'), reviewedAt: event.createdAt,
      reviewer: event.actor?.displayName ?? 'Admin', userIds,
      assignees: userIds.map(id => members.find(member => member.id === id)?.displayName ?? task?.assignees?.find(a=>a.userId===id)?.user?.displayName ?? id),
      assignmentHistorical: Boolean(snapshotIds), status: task?.status ?? null,
      resolved: Boolean(completion), planned: Boolean(plan),
    };
  });

  const rows = members.map(member => {
    const issues = new Set<string>();
    if (!period) issues.add('Chưa cấu hình mốc thưởng tháng');
    const start = period?.effectiveDate ?? `${month}-01`;
    const ownLogs = logs.filter(log => log.userId === member.id);
    const monthLogs = ownLogs.filter(log => vietnamWorkDate(log.startedAt) >= start && performanceMonth(log.startedAt) === month);
    const ownPlans = plans.filter(plan => plan.shares.some(share => share.userId === member.id) && vietnamWorkDate(plan.createdAt) <= through);
    const accepted = ownPlans.filter(plan => {
      const completed = firstCompletion.get(plan.taskId);
      return completed && performanceMonth(completed.createdAt) === month && vietnamWorkDate(completed.createdAt) >= start;
    });
    const acceptedIds = new Set(accepted.map(plan => plan.taskId));
    const carryLogs = ownLogs.filter(log => acceptedIds.has(worklogTaskId(log) ?? '') && performanceMonth(log.startedAt) < month && vietnamWorkDate(log.startedAt) >= (input.trialStart ?? start));
    const assessedLogs = [...monthLogs, ...carryLogs];
    const calendarHours = monthLogs.reduce((sum,log) => sum + hours(log), 0);
    const carryInHours = carryLogs.reduce((sum,log) => sum + hours(log), 0);
    const totalHours = calendarHours + carryInHours;
    let point = 0, standardHours = 0, firstPassPoint = 0;
    for (const log of assessedLogs) {
      if (!(hours(log) > 0)) issues.add(`Worklog thiếu giờ: ${log.input}`);
      if (!hasEvidence(log)) issues.add(`Worklog thiếu kết quả/minh chứng: ${log.input}`);
      if (!worklogTaskId(log)) issues.add(`Worklog chưa rõ Task chính: ${log.input}`);
      const baseline=planByTask.get(worklogTaskId(log)??'');
      if (baseline && vietnamWorkDate(log.startedAt)<vietnamWorkDate(baseline.createdAt)) issues.add(`Giờ làm trước ngày chốt baseline: ${log.input}`);
    }
    for (const plan of accepted) {
      const share = plan.shares.find(share => share.userId === member.id)!.percent / 100;
      point += plan.point * share;
      standardHours += Number(plan.standardHours) * share;
      const completed=firstCompletion.get(plan.taskId)!;
      if (!events.some(event => event.taskId === plan.taskId && isFailure(event) && time(event.createdAt)<=time(completed.createdAt))) firstPassPoint += plan.point * share;
      const taskLogs = ownLogs.filter(log => worklogTaskId(log) === plan.taskId && time(log.createdAt) >= time(plan.createdAt));
      if (!taskLogs.some(log => log.status === WorklogStatus.DONE && hasEvidence(log) && hours(log) > 0)) issues.add(`Thiếu Worklog hoàn thành: ${taskById.get(plan.taskId)?.title ?? plan.taskId}`);
    }
    const relevantPlanIds = new Set(ownPlans.map(plan => plan.taskId));
    for (const plan of ownPlans) {
      const task=taskById.get(plan.taskId);
      if (task && task.status!==TaskStatus.BACKLOG && !ownLogs.some(log=>worklogTaskId(log)===plan.taskId)) issues.add(`Task đã bắt đầu nhưng thiếu Worklog: ${task.title}`);
    }
    for (const failure of failures.filter(row => relevantPlanIds.has(row.taskId))) {
      const event = events.find(e => e.id === failure.id)!;
      const plan = planByTask.get(event.taskId)!;
      if (time(event.createdAt) < time(plan.createdAt)) continue;
      const next = events.find(e => e.taskId === event.taskId && time(e.createdAt) > time(event.createdAt) && (isFailure(e) || isCompletion(e)));
      // Creation time distinguishes same-day work done before and after review.
      const rework = ownLogs.filter(log => reworkForFailure(log,event));
      const cycleInMonth = performanceMonth(event.createdAt) === month || (next && performanceMonth(next.createdAt) === month) || !failure.resolved;
      if (cycleInMonth && !rework.some(log => hours(log) > 0 && hasEvidence(log))) issues.add(`Thiếu giờ làm lại: ${failure.title}`);
      if (!failure.resolved) issues.add(`Chưa xử lý lần không đạt: ${failure.title}`);
    }
    // Unplanned/legacy work is visible and consumes time but is not retroactively awarded.
    const unplanned = monthLogs.filter(log => !planByTask.has(worklogTaskId(log) ?? ''));
    if (unplanned.length) issues.add(`${unplanned.length} Worklog chưa có Point/giờ chuẩn chốt trước khi làm`);
    for (const task of input.tasks) {
      const assigned=task.assignees?.some(a=>a.userId===member.id);
      const activity=events.some(e=>e.taskId===task.id && performanceMonth(e.createdAt)===month && vietnamWorkDate(e.createdAt)>=start);
      if (assigned && activity && [TaskStatus.ACTIVE,TaskStatus.DONE,TaskStatus.COMPLETE].includes(task.status) && !planByTask.has(task.id)) issues.add(`Task có hoạt động nhưng chưa chốt Point/giờ chuẩn: ${task.title}`);
    }
    if (!accepted.length) issues.add('Chưa có đầu ra được duyệt trong kỳ');
    if (totalHours <= 0) issues.add('Chưa có giờ thực tế');
    const relevantTasks = input.tasks.filter(task => relevantPlanIds.has(task.id) || task.assignees?.some(a=>a.userId===member.id) || monthLogs.some(log => worklogTaskId(log) === task.id));
    const relevantEvents = events.filter(event => relevantTasks.some(task => task.id === event.taskId));
    const fingerprint = createHash('sha256').update(JSON.stringify({
      period, member, plans: ownPlans, tasks: relevantTasks.map(task => ({ id:task.id, title:task.title, status:task.status, deletedAt:task.deletedAt, updatedAt:task.updatedAt })),
      events: relevantEvents.map(e => ({id:e.id,type:e.type,payload:e.payload,createdAt:e.createdAt})),
      logs: ownLogs.filter(log => assessedLogs.includes(log) || relevantPlanIds.has(worklogTaskId(log) ?? '')).map(log => ({id:log.id,updatedAt:log.updatedAt,startedAt:log.startedAt,hours:log.hoursWorked,status:log.status,output:log.output,criteria:log.outputCriteria,links:log.links,type:log.workType,taskId:worklogTaskId(log)})),
    })).digest('hex');
    const attestation = input.attestations.find(row => row.userId === member.id && row.month === month && row.fingerprint === fingerprint);
    const dataIssues = [...issues];
    if (!attestation) issues.add('Admin chưa xác nhận đủ giờ và bằng chứng (hoặc dữ liệu đã thay đổi)');
    const contribution = period ? 40 * Math.min(point / period.targetPoint, 1) : null;
    const efficiency = totalHours > 0 ? 40 * Math.min(standardHours / totalHours, 1) : null;
    const quality = point > 0 ? 20 * firstPassPoint / point : null;
    const score = contribution === null || efficiency === null || quality === null ? null : round(contribution + efficiency + quality);
    return { userId: member.id, displayName: member.displayName, point:round(point), calendarHours:round(calendarHours), carryInHours:round(carryInHours), totalHours:round(totalHours),
      reworkHours:round(assessedLogs.filter(log=>log.workType===WorklogType.REOPEN||events.some(event=>isFailure(event)&&reworkForFailure(log,event))).reduce((sum,log)=>sum+hours(log),0)),
      standardHours:round(standardHours), firstPassPercent:point>0?round(100*firstPassPoint/point):null,
      contribution:contribution===null?null:round(contribution), efficiency:efficiency===null?null:round(efficiency), quality:quality===null?null:round(quality), score,
      issues:[...issues], dataIssues, fingerprint, verifiedAt:attestation?.verifiedAt ?? null,
      eligible:issues.size===0 && score!==null && score>=70, proposedBonus:null as number|null, rank:null as number|null,
    };
  });
  const comparisonReady = Boolean(period) && rows.some(row=>row.issues.length===0);
  const ranked = rows.filter(row=>row.eligible).sort((a,b)=>b.score!-a.score!);
  const tied = ranked.length===2 && ranked[0].score===ranked[1].score;
  if (monthClosed && comparisonReady && !tied) ranked.forEach((row,index)=>{row.rank=index+1;row.proposedBonus=index===0?2000000:1500000;});
  return { month, monthClosed, comparisonReady, tied, period, members:rows, failures:failures.reverse(),
    plans:plans.filter(plan=>vietnamWorkDate(plan.createdAt)<=through).map(plan=>({...plan,title:taskById.get(plan.taskId)?.title ?? plan.taskId,firstCompletedAt:firstCompletion.get(plan.taskId)?.createdAt ?? null})),
  };
}

import { WorklogStabilityStatus, WorklogStatus, WorklogType, WorklogValueLevel } from './worklog.entity';

export const WORKLOG_DEV_USERNAMES = ['thang', 'vinh', 'phu'] as const;
export const WORKLOG_VALUE_RATE: Record<WorklogValueLevel, number> = {
  [WorklogValueLevel.BASIC]: 50,
  [WorklogValueLevel.DEV]: 100,
  [WorklogValueLevel.RND]: 300,
};
export const WORKLOG_CAPITAL_RATE: Record<WorklogValueLevel, number> = {
  [WorklogValueLevel.BASIC]: 0,
  [WorklogValueLevel.DEV]: 0.25,
  [WorklogValueLevel.RND]: 0.5,
};

export function worklogStabilityRate(reopenCount: number, stabilityConfirmed = false) {
  return reopenCount === 0 && stabilityConfirmed ? 1 : 0.8;
}

export function calculateWorklogPoint(valueLevel: WorklogValueLevel, standardHours: number, completionRate: number, reopenCount: number, stabilityConfirmed = false) {
  return Math.round(standardHours * WORKLOG_VALUE_RATE[valueLevel] * completionRate * worklogStabilityRate(reopenCount, stabilityConfirmed));
}

export function calculateWorklogCapitalPoint(valueLevel: WorklogValueLevel, actualHours: number) {
  return Math.round(actualHours * WORKLOG_VALUE_RATE[valueLevel] * WORKLOG_CAPITAL_RATE[valueLevel]);
}

export type WorklogSummaryMember = { id: string; username: string; displayName: string };
export type WorklogSummaryRow = { userId: string; status: WorklogStatus; hoursWorked: string | null; point: number | null; valueLevel?: WorklogValueLevel | null; workType?: WorklogType; stabilityStatus?: WorklogStabilityStatus; reopenCount?: number | null; standardHours?: string | null; completionRate?: string | null; resultModelVersion?: number; primaryTaskId?: string | null };
export type WorklogWeeklyRow = WorklogSummaryRow & { startedAt: Date | string };

export function isWorklogDev(username: string) {
  return WORKLOG_DEV_USERNAMES.includes(username.toLowerCase() as typeof WORKLOG_DEV_USERNAMES[number]);
}

export function vietnamWorkDate(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isMemberCreatableVietnamWorkDate(value: Date | string, now = new Date()) {
  return vietnamWorkDate(value) <= vietnamWorkDate(now);
}

export function summarizeWorklogs(rows: WorklogSummaryRow[], members: WorklogSummaryMember[]) {
  const summary = new Map(members.map((member) => [member.id, {
    userId: member.id,
    username: member.username,
    displayName: member.displayName,
    hours: 0,
    point: 0,
    confirmedPoint: 0,
    provisionalPoint: 0,
    backlog: 0,
    open: 0,
    done: 0,
    ended: 0,
    pendingPoint: 0,
    pendingStability: 0,
    pendingStabilityPoint: 0,
    capitalPoint: 0,
    productiveBasePoint: 0,
    endedBasePoint: 0,
    conversionPercent: 0,
    worklogs: 0,
    basicWorklogs: 0,
    devWorklogs: 0,
    rndWorklogs: 0,
    reopenWorklogs: 0,
    linkedWorklogs: 0,
    v2Worklogs: 0,
  }]));
  for (const row of rows) {
    const value = summary.get(row.userId);
    if (!value) continue;
    value.worklogs += 1;
    if (row.valueLevel === WorklogValueLevel.BASIC) value.basicWorklogs += 1;
    if (row.valueLevel === WorklogValueLevel.DEV) value.devWorklogs += 1;
    if (row.valueLevel === WorklogValueLevel.RND) value.rndWorklogs += 1;
    if (row.workType === WorklogType.REOPEN) value.reopenWorklogs += 1;
    if (row.primaryTaskId) value.linkedWorklogs += 1;
    if (row.resultModelVersion === 2) value.v2Worklogs += 1;
    value.hours += Number(row.hoursWorked ?? 0);
    if (row.status === WorklogStatus.BACKLOG) value.backlog += 1;
    if (row.status === WorklogStatus.OPEN) value.open += 1;
    if (row.status === WorklogStatus.DONE) {
      value.done += 1;
      if (row.workType !== WorklogType.REOPEN && row.valueLevel) {
        const hours = Number(row.standardHours ?? row.hoursWorked ?? 0);
        const completion = Number(row.completionRate ?? 1);
        value.productiveBasePoint += Math.round(hours * WORKLOG_VALUE_RATE[row.valueLevel] * completion);
      }
      if (row.point === null) value.pendingPoint += 1;
      else {
        value.point += row.point;
        if (row.stabilityStatus === WorklogStabilityStatus.CONFIRMED) value.confirmedPoint += row.point;
        else {
          value.provisionalPoint += row.point;
          if (row.workType !== WorklogType.REOPEN && (row.reopenCount ?? 0) === 0 && row.valueLevel) {
            const fullPoint = Math.round(Number(row.standardHours ?? row.hoursWorked ?? 0) * WORKLOG_VALUE_RATE[row.valueLevel] * Number(row.completionRate ?? 1));
            value.pendingStability += 1;
            value.pendingStabilityPoint += Math.max(0, fullPoint - row.point);
          }
        }
      }
    }
    if (row.status === WorklogStatus.ENDED && row.resultModelVersion === 2) {
      value.ended += 1;
      if (row.workType !== WorklogType.REOPEN && row.valueLevel) {
        const hours = Number(row.standardHours ?? row.hoursWorked ?? 0);
        const completion = Number(row.completionRate ?? 0);
        value.productiveBasePoint += Math.round(hours * WORKLOG_VALUE_RATE[row.valueLevel] * completion);
      }
      if (row.point === null) value.pendingPoint += 1;
      else {
        value.point += row.point;
        if (row.stabilityStatus === WorklogStabilityStatus.CONFIRMED) value.confirmedPoint += row.point;
        else {
          value.provisionalPoint += row.point;
          if (row.workType !== WorklogType.REOPEN && (row.reopenCount ?? 0) === 0 && row.valueLevel) {
            const fullPoint = Math.round(Number(row.standardHours ?? row.hoursWorked ?? 0) * WORKLOG_VALUE_RATE[row.valueLevel] * Number(row.completionRate ?? 0));
            value.pendingStability += 1;
            value.pendingStabilityPoint += Math.max(0, fullPoint - row.point);
          }
        }
      }
    } else if (row.status === WorklogStatus.ENDED) {
      value.ended += 1;
      if (row.valueLevel) {
        const hours = Number(row.hoursWorked ?? 0);
        value.endedBasePoint += Math.round(hours * WORKLOG_VALUE_RATE[row.valueLevel]);
        value.capitalPoint += calculateWorklogCapitalPoint(row.valueLevel, hours);
      }
    }
  }
  return [...summary.values()].map((value) => ({
    ...value,
    conversionPercent: value.productiveBasePoint + value.endedBasePoint === 0
      ? 0
      : Number((value.productiveBasePoint / (value.productiveBasePoint + value.endedBasePoint) * 100).toFixed(1)),
  }));
}

export function vietnamWeekStart(value: Date | string) {
  const date = vietnamWorkDate(value);
  const midnight = new Date(`${date}T00:00:00.000Z`);
  const daysFromMonday = (midnight.getUTCDay() + 6) % 7;
  midnight.setUTCDate(midnight.getUTCDate() - daysFromMonday);
  return midnight.toISOString().slice(0, 10);
}

export const WORKLOG_SPRINT_ANCHOR = '2026-08-17';

export function vietnamSprintStart(value: Date | string) {
  const workDate = vietnamWorkDate(value);
  const anchor = new Date(`${WORKLOG_SPRINT_ANCHOR}T00:00:00.000Z`);
  const date = new Date(`${workDate}T00:00:00.000Z`);
  const daysFromAnchor = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
  const sprintIndex = Math.floor(daysFromAnchor / 14);
  anchor.setUTCDate(anchor.getUTCDate() + sprintIndex * 14);
  return anchor.toISOString().slice(0, 10);
}

export function worklogSprintNumber(sprintStart: string) {
  const anchor = new Date(`${WORKLOG_SPRINT_ANCHOR}T00:00:00.000Z`);
  const start = new Date(`${sprintStart}T00:00:00.000Z`);
  return Math.floor((start.getTime() - anchor.getTime()) / 86_400_000 / 14) + 1;
}

export function summarizeWorklogsByWeek(rows: WorklogWeeklyRow[], members: WorklogSummaryMember[]) {
  const grouped = new Map<string, WorklogWeeklyRow[]>();
  for (const row of rows) {
    const weekStart = vietnamWeekStart(row.startedAt);
    grouped.set(weekStart, [...(grouped.get(weekStart) ?? []), row]);
  }
  return [...grouped.entries()].sort(([left], [right]) => right.localeCompare(left)).map(([weekStart, weekRows]) => {
    const end = new Date(`${weekStart}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { weekStart, weekEnd: end.toISOString().slice(0, 10), summary: summarizeWorklogs(weekRows, members) };
  });
}

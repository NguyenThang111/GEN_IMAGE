import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import { TaskStatus } from './task.entity';

export function requireAdmin(role: UserRole) {
  if (role !== UserRole.ADMIN) throw new ForbiddenException('Admin permission required');
}

export function requireTaskEditable(status: TaskStatus) {
  if (![TaskStatus.BACKLOG, TaskStatus.ACTIVE, TaskStatus.DONE].includes(status)) throw new BadRequestException('Only Backlog or active task may be edited');
}

export function requireTaskCommentable(status: TaskStatus) {
  if (![TaskStatus.BACKLOG, TaskStatus.ACTIVE, TaskStatus.DONE].includes(status)) throw new BadRequestException('Complete or archived task cannot be commented');
}

export function canDoneTask(role: UserRole, assigned: boolean) {
  return role === UserRole.ADMIN || assigned;
}

export type PersonalTaskNotificationKind = 'ASSIGNED' | 'MENTION';

export function personalTaskNotificationKind(input: { notificationType: string; recipientId: string; eventType?: string | null; payload?: Record<string, unknown> | null }): PersonalTaskNotificationKind | null {
  if (input.notificationType === 'TASK_MENTION') return 'MENTION';
  if (input.notificationType !== 'TASK_EVENT') return null;
  if (input.eventType === 'CREATED') {
    const assigneeIds = Array.isArray(input.payload?.assigneeIds) ? input.payload.assigneeIds : [];
    return assigneeIds.includes(input.recipientId) ? 'ASSIGNED' : null;
  }
  if (input.eventType === 'EDITED') {
    const change = (input.payload?.changes as Record<string, { from?: unknown; to?: unknown }> | undefined)?.assigneeIds;
    const before = Array.isArray(change?.from) ? change.from : [];
    const after = Array.isArray(change?.to) ? change.to : [];
    return !before.includes(input.recipientId) && after.includes(input.recipientId) ? 'ASSIGNED' : null;
  }
  return null;
}

export type TaskPointFactors = {
  outputScope: number;
  complexity: number;
  uncertainty: number;
  risk: number;
  verification: number;
};

export function calculateBasePoint(factors: TaskPointFactors) {
  const total = factors.outputScope + factors.complexity + factors.uncertainty + factors.risk + factors.verification;
  if (total <= 2) return 50;
  if (total <= 4) return 100;
  if (total <= 6) return 200;
  if (total <= 8) return 300;
  return 500;
}

export function assigneeShares(count: number) {
  if (count === 1) return [100];
  if (count === 2) return [75, 25];
  if (count === 3) return [50, 30, 20];
  throw new BadRequestException('Workplace task supports one to three assignees');
}

function vietnamDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function dayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

export function evaluateCompletion(point: string | null, dueDate: string, doneAt: Date, qualityRate = 1, riskReportedAt: Date | null = null) {
  const doneDate = vietnamDate(doneAt);
  const lateDays = Math.max(0, dayDifference(dueDate, doneDate));
  const dueRate = lateDays === 0 ? 1 : lateDays === 1 ? 0.8 : lateDays <= 3 ? 0.6 : 0.4;
  const warnedBeforeDue = riskReportedAt !== null && vietnamDate(riskReportedAt) <= dueDate;
  const reliabilityRate = lateDays === 0 || warnedBeforeDue ? 1 : 0.8;
  const normalizedQuality = Math.max(0, Math.min(1, qualityRate));
  const rate = Number((dueRate * 0.4 + normalizedQuality * 0.4 + reliabilityRate * 0.2).toFixed(4));
  return {
    wasLate: lateDays > 0,
    lateDays,
    dueRate,
    qualityRate: normalizedQuality,
    reliabilityRate,
    rate,
    earnedPoint: point === null ? null : (Number(point) * rate).toFixed(2),
  };
}

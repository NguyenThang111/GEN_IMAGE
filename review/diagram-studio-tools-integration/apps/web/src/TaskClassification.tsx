import React, { useState } from 'react';
import type { TaskPriority } from './api';

const TOPICS = {
  easyscan: 'EasyScan', scanbox: 'ScanBox', keyscan: 'KeyScan', baohanh: 'Bảo hành', autoscanx: 'AutoScan X',
  sanxuat: 'Sản xuất',
} as const;
type TopicKey = keyof typeof TOPICS;
const prefix = /^(easy\s*scan|scan\s*box|key\s*scan|bảo\s*hành|bao\s*hanh|auto\s*scan\s*x|sản\s*xuất|san\s*xuat)(?=$|[\s:–—-])/iu;

// Keep the hash and five CSS slots stable: topic colours must not depend on list order or device.
function customTopicSlot(key: string) {
  let hash = 0;
  for (const char of key) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
  return `custom-${hash % 5}`;
}

export function classifyTaskTitle(title: string) {
  const trimmed = title.trim();
  const match = trimmed.match(/^\[\s*([^\]]+)\s*\]/) ?? trimmed.match(prefix);
  if (!match) return { topic: null, label: '', text: title };
  const key = match[1].normalize('NFD').replace(/[\u0300-\u036f\s]/g, '').replace(/đ/gi, 'd').toLowerCase();
  if (!key) return { topic: null, label: '', text: title };
  const known = Object.prototype.hasOwnProperty.call(TOPICS, key);
  return { topic: known ? key : customTopicSlot(key), label: known ? TOPICS[key as TopicKey] : match[1].trim().replace(/\s+/g, ' '), text: trimmed.slice(match[0].length).replace(/^\s*[-–—:]?\s*/, '') };
}

export function TaskTopicTitle({ title }: { title: string }) {
  const { topic, label, text } = classifyTaskTitle(title);
  return <div className="taskTopicTitle" title={title}>
    {topic && <span className="taskSubjectTag" data-topic={topic}>{label}</span>}
    {text && <b className="taskName">{text}</b>}
  </div>;
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { HIGH: 'Cao', NORMAL: 'Bình thường', LOW: 'Thấp' };
export function taskMatchesPriority(task: { priority?: TaskPriority }, onlyHigh: boolean) { return !onlyHigh || task.priority === 'HIGH'; }

export function TaskPriorityCell({ title, priority = 'NORMAL', admin, onChange }: {
  title: string; priority?: TaskPriority; admin: boolean; onChange: (priority: TaskPriority) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  async function change(value: TaskPriority) {
    if (busy || priority === value) return;
    setBusy(true);
    try { await onChange(value); } finally { setBusy(false); }
  }
  return <div className="taskPriorityCell" data-priority={priority} onClick={event => event.stopPropagation()}>
    <small>Ưu tiên</small>
    {admin ? <select aria-label={`Ưu tiên: ${title}`} value={priority} disabled={busy} aria-busy={busy} onChange={event => void change(event.target.value as TaskPriority)}>
      {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select> : <span aria-label={`Ưu tiên: ${TASK_PRIORITY_LABELS[priority]}`}>{TASK_PRIORITY_LABELS[priority]}</span>}
  </div>;
}

export function TaskListColumnLabels() {
  return <div className="taskListColumnLabels" aria-hidden="true"><span>Task</span><span>Ưu tiên</span><span>Worklog</span><span>Người làm</span><span>Trạng thái</span></div>;
}

export function TaskPriorityFilter({ onlyHigh, onChange }: { onlyHigh: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className={`taskHighPriorityFilter ${onlyHigh ? 'active' : ''}`} aria-pressed={onlyHigh} onClick={() => onChange(!onlyHigh)}>Ưu tiên cao</button>;
}

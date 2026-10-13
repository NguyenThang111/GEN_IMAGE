import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from './api';
import { classifyTaskTitle, TaskTopicTitle, TaskPriorityCell, TaskPriorityFilter, taskMatchesPriority, TaskListColumnLabels } from './TaskClassification';

afterEach(() => vi.unstubAllGlobals());
describe('Task subject labels', () => {
  it.each([
    ['[Easyscan] - SPY file', 'easyscan', 'SPY file'], ['[EASYSCAN] SƠ ĐỒ FI', 'easyscan', 'SƠ ĐỒ FI'],
    ['Easyscan - vẽ mạch 1.9', 'easyscan', 'vẽ mạch 1.9'], ['[ScanBox]: giao tiếp', 'scanbox', 'giao tiếp'],
    ['[Keyscan] Upgrade', 'keyscan', 'Upgrade'], ['[Bảo Hành] : tuần 4/T9', 'baohanh', 'tuần 4/T9'],
    ['bao hanh - test', 'baohanh', 'test'], ['[AutoScan X] - UI', 'autoscanx', 'UI'], ['Auto Scan X — test', 'autoscanx', 'test'],
    ['[ Easy Scan ] - Board', 'easyscan', 'Board'],
    ['[sản xuất] - Hàn mạch', 'sanxuat', 'Hàn mạch'], ['[SAN XUAT] Làm cáp', 'sanxuat', 'Làm cáp'],
    ['Sản xuất - kiểm tra', 'sanxuat', 'kiểm tra'], ['Sản xuất', 'sanxuat', ''],
  ])('recognizes %s without rewriting stored title', (title, topic, text) => {
    expect(classifyTaskTitle(title)).toMatchObject({ topic, text });
    expect(renderToStaticMarkup(<TaskTopicTitle title={title}/>)).toContain(`title="${title}"`);
  });
  it.each(['Test giao tiếp Easyscan', 'Keyscanner — khác', '[ ] test', '[] test', ''])('keeps unrecognized title %s intact', title => {
    expect(classifyTaskTitle(title)).toEqual({ topic: null, label: '', text: title });
  });
  it('gives new bracketed topics a stable colour independent of spelling accents, order and task text', () => {
    const first = classifyTaskTitle('[Đồng bộ] Test A');
    expect(first).toMatchObject({ topic: expect.stringMatching(/^custom-[0-4]$/), label: 'Đồng bộ', text: 'Test A' });
    classifyTaskTitle('[Chủ đề khác] Test');
    expect(classifyTaskTitle('[ dong   bo ] Test B').topic).toBe(first.topic);
    expect(classifyTaskTitle('[ĐỒNG BỘ] Test C').topic).toBe(first.topic);
    expect(classifyTaskTitle('[Unknown] test Keyscan').label).toBe('Unknown');
  });
  it('keeps the approved palette in one stylesheet with dark-mode and all fallback slots', () => {
    const css = readFileSync(new URL('./task-list.css', import.meta.url), 'utf8');
    expect(css).toContain('[data-topic="autoscanx"] { --subject-accent: #526986; --subject-bg: #e5eaf1; --subject-text: #354d6c; }');
    expect(css).toContain('[data-topic="sanxuat"] { --subject-accent: #95839f;');
    expect(css).toContain('[data-topic="easyscan"] { --subject-accent: #aa8058;');
    for (let slot = 0; slot < 5; slot++) {
      expect(css).toContain(`[data-topic="custom-${slot}"] { --subject-accent:`);
      expect(css).toContain(`:root[data-theme="dark"] [data-topic="custom-${slot}"]`);
    }
  });
  it('keeps just the badge for a topic-only title', () => {
    expect(classifyTaskTitle('[Easyscan]')).toMatchObject({ topic: 'easyscan', text: '' });
    const html = renderToStaticMarkup(<TaskTopicTitle title="[Easyscan] - Kiểm tra"/>);
    expect(html).toContain('taskSubjectTag'); expect(html).toContain('taskName'); expect(html).not.toContain('priority');
  });
});
describe('Separate priority column', () => {
  it('renders Admin editing and Member read-only controls', () => {
    const props = { title: 'Task', priority: 'HIGH' as const, onChange: async () => true };
    expect(renderToStaticMarkup(<TaskPriorityCell {...props} admin/>)).toContain('<select');
    const member = renderToStaticMarkup(<TaskPriorityCell {...props} admin={false}/>);
    expect(member).not.toContain('<select'); expect(member).toContain('Ưu tiên: Cao');
    expect(renderToStaticMarkup(<TaskPriorityCell title="Old Task" admin={false} onChange={async () => true}/>)).toContain('Bình thường');
  });
  it('shows priority in its own desktop column and filter state', () => {
    const html = renderToStaticMarkup(<TaskListColumnLabels/>);
    expect(html).toContain('<span>Task</span><span>Ưu tiên</span><span>Worklog</span>');
    expect(renderToStaticMarkup(<TaskPriorityFilter onlyHigh onChange={() => {}}/>)).toContain('aria-pressed="true"');
  });
  it('filters high priority without reordering or changing source data', () => {
    const rows = [{ id: 1, priority: 'NORMAL' as const }, { id: 2, priority: 'HIGH' as const }, { id: 3 }, { id: 4, priority: 'HIGH' as const }];
    expect(rows.filter(row => taskMatchesPriority(row, true)).map(row => row.id)).toEqual([2, 4]);
    expect(rows.filter(row => taskMatchesPriority(row, false))).toEqual(rows);
  });
  it('sends only priority to the matching Task or draft endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); vi.stubGlobal('fetch', fetchMock);
    const api = new Api('test'); await api.setTaskPriority('task-id', 'HIGH'); await api.setTaskDraftPriority('draft-id', 'LOW');
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('/tasks/task-id/priority'), expect.objectContaining({ method: 'PATCH', body: '{"priority":"HIGH"}' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/tasks/drafts/draft-id/priority'), expect.objectContaining({ method: 'PATCH', body: '{"priority":"LOW"}' }));
  });
});

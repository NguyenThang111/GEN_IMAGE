import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskFormModal } from './App';
import { Api, type TaskDraft } from './api';

const draft = { id: 'draft-1', topic: 'Easyscan', description: '', suggestion: 'Saved schematic link', assigneeIds: [], criteria: [] } as unknown as TaskDraft;
const props = { people: [], onClose: () => {}, onSubmit: async () => true, onSaveDraft: async () => true };
afterEach(() => vi.unstubAllGlobals());
describe('Save draft in Backlog', () => {
  it('offers separate save and complete actions, with save first/default', () => {
    const html = renderToStaticMarkup(<TaskFormModal {...props} draft={draft}/>);
    expect(html).toContain('value="save">Lưu — giữ Backlog');
    expect(html).toContain('value="promote">Hoàn thiện Task');
    expect(html.indexOf('value="save"')).toBeLessThan(html.indexOf('value="promote"'));
    expect(html).not.toContain('Đưa vào Đang làm');
  });
  it('requires only Topic and restores saved suggestions', () => {
    const html = renderToStaticMarkup(<TaskFormModal {...props} draft={draft}/>);
    expect(html.match(/required=""/g)).toHaveLength(1);
    expect(html).toContain('Saved schematic link');
    expect(html).toContain('Có thể lưu và giao người phụ trách sau');
  });
  it('keeps normal task creation requirements and actions', () => {
    const html = renderToStaticMarkup(<TaskFormModal {...props}/>);
    expect(html.match(/required=""/g)).toHaveLength(3);
    expect(html).not.toContain('value="promote"');
    expect(html).toContain('Tạo Task');
  });
  it('PATCHes the same draft including empty values, without promoting it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => draft });
    vi.stubGlobal('fetch', fetchMock);
    const input = { topic: 'Easyscan', description: '', suggestion: '', assigneeIds: [], criteria: [] };
    await new Api('token').updateTaskDraft(draft.id, input);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/drafts/draft-1'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify(input) }));
  });
});

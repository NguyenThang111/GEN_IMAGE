import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssigneeOrderPicker } from './App';
import type { User } from './api';

const old: User = { id: 'old', username: 'vinh', displayName: 'VINH', role: 'MEMBER', email: null };
const active: User = { ...old, id: 'active', username: 'thang', displayName: 'THẮNG' };
describe('Historical Task assignees', () => {
  it('shows unavailable selected people so Admin can remove them', () => {
    const html = renderToStaticMarkup(<AssigneeOrderPicker people={[active]} previousPeople={[old, active]} selected={['old', 'active']} onChange={() => {}}/>);
    expect(html).toContain('VINH'); expect(html).toContain('có thể bỏ chọn');
    expect(html.match(/THẮNG/g)).toHaveLength(1); expect(html).not.toContain('disabled');
  });
  it('does not offer an unavailable person again after removal', () => {
    const html = renderToStaticMarkup(<AssigneeOrderPicker people={[active]} previousPeople={[old]} selected={[]} onChange={() => {}}/>);
    expect(html).not.toContain('VINH'); expect(html).toContain('THẮNG');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { isFailedTask, TaskFailedReview } from './TaskFailedReview';
import { taskMatchesPriority } from './TaskClassification';
import { taskMatchesAssignee } from './App';
import type { Task } from './api';

describe('Failed Task tab', () => {
  it('excludes unfinished tasks and pending review; preserves other filters', () => {
    const tasks = [
      { id:'failed',status:'DONE',reviewResult:'FAILED',priority:'HIGH',assignees:[{userId:'phu'}] },
      { id:'pending',status:'DONE',reviewResult:'PENDING' },
      { id:'backlog',status:'BACKLOG',reviewResult:'FAILED' },
      { id:'active',status:'ACTIVE',reviewResult:'FAILED' },
      { id:'complete',status:'COMPLETE',reviewResult:'FAILED' },
    ] as Task[];
    const failed=tasks.filter(isFailedTask);
    expect(failed.map(task=>task.id)).toEqual(['failed']);
    expect(tasks.filter(task=>task.status==='DONE'&&!isFailedTask(task)).map(task=>task.id)).toEqual(['pending']);
    expect(failed.filter(task=>taskMatchesPriority(task,true)&&taskMatchesAssignee(task,'phu'))).toHaveLength(1);
    expect(failed.filter(task=>taskMatchesAssignee(task,'thang'))).toHaveLength(0);
    expect(isFailedTask({...tasks[0],status:'ACTIVE',reviewResult:null})).toBe(false);
  });
  it('renders the reason and Vietnam review date safely', () => {
    const html=renderToStaticMarkup(<TaskFailedReview task={{failedReview:{reason:'Thiếu test <script>',reviewedAt:'2026-10-01T20:30:00Z',reviewerName:'Admin'}} as Task}/>);
    expect(html).toContain('Thiếu test &lt;script&gt;');expect(html).toContain('2/10/2026');expect(html).toContain('Admin');expect(html).toContain('<time');
  });
  it('does not substitute task creation/update dates for missing review evidence', () => {
    const html=renderToStaticMarkup(<TaskFailedReview task={{failedReview:null} as Task}/>);
    expect(html).toContain('Chưa có lý do');expect(html).toContain('Chưa có ngày đánh giá');expect(html).not.toContain('<time');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe,it,expect } from 'vitest';
import { TaskAssigneeQuickEdit,TaskFormModal } from './App';
import type { Task,User } from './api';

describe('Unassigned Task UI',()=>{
  const person={id:'1',displayName:'THẮNG'} as User;
  const task={id:'task',title:'Topic',note:'Description',criteria:[],assignees:[]} as unknown as Task;
  it('keeps empty assignment control visible',()=>{expect(renderToStaticMarkup(<TaskAssigneeQuickEdit task={task} people={[person]} editable onChange={()=>{}}/>)).toContain('Chưa giao');});
  it('does not disable removing the last assignee',()=>{
    const assigned={...task,assignees:[{userId:'1',user:person}]} as Task;
    const html=renderToStaticMarkup(<TaskAssigneeQuickEdit task={assigned} people={[person]} editable onChange={()=>{}}/>);
    expect(html).not.toContain('disabled');
  });
  it('explains empty assignees in edit and requires them when creating',()=>{
    const props={people:[],onClose:()=>{},onSubmit:async()=>true};
    expect(renderToStaticMarkup(<TaskFormModal {...props} task={task}/>)).toContain('Có thể lưu và giao người phụ trách sau');
    expect(renderToStaticMarkup(<TaskFormModal {...props}/>)).toContain('Chọn ít nhất một người phụ trách');
  });
});

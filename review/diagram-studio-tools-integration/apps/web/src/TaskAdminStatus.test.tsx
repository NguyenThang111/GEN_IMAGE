import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {TaskStatusQuickEdit} from './App';
import {Api,type Status,type Task} from './api';

const statuses=['BACKLOG','ACTIVE','DONE','COMPLETE'] as const;
const adminOptions=['BACKLOG','ACTIVE','DONE','FAILED','COMPLETE'];
function render(status:Status,admin:boolean,assigned=false,busy=false){
  return renderToStaticMarkup(<TaskStatusQuickEdit task={{title:'Keyscan',status,assignees:assigned?[{userId:'me'}]:[]} as Task} admin={admin} currentUserId="me" busy={busy} onChange={()=>{}}/>);
}
function values(html:string){return [...html.matchAll(/<option value="([^"]+)"/g)].map(match=>match[1]);}
afterEach(()=>vi.unstubAllGlobals());
describe('Admin Task status control',()=>{
  it.each(statuses)('offers direct failed status from %s for Admin',status=>{
    const html=render(status,true);
    expect(values(html)).toEqual(adminOptions);
    expect(html).toContain(`<option value="${status}" selected=""`);
  });
  it('keeps member permissions unchanged',()=>{
    expect(values(render('BACKLOG',false))).toEqual(['BACKLOG','ACTIVE']);
    expect(values(render('ACTIVE',false))).toEqual(['ACTIVE']);
    expect(values(render('ACTIVE',false,true))).toEqual(['ACTIVE','DONE']);
    expect(values(render('DONE',false,true))).toEqual(['DONE']);
    expect(values(render('COMPLETE',false,true))).toEqual(['COMPLETE']);
  });
  it('disables the dropdown during submission',()=>expect(render('ACTIVE',true,false,true)).toContain('disabled=""'));
  it('labels a failed review as failed, not waiting for review',()=>{
    const html=renderToStaticMarkup(<TaskStatusQuickEdit task={{title:'Keyscan',status:'DONE',reviewResult:'FAILED',assignees:[]} as unknown as Task} admin currentUserId="me" onChange={()=>{}}/>);
    expect(html).toContain('<option value="FAILED" selected="">KHÔNG ĐẠT</option>');
    expect(html).toContain('<option value="DONE">CHỜ REVIEW</option>');
    expect(values(html)).toEqual(adminOptions);
  });
  it('sends a direct failed request without requiring a reason',async()=>{
    const fetchMock=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({id:'task-id',status:'DONE',reviewResult:'FAILED'})});
    vi.stubGlobal('fetch',fetchMock);
    await new Api('test-token').failTaskReview('task-id');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/task-id/review-failed'),expect.objectContaining({method:'POST',body:'{}'}));
  });
  it('sends the exact chosen status to the direct endpoint',async()=>{
    const fetchMock=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({id:'task-id',status:'BACKLOG'})});
    vi.stubGlobal('fetch',fetchMock);
    await new Api('test-token').setTaskStatus('task-id','BACKLOG');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/tasks/task-id/status'),expect.objectContaining({method:'PATCH',body:JSON.stringify({status:'BACKLOG'})}));
  });
});

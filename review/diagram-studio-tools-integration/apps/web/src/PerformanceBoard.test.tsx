import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PerformanceContent, PerformanceMemberRow, performanceConclusion } from './PerformanceBoard';
import type { PerformanceReport, PerformanceRow } from './performance-types';

const row:PerformanceRow={userId:'thang',displayName:'THẮNG',point:400,calendarHours:6,carryInHours:2,totalHours:8,reworkHours:3,standardHours:4,firstPassPercent:0,contribution:40,efficiency:20,quality:0,score:60,issues:['Thiếu giờ làm lại: Firmware'],dataIssues:['Thiếu giờ làm lại: Firmware'],fingerprint:'hash',verifiedAt:null,eligible:false,proposedBonus:null,rank:null};
const report:PerformanceReport={month:'2026-10',monthClosed:false,comparisonReady:false,tied:false,period:null,members:[row],candidates:[],availableTasks:[],plans:[],failures:[{id:'f1',taskId:'t',title:'Firmware <script>',reason:'Thiếu test',reviewedAt:'2026-10-01T18:00:00Z',reviewer:'Admin',userIds:['thang'],assignees:['THẮNG'],assignmentHistorical:true,status:'COMPLETE',resolved:true,planned:false}]};
describe('Dev performance presentation',()=>{
  it('keeps Point, calendar hours, rework/carry-in, and assessment score distinct',()=>{
    const html=renderToStaticMarkup(<table><tbody><PerformanceMemberRow row={row} closed={false} detailed/></tbody></table>);
    for(const text of ['400','6h','3h làm lại','2h từ tháng trước','H xét:','60','Chưa đủ dữ liệu']) expect(html).toContain(text);
    expect(html).not.toContain('Đề xuất hạng');
  });
  it('retains resolved failure history and does not pretend legacy records have a baseline',()=>{
    const html=renderToStaticMarkup(<PerformanceContent report={report} admin={false} busy={false} onAttest={()=>{}} onOpenTask={()=>{}}/>);
    expect(html).toContain('Đã hoàn thành sau lần không đạt');expect(html).toContain('Thiếu test');expect(html).toContain('2/10/2026');
    expect(html).toContain('Firmware &lt;script&gt;');expect(html).toContain('không tự tính lại Point');
    expect(html).not.toContain('Xác nhận đã đối chiếu đủ giờ');
  });
  it('disables Admin attestation while evidence is missing',()=>{
    const html=renderToStaticMarkup(<PerformanceContent report={report} admin busy={false} onAttest={()=>{}} onOpenTask={()=>{}}/>);
    expect(html).toContain('disabled=""');expect(html).toContain('Xác nhận đã đối chiếu đủ giờ');
  });
  it('keeps open-month scores provisional and ties explicit',()=>{
    const html=renderToStaticMarkup(<table><tbody><PerformanceMemberRow row={{...row,issues:[],score:90}} closed={false}/></tbody></table>);
    expect(html).toContain('Tạm tính');
    const tied=renderToStaticMarkup(<PerformanceContent report={{...report,monthClosed:true,period:{month:'2026-10',effectiveDate:'2026-10-01',targetPoint:400,memberIds:['thang','phu'],createdAt:'2026-10-01',createdById:'admin'},comparisonReady:true,tied:true}} admin={false} busy={false} onAttest={()=>{}} onOpenTask={()=>{}}/>);
    expect(tied).toContain('đồng điểm');
  });
  it('subscribes to realtime/reconnect with polling fallback and teardown',()=>{
    const source=readFileSync(new URL('./PerformanceBoard.tsx',import.meta.url),'utf8');
    expect(source).toContain("socket.on('performance.updated',load)");expect(source).toContain("socket.on('connect',load)");
    expect(source).toContain('30000');expect(source).toContain('window.clearInterval(timer)');expect(source).toContain('socket.disconnect()');
    expect(source).toContain('request===sequence');
  });
  it('shows only five summary columns and keeps evidence/configuration inside closed details',()=>{
    const html=renderToStaticMarkup(<PerformanceContent report={report} admin busy={false} onAttest={()=>{}} onOpenTask={()=>{}}><form>Monthly configuration</form></PerformanceContent>);
    const summary=html.slice(0,html.indexOf('<details'));
    for(const label of ['Dev','Point được duyệt','Tổng giờ','Giờ làm lại','Kết luận','8h','3h','Chưa đủ dữ liệu đánh giá']) expect(summary).toContain(label);
    for(const label of ['Đóng góp','Chất lượng','Lịch sử không đạt','Monthly configuration','Xác nhận đã đối chiếu']) expect(summary).not.toContain(label);
    expect(html).toContain('<details class="performanceDetails"><summary>Xem chi tiết</summary>');
    expect(html.indexOf('Monthly configuration')).toBeGreaterThan(html.indexOf('Xem chi tiết'));
    expect(html).not.toContain('<details open');
  });
  it('summarizes only verified ranking and distinguishes an incomplete colleague',()=>{
    const ready={...report,period:{month:'2026-10',effectiveDate:'2026-10-01',targetPoint:400,memberIds:['thang','phu'],createdAt:'2026-10-01',createdById:'admin'},monthClosed:true,comparisonReady:true,members:[{...row,issues:[],eligible:true,rank:1,proposedBonus:2000000}]};
    expect(performanceConclusion(ready)).toContain('THẮNG dẫn đầu theo đánh giá tháng: 400 Point / 8h, gồm 3h làm lại');
    expect(performanceConclusion({...ready,members:[...ready.members,{...row,userId:'phu'}]})).toContain('trong nhóm đủ dữ liệu');
    expect(performanceConclusion({...ready,monthClosed:false})).toContain('chưa chốt thưởng');
    expect(performanceConclusion({...ready,tied:true})).toContain('đồng điểm');
    expect(performanceConclusion({...ready,comparisonReady:false})).toContain('Chưa đủ dữ liệu');
    expect(performanceConclusion({...ready,members:[{...row,issues:[],eligible:false,rank:null}]})).toContain('Chưa có Dev đủ điều kiện');
  });
});

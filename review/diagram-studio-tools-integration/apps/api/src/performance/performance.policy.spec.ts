import { evaluatePerformance, isCompletion, PerformanceInput } from './performance.policy';
import { Task, TaskStatus } from '../tasks/task.entity';
import { TaskEvent, TaskEventType } from '../tasks/task-event.entity';
import { Worklog, WorklogStatus, WorklogType } from '../worklogs/worklog.entity';
import { PerformancePeriod, PerformancePlan } from './performance.entity';

const at=(day:string)=>new Date(`${day}T10:00:00+07:00`);
function event(id:string,type:TaskEventType,day:string,payload:Record<string,unknown>={}):TaskEvent {
  return {id,taskId:'task',actorId:'admin',type,createdAt:at(day),payload} as TaskEvent;
}
function log(id='log',input:Partial<Worklog>={}):Worklog {
  return {id,userId:'thang',primaryTaskId:'task',tasks:[],input:'Kết quả',output:'Commit đã test',hoursWorked:'4',status:WorklogStatus.DONE,workType:WorklogType.NORMAL,startedAt:at('2026-10-05'),createdAt:at('2026-10-05'),updatedAt:at('2026-10-05'),deletedAt:null,...input} as Worklog;
}
function fixture():PerformanceInput {
  return {
    month:'2026-10',now:at('2026-11-02'),trialStart:'2026-10-01',
    period:{month:'2026-10',effectiveDate:'2026-10-01',targetPoint:400,memberIds:['thang','phu'],createdAt:at('2026-10-01')} as PerformancePeriod,
    members:[{id:'thang',username:'thang',displayName:'THẮNG'},{id:'phu',username:'phu',displayName:'PHÚ'}],
    tasks:[{id:'task',title:'Firmware',status:TaskStatus.COMPLETE,assignees:[]} as unknown as Task],
    events:[event('done',TaskEventType.COMPLETED,'2026-10-08')],logs:[log()],
    plans:[{taskId:'task',point:400,standardHours:'4',shares:[{userId:'thang',percent:100}],createdAt:at('2026-10-02')} as PerformancePlan],attestations:[],
  };
}
const first=(input:PerformanceInput)=>evaluatePerformance(input).members[0];

describe('prospective performance trial',()=>{
  it('separates fixed output Point from legacy Worklog Point and caps efficiency',()=>{
    const input=fixture();input.logs[0].point=99999;input.logs[0].hoursWorked='1';
    expect(first(input)).toMatchObject({point:400,calendarHours:1,standardHours:4,contribution:40,efficiency:40,quality:20,score:100,eligible:false,proposedBonus:null});
    expect(input.logs[0].point).toBe(99999);
  });
  it('keeps failed evidence after completion and dilutes efficiency without new Point',()=>{
    const input=fixture();input.events.unshift(event('failed',TaskEventType.REVIEWED,'2026-10-06',{result:'FAILED',reason:'Thiếu test',assigneeIds:['thang']}));
    input.logs.push(log('rework',{workType:WorklogType.REOPEN,hoursWorked:'4',startedAt:at('2026-10-07'),createdAt:at('2026-10-07')}));
    const report=evaluatePerformance(input);
    expect(report.members[0]).toMatchObject({point:400,totalHours:8,reworkHours:4,efficiency:20,quality:0,score:60});
    expect(report.members[0].dataIssues).toEqual([]);
    expect(report.failures[0]).toMatchObject({reason:'Thiếu test',resolved:true,assignmentHistorical:true,assignees:['THẮNG']});
    input.events.push(event('done-again',TaskEventType.COMPLETED,'2026-10-09'));
    expect(first(input).point).toBe(400);
  });
  it('requires rework records for every failure cycle, not just a changed Task status',()=>{
    const input=fixture();input.events.unshift(event('f1',TaskEventType.REVIEWED,'2026-10-04',{result:'FAILED'}),event('f2',TaskEventType.REVIEWED,'2026-10-06',{result:'FAILED'}));
    input.logs=[log('first-rework',{workType:WorklogType.REOPEN})];
    expect(first(input).dataIssues).toContain('Thiếu giờ làm lại: Firmware');
  });
  it('does not treat a pre-review same-day Worklog as rework',()=>{
    const input=fixture();input.logs[0].workType=WorklogType.REOPEN;
    const failure=event('failure',TaskEventType.REVIEWED,'2026-10-05',{result:'FAILED'});failure.createdAt=new Date('2026-10-05T11:00:00+07:00');
    input.events.unshift(failure);
    expect(first(input).dataIssues).toContain('Thiếu giờ làm lại: Firmware');
  });
  it('counts OPEN, ENDED, unplanned hours once; missing evidence never means zero',()=>{
    const input=fixture();input.logs.push(log('open',{status:WorklogStatus.OPEN,hoursWorked:'2'}),log('ended',{status:WorklogStatus.ENDED,hoursWorked:'3'}),log('unknown',{primaryTaskId:null,tasks:[],hoursWorked:null,output:null}));
    const row=first(input);expect(row.totalHours).toBe(9);expect(row.dataIssues.join(' ')).toContain('thiếu giờ');expect(row.dataIssues.join(' ')).toContain('thiếu kết quả');
    expect(row.dataIssues.join(' ')).toContain('chưa rõ Task');expect(row.eligible).toBe(false);
  });
  it('does not retrospectively award unplanned legacy Worklogs',()=>{
    const input=fixture();input.plans=[];input.logs[0].point=500;
    expect(first(input)).toMatchObject({point:0,totalHours:4,eligible:false});
    expect(first(input).dataIssues.join(' ')).toContain('chốt trước khi làm');
  });
  it('flags active assigned work even if the Dev never creates a Worklog',()=>{
    const input=fixture();input.plans=[];input.logs=[];input.tasks[0].assignees=[{userId:'thang'}] as Task['assignees'];
    expect(first(input).dataIssues).toContain('Task có hoạt động nhưng chưa chốt Point/giờ chuẩn: Firmware');
    expect(first(input).eligible).toBe(false);
  });
  it('blocks backdated work performed before the baseline, rather than retroactively scoring it',()=>{
    const input=fixture();input.logs[0].startedAt=at('2026-10-01');
    expect(first(input).dataIssues).toContain('Giờ làm trước ngày chốt baseline: Kết quả');
  });
  it('splits output and standard hours by frozen shares, never doubles a shared task',()=>{
    const input=fixture();input.plans[0].shares=[{userId:'thang',percent:25},{userId:'phu',percent:75}];input.logs.push(log('phu-log',{userId:'phu'}));
    const rows=evaluatePerformance(input).members;
    expect(rows.map(row=>row.point)).toEqual([100,300]);expect(rows.map(row=>row.standardHours)).toEqual([1,3]);
  });
  it('recognizes Admin free-status completion and never awards it twice across months',()=>{
    const input=fixture();input.events=[event('free',TaskEventType.EDITED,'2026-10-08',{source:'ADMIN_STATUS_CHANGE',changes:{status:{to:'COMPLETE'}}})];
    expect(isCompletion(input.events[0])).toBe(true);expect(first(input).point).toBe(400);
    input.events.unshift(event('old',TaskEventType.COMPLETED,'2026-09-30'));
    expect(first(input).point).toBe(0);
  });
  it('includes carry-in hours and respects Vietnam month boundaries',()=>{
    const input=fixture();input.trialStart='2026-09-01';input.plans[0].createdAt=at('2026-09-02');
    input.logs.push(log('carry',{startedAt:at('2026-09-29'),createdAt:at('2026-09-29'),hoursWorked:'6'}));
    expect(first(input)).toMatchObject({calendarHours:4,carryInHours:6,totalHours:10,point:400,efficiency:16});
    input.events[0].createdAt=new Date('2026-09-30T17:30:00Z');
    expect(first(input).point).toBe(400);
  });
  it('never turns absent target/zero hours into a valid performance score',()=>{
    const input=fixture();input.period=null;input.logs[0].hoursWorked=null;
    expect(first(input)).toMatchObject({score:null,eligible:false});
  });
  it('invalidates Admin attestation when evidence, hours or review history changes',()=>{
    const input=fixture();const fingerprint=first(input).fingerprint;
    input.attestations=[{month:input.month,userId:'thang',fingerprint,verifiedById:'admin',verifiedAt:at('2026-11-02')}];
    expect(first(input).eligible).toBe(true);
    input.logs[0].hoursWorked='5';
    expect(first(input).eligible).toBe(false);expect(first(input).verifiedAt).toBeNull();
    input.logs[0].hoursWorked='4';input.events.push(event('failed-later',TaskEventType.REVIEWED,'2026-10-10',{result:'FAILED'}));
    expect(first(input).eligible).toBe(false);
  });
  it('excludes incomplete data without letting one missing report veto the other Dev',()=>{
    const input=fixture();input.attestations=[{month:input.month,userId:'thang',fingerprint:first(input).fingerprint,verifiedById:'admin',verifiedAt:at('2026-11-02')}];
    expect(evaluatePerformance(input).comparisonReady).toBe(true);expect(first(input).proposedBonus).toBe(2000000);
    expect(evaluatePerformance(input).members[1].proposedBonus).toBeNull();
  });
  it('derives rework hours from failed review cycles even for a normal Worklog',()=>{
    const input=fixture();input.events.unshift(event('failed',TaskEventType.REVIEWED,'2026-10-06',{result:'FAILED'}));
    input.logs.push(log('fix',{createdAt:at('2026-10-07'),startedAt:at('2026-10-07'),hoursWorked:'2',workType:WorklogType.NORMAL}));
    expect(first(input)).toMatchObject({point:400,totalHours:6,reworkHours:2});expect(first(input).dataIssues).toEqual([]);
  });
  it('keeps first-review quality distinct from a later defect but still flags and counts repair effort',()=>{
    const input=fixture();input.events.push(event('late-defect',TaskEventType.REVIEWED,'2026-10-09',{result:'FAILED'}));
    expect(first(input)).toMatchObject({point:400,firstPassPercent:100,quality:20,eligible:false});
    expect(first(input).dataIssues).toContain('Chưa xử lý lần không đạt: Firmware');
    input.logs.push(log('repair',{createdAt:at('2026-10-10'),startedAt:at('2026-10-10'),hoursWorked:'2'}));
    input.events.push(event('recomplete',TaskEventType.COMPLETED,'2026-10-11'));
    expect(first(input)).toMatchObject({point:400,totalHours:6,reworkHours:2,firstPassPercent:100});
    expect(first(input).dataIssues).toEqual([]);
  });
  it('only suggests rewards after month end, does not silently break ties',()=>{
    const input=fixture();input.plans[0].point=800;input.plans[0].standardHours='8';input.plans[0].shares=[{userId:'thang',percent:50},{userId:'phu',percent:50}];input.logs.push(log('phu-log',{userId:'phu'}));
    const attest=()=>{input.attestations=evaluatePerformance({...input,attestations:[]}).members.map(row=>({month:input.month,userId:row.userId,fingerprint:row.fingerprint,verifiedById:'admin',verifiedAt:at('2026-11-02')}));};
    attest();expect(evaluatePerformance(input).tied).toBe(true);expect(first(input).proposedBonus).toBeNull();
    input.logs[1].hoursWorked='5';attest();
    expect(evaluatePerformance(input).members.map(row=>row.proposedBonus)).toEqual([2000000,1500000]);
    input.now=at('2026-10-20');expect(first(input).proposedBonus).toBeNull();
  });
  it('does not count BACKLOG or deleted work as worked hours',()=>{
    const input=fixture();input.logs.push(log('backlog',{status:WorklogStatus.BACKLOG,hoursWorked:'10'}),log('deleted',{deletedAt:at('2026-10-07'),hoursWorked:'10'}));
    expect(first(input).totalHours).toBe(4);
  });
});

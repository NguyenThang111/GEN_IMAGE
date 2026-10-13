import { useEffect, useState, type ReactNode } from 'react';
import type { Api } from './api';
import type { PerformanceReport, PerformanceRow } from './performance-types';
import './performance.css';

const number=(value:number|null)=>value===null?'—':value.toLocaleString('vi-VN',{maximumFractionDigits:2});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});

export function PerformanceMemberRow({row,closed,detailed=false}:{row:PerformanceRow;closed:boolean;detailed?:boolean}) {
  if(!detailed) return <tr>
    <th scope="row">{row.displayName}</th>
    <td><b>{number(row.point)}</b></td>
    <td><b>{number(row.totalHours)}h</b>{row.carryInHours>0&&<small>Gồm {number(row.carryInHours)}h từ tháng trước</small>}</td>
    <td>{number(row.reworkHours)}h</td>
    <td>{row.issues.length?'Chưa đủ dữ liệu đánh giá':!closed?'Tạm tính · tháng chưa kết thúc':row.eligible?'Đủ điều kiện xét thưởng':'Chưa đạt ngưỡng thưởng'}{!row.issues.length&&row.proposedBonus!==null&&<small>Đề xuất hạng {row.rank}: {number(row.proposedBonus)}đ</small>}</td>
  </tr>;
  return <tr>
    <th scope="row">{row.displayName}</th>
    <td><b>{number(row.point)}</b><small>Point đầu ra</small></td>
    <td><b>{number(row.calendarHours)}h</b><small>{number(row.reworkHours)}h làm lại (trong H xét)</small>{row.carryInHours>0&&<small>+{number(row.carryInHours)}h từ tháng trước</small>}<small>H xét: {number(row.totalHours)} · Chuẩn: {number(row.standardHours)}</small></td>
    <td>{number(row.contribution)} / 40</td><td>{number(row.efficiency)} / 40</td>
    <td>{number(row.quality)} / 20<small>{number(row.firstPassPercent)}% đạt lần đầu</small></td>
    <td><strong>{number(row.score)} / 100</strong><small>{row.issues.length?'Chưa đủ dữ liệu':!closed?'Tạm tính · tháng chưa kết thúc':row.eligible?'Đủ ngưỡng xét':'Chưa đạt 70 điểm'}</small>{row.proposedBonus!==null&&<small>Đề xuất hạng {row.rank}: {number(row.proposedBonus)}đ</small>}</td>
  </tr>;
}

export function performanceConclusion(report:PerformanceReport) {
  if(!report.period) return 'Chưa cấu hình tháng — chưa đủ dữ liệu đánh giá.';
  if(!report.comparisonReady) return 'Chưa đủ dữ liệu đánh giá. Xem chi tiết để bổ sung.';
  if(!report.monthClosed) return 'Tháng chưa kết thúc — số liệu tạm tính, chưa chốt thưởng.';
  if(report.tied) return 'Hai Dev đồng điểm — chưa đề xuất thứ hạng.';
  const leader=report.members.find(row=>row.rank===1&&row.eligible&&!row.issues.length);
  if(!leader) return 'Chưa có Dev đủ điều kiện nhận đề xuất thưởng.';
  const scope=report.members.some(row=>row.issues.length)?'trong nhóm đủ dữ liệu':'theo đánh giá tháng';
  return `${leader.displayName} dẫn đầu ${scope}: ${number(leader.point)} Point / ${number(leader.totalHours)}h, gồm ${number(leader.reworkHours)}h làm lại. Thưởng chờ Admin duyệt.`;
}

export function PerformanceContent({report,admin,busy,onAttest,onOpenTask,children}:{report:PerformanceReport;admin:boolean;busy:boolean;onAttest:(row:PerformanceRow)=>void;onOpenTask:(id:string)=>void;children?:ReactNode}) {
  return <>
    <div className="performanceTable performanceSummary"><table><thead><tr><th>Dev</th><th>Point được duyệt</th><th>Tổng giờ</th><th>Giờ làm lại</th><th>Kết luận</th></tr></thead><tbody>{report.members.map(row=><PerformanceMemberRow key={row.userId} row={row} closed={report.monthClosed}/>)}</tbody></table></div>
    {!report.members.length&&<p>Chưa có tài khoản Dev phù hợp. Không tự tạo thành viên hoặc số liệu.</p>}
    <p className="performanceNotice">{performanceConclusion(report)}</p>
    <details className="performanceDetails"><summary>Xem chi tiết</summary>
    {report.period&&<p>Áp dụng từ <b>{report.period.effectiveDate}</b> · Mốc chung <b>{number(report.period.targetPoint)} Point/tháng</b> · Tối thiểu <b>70/100</b> và đủ dữ liệu mới xét thưởng.</p>}
    <div className="performanceTable"><table><thead><tr><th>Dev</th><th>Point xét thưởng</th><th>Giờ thực tế</th><th>Đóng góp</th><th>Hiệu suất</th><th>Chất lượng</th><th>Tổng đánh giá</th></tr></thead><tbody>{report.members.map(row=><PerformanceMemberRow key={row.userId} row={row} closed={report.monthClosed} detailed/>)}</tbody></table></div>
    <div className="performanceIssues">{report.members.map(row=><article key={row.userId}><h3>{row.displayName} · {row.issues.length?'Cần bổ sung':'Dữ liệu đã xác nhận'}</h3>{row.issues.length>0?<ul>{row.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p>Đã đối chiếu giờ và bằng chứng{row.verifiedAt?` · ${date(row.verifiedAt)}`:''}.</p>}{admin&&<button disabled={busy||row.dataIssues.length>0||Boolean(row.verifiedAt)} onClick={()=>onAttest(row)}>Xác nhận đã đối chiếu đủ giờ</button>}</article>)}</div>
    <section className="performanceHistory"><h3>Lịch sử không đạt · {report.failures.length} lần</h3><p>Giữ lại kể cả khi Task đã làm lại và hoàn thành. Bấm Task để đọc comment, Worklog và lịch sử.</p>
      {report.failures.length===0?<p>Chưa ghi nhận lần không đạt đến cuối kỳ đang xem.</p>:report.failures.map(failure=><article key={failure.id}>
        <div><button className="performanceTaskLink" onClick={()=>onOpenTask(failure.taskId)}>{failure.title}</button><b>{failure.resolved?'Đã hoàn thành sau lần không đạt':'Cần xử lý'}</b></div>
        <p>{failure.reason}</p><small>{failure.assignees.join(' · ')||'Chưa rõ người phụ trách'}{!failure.assignmentHistorical?' (phân công hiện tại; lịch sử cũ chưa lưu snapshot)':''} · {date(failure.reviewedAt)} · Review: {failure.reviewer}</small>
        {!failure.planned&&<small>Lịch sử trước cơ chế mới — không tự tính lại Point.</small>}
      </article>)}
    </section>
    <details><summary>Point/giờ chuẩn đã chốt · {report.plans.length} Task</summary>{report.plans.map(plan=><p key={plan.taskId}><button className="performanceTaskLink" onClick={()=>onOpenTask(plan.taskId)}>{plan.title}</button> · {number(plan.point)} Point · {number(Number(plan.standardHours))}h chuẩn · {plan.shares.map(share=>`${report.members.find(member=>member.userId===share.userId)?.displayName??share.userId}: ${share.percent}%`).join(' / ')}</p>)}</details>
    {children}
    </details>
  </>;
}

export function PerformanceBoard({api,month,admin,onOpenTask}:{api:Api;month:string;admin:boolean;onOpenTask:(id:string)=>void}) {
  const [report,setReport]=useState<PerformanceReport|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [target,setTarget]=useState('');
  const [effectiveDate,setEffectiveDate]=useState(month===today().slice(0,7)?today():`${month}-01`);
  const [taskId,setTaskId]=useState('');
  const [point,setPoint]=useState('');
  const [standardHours,setStandardHours]=useState('');
  const [shares,setShares]=useState<Record<string,string>>({});
  useEffect(()=>{
    let alive=true,sequence=0;
    const load=async()=>{const request=++sequence;try{const next=await api.performance(month);if(alive&&request===sequence){setReport(next);setError('');}}catch(err){if(alive&&request===sequence)setError(err instanceof Error?err.message:'Không tải được hiệu suất');}};
    void load();
    const socket=api.connect(()=>void load());
    socket.on('performance.updated',load);socket.on('connect',load);
    const timer=window.setInterval(()=>void load(),30000);
    return()=>{alive=false;window.clearInterval(timer);socket.disconnect();};
  },[api,month]);
  const run=async(action:()=>Promise<PerformanceReport>)=>{setBusy(true);setError('');try{await action();setReport(await api.performance(month));}catch(err){setError(err instanceof Error?err.message:'Không lưu được');}finally{setBusy(false);}};
  const selected=report?.availableTasks.find(task=>task.id===taskId);
  const participants=report?.members.filter(member=>selected?.assigneeIds.includes(member.userId))??[];
  return <section className="performanceBoard" aria-label="Hiệu suất và thưởng Dev">
    <header><h2>HIỆU SUẤT DEV · {month}</h2><span>Thử nghiệm</span></header>
    <p>Point đầu ra được duyệt · Tổng giờ đã gồm giờ làm lại.</p>
    {error&&<p role="alert" className="error">{error} — số liệu đang hiển thị có thể đã cũ.</p>}
    {!report?<p>Đang tải…</p>:<>
      <PerformanceContent report={report} admin={admin} busy={busy||Boolean(error)} onOpenTask={onOpenTask} onAttest={row=>{if(window.confirm('Xác nhận đã đối chiếu đủ toàn bộ giờ làm, kể cả việc chưa đạt/làm lại, và bằng chứng trong kỳ?'))void run(()=>api.attestPerformance(month,row.userId,row.fingerprint));}}>
      {admin&&!report.period&&<form onSubmit={event=>{event.preventDefault();if(window.confirm('Công bố mốc chung cho tháng? Cấu hình được giữ cố định và không áp hồi tố.'))void run(()=>api.createPerformancePeriod({month,effectiveDate,targetPoint:Number(target),memberIds:report.candidates.map(member=>member.id)}));}}>
        <h3>Admin · Công bố tháng thử nghiệm</h3><p>{report.candidates.map(member=>member.displayName).join(' · ')}. Mốc chung dùng cho cả hai Dev, không tự giảm theo số ngày đi làm.</p>
        <label>Mốc Point chung<input type="number" min="1" max="1000000" required value={target} onChange={event=>setTarget(event.target.value)}/></label>
        <label>Ngày áp dụng (không hồi tố)<input type="date" min={today()} required value={effectiveDate} onChange={event=>setEffectiveDate(event.target.value)}/></label>
        <button disabled={busy||report.candidates.length!==2||month<today().slice(0,7)}>Công bố mốc thưởng</button>
      </form>}
      {admin&&report.period&&month===today().slice(0,7)&&<details><summary>Admin · Chốt Point và giờ chuẩn trước khi làm</summary><form onSubmit={event=>{event.preventDefault();const allocation=participants.map(member=>({userId:member.userId,percent:Number(shares[member.userId]??0)})).filter(share=>share.percent>0);if(allocation.reduce((sum,share)=>sum+share.percent,0)!==100){setError('Phân bổ cần đủ 100%');return;}if(window.confirm('Chốt baseline cố định cho Task? Không tăng Point khi làm lại; phạm vi mới phải tách Task.'))void run(()=>api.createPerformancePlan({taskId,point:Number(point),standardHours:Number(standardHours),shares:allocation}));}}>
        <p>Chỉ chọn Task Backlog chưa từng làm/ghi Worklog. Point và giờ chuẩn được chia theo tỷ lệ, không nhân đôi khi có hai người.</p>
        <label>Task<select required value={taskId} onChange={event=>{setTaskId(event.target.value);const task=report.availableTasks.find(task=>task.id===event.target.value);const ids=report.members.filter(member=>task?.assigneeIds.includes(member.userId));setShares(Object.fromEntries(ids.map(member=>[member.userId,String(100/ids.length)])));}}><option value="">Chọn Task chưa bắt đầu</option>{report.availableTasks.filter(task=>task.assigneeIds.some(id=>report.members.some(member=>member.userId===id))).map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <label>Point đầu ra<input required type="number" min="1" max="1000000" value={point} onChange={event=>setPoint(event.target.value)}/></label>
        <label>Giờ chuẩn<input required type="number" step="0.01" min="0.01" max="10000" value={standardHours} onChange={event=>setStandardHours(event.target.value)}/></label>
        {participants.map(member=><label key={member.userId}>{member.displayName} · %<input type="number" min="0" max="100" step="1" required value={shares[member.userId]??''} onChange={event=>setShares({...shares,[member.userId]:event.target.value})}/></label>)}
        <button disabled={busy||!selected}>Chốt Point / H chuẩn</button>
      </form></details>}
    <details><summary>Cách tính và giới hạn dữ liệu</summary><p>Đóng góp = Point đầu ra được duyệt / mốc chung × 40. Hiệu suất = H chuẩn đầu ra được duyệt / H xét × 40. Mỗi phần tối đa 40. Chất lượng = tỷ lệ Point đầu ra đạt ngay lần review đầu × 20.</p><p>H xét gồm mọi giờ trong kỳ và giờ từ tháng trước của Task lần đầu hoàn thành trong kỳ. Việc chưa hoàn thành vẫn tiêu tốn H. Cần ghi đủ Worklog; hệ thống không thể tự biết giờ chưa được báo cáo.</p><p>Worklog mới gắn cùng Task sau lần Không đạt và trước lần review tiếp theo được tính là giờ làm lại. Báo giờ trước khi gửi lại kết quả; không cần nhập thêm bộ giờ riêng.</p><p>Admin xác nhận đủ dữ liệu; thay đổi sau đó làm mất hiệu lực xác nhận. Thưởng đề xuất hạng 1: 2 triệu, hạng 2: 1,5 triệu, chỉ sau khi tháng kết thúc, trong nhóm đủ dữ liệu và đạt 70 điểm. Thiếu báo cáo không được xét nhưng không chặn người đã đủ dữ liệu. Đồng điểm cần Admin quyết định. Lịch sử không đạt không biến mất sau khi hoàn thành.</p></details>
      </PerformanceContent>
    </>}
  </section>;
}

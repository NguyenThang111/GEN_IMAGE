import { Fragment } from 'react';
import type { ProductionEntry, ProductionWorkSession, User } from './api';
import { AvatarContent } from './MemberAvatars';
import { registrationTimeLabel } from './ProductionRegistration';

export function productionTeam(person:Pick<User,'username'|'displayName'>){
  const key=person.username.trim().toLowerCase();
  if(key==='locbk')return 'BOTH';
  return ['thanhbk','phongbk','minhbk'].includes(key)||['THANH BK','PHONG BK','MINH BK'].includes(person.displayName.trim().toUpperCase())?'SOLDER':'CABLE';
}
export function ProductionSchedule({people,dates,sessions,entries,dayLabel,onOpen}:{people:User[];dates:string[];sessions:ProductionWorkSession[];entries:ProductionEntry[];dayLabel:(date:string)=>string;onOpen:(id:string,date:string)=>void}){
  return <div className="productionScheduleGrid"><span>THÀNH VIÊN</span>{dates.map(date=><b key={date}>{dayLabel(date)}</b>)}{(['SOLDER','CABLE','BOTH'] as const).map(team=>{
    const members=people.filter(person=>productionTeam(person)===team);if(!members.length)return null;
    return <Fragment key={team}><div className={`productionTeamHeading ${team.toLowerCase()}`}>{team==='SOLDER'?'HÀN MẠCH':team==='BOTH'?'Hàn mạch · Làm cáp':'LÀM CÁP'} <small>{members.length} thành viên</small></div>{members.map(person=><Fragment key={person.id}><strong className="productionScheduleMember"><span className="avatar"><AvatarContent userId={person.id} name={person.displayName}/></span>{person.displayName}</strong>{dates.map(date=>{
      const session=sessions.find(row=>row.userId===person.id&&row.workDate===date);
      const reported=Boolean(session?.isRegistered&&session.hoursWorked!==null&&entries.some(row=>row.userId===person.id&&row.workDate===date&&['Báo cáo tự do','Báo cáo theo Worklog'].includes(row.workType)));
      const missing=session?.registrationTimeMissing;
      return <button type="button" className={missing?'registered missingStartTime':reported?'registered reported':session?.isRegistered?'registered':''} key={date} aria-label={`${person.displayName} ${date}`} onClick={()=>onOpen(person.id,date)}>
        <small>{missing?'CHƯA ĐĂNG KÝ GIỜ':reported?'ĐÃ BÁO CÔNG':session?.isRegistered?'ĐÃ ĐĂNG KÝ':'CHƯA ĐĂNG KÝ'}</small>
        {session?.isRegistered&&<span className="scheduleStartTime">{missing?'⚠ Chưa tính công':registrationTimeLabel(session)}</span>}
        {reported&&<span className="scheduleActualHours">{Number(session?.hoursWorked).toLocaleString('vi-VN',{maximumFractionDigits:2})}h{missing?' đã nhập':''}</span>}
      </button>;
    })}</Fragment>)}</Fragment>;
  })}</div>;
}

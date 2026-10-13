import { useEffect, useState } from 'react';
import type { Api, ProductionWorkSession } from './api';

export const validStartTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const registrationTimeLabel=(session?:Pick<ProductionWorkSession,'isRegistered'|'plannedStartTime'>)=>session?.isRegistered?(session.plannedStartTime?`Bắt đầu ${session.plannedStartTime}`:'Chưa bổ sung giờ'):'';

export function ProductionRegistration({api,userId,workDate,session,reported,canEdit,onSaved}:{api:Api;userId:string;workDate:string;session?:ProductionWorkSession;reported:boolean;canEdit:boolean;onSaved:()=>Promise<void>}){
  const [time,setTime]=useState(session?.plannedStartTime??'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setTime(session?.plannedStartTime??'');},[session?.plannedStartTime]);
  async function save(isRegistered:boolean){
    if(isRegistered&&!validStartTime(time)){setError('Chọn giờ bắt đầu dự kiến trước khi đăng ký');return;}
    setBusy(true);setError('');
    try{await api.upsertProductionSession({userId,workDate,isRegistered,plannedStartTime:isRegistered?time:null});await onSaved();}
    catch(err){setError(err instanceof Error?err.message:'Chưa lưu được lịch, hãy thử lại.');}
    finally{setBusy(false);}
  }
  return <section className="productionRegistrationTime">
    <div><small>TRẠNG THÁI NGÀY</small><b>{reported?'ĐÃ BÁO CÔNG':session?.isRegistered?'ĐÃ ĐĂNG KÝ':'CHƯA ĐĂNG KÝ'}</b></div>
    {canEdit?<form onSubmit={event=>{event.preventDefault();void save(true);}}>
      <label>Giờ bắt đầu dự kiến<input aria-label="Giờ bắt đầu dự kiến" type="time" step="60" required value={time} disabled={busy} onChange={event=>{setTime(event.target.value);setError('');}}/></label>
      <div className="productionRegistrationActions"><button className="primary" disabled={busy||!validStartTime(time)}>{busy?'Đang lưu…':session?.isRegistered?'Lưu giờ bắt đầu':'Đăng ký làm'}</button>{session?.isRegistered&&<button type="button" disabled={busy} onClick={()=>void save(false)}>Bỏ đăng ký</button>}</div>
    </form>:<b>{registrationTimeLabel(session)}</b>}
    <small>Giờ Việt Nam · dự kiến đến làm, không dùng để tính công.</small>
    {session?.registrationTimeMissing&&<p className="registrationPaymentWarning" role="alert">⚠ Chưa đăng ký giờ · Chưa tính công. Bổ sung giờ bắt đầu để xét kết công; Tổng H đã nhập vẫn được giữ.</p>}
    {session?.isRegistered&&!session.plannedStartTime&&<small>Chưa bổ sung giờ</small>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}

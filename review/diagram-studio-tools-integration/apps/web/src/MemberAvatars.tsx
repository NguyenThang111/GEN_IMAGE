import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Api, User } from './api';

const AvatarContext=createContext<Record<string,string>>({});
const MemberPeopleContext=createContext<User[]>([]);
export function MemberAvatarProvider({api,people,children}:{api:Api;people:User[];children:ReactNode}){
  const [loaded,setLoaded]=useState<User[]>([]);
  useEffect(()=>{let active=true;void api.users().then(users=>{if(active)setLoaded(users);}).catch(()=>{});return()=>{active=false;};},[api]);
  const images=useMemo(()=>Object.fromEntries((people.length?people:loaded).filter(p=>p.avatarDataUrl).map(p=>[p.id,p.avatarDataUrl!])),[people,loaded]);
  return <MemberPeopleContext.Provider value={people.length?people:loaded}><AvatarContext.Provider value={images}>{children}</AvatarContext.Provider></MemberPeopleContext.Provider>;
}
export function AvatarContent({userId,name}:{userId:string|null|undefined;name:string}){
  const images=useContext(AvatarContext);const src=userId?images[userId]:undefined;
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
  return src&&!failed?<img className="memberAvatarImage" src={src} alt={name} onError={()=>setFailed(true)}/>:<>{name.slice(0,1).toUpperCase()}</>;
}

export function MemberAvatarManager({api,people,onUpdated,onClose}:{api:Api;people:User[];onUpdated:()=>Promise<void>;onClose:()=>void}){
  const sharedPeople=useContext(MemberPeopleContext);const members=people.length?people:sharedPeople;
  const [busy,setBusy]=useState<string|null>(null);const [error,setError]=useState('');const [saved,setSaved]=useState('');
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[busy,onClose]);
  async function upload(person:User,file:File){
    setError('');setSaved('');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024){setError('Chọn ảnh JPG, PNG hoặc WebP tối đa 3 MB');return;}
    setBusy(person.id);
    try{await api.uploadUserAvatar(person.id,file);await onUpdated();setSaved(`Đã cập nhật ảnh ${person.displayName}`);}
    catch(err){setError(err instanceof Error?err.message:'Không upload được ảnh');}finally{setBusy(null);}
  }
  return <div className="modalBackdrop"><section className="memberAvatarManager" role="dialog" aria-modal="true" aria-labelledby="member-avatar-title">
    <header><div><h2 id="member-avatar-title">Ảnh thành viên</h2><p>Chỉ Admin được thay ảnh · JPG, PNG, WebP · tối đa 3 MB.</p></div><button type="button" aria-label="Đóng ảnh thành viên" disabled={Boolean(busy)} onClick={onClose}>×</button></header>
    {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{saved}</p>}
    <div className="memberAvatarList">{members.map(person=><article key={person.id}><span className="avatar"><AvatarContent userId={person.id} name={person.displayName}/></span><b>{person.displayName}</b><label>{busy===person.id?'Đang tải…':person.avatarDataUrl?'Đổi ảnh':'Upload ảnh'}<input aria-label={`Upload ảnh ${person.displayName}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void upload(person,file);}}/></label></article>)}</div>
  </section></div>;
}

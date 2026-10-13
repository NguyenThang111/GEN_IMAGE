import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Api, ApiError, PcbLayout, PcbLayoutProduct, User } from './api';

const PRODUCTS:{id:PcbLayoutProduct;label:string}[]=[{id:'KEYSCAN',label:'KeyScan'},{id:'EASYSCAN',label:'EasyScan'},{id:'SCANBOX',label:'ScanBox'}];
const MESSAGE_SOURCE='auto2tech-pcb-layout';

export function PcbLayoutView({api,currentUser}:{api:Api;currentUser:User}){
  const [active,setActive]=useState<PcbLayoutProduct>('KEYSCAN');
  const [layouts,setLayouts]=useState<PcbLayout[]>([]);
  const [html,setHtml]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const iframe=useRef<HTMLIFrameElement>(null);
  const current=useMemo(()=>layouts.find(item=>item.product===active),[layouts,active]);
  const load=useCallback(async()=>{try{setLayouts(await api.pcbLayouts());setError('')}catch(err){setError(err instanceof Error?err.message:'Không tải được PCB Layout')}finally{setLoading(false)}},[api]);
  useEffect(()=>{void load();const socket=api.connectPcbLayouts(()=>void load());return()=>{socket.disconnect()}},[api,load]);
  useEffect(()=>{setHtml('');if(!current)return;void api.pcbLayoutHtml(active).then(setHtml).catch(err=>setError(err instanceof Error?err.message:'Không tải được file'))},[api,active,current?.id,current?.fileName,current?.byteSize]);
  const sendProgress=useCallback(()=>{if(current&&iframe.current?.contentWindow)iframe.current.contentWindow.postMessage({source:MESSAGE_SOURCE,type:'progress-state',product:active,progress:current.progress},'*')},[active,current]);
  useEffect(()=>{sendProgress()},[sendProgress]);
  useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.source!==iframe.current?.contentWindow)return;const data=event.data as {source?:string;type?:string;product?:PcbLayoutProduct;checkbox?:'Sourced'|'Placed';refs?:string};if(data.source!==MESSAGE_SOURCE||data.product!==active)return;if(data.type==='ready')sendProgress();if(data.type==='progress-change'&&(data.checkbox==='Sourced'||data.checkbox==='Placed')&&typeof data.refs==='string')void api.updatePcbLayoutProgress(active,{checkbox:data.checkbox,refs:data.refs}).then(saved=>setLayouts(items=>items.map(item=>item.product===active?saved:item))).catch(err=>setError(err instanceof Error?err.message:'Không lưu được tiến độ'))};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[active,api,sendProgress]);
  async function upload(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;setBusy(true);try{const saved=await api.uploadPcbLayout(active,file);setLayouts(items=>[...items.filter(item=>item.product!==active),saved]);setError('')}catch(err){setError(err instanceof ApiError?err.message:'Không tải được file')}finally{setBusy(false)}}
  return <section className="pcbLayoutPage">
    <header className="pcbLayoutHeader"><div><span>KỸ THUẬT</span><h1>PCB Layout</h1><p>Interactive BOM dùng chung; trạng thái Sourced và Placed được đồng bộ cho toàn team.</p></div>{currentUser.role==='ADMIN'&&<label className="pcbLayoutUpload">{busy?'Đang tải…':current?'Thay file HTML':'Tải file HTML'}<input type="file" accept=".html,text/html" disabled={busy} onChange={upload}/></label>}</header>
    <nav className="pcbLayoutTabs" aria-label="Chọn thiết bị">{PRODUCTS.map(product=><button key={product.id} className={`${active===product.id?'active ':''}${product.id.toLowerCase()}`} onClick={()=>setActive(product.id)}><b>{product.label}</b><small>{layouts.some(item=>item.product===product.id)?'Đã có layout':'Chưa có file'}</small></button>)}</nav>
    {error&&<div className="pcbLayoutError">{error}<button onClick={()=>setError('')}>×</button></div>}
    <div className="pcbLayoutViewer">{loading?<p>Đang tải…</p>:!current?<div className="pcbLayoutEmpty"><b>Chưa có layout {PRODUCTS.find(item=>item.id===active)?.label}</b><p>{currentUser.role==='ADMIN'?'Tải lên file Interactive BOM HTML để chia sẻ cho team.':'Admin chưa tải file layout cho mục này.'}</p></div>:html?<iframe ref={iframe} title={`PCB Layout ${active}`} srcDoc={html} sandbox="allow-scripts allow-downloads" onLoad={sendProgress}/>:<p>Đang mở {current.fileName}…</p>}</div>
  </section>;
}

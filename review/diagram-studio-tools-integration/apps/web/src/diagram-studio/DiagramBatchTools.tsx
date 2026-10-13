import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { strToU8, zipSync } from 'fflate';
import type { ElectricalDiagram } from './contract';
import { validateDiagramInput } from './validate-diagram';
import { buildDiagramQualityReport, type QualityReport } from './diagram-quality';
import { deterministicDiagramJson } from './deterministic-json';
import { DiagramPreview } from './DiagramPreview';
import { diagramPngBlob, diagramPngSize, downloadDiagramBlob, serializeDiagramSvg } from './export-diagram-image';
import './diagram-tools.css';
type Row = { name:string; diagram:ElectricalDiagram|null; report:QualityReport|null; error?:string };
export function DiagramBatchTools() {
 const input=useRef<HTMLInputElement>(null);const [rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(files:File[]) {
  if(busy||!files.length)return;
  if(files.length>40 || files.reduce((s,f)=>s+f.size,0)>60*1024*1024){setMessage('Mỗi lượt tối đa 40 JSON và tổng 60 MB.');return;}
  setBusy(true);setMessage('');
  try {const result:Row[]=[];for(const file of files){try{if(file.size>5*1024*1024)throw new Error('JSON tối đa 5 MB');const parsed=validateDiagramInput(JSON.parse(await file.text()));if(!parsed.diagram)throw new Error(parsed.errors.join('; '));result.push({name:file.name,diagram:parsed.diagram,report:buildDiagramQualityReport(parsed.diagram)});}catch(e){result.push({name:file.name,diagram:null,report:null,error:e instanceof Error?e.message:'Không đọc được JSON'});}}setRows(result);}finally{setBusy(false);}
 }
 async function exportAll() {
  if(busy||!rows.length)return;
  if(rows.some(r=>!r.diagram||!r.report?.canExport)){setMessage('Sửa lỗi ở các file FAIL trước khi xuất bộ. Các file lỗi vẫn giữ trong danh sách.');return;}
  setBusy(true);setMessage('Đang dựng ảnh…');let root:ReturnType<typeof createRoot>|undefined,host:HTMLDivElement|undefined;
  try{
   await document.fonts.ready;const files:Record<string,Uint8Array>={};
   host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-50000px',top:'0',width:'1400px',visibility:'hidden'});document.body.append(host);root=createRoot(host);
   for(let i=0;i<rows.length;i++){
    const row=rows[i],d=row.diagram!;const base=String(i+1).padStart(2,'0')+'-'+d.id.replace(/[^a-z0-9-]/gi,'-').slice(0,100);setMessage('Đang dựng '+(i+1)+'/'+rows.length+': '+row.name);
    flushSync(()=>root!.render(<DiagramPreview diagram={d}/>));const svg=host.querySelector('svg');if(!svg)throw new Error('Không dựng được '+row.name);
    const serialized=serializeDiagramSvg(svg,d.canvas);files[base+'/diagram.json']=strToU8(deterministicDiagramJson(d));files[base+'/preview.svg']=strToU8(serialized);files[base+'/preview.png']=new Uint8Array(await(await diagramPngBlob(serialized,diagramPngSize(d.canvas))).arrayBuffer());files[base+'/review-report.json']=strToU8(JSON.stringify(row.report,null,2));
   }
   files['manifest.json']=strToU8(JSON.stringify({version:1,circuits:rows.map((r,i)=>({number:i+1,sourceJson:r.name,id:r.diagram!.id,status:r.report!.status})),sourceImagesIncluded:false},null,2));
   files['README.txt']=strToU8('JSON/PNG/SVG được dựng trên web, không gọi AI. Ảnh gốc không nằm trong lượt nạp JSON này. Mở công cụ đối chiếu từng ảnh để xác nhận nguồn, số chân và mạng điện. NEEDS_REVIEW không phải xác nhận đúng điện.');
   downloadDiagramBlob(new Blob([new Uint8Array(zipSync(files,{level:6})).buffer],{type:'application/zip'}),'diagram-batch-json-preview.zip');setMessage('Đã xuất '+rows.length+' JSON, PNG, SVG và báo cáo.');
  }catch(e){setMessage(e instanceof Error?e.message:'Không xuất được bộ.');}finally{root?.unmount();host?.remove();setBusy(false);}
 }
 return <section className="diagramToolPanel" aria-label="Kiểm tra và xuất nhiều JSON"><h2>Nạp nhiều JSON → kiểm tra → xuất ảnh</h2><p>Dùng cho các bộ AirBlade, SH Mode, Vario hoặc JSON Studio. Không gọi AI; giữ lớp vector và thông tin nguồn.</p><input ref={input} hidden multiple type="file" accept=".json,application/json" onChange={e=>{void load(Array.from(e.target.files??[]));e.target.value='';}}/><div className="kitActions"><button type="button" disabled={busy} onClick={()=>input.current?.click()}>Chọn nhiều JSON</button><button type="button" disabled={busy||!rows.length||rows.some(r=>!r.report?.canExport)} onClick={()=>void exportAll()}>Xuất bộ JSON + PNG + SVG + báo cáo</button></div>{message&&<p role="status">{message}</p>}{rows.length>0&&<div className="diagramBatchRows"><table><thead><tr><th>File</th><th>Kết quả</th><th>Cần kiểm tra</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.name}</td><td>{r.report?.status??'FAIL'}</td><td>{r.error??r.report?.issues.map(x=>x.message).slice(0,4).join('; ')??'Đối chiếu nội dung điện với ảnh gốc.'}</td></tr>)}</tbody></table></div>}</section>;
}

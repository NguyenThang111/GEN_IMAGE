import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElectricalDiagram } from './contract';
import { DiagramPreview } from './DiagramPreview';
import { canvasToSource, decodeKitImage, type PreparedImage } from './kit-image';
import { buildDiagramQualityReport } from './diagram-quality';
import { medianColorSample, type ColorSample } from './color-sampling';
import './diagram-tools.css';
type Sample = ColorSample & { x:number; y:number };
export function DiagramComparisonTools({ diagram, prepared }: { diagram: ElectricalDiagram; prepared: PreparedImage }) {
 const [url,setUrl]=useState(''),[overlay,setOverlay]=useState(true),[opacity,setOpacity]=useState(50),[zoom,setZoom]=useState(100),[sample,setSample]=useState<Sample|null>(null),[error,setError]=useState('');
 const revision=useRef(0);
 const report=useMemo(()=>buildDiagramQualityReport(diagram,prepared.manifest),[diagram,prepared]);
 useEffect(()=>{revision.current++;setSample(null);setError('');const u=URL.createObjectURL(prepared.clean);setUrl(u);return()=>{revision.current++;URL.revokeObjectURL(u);};},[prepared]);
 async function pick(event: React.MouseEvent<HTMLImageElement>) {
  const bounds=event.currentTarget.getBoundingClientRect();const target={x:(event.clientX-bounds.left)/bounds.width*diagram.canvas.width,y:(event.clientY-bounds.top)/bounds.height*diagram.canvas.height};
  const source=canvasToSource(target,prepared.manifest);const token=++revision.current;setError('');
  let image: ImageBitmap|undefined;
  try {
   image=await decodeKitImage(prepared.source);
   const x=Math.min(image.width-1,Math.max(0,Math.floor(source.x))),y=Math.min(image.height-1,Math.max(0,Math.floor(source.y)));
   const left=Math.max(0,x-1),top=Math.max(0,y-1),width=Math.min(image.width-left,3),height=Math.min(image.height-top,3);
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Không đọc được màu ảnh.');
   ctx.drawImage(image,left,top,width,height,0,0,width,height);const color=medianColorSample(ctx.getImageData(0,0,width,height).data);
   if(token===revision.current)setSample({...color,x,y});
  }catch(e){if(token===revision.current)setError(e instanceof Error?e.message:'Không lấy được màu.');}finally{image?.close();}
 }
 return <section className="diagramToolPanel" aria-label="Đối chiếu ảnh và kiểm tra sơ đồ"><h2>Đối chiếu & kiểm tra</h2><div className="diagramToolControls"><label><input type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/>Chồng ảnh</label><label>Độ mờ vector {opacity}%<input type="range" min={0} max={100} value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/></label><label>Phóng to {zoom}%<input type="range" min={50} max={250} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label></div>
 <p>Bấm vào ảnh để lấy màu từ ảnh gốc, dùng trung vị vùng 3×3. Vector hiển thị theo đúng tọa độ crop/xoay.</p>
 <div className="diagramComparisonScroll"><div className={'diagramComparison'+(overlay?' overlaid':'')} style={{width:zoom+'%'}}><figure><figcaption>Ảnh nguồn sau crop/xoay</figcaption><img src={url||undefined} alt="Ảnh nguồn đối chiếu, bấm để lấy mẫu màu" onClick={e=>void pick(e)}/></figure><figure style={overlay?{opacity:opacity/100}:undefined}><figcaption>Vector từ JSON</figcaption><DiagramPreview diagram={diagram}/></figure></div></div>
 {sample&&<div className="diagramSample"><span style={{background:sample.hex}}/><code>{sample.hex} · RGB {sample.rgb.join(', ')} · nguồn ({sample.x}, {sample.y})</code><button type="button" onClick={()=>void navigator.clipboard?.writeText(sample.hex).catch(()=>setError('Không sao chép được; chọn mã màu để copy.'))}>Sao chép màu</button>{sample.warning&&<p role="status">{sample.warning}</p>}</div>}{error&&<p role="alert">{error}</p>}
 <p><b>{report.status}</b> · {report.counts.components} linh kiện · {report.counts.wires} dây · {report.counts.nets} nhóm chân nối</p><p>{report.scope}</p>{report.issues.length>0&&<ul>{report.issues.slice(0,80).map((i,n)=><li key={n}>{i.severity==='error'?'Lỗi':'Cần xem'}: {i.message}</li>)}</ul>}{report.issues.length>80&&<p>Còn {report.issues.length-80} mục trong báo cáo ZIP.</p>}
 </section>;
}

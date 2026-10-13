import type { ElectricalDiagram } from './contract';
import { validateDiagram, validateDiagramInput } from './validate-diagram';
import { flattenVectorDrawing } from './vector-drawing';
import { textLayoutLabel, splitDiagramText } from './diagram-text';
import type { PreparationManifest } from './kit-image';
export type QualityIssue = { severity: 'error' | 'warning'; code: string; message: string; owner?: string };
export type QualityReport = { version: 1; status: 'FAIL' | 'NEEDS_REVIEW'; canExport: boolean; issues: QualityIssue[]; counts: { components: number; wires: number; nets: number }; scope: string };
export function buildDiagramQualityReport(diagram: ElectricalDiagram, preparation?: PreparationManifest): QualityReport {
 const issues: QualityIssue[]=[];
 const shape=validateDiagramInput(diagram);
 for (const message of shape.errors) issues.push({severity:/^(Trace clearance|Non-orthogonal)/.test(message)?'warning':'error',code:'schema',message});
 if (!shape.diagram) return {version:1,status:'FAIL',canExport:false,issues,counts:{components:0,wires:0,nets:0},scope:'Kiểm tra cấu trúc; chưa xác minh nội dung điện theo ảnh gốc.'};
 const w=diagram.canvas.width,h=diagram.canvas.height;
 const outside=(x:number,y:number)=>x<0 || y<0 || x>w || y>h;
 for (const c of diagram.components) {
  const kind=c.textLayout?.kind ?? c.symbolType ?? c.type;
  if (['load-list','note-box','loadGroup','annotationBox'].includes(kind)) {
   if(!c.label.trim() || !c.textLayout?.texts.some(e=>e.text.trim())) issues.push({severity:'error',code:'missing-component-text',owner:c.id,message:c.id+': cụm tải/khung ghi chú thiếu chữ hoặc vị trí chữ'});
   else if(c.label!==textLayoutLabel(c.textLayout)) issues.push({severity:'error',code:'text-label-mismatch',owner:c.id,message:c.id+': label không khớp các dòng chữ hiển thị'});
  }
  for(const t of c.terminals) if(outside(t.x,t.y)) issues.push({severity:'error',code:'terminal-bounds',owner:c.id,message:c.id+'.'+t.id+': chân nằm ngoài canvas'});
 }
 for (const wire of diagram.wires) {
  if (wire.points.some(p=>outside(p.x,p.y))) issues.push({severity:'error',code:'wire-bounds',owner:wire.id,message:wire.id+': đường dây nằm ngoài canvas'});
  const codes=wire.code.split('/').filter(Boolean); const valid=['R','G','Bl','W','Y','Bu','Lb','Br','Gr','O','Lg','P'];
  if (codes.some(c=>!valid.includes(c))) issues.push({severity:'warning',code:'wire-code',owner:wire.id,message:wire.id+': mã màu chưa nhận biết ('+wire.code+')'});
  if (codes.length===2 && !wire.stripeColor) issues.push({severity:'error',code:'stripe-missing',owner:wire.id,message:wire.id+': có mã dây sọc nhưng thiếu stripeColor'});
  if (codes.length===1 && wire.stripeColor) issues.push({severity:'warning',code:'stripe-unlabelled',owner:wire.id,message:wire.id+': có màu sọc nhưng mã dây chỉ có một màu'});
 }
 {
  const elements=diagram.drawing ? flattenVectorDrawing(diagram.drawing) : [
   ...diagram.components.flatMap(c=>[...(c.textLayout?.paths ?? []),...(c.textLayout?.texts ?? [])]),
   ...diagram.wires.flatMap(w=>w.labels ?? []),
   ...(diagram.annotations ?? []).flatMap(a=>a.elements),
  ];
  for(const e of elements) {
   if(e.kind==='text' && splitDiagramText(e).some(line=>outside(line.x,line.y))) issues.push({severity:'error',code:'text-bounds',owner:e.owner,message:'Nhãn nằm ngoài canvas: '+e.text});
   if(e.kind==='path' && e.points.some(p=>outside(...p))) issues.push({severity:'warning',code:'drawing-bounds',owner:e.owner,message:'Nét vector vượt khung: '+(e.owner ?? 'chú thích')});
  }
 }
 if(preparation) {
  if(w!==preparation.canvas.width || h!==preparation.canvas.height) issues.push({severity:'error',code:'source-size',message:'Canvas JSON không khớp ảnh đã chuẩn bị.'});
  const expected=diagram.reviewMetadata?.sourceSha256;
  if(typeof expected==='string' && expected!==preparation.source.sha256) issues.push({severity:'error',code:'source-hash',message:'SHA-256 không khớp ảnh nguồn của JSON. Chọn đúng ảnh gốc.'});
 }
 const discrepancies=diagram.reviewMetadata?.sourceDiscrepancies;
 if(Array.isArray(discrepancies) && discrepancies.length) issues.push({severity:'warning',code:'source-discrepancy',message:'Ảnh nguồn có nhãn chưa thống nhất: '+JSON.stringify(discrepancies)});
 // Graph joins ONLY explicit terminal endpoints; coincident crossings are never inferred.
 const parents=new Map<string,string>();
 for(const c of diagram.components) for(const t of c.terminals) { const key=JSON.stringify([c.id,t.id]);parents.set(key,key); }
 const find=(key:string):string=>{let root=key;while(parents.get(root)!==root)root=parents.get(root)!;while(key!==root){const next=parents.get(key)!;parents.set(key,root);key=next;}return root;};
 for(const wire of diagram.wires) {const a=JSON.stringify([wire.from.componentId,wire.from.terminalId]),b=JSON.stringify([wire.to.componentId,wire.to.terminalId]);if(parents.has(a)&&parents.has(b))parents.set(find(a),find(b));}
 const unique=Array.from(new Map(issues.map(i=>[JSON.stringify(i),i])).values());
 const failed=unique.some(i=>i.severity==='error');
 return {version:1,status:failed?'FAIL':'NEEDS_REVIEW',canExport:!failed,issues:unique,counts:{components:diagram.components.length,wires:diagram.wires.length,nets:new Set(Array.from(parents.keys(),find)).size},scope:'Đã kiểm tra cấu trúc, đầu dây, màu sọc, tọa độ và nguồn. Kết quả chưa xác nhận đúng điện; đối chiếu chân và mạng với ảnh gốc.'};
}
export function geometrySignature(diagram: ElectricalDiagram) {
 return JSON.stringify({canvas:diagram.canvas,components:diagram.components,wires:diagram.wires,annotations:diagram.annotations});
}

import { splitDiagramText } from './diagram-text';
import { useMemo } from 'react';
import type { DiagramDrawing } from './contract';
import { flattenVectorDrawing, validateVectorDrawing } from './vector-drawing';
export function VectorDiagramDrawing({ drawing }: { drawing: DiagramDrawing }) {
 const data = useMemo(() => { const errors = validateVectorDrawing(drawing); return { errors, elements: errors.length ? [] : flattenVectorDrawing(drawing) }; },[drawing]);
 if (data.errors.length) return <text x={20} y={35} fill="#b91c1c" fontSize={16}>Lớp vector chưa hợp lệ. Kiểm tra JSON trước khi xuất.</text>;
 return <g data-drawing-version="1" fontFamily={drawing.fontFamily ?? 'Arial, sans-serif'}>{data.elements.map((e,i) => e.kind === 'text' ?
  <text key={i} xmlSpace="preserve" data-owner={e.owner} data-role={e.role} x={e.x} y={e.y} fontSize={e.size} textAnchor={e.anchor ?? 'middle'} fontWeight={e.bold === false ? 400 : 700} fill={e.fill ?? '#343434'} transform={e.rotate ? 'rotate('+e.rotate+' '+e.x+' '+e.y+')' : undefined}>{e.text.includes("\n") ? splitDiagramText(e).map((line,n)=><tspan key={n} x={e.x} y={line.y}>{line.text}</tspan>) : e.text}</text> :
  e.closed ? <polygon key={i} data-owner={e.owner} data-role={e.role} points={e.points.map(p=>p.join(',')).join(' ')} stroke={e.stroke ?? '#555555'} strokeWidth={e.width} fill={e.fill ?? 'none'} strokeLinejoin="round" strokeLinecap={e.cap ?? 'butt'}/> :
  <polyline key={i} data-owner={e.owner} data-role={e.role} points={e.points.map(p=>p.join(',')).join(' ')} stroke={e.stroke ?? '#555555'} strokeWidth={e.width} fill={e.fill ?? 'none'} strokeLinejoin="round" strokeLinecap={e.cap ?? 'butt'}/>)}</g>;
}

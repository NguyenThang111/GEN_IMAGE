import React from 'react';
import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ElectricalDiagram } from './contract';
import { DiagramPreview } from './DiagramPreview';
import { validateDiagramInput } from './validate-diagram';
import { buildDiagramQualityReport } from './diagram-quality';
import { parseManualDiagramJson } from './manual-diagram-json';
import { deterministicDiagramJson } from './deterministic-json';
import { flattenVectorDrawing } from './vector-drawing';
const fixture=():ElectricalDiagram=>({schemaVersion:1,reviewStatus:'draft',id:'text',vehicleId:'bike',vehicleTitle:'Xe',circuitTitle:'Nguồn',canvas:{width:400,height:300},components:[{id:'note',type:'device',symbolType:'annotationBox',label:'GHI CHÚ\n6P / Bl : Đầu nối 6 chân, màu đen',x:10,y:10,width:280,height:90,terminals:[],textLayout:{kind:'note-box',padding:10,paths:[{kind:'path',points:[[10,10],[290,10],[290,100],[10,100]],closed:true}],texts:[{kind:'text',text:'GHI CHÚ',x:150,y:30,anchor:'middle',size:14},{kind:'text',text:'6P / Bl : Đầu nối 6 chân, màu đen',x:20,y:65,anchor:'start',size:12}]}}],wires:[],annotations:[{id:'notice',elements:[{kind:'text',text:'Lưu ý: 20°C · 9–12 Ω\n40°C · 1,0–1,3 kΩ',x:20,y:140,size:12,anchor:'start',lineHeight:20}]}]});
describe('text and note rendering',()=>{
 it('renders a note as source text with title centered and body aligned left',()=>{
  const d=fixture(),html=renderToStaticMarkup(<DiagramPreview diagram={d}/>);
  expect(html).toContain('data-text-kind="note-box"');expect(html).not.toContain('diagramUnitLabel');
  expect(html).toContain('x="150" y="30" font-size="14" text-anchor="middle"');
  expect(html).toContain('x="20" y="65" font-size="12" text-anchor="start"');
  expect(html).toContain('Đầu nối 6 chân, màu đen');
 });
 it('does not invent a caption when the source has an explicitly empty layout',()=>{
  const d=fixture();d.components[0]={...d.components[0],symbolType:undefined,label:'Nhánh nguồn nội bộ',textLayout:{kind:'component',texts:[],paths:[]}};
  expect(renderToStaticMarkup(<DiagramPreview diagram={d}/>)).not.toContain('Nhánh nguồn nội bộ');
 });
 it('preserves multiline notes, diacritics, units, whitespace and explicit spacing in SVG',()=>{
  const html=renderToStaticMarkup(<DiagramPreview diagram={fixture()}/>);
  expect(html).toContain('xml:space="preserve"');
  expect(html).toContain('<tspan x="20" y="140">Lưu ý: 20°C · 9–12 Ω</tspan>');
  expect(html).toContain('<tspan x="20" y="160">40°C · 1,0–1,3 kΩ</tspan>');
 });
 it('round-trips all layout and annotation fields through validated JSON export',()=>{
  const d=fixture();const parsed=validateDiagramInput(JSON.parse(deterministicDiagramJson(d)));
  expect(parsed.errors).toEqual([]);expect(parsed.diagram).toEqual(d);
 });
 it('blocks an empty note or labels that disagree with their displayed lines',()=>{
  const d=fixture();d.components[0].label='';expect(buildDiagramQualityReport(d).issues.map(i=>i.code)).toContain('missing-component-text');
  d.components[0].label='Wrong';expect(buildDiagramQualityReport(d).issues.map(i=>i.code)).toContain('text-label-mismatch');
 });
 it('rejects malformed annotation and text layout primitives before rendering',()=>{
  const d=fixture() as any;d.annotations[0].elements=[{kind:'image',href:'https://example.com'}];expect(validateDiagramInput(d).diagram).toBeNull();
  delete d.annotations;d.components[0].textLayout.texts[0].lineHeight=-1;expect(validateDiagramInput(d).diagram).toBeNull();
 });
 it('checks the last baseline of a multiline annotation without global drawing',()=>{
  const d=fixture();(d.annotations![0].elements[0] as any).lineHeight=200;
  expect(buildDiagramQualityReport(d).issues.map(i=>i.code)).toContain('text-bounds');
 });
 it('blocks annotation edits when the detailed drawing still shows the old text',()=>{
  const original=fixture();original.drawing={version:1,elements:structuredClone(original.annotations![0].elements)};
  const changed=structuredClone(original);(changed.annotations![0].elements[0] as any).text='Đã sửa ghi chú';
  expect(parseManualDiagramJson(JSON.stringify(changed),original).diagram).toBeNull();
  (changed.drawing!.elements[0] as any).text='Đã sửa ghi chú';
  expect(parseManualDiagramJson(JSON.stringify(changed),original).diagram).not.toBeNull();
 });
 it('scales multiline spacing with symbol transforms',()=>{
  const flat=flattenVectorDrawing({version:1,symbols:{a:[{kind:'text',text:'A\nB',x:0,y:0,size:12,lineHeight:20}]},elements:[{kind:'use',symbol:'a',matrix:[2,0,0,2,10,10]}]});
  expect(flat[0]).toMatchObject({kind:'text',size:24,lineHeight:40});
 });
});

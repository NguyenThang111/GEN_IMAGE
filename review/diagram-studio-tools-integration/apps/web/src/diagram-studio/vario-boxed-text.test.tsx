import React from 'react';
import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiagramComponentSymbol,DiagramPreview } from './DiagramPreview';
import { resolveComponentTextLayout,sourceLabelLines } from './diagram-text';
import type { DiagramComponent } from './contract';
const note=():DiagramComponent=>({id:'legacy-note',type:'device',label:'GHI CHÚ 16P / Gr : Đầu nối 16 chân, màu xám 8P / Bl : Đầu nối 8 chân, màu đen 6P / Bl : Đầu nối 6 chân, màu đen 3P / Bl : Đầu nối 3 chân, màu đen 2P / Bl : Đầu nối 2 chân, màu đen',x:26,y:35,width:230,height:140,terminals:[]});
describe('Vario legacy boxed text',()=>{
 it('recovers each connector note as a separate row inside its own frame',()=>{
  const c=note(),layout=resolveComponentTextLayout(c)!;
  expect(sourceLabelLines(c.label)).toHaveLength(6);expect(layout.kind).toBe('note-box');
  expect(layout.texts[0]).toMatchObject({text:'GHI CHÚ',anchor:'middle'});
  expect(layout.texts.slice(1).map(t=>t.text)).toEqual(['16P / Gr : Đầu nối 16 chân, màu xám','8P / Bl : Đầu nối 8 chân, màu đen','6P / Bl : Đầu nối 6 chân, màu đen','3P / Bl : Đầu nối 3 chân, màu đen','2P / Bl : Đầu nối 2 chân, màu đen']);
  for(const t of layout.texts){expect(t.y).toBeGreaterThan(c.y);expect(t.y).toBeLessThan(c.y+c.height);}
  const html=renderToStaticMarkup(<DiagramComponentSymbol component={c}/>);expect(html).not.toContain('diagramObjectLabel');expect(html).not.toContain('diagramUnitLabel');
 });
 it('preserves the inside cluster pin number 3 HIGH BEAM and all source terminal data',()=>{
  const c:DiagramComponent={id:'cluster',type:'device',label:'CỤM ĐỒNG HỒ',x:930,y:74,width:306,height:78,terminals:[{id:'high',x:930,y:112,label:'3 HIGH BEAM'}]};
  const before=structuredClone(c),layout=resolveComponentTextLayout(c)!;const pin=layout.texts.find(t=>t.role==='terminal-label')!;
  expect(pin.text).toBe('3 HIGH BEAM');expect(pin.x).toBeGreaterThan(c.x);expect(pin.x).toBeLessThan(c.x+c.width);expect(pin.y).toBeGreaterThan(c.y);expect(pin.y).toBeLessThan(c.y+c.height);expect(c).toEqual(before);
  expect(renderToStaticMarkup(<DiagramComponentSymbol component={c}/>)).toContain('3 HIGH BEAM');
 });
 it('preserves both sides of ECM pin labels instead of collapsing them below the box',()=>{
  const c:DiagramComponent={id:'ecm',type:'ecm',x:200,y:100,width:150,height:200,label:'A36 THR\nS/RELAY A32',terminals:[{id:'tp',label:'A36 THR',x:200,y:150},{id:'relay',label:'S/RELAY A32',x:350,y:180}]};
  const layout=resolveComponentTextLayout(c)!;expect(layout.texts.map(t=>t.text)).toEqual(['A36 THR','S/RELAY A32']);expect(layout.texts.map(t=>t.anchor)).toEqual(['start','end']);
 });
 it('preserves literal escaped newlines from older saved labels',()=>{
  const c=note();c.label='GHI CHÚ\\n6P / Bl : Đầu nối 6 chân, màu đen';expect(sourceLabelLines(c.label)).toHaveLength(2);
 });
 it('keeps exact prepared text positions and numbers when a layout is already present',()=>{
  const c:DiagramComponent={id:'ecm',type:'ecm',label:'A36 THR',x:200,y:100,width:150,height:200,terminals:[{id:'tp',label:'A36 THR',x:200,y:150}],textLayout:{kind:'component',texts:[{kind:'text',text:'A36 THR',x:208,y:154,size:10,anchor:'start'}],paths:[]}};
  expect(resolveComponentTextLayout(c)).toBe(c.textLayout);
 });
});

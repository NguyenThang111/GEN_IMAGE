import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ElectricalDiagram, DiagramDrawing } from './contract';
import { validateDiagramInput } from './validate-diagram';
import { deterministicDiagramJson } from './deterministic-json';
import { DiagramPreview } from './DiagramPreview';
import { flattenVectorDrawing, validateVectorDrawing } from './vector-drawing';
import { buildDiagramQualityReport } from './diagram-quality';
import { parseManualDiagramJson } from './manual-diagram-json';
import { medianColorSample } from './color-sampling';
import { preparationGeometry, sourceToCanvas, canvasToSource, type QuarterTurn } from './kit-image';
const fixture = (): ElectricalDiagram => ({
 schemaVersion:1,reviewStatus:'draft',id:'bike-horn',vehicleId:'bike',vehicleTitle:'Xe',circuitTitle:'Còi',
 canvas:{width:300,height:200,background:'#ffffff'},
 components:[{id:'a',type:'device',label:'A',x:10,y:10,width:30,height:30,terminals:[{id:'1',x:30,y:30,pin:'A27'}]},{id:'b',type:'device',label:'B',x:180,y:10,width:30,height:30,terminals:[{id:'1',x:200,y:30}]}],
 wires:[{id:'wire',code:'R/W',primaryColor:'#cc0000',stripeColor:'#ffffff',from:{componentId:'a',terminalId:'1'},to:{componentId:'b',terminalId:'1'},points:[{x:30,y:30},{x:200,y:30}],strokeWidth:3,labels:[{kind:'text',text:'R/W',x:100,y:25}]}],
 sourceCrop:{x:10,y:20,width:300,height:200},sourceTransform:{rotateClockwise:0},
 reviewMetadata:{sourceSha256:'a'.repeat(64),sourceDiscrepancies:['TP A27 / A36']},colorReference:{R:'#cc0000'},
 drawing:{version:1,symbols:{horn:[{kind:'path',points:[[0,0],[10,0]],stroke:'#cc0000',width:2},{kind:'text',text:'CÒI & <pin>',x:0,y:10,size:12}]},elements:[{kind:'use',symbol:'horn',matrix:[2,0,0,2,30,30],owner:'a'}]}
});
describe('image and detailed JSON tools',()=>{
 it('round-trips vector data, source binding, pin metadata, wire labels and unknown extensions',()=>{
  const d=fixture();d.custom={note:'keep'};
  expect(JSON.parse(deterministicDiagramJson(d))).toEqual(d);
  expect(validateDiagramInput(JSON.parse(deterministicDiagramJson(d))).diagram).not.toBeNull();
 });
 it('renders original detailed vector colors, transforms and escaped labels',()=>{
  const d=fixture(), flat=flattenVectorDrawing(d.drawing!);
  expect(flat[0]).toMatchObject({points:[[30,30],[50,30]],width:4,owner:'a'});
  expect(flat[1]).toMatchObject({x:30,y:50,size:24,owner:'a'});
  const html=renderToStaticMarkup(<DiagramPreview diagram={d}/>);
  expect(html).toContain('data-drawing-version="1"');expect(html).toContain('stroke="#cc0000"');expect(html).toContain('CÒI &amp; &lt;pin&gt;');expect(html).not.toContain('<image');
 });
 it('rejects cyclic symbols and unsupported executable or external vector primitives',()=>{
  const cycle:DiagramDrawing={version:1,symbols:{a:[{kind:'use',symbol:'a',matrix:[1,0,0,1,0,0]}]},elements:[{kind:'use',symbol:'a',matrix:[1,0,0,1,0,0]}]};
  expect(validateVectorDrawing(cycle).join(' ')).toContain('cyclic');
  expect(validateVectorDrawing({version:1,elements:[{kind:'image',href:'https://example.com'}]})).not.toEqual([]);
  expect(validateVectorDrawing({version:1,elements:[{kind:'path',points:[[0,0],[1,1]],stroke:'url(https://example.com)'}]})).not.toEqual([]);
 });
 it.each([0,90,180,270] as QuarterTurn[])('maps corners and an interior point back to the source after rotation %i',rotation=>{
  const crop={x:17,y:23,width:801,height:603};
  const manifest={crop,rotation,...preparationGeometry(1000,800,{crop,rotation,maxEdge:400,brightness:100,contrast:100})};
  const mapped=[{x:17,y:23},{x:818,y:23},{x:17,y:626},{x:818,y:626},{x:141.25,y:213.75}].map(p=>{const q=sourceToCanvas(p,manifest),back=canvasToSource(q,manifest);expect(back.x).toBeCloseTo(p.x,10);expect(back.y).toBeCloseTo(p.y,10);return q;});
  expect(Math.min(...mapped.map(p=>p.x))).toBe(0);expect(Math.max(...mapped.map(p=>p.x))).toBe(manifest.canvas.width);
  expect(Math.min(...mapped.map(p=>p.y))).toBe(0);expect(Math.max(...mapped.map(p=>p.y))).toBe(manifest.canvas.height);
 });
 it('flags missing stripes, source mismatch and out-of-frame wires before export',()=>{
  const d=fixture();delete d.wires[0].stripeColor;d.wires[0].points[1].x=301;
  const p={source:{sha256:'b'.repeat(64)},canvas:{width:301,height:200}} as any;
  const report=buildDiagramQualityReport(d,p);expect(report.canExport).toBe(false);
  expect(report.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['stripe-missing','wire-bounds','source-hash','source-size']));
 });
 it('keeps unresolved source evidence visible even if structure is valid',()=>{
  const report=buildDiagramQualityReport(fixture());expect(report.canExport).toBe(true);expect(report.status).toBe('NEEDS_REVIEW');
  expect(report.issues.some(i=>i.code==='source-discrepancy')).toBe(true);
 });
 it('does not connect electrical networks at geometric crossings',()=>{
  const d=fixture();delete d.drawing;
  d.components.push(...[{id:'c',x:100,y:10},{id:'d',x:100,y:80}].map(c=>({...c,type:'device' as const,label:c.id,width:10,height:10,terminals:[{id:'1',x:c.x,y:c.y}]})));
  d.wires.push({id:'crossing',code:'G',primaryColor:'#008800',from:{componentId:'c',terminalId:'1'},to:{componentId:'d',terminalId:'1'},points:[{x:100,y:10},{x:100,y:80}]});
  expect(buildDiagramQualityReport(d).counts.nets).toBe(2);
 });
 it('blocks stale vector previews and coordinate rebinding during manual edits',()=>{
  const original=fixture(),changed=structuredClone(original);changed.components[0].label='Changed';
  expect(parseManualDiagramJson(JSON.stringify(changed),original).diagram).toBeNull();
  changed.drawing!.elements.push({kind:'text',text:'Changed',x:30,y:40});
  expect(parseManualDiagramJson(JSON.stringify(changed),original).diagram).not.toBeNull();
  changed.sourceTransform={rotateClockwise:90};expect(parseManualDiagramJson(JSON.stringify(changed),original).diagram).toBeNull();
 });
 it.each([{sourceCrop:{x:-1,y:0,width:100,height:100}},{sourceCrop:null},{sourceTransform:{rotateClockwise:'90'}},{reviewMetadata:[]}])('rejects invalid source metadata %j',patch=>{
  expect(validateDiagramInput({...fixture(),...patch}).diagram).toBeNull();
 });
 it('reports ambiguous edge colors and rejects transparent samples',()=>{
  const sample=medianColorSample(new Uint8ClampedArray([10,170,65,255,10,170,65,255,255,255,255,255]));
  expect(sample.hex).toBe('#0aaa41');expect(sample.warning).not.toBeNull();
  expect(medianColorSample(new Uint8ClampedArray([10,170,65,255])).warning).toBeNull();
  expect(()=>medianColorSample(new Uint8ClampedArray([10,170,65,0]))).toThrow();
 });
});

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {DiagramPreview as Legacy} from './__smartkey_legacy/DiagramPreview';
import {DiagramPreview as Current} from './src/diagram-studio/DiagramPreview';
import {validateDiagramInput as validateLegacy} from './__smartkey_legacy/validate-diagram';
import {validateDiagramInput as validateCurrent} from './src/diagram-studio/validate-diagram';
const sharp=require('sharp');
(async()=>{
const out=process.argv[2];
const before=JSON.parse(fs.readFileSync(path.join(out,'before.schema.json'),'utf8'));
const after=JSON.parse(fs.readFileSync(path.join(out,'11. smartkey-system.schema.json'),'utf8'));
const report:any={};
for(const [name,validate] of [['legacy',validateLegacy],['current',validateCurrent]] as const){
 const a=validate(before),b=validate(after);
 assert.ok(b.diagram);
 assert.deepEqual(b.errors,a.errors);
 report[name]={importAccepted:!!b.diagram,warnings:b.errors};
}
const css=`.diagramBackground{fill:#fff}.diagramComponent{fill:#f3edc4;stroke:#69736d;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.diagramComponent path{fill:none}.diagramComponent text{stroke:none}.diagramUnitLabel{fill:#202622;font:800 15px Arial;text-anchor:middle}.diagramObjectLabel{fill:#202622;font:800 12px Arial;text-anchor:middle}.diagramTerminal{fill:#fff;stroke:#69736d;stroke-width:1.6}.diagramJunction{fill:#69736d}.diagramPositive{fill:#f03922}.diagramWires polyline{fill:none;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.diagramWireStripe{stroke-width:2;stroke-dasharray:10 9}.diagramWireCode{fill:#4e6156;stroke:#fff;stroke-width:4;paint-order:stroke;font:800 11px Arial}.diagramTextObject{stroke:none}`;
for(const [name,diagram,View] of [['legacy-before',before,Legacy],['legacy-after',after,Legacy],['current-after',after,Current]] as const){
 const markup=renderToStaticMarkup(<View diagram={diagram}/>);
 let svg=markup.slice(markup.indexOf('<svg'),markup.lastIndexOf('</svg>')+6);
 svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1299" ');
 svg=svg.replace(/(<svg[^>]*>)/,'$1<style>'+css+'</style>');
 fs.writeFileSync(path.join(out,name+'.svg'),svg);
 await sharp(Buffer.from(svg),{density:144}).png().toFile(path.join(out,name+'.png'));
 if(name==='legacy-after'){
  assert.ok(!svg.includes('4 SOL+\n5 SOL-'));
  const texts=[...svg.matchAll(/<text([^>]*)>(.*?)<\/text>/gs)].map(m=>({attrs:m[1],text:m[2]}));
  for(const terminal of before.components.find((c:any)=>c.id==='scu').terminals){
   assert.ok(texts.some(t=>t.text===terminal.label),terminal.label);
  }
  report.visibleScuPins=17;
  report.visibleEcmPins=['A34','A6','A35'];
  for(const pin of report.visibleEcmPins)assert.ok(texts.some(t=>t.text===pin));
  for(let pin=1;pin<=21;pin++)assert.ok(texts.some(t=>t.text===String(pin)));
  report.visiblePinoutNumbers=21;
 }
}
fs.writeFileSync(path.join(out,'web-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});

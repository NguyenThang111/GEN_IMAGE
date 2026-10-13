import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validateDiagramInput } from './src/diagram-studio/validate-diagram';
import { deterministicDiagramJson } from './src/diagram-studio/deterministic-json';
import { buildDiagramQualityReport } from './src/diagram-studio/diagram-quality';
import { flattenVectorDrawing } from './src/diagram-studio/vector-drawing';
import { DiagramPreview } from './src/diagram-studio/DiagramPreview';
const root="C:/Users/thang/OneDrive/Documents/PlatformIO/Projects/test",out="C:\\Users\\thang\\OneDrive\\Documents\\PlatformIO\\Projects\\test\\review\\text-repair-2026-10-08";
const report=JSON.parse(readFileSync(join(out,'text-audit.json'),'utf8')),checks=[];
const escaped=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
function render(d:any){const markup=renderToStaticMarkup(<DiagramPreview diagram={d}/>);return markup.slice(markup.indexOf('<svg')).replace('</svg></div>','</svg>').replace('<svg','<svg xmlns="http://www.w3.org/2000/svg" width="'+d.canvas.width+'" height="'+d.canvas.height+'"');}
for(const item of report.files){
 const d=JSON.parse(readFileSync(item.readyFile,'utf8')),original=JSON.parse(readFileSync(join(out,'original-json',item.vehicle,item.name),'utf8'));
 const validation=validateDiagramInput(d),quality=buildDiagramQualityReport(d);
 if(!validation.diagram||!quality.canExport)throw Error(item.file+': '+JSON.stringify({validation,quality}));
 if(!isDeepStrictEqual(JSON.parse(deterministicDiagramJson(validation.diagram)),d))throw Error('Lost metadata '+item.file);
 const terminals=(x:any)=>x.components.map((c:any)=>({id:c.id,type:c.type,x:c.x,y:c.y,width:c.width,height:c.height,terminals:c.terminals}));
 if(!isDeepStrictEqual(terminals(original),terminals(d)))throw Error('Changed component geometry '+item.file);
 const wires=(x:any)=>x.wires.map(({labels,...w}:any)=>w);
 if(!isDeepStrictEqual(wires(original),wires(d)))throw Error('Changed electrical wire '+item.file);
 const texts=flattenVectorDrawing(d.drawing).filter(e=>e.kind==='text');
 const full=render(d),fallback=render({...d,drawing:undefined});
 const fallbackQuality=buildDiagramQualityReport({...d,drawing:undefined});if(!fallbackQuality.canExport)throw Error('Fallback quality '+item.file+': '+JSON.stringify(fallbackQuality));
 const content=(svg:string)=>Array.from(svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g),m=>m[1].replace(/<[^>]+>/g,'')).filter(Boolean).sort();
 if(!isDeepStrictEqual(content(full),content(fallback)))throw Error('Duplicate or different text '+item.file+': '+JSON.stringify({full:content(full),fallback:content(fallback)}));
 for(const e of texts){for(const line of e.text.split(/\r?\n/)){if(!full.includes(escaped(line))||!fallback.includes(escaped(line)))throw Error('Missing text '+item.file+': '+line);}}
 const source=readFileSync(join(root,'FILE ANH',item.vehicle,d.sourceImage));const hash=createHash('sha256').update(source).digest('hex');
 if(d.reviewMetadata?.sourceSha256&&d.reviewMetadata.sourceSha256!==hash)throw Error('Source mismatch '+item.file);
 const stem=item.readyName.replace('.schema.json','');const destination=join(out,'web-render',item.vehicle,stem);mkdirSync(dirname(destination),{recursive:true});
 writeFileSync(destination+'.svg',full);writeFileSync(destination+'.components.svg',fallback);
 checks.push({file:item.file,vehicle:item.vehicle,readyName:item.readyName,sourceImage:d.sourceImage,sourceSha256:hash,textCount:texts.length,fullTextPresent:true,componentTextPresent:true,roundTripPreserved:true,electricalGeometryPreserved:true,toolReport:quality});
}
writeFileSync(join(out,'web-tool-checks.json'),JSON.stringify({status:'PASS_TEXT_RENDERING',electricalApproval:false,checks},null,2));console.log(JSON.stringify({diagrams:checks.length,texts:checks.reduce((s,c)=>s+c.textCount,0),renderPaths:checks.length*2,errors:0}));

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { validateDiagramInput } from 'C:/Users/thang/Desktop/auto2techos/apps/web/src/diagram-studio/validate-diagram';
import { buildDiagramQualityReport } from 'C:/Users/thang/Desktop/auto2techos/apps/web/src/diagram-studio/diagram-quality';
import { deterministicDiagramJson } from 'C:/Users/thang/Desktop/auto2techos/apps/web/src/diagram-studio/deterministic-json';
import { flattenVectorDrawing } from 'C:/Users/thang/Desktop/auto2techos/apps/web/src/diagram-studio/vector-drawing';
import { DiagramPreview } from 'C:/Users/thang/Desktop/auto2techos/apps/web/src/diagram-studio/DiagramPreview';

const root='C:/Users/thang/OneDrive/Documents/PlatformIO/Projects/test';
const out=join(root,'File JSON chuẩn','AIR BLADE 160 2026');
const manifest=JSON.parse(readFileSync(join(out,'manifest.json'),'utf8'));
const checks=[];
const content=(svg:string)=>Array.from(svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g),m=>m[1].replace(/<[^>]+>/g,'')).filter(Boolean).sort();
function render(d:any) {
  const markup=renderToStaticMarkup(<DiagramPreview diagram={d}/>);
  return markup.slice(markup.indexOf('<svg')).replace('</svg></div>','</svg>').replace('<svg','<svg xmlns="http://www.w3.org/2000/svg" width="'+d.canvas.width+'" height="'+d.canvas.height+'"');
}
for(const item of manifest.circuits) {
  const d=JSON.parse(readFileSync(join(out,item.json),'utf8'));
  const validation=validateDiagramInput(d),quality=buildDiagramQualityReport(d);
  if(!validation.diagram || !quality.canExport) throw Error(item.json+': '+JSON.stringify(quality));
  if(!isDeepStrictEqual(JSON.parse(deterministicDiagramJson(validation.diagram)),d))throw Error('Round trip changed '+item.json);
  const source=readFileSync(join(out,item.source));
  if(createHash('sha256').update(source).digest('hex')!==d.reviewMetadata.sourceSha256)throw Error('Wrong source '+item.json);
  const full=render(d),fallback=render({...d,drawing:undefined});
  if(!isDeepStrictEqual(content(full),content(fallback)))throw Error('Lost/duplicated fallback text '+item.json+': '+JSON.stringify({full:content(full),fallback:content(fallback)}));
  const stem=basename(item.json).replace('.schema.json','');
  writeFileSync(join(out,'preview',stem+'.web.svg'),full);
  writeFileSync(join(out,'preview',stem+'.components.svg'),fallback);
  checks.push({file:item.json,texts:flattenVectorDrawing(d.drawing).filter(e=>e.kind==='text').length,schemaValid:true,roundTripPreserved:true,sourceHashMatched:true,bothRenderersPreserveText:true,quality});
}
writeFileSync(join(out,'web-tool-checks.json'),JSON.stringify({status:'PASS_SCHEMA_AND_TEXT_RENDERING',electricalApproval:false,browserUiTested:false,checks},null,2));
console.log(JSON.stringify({diagrams:checks.length,texts:checks.reduce((s,c)=>s+c.texts,0),renderPaths:checks.length*2,errors:0}));

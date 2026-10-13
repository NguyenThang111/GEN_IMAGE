import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { join,dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { validateDiagramInput as legacyValidate } from "C:/Users/thang/OneDrive/Documents/PlatformIO/Projects/test/review/component-repair-2026-10-08/legacy-validator/validate-diagram.ts";
import { validateDiagramInput } from './src/diagram-studio/validate-diagram';
import { buildDiagramQualityReport } from './src/diagram-studio/diagram-quality';
import { deterministicDiagramJson } from './src/diagram-studio/deterministic-json';
import { DiagramPreview } from './src/diagram-studio/DiagramPreview';
const root="C:/Users/thang/OneDrive/Documents/PlatformIO/Projects/test",out="C:\\Users\\thang\\OneDrive\\Documents\\PlatformIO\\Projects\\test\\review\\component-repair-2026-10-08";
const manifest=JSON.parse(readFileSync(join(out,'repair-manifest.json'),'utf8')),checks=[];
for(const item of manifest.files){
 const paths=[join(root,item.file),join(out,item.readyFile)];
 const reports=paths.map(file=>{
  const d=JSON.parse(readFileSync(file,'utf8'));
  const old=legacyValidate(d),current=validateDiagramInput(d),quality=buildDiagramQualityReport(d);
  if(!old.diagram || old.errors.some(e=>!e.startsWith("Non-orthogonal")&&!e.startsWith("Trace clearance")) || !current.diagram || !quality.canExport)throw Error(file+': '+JSON.stringify({old:old.errors,current:current.errors,quality}));
  if(JSON.stringify(JSON.parse(deterministicDiagramJson(d)))!==JSON.stringify(JSON.parse(deterministicDiagramJson(JSON.parse(deterministicDiagramJson(d))))))throw Error('Unstable round-trip');
  const svg=renderToStaticMarkup(<DiagramPreview diagram={d}/>);if(!svg.includes('data-drawing-version="1"'))throw Error('Lost vector');
  const name=join(out,'web-render',item.vehicle,item.readyFile.split('/').at(-1)!.replace('.schema.json','.svg'));
  mkdirSync(dirname(name),{recursive:true});
  writeFileSync(name,svg.slice(svg.indexOf('<svg')).replace('</svg></div>','</svg>').replace('<svg','<svg xmlns="http://www.w3.org/2000/svg" width="'+d.canvas.width+'" height="'+d.canvas.height+'"'));
  return {file,legacyErrors:old.errors,toolReport:quality,roundTripPreserved:isDeepStrictEqual(JSON.parse(deterministicDiagramJson(d)),d)};
 });
 if(item.componentChanges.length){const before=JSON.parse(readFileSync(join(out,"original-json",item.vehicle,item.file.split("/").at(-1)),"utf8"));const after=JSON.parse(readFileSync(paths[0],"utf8"));if(renderToStaticMarkup(<DiagramPreview diagram={before}/>)!==renderToStaticMarkup(<DiagramPreview diagram={after}/>))throw Error("Vector changed during component repair");}
 const source=readFileSync(join(out,item.sourceFile)),hash=createHash('sha256').update(source).digest('hex');
 if(hash!==item.sourceSha256)throw Error('Source hash mismatch');
 checks.push({...item,reports,sourceHashVerified:true});
}
writeFileSync(join(out,'web-tool-checks.json'),JSON.stringify({status:'PASS_COMPONENT_COMPATIBILITY',electricalApproval:false,checks},null,2));
console.log(JSON.stringify({diagrams:checks.length,validatorsRun:checks.length*2,componentErrors:0,sourceHashErrors:0,webVectorRenders:checks.length}));

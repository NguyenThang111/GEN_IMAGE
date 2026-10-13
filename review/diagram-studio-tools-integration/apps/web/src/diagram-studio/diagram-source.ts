import type { ElectricalDiagram } from './contract';
import { decodeKitImage, prepareKitImage, type PreparedImage } from './kit-image';
export async function prepareSourceForDiagram(source: File, diagram: ElectricalDiagram, current?: PreparedImage | null): Promise<PreparedImage> {
 const expected=diagram.reviewMetadata?.sourceSha256;
 if(current && !diagram.sourceCrop && !diagram.sourceTransform && current.source===source && current.manifest.canvas.width===diagram.canvas.width && current.manifest.canvas.height===diagram.canvas.height) {
  if(typeof expected==='string' && expected!==current.manifest.source.sha256) throw new Error('Ảnh nguồn không khớp SHA-256 của JSON.');
  return current;
 }
 const decoded=await decodeKitImage(source);const size={width:decoded.width,height:decoded.height};decoded.close();
 const crop=diagram.sourceCrop ?? {x:0,y:0,...size};
 const prepared=await prepareKitImage(source,{crop,rotation:diagram.sourceTransform?.rotateClockwise ?? current?.manifest.rotation ?? 0,maxEdge:Math.max(64,Math.max(diagram.canvas.width,diagram.canvas.height)),brightness:100,contrast:100});
 if(prepared.manifest.canvas.width!==diagram.canvas.width || prepared.manifest.canvas.height!==diagram.canvas.height) throw new Error('Crop/xoay của JSON không khớp canvas. Không tự kéo giãn sơ đồ.');
 if(typeof expected==='string' && expected!==prepared.manifest.source.sha256) throw new Error('Ảnh nguồn không khớp SHA-256 của JSON.');
 return prepared;
}

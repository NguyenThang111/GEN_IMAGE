export type Crop = { x: number; y: number; width: number; height: number };
export type QuarterTurn = 0 | 90 | 180 | 270;
export type PreparationSettings = { crop: Crop; maxEdge: number; brightness: number; contrast: number; rotation?: QuarterTurn };
export type PreparationManifest = {
  version: 1; source: { name: string; sha256: string; width: number; height: number; coordinates: string };
  crop: Crop; canvas: { width: number; height: number }; scale: { x: number; y: number };
  adjustments: { brightness: number; contrast: number }; cleanSha256: string; rotation?: QuarterTurn;
};
export type PreparedImage = { source: File; clean: File; manifest: PreparationManifest };

export async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export function preparationGeometry(width: number, height: number, settings: PreparationSettings) {
  const { crop, maxEdge, brightness, contrast } = settings;
  if (![0,90,180,270].includes(settings.rotation ?? 0)) throw new Error("Chiều xoay phải là 0, 90, 180 hoặc 270 độ.");
  if (![width, height, crop.x, crop.y, crop.width, crop.height, maxEdge].every(Number.isInteger) ||
      width < 1 || height < 1 || width * height > 24_000_000 || crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1 ||
      crop.x + crop.width > width || crop.y + crop.height > height || maxEdge < 64 || maxEdge > 2400 ||
      !Number.isFinite(brightness) || brightness < 80 || brightness > 120 || !Number.isFinite(contrast) || contrast < 80 || contrast > 120) {
    throw new Error('Vùng crop phải nằm trong ảnh; cạnh xuất 64–2400 px, sáng/tương phản 80–120%.');
  }
  const ratio = Math.min(1, maxEdge / Math.max(crop.width, crop.height));
  const sideways = settings.rotation === 90 || settings.rotation === 270;
  const rw = sideways ? crop.height : crop.width, rh = sideways ? crop.width : crop.height;
  const canvas = { width: Math.max(1, Math.round(rw * ratio)), height: Math.max(1, Math.round(rh * ratio)) };
  return { canvas, scale: { x: canvas.width / rw, y: canvas.height / rh } };
}
export function sourceToCanvas(point: { x: number; y: number }, manifest: Pick<PreparationManifest, 'crop' | 'scale' | 'rotation'>) {
 const c=manifest.crop, x=point.x-c.x, y=point.y-c.y; let q={x,y};
 if (manifest.rotation===90) q={x:c.height-y,y:x};
 if (manifest.rotation===180) q={x:c.width-x,y:c.height-y};
 if (manifest.rotation===270) q={x:y,y:c.width-x};
 return { x:q.x*manifest.scale.x,y:q.y*manifest.scale.y };
}
export function canvasToSource(point: { x: number; y: number }, manifest: Pick<PreparationManifest, 'crop' | 'scale' | 'rotation'>) {
 const c=manifest.crop,x=point.x/manifest.scale.x,y=point.y/manifest.scale.y;let q={x,y};
 if (manifest.rotation===90) q={x:y,y:c.height-x};
 if (manifest.rotation===180) q={x:c.width-x,y:c.height-y};
 if (manifest.rotation===270) q={x:c.width-y,y:x};
 return {x:q.x+c.x,y:q.y+c.y};
}
export function adjustPixels(pixels: Uint8ClampedArray, brightness: number, contrast: number) {
  if (brightness === 100 && contrast === 100) return;
  for (let i = 0; i < pixels.length; i += 4) for (let channel = 0; channel < 3; channel++) {
    pixels[i + channel] = Math.round((pixels[i + channel] * brightness / 100 - 128) * contrast / 100 + 128);
  }
}
export async function decodeKitImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024 || !file.size) throw new Error('Chỉ nhận PNG/JPEG/WebP, tối đa 12 MB.');
  const image = await createImageBitmap(file).catch(() => { throw new Error('File ảnh bị hỏng hoặc không đọc được.'); });
  if (image.width * image.height > 24_000_000 || Math.max(image.width, image.height) > 12000) { image.close(); throw new Error('Ảnh quá lớn: tối đa 24 megapixel và cạnh 12.000 px.'); }
  return image;
}
export async function prepareKitImage(source: File, settings: PreparationSettings): Promise<PreparedImage> {
  const image = await decodeKitImage(source);
  try {
    const geometry = preparationGeometry(image.width, image.height, settings);
    const canvas = document.createElement('canvas'); Object.assign(canvas, geometry.canvas);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas.');
    const c = settings.crop;
    const rotation = settings.rotation ?? 0;
    ctx.save();
    if (rotation===90) ctx.translate(canvas.width,0);
    if (rotation===180) ctx.translate(canvas.width,canvas.height);
    if (rotation===270) ctx.translate(0,canvas.height);
    ctx.rotate(rotation*Math.PI/180);
    const sideways=rotation===90 || rotation===270;
    ctx.drawImage(image,c.x,c.y,c.width,c.height,0,0,sideways ? canvas.height : canvas.width,sideways ? canvas.width : canvas.height);
    ctx.restore();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    adjustPixels(pixels.data, settings.brightness, settings.contrast); ctx.putImageData(pixels, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Không xuất được PNG.')), 'image/png'));
    if (blob.size > 12 * 1024 * 1024) throw new Error('PNG vượt 12 MB; giảm cạnh xuất để tiếp tục.');
    return { source, clean: new File([blob], 'clean.png', { type: 'image/png' }), manifest: {
      version: 1, source: { name: source.name, sha256: await sha256(source), width: image.width, height: image.height, coordinates: 'Browser-decoded pixels, EXIF orientation applied; verify orientation before using external checker.' },
      crop: { ...c }, ...geometry, rotation: settings.rotation ?? 0, adjustments: { brightness: settings.brightness, contrast: settings.contrast }, cleanSha256: await sha256(blob),
    } };
  } finally { image.close(); }
}
export function kitReference(manifest: PreparationManifest) {
  const s = manifest.source, c = manifest.crop;
  return { version: 1, method: 'Transcribe independently from original source; never derive reference from candidate JSON.',
    source: { sha256: s.sha256, width: s.width, height: s.height, crop: [c.x, c.y, c.width, c.height], rotation: manifest.rotation ?? 0 }, canvas: manifest.canvas,
    coverage: { all_text: false, all_nets: false, all_symbols: false, clean_image: false, app_render: false }, texts: [], anchors: [], nets: [],
    unresolved: [{ id: 'reference-not-transcribed', reason: 'Chưa đối chiếu chữ/chân/mạng từ ảnh gốc; kiểm tra EXIF và vùng crop.', sourceBox: null }] };
}

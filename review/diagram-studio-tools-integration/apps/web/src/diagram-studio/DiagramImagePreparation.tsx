import { useEffect, useRef, useState } from 'react';
import { decodeKitImage, prepareKitImage, type PreparedImage, type PreparationSettings, type QuarterTurn } from './kit-image';

export function DiagramImagePreparation({ file, busy, onPrepared }: { file: File; busy: boolean; onPrepared: (result: PreparedImage | null) => void }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [settings, setSettings] = useState<PreparationSettings | null>(null);
  const [originalUrl, setOriginalUrl] = useState(''), [cleanUrl, setCleanUrl] = useState('');
  const [error, setError] = useState(''), [processing, setProcessing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let active = true; const url = URL.createObjectURL(file); setOriginalUrl(url);
    void decodeKitImage(file).then(image => {
      const next = { width: image.width, height: image.height }; image.close();
      if (active) { setSize(next); setSettings({ crop: { x: 0, y: 0, ...next }, maxEdge: 2400, brightness: 100, contrast: 100 }); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => {
    if (!settings) return;
    let active = true, url = ''; onPrepared(null); setCleanUrl(''); setProcessing(true); setError('');
    const timer = window.setTimeout(() => { void prepareKitImage(file, settings).then(result => {
      if (!active) return;
      url = URL.createObjectURL(result.clean); setCleanUrl(url); onPrepared(result); setProcessing(false);
    }).catch(e => { if (active) { setError(e.message); setProcessing(false); } }); }, 250);
    return () => { active = false; window.clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [file, settings, onPrepared]);
  function change(next: PreparationSettings) { onPrepared(null); setSettings(next); }
  function pointer(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)) * size!.width), y: Math.round(Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) * size!.height) };
  }
  return <section className="kitPreparation" aria-label="Chuẩn bị ảnh không dùng AI">
    <h2>1. Chuẩn bị ảnh <small>Không dùng token AI</small></h2>
    <p>Kéo một vùng trên ảnh gốc hoặc nhập tọa độ crop. Giữ đủ chú giải, đầu dây và số chân. Không tự xóa nền hay đoán nét bị mờ.</p>
    {settings && <fieldset disabled={busy} className="kitControls">
      {(['x', 'y', 'width', 'height'] as const).map((key, index) => <label key={key}>{['Trái (px)', 'Trên (px)', 'Rộng (px)', 'Cao (px)'][index]}<input type="number" min={index < 2 ? 0 : 1} value={settings.crop[key]} onChange={e => change({ ...settings, crop: { ...settings.crop, [key]: Number(e.target.value) } })}/></label>)}
      <label>Xoay theo chiều kim đồng hồ<select value={settings.rotation ?? 0} onChange={e => change({ ...settings, rotation: Number(e.target.value) as QuarterTurn })}>{[0,90,180,270].map(r => <option key={r} value={r}>{r}°</option>)}</select></label>
      <label>Cạnh xuất tối đa<input type="number" min="64" max="2400" value={settings.maxEdge} onChange={e => change({ ...settings, maxEdge: Number(e.target.value) })}/></label>
      <label>Độ sáng {settings.brightness}%<input type="range" min="80" max="120" value={settings.brightness} onChange={e => change({ ...settings, brightness: Number(e.target.value) })}/></label>
      <label>Tương phản {settings.contrast}%<input type="range" min="80" max="120" value={settings.contrast} onChange={e => change({ ...settings, contrast: Number(e.target.value) })}/></label>
      <button type="button" onClick={() => change({ crop: { x: 0, y: 0, ...size! }, maxEdge: 2400, brightness: 100, contrast: 100 })}>Khôi phục ảnh gốc</button>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
    <div className="kitImagePair">
      <figure><figcaption>Ảnh gốc · {size && `${size.width} × ${size.height}`} · không ghi đè</figcaption><div className="kitCropImage"><img src={originalUrl || undefined} alt="Ảnh gốc để đối chiếu"/>{size && settings && <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-label="Kéo chọn vùng crop" onPointerDown={e => { if (busy) return; start.current = pointer(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerCancel={() => { start.current = null; }} onPointerUp={e => {
        if (busy || !start.current) return; const end = pointer(e), begin = start.current; start.current = null;
        if (Math.abs(end.x - begin.x) < 2 || Math.abs(end.y - begin.y) < 2) return;
        change({ ...settings, crop: { x: Math.min(begin.x, end.x), y: Math.min(begin.y, end.y), width: Math.abs(end.x - begin.x), height: Math.abs(end.y - begin.y) } });
      }}><rect x={settings.crop.x} y={settings.crop.y} width={settings.crop.width} height={settings.crop.height} fill="none" stroke="#1259aa" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>}</div></figure>
      <figure><figcaption>Ảnh chuẩn bị gửi AI · PNG</figcaption>{cleanUrl ? <a href={cleanUrl} target="_blank" rel="noreferrer" title="Mở ảnh để phóng to"><img src={cleanUrl} alt="Ảnh sau tiền xử lý"/></a> : <p role="status">{processing ? 'Đang tạo preview…' : 'Chưa có preview hợp lệ'}</p>}</figure>
    </div>
    <p className="kitHint">Chỉnh sáng/tương phản có thể mất nét mảnh hoặc màu sọc. Luôn đối chiếu trước khi tạo sơ đồ. Có thể xoay 90°/180°/270°. Tọa độ và SHA-256 được lưu để đối chiếu.</p>
  </section>;
}

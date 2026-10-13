import { parseManualDiagramJson } from "./manual-diagram-json";
import { prepareSourceForDiagram } from "./diagram-source";
import { DiagramBatchTools } from "./DiagramBatchTools";
import { DiagramComparisonTools } from "./DiagramComparisonTools";
import { buildDiagramQualityReport } from "./diagram-quality";
import { useCallback, useEffect, useRef, useState } from 'react';
import { strToU8, zipSync } from 'fflate';
import type { Api } from '../api';
import type { ElectricalDiagram } from './contract';
import { DiagramImagePreparation } from './DiagramImagePreparation';
import { kitReference, sha256, type PreparedImage } from './kit-image';
import { validateDiagram, validateDiagramInput } from './validate-diagram';
import { deterministicDiagramJson } from './deterministic-json';
import { DiagramPreview } from './DiagramPreview';
import { diagramPngBlob, diagramPngSize, downloadDiagramBlob, serializeDiagramSvg } from './export-diagram-image';
import './diagram-kit.css';

export function DiagramKitWorkbench({ api, onBack, initialFile }: { api?: Api; onBack?: () => void; initialFile?: File }) {
  const [file, setFile] = useState<File | null>(initialFile ?? null), [fileVersion, setFileVersion] = useState(0);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [diagram, setDiagram] = useState<ElectricalDiagram | null>(null), [json, setJson] = useState('');
  const [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false), [error, setError] = useState('');
  const [notice, setNotice] = useState(''), [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const preview = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null), jsonInput = useRef<HTMLInputElement>(null);
  const onPrepared = useCallback((next: PreparedImage | null) => { setPrepared(next); setConfirmed(false); }, []);
  const dirty = !!diagram && json !== deterministicDiagramJson(diagram);
  const diagnostics = diagram ? validateDiagram(diagram) : [];
  const quality = diagram ? buildDiagramQualityReport(diagram,prepared?.manifest) : null;
  useEffect(() => {
    if (!file) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [file]);
  function discard() {
    const accepted = !diagram || window.confirm('Bỏ JSON thử hiện tại? Hãy tải bộ đối chiếu trước nếu cần giữ. Project thật không bị thay đổi.');
    if (accepted) setError('');
    return accepted;
  }
  function selectFile(next?: File) {
    if (!next || busy || !discard()) return;
    setFile(next); setFileVersion(v => v + 1); setPrepared(null); setDiagram(null); setJson(''); setConfirmed(false); setError(''); setNotice(''); setAiWarnings([]);
  }
  function acceptDiagram(value: unknown, aligned = prepared) {
    const parsed = validateDiagramInput(value);
    if (!parsed.diagram) throw new Error(['JSON chưa đúng schema Studio.', ...parsed.errors].join('\n'));
    if (!aligned || parsed.diagram.canvas.width !== aligned.manifest.canvas.width || parsed.diagram.canvas.height !== aligned.manifest.canvas.height) throw new Error('Canvas JSON phải đúng kích thước ảnh sau crop. Không tự kéo giãn hoặc đoán tọa độ.');
    const next = { ...parsed.diagram, reviewStatus: 'draft' as const };
    setDiagram(next); setJson(deterministicDiagramJson(next)); setError('');
  }
  async function generate() {
    if (!api || !prepared || !confirmed || busy) return;
    if (!window.confirm('Gọi AI có phí bằng ảnh đã chuẩn bị? Bản thử chỉ giữ kết quả trong tab, chưa lưu DB.')) return;
    setBusy(true); setError(''); setNotice('');
    try { const result = await api.generateDiagramDraft(prepared.clean); const parsed=validateDiagramInput(result.diagram);if(!parsed.diagram)throw new Error(parsed.errors.join("; ")); acceptDiagram({...parsed.diagram,sourceImage:prepared.source.name,sourceCrop:prepared.manifest.crop,sourceTransform:{rotateClockwise:prepared.manifest.rotation ?? 0},reviewMetadata:{...parsed.diagram.reviewMetadata,sourceSha256:prepared.manifest.source.sha256}}); setAiWarnings([...result.warnings, ...result.uncertainItems]); setNotice('AI đã trả bản nháp. Chưa lưu vào project; tải ZIP để giữ kết quả.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không tạo được draft.'); } finally { setBusy(false); }
  }
  async function importJson(next?: File) {
    if (!next || !prepared || busy) return;
    setBusy(true);
    try { if (next.size > 5 * 1024 * 1024) throw new Error('JSON tối đa 5 MB.'); const value=JSON.parse(await next.text());const parsed=validateDiagramInput(value);if(!parsed.diagram)throw new Error(parsed.errors.join('; '));const aligned=await prepareSourceForDiagram(prepared.source,parsed.diagram,prepared);setPrepared(aligned);acceptDiagram(value,aligned); setAiWarnings([]); setNotice('Đã nạp JSON để kiểm tra renderer, không gọi AI.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được JSON.'); } finally { setBusy(false); }
  }
  async function exportBundle() {
    if (!prepared || busy || dirty) return;
    if (quality && !quality.canExport) { setError("Sửa các lỗi FAIL trước khi xuất bộ đối chiếu.");return; }
    setBusy(true); setError('');
    try {
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[prepared.source.type] || 'bin';
      const files: Record<string, Uint8Array> = { [`source.${extension}`]: new Uint8Array(await prepared.source.arrayBuffer()), 'clean.png': new Uint8Array(await prepared.clean.arrayBuffer()) };
      const add = (name: string, value: unknown) => { files[name] = strToU8(JSON.stringify(value, null, 2) + '\n'); };
      add('transforms.json', prepared.manifest); add('reference.json', kitReference(prepared.manifest));
      if (diagram) {
        const svg = preview.current?.querySelector('svg'); if (!svg) throw new Error('Chưa có SVG từ renderer Studio.');
        await document.fonts.ready;
        const serialized = serializeDiagramSvg(svg, diagram.canvas);
        files['diagram.json'] = strToU8(deterministicDiagramJson(diagram));
        files['web-export.svg'] = strToU8(serialized);
        files['web-export.png'] = new Uint8Array(await (await diagramPngBlob(serialized, diagramPngSize(diagram.canvas))).arrayBuffer());
      }
      if(quality) add('qa/diagram-quality.json',quality);
      add('feedback.json', { version: 1, sourceSha256: prepared.manifest.source.sha256, candidateSha256: diagram ? await sha256(new Blob([deterministicDiagramJson(diagram)])) : null, items: [] });
      add('qa/report.json', { version: 1, status: quality?.status ?? 'NEEDS_REVIEW', scope: 'Local structural checks only; upstream checker not executed in browser.', structuralErrors: diagnostics, aiWarnings,
        missingEvidence: ['Reference chưa được ghi độc lập từ ảnh gốc.', 'Chưa chạy checker Python trên bundle.', 'Chưa kiểm nét chữ, cực/chân, mạng điện hoặc đối chiếu raster.', ...(!diagram ? ['Chưa có candidate JSON hoặc web export.'] : [])],
        hashes: Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, bytes]) => [name, await sha256(new Blob([new Uint8Array(bytes).buffer]))]))) });
      files['README.txt'] = strToU8('LOCAL PILOT — chưa lưu DB. source là nguyên bản; clean là crop/scale theo transforms.json.\nĐiền reference.json bằng cách đọc ảnh GỐC, không sao chép candidate làm đáp án.\nDùng tools/agent-web-kit/check_studio_bundle.py trong repo, theo PORT.md.\nJSON và web-export dùng hệ tọa độ clean.png (1x). Checker chưa chứng nhận PASS.\n');
      downloadDiagramBlob(new Blob([new Uint8Array(zipSync(files)).buffer], { type: 'application/zip' }), 'diagram-kit-trial.zip');
      setNotice('Đã xuất bộ đối chiếu. Ảnh gốc giữ nguyên byte; reference chưa được xác minh.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không xuất được bundle.'); } finally { setBusy(false); }
  }
  return <section className="diagramStudioView kitWorkbench">
    <header><div><small>DIAGRAM STUDIO · CÔNG CỤ SƠ ĐỒ</small><h1>Ảnh → JSON → kiểm tra → xuất</h1><p>Bản thử local · chưa lưu DB · không thay project đang làm.</p></div>{onBack && <button disabled={busy} onClick={() => { if (discard()) onBack(); }}>← Về project</button>}</header>
    <div className="kitNotice">Ảnh và JSON thử chỉ nằm trong tab này. Tải bộ đối chiếu trước khi đóng hoặc tải lại trang.</div>
    <DiagramBatchTools/>
    <div className="kitActions"><input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ''; }}/><button className="primary" disabled={busy} onClick={() => input.current?.click()}>{file ? 'Đổi ảnh nguồn' : 'Chọn ảnh nguồn'}</button><span>{file?.name ?? 'Chưa chọn ảnh — không tự gọi AI'}</span></div>
    {error && <pre className="kitError" role="alert">{error}</pre>}{notice && <p role="status">{notice}</p>}
    {file && !diagram && <DiagramImagePreparation key={fileVersion} file={file} busy={busy || !!diagram} onPrepared={onPrepared}/>}
    {prepared && <section className="kitStage"><h2>2. Duyệt ảnh → GEN hoặc nạp JSON</h2><p>{prepared.manifest.canvas.width} × {prepared.manifest.canvas.height} px · SHA-256 nguồn <code>{prepared.manifest.source.sha256.slice(0, 16)}…</code></p>
      <p>Chỉ khi bấm GEN và xác nhận mới gửi ảnh xử lý lên AI. Ảnh chuẩn bị gửi AI là PNG để giữ nét mảnh và màu sọc.</p>
      <label className="kitConsent"><input type="checkbox" checked={confirmed} disabled={busy || !!diagram} onChange={e => setConfirmed(e.target.checked)}/>Tôi đã kiểm tra crop không mất chữ, đầu dây, dây trắng/sọc và chấm nối.</label>
      <div className="kitActions"><button className="primary" disabled={!api || !confirmed || busy || !!diagram} onClick={() => void generate()}>{busy ? 'Đang xử lý…' : 'Dùng ảnh này → GEN AI (có phí)'}</button><input hidden ref={jsonInput} type="file" accept=".json,application/json" onChange={e => { void importJson(e.target.files?.[0]); e.target.value = ''; }}/><button disabled={busy || !!diagram} onClick={() => jsonInput.current?.click()}>Nạp JSON có sẵn · không dùng token</button>{diagram && <button disabled={busy} onClick={() => { if (discard()) { setDiagram(null); setJson(''); setConfirmed(false); setNotice(''); setAiWarnings([]); } }}>Sửa ảnh / bỏ JSON thử</button>}<button disabled={busy || dirty} onClick={() => void exportBundle()}>Tải bộ đối chiếu ZIP</button></div>
      {!api && <p>Tài khoản này chỉ dùng công cụ cục bộ. Bạn vẫn crop, nạp JSON và tải ZIP được.</p>}
    </section>}
    {diagram && <section className="kitStage"><h2>3. JSON ↔ Renderer thật của Studio</h2><div className="kitCandidate"><div><label>JSON thử · sửa thủ công<textarea disabled={busy} spellCheck={false} value={json} onChange={e => setJson(e.target.value)}/></label><button disabled={busy || !dirty} onClick={() => { try { const parsed=parseManualDiagramJson(json,diagram);if(!parsed.diagram)throw new Error(parsed.errors.join("; "));acceptDiagram(parsed.diagram); } catch (e) { setError(e instanceof Error ? e.message : 'JSON không hợp lệ.'); } }}>Cập nhật preview (local)</button>{dirty && <p>Chưa áp dụng JSON đang gõ; khóa export để không tải nhầm bản.</p>}</div><div ref={preview}><DiagramPreview diagram={diagram}/></div></div><p>{diagnostics.length ? `${diagnostics.length} lỗi cấu trúc/bố cục` : 'Cấu trúc chưa thấy lỗi'} · NEEDS_REVIEW về nội dung điện.</p>{diagnostics.length > 0 && <ul>{diagnostics.map((message, i) => <li key={i}>{message}</li>)}</ul>}{aiWarnings.length > 0 && <ul>{aiWarnings.map((message, i) => <li key={i}>{message}</li>)}</ul>}</section>}
    {diagram && prepared && <DiagramComparisonTools diagram={diagram} prepared={prepared}/>}
    <section className="kitStage"><h2>Checker từ kit kiểm được gì?</h2><p>Adapter dùng JSON gốc + SVG xuất từ chính renderer Studio, không tạo nét vẽ giả từ JSON. Chạy CLI sau khi tải ZIP và điền reference độc lập.</p><p>Chưa có đối chiếu chữ/chân/mạng thì vẫn NEEDS_REVIEW. Starter không kiểm đủ hình linh kiện, va chạm nét chữ hoặc kết luận đúng điện.</p></section>
  </section>;
}

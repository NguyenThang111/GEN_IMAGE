import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DiagramKitWorkbench } from './DiagramKitWorkbench';
import { diagramPngBlob, downloadDiagramBlob } from './export-diagram-image';
import '../styles.css';

// Synthetic UI fixture, not a real vehicle circuit or electrical reference.
const sample = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480"><rect width="800" height="480" fill="#f3f0e7"/><rect x="45" y="40" width="710" height="400" rx="8" fill="white" stroke="#b2b9b4"/><text x="70" y="85" font-family="Arial" font-size="24">SƠ ĐỒ MẪU · kiểm tra crop/preview</text><text x="70" y="115" font-family="Arial" font-size="14">Không phải mạch xe đã xác minh · giữ số chân, dấu và dây trắng</text><rect x="130" y="205" width="90" height="60" fill="none" stroke="#374e46" stroke-width="3"/><text x="158" y="240" font-size="24">−  +</text><path d="M220 235 H480 V210 H600" fill="none" stroke="#ba5b3d" stroke-width="5"/><path d="M220 235 H480 V210 H600" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="8 6"/><circle cx="626" cy="210" r="26" fill="none" stroke="#374e46" stroke-width="3"/><path d="M608 192 L644 228 M644 192 L608 228" stroke="#374e46" stroke-width="2"/><text x="130" y="300" font-family="Arial" font-size="18">Ắc quy · 12V</text><text x="335" y="222" font-family="Arial" font-size="15">R/W · 20A</text><text x="590" y="275" font-family="Arial" font-size="18">Đèn O₂</text><text x="72" y="405" font-family="Arial" font-size="14">Chú giải cần giữ · Bl ≠ BI · 0 ≠ O</text></svg>`;
const candidate = { schemaVersion: 1, reviewStatus: 'draft', id: 'kit-fixture-light', vehicleId: 'kit-fixture', vehicleTitle: 'Mẫu tổng hợp', circuitTitle: 'Kiểm tra kit', canvas: { width: 800, height: 480 },
  components: [{ id: 'battery', type: 'battery', x: 130, y: 200, width: 90, height: 65, label: 'Ắc quy · 12V', terminals: [{ id: 'neg', x: 130, y: 235 }, { id: 'pos', x: 220, y: 235 }] }, { id: 'lamp', type: 'lamp', x: 596, y: 180, width: 60, height: 60, label: 'Đèn O₂', terminals: [{ id: 'in', x: 600, y: 210 }, { id: 'out', x: 652, y: 210 }] }],
  wires: [{ id: 'feed', from: { componentId: 'battery', terminalId: 'pos' }, to: { componentId: 'lamp', terminalId: 'in' }, points: [{ x: 220, y: 235 }, { x: 480, y: 235 }, { x: 480, y: 210 }, { x: 600, y: 210 }], code: 'R/W', primaryColor: '#ba5b3d', stripeColor: '#ffffff', state: 'controlled' }] };
function Demo() {
  const [file, setFile] = useState<File>(), [error, setError] = useState('');
  useEffect(() => { void diagramPngBlob(sample, { width: 800, height: 480 }).then(blob => setFile(new File([blob], 'kit-synthetic-source.png', { type: 'image/png' }))).catch(e => setError(e.message)); }, []);
  return <main style={{ maxWidth: 1440 }}><aside className="kitNotice">DEMO · ảnh tổng hợp · không nối API/DB. <button onClick={() => downloadDiagramBlob(new Blob([JSON.stringify(candidate, null, 2)], { type: 'application/json' }), 'kit-fixture.json')}>Tải JSON mẫu (ảnh nguyên khung)</button><button onClick={() => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; }}>Đổi theme</button></aside>{error && <p role="alert">{error}</p>}{file ? <DiagramKitWorkbench initialFile={file}/> : <p>Đang chuẩn bị mẫu…</p>}</main>;
}
createRoot(document.getElementById('root')!).render(<Demo/>);

import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DiagramConverterView } from './DiagramConverterView';
import type { Api, DiagramProject } from '../api';
import '../styles.css';

// Local synthetic fixture. No network, credentials, paid AI or real project writes.
function Check() {
  const [project, setProject] = useState({ id: 'fixture', vehicleId: 'fixture', vehicleTitle: 'Ảnh mẫu kiểm thử', circuits: [{ id: 'lamp', circuitKey: 'lamp', circuitTitle: 'Upload → chuẩn bị ảnh → tạo sơ đồ', status: 'REGISTERED' }] } as unknown as DiagramProject);
  const [mount, setMount] = useState(0), [info, setInfo] = useState('AI: 0 · SAVE: 0');
  const saved = useRef(project), source = useRef<File>(), failSave = useRef(true), failAi = useRef(false);
  const counters = useRef({ ai: 0, save: 0 });
  const api = useMemo(() => ({
    async generateDiagramDraft(file: File) {
      counters.current.ai++; setInfo(JSON.stringify(counters.current));
      if (failAi.current) throw new Error('Mock AI failure · bản cũ giữ nguyên');
      const img = await createImageBitmap(file), canvas = { width: img.width, height: img.height }; img.close();
      return { model: 'MOCK · không dùng API', warnings: [], uncertainItems: [], diagram: { schemaVersion: 1, reviewStatus: 'draft', id: 'fixture-lamp', vehicleId: 'fixture', vehicleTitle: 'Fixture', circuitTitle: 'Lamp', canvas,
        components: [{ id: 'lamp', type: 'lamp', label: 'Đèn mẫu', x: 100, y: 100, width: 80, height: 60, terminals: [{ id: 'in', x: 100, y: 130 }, { id: 'out', x: 180, y: 130 }] }], wires: [] } };
    },
    async saveDiagramCircuitDraft(_id: string, file: File, input: any) {
      counters.current.save++;
      const bytes = await file.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
      setInfo(JSON.stringify({ ...counters.current, originalHashMatches: hash === input.preparation?.source.sha256, canvas: input.preparation?.canvas, sourceName: file.name }));
      if (failSave.current) throw new Error('Mock SAVE failure · thử lưu lại');
      source.current = file;
      saved.current = { ...saved.current, circuits: [{ ...saved.current.circuits[0], schema: input.schema, sourceFileName: file.name, sourceMimeType: file.type, generatedByModel: input.model, aiReview: { warnings: input.warnings, uncertainItems: input.uncertainItems, preparation: input.preparation } }] };
      return saved.current;
    },
    async diagramCircuitSource() { return source.current!; },
  }) as unknown as Api, []);
  return <main style={{ maxWidth: 1440, margin: 'auto', padding: 20 }}>
    <aside className="kitNotice">LOCAL TEST · không nối AI/DB thật
      <label><input type="checkbox" defaultChecked onChange={e => { failSave.current = e.target.checked; }}/> Giả lập lỗi lưu</label>
      <label><input type="checkbox" onChange={e => { failAi.current = e.target.checked; }}/> Giả lập lỗi AI</label>
      <button onClick={() => { setProject(saved.current); setMount(v => v + 1); }}>Mở lại bản đã lưu</button>
      <output>{info}</output>
    </aside>
    <DiagramConverterView key={mount} api={api} project={project} circuit={project.circuits[0]} onSaved={setProject}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Check/>);

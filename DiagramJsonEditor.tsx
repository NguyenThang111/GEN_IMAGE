import { useEffect, useRef, useState } from "react";
import type { ElectricalDiagram } from "./contract";
import { deterministicDiagramJson } from "./deterministic-json";
import { parseManualDiagramJson } from "./manual-diagram-json";
import { DiagramPreview } from "./DiagramPreview";
import { validateDiagram } from "./validate-diagram";
import { diagramPngBlob, diagramPngSize, downloadDiagramBlob, serializeDiagramSvg } from "./export-diagram-image";
import "./manual-diagram-json.css";

type Props = {
  diagram: ElectricalDiagram;
  canSave: boolean;
  onPreview: (diagram: ElectricalDiagram) => void;
  onSave: (diagram: ElectricalDiagram, errors: string[]) => Promise<void>;
  onEditingChange: (editing: boolean) => void;
};

export function DiagramJsonEditor({ diagram, canSave, onPreview, onSave, onEditingChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewState, setPreviewState] = useState<"ready" | "pending" | "invalid">("ready");
  const [actionError, setActionError] = useState("");
  const original = useRef(diagram);
  const input = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing || saving) return;
    const timer = window.setTimeout(() => {
      const result = parseManualDiagramJson(text, original.current);
      setIssues(result.errors);
      setPreviewState(result.diagram ? "ready" : "invalid");
      if (result.diagram) onPreview(result.diagram);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [editing, text, saving, onPreview]);
  useEffect(() => {
    if (!editing) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [editing]);

  function startEditing() {
    original.current = structuredClone(diagram);
    setText(deterministicDiagramJson(diagram)); setIssues([]); setNotice(""); setActionError(""); setPreviewState("ready");
    setEditing(true); onEditingChange(true);
  }
  function downloadJson(backup = false) {
    const output = backup ? original.current : diagram;
    downloadDiagramBlob(new Blob([deterministicDiagramJson(output)], { type: "application/json" }), `${output.id}${backup ? ".before-edit" : ""}.schema.json`);
  }
  function changeText(value: string) {
    setText(value); setPreviewState("pending"); setIssues([]); setNotice(""); setActionError("");
  }
  async function importJson(file?: File) {
    if (!file) return;
    try { changeText(await file.text()); }
    catch { setActionError("Không đọc được file JSON."); }
  }
  async function apply(save: boolean) {
    const result = parseManualDiagramJson(text, original.current);
    setIssues(result.errors); setNotice(""); setActionError(""); setPreviewState(result.diagram ? "ready" : "invalid");
    if (!result.diagram) return;
    onPreview(result.diagram);
    if (!save) { setNotice("Preview đã cập nhật — chưa lưu vào project, không gọi AI."); return; }
    setSaving(true);
    try {
      await onSave(result.diagram, result.errors);
      setEditing(false); onEditingChange(false);
      setNotice("Đã lưu JSON vào project. Bản sửa cần được review lại; không gọi AI.");
    } catch (error) { setNotice(""); setActionError(error instanceof Error ? error.message : "Lưu thất bại. Nội dung sửa vẫn được giữ."); }
    finally { setSaving(false); }
  }
  function cancel() {
    if (text !== deterministicDiagramJson(original.current) && !window.confirm("Bỏ các thay đổi JSON chưa lưu?")) return;
    onPreview(original.current); setEditing(false); onEditingChange(false); setIssues([]); setNotice(""); setActionError(""); setPreviewState("ready");
  }
  async function exportImage(format: "svg" | "png") {
    const svg = preview.current?.querySelector("svg");
    if (!svg || previewState !== "ready") return;
    setExporting(true); setActionError("");
    try {
      const serialized = serializeDiagramSvg(svg, diagram.canvas);
      const blob = format === "svg" ? new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }) : await diagramPngBlob(serialized, diagramPngSize(diagram.canvas));
      downloadDiagramBlob(blob, `${diagram.id}.${format}`);
    } catch (error) { setActionError(error instanceof Error ? error.message : "Không xuất được ảnh sơ đồ."); }
    finally { setExporting(false); }
  }

  const diagnostics = editing ? issues : validateDiagram(diagram);
  const exportDisabled = saving || exporting || (editing && previewState !== "ready");
  return <section className="diagramManualJson" onDrop={event => { event.preventDefault(); event.stopPropagation(); }} aria-label="Sửa JSON thủ công">
    <header><b>JSON ↔ Sơ đồ</b><span>Preview tự động · không gọi AI · chỉ lưu DB khi bấm Lưu</span></header>
    <div className="diagramManualWorkspace">
      <div className="diagramManualCode">
        <div className="diagramJsonActions"><button type="button" disabled={exportDisabled} onClick={() => downloadJson()}>Tải JSON</button>{!editing && <button type="button" className="primary" onClick={startEditing}>Sửa JSON</button>}{editing && <><input hidden ref={input} type="file" accept=".json,application/json" onChange={event => { void importJson(event.target.files?.[0]); event.target.value = ""; }} /><button type="button" disabled={saving} onClick={() => input.current?.click()}>Nạp file JSON</button><button type="button" disabled={saving} onClick={() => downloadJson(true)}>Tải bản trước khi sửa</button></>}</div>
        {editing ? <><label htmlFor="manual-diagram-json">JSON đang sửa · chưa lưu</label><textarea id="manual-diagram-json" value={text} disabled={saving} spellCheck={false} onChange={event => changeText(event.target.value)} /><div className="diagramJsonActions"><button type="button" disabled={saving} onClick={() => void apply(false)}>Kiểm tra ngay</button><button type="button" className="primary" disabled={saving || !canSave || previewState === "invalid"} onClick={() => void apply(true)}>{saving ? "Đang lưu…" : "Lưu JSON vào project"}</button><button type="button" disabled={saving} onClick={cancel}>Hủy sửa</button></div>{!canSave && <p>Cần mở circuit trong project và tải được ảnh nguồn để lưu.</p>}</> : <><b className="diagramJsonLabel">JSON hiện tại</b><pre className="diagramJsonReadOnly">{deterministicDiagramJson(diagram)}</pre></>}
        <p className="diagramJsonHint">Ngừng gõ 0,5 giây để xem hình mới. Giữ nguyên ID circuit/project; có thể lưu nháp khi còn lỗi bố cục để chỉnh tiếp.</p>
      </div>
      <div className="diagramManualPreview">
        <div className="diagramJsonActions"><b>Sơ đồ từ JSON</b><button type="button" disabled={exportDisabled} onClick={() => void exportImage("svg")}>Tải SVG</button><button type="button" disabled={exportDisabled} onClick={() => void exportImage("png")}>{exporting ? "Đang xuất…" : "Tải PNG"}</button></div>
        <p className={`diagramPreviewStatus ${previewState}`} role="status">{editing ? previewState === "pending" ? "Đang kiểm tra JSON… Hình đang hiển thị là bản hợp lệ gần nhất." : previewState === "invalid" ? "JSON chưa hợp lệ — giữ nguyên hình gần nhất, chưa thể xuất ảnh hoặc lưu." : "Preview đã cập nhật · chưa lưu vào project." : "Ảnh dựng từ JSON hiện tại."}</p>
        <div ref={preview}><DiagramPreview diagram={diagram} /></div>
        <p className="diagramJsonHint">Xuất đúng hình đang preview, không thay ảnh nguồn. PNG tối đa 4096 px; SVG giữ kích thước canvas. {diagnostics.length ? `${diagnostics.length} điểm cần review.` : "Validator cấu trúc đạt; chưa xác nhận đúng điện."}</p>
      </div>
    </div>
    {notice && <p role="status">{notice}</p>}
    {actionError && <div className="diagramValidationError" role="alert">{actionError}</div>}
    {diagnostics.length > 0 && <div className="diagramValidationError" role="alert"><b>Cần kiểm tra</b><ul>{diagnostics.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
  </section>;
}

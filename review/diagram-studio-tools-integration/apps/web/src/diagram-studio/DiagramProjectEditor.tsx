import { useState } from "react";
import type { Api, DiagramCircuit, DiagramProject, DiagramProjectEditInput } from "../api";
import "./diagram-project-editor.css";

export function projectEditInput(project: DiagramProject): DiagramProjectEditInput {
  return { vehicleId: project.vehicleId, vehicleTitle: project.vehicleTitle, manufacturer: project.manufacturer ?? "", modelYear: project.modelYear ?? "", ecmId: project.ecmId ?? "", scuId: project.scuId ?? "", circuits: project.circuits.map(({ id, circuitKey, circuitTitle, required }) => ({ id, circuitKey, circuitTitle, required })) };
}
export function circuitHasData(circuit: DiagramCircuit) {
  return Boolean(circuit.schema || circuit.sourceFileName || circuit.sourceByteSize || circuit.aiReview || circuit.validationErrors || circuit.generatedByModel || circuit.status !== "REGISTERED");
}
export function DiagramProjectEditActions({ canEdit, onEdit }: { canEdit: boolean; onEdit: () => void }) {
  return canEdit ? <button type="button" onClick={onEdit}>Sửa thông tin</button> : null;
}
export function DiagramProjectEditor({ project, api, canArchive, onSaved, onArchived, onCancel }: { project: DiagramProject; api: Api; canArchive: boolean; onSaved: (project: DiagramProject) => void; onArchived: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(() => projectEditInput(project));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false), [confirmation, setConfirmation] = useState("");
  const fields = [{ key: "vehicleTitle", label: "Tên xe / Project", max: 180 }, { key: "vehicleId", label: "Vehicle ID", max: 120 }, { key: "manufacturer", label: "Hãng", max: 100 }, { key: "modelYear", label: "Năm xe", max: 40 }, { key: "ecmId", label: "ECM ID", max: 120 }, { key: "scuId", label: "SCU ID", max: 120 }] as const;
  async function save() {
    setBusy(true); setError("");
    try { onSaved(await api.updateDiagramProject(project.id, form)); } catch (error) { setError(error instanceof Error ? error.message : "Không lưu được project"); } finally { setBusy(false); }
  }
  async function archive() {
    if (!canArchive || confirmation !== project.vehicleTitle) return;
    setBusy(true); setError("");
    try { await api.archiveDiagramProject(project.id, confirmation); onArchived(); } catch (error) { setError(error instanceof Error ? error.message : "Không xóa được project"); } finally { setBusy(false); }
  }
  return <section className="diagramStudioView diagramProjectEditor">
    <header><h1>Sửa thông tin project</h1><p>Admin / Dev · Giữ nguyên nội dung sơ đồ và ảnh nguồn.</p></header>
    {error && <p role="alert" className="diagramInlineError">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy || deleting}>
      <div className="diagramProjectFields">{fields.map(field => <label key={field.key}>{field.label}<input required={field.key === "vehicleTitle" || field.key === "vehicleId"} maxLength={field.max} pattern={field.key === "vehicleId" ? "[a-z0-9]+(-[a-z0-9]+)*" : undefined} value={form[field.key]} onChange={event => setForm({ ...form, [field.key]: event.target.value })}/></label>)}</div>
      <p>Đổi Vehicle ID sẽ đổi metadata JSON và đường dẫn export mới. ZIP đã tải trước đó không tự cập nhật.</p>
      <h2>Danh mục sơ đồ</h2><p>Sơ đồ có dữ liệu không được bỏ; có thể tắt “Bắt buộc”.</p>
      {form.circuits.map((circuit, index) => {
        const original = project.circuits.find(item => item.id === circuit.id);
        const protectedData = original && circuitHasData(original);
        const update = (changes: Partial<typeof circuit>) => setForm({ ...form, circuits: form.circuits.map((item, i) => i === index ? { ...item, ...changes } : item) });
        return <div className="diagramProjectEditCircuit" key={circuit.id ?? `new-${index}`}>
          <label>Mã sơ đồ<input required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={circuit.circuitKey} onChange={event => update({ circuitKey: event.target.value })}/></label>
          <label>Tên sơ đồ<input required maxLength={180} value={circuit.circuitTitle} onChange={event => update({ circuitTitle: event.target.value })}/></label>
          <label className="diagramProjectRequired"><input type="checkbox" checked={circuit.required} onChange={event => update({ required: event.target.checked })}/>Bắt buộc</label>
          <button type="button" disabled={Boolean(protectedData) || form.circuits.length === 1} title={protectedData ? "Sơ đồ đã có dữ liệu — không xóa" : "Bỏ sơ đồ chưa có dữ liệu"} onClick={() => setForm({ ...form, circuits: form.circuits.filter((_, i) => i !== index) })}>Bỏ</button>
        </div>;
      })}
      <button type="button" onClick={() => setForm({ ...form, circuits: [...form.circuits, { circuitKey: "", circuitTitle: "", required: true }] })}>+ Thêm sơ đồ</button>
      <div className="diagramProjectEditActions"><button type="button" onClick={onCancel}>Hủy</button><button className="primary" type="submit">{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div>
    </fieldset></form>
    {canArchive && <section className="diagramProjectDelete"><h2>Xóa project</h2><p>Ẩn project khỏi danh sách. Sơ đồ, JSON và ảnh vẫn được giữ để có thể khôi phục.</p>
      {!deleting ? <button disabled={busy} type="button" onClick={() => setDeleting(true)}>Xóa project…</button> : <form onSubmit={event => { event.preventDefault(); void archive(); }}><label>Nhập đúng tên: <b>{project.vehicleTitle}</b><input autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)}/></label><div className="diagramProjectEditActions"><button type="button" disabled={busy} onClick={() => { setDeleting(false); setConfirmation(""); }}>Hủy xóa</button><button type="submit" disabled={busy || confirmation !== project.vehicleTitle}>Xác nhận xóa project</button></div></form>}
    </section>}
  </section>;
}

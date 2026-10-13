import { DiagramComparisonTools } from "./DiagramComparisonTools";
import { prepareSourceForDiagram } from "./diagram-source";
import { buildDiagramQualityReport } from "./diagram-quality";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { DiagramPreview } from "./DiagramPreview";
import { diagramPngBlob, diagramPngSize, serializeDiagramSvg } from "./export-diagram-image";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { zipSync, strToU8 } from "fflate";
import { deterministicDiagramJson } from "./deterministic-json";
import { DiagramJsonEditor } from "./DiagramJsonEditor";
import { validateDiagram, validateDiagramInput } from "./validate-diagram";
import type { ElectricalDiagram } from "./contract";
import type { Api, DiagramCircuit, DiagramProject } from "../api";

import { DiagramImagePreparation } from "./DiagramImagePreparation";
import type { PreparedImage, PreparationManifest } from "./kit-image";
import "./diagram-kit.css";

const initialDiagram: ElectricalDiagram = { schemaVersion: 1, reviewStatus: "draft", id: "vehicle-id-diagram", vehicleId: "vehicle-id", vehicleTitle: "Tên xe", circuitTitle: "Tên sơ đồ", canvas: { width: 1400, height: 700 }, components: [], wires: [] };
const clone = (diagram: ElectricalDiagram) => structuredClone(diagram);

export function slugifyDiagramName(value: string, fallback: string) {
  const slug = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || fallback;
}

type AiReview = { warnings: string[]; uncertainItems: string[]; model: string; preparation?: PreparationManifest };
export type DraftPaths = { root: string; circuit: string; json: string; markdown: string; image: string };

export function getDraftPaths(diagram: ElectricalDiagram, sourceName: string): DraftPaths {
  const root = slugifyDiagramName(diagram.vehicleId || diagram.vehicleTitle, "vehicle-id");
  const diagramId = slugifyDiagramName(diagram.id, `${root}-diagram`);
  const circuit = diagramId.startsWith(`${root}-`) ? diagramId.slice(root.length + 1) : slugifyDiagramName(diagram.circuitTitle, "diagram");
  const folder = `${root}/${circuit}`;
  const extension = sourceName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return { root, circuit, json: `${folder}/${diagramId}.schema.json`, markdown: `${folder}/${diagramId}.review.md`, image: `${folder}/${diagramId}.source.${extension}` };
}

export function buildDraftReview(diagram: ElectricalDiagram, review: AiReview | null, errors: string[], ecmId: string, paths: DraftPaths) {
  const list = (items: string[]) => items.length ? items.map(item => `- ${item}`).join("\n") : "- Không có";
  const imageName = paths.image.split("/").at(-1);
  const jsonName = paths.json.split("/").at(-1);
  const preparationNote = review?.preparation ? `\n## Chuẩn bị ảnh\n\n- JSON dùng tọa độ ảnh đã xử lý ${review.preparation.canvas.width}×${review.preparation.canvas.height}; không phải tọa độ ảnh gốc.\n- Thông số và hash: ./${jsonName?.replace('.schema.json', '.preparation.json')}\n- Crop: ${JSON.stringify(review.preparation.crop)}\n- Sáng/tương phản: ${review.preparation.adjustments.brightness}% / ${review.preparation.adjustments.contrast}%\n` : "";
  return `# Diagram AI draft review\n\n![Ảnh sơ đồ gốc](./${imageName})\n\n## Files\n\n- Schema: \`./${jsonName}\`\n- Source image: \`./${imageName}\`\n- EasyScan target: \`src/v4/components/ElectricalDiagram/packs/${paths.json}\`\n\n## Draft summary\n\n- Diagram ID: \`${diagram.id}\`\n- Vehicle ID: \`${diagram.vehicleId}\`\n- Vehicle: ${diagram.vehicleTitle}\n- Circuit: ${diagram.circuitTitle}\n- ECM ID: ${ecmId.trim() || "Chưa nhập"}\n- Model: ${review?.model ?? "unknown"}\n- Review status: \`draft\`\n- Components: ${diagram.components.length}\n- Wires: ${diagram.wires.length}\n\n> ECM ID hiện là metadata của hồ sơ review, chưa thuộc EasyScan F01 runtime schema. Structural validation không chứng minh topology điện đúng. Bắt buộc human review trước khi đưa vào catalog.\n\n## Validator errors\n\n${list(errors)}\n\n## AI warnings / phần còn thiếu\n\n${list(review?.warnings ?? [])}\n\n## Uncertain items / điểm chưa chắc chắn\n\n${list(review?.uncertainItems ?? [])}\n${preparationNote}\n## Human review checklist\n\n- [ ] Đối chiếu đủ component với ảnh nguồn.\n- [ ] Đối chiếu terminal/pin; không suy đoán pin bị che hoặc không đọc được.\n- [ ] Đối chiếu từng wire endpoint, junction/crossing và mã màu dây.\n- [ ] Sửa các validator errors có ý nghĩa trước khi nâng review status.\n- [ ] Chỉ đánh dấu electrically-reviewed sau khi người có chuyên môn duyệt điện.\n`;
}

type ConverterProps = { api: Api; project?: DiagramProject; circuit?: DiagramCircuit; onBack?: () => void; onSaved?: (project: DiagramProject) => void };

export function DiagramConverterView({ api, project, circuit, onBack, onSaved }: ConverterProps) {
  const [diagram, setDiagram] = useState<ElectricalDiagram>(() => circuit?.schema ? clone(circuit.schema as ElectricalDiagram) : project && circuit ? { ...clone(initialDiagram), id: `${project.vehicleId}-${circuit.circuitKey}`, vehicleId: project.vehicleId, vehicleTitle: project.vehicleTitle, circuitTitle: circuit.circuitTitle } : clone(initialDiagram));
  const [ecmId, setEcmId] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [comparisonPrepared,setComparisonPrepared]=useState<PreparedImage|null>(null);
  const jsonInputRef=useRef<HTMLInputElement>(null);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [draftNeedsSave, setDraftNeedsSave] = useState(false);
  const sourceRevision = useRef(0);
  const onPrepared = useCallback((value: PreparedImage | null) => setPrepared(value), []);
  const [aiRunning, setAiRunning] = useState(false);
  const [jsonEditing, setJsonEditing] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const quality = useMemo(()=>buildDiagramQualityReport(diagram,comparisonPrepared?.manifest),[diagram,comparisonPrepared]);
  const errors = useMemo(() => validateDiagram(diagram), [diagram]);
  const realtimeJson = useMemo(() => deterministicDiagramJson(diagram), [diagram]);
  const paths = useMemo(() => getDraftPaths(diagram, sourceFile?.name ?? "source.jpg"), [diagram, sourceFile]);
  const reviewMarkdown = useMemo(() => buildDraftReview(diagram, aiReview, errors, ecmId, paths), [diagram, aiReview, errors, ecmId, paths]);

  useEffect(() => () => { if (backgroundUrl) URL.revokeObjectURL(backgroundUrl); }, [backgroundUrl]);
  useEffect(() => {
    if (!draftNeedsSave && !aiRunning) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftNeedsSave, aiRunning]);
  useEffect(() => {
    if (!project || !circuit) return;
    setPendingImage(null); setPrepared(null); setDraftNeedsSave(false);
    setEcmId(project.ecmId ?? "");
    setDiagram(circuit.schema ? clone(circuit.schema as ElectricalDiagram) : { ...clone(initialDiagram), id: `${project.vehicleId}-${circuit.circuitKey}`, vehicleId: project.vehicleId, vehicleTitle: project.vehicleTitle, circuitTitle: circuit.circuitTitle });
    setAiReview(circuit.schema ? { warnings: circuit.aiReview?.warnings ?? [], uncertainItems: circuit.aiReview?.uncertainItems ?? [], model: circuit.generatedByModel ?? "unknown", preparation: circuit.aiReview?.preparation } : null);
    if (!circuit.sourceFileName) { setSourceFile(null); setBackgroundUrl(""); return; }
    let cancelled = false; const revision = ++sourceRevision.current;
    void api.diagramCircuitSource(circuit.id).then(blob => { if (!cancelled && sourceRevision.current === revision) { setSourceFile(new File([blob], circuit.sourceFileName!, { type: circuit.sourceMimeType ?? blob.type })); setBackgroundUrl(URL.createObjectURL(blob)); } }).catch(() => { if (!cancelled && sourceRevision.current === revision) setMessages(["Không tải lại được ảnh nguồn đã lưu."]); });
    return () => { cancelled = true; };
  }, [api, project?.id, circuit?.id]);

  useEffect(()=>{
    if(!sourceFile || !aiReview)return;
    let active=true;setComparisonPrepared(null);
    const alignment=aiReview.preparation;
    const candidate=alignment ? {...diagram,sourceCrop:alignment.crop,sourceTransform:{rotateClockwise:alignment.rotation ?? 0},reviewMetadata:{...diagram.reviewMetadata,sourceSha256:alignment.source.sha256}} : diagram;
    void prepareSourceForDiagram(sourceFile,candidate).then(value=>{if(active)setComparisonPrepared(value);}).catch(error=>{if(active)setMessages([error instanceof Error?error.message:'Không căn được ảnh nguồn.']);});
    return()=>{active=false;};
  },[sourceFile,aiReview?.preparation,diagram.canvas.width,diagram.canvas.height]);

  async function importExistingJson(file?: File) {
    const source=prepared?.source ?? sourceFile;
    if(!file || !source || aiRunning || jsonEditing)return;
    setAiRunning(true);setMessages([]);
    try{
      if(file.size>5*1024*1024)throw new Error('JSON tối đa 5 MB.');
      const parsed=validateDiagramInput(JSON.parse(await file.text()));if(!parsed.diagram)throw new Error(parsed.errors.join('; '));
      const aligned=await prepareSourceForDiagram(source,parsed.diagram,prepared);
      const next={...clone(parsed.diagram),reviewStatus:'draft' as const,...(project&&circuit?{id:project.vehicleId+'-'+circuit.circuitKey,vehicleId:project.vehicleId,vehicleTitle:project.vehicleTitle,circuitTitle:circuit.circuitTitle}:{})};
      const report=buildDiagramQualityReport(next,aligned.manifest);
      if(!report.canExport)throw new Error(report.issues.filter(i=>i.severity==='error').map(i=>i.message).join('; '));
      const review={warnings:report.issues.filter(i=>i.severity==='warning').map(i=>i.message),uncertainItems:[],model:'manual-json-import',preparation:aligned.manifest};
      ++sourceRevision.current;setSourceFile(source);setBackgroundUrl(URL.createObjectURL(source));setDiagram(next);setAiReview(review);setComparisonPrepared(aligned);setPendingImage(null);setPrepared(null);setDraftNeedsSave(Boolean(circuit));
      if(circuit){const saved=await api.saveDiagramCircuitDraft(circuit.id,source,{schema:next,...review,validationErrors:validateDiagram(next)});setDraftNeedsSave(false);onSaved?.(saved);}
    }catch(error){setMessages([error instanceof Error?error.message:'Không nạp được JSON.']);}finally{setAiRunning(false);}
  }

  function updateMetadata(field: "vehicleTitle" | "circuitTitle", value: string) {
    setDiagram(current => {
      const next = clone(current); next[field] = value;
      next.vehicleId = slugifyDiagramName(next.vehicleTitle, "vehicle-id");
      next.id = `${next.vehicleId}-${slugifyDiagramName(next.circuitTitle, "diagram")}`;
      return next;
    });
  }

  function loadImage(file?: File) {
    if (!file || jsonEditing || aiRunning) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessages(["Ảnh nguồn chỉ nhận JPG, PNG hoặc WebP."]); return; }
    setPendingImage(file); setImageVersion(v => v + 1); setPrepared(null); setMessages([]);
  }

  async function generateAiDraft() {
    if (!prepared || aiRunning || jsonEditing) return;
    if (aiReview && !window.confirm("Tạo lại sẽ gọi AI có phí và thay bản JSON hiện tại nếu thành công. Tiếp tục?")) return;
    const input = prepared;
    ++sourceRevision.current;
    setAiRunning(true); setMessages([]);
    try {
      const result = await api.generateDiagramDraft(input.clean); const parsed = validateDiagramInput(result.diagram);
      if (!parsed.diagram) { setMessages(["AI trả dữ liệu không đúng contract.", ...parsed.errors]); return; }
      if (parsed.diagram.canvas.width !== input.manifest.canvas.width || parsed.diagram.canvas.height !== input.manifest.canvas.height) throw new Error("Canvas AI không khớp ảnh đã chuẩn bị. Bản đang lưu chưa thay đổi.");
      const next = { ...clone(parsed.diagram!), sourceImage:input.source.name,sourceCrop:input.manifest.crop,sourceTransform:{rotateClockwise:input.manifest.rotation ?? 0},reviewMetadata:{...parsed.diagram.reviewMetadata,sourceSha256:input.manifest.source.sha256}, reviewStatus: "draft" as const, id: diagram.id, vehicleId: project?.vehicleId ?? diagram.vehicleId, vehicleTitle: project?.vehicleTitle ?? diagram.vehicleTitle, circuitTitle: circuit?.circuitTitle ?? diagram.circuitTitle };
      setSourceFile(input.source); setBackgroundUrl(URL.createObjectURL(input.source));
      setDiagram(next); const review = { warnings: result.warnings, uncertainItems: result.uncertainItems, model: result.model, preparation: input.manifest }; setAiReview(review);
      setPendingImage(null); setPrepared(null); setDraftNeedsSave(!!circuit);
      if (circuit) { const saved = await api.saveDiagramCircuitDraft(circuit.id, input.source, { schema: next, warnings: review.warnings, uncertainItems: review.uncertainItems, validationErrors: validateDiagram(next), model: review.model, preparation: review.preparation }); setDraftNeedsSave(false); onSaved?.(saved); }
    } catch (error) { setMessages([error instanceof Error ? error.message : "AI không tạo được draft."]); }
    finally { setAiRunning(false); }
  }

  async function saveManualJson(next: ElectricalDiagram, validationErrors: string[]) {
    if (!circuit || !sourceFile || !aiReview) throw new Error("Cần circuit và ảnh nguồn đã lưu để cập nhật JSON.");
    const saved = await api.saveDiagramCircuitDraft(circuit.id, sourceFile, { schema: next, warnings: aiReview.warnings, uncertainItems: aiReview.uncertainItems, validationErrors, model: aiReview.model, preparation: aiReview.preparation });
    setDraftNeedsSave(false); onSaved?.(saved);
  }

  async function retrySave() {
    if (aiRunning || jsonEditing) return;
    setAiRunning(true); setMessages([]);
    try { await saveManualJson(diagram, errors); }
    catch (error) { setMessages([error instanceof Error ? error.message : "Không lưu được draft."]); }
    finally { setAiRunning(false); }
  }

  async function exportDraftPackage() {
    if(!sourceFile || !aiReview || !comparisonPrepared || !diagram.components.length || aiRunning || jsonEditing)return;
    if(!quality.canExport){setMessages(['Sửa lỗi FAIL trước khi xuất.',...quality.issues.filter(i=>i.severity==='error').map(i=>i.message)]);return;}
    setAiRunning(true);setMessages([]);let root:ReturnType<typeof createRoot>|undefined,host:HTMLDivElement|undefined;
    try{
      const files:Record<string,Uint8Array>={[paths.json]:strToU8(realtimeJson),[paths.markdown]:strToU8(reviewMarkdown),[paths.image]:new Uint8Array(await sourceFile.arrayBuffer())};
      if(aiReview.preparation)files[paths.json.replace('.schema.json','.preparation.json')]=strToU8(JSON.stringify(aiReview.preparation,null,2));
      files[paths.json.replace('.schema.json','.review-report.json')]=strToU8(JSON.stringify(quality,null,2));
      await document.fonts.ready;host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-50000px',width:'1400px',visibility:'hidden'});document.body.append(host);root=createRoot(host);flushSync(()=>root!.render(createElement(DiagramPreview,{diagram})));
      const svg=host.querySelector('svg');if(!svg)throw new Error('Không dựng được preview.');const serialized=serializeDiagramSvg(svg,diagram.canvas);
      files[paths.json.replace('.schema.json','.svg')]=strToU8(serialized);files[paths.json.replace('.schema.json','.png')]=new Uint8Array(await(await diagramPngBlob(serialized,diagramPngSize(diagram.canvas))).arrayBuffer());
      const archive=zipSync(files,{level:6});const url=URL.createObjectURL(new Blob([new Uint8Array(archive).buffer],{type:'application/zip'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=paths.root+'--'+paths.circuit+'.diagram-draft.zip';anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){setMessages([error instanceof Error?error.message:'Không xuất được ZIP.']);}finally{root?.unmount();host?.remove();setAiRunning(false);}
  }

  function imageDrop(event: ReactDragEvent<HTMLElement>) { event.preventDefault(); loadImage(event.dataTransfer.files[0]); }

  return <section className="diagramStudioView diagramConverterView" onDragOver={event => event.preventDefault()} onDrop={imageDrop}>
    <input ref={jsonInputRef} hidden type="file" accept=".json,application/json" onChange={event=>{void importExistingJson(event.target.files?.[0]);event.target.value="";}}/>
    <div className="diagramStudioHead"><div>{onBack && <button type="button" className="diagramBack" disabled={jsonEditing || aiRunning} onClick={() => { if (!draftNeedsSave || window.confirm("Bản mới chưa lưu. Rời trang sẽ mất bản này. Tiếp tục?")) onBack(); }}>← Quay lại project</button>}<small>AI DRAFT · SỬA JSON THỦ CÔNG · HUMAN REVIEW</small><h1>{circuit?.circuitTitle ?? "DIAGRAM CONVERTER"}</h1><p>{project ? `${project.vehicleTitle} · ${circuit?.status}` : "Chọn ảnh, duyệt ảnh rồi tạo sơ đồ. Chỉ bước tạo sơ đồ mới dùng AI."}</p></div><div className="diagramStudioActions"><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { loadImage(event.target.files?.[0]); event.target.value = ""; }} /><button type="button" className="primary diagramGenerateButton" disabled={aiRunning || jsonEditing} onClick={() => imageInputRef.current?.click()}>{aiRunning ? "Đang xử lý và lưu…" : aiReview ? "Chọn ảnh để tạo lại" : "Upload ảnh"}</button><button type="button" disabled={(!sourceFile&&!prepared)||jsonEditing||aiRunning} onClick={()=>jsonInputRef.current?.click()}>Nạp JSON có sẵn</button><button type="button" disabled={!aiReview || !comparisonPrepared || jsonEditing || aiRunning || !quality.canExport} onClick={()=>void exportDraftPackage()}>Tải ZIP circuit</button></div></div>
    <section className="diagramQuickMetadata"><label>Mẫu xe<input value={diagram.vehicleTitle} disabled={!!project} placeholder="Ví dụ: Honda Vision K2C Smartkey" onChange={event => updateMetadata("vehicleTitle", event.target.value)} /></label><label>Tên sơ đồ<input value={diagram.circuitTitle} disabled={!!circuit} placeholder="Ví dụ: Mạch khởi động" onChange={event => updateMetadata("circuitTitle", event.target.value)} /></label><label>ECM ID <small>(hồ sơ review)</small><input value={ecmId} disabled={!!project} placeholder="Nhập đúng theo tài liệu" onChange={event => setEcmId(event.target.value)} /></label></section>
    <div className="diagramPackagePath">Folder output: <code>{paths.root}/{paths.circuit}/</code> · ID chung: <code>{diagram.id}</code></div>
    {messages.length > 0 && <section className="diagramValidationError" role="alert"><strong>Chưa thể thực hiện</strong><ul>{messages.map((message, index) => <li key={message + index}>{message}</li>)}</ul><button type="button" onClick={() => setMessages([])}>Đóng</button></section>}
    {pendingImage && <section className="diagramInlinePreparation">
      <DiagramImagePreparation key={imageVersion} file={pendingImage} busy={aiRunning} onPrepared={onPrepared}/>
      <p>Ảnh tốt thì giữ nguyên thiết lập. Chỉ nút tạo sơ đồ bên dưới mới gọi AI có phí; ảnh gốc vẫn được giữ để đối chiếu.</p>
      <div className="kitActions"><button type="button" className="primary" disabled={!prepared || aiRunning || jsonEditing} onClick={() => void generateAiDraft()}>Dùng ảnh này để tạo sơ đồ</button><button type="button" disabled={!prepared || aiRunning || jsonEditing} onClick={()=>jsonInputRef.current?.click()}>Dùng ảnh này để nạp JSON · không gọi AI</button><button type="button" disabled={aiRunning} onClick={() => { setPendingImage(null); setPrepared(null); setMessages([]); }}>Hủy chọn ảnh</button></div>
    </section>}
    {draftNeedsSave && <section className="diagramValidationError" role="status"><b>Bản mới chưa lưu vào project.</b><p>Giữ tab này hoặc tải ZIP. Lưu lại không gọi AI lần nữa.</p><button disabled={aiRunning || jsonEditing} onClick={() => void retrySave()}>Thử lưu lại · không gọi AI</button></section>}
    {comparisonPrepared && aiReview && <DiagramComparisonTools diagram={diagram} prepared={comparisonPrepared}/>}
    <section className="diagramConverterGrid">
      <article className="diagramConverterColumn diagramSourceResult"><header><b>1. Ảnh nguồn đã upload</b><span>{sourceFile ? aiReview?.preparation ? `${aiReview.preparation.source.width} × ${aiReview.preparation.source.height}px · ảnh gốc` : "Ảnh nguồn đã lưu" : "Chưa chọn ảnh"}</span></header><div className="diagramUploadedImage">{backgroundUrl ? <img src={backgroundUrl} alt="Ảnh sơ đồ nguồn đã upload" /> : <button type="button" onClick={() => imageInputRef.current?.click()}>Thả ảnh vào đây hoặc bấm để chọn</button>}</div></article>
      <article className="diagramConverterColumn diagramOutputResult"><header><b>2. JSON draft & Preview</b><span>{aiRunning ? "Đang xử lý" : aiReview ? `${diagram.components.length} component · ${diagram.wires.length} wire` : "Chờ AI"}</span></header>{aiRunning ? <div className="diagramAiLoading" role="status"><span className="diagramSpinner" /><b>{draftNeedsSave ? "Đang lưu draft · không gọi AI…" : "AI đang đọc symbol, terminal và wire…"}</b><p>Ảnh phức tạp có thể mất hơn một phút. Không đóng trang.</p><div className="diagramLoadingBar"><i /></div></div> : aiReview ? <div className="diagramDraftOutput">{!pendingImage && <DiagramJsonEditor diagram={diagram} canSave={!!circuit && !!sourceFile} onPreview={setDiagram} onSave={saveManualJson} onEditingChange={setJsonEditing} />}{pendingImage && <p>Hủy chọn ảnh để quay lại sửa JSON đang có.</p>}<details className="diagramMarkdownArtifact"><summary>Markdown review · hồ sơ đối chiếu cho Dev/Codex</summary><pre>{reviewMarkdown}</pre></details><section className="diagramAiReview"><header><b>Model tạo bản gốc · {aiReview.model}</b><span>Bắt buộc human review</span></header>{aiReview.warnings.length > 0 && <div><strong>Cảnh báo AI ban đầu</strong><ul>{aiReview.warnings.map(item => <li key={item}>{item}</li>)}</ul></div>}{aiReview.uncertainItems.length > 0 && <div><strong>Điểm chưa chắc chắn</strong><ul>{aiReview.uncertainItems.map(item => <li key={item}>{item}</li>)}</ul></div>}</section></div> : <div className="diagramDraftEmpty"><b>Draft sẽ xuất hiện tại đây</b><p>Chọn ảnh, kiểm tra vùng cần đọc rồi bấm “Dùng ảnh này để tạo sơ đồ”.</p></div>}</article>
    </section>
  </section>;
}

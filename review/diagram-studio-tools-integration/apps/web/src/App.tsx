import { ProductionWorklogForm, ProductionWorklogTag, ProductionLotCreatedDate, type ProductionWorklogInput } from './ProductionWorklogForm';
import { ProductionRegistration } from './ProductionRegistration';
import { ProductionStatusFilter, filterProductionLots, type ProductionStatusFilterId } from './ProductionStatusFilter';
import { MaterialPurchaseState } from './MaterialPurchaseState';
import { ProductionSchedule } from './ProductionSchedule';
import { ProductionReportWarnings } from './ProductionReportWarnings';
import { PerformanceBoard } from './PerformanceBoard';
import { isFailedTask, TaskFailedReview } from './TaskFailedReview';
import { AvatarContent, MemberAvatarProvider, MemberAvatarManager } from './MemberAvatars';
import { ChangeEvent, Fragment, FormEvent, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ProductionPayments } from './ProductionPayments';
import { classifyTaskTitle, TaskTopicTitle, TaskPriorityCell, TaskListColumnLabels, TaskPriorityFilter, taskMatchesPriority } from './TaskClassification';
import {
  Api,
  ApiError,
  ActivationPaymentStatus,
  ActivationProduct,
  ActivationRecord,
  AppNotification,
  BomAudit,
  FinishedProduct,
  FinishedProductCategory,
  FinishedProductTransaction,
  FinishedProductTransactionType,
  InventoryAudit,
  InventoryImageOwnerType,
  InventoryItem,
  InventoryBomKind,
  InventoryTransaction,
  InventoryTransactionType,
  InventoryUnit,
  MaterialPlan,
  login,
  OnlineMember,
  PurchaseRequest,
  ProductionEntry,
  ProductionModule,
  ProductionLot,
  ProductionLotDeletePreview,
  ProductionLotImpact,
  ProductionOverview,
  ProductionReportItem,
  SellableProduct,
  StockCountLine,
  StockCountSheet,
  SharedDocument,
  Task,
  TaskDetail,
  TaskDraft,
  User,
  Worklog,
  WorklogComment,
  WorklogDashboard,
  WorklogOutputCriterion,
  WorklogSummary,
  WorklogStatus,
  WorklogType,
  WorklogValueLevel,
  WarrantyCase,
  WarrantyCaseInput,
  WarrantyStatus,
} from "./api";
import { buildProductCapacityCsv, calculateProductCapacity } from "./product-capacity";
import { DiagramProjectManagerView } from "./diagram-studio/DiagramProjectManagerView";
import { PcbLayoutView } from "./PcbLayoutView";

const FINISHED_PRODUCT_CATEGORIES: FinishedProductCategory[] = ["PCB", "CABLE", "DEVICE", "OTHER"];
const FINISHED_PRODUCT_CATEGORY_LABELS: Record<FinishedProductCategory,string> = {
  PCB: "PCB / BOARD",
  CABLE: "CÁP",
  DEVICE: "HỘP TB",
  OTHER: "KHÁC",
};

export function finishedProductsForCategory(products:FinishedProduct[],category:"ALL"|FinishedProductCategory){
  return category==="ALL"?products:products.filter(product=>product.category===category);
}

export function canCompleteProductionLot(user:Pick<User,'id'|'role'>,lot:Pick<ProductionLot,'participants'>|null){
  return user.role==='ADMIN'||Boolean(lot?.participants.some(person=>person.id===user.id));
}
export function canDeleteProductionLot(user:Pick<User,'role'>){return user.role==='ADMIN';}

type Session = { accessToken: string; user: User };
export type View =
  | "drafts"
  | "trash"
  | "truck"
  | "document"
  | "scoreboard"
  | "worklogs"
  | "warranty"
  | "materials"
  | "products"
  | "sellableProducts"
  | "stockCount"
  | "purchasing"
  | "production"
  | "diagramStudio"
  | "pcbLayout"
  | "activation";
type TaskStockFilter = "backlog" | "active" | "review" | "failed" | "complete";
export const VIEW_HASHES: Record<View, string> = {
  drafts: "#/backlog",
  trash: "#/task",
  truck: "#/xe-rac",
  document: "#/document",
  scoreboard: "#/bang-diem",
  worklogs: "#/worklog",
  warranty: "#/bao-hanh",
  materials: "#/kho-vat-tu",
  products: "#/kho-thanh-pham",
  sellableProducts: "#/kho-san-pham",
  stockCount: "#/kiem-kho",
  purchasing: "#/mua-hang",
  production: "#/san-xuat",
  diagramStudio: "#/diagram-studio",
  pcbLayout: "#/pcb-layout",
  activation: "#/sale-orders/ma-kich-hoat",
};
export function viewFromHash(hash: string): View {
  if (hash === "#/thung-rac") return "trash";
  if (hash.startsWith("#/worklog")) return "worklogs";
  return (Object.entries(VIEW_HASHES).find(([, route]) => route === hash)?.[0] as View | undefined) ?? "worklogs";
}
export function viewNeedsAppData(view: View) { return view !== "diagramStudio" && view !== "pcbLayout"; }
const WORKLOG_SPRINT_ANCHOR = "2026-08-17";
export type SprintGoalItem = { text:string; assigneeIds:string[] };
type SprintGoalPayload = { v:1; g:Array<{ t:string; u?:string[] }> };

export function parseSprintGoals(value:string|null|undefined):SprintGoalItem[]{
  const source=value?.trim();
  if(!source)return [];
  try{
    const parsed=JSON.parse(source) as Partial<SprintGoalPayload>;
    if(parsed.v===1&&Array.isArray(parsed.g))return parsed.g
      .filter(item=>item&&typeof item.t==='string'&&item.t.trim())
      .map(item=>({text:item.t.trim(),assigneeIds:Array.isArray(item.u)?item.u.filter(id=>typeof id==='string'):[]}));
  }catch{/* Legacy Goal is plain text. */}
  return source.split(/\r?\n/).map(line=>line.replace(/^\s*(?:[-*]|\d+[.)])\s*/,"").trim()).filter(Boolean).map(text=>({text,assigneeIds:[]}));
}

export function serializeSprintGoals(items:SprintGoalItem[]):string{
  const goals=items.map(item=>({t:item.text.trim(),u:[...new Set(item.assigneeIds)]})).filter(item=>item.t);
  if(!goals.length)return "";
  return JSON.stringify({v:1,g:goals.map(item=>item.u.length?item:{t:item.t})} satisfies SprintGoalPayload);
}
function dateAtNoon(value: string) { return new Date(`${value}T12:00:00+07:00`); }
function addLocalDays(value: string, days: number) {
  const date = dateAtNoon(value);
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function worklogSprintStart(value: string) {
  const diffDays = Math.floor((dateAtNoon(value).getTime() - dateAtNoon(WORKLOG_SPRINT_ANCHOR).getTime()) / 86_400_000);
  return addLocalDays(WORKLOG_SPRINT_ANCHOR, Math.floor(diffDays / 14) * 14);
}
export function worklogSprintNumber(start: string) {
  return Math.floor((dateAtNoon(start).getTime() - dateAtNoon(WORKLOG_SPRINT_ANCHOR).getTime()) / (14 * 86_400_000)) + 1;
}
function worklogSprintLabel(start: string) {
  const number = worklogSprintNumber(start);
  return number > 0 ? `Sprint ${number}` : "Trước Sprint 1";
}
function worklogSprintFromHash(hash: string) {
  const match = hash.match(/^#\/worklog\/sprint\/(\d{4}-\d{2}-\d{2})$/);
  return match && worklogSprintStart(match[1]) === match[1] ? match[1] : worklogSprintStart(currentVietnamDate());
}
function worklogSprintRoute(start: string) { return `#/worklog/sprint/${start}`; }
export function worklogSprintCreateState(start:string,status:"OPEN"|"CLOSED",today=currentVietnamDate()){
  if(status==="CLOSED")return {enabled:false,label:"SPRINT ĐÃ CHỐT"};
  const current=worklogSprintStart(today);
  if(start<current)return {enabled:false,label:"SPRINT ĐÃ QUA"};
  if(start>current)return {enabled:false,label:"CHƯA BẮT ĐẦU"};
  return {enabled:true,label:"＋ Worklog"};
}
function worklogSprintOptions() {
  const current = worklogSprintNumber(worklogSprintStart(currentVietnamDate()));
  return Array.from({ length: Math.max(7, current + 3) }, (_, index) => addLocalDays(WORKLOG_SPRINT_ANCHOR, (index - 1) * 14));
}
export function taskStockFilterForView(view: View): TaskStockFilter {
  if (view === "truck") return "complete";
  if (view === "drafts") return "backlog";
  return "active";
}
const SESSION_KEY = "auto2tech.session";
const AVATAR_COLORS = [
  "#365c4d",
  "#536b8d",
  "#8a5b3d",
  "#7a526f",
  "#476b72",
  "#6e6843",
  "#76534b",
  "#4f5f79",
];
const MEMBER_COLORS: Record<string, string> = {
  THẮNG: "#0066ff",
  VINH: "#f97316",
  PHÚ: "#9333ea",
  GIANG: "#16a34a",
  ADMIN: "#374151",
};
const NEUTRAL_TOPIC_COLOR = { backgroundColor: "#eef1f4", color: "#5f6368" };
const TOPIC_KEYWORD_COLORS = [
  { keywords: ["keybox", "key box"], color: { backgroundColor: "#eeeaf7", color: "#65558f" } },
  { keywords: ["keyscan", "key scan"], color: { backgroundColor: "#e2f1e8", color: "#397057" } },
  { keywords: ["easyscan", "easy scan"], color: { backgroundColor: "#e8f0fe", color: "#315b91" } },
  { keywords: ["scanbox", "scan box"], color: { backgroundColor: "#f7eadf", color: "#8a5738" } },
  { keywords: ["san xuat"], color: { backgroundColor: "#e1eff1", color: "#3f6b70" } },
  { keywords: ["bao hanh"], color: { backgroundColor: "#f5e7ec", color: "#89566a" } },
];
export const RECENT_STOCK_COUNT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function avatarColor(id: string, displayName = "") {
  const fixed = MEMBER_COLORS[displayName.trim().toLocaleUpperCase("vi")];
  if (fixed) return fixed;
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
export function topicColor(topic: string) {
  const key = normalizeMaterialSearch(topic);
  return TOPIC_KEYWORD_COLORS.find((group) => group.keywords.some((keyword) => key.includes(keyword)))?.color ?? NEUTRAL_TOPIC_COLOR;
}
const WARRANTY_PRODUCT_FALLBACK_COLORS = [
  { backgroundColor: "#e8f0fe", color: "#315b91" },
  { backgroundColor: "#e2f1e8", color: "#397057" },
  { backgroundColor: "#f7eadf", color: "#8a5738" },
  { backgroundColor: "#eeeaf7", color: "#65558f" },
];
const WARRANTY_PRODUCT_FIXED_COLORS = [
  { keywords: ["scanbox", "scan box"], color: { backgroundColor: "#dbeafe", color: "#1d4ed8" } },
  { keywords: ["scanpro", "scan pro"], color: { backgroundColor: "#dcfce7", color: "#15803d" } },
  { keywords: ["easyscan", "easy scan", "easycan", "easy can"], color: { backgroundColor: "#fff0d6", color: "#b45309" } },
];
export function warrantyProductColor(productName: string) {
  const key = normalizeMaterialSearch(productName);
  const warrantyColor = WARRANTY_PRODUCT_FIXED_COLORS.find((group) => group.keywords.some((keyword) => key.includes(keyword)))?.color;
  if (warrantyColor) return warrantyColor;
  const fixedColor = topicColor(productName);
  if (fixedColor !== NEUTRAL_TOPIC_COLOR) return fixedColor;
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return WARRANTY_PRODUCT_FALLBACK_COLORS[hash % WARRANTY_PRODUCT_FALLBACK_COLORS.length];
}
export function taskMatchesAssignee(task: Pick<Task, "assignees"> | Pick<TaskDraft, "assigneeIds">, userId: string) {
  if (!userId) return true;
  return "assigneeIds" in task
    ? task.assigneeIds.includes(userId)
    : task.assignees.some((assignment) => assignment.userId === userId);
}
export function canDoneTask(task: Task, userId: string, admin: boolean) {
  return (
    task.status === "ACTIVE" &&
    (admin || task.assignees.some((a) => a.userId === userId))
  );
}

function taskStatusLabel(status: Task["status"]) {
  if (status === "ACTIVE") return "ĐANG LÀM";
  if (status === "DONE") return "CHỜ REVIEW";
  return status;
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatCompletedDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

export function isRecentlyCounted(lastCountedAt: string | null, now = Date.now()) {
  if (!lastCountedAt) return false;
  const countedAt = Date.parse(lastCountedAt);
  const age = now - countedAt;
  return Number.isFinite(countedAt) && age >= 0 && age <= RECENT_STOCK_COUNT_WINDOW_MS;
}

export function formatRecentCountTime(lastCountedAt: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(lastCountedAt)) / 60000));
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const INVENTORY_AUDIT_LABELS: Record<string, string> = {
  name: "tên vật tư",
  groupName: "nhóm",
  sku: "SKU",
  bomKind: "loại cấu thành",
  location: "vị trí",
  unit: "đơn vị",
  minimumStock: "mức dự trữ",
  price: "giá",
  purchaseUrl: "link mua",
  purchaseLinks: "link mua",
  note: "ghi chú",
  isActive: "trạng thái",
};

export function inventoryItemMissingLocation(item: Pick<InventoryItem, "location">) {
  return !item.location?.trim();
}

export function inventoryAuditDescription(changes: InventoryAudit["changes"]) {
  if (changes.checkAssignedToId) return "Đã giao kiểm tồn thực tế";
  const labels = Array.from(new Set(Object.keys(changes).map((key) => INVENTORY_AUDIT_LABELS[key] ?? "thông tin khác")));
  if (!labels.length) return "Đã cập nhật thông tin vật tư";
  return `Đã cập nhật ${labels.join(", ")}`;
}

export function AssigneeOrderPicker({ people, previousPeople = [], selected, onChange }: { people: User[]; previousPeople?: User[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const unavailable = previousPeople.filter(person => selected.includes(person.id) && !people.some(active => active.id === person.id));
  return <fieldset className="assigneePicker"><legend>Ai làm?</legend>{[...people, ...unavailable].map((person) => {
    const position = selected.indexOf(person.id);
    const checked = position >= 0;
    return <label key={person.id} className={checked ? "selectedAssignee" : ""}>
      <input type="checkbox" checked={checked} disabled={!checked && selected.length >= 3} onChange={() => onChange(checked ? selected.filter((id) => id !== person.id) : [...selected, person.id])}/>
      <span>{person.displayName}</span>
      {unavailable.some(item => item.id === person.id) && <small>Không còn trong danh sách giao việc · có thể bỏ chọn</small>}
      {checked && <b>Đã chọn</b>}
    </label>;
  })}</fieldset>;
}

function CriteriaEditor({ values, onChange, required = true }: { values: string[]; onChange: (values: string[]) => void; required?: boolean }) {
  return <div className="criteriaEditor"><div className="criteriaHead"><b>Checklist</b><button type="button" onClick={() => onChange([...values, ""])}>＋ Thêm mục</button></div>
    {values.map((value, index) => <div className="criterionInput" key={index}><span>☐</span><input value={value} maxLength={500} required={required} placeholder="Kết quả có thể kiểm tra được" onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}/>{values.length > 1 && <button type="button" aria-label="Xóa kết quả" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div>)}
  </div>;
}

const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "đã tạo task",
  EDITED: "đã cập nhật task",
  ASSIGNED: "đã giao task",
  RISK_REPORTED: "đã báo nguy cơ trễ",
  DONE: "đã báo Done",
  REVIEWED: "đã gửi Task chờ review",
  REOPENED: "đã mở lại task",
  COMPLETED: "đã Complete task",
  DELETED: "đã xóa task",
  ARCHIVED: "đã Archive task",
};

function LinkedText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part)
      ? <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>
      : part,
  )}</>;
}

export function TaskAssigneeQuickEdit({task,people,editable,onChange}:{task:Task;people:User[];editable:boolean;onChange:(ids:string[])=>void}) {
  const ids=task.assignees.map(assignment=>assignment.userId);
  const avatars=<div className="assigneeAvatars">{!ids.length&&<span>Chưa giao</span>}{task.assignees.map(assignment=><span className="avatar" style={{backgroundColor:avatarColor(assignment.userId,assignment.user.displayName)}} title={assignment.user.displayName} key={assignment.userId}><AvatarContent userId={assignment.userId} name={assignment.user.displayName}/></span>)}</div>;
  if(!editable)return avatars;
  return <details className="taskAssigneeQuick" onClick={event=>event.stopPropagation()}><summary aria-label={`Sửa người phụ trách ${task.title}`}>{avatars}</summary><div>{people.map(person=>{const selected=ids.includes(person.id);return <button type="button" className={selected?'selected':''} key={person.id} disabled={!selected&&ids.length>=3} onClick={()=>onChange(selected?ids.filter(id=>id!==person.id):[...ids,person.id])}><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span><b>{person.displayName}</b><em>{selected?'✓':''}</em></button>})}</div></details>;
}

type TaskQuickStatus = "BACKLOG"|"ACTIVE"|"DONE"|"COMPLETE"|"FAILED";
export function TaskStatusQuickEdit({task,admin,currentUserId,busy=false,onChange}:{task:Task;admin:boolean;currentUserId:string;busy?:boolean;onChange:(status:TaskQuickStatus)=>void}){
  const assigned=task.assignees.some(assignment=>assignment.userId===currentUserId);
  const options:Array<[TaskQuickStatus,string]>=[];
  if(admin)options.push(["BACKLOG","BACKLOG"],["ACTIVE","ĐANG LÀM"],["DONE","CHỜ REVIEW"],["FAILED","KHÔNG ĐẠT"],["COMPLETE","HOÀN THÀNH"]);
  else if(task.status==="BACKLOG")options.push(["BACKLOG","BACKLOG"],["ACTIVE","ĐANG LÀM"]);
  else if(task.status==="ACTIVE"){options.push(["ACTIVE","ĐANG LÀM"]);if(assigned)options.push(["DONE","CHỜ REVIEW"]);}
  else if(task.status==="DONE")options.push(isFailedTask(task)?["FAILED","KHÔNG ĐẠT"]:["DONE","CHỜ REVIEW"]);
  else options.push(["COMPLETE","HOÀN THÀNH"]);
  return <select className={`taskStatusQuick ${task.status.toLowerCase()}`} aria-label={`Đổi trạng thái ${task.title}`} value={isFailedTask(task)?'FAILED':task.status} disabled={busy||options.length===1} onClick={event=>event.stopPropagation()} onChange={event=>onChange(event.target.value as TaskQuickStatus)}>{options.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>;
}

function TaskCommentImage({api,imageUrl,author}:{api:Api;imageUrl:string;author:string}) {
  const [src,setSrc]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void api.taskCommentImage(imageUrl).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[api,imageUrl]);
  return src?<a href={src} target="_blank" rel="noreferrer"><img className="taskCommentImage" src={src} alt={`Ảnh do ${author} đính kèm`}/></a>:<small className="taskCommentImageLoading">Đang tải ảnh…</small>;
}

function WorklogCommentImage({api,imageUrl,author}:{api:Api;imageUrl:string;author:string}) {
  const [src,setSrc]=useState<string|null>(null);
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void api.worklogCommentImage(imageUrl).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[api,imageUrl]);
  return src?<a href={src} target="_blank" rel="noreferrer"><img className="taskCommentImage" src={src} alt={`Ảnh do ${author} đính kèm`}/></a>:<small className="taskCommentImageLoading">Đang tải ảnh…</small>;
}

function OnlineMembers({people}:{people:OnlineMember[]}) {
  if(!people.length)return null;
  return <div className="onlineMembers" aria-label={`${people.length} thành viên đang online`}><small>ONLINE</small><div>{people.slice(0,6).map(person=><span className="onlineAvatar" title={`${person.displayName} · Online`} aria-label={`${person.displayName} đang online`} style={{backgroundColor:avatarColor(person.id,person.displayName)}} key={person.id}><AvatarContent userId={person.id} name={person.displayName}/><i/></span>)}{people.length>6&&<b>+{people.length-6}</b>}</div></div>;
}

function TaskDetailModal({ api, taskId, people, onClose }: { api: Api; taskId: string; people: User[]; onClose: () => void }) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [body, setBody] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadDetail = useCallback(async () => {
    try { setDetail(await api.taskDetail(taskId)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Không tải được task"); }
  }, [api, taskId]);
  useEffect(() => {
    void loadDetail();
    const socket = api.connect(() => void loadDetail());
    return () => { socket.disconnect(); };
  }, [api, loadDetail]);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  const mentionQuery = body.match(/@([^@\s]*)$/)?.[1]?.toLocaleLowerCase("vi");
  const suggestions = mentionQuery === undefined ? [] : people.filter((person) =>
    person.displayName.toLocaleLowerCase("vi").includes(mentionQuery),
  );
  function chooseMention(person: User) {
    setBody((current) => current.replace(/@([^@\s]*)$/, `@${person.displayName} `));
    setMentionedIds((current) => current.includes(person.id) ? current : [...current, person.id]);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if ((!text && !image) || busy) return;
    setBusy(true);
    try {
      const activeMentions = mentionedIds.filter((id) => {
        const person = people.find((candidate) => candidate.id === id);
        return person && text.includes(`@${person.displayName}`);
      });
      await api.commentTask(taskId, { body: text, mentionedUserIds: activeMentions, image });
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setBody(""); setMentionedIds([]); setImage(null); setImagePreview(null); await loadDetail();
    } catch (err) { setError(err instanceof Error ? err.message : "Không gửi được comment"); }
    finally { setBusy(false); }
  }
  const worklogHours = detail?.worklogs.reduce((sum, worklog) => sum + Number(worklog.hoursWorked ?? 0), 0) ?? 0;
  const doneWorklogHours = detail?.worklogs.reduce((sum, worklog) => sum + (worklog.status === "DONE" ? Number(worklog.hoursWorked ?? 0) : 0), 0) ?? 0;
  const endedWorklogHours = detail?.worklogs.reduce((sum, worklog) => sum + (worklog.status === "ENDED" ? Number(worklog.hoursWorked ?? 0) : 0), 0) ?? 0;
  const openWorklogs = detail?.worklogs.filter((worklog) => worklog.status === "OPEN" || worklog.status === "BACKLOG").length ?? 0;
  const worklogDays = new Set(detail?.worklogs.map((worklog) => currentVietnamDate(new Date(worklog.startedAt))) ?? []).size;
  const worklogMembers = Array.from(new Map((detail?.worklogs ?? []).map((worklog) => [worklog.user.id, worklog.user])).values());
  return <div className="overlay taskDetailOverlay" onMouseDown={onClose}>
    <section className="taskDetailModal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modalClose" aria-label="Đóng" onClick={onClose}>×</button>
      {!detail ? <p>Đang tải...</p> : <>
        <header className="taskDetailHeader">
          <div><b className="taskTopic" style={topicColor(detail.task.title)}>{detail.task.title}</b><h2>{detail.task.note}</h2></div>
          <span>{taskStatusLabel(detail.task.status)}</span>
        </header>
        <div className="taskDetailMeta">
          <span>{detail.task.criteria.length} Checklist</span>
          <div className="assigneeAvatars">{detail.task.assignees.map((assignment) => <span className="avatar" style={{backgroundColor:avatarColor(assignment.userId, assignment.user.displayName)}} title={assignment.user.displayName} key={assignment.userId}><AvatarContent userId={assignment.userId} name={assignment.user.displayName}/></span>)}</div>
        </div>
        <div className="taskDetailBody"><div className="taskDetailScroll">
        {detail.task.suggestion && <section className="taskSuggestion"><b>GỢI Ý / TÀI LIỆU</b><p><LinkedText text={detail.task.suggestion}/></p></section>}
        <section className="taskCriteria"><div><b>CHECKLIST</b><small>Dùng để đọc và plan, không chặn Complete</small></div>
          {detail.task.criteria.map((criterion) => <p key={criterion.id}><span>•</span>{criterion.text}</p>)}
        </section>
        <section className="taskWorklogProgress">
          <header><div><b>TIẾN ĐỘ WORKLOG</b><small>{worklogDays} ngày hoạt động · {openWorklogs} Worklog đang mở</small></div><div className="assigneeAvatars">{worklogMembers.map((member) => <span className="avatar" style={{backgroundColor:avatarColor(member.id, member.displayName)}} title={member.displayName} key={member.id}><AvatarContent userId={member.id} name={member.displayName}/></span>)}</div></header>
          <dl><div><dt>Worklog</dt><dd>{detail.worklogs.length}</dd></div><div><dt>Tổng H</dt><dd>{worklogHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</dd></div><div><dt>DONE</dt><dd>{doneWorklogHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</dd></div><div><dt>Chưa đạt</dt><dd>{endedWorklogHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</dd></div></dl>
        </section>
        <section className="taskWorklogs"><div><b>WORKLOG LIÊN QUAN</b><small>{detail.worklogs.length} log · {worklogHours.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</small></div>
          {detail.worklogs.map((worklog) => <article key={worklog.id}>
            <span className="avatar" style={{ backgroundColor: avatarColor(worklog.userId, worklog.user.displayName) }}><AvatarContent userId={worklog.userId} name={worklog.user.displayName}/></span>
            <div><b className="taskWorklogTitle">{worklog.input}</b><p className="taskWorklogMeta">{worklog.user.displayName} · {worklogDate(worklog.startedAt)}</p>{latestWorklogReport(worklog) && <small><WorklogOutputText value={latestWorklogReport(worklog)}/></small>}</div>
            <strong>{worklog.hoursWorked ? `${Number(worklog.hoursWorked).toLocaleString("vi-VN")}h` : "—"}</strong>
          </article>)}
          {!detail.worklogs.length && <p className="taskWorklogsEmpty">Chưa có Worklog gắn với Task này.</p>}
        </section>
        </div><aside className="taskDetailComments">
        <header><div><b>TRAO ĐỔI</b><small>Comment, cập nhật và lịch sử Task</small></div><span>{detail.timeline.filter(item=>item.kind==="COMMENT").length} comment</span></header>
        {error && <div className="commentError">{error}</div>}
        <div className="taskTimeline">
          {detail.timeline.length === 0 && <p>Chưa có cập nhật.</p>}
          {detail.timeline.map((item) => item.kind === "ACTIVITY" ?
            <div className="timelineActivity" key={`activity-${item.id}`}><b>{item.actor.displayName}</b> {ACTIVITY_LABELS[item.type] ?? item.type}<time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></div> :
            <div className="timelineComment" key={`comment-${item.id}`}>
              <span className="avatar" style={{backgroundColor:avatarColor(item.author.id,item.author.displayName)}}><AvatarContent userId={item.author.id} name={item.author.displayName}/></span>
              <div><b>{item.author.displayName}</b><time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time>{item.body&&<p><LinkedText text={item.body}/></p>}{item.imageUrl&&<TaskCommentImage api={api} imageUrl={item.imageUrl} author={item.author.displayName}/>}</div>
            </div>,
          )}
        </div>
        {detail.canComment ? <form className="commentComposer" onSubmit={(event) => void submit(event)}>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} placeholder="Viết comment, gõ @ để tag thành viên..." />
          {imagePreview&&<div className="commentImagePreview"><img src={imagePreview} alt="Ảnh chuẩn bị gửi"/><button type="button" onClick={()=>{URL.revokeObjectURL(imagePreview);setImage(null);setImagePreview(null);}}>×</button></div>}
          {suggestions.length > 0 && <div className="mentionSuggestions">{suggestions.map((person) => <button type="button" key={person.id} onClick={() => chooseMention(person)}><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span>{person.displayName}</button>)}</div>}
          <div><label className="commentImageButton">＋ Ảnh<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0]??null;if(!file)return;if(file.size>2*1024*1024){setError("Ảnh tối đa 2 MB");event.target.value="";return;}if(imagePreview)URL.revokeObjectURL(imagePreview);setImage(file);setImagePreview(URL.createObjectURL(file));setError("");}}/></label><small>JPEG, PNG, WebP · tối đa 2 MB</small><button className="primary" disabled={(!body.trim()&&!image) || busy}>{busy ? "Đang gửi..." : "Gửi"}</button></div>
        </form> : <p className="commentLocked">Task đã Complete — lịch sử chỉ đọc.</p>}
        </aside></div>
      </>}
    </section>
  </div>;
}

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00Z`);
}
function workingDaysBetween(startExclusive: string, endInclusive: string) {
  let count = 0;
  const cursor = dateFromIso(startExclusive);
  const end = dateFromIso(endInclusive);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0) count++;
  }
  return count;
}

export function urgency(
  dueDate: string,
  status: Task["status"],
  now = new Date(),
) {
  if (status === "DONE") return null;
  const today = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
  if (dueDate === today) return { label: "Due today", className: "today" };
  if (dueDate > today) {
    const days = workingDaysBetween(today, dueDate);
    return {
      label: `${days} day${days === 1 ? "" : "s"} left`,
      className: "future",
    };
  }
  const days = workingDaysBetween(dueDate, today);
  return {
    label: `${days} day${days === 1 ? "" : "s"} overdue`,
    className: "late",
  };
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      onLogin(
        await login(String(f.get("username")), String(f.get("password"))),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={submit} autoComplete="on">
        <strong>AUTO2TECH OS</strong>
        <h1>Dashboard</h1>
        <label>
          Tài khoản
          <input name="username" autoComplete="username" autoFocus required />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Đang vào..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

async function compressInventoryImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Ảnh gốc không được lớn hơn 10MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= 500 * 1024) break;
    }
    if (!blob || blob.size > 600 * 1024) throw new Error('Không thể nén ảnh xuống dưới 600KB. Hãy chọn ảnh đơn giản hơn.');
    return new File([blob], 'inventory.webp', { type: 'image/webp' });
  } finally {
    bitmap.close();
  }
}

function InventoryImagePanel({api,ownerType,ownerId,label,className='',onImageUpdated}:{api:Api;ownerType:InventoryImageOwnerType;ownerId:string;label:string;className?:string;onImageUpdated?:()=>void}) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [revision,setRevision]=useState(0);const [src,setSrc]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{let active=true;let objectUrl:string|null=null;void api.inventoryImage(ownerType,ownerId).then(blob=>{if(!active||!blob)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);}).catch(err=>{if(active)setError(err instanceof Error?err.message:'Không tải được ảnh.');});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[api,ownerType,ownerId,revision]);
  async function choose(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;if(src&&!window.confirm('Ảnh cũ sẽ bị xóa và thay bằng ảnh mới. Tiếp tục?'))return;setBusy(true);setError('');try{const compressed=await compressInventoryImage(file);await api.uploadInventoryImage(ownerType,ownerId,compressed);setRevision(value=>value+1);onImageUpdated?.();}catch(err){setError(err instanceof Error?err.message:'Không upload được ảnh.');}finally{setBusy(false);}}
  async function remove(){if(!window.confirm(`Xóa ảnh ${label.toLocaleLowerCase('vi')}?`))return;setBusy(true);setError('');try{await api.removeInventoryImage(ownerType,ownerId);setSrc(null);setRevision(value=>value+1);onImageUpdated?.();}catch(err){setError(err instanceof Error?err.message:'Không xóa được ảnh.');}finally{setBusy(false);}}
  return <section className={`itemImages inventoryImagePanel ${className}`}>
    {src?<button type="button" className="imageCurrentUpload" aria-label={`Đổi ${label.toLocaleLowerCase('vi')}`} title="Bấm để chọn ảnh mới" disabled={busy} onClick={()=>inputRef.current?.click()}><img src={src} alt={label}/></button>:<button type="button" className="imageEmptyUpload" disabled={busy} onClick={()=>inputRef.current?.click()}><span>{label}</span><small>{busy?'Đang xử lý...':'Bấm để upload · JPEG, PNG hoặc WebP'}</small></button>}
    <input ref={inputRef} className="inventoryImageInput" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>void choose(event)}/>
    {src&&<div className="imageActions"><button type="button" disabled={busy} onClick={()=>void remove()}>{busy?'Đang xử lý...':'Xóa'}</button></div>}
    {error&&<small className="imageError">{error}</small>}
  </section>;
}

function InventoryThumbnail({api,ownerType,ownerId,label,revision,className=""}:{api:Api;ownerType:InventoryImageOwnerType;ownerId:string;label:string;revision:number;className?:string}) {
  const rootRef=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  const [src,setSrc]=useState<string|null>(null);
  useEffect(()=>{const element=rootRef.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect();}},{rootMargin:"120px"});observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!visible)return;let active=true;let objectUrl:string|null=null;setSrc(null);void api.inventoryImage(ownerType,ownerId).then(blob=>{if(!active||!blob)return;objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);}).catch(()=>setSrc(null));return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[api,ownerType,ownerId,revision,visible]);
  return <div ref={rootRef} className={`inventoryThumbnail ${className}`}>{src?<img src={src} alt={label}/>:<span>Chưa có ảnh</span>}</div>;
}

export function InventoryView({
  api,
  items,
  products,
  sellableProducts,
  requests,
  people,
  admin,
  openStockCountSheets,
  onOpenStockCount,
  onUpdated,
  initialTab,
  focusItemId,
  onFocusConsumed,
}: {
  api: Api;
  items: InventoryItem[];
  products: FinishedProduct[];
  sellableProducts: SellableProduct[];
  requests: PurchaseRequest[];
  people: User[];
  admin: boolean;
  openStockCountSheets:number;
  onOpenStockCount:()=>void;
  onUpdated: () => Promise<void>;
  initialTab: "materials" | "products" | "sellableProducts";
  focusItemId?: string | null;
  onFocusConsumed?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [signal, setSignal] = useState<
    "all" | "low" | "count" | "recent" | "missingLocation" | "request" | "ordered"
  >("all");
  const [finishedCategory,setFinishedCategory]=useState<"ALL"|FinishedProductCategory>("ALL");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [countFocus, setCountFocus] = useState(0);
  const [focusError, setFocusError] = useState("");
  useEffect(() => {
    if (!focusItemId) return;
    const item = items.find(row => row.id === focusItemId);
    setFocusError(item ? "" : "Vật tư này không còn trong kho đang hoạt động.");
    if (item) { setSelectedItem(item); setCountFocus(value => value + 1); }
    onFocusConsumed?.();
  }, [focusItemId, items]);
  const [selectedProduct, setSelectedProduct] =
    useState<FinishedProduct | null>(null);
  const [selectedSellableProduct, setSelectedSellableProduct] = useState<SellableProduct | null>(null);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingSellableProduct, setAddingSellableProduct] = useState(false);
  const [planningMaterials, setPlanningMaterials] = useState(false);
  const [finishedImageRevision, setFinishedImageRevision] = useState(0);
  const [sellableImageRevision, setSellableImageRevision] = useState(0);
  const [bomAudit, setBomAudit] = useState<BomAudit | null>(null);
  useEffect(() => {
    if (selectedItem)
      setSelectedItem(
        items.find((item) => item.id === selectedItem.id) ?? null,
      );
  }, [items]);
  useEffect(() => {
    if (selectedProduct) setSelectedProduct(products.find((product) => product.id === selectedProduct.id) ?? null);
  }, [products]);
  useEffect(() => {
    if (selectedSellableProduct) setSelectedSellableProduct(sellableProducts.find((product) => product.id === selectedSellableProduct.id) ?? null);
  }, [sellableProducts]);
  useEffect(() => {
    if(initialTab!=="products")return;
    void api.bomAudit().then(setBomAudit).catch(()=>setBomAudit(null));
  }, [api,initialTab,items,products]);
  const requestedRequests = requests.filter(
    (request) => request.status === "REQUESTED",
  );
  const orderedRequests = requests.filter(
    (request) => request.status === "ORDERED",
  );
  const requestedIds = new Set(
    requestedRequests.map((request) => request.itemId),
  );
  const orderedByItem = new Map<string, number>();
  orderedRequests.forEach((request) =>
    orderedByItem.set(
      request.itemId,
      (orderedByItem.get(request.itemId) ?? 0) + Number(request.requestedQty),
    ),
  );
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    const filtered = items.filter(
      (item) =>
        (!q ||
          `${item.groupName} ${item.name} ${item.sku ?? ""} ${item.location ?? ""}`
            .toLocaleLowerCase("vi")
            .includes(q)) &&
        (signal === "all" ||
          (signal === "low" && item.isLowStock) ||
          (signal === "count" && item.needsCount) ||
          (signal === "recent" && isRecentlyCounted(item.lastCountedAt)) ||
          (signal === "missingLocation" && inventoryItemMissingLocation(item)) ||
          (signal === "request" && requestedIds.has(item.id)) ||
          (signal === "ordered" && orderedByItem.has(item.id))),
    );
    return signal === "recent"
      ? filtered.sort((a, b) => Date.parse(b.lastCountedAt!) - Date.parse(a.lastCountedAt!))
      : filtered;
  }, [items, query, signal, requests]);
  const low = items.filter((item) => item.isLowStock).length;
  const count = items.filter((item) => item.needsCount).length;
  const recentlyCounted = items.filter((item) => isRecentlyCounted(item.lastCountedAt));
  const missingLocation = items.filter(inventoryItemMissingLocation);
  return (
    <section className="inventory digitalInventory">
      <div className="inventoryHeading">
        <div>
          <h1>
            {initialTab === "materials" ? "KHO VẬT TƯ" : initialTab === "products" ? "KHO THÀNH PHẨM" : "KHO SẢN PHẨM"}
          </h1>
        </div>
        <div className="inventoryTools">
          {initialTab === "sellableProducts" && <button onClick={()=>setPlanningMaterials(true)}>Tính vật tư</button>}
          <button
            className="primary"
            onClick={() =>
              initialTab === "materials" ? setAddingMaterial(true) : initialTab === "products" ? setAddingProduct(true) : setAddingSellableProduct(true)
            }
          >
            ＋ Thêm {initialTab === "materials" ? "vật tư" : initialTab === "products" ? "thành phẩm" : "sản phẩm"}
          </button>
        </div>
      </div>
      {initialTab!=="materials"&&openStockCountSheets>0&&<button className="stockCountLink" onClick={onOpenStockCount}><span><b>CÓ {openStockCountSheets} PHIẾU KIỂM KHO CẦN XỬ LÝ</b><small>Mở submodule Kiểm kho để nhập hoặc chốt số thực tế.</small></span><strong>Xem phiếu →</strong></button>}
      {initialTab === "materials" ? (
        <>
          <div className="inventorySignals">
            <button
              className={signal === "low" ? "selected" : ""}
              onClick={() => setSignal(signal === "low" ? "all" : "low")}
            >
              <b>{low}</b>
              <span>SẮP HẾT</span>
            </button>
            <button
              className={signal === "count" ? "selected" : ""}
              onClick={() => setSignal(signal === "count" ? "all" : "count")}
            >
              <b>{count}</b>
              <span>CẦN KIỂM</span>
            </button>
            <button
              className={signal === "recent" ? "selected" : ""}
              onClick={() => setSignal(signal === "recent" ? "all" : "recent")}
            >
              <b>{recentlyCounted.length}</b>
              <span>MỚI KIỂM</span>
            </button>
            <button
              className={signal === "missingLocation" ? "selected" : ""}
              onClick={() => setSignal(signal === "missingLocation" ? "all" : "missingLocation")}
            >
              <b>{missingLocation.length}</b>
              <span>CHƯA VỊ TRÍ</span>
            </button>
            <button
              className={signal === "request" ? "selected" : ""}
              onClick={() =>
                setSignal(signal === "request" ? "all" : "request")
              }
            >
              <b>{requestedRequests.length}</b>
              <span>CHỜ MUA</span>
            </button>
            <button
              className={signal === "ordered" ? "selected" : ""}
              onClick={() =>
                setSignal(signal === "ordered" ? "all" : "ordered")
              }
            >
              <b>{orderedRequests.length}</b>
              <span>ĐANG MUA</span>
            </button>
            <input
              aria-label="Tìm vật tư"
              placeholder="Tên, SKU, vị trí..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="materialGrid" aria-label="Danh sách vật tư">
            {visible.map((item) => (
              <button
                type="button"
                className="materialCard"
                aria-label={`Chi tiết ${item.name}`}
                key={item.id}
                onClick={() => setSelectedItem(item)}
              >
                  <InventoryThumbnail api={api} ownerType="MATERIAL" ownerId={item.id} label={`Ảnh ${item.name}`} revision={0} className="materialCardThumbnail"/>
                <div className="materialCardBody">
                  <div className="materialCardIdentity">
                  <b>{item.name}</b>
                  <small>
                    {item.sku || item.id.slice(0, 8)} · {item.groupName}
                  </small>
                  </div>
                  <p className="materialCardLocation">{item.location || "Chưa có vị trí"}</p>
                <div className="itemSignals">
                  {item.isLowStock && (
                    <b className="stockSignal low">SẮP HẾT</b>
                  )}
                  {item.needsCount && (
                    <b className="stockSignal count">CẦN KIỂM</b>
                  )}
                  {isRecentlyCounted(item.lastCountedAt) && (
                    <b className="stockSignal recent">
                      MỚI KIỂM · {people.find((person) => person.id === item.lastCountedById)?.displayName ?? "Thành viên"} · {formatRecentCountTime(item.lastCountedAt!)}
                    </b>
                  )}
                  {requestedIds.has(item.id) && (
                    <b className="stockSignal count">CHỜ MUA</b>
                  )}
                  {orderedByItem.has(item.id) && (
                    <b className="stockSignal ordered">
                      ĐANG MUA +
                      {Number(orderedByItem.get(item.id)).toLocaleString(
                        "vi-VN",
                      )}
                    </b>
                  )}
                </div>
                <div className="materialCardStock">
                  <span>Tồn kho</span>
                  {item.onHandQty === null ? (
                    <b className="notNormalized">CHƯA KIỂM</b>
                  ) : (
                    <>
                      <strong>
                        {Number(item.onHandQty).toLocaleString("vi-VN")}
                      </strong>
                      <small>
                        {" "}
                        / tối thiểu{" "}
                        {Number(item.minimumStock).toLocaleString("vi-VN")} unit
                      </small>
                    </>
                  )}
                </div>
                <span className="materialCardAction">Xem chi tiết →</span>
                </div>
              </button>
            ))}
          </div>
          {!visible.length && (
            <p className="emptyList">Không có vật tư phù hợp.</p>
          )}
        </>
      ) : initialTab === "products" ? (
        <>
        {bomAudit&&<section className="bomAuditPanel">
          <div className="bomAuditHeader"><div><h2>CẤU HÌNH BOARD</h2><p>Ba Board dùng linh kiện từ Kho vật tư. Bấm Board để xem hoặc sửa Cấu thành.</p></div><b className={bomAudit.summary.total?"hasIssues":"clean"}>{bomAudit.summary.total} CẦN DOUBLE-CHECK</b></div>
          <div className="boardAuditGrid">{bomAudit.boards.map(board=><button key={board.key} onClick={()=>{const product=products.find(item=>item.id===board.productId);if(product)setSelectedProduct(product)}}><span>{board.name}</span><b>{board.configuredLines} vật tư</b><small>{board.totalUnits.toLocaleString("vi-VN")} unit / board · {board.issueCount} cảnh báo nguồn</small></button>)}</div>
          <details open={bomAudit.summary.total>0}><summary>Danh sách cần kiểm · Thiếu mã {bomAudit.summary.missing} · Trùng {bomAudit.summary.duplicates} · Chưa gán {bomAudit.summary.unassigned} · Nguồn lệch {bomAudit.summary.sourceConflicts}</summary><div className="bomIssueList">{bomAudit.issues.map((issue,index)=>{const material=issue.itemId?items.find(item=>item.id===issue.itemId):undefined;return <button type="button" disabled={!material} onClick={()=>material&&setSelectedItem(material)} key={`${issue.type}-${issue.itemId??issue.itemName}-${index}`}><b>{issue.itemName}</b><span>{issue.message}</span><small>{issue.boardKey??"KHO"}{issue.sourceSheet?` · ${issue.sourceSheet}${issue.sourceRow?` dòng ${issue.sourceRow}`:""}`:""}</small></button>})}{!bomAudit.issues.length&&<p>Không còn dòng cần double-check.</p>}</div></details>
        </section>}
        <div className="finishedCategoryFilters" aria-label="Lọc loại thành phẩm">
          <button className={finishedCategory==="ALL"?"selected":""} onClick={()=>setFinishedCategory("ALL")}>TẤT CẢ · {products.length}</button>
          {FINISHED_PRODUCT_CATEGORIES.map(category=><button className={finishedCategory===category?"selected":""} key={category} onClick={()=>setFinishedCategory(category)}>{FINISHED_PRODUCT_CATEGORY_LABELS[category]} · {products.filter(product=>product.category===category).length}</button>)}
        </div>
        <div className="finishedProductGroups">
          {FINISHED_PRODUCT_CATEGORIES.filter(category=>finishedCategory==="ALL"||finishedCategory===category).map(category=>{const groupedProducts=products.filter(product=>product.category===category);if(!groupedProducts.length)return null;return <section className="finishedProductGroup" id={`finished-group-${category.toLowerCase()}`} key={category}><header><div><em className={`finishedCategoryTag ${category.toLowerCase()}`}>{FINISHED_PRODUCT_CATEGORY_LABELS[category]}</em><span>{groupedProducts.length} thành phẩm</span></div></header><div className="finishedProductGrid">{groupedProducts.map(product=><article className={product.category==="PCB"?"boardProduct":""} key={product.id} role="button" tabIndex={0} aria-label={`Xem ${product.name}`} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedProduct(product);}}} onClick={()=>setSelectedProduct(product)}><InventoryThumbnail api={api} ownerType="FINISHED_PRODUCT" ownerId={product.id} label={`Ảnh ${product.name}`} revision={finishedImageRevision} className="finishedProductGridThumbnail"/><div><b>{product.name}</b><small>{product.bom.length} vật tư cấu thành</small></div><strong><small>Tồn kho</small><span>{Number(product.onHandQty).toLocaleString("vi-VN")} <small>unit</small></span></strong></article>)}</div></section>})}
          {!finishedProductsForCategory(products,finishedCategory).length&&<p className="emptyList">Không có thành phẩm thuộc nhóm này.</p>}
        </div>
        </>
      ) : (
        <div className="productGrid sellableProductGrid">
          {sellableProducts.map((product) => <article className="sellableProductCard" key={product.id} onClick={() => setSelectedSellableProduct(product)}><InventoryThumbnail api={api} ownerType="SELLABLE_PRODUCT" ownerId={product.id} label={`Ảnh ${product.name}`} revision={sellableImageRevision} className="sellableProductThumb"/><div className="sellableProductCardText"><b>{product.name}</b><small>{product.bom.length} thành phẩm · {product.materialBom.length} vật tư đóng gói</small><strong>{Number(product.onHandQty).toLocaleString("vi-VN")} bộ</strong></div></article>)}
          {!sellableProducts.length&&<p className="emptyList">Chưa có sản phẩm.</p>}
        </div>
      )}
      {addingMaterial && (
        <CreateMaterialModal
          api={api}
          onClose={() => setAddingMaterial(false)}
          onUpdated={onUpdated}
        />
      )}{" "}
      {focusError && <p role="alert">{focusError}</p>}
      {selectedItem && (
        <MaterialDetailModal
          api={api}
          key={selectedItem.id}
          item={selectedItem}
          countFocus={countFocus}
          requests={requests}
          finishedProducts={products}
          people={people}
          admin={admin}
          onClose={() => setSelectedItem(null)}
          onUpdated={onUpdated}
        />
      )}
      {addingProduct && (
        <CreateProductModal
          api={api}
          materials={items}
          finishedProducts={products}
          onClose={() => setAddingProduct(false)}
          onUpdated={onUpdated}
        />
      )}{" "}
      {addingSellableProduct&&<CreateSellableProductModal api={api} finishedProducts={products} inventoryItems={items} onClose={()=>setAddingSellableProduct(false)} onUpdated={onUpdated}/>} {selectedSellableProduct&&<SellableProductDetailModal api={api} product={selectedSellableProduct} finishedProducts={products} inventoryItems={items} people={people} admin={admin} onClose={()=>setSelectedSellableProduct(null)} onUpdated={onUpdated} onImageUpdated={()=>setSellableImageRevision(value=>value+1)}/>} {" "}
      {planningMaterials&&<MaterialPlanModal api={api} finishedProducts={products} sellableProducts={sellableProducts} onClose={()=>setPlanningMaterials(false)}/>} {" "}
      {selectedProduct && (
        <ProductDetailModal
          api={api}
          product={selectedProduct}
          materials={items}
          finishedProducts={products}
          people={people}
          admin={admin}
          onClose={() => setSelectedProduct(null)}
          onUpdated={async () => {
            await onUpdated();
            setSelectedProduct(null);
          }}
          onImageUpdated={()=>setFinishedImageRevision(value=>value+1)}
        />
      )}
    </section>
  );
}

function StockCountView({api,sheets,people,currentUser,admin,onUpdated}:{api:Api;sheets:StockCountSheet[];people:User[];currentUser:User;admin:boolean;onUpdated:()=>Promise<void>}){
  const [creating,setCreating]=useState(false);const [selected,setSelected]=useState<StockCountSheet|null>(null);const [status,setStatus]=useState<'ALL'|StockCountSheet['status']>('ALL');const [assigneeId,setAssigneeId]=useState('');const [query,setQuery]=useState('');
  const actor=(id:string|null)=>id?people.find(person=>person.id===id)?.displayName??'Không xác định':'—';
  const visible=sheets.filter(sheet=>(status==='ALL'||sheet.status===status)&&(!assigneeId||sheet.assigneeId===assigneeId)&&(!query.trim()||`${sheet.code} ${actor(sheet.assigneeId)} ${actor(sheet.finalizedById)}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))));
  return <section className="stockCountModule"><header><div><h1>KIỂM KHO</h1><p>Lưu từng tờ kiểm Thành phẩm và Sản phẩm theo chu kỳ 5 ngày.</p></div>{admin&&<button className="primary" onClick={()=>setCreating(true)}>＋ PHIẾU KIỂM KHO</button>}</header><div className="stockCountFilters"><label>Trạng thái<select value={status} onChange={event=>setStatus(event.target.value as typeof status)}><option value="ALL">Tất cả · {sheets.length}</option><option value="DRAFT">Chờ kiểm</option><option value="SUBMITTED">Đã gửi</option><option value="FINALIZED">Đã chốt</option></select></label><label>Người phụ trách<select value={assigneeId} onChange={event=>setAssigneeId(event.target.value)}><option value="">Tất cả thành viên</option>{people.map(person=><option value={person.id} key={person.id}>{person.displayName}</option>)}</select></label><label>Tìm phiếu<input placeholder="Mã phiếu, người kiểm..." value={query} onChange={event=>setQuery(event.target.value)}/></label></div><div className="stockCountList"><div className="stockCountListHead"><span>PHIẾU / KỲ KIỂM</span><span>NGƯỜI PHỤ TRÁCH</span><span>TIẾN ĐỘ</span><span>CHÊNH LỆCH</span><span>TRẠNG THÁI</span></div>{visible.map(sheet=>{const filled=sheet.lines.filter(line=>line.countedQuantity!==null).length;const differences=sheet.lines.filter(line=>line.countedQuantity!==null&&line.countedQuantity!==line.systemQuantity).length;const overdue=sheet.status!=='FINALIZED'&&sheet.dueDate<currentVietnamDate();return <button className={overdue?'overdue':''} key={sheet.id} onClick={()=>setSelected(sheet)}><span><b>{sheet.code}</b><small>{formatStockCountDate(sheet.periodStart)} → {formatStockCountDate(sheet.dueDate)}{overdue?' · QUÁ HẠN':''}</small></span><span><b>{actor(sheet.assigneeId)}</b><small>{sheet.finalizedById?`${actor(sheet.finalizedById)} chốt`:sheet.submittedById?`${actor(sheet.submittedById)} đã gửi`:'Chưa gửi'}</small></span><strong>{filled}/{sheet.lines.length} dòng</strong><strong className={differences?'hasDifference':''}>{differences} dòng</strong><em className={sheet.status.toLowerCase()}>{sheet.status==='DRAFT'?'CHỜ KIỂM':sheet.status==='SUBMITTED'?'ĐÃ GỬI':'ĐÃ CHỐT'}</em></button>})}{!visible.length&&<p className="emptyList">Không có phiếu phù hợp.</p>}</div>
    {creating&&<CreateStockCountSheetModal api={api} people={people} onClose={()=>setCreating(false)} onUpdated={async()=>{setCreating(false);await onUpdated();}}/>}{selected&&<StockCountSheetModal api={api} sheet={selected} people={people} currentUser={currentUser} admin={admin} onClose={()=>setSelected(null)} onUpdated={async()=>{setSelected(null);await onUpdated();}}/>}
  </section>;
}

function CreateStockCountSheetModal({api,people,onClose,onUpdated}:{api:Api;people:User[];onClose:()=>void;onUpdated:()=>Promise<void>}){
  const giang=people.find(person=>person.displayName.trim().toLocaleUpperCase('vi')==='GIANG')??people[0];const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{const form=new FormData(event.currentTarget);await api.createStockCountSheet({assigneeId:String(form.get('assigneeId'))});await onUpdated();}catch(err){setError(err instanceof Error?err.message:'Không tạo được phiếu');}finally{setBusy(false);}}
  return <div className="overlay" onMouseDown={onClose}><form className="createProductForm stockCountCreate" onSubmit={event=>void submit(event)} onMouseDown={event=>event.stopPropagation()}><h2>TẠO PHIẾU KIỂM KHO</h2><p>Phiếu gồm toàn bộ Thành phẩm và Sản phẩm đang hoạt động. Hạn kiểm là 5 ngày kể từ hôm nay.</p><label>Người phụ trách<select name="assigneeId" defaultValue={giang?.id} required>{people.map(person=><option value={person.id} key={person.id}>{person.displayName}</option>)}</select></label>{error&&<p className="error">{error}</p>}<div className="formActions"><button type="button" onClick={onClose}>Hủy</button><button className="primary" disabled={busy}>{busy?'Đang tạo...':'Tạo phiếu'}</button></div></form></div>;
}

function StockCountSheetModal({api,sheet,people,currentUser,admin,onClose,onUpdated}:{api:Api;sheet:StockCountSheet;people:User[];currentUser:User;admin:boolean;onClose:()=>void;onUpdated:()=>Promise<void>}){
  const [lines,setLines]=useState<StockCountLine[]>(sheet.lines);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const editable=sheet.status==='DRAFT'&&(admin||sheet.assigneeId===currentUser.id);const actor=(id:string|null)=>id?people.find(person=>person.id===id)?.displayName??'Không xác định':'—';
  const counted=lines.filter(line=>line.countedQuantity!==null).length;
  const update=(index:number,changes:Partial<StockCountLine>)=>setLines(current=>current.map((line,position)=>position===index?{...line,...changes}:line));
  const payload=()=>({lines:lines.map(line=>({ownerType:line.ownerType,ownerId:line.ownerId,countedQuantity:line.countedQuantity,note:line.note??undefined}))});
  async function run(action:()=>Promise<unknown>){setBusy(true);setError('');try{await action();await onUpdated();}catch(err){setError(err instanceof Error?err.message:'Không cập nhật được phiếu');}finally{setBusy(false);}}
  async function save(){await api.updateStockCountSheet(sheet.id,payload());}
  return <div className="overlay stockCountOverlay" onMouseDown={onClose}><section className="stockCountSheet" onMouseDown={event=>event.stopPropagation()}>
    <header><div><small>PHIẾU KIỂM KHO THÀNH PHẨM · SẢN PHẨM</small><h2>{sheet.code}</h2><p>Kỳ kiểm {formatStockCountDate(sheet.periodStart)} → {formatStockCountDate(sheet.dueDate)}</p></div><button onClick={onClose}>×</button></header>
    <div className="stockCountMeta"><span><small>NGƯỜI PHỤ TRÁCH</small><b>{actor(sheet.assigneeId)}</b></span><span><small>NGƯỜI TẠO</small><b>{actor(sheet.createdById)}</b><time>{new Date(sheet.createdAt).toLocaleString('vi-VN')}</time></span><span><small>NGƯỜI GỬI</small><b>{actor(sheet.submittedById)}</b><time>{sheet.submittedAt?new Date(sheet.submittedAt).toLocaleString('vi-VN'):'—'}</time></span><span><small>NGƯỜI CHỐT</small><b>{actor(sheet.finalizedById)}</b><time>{sheet.finalizedAt?new Date(sheet.finalizedAt).toLocaleString('vi-VN'):'—'}</time></span></div>
    <div className="stockCountProgress"><b>ĐÃ KIỂM {counted}/{lines.length}</b><span>{lines.length-counted} hàng hóa chưa nhập Thực đếm</span></div><div className="stockCountTable"><div className="stockCountHead"><span>HÀNG HÓA</span><span>TỒN HT</span><span>THỰC ĐẾM</span><span>LỆCH</span><span>GHI CHÚ PHỤ</span></div>{lines.map((line,index)=>{const difference=line.countedQuantity===null?null:line.countedQuantity-line.systemQuantity;return <div className={`stockCountRow ${line.countedQuantity===null?'uncounted':'counted'} ${difference&&Math.abs(difference)>=3?'largeDifference':difference?'hasDifference':''}`} key={`${line.ownerType}:${line.ownerId}`}><span><em>{line.ownerType==='FINISHED_PRODUCT'?'THÀNH PHẨM':'SẢN PHẨM'}</em><b>{line.label}</b></span><strong>{line.systemQuantity.toLocaleString('vi-VN')}</strong>{editable?<input className="stockCountPrimaryInput" aria-label={`Thực đếm ${line.label}`} type="number" min="0" step="1" value={line.countedQuantity??''} placeholder="Nhập số" onChange={event=>update(index,{countedQuantity:event.target.value===''?null:Number(event.target.value)})}/>:<strong>{line.countedQuantity?.toLocaleString('vi-VN')??'—'}</strong>}<strong>{difference===null?'—':`${difference>0?'+':''}${difference.toLocaleString('vi-VN')}`}</strong>{editable?<input className="stockCountNoteInput" aria-label={`Ghi chú ${line.label}`} value={line.note??''} placeholder="Tùy chọn" onChange={event=>update(index,{note:event.target.value})}/>:<span>{line.note||'—'}</span>}</div>})}</div>
    {error&&<p className="error">{error}</p>}<footer><span className={`stockCountStatus ${sheet.status.toLowerCase()}`}>{sheet.status==='DRAFT'?'CHỜ KIỂM':sheet.status==='SUBMITTED'?'ĐÃ GỬI · CHỜ CHỐT':'ĐÃ CHỐT KHO'}</span><div>{editable&&<><button disabled={busy} onClick={()=>void run(save)}>Lưu nháp</button><button className="primary" disabled={busy||lines.some(line=>line.countedQuantity===null)} onClick={()=>void run(async()=>{await save();await api.submitStockCountSheet(sheet.id);})}>Gửi kiểm kho</button></>}{admin&&sheet.status==='SUBMITTED'&&<button className="primary" disabled={busy} onClick={()=>void run(()=>api.finalizeStockCountSheet(sheet.id))}>Chốt cập nhật kho</button>}</div></footer>
  </section></div>;
}

function formatStockCountDate(value:string){return new Date(`${value}T00:00:00+07:00`).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});}

function MaterialPlanModal({api,finishedProducts,sellableProducts,onClose}:{api:Api;finishedProducts:FinishedProduct[];sellableProducts:SellableProduct[];onClose:()=>void}) {
  const [outputType,setOutputType]=useState<'SELLABLE_PRODUCT'|'FINISHED_PRODUCT'>('SELLABLE_PRODUCT');
  const [outputId,setOutputId]=useState(sellableProducts[0]?.id??'');
  const [quantity,setQuantity]=useState('');
  const [plan,setPlan]=useState<MaterialPlan|null>(null);
  const [onlyMissing,setOnlyMissing]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const outputs=outputType==='SELLABLE_PRODUCT'?sellableProducts:finishedProducts;
  function changeType(type:'SELLABLE_PRODUCT'|'FINISHED_PRODUCT') { setOutputType(type);setOutputId((type==='SELLABLE_PRODUCT'?sellableProducts:finishedProducts)[0]?.id??'');setPlan(null);setError(''); }
  async function calculate(event:FormEvent<HTMLFormElement>) { event.preventDefault();const amount=Number(quantity);if(!outputId){setError('Chọn Sản phẩm hoặc Thành phẩm cần sản xuất.');return;}if(!Number.isInteger(amount)||amount<1){setError('Số lượng sản xuất mới phải là số nguyên dương.');return;}setBusy(true);setError('');try{setPlan(await api.materialPlan({outputType,outputId,quantity:amount}));}catch(err){setError(err instanceof Error?err.message:'Không quét được vật tư.');}finally{setBusy(false);} }
  const visible=plan?.materials.filter(line=>!onlyMissing||line.purchaseQty>0||line.status==='CHƯA KIỂM'||line.status==='THIẾU CẤU HÌNH')??[];
  return <div className="modalBackdrop"><div className="materialPlanModal">
    <header><div><h2>TÍNH VẬT TƯ</h2><p>Preview cho số lượng cần sản xuất mới. Không thay đổi Kho.</p></div><button onClick={onClose}>×</button></header>
    <form className="materialPlanForm" onSubmit={event=>void calculate(event)}>
      <label>Loại đầu ra<select value={outputType} onChange={event=>changeType(event.target.value as 'SELLABLE_PRODUCT'|'FINISHED_PRODUCT')}><option value="SELLABLE_PRODUCT">Sản phẩm</option><option value="FINISHED_PRODUCT">Thành phẩm</option></select></label>
      <label>{outputType==='SELLABLE_PRODUCT'?'Sản phẩm':'Thành phẩm'}<select value={outputId} onChange={event=>{setOutputId(event.target.value);setPlan(null);}}><option value="">Chọn...</option>{outputs.map(output=><option key={output.id} value={output.id}>{output.name}</option>)}</select></label>
      <label>Số lượng sản xuất mới<input type="number" min="1" step="1" value={quantity} onChange={event=>{setQuantity(event.target.value);setPlan(null);}} placeholder="Ví dụ: 300"/></label>
      <button className="primary" disabled={busy}>{busy?'Đang quét...':'Quét vật tư'}</button>
    </form>
    {error&&<p className="formError">{error}</p>}
    {plan&&<div className="materialPlanResult">
      <div className="materialPlanSummary"><span><b>{plan.output.quantity.toLocaleString('vi-VN')}</b><small>{plan.output.name} cần sản xuất mới</small></span><span><b>{plan.materials.length}</b><small>mã vật tư</small></span><span><b>{plan.materials.filter(line=>line.purchaseQty>0).length}</b><small>mã cần mua</small></span><label><input type="checkbox" checked={onlyMissing} onChange={event=>setOnlyMissing(event.target.checked)}/> Chỉ vật tư cần xử lý</label></div>
      {plan.warnings.length>0&&<details className="materialPlanWarnings" open><summary>{plan.warnings.length} cảnh báo Cấu thành</summary>{plan.warnings.map(warning=><p key={warning}>{warning}</p>)}</details>}
      <div className="materialPlanTable"><div className="materialPlanHead"><span>Vật tư</span><span>Nhu cầu</span><span>Tồn / Đang mua</span><span>Cần mua</span><span>Link mua</span></div>{visible.map(line=><article key={line.itemId}>
        <div className="materialPlanIdentity"><InventoryThumbnail api={api} ownerType="MATERIAL" ownerId={line.itemId} label={`Ảnh ${line.name}`} revision={0}/><span><b>{line.name}</b><small>{line.groupName}{line.sku?` · ${line.sku}`:''}</small><em className="materialPlanStatus" data-status={line.status}>{line.status}</em><small>{line.usedBy.join(' · ')}</small></span></div>
        <b>{line.requiredQty.toLocaleString('vi-VN')} <small>{line.unit}</small></b>
        <span><b>{line.onHandQty===null?'CHƯA KIỂM':line.onHandQty.toLocaleString('vi-VN')}</b><small>Đang mua: {line.orderedQty.toLocaleString('vi-VN')}</small></span>
        <strong>{line.purchaseQty.toLocaleString('vi-VN')} <small>{line.unit}</small></strong>
        <span className="materialPlanLinks">{line.purchaseLinks.map((link,index)=><a key={link} href={link} target="_blank" rel="noreferrer">Mở link {index+1}</a>)}{!line.purchaseLinks.length&&<small>Chưa có link</small>}</span>
      </article>)}{!visible.length&&<p className="emptyList">Không có vật tư cần xử lý.</p>}</div>
    </div>}
  </div></div>;
}

const PURCHASE_LABEL: Record<PurchaseRequest["status"], string> = {
  REQUESTED: "CHỜ MUA",
  ORDERED: "ĐANG MUA",
  RECEIVED: "ĐÃ NHẬN",
  CANCELLED: "ĐÃ HỦY",
};
const PAYMENT_LABEL: Record<PurchaseRequest["paymentStatus"], string> = {
  UNPAID: "CHƯA THANH TOÁN",
  PARTIAL: "THANH TOÁN MỘT PHẦN",
  PAID: "ĐÃ THANH TOÁN",
};

export function purchaseReceivedQuantity(request: Pick<PurchaseRequest,"status"|"requestedQty"|"receivedQty">) {
  return request.receivedQty ?? (request.status === "RECEIVED" ? request.requestedQty : null);
}

export function purchaseReceivedDate(request: Pick<PurchaseRequest,"status"|"receivedAt"|"updatedAt">) {
  return request.receivedAt ?? (request.status === "RECEIVED" ? request.updatedAt : null);
}

export type PurchaseRequestWarning = { request:PurchaseRequest; ageDays:number; severity:"warning"|"critical" };
export function overduePurchaseRequests(requests:PurchaseRequest[],user:Pick<User,"id"|"role">,today=currentVietnamDate()):PurchaseRequestWarning[]{
  return requests.flatMap(request=>{
    if(request.status!=="REQUESTED")return [];
    if(user.role!=="ADMIN"&&request.assignedBuyerId!==user.id)return [];
    const createdDate=currentVietnamDate(new Date(request.createdAt));
    const ageDays=Math.max(0,Math.floor((dateAtNoon(today).getTime()-dateAtNoon(createdDate).getTime())/86_400_000));
    return ageDays>=2?[{request,ageDays,severity:ageDays>=3?"critical" as const:"warning" as const}]:[];
  }).sort((a,b)=>b.ageDays-a.ageDays);
}

function PurchasingView({
  api,
  items,
  requests,
  people,
  currentUser,
  onUpdated,
  focusRequestId,
  focusOverdue,
  onFocusConsumed,
}: {
  api: Api;
  items: InventoryItem[];
  requests: PurchaseRequest[];
  people: User[];
  currentUser: User;
  onUpdated: () => Promise<void>;
  focusRequestId: string | null;
  focusOverdue: boolean;
  onFocusConsumed: () => void;
}) {
  const [filter, setFilter] = useState<
    "OVERDUE" | "all" | PurchaseRequest["status"]
  >("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequest | null>(null);
  const [selected, setSelected] = useState<PurchaseRequest | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected)
      setSelected(
        requests.find((request) => request.id === selected.id) ?? null,
      );
  }, [requests]);
  useEffect(() => {
    if(focusOverdue){setFilter("OVERDUE");return;}
    if (!focusRequestId) return;
    const request = requests.find((row) => row.id === focusRequestId);
    if (request) { setFilter("all"); setSelected(request); }
    onFocusConsumed();
  }, [focusOverdue, focusRequestId, onFocusConsumed, requests]);
  const itemOf = (id: string) => items.find((item) => item.id === id);
  const buyerOf = (id: string | null) =>
    id ? people.find((person) => person.id === id) : undefined;
  const visible = requests.filter(
    (request) =>
      (filter === "all" ||
        (filter === "OVERDUE" && overduePurchaseRequests([request],currentUser).length>0) ||
        request.status === filter) &&
      purchaseMaterialMatches(itemOf(request.itemId), query),
  );
  const count = (status: PurchaseRequest["status"]) =>
    requests.filter((request) => request.status === status).length;
  async function removeRequest(request: PurchaseRequest) {
    if (!window.confirm(`Xóa Request mua ${itemOf(request.itemId)?.name ?? "này"}?`)) return;
    try {
      await api.removePurchaseRequest(request.id);
      if (selected?.id === request.id) setSelected(null);
      await onUpdated();
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa Request.");
    }
  }
  return (
    <section className="purchasing">
      <div className="inventoryHeading">
        <div>
          <h1>MUA HÀNG</h1>
          <p>Request từ Kho và Dashboard dùng chung một flow.</p>
        </div>
        <button className="primary" onClick={() => setCreating(true)}>
          ＋ Tạo Request
        </button>
      </div>
      {error && <div className="modalFeedback error">{error}</div>}
      <div className="purchaseSignals">
        <button
          className={filter === "OVERDUE" ? "selected purchaseOverdueFilter" : "purchaseOverdueFilter"}
          onClick={() => setFilter(filter === "OVERDUE" ? "all" : "OVERDUE")}
        >
          <b>{overduePurchaseRequests(requests,currentUser).length}</b>
          <span>QUÁ HẠN</span>
        </button>
        <button
          className={filter === "REQUESTED" ? "selected" : ""}
          onClick={() =>
            setFilter(filter === "REQUESTED" ? "all" : "REQUESTED")
          }
        >
          <b>{count("REQUESTED")}</b>
          <span>CHỜ MUA</span>
        </button>
        <button
          className={filter === "ORDERED" ? "selected" : ""}
          onClick={() => setFilter(filter === "ORDERED" ? "all" : "ORDERED")}
        >
          <b>{count("ORDERED")}</b>
          <span>ĐANG MUA</span>
        </button>
        <button
          className={filter === "RECEIVED" ? "selected" : ""}
          onClick={() => setFilter(filter === "RECEIVED" ? "all" : "RECEIVED")}
        >
          <b>{count("RECEIVED")}</b>
          <span>ĐÃ NHẬN</span>
        </button>
        <button
          className={filter === "all" ? "selected" : ""}
          onClick={() => setFilter("all")}
        >
          <b>{requests.length}</b>
          <span>TẤT CẢ</span>
        </button>
        <input
          className="purchaseSearch"
          aria-label="Tìm đơn mua theo tên vật tư"
          placeholder="Tìm tên vật tư..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="purchaseTable">
        <div className="purchaseHeader">
          <span>Vật tư</span>
          <span>SL yêu cầu</span>
          <span>Trạng thái</span>
          <span>Ngày đặt</span>
          <span>Link Order</span>
          <span>SL nhận</span>
          <span>Ngày nhận</span>
          <span>Người mua</span>
          <span />
        </div>
        {visible.map((request) => {
          const item = itemOf(request.itemId);
          const buyer = buyerOf(request.assignedBuyerId);
          const receivedQuantity = purchaseReceivedQuantity(request);
          const receivedDate = purchaseReceivedDate(request);
          return (
            <div
              className="purchaseRow"
              key={request.id}
              onClick={() => setSelected(request)}
            >
              <div className="purchaseMaterial">
                {item ? (
                  <InventoryThumbnail
                    api={api}
                    ownerType="MATERIAL"
                    ownerId={item.id}
                    label={`Ảnh ${item.name}`}
                    revision={0}
                    className="purchaseMaterialImage"
                  />
                ) : (
                  <div className="purchaseMaterialImage inventoryThumbnail">
                    <span>Chưa có ảnh</span>
                  </div>
                )}
                <b>{item?.name ?? "Vật tư không tồn tại"}</b>
              </div>
              <span>
                <b>{Number(request.requestedQty).toLocaleString("vi-VN")}</b>
                <small>unit</small>
              </span>
              <span>
                <b className={`purchaseStatus ${request.status.toLowerCase()}`}>
                  {PURCHASE_LABEL[request.status]}
                </b>
              </span>
              <span>{request.orderedAt ? new Date(request.orderedAt).toLocaleDateString("vi-VN") : "—"}</span>
              <span className="purchaseOrderReference">
                {request.orderUrl && (
                  <a
                    href={request.orderUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Mở Order ↗
                  </a>
                )}
                {request.orderCode && <small>{request.orderCode}</small>}
                {!request.orderUrl && <small>Chưa có link</small>}
              </span>
              <span>{receivedQuantity ? Number(receivedQuantity).toLocaleString("vi-VN") : "—"}</span>
              <span>{receivedDate ? new Date(receivedDate).toLocaleDateString("vi-VN") : "—"}</span>
              <span className="purchaseBuyer">
                {buyer ? (
                  <>
                    <span
                      className="avatar"
                      style={{
                        backgroundColor: avatarColor(buyer.id, buyer.displayName),
                      }}
                    >
                      <AvatarContent userId={buyer.id} name={buyer.displayName}/>
                    </span>
                    <b>{buyer.displayName}</b>
                  </>
                ) : (
                  <small>Chưa gán</small>
                )}
              </span>
              {request.status === "REQUESTED" || request.status === "CANCELLED" ? (
                <details className="purchaseRowMenu" onClick={(event) => event.stopPropagation()}>
                  <summary aria-label="Thao tác Request">⋯</summary>
                  <div>
                    {request.status === "REQUESTED" && <button type="button" onClick={() => { setCreating(false); setEditing(request); }}>Sửa</button>}
                    <button type="button" className="danger" onClick={() => void removeRequest(request)}>Xóa</button>
                  </div>
                </details>
              ) : <span />}
            </div>
          );
        })}
      </div>
      {!visible.length && <p className="emptyList">Chưa có Request phù hợp.</p>}
      {creating && (
        <CreatePurchaseModal
          api={api}
          items={items}
          people={people}
          onClose={() => setCreating(false)}
          onUpdated={onUpdated}
        />
      )}{" "}
      {editing && (
        <CreatePurchaseModal
          api={api}
          items={items}
          people={people}
          request={editing}
          onClose={() => setEditing(null)}
          onUpdated={onUpdated}
        />
      )}{" "}
      {selected && (
        <PurchaseDetailModal
          api={api}
          request={selected}
          item={itemOf(selected.itemId)}
          people={people}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </section>
  );
}

function CreatePurchaseModal({
  api,
  items,
  people,
  request,
  onClose,
  onUpdated,
}: {
  api: Api;
  items: InventoryItem[];
  people: User[];
  request?: PurchaseRequest;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const initialItem = request ? items.find((item) => item.id === request.itemId) : undefined;
  const [query, setQuery] = useState(initialItem?.name ?? "");
  const [itemId, setItemId] = useState(request?.itemId ?? "");
  const [feedback, setFeedback] = useState("");
  const selected = items.find((item) => item.id === itemId);
  const q = query.trim().toLocaleLowerCase("vi");
  const choices = items
    .filter(
      (item) =>
        !q ||
        `${item.name} ${item.sku ?? ""}`.toLocaleLowerCase("vi").includes(q),
    )
    .slice(0, 8);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setFeedback("Hãy chọn một vật tư có sẵn.");
      return;
    }
    const form = new FormData(event.currentTarget);
    try {
      const assignedBuyerId = String(form.get("assignedBuyerId") ?? "");
      const input = {
        quantity: Number(form.get("quantity")),
        note: String(form.get("note")),
        ...(!request ? { assignedBuyerId: assignedBuyerId || null } : {}),
      };
      if (request) await api.updatePurchaseRequest(request.id, { itemId: selected.id, ...input });
      else await api.createPurchaseRequest(selected.id, input);
      await onUpdated();
      onClose();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Không thể tạo Request.",
      );
    }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="createPurchaseModal"
        onSubmit={(event) => void submit(event)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2>{request ? "SỬA REQUEST MUA" : "TẠO REQUEST MUA"}</h2>
        <label>
          Tìm vật tư
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên hoặc SKU"
            autoFocus
          />
        </label>
        <div className="materialChoices">
          {choices.map((item) => (
            <button
              type="button"
              className={itemId === item.id ? "selected" : ""}
              key={item.id}
              onClick={() => setItemId(item.id)}
            >
              <b>{item.name}</b>
              <small>
                {item.sku || item.id.slice(0, 8)} · tồn{" "}
                {item.onHandQty ?? "chưa kiểm"} / min {item.minimumStock}
              </small>
            </button>
          ))}
        </div>
        {selected && (
          <div className="selectedMaterial">
            <b>{selected.name}</b>
            <span>
              {selected.purchaseLinks?.length
                ? `${selected.purchaseLinks.length} link mua`
                : "Chưa có link mua"}
            </span>
          </div>
        )}
        <label>
          Số lượng cần mua
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue={request ? Number(request.requestedQty) : undefined}
            required
          />
        </label>
        <label>
          Lý do
          <input name="note" defaultValue={request?.note ?? ""} required />
        </label>
        {!request && (
          <label>
            Người phụ trách mua
            <select name="assignedBuyerId" defaultValue="">
              <option value="">Chưa gán</option>
              {people.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
        {feedback && <p className="error">{feedback}</p>}
        <div className="formActions">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary" disabled={!selected}>
            {request ? "Lưu thay đổi" : "Tạo Request"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PurchaseDetailModal({
  api,
  request,
  item,
  people,
  onClose,
  onUpdated,
}: {
  api: Api;
  request: PurchaseRequest;
  item: InventoryItem | undefined;
  people: User[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const person = (id: string) =>
    people.find((user) => user.id === id)?.displayName ?? id.slice(0, 6);
  const assignedBuyer = request.assignedBuyerId
    ? people.find((user) => user.id === request.assignedBuyerId)
    : undefined;
  async function action(
    input: Parameters<Api["updatePurchaseRequest"]>[1],
    message: string,
  ) {
    try {
      await api.updatePurchaseRequest(request.id, input);
      await onUpdated();
      setFeedback({ type: "success", text: message });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật Request.",
      });
    }
  }
  async function assignBuyer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assignedBuyerId = String(form.get("assignedBuyerId") ?? "");
    await action(
      { assignedBuyerId: assignedBuyerId || null },
      assignedBuyerId ? "Đã giao người phụ trách mua." : "Đã bỏ người phụ trách mua.",
    );
  }
  async function orderReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orderUrl = String(form.get("orderUrl") ?? "").trim();
    const orderCode = String(form.get("orderCode") ?? "").trim();
    if (!orderUrl && !orderCode) {
      setFeedback({ type: "error", text: "Cần nhập link hoặc mã đơn hàng." });
      return;
    }
    await action(
      {
        ...(request.status === "REQUESTED" ? { status: "ORDERED" as const } : {}),
        orderUrl: orderUrl || null,
        orderCode: orderCode || null,
      },
      request.status === "REQUESTED"
        ? "Đã chuyển sang Đang mua."
        : "Đã cập nhật đơn mua.",
    );
  }
  const [receiptBusy,setReceiptBusy]=useState(false);
  const receiptLock=useRef(false);
  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(receiptLock.current)return;
    receiptLock.current=true;setReceiptBusy(true);
    const form = new FormData(event.currentTarget);
    try { await action(
      {
        status: "RECEIVED",
        receivedQuantity: Number(form.get("receivedQuantity")),
      },
      "Đã nhận hàng, cộng tồn và ghi nhận đã thanh toán.",
    ); } finally {receiptLock.current=false;setReceiptBusy(false); }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section
        className="purchaseDetail"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>{item?.name ?? "Purchase Request"}</h2>
            <small>
              {item?.sku ?? request.itemId} · {person(request.requesterId)}
            </small>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        {feedback && (
          <div className={`modalFeedback ${feedback.type}`}>
            {feedback.text}
          </div>
        )}
        <div className="purchaseDetailSummary">
          <span className={`purchaseStatus ${request.status.toLowerCase()}`}>
            {PURCHASE_LABEL[request.status]}
          </span>

          <b>{Number(request.requestedQty).toLocaleString("vi-VN")} unit</b>
        </div>
        <div className={`purchaseFlow is-${request.status.toLowerCase()}`} aria-label="Tiến trình mua hàng">
          <span className={request.status==="REQUESTED"?"current":"done"}><i>1</i>Chờ mua</span>
          <b>→</b>
          <span className={request.status==="ORDERED"?"current":request.status==="RECEIVED"?"done":""}><i>2</i>Đang mua</span>
          <b>→</b>
          <span className={request.status==="RECEIVED"?"current":""}><i>3</i>Đã nhận</span>
        </div>
        <div className="purchaseDetailGrid">
          <div>
            <h3>Thông tin</h3>
            <p>{request.note || "Không có lý do."}</p>
            <small>
              Tồn: {item?.onHandQty ?? "chưa kiểm"} · Min:{" "}
              {item?.minimumStock ?? "—"} unit
            </small>
            <div className="purchaseOrderDetail">
              <b>Đơn mua</b>
              {request.orderUrl && (
                <a href={request.orderUrl} target="_blank" rel="noreferrer">
                  Mở website đơn hàng ↗
                </a>
              )}
              {request.orderCode && <span>Mã: {request.orderCode}</span>}
              {!request.orderUrl && !request.orderCode && <span>Chưa có</span>}
            </div>
            <div className="purchaseLinks">
              {(item?.purchaseLinks?.length
                ? item.purchaseLinks
                : item?.purchaseUrl
                  ? [item.purchaseUrl]
                  : []
              )
                .slice(0, 2)
                .map((link, index) => (
                  <a key={link} href={link} target="_blank" rel="noreferrer">
                    Mở link mua {index + 1} ↗
                  </a>
                ))}
            </div>
            <small>
              Tạo: {new Date(request.createdAt).toLocaleString("vi-VN")} · Cập
              nhật: {person(request.updatedById)}
            </small>
            <div className="purchaseBuyerDetail">
              <span>Người phụ trách mua</span>
              <b>{assignedBuyer?.displayName ?? "Chưa gán"}</b>
            </div>
          </div>
          <div className="purchaseActions">
            {request.status === "REQUESTED" && <form className="purchaseNextAction" onSubmit={(event) => void orderReference(event)}>
              <em>BƯỚC TIẾP THEO</em>
              <h3>Xác nhận đã đặt hàng</h3>
              <small>Nhập link hoặc mã đơn để chuyển sang trạng thái Đang mua.</small>
              <input name="orderUrl" type="url" placeholder="Link đơn hàng https://..." defaultValue={request.orderUrl ?? ""} maxLength={2000}/>
              <input name="orderCode" placeholder="Mã đơn hàng" defaultValue={request.orderCode ?? ""} maxLength={160}/>
              <button className="primary">Xác nhận đã đặt</button>
            </form>}
            {request.status === "ORDERED" && <form className="purchaseNextAction receive" onSubmit={(event) => void receive(event)}>
              <em>BƯỚC TIẾP THEO</em>
              <h3>Xác nhận nhận hàng</h3>
              <label>SL thực nhận
                <input name="receivedQuantity" type="number" min="1" step="1" defaultValue={Number(request.requestedQty)} required/>
              </label>
              <small>Đã nhận bao gồm đã thanh toán và số lượng sẽ được cộng vào kho.</small>
              <button className="primary" disabled={receiptBusy}>{receiptBusy ? "Đang lưu…" : "Xác nhận đã nhận"}</button>
            </form>}
            {request.status === "RECEIVED" && <div className="purchaseFlowComplete"><b>✓ Đơn đã nhận</b><small>Đã thanh toán và cộng {Number(purchaseReceivedQuantity(request)??0).toLocaleString("vi-VN")} unit vào kho.</small></div>}
            {(request.status === "REQUESTED" || request.status === "ORDERED") && <details className="purchaseOptional"><summary>Thông tin phụ</summary>
            {(request.status === "REQUESTED" || request.status === "ORDERED") && (
              <form onSubmit={(event) => void assignBuyer(event)}>
                <h3>Người phụ trách mua</h3>
                <select
                  name="assignedBuyerId"
                  defaultValue={request.assignedBuyerId ?? ""}
                >
                  <option value="">Chưa gán</option>
                  {people.map((user) => (
                    <option value={user.id} key={user.id}>
                      {user.displayName}
                    </option>
                  ))}
                </select>
                <button>Lưu người mua</button>
              </form>
            )}
            {request.status === "ORDERED" && (
              <form onSubmit={(event) => void orderReference(event)}>
                <h3>Chỉnh đơn mua</h3>
                <small>Nhập ít nhất link hoặc mã đơn để tiện tracking.</small>
                <input
                  name="orderUrl"
                  type="url"
                  placeholder="https://..."
                  defaultValue={request.orderUrl ?? ""}
                  maxLength={2000}
                />
                <input
                  name="orderCode"
                  placeholder="Mã đơn hàng"
                  defaultValue={request.orderCode ?? ""}
                  maxLength={160}
                />
                <button>Lưu thông tin đơn</button>
              </form>
            )}
            </details>}
            {(request.status === "REQUESTED" || request.status === "ORDERED") && <button className="purchaseCancel" onClick={() => void action({ status: "CANCELLED" }, "Đã hủy Request.")}>Hủy Request</button>}
          </div>
        </div>
      </section>
    </div>
  );
}

function CreateMaterialModal({
  api,
  onClose,
  onUpdated,
}: {
  api: Api;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api.createInventoryItem({
      name: String(f.get("name")),
      groupName: String(f.get("groupName")),
      bomKind: String(f.get("bomKind")) as InventoryBomKind,
      sku: String(f.get("sku")) || undefined,
      location: String(f.get("location")) || undefined,
      minimumStock: Number(f.get("minimumStock")),
      openingQuantity: String(f.get("openingQuantity"))
        ? Number(f.get("openingQuantity"))
        : undefined,
      purchaseLinks: String(f.get("links"))
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
    });
    await onUpdated();
    onClose();
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        onSubmit={(e) => void submit(e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>THÊM VẬT TƯ</h2>
        <label>
          Tên
          <input name="name" required autoFocus />
        </label>
        <label>
          Nhóm
          <input name="groupName" required />
        </label>
        <label>
          Loại dùng trong Cấu thành Board
          <select name="bomKind" defaultValue="OTHER"><option value="OTHER">Khác</option><option value="BOARD_COMPONENT">Linh kiện board</option></select>
        </label>
        <div className="formColumns">
          <label>
            SKU
            <input name="sku" />
          </label>
          <label>
            Vị trí
            <input name="location" placeholder="A4, B5..." />
          </label>
        </div>
        <div className="formColumns">
          <label>
            Tồn kiểm tay
            <input name="openingQuantity" type="number" min="0" step="1" />
          </label>
          <label>
            Mức dự trữ
            <input
              name="minimumStock"
              type="number"
              min="0"
              step="1"
              defaultValue="100"
              required
            />
          </label>
        </div>
        <label>
          Link mua — mỗi dòng một link
          <textarea name="links" rows={3} />
        </label>
        <div className="formActions">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary">Thêm vật tư</button>
        </div>
      </form>
    </div>
  );
}

function MaterialDetailModal({
  api,
  item,
  requests,
  finishedProducts,
  people,
  admin,
  onClose,
  onUpdated,
  countFocus = 0,
}: {
  api: Api;
  item: InventoryItem;
  countFocus?: number;
  requests: PurchaseRequest[];
  finishedProducts: FinishedProduct[];
  people: User[];
  admin: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const countInput = useRef<HTMLInputElement>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [countBusy, setCountBusy] = useState(false);
  useEffect(() => {
    if (countFocus) {
      countInput.current?.scrollIntoView({ block: "center" });
      countInput.current?.focus({ preventScroll: true });
    }
  }, [countFocus]);
  async function requestCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestBusy) return;
    const data = new FormData(event.currentTarget);
    setRequestBusy(true); setFeedback(null);
    try {
      await api.requestInventoryCount(item.id, {assigneeId: String(data.get("assigneeId")), note: String(data.get("note"))});
      setRequestOpen(false);
      await Promise.all([onUpdated(), refreshLogger()]);
      setFeedback({type:"success", text:"Đã giao kiểm và gửi thông báo trong app."});
    } catch (error) {
      setFeedback({type:"error", text:error instanceof Error ? error.message : "Không gửi được yêu cầu kiểm."});
    } finally { setRequestBusy(false); }
  }
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [audits, setAudits] = useState<InventoryAudit[]>([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const links = item.purchaseLinks?.length
    ? item.purchaseLinks
    : item.purchaseUrl
      ? [item.purchaseUrl]
      : [];
  const [editLinks, setEditLinks] = useState(() =>
    Array.from({ length: 2 }, (_, index) => links[index] ?? ""),
  );
  const usedByFinishedProducts = finishedProductsForMaterial(
    finishedProducts,
    item.id,
  );
  const purchaseLinkLabel = (value: string, index: number) => {
    try {
      return new URL(value).hostname.replace(/^www\./, "") || `Link mua ${index + 1}`;
    } catch {
      return `Link mua ${index + 1}`;
    }
  };
  async function refreshLogger() {
    await Promise.all([
      api.inventoryTransactions(item.id),
      api.inventoryAudits(item.id),
    ]).then(([t, a]) => {
      setTransactions(t);
      setAudits(a);
    });
  }
  useEffect(() => {
    void refreshLogger();
  }, [api, item.id]);
  const actor = (id: string) =>
    people.find((p) => p.id === id)?.displayName ?? id.slice(0, 6);
  async function edit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api.updateInventoryItem(item.id, {
        name: String(f.get("name")),
        groupName: String(f.get("groupName")),
        bomKind: String(f.get("bomKind")) as InventoryBomKind,
        sku: String(f.get("sku")),
        unit: String(f.get("unit")),
        location: String(f.get("location")),
        note: String(f.get("note")),
        minimumStock: Number(f.get("minimumStock")),
        price: String(f.get("price")) ? Number(f.get("price")) : undefined,
        purchaseLinks: editLinks.map((value) => value.trim()).filter(Boolean),
      });
      await Promise.all([onUpdated(), refreshLogger()]);
      setFeedback({ type: "success", text: "Đã lưu thông tin vật tư." });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể lưu thông tin.",
      });
    }
  }
  async function move(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (countBusy) return;
    setCountBusy(true);
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api.inventoryMovement(item.id, {
        type: "STOCK_COUNT",
        quantity: Number(f.get("quantity")),
        note: String(f.get("note")),
      });
      form.reset();
      await Promise.all([onUpdated(), refreshLogger()]);
      setFeedback({
        type: "success",
        text: item.checkAssignedToId ? "Đã cập nhật tồn, hoàn tất yêu cầu và báo người giao." : "Đã cập nhật tồn và ghi người kiểm.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error ? error.message : "Không thể cập nhật tồn.",
      });
    }
    finally { setCountBusy(false); }
  }
  async function removeItem(){
    if(!window.confirm(`Xóa vật tư "${item.name}"?\n\nVật tư sẽ ẩn khỏi Kho nhưng toàn bộ lịch sử vẫn được giữ.`))return;
    try{await api.removeInventoryItem(item.id);await onUpdated();onClose();}
    catch(error){setFeedback({type:"error",text:error instanceof Error?error.message:"Không thể xóa vật tư."});}
  }
  const logger = [
    ...transactions.map((row) => ({
      id: `stock-${row.id}`,
      at: row.createdAt,
      title:
        row.type === "STOCK_COUNT"
          ? "Đã kiểm kê tồn"
          : row.type === "IN"
            ? "Đã nhập kho"
            : row.type === "OUT"
              ? "Đã xuất kho"
              : "Đã điều chỉnh tồn",
      detail: `${row.balanceBefore ?? "—"} → ${row.balanceAfter} unit${row.note ? ` · ${row.note}` : ""}`,
      actorId: row.actorId,
    })),
    ...audits.map((row) => ({
      id: `audit-${row.id}`,
      at: row.createdAt,
      title: inventoryAuditDescription(row.changes),
      detail: "",
      actorId: row.actorId,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section
        className="inventoryDetail"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{item.name}</h2>
          <button onClick={onClose}>×</button>
        </header>
        <div className="materialCoreInfo">
          <section className="materialCoreCard stock">
            <small>TỒN HIỆN TẠI</small>
            <strong>
              {item.onHandQty === null
                ? "CHƯA KIỂM"
                : `${Number(item.onHandQty).toLocaleString("vi-VN")} unit`}
            </strong>
            <div className="materialCoreSignals">
              {item.isLowStock && <em>SẮP HẾT</em>}
              {item.needsCount && <em>CẦN KIỂM</em>}
            </div>
            {item.checkAssignedToId ? <div role="status">
              <b>Chờ {people.find(person => person.id === item.checkAssignedToId)?.displayName ?? "người được giao"} kiểm</b>
              {item.checkRequestNote && <p>{item.checkRequestNote}</p>}
            </div> : <button type="button" onClick={() => setRequestOpen(true)}>Yêu cầu kiểm</button>}

          </section>
          <section className="materialCoreCard location">
            <small>VỊ TRÍ</small>
            <strong>{item.location || "Chưa có vị trí"}</strong>
          </section>
          <section className="materialCoreCard usage">
            <small>THUỘC THÀNH PHẨM</small>
            <div className="materialCoreProducts">
              {usedByFinishedProducts.map((entry) => (
                <span key={entry.productId}>
                  <b>{entry.productName}</b>
                  <small>{Number(entry.quantityPerProduct).toLocaleString("vi-VN")} unit / thành phẩm</small>
                </span>
              ))}
              {!usedByFinishedProducts.length && <span className="empty">Chưa thuộc thành phẩm nào</span>}
            </div>
          </section>
        </div>
            {requestOpen && !item.checkAssignedToId && <form className="inventoryCountRequestForm" onSubmit={event => void requestCount(event)}>
              <label>Người kiểm<select name="assigneeId" required defaultValue="" disabled={requestBusy}>
                <option value="" disabled>Chọn người kiểm</option>
                {people.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}
              </select></label>
              <label>Ghi chú yêu cầu<textarea name="note" rows={2} maxLength={500} disabled={requestBusy}/></label>
              <div className="formActions">
                <button type="button" disabled={requestBusy} onClick={() => setRequestOpen(false)}>Hủy</button>
                <button className="primary" disabled={requestBusy}>{requestBusy ? "Đang gửi…" : "Giao kiểm"}</button>
              </div>
            </form>}
        <MaterialPurchaseState itemId={item.id} unit={item.unit||'unit'} requests={requests}/>
        <div className="materialCoreReference">
          <section>
            <small>NHÓM</small>
            <strong>{item.groupName || "Chưa phân nhóm"}</strong>
          </section>
          <section>
            <small>LINK MUA</small>
            <div className="materialCorePurchaseLinks">
              {links.slice(0, 2).map((link, index) => (
                <a href={link} target="_blank" rel="noreferrer" key={`${link}-${index}`}>
                  {purchaseLinkLabel(link, index)} <span aria-hidden="true">↗</span>
                </a>
              ))}
              {!links.length && <span>Chưa có link mua</span>}
            </div>
          </section>
        </div>
        {feedback && (
          <div className={`modalFeedback ${feedback.type}`}>
            {feedback.text}
          </div>
        )}
        <div className="detailGrid">
          <div className="detailLeft">
            <details className="materialSecondaryInfo">
              <summary>
                <span><b>Thông tin phụ</b><small>SKU · đơn vị · giá · chỉnh sửa</small></span>
                <span aria-hidden="true">⌄</span>
              </summary>
            <form onSubmit={(e) => void edit(e)}>
              <label>
                Tên
                <input name="name" defaultValue={item.name} />
              </label>
              <div className="formColumns">
                <label>
                  Nhóm
                  <input name="groupName" defaultValue={item.groupName} />
                </label>
                <label>
                  SKU
                  <input name="sku" defaultValue={item.sku ?? ""} />
                </label>
              </div>
              <label>
                Loại dùng trong Cấu thành Board
                <select name="bomKind" defaultValue={item.bomKind??"OTHER"}><option value="OTHER">Khác</option><option value="BOARD_COMPONENT">Linh kiện board</option></select>
              </label>
              <div className="formColumns">
                <label>
                  Vị trí
                  <input name="location" defaultValue={item.location ?? ""} />
                </label>
                <label>
                  Đơn vị
                  <select name="unit" defaultValue={item.unit ?? "unit"}>
                    <option value="unit">unit</option>
                  </select>
                </label>
              </div>
              <div className="formColumns">
                <label>
                  Mức dự trữ
                  <input
                    name="minimumStock"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={Number(item.minimumStock)}
                  />
                </label>
                <label>
                  Giá
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={item.price ?? ""}
                  />
                </label>
              </div>
              <div className="purchaseLinkFields">
                <span>Link mua</span>
                {editLinks.map((link, index) => (
                  <div key={index}>
                    <input
                      aria-label={`Link mua ${index + 1}`}
                      type="url"
                      placeholder={`Link mua ${index + 1}`}
                      value={link}
                      onChange={(event) =>
                        setEditLinks((current) =>
                          current.map((value, position) =>
                            position === index ? event.target.value : value,
                          ),
                        )
                      }
                    />
                    {link.trim() ? (
                      <a href={link.trim()} target="_blank" rel="noreferrer">
                        Mở link ↗
                      </a>
                    ) : (
                      <button type="button" disabled>
                        Mở link
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <label>
                Ghi chú
                <textarea name="note" rows={2} defaultValue={item.note ?? ""} />
              </label>
              <button className="primary">Lưu thông tin</button>
            </form>
            </details>
            <div className="detailActions">
              <form onSubmit={(e) => void move(e)}>
                <h3>Kiểm kê tay</h3>
                <input
                  ref={countInput}
                  aria-label="Số lượng đếm thực tế"
                  disabled={countBusy}
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  required
                  placeholder="Số lượng đếm thực tế"
                />
                <input name="note" placeholder="Ghi chú khi kiểm" />
                <button className="primary" disabled={countBusy}>{countBusy ? "Đang lưu…" : "Xác nhận tồn"}</button>
              </form>
            </div>
          </div>
          <div className="detailRight">
            <InventoryImagePanel api={api} ownerType="MATERIAL" ownerId={item.id} label="Ảnh vật tư" />
            <aside className="detailLogger">
              <h3>Logger</h3>
              <small>Ai đã làm gì và lúc nào · mới nhất trước</small>
              <div className="loggerList">
                {logger.map((entry) => (
                  <div key={entry.id}>
                    <small className="loggerMeta"><b>{actor(entry.actorId)}</b><time>{new Date(entry.at).toLocaleString("vi-VN")}</time></small>
                    <b>{entry.title}</b>
                    {entry.detail && <span>{entry.detail}</span>}
                  </div>
                ))}
                {!logger.length && <p>Chưa có hoạt động.</p>}
              </div>
            </aside>
          </div>
        </div>
        {admin&&<div className="historyActions"><button type="button" className="danger" onClick={()=>void removeItem()}>Xóa vật tư</button></div>}
      </section>
    </div>
  );
}

type FinishedStructureLine = { itemId: string; quantity: string };
type FinishedComponentStructureLine = { componentProductId: string; quantity: string };

function normalizeMaterialSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("vi").trim();
}

export function purchaseMaterialMatches(
  item: Pick<InventoryItem, "name"> | undefined,
  query: string,
) {
  const normalizedQuery = normalizeMaterialSearch(query);
  return !normalizedQuery || Boolean(
    item && normalizeMaterialSearch(item.name).includes(normalizedQuery),
  );
}

export function filterMaterialOptions(materials: InventoryItem[], query: string) {
  const normalizedQuery=normalizeMaterialSearch(query);
  return [...materials].filter((item)=>!normalizedQuery||normalizeMaterialSearch(`${item.name} ${item.groupName} ${item.sku??""}`).includes(normalizedQuery)).sort((left,right)=>{
    const leftName=normalizeMaterialSearch(left.name);
    const rightName=normalizeMaterialSearch(right.name);
    const leftScore=!normalizedQuery?1:leftName===normalizedQuery?0:leftName.startsWith(normalizedQuery)?1:2;
    const rightScore=!normalizedQuery?1:rightName===normalizedQuery?0:rightName.startsWith(normalizedQuery)?1:2;
    return leftScore-rightScore||left.name.localeCompare(right.name,"vi");
  });
}

export function finishedProductsForMaterial(
  products: FinishedProduct[],
  itemId: string,
) {
  return products.flatMap((product) => {
    const line = product.bom.find((candidate) => candidate.itemId === itemId);
    return line
      ? [{
          productId: product.id,
          productName: product.name,
          quantityPerProduct: line.quantityPerProduct,
        }]
      : [];
  });
}

function MaterialPicker({materials,selectedIds,value,label,onChange}:{materials:InventoryItem[];selectedIds:Set<string>;value:string;label:string;onChange:(itemId:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState("");
  const selectedMaterial=materials.find((item)=>item.id===value);
  const matches=filterMaterialOptions(materials,query);
  const visibleMatches=matches.slice(0,10);
  return <div className="materialPicker">
    <button type="button" className="materialPickerTrigger" aria-label={label} aria-expanded={open} onClick={()=>{setOpen((current)=>!current);setQuery("")}}>
      <span>{selectedMaterial?.name??"Chọn vật tư..."}</span><b>⌄</b>
    </button>
    {open&&<div className="materialPickerMenu" onKeyDown={(event)=>{if(event.key==="Escape")setOpen(false)}}>
      <input autoFocus type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Tìm tên, nhóm hoặc SKU..." aria-label={`${label} tìm kiếm`}/>
      <div className="materialPickerResults">
        {visibleMatches.map((item)=>{const alreadySelected=selectedIds.has(item.id)&&item.id!==value;return <button type="button" disabled={alreadySelected} key={item.id} onClick={()=>{onChange(item.id);setOpen(false);setQuery("")}}><span><b>{item.name}</b><small>{item.groupName}{item.sku?` · ${item.sku}`:""}</small></span>{alreadySelected&&<em>Đã có trong cấu thành</em>}</button>})}
        {!visibleMatches.length&&<p>Không tìm thấy vật tư.</p>}
      </div>
      {matches.length>visibleMatches.length&&<small>Hiển thị 10/{matches.length} · nhập thêm để lọc</small>}
    </div>}
  </div>;
}

function FinishedStructureLinesForm({ materials, lines, onChange }: { materials: InventoryItem[]; lines: FinishedStructureLine[]; onChange: (lines: FinishedStructureLine[]) => void }) {
  const selected = new Set(lines.map((line) => line.itemId).filter(Boolean));
  return <div className="structureLinesForm">
    <div className="structureLinesHeader"><h3>1 thành phẩm gồm</h3><button type="button" onClick={() => onChange([...lines, {itemId:"",quantity:"1"}])}>＋ Thêm vật tư</button></div>
    {lines.length === 0 && <p>Chưa có vật tư. Có thể bổ sung sau.</p>}
    {lines.map((line, index) => <div className="bomLine" key={`${index}-${line.itemId}`}>
      <MaterialPicker materials={materials} selectedIds={selected} value={line.itemId} label={`Vật tư cấu thành ${index + 1}`} onChange={(itemId)=>onChange(lines.map((current,position)=>position===index?{...current,itemId}:current))}/>
      <input aria-label={`Số lượng cấu thành ${index + 1}`} type="number" min="1" step="1" required value={line.quantity} onChange={(event) => onChange(lines.map((current, position) => position === index ? {...current,quantity:event.target.value} : current))}/>
      <span>unit</span>
      <button type="button" aria-label={`Xóa vật tư cấu thành ${index + 1}`} onClick={() => onChange(lines.filter((_, position) => position !== index))}>×</button>
    </div>)}
  </div>;
}

function FinishedComponentLinesForm({products,currentProductId,lines,onChange}:{products:FinishedProduct[];currentProductId?:string;lines:FinishedComponentStructureLine[];onChange:(lines:FinishedComponentStructureLine[])=>void}){
  const selected=new Set(lines.map(line=>line.componentProductId).filter(Boolean));
  const options=products.filter(product=>product.id!==currentProductId&&product.isActive);
  return <div className="structureLinesForm componentStructureLines">
    <div className="structureLinesHeader"><h3>Thành phẩm con</h3><button type="button" onClick={()=>onChange([...lines,{componentProductId:"",quantity:"1"}])}>＋ Thêm thành phẩm</button></div>
    {!lines.length&&<p>Không có thành phẩm con.</p>}
    {lines.map((line,index)=><div className="bomLine" key={`${index}-${line.componentProductId}`}>
      <select aria-label={`Thành phẩm con ${index+1}`} required value={line.componentProductId} onChange={event=>onChange(lines.map((current,position)=>position===index?{...current,componentProductId:event.target.value}:current))}>
        <option value="">Chọn thành phẩm...</option>
        {options.map(product=><option key={product.id} value={product.id} disabled={selected.has(product.id)&&product.id!==line.componentProductId}>{product.name} · {FINISHED_PRODUCT_CATEGORY_LABELS[product.category]}</option>)}
      </select>
      <input aria-label={`Số lượng thành phẩm con ${index+1}`} type="number" min="1" step="1" required value={line.quantity} onChange={event=>onChange(lines.map((current,position)=>position===index?{...current,quantity:event.target.value}:current))}/><span>unit</span>
      <button type="button" aria-label={`Xóa thành phẩm con ${index+1}`} onClick={()=>onChange(lines.filter((_,position)=>position!==index))}>×</button>
    </div>)}
  </div>;
}

function CreateProductModal({
  api,
  materials,
  finishedProducts,
  onClose,
  onUpdated,
}: {
  api: Api;
  materials: InventoryItem[];
  finishedProducts: FinishedProduct[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [lines,setLines]=useState<FinishedStructureLine[]>([]);
  const [componentLines,setComponentLines]=useState<FinishedComponentStructureLine[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if(lines.some((line)=>!line.itemId)||componentLines.some(line=>!line.componentProductId)){setError("Chọn đủ mọi dòng Cấu thành");return;}
    setBusy(true); setError("");
    try {
      const product=await api.createFinishedProduct({
        name: String(f.get("name")),
        category: String(f.get("category")) as FinishedProductCategory,
        note:String(f.get("note")), minimumStock:Number(f.get("minimumStock")||0), openingQuantity: Number(f.get("openingQuantity") || 0),
      });
      if(lines.length||componentLines.length) await api.replaceBom(product.id,{items:lines.map(line=>({itemId:line.itemId,quantity:Number(line.quantity)})),components:componentLines.map(line=>({componentProductId:line.componentProductId,quantity:Number(line.quantity)}))});
      await onUpdated(); onClose();
    } catch(err) { setError(err instanceof Error?err.message:"Không lưu được thành phẩm"); }
    finally { setBusy(false); }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form className="createProductForm"
        onSubmit={(e) => void submit(e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>THÊM THÀNH PHẨM</h2>
        <label>
          Tên
          <input name="name" required />
        </label>
        <label>
          Loại thành phẩm
          <select name="category" defaultValue="CABLE" required>
            {FINISHED_PRODUCT_CATEGORIES.map(category=><option value={category} key={category}>{FINISHED_PRODUCT_CATEGORY_LABELS[category]}</option>)}
          </select>
        </label>
        <label>
          Tồn hiện tại (bộ)
          <input
            name="openingQuantity"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
          />
        </label>
        <label>Mức dự trữ<input name="minimumStock" type="number" min="0" step="1" defaultValue="0" /></label>
        <label>Ghi chú<textarea name="note" rows={2}/></label>
        <FinishedStructureLinesForm materials={materials} lines={lines} onChange={setLines}/>
        <FinishedComponentLinesForm products={finishedProducts} lines={componentLines} onChange={setComponentLines}/>
        {error&&<p className="error">{error}</p>}
        <div className="formActions">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary" disabled={busy}>{busy?"Đang lưu...":"Thêm thành phẩm"}</button>
        </div>
      </form>
    </div>
  );
}

function ProductDetailModal({
  api,
  product,
  materials,
  finishedProducts,
  people,
  admin,
  onClose,
  onUpdated,
  onImageUpdated,
}: {
  api: Api;
  product: FinishedProduct;
  materials: InventoryItem[];
  finishedProducts: FinishedProduct[];
  people: User[];
  admin: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  onImageUpdated: () => void;
}) {
  const [structureLines, setStructureLines] = useState<FinishedStructureLine[]>(() => product.bom.map((line) => ({itemId:line.itemId,quantity:String(Number(line.quantityPerProduct))})));
  const [componentLines,setComponentLines]=useState<FinishedComponentStructureLine[]>(()=>product.componentBom.map(line=>({componentProductId:line.componentProductId,quantity:String(Number(line.quantityPerProduct))})));
  const [structureBusy,setStructureBusy]=useState(false);
  const [structureError,setStructureError]=useState("");
  const [history, setHistory] = useState<FinishedProductTransaction[]>([]);
  const [movementType, setMovementType] = useState<FinishedProductTransactionType>("ADJUSTMENT");
  const [deleteBusy,setDeleteBusy]=useState(false);
  const [deleteError,setDeleteError]=useState("");
  useEffect(() => {
    void api.finishedProductTransactions(product.id).then(setHistory);
  }, [api, product.id]);
  async function edit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api.updateFinishedProduct(product.id, {
      name: String(f.get("name")),
      category: String(f.get("category")) as FinishedProductCategory,
      note: String(f.get("note")),
      minimumStock: Number(f.get("minimumStock")),
    });
    await onUpdated();
  }
  async function movement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await api.finishedProductMovement(product.id, {
      type: String(f.get("type")) as FinishedProductTransactionType,
      quantity: Number(f.get("quantity")),
      note: String(f.get("note")),
    });
    await onUpdated();
  }
  async function saveStructure() {
    if(structureLines.some((line)=>!line.itemId)||componentLines.some(line=>!line.componentProductId)){setStructureError("Chọn đủ mọi dòng Cấu thành");return;}
    setStructureBusy(true);setStructureError("");
    try {
      await api.replaceBom(product.id, {items:structureLines.map(line=>({itemId:line.itemId,quantity:Number(line.quantity)})),components:componentLines.map(line=>({componentProductId:line.componentProductId,quantity:Number(line.quantity)}))});
      await onUpdated();
    } catch(err) {setStructureError(err instanceof Error?err.message:"Không lưu được Cấu thành");}
    finally {setStructureBusy(false);}
  }
  async function removeProduct() {
    if(!window.confirm(`Xóa thành phẩm “${product.name}”? Các dòng BOM đang dùng thành phẩm này sẽ được tự gỡ; tồn và Logger vẫn được giữ lại.`))return;
    setDeleteBusy(true);setDeleteError("");
    try {await api.removeFinishedProduct(product.id);await onUpdated();}
    catch(err){setDeleteError(err instanceof Error?err.message:"Không xóa được thành phẩm");}
    finally{setDeleteBusy(false);}
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section
        className="inventoryDetail productDetail"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h2>{product.name}</h2>
            <small>
              {FINISHED_PRODUCT_CATEGORY_LABELS[product.category]} · Thành phẩm có thể bán lẻ
            </small>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="detailSummary">
          <b>{Number(product.onHandQty).toLocaleString("vi-VN")} unit</b>
          <span>{product.bom.length} vật tư · {product.componentBom.length} thành phẩm con</span>
        </div>
        <div className="detailGrid">
          <div>
            <form onSubmit={(e) => void edit(e)}>
              <h3>Thông tin thành phẩm</h3>
              <label>
                Tên
                <input name="name" defaultValue={product.name} required />
              </label>
              <label>
                Loại thành phẩm
                <select name="category" defaultValue={product.category} required>
                  {FINISHED_PRODUCT_CATEGORIES.map(category=><option value={category} key={category}>{FINISHED_PRODUCT_CATEGORY_LABELS[category]}</option>)}
                </select>
              </label>
              <label>
                Mức dự trữ
                <input
                  name="minimumStock"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={Number(product.minimumStock)}
                />
              </label>
              <label>
                Ghi chú
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={product.note ?? ""}
                />
              </label>
              <button>Lưu thông tin</button>
            </form>
            <form onSubmit={(e) => void movement(e)}>
              <h3>Tồn thành phẩm</h3>
              <select name="type" value={movementType} onChange={(event) => setMovementType(event.target.value as FinishedProductTransactionType)}>
                <option value="ADJUSTMENT">Xác nhận tồn (ghi đè)</option>
                <option value="PRODUCED">Sản xuất thêm (+)</option>
                <option value="OUT">Xuất hàng (-)</option>
              </select>
              <input
                name="quantity"
                type="number"
                min="0"
                step="1"
                required
                placeholder={movementType === "ADJUSTMENT" ? "Tồn thực tế" : "Số lượng"}
              />
              <input name="note" placeholder="Ghi chú" />
              <button className="primary">Ghi nhận</button>
            </form>
            {admin&&<section className="inventoryDangerZone"><div><b>Xóa thành phẩm</b><small>Chỉ ẩn khỏi Kho; tồn và Logger vẫn được lưu.</small></div><button type="button" disabled={deleteBusy} onClick={()=>void removeProduct()}>{deleteBusy?"Đang xóa...":"Xóa thành phẩm"}</button>{deleteError&&<p className="error">{deleteError}</p>}</section>}
          </div>
          <div className="finishedDetailRight">
            <div className="bomEditor">
              <FinishedStructureLinesForm materials={materials} lines={structureLines} onChange={setStructureLines}/>
              <FinishedComponentLinesForm products={finishedProducts} currentProductId={product.id} lines={componentLines} onChange={setComponentLines}/>
              {structureError&&<p className="error">{structureError}</p>}
              <div className="formActions">
                <button disabled={structureBusy} className="primary" onClick={() => void saveStructure()}>Lưu Cấu thành</button>
              </div>
            </div>
            <aside className="finishedLogger">
              <h3>Logger</h3>
              <small>Lịch sử tồn thành phẩm, mới nhất trước</small>
              <div className="productHistory">
                {history.map((row) => (
                  <div key={row.id}>
                    <b>{row.type}</b>
                    <span>{row.balanceBefore} → {row.balanceAfter} unit</span>
                    <small>
                      Người thực hiện: {people.find((p) => p.id === row.actorId)?.displayName ?? row.actorId.slice(0, 6)} · {new Date(row.createdAt).toLocaleString("vi-VN")}
                    </small>
                  </div>
                ))}
                {!history.length && <p>Chưa có hoạt động.</p>}
              </div>
            </aside>
            <InventoryImagePanel api={api} ownerType="FINISHED_PRODUCT" ownerId={product.id} label="Ảnh thành phẩm" className="finishedImages" onImageUpdated={onImageUpdated}/>
          </div>
        </div>
      </section>
    </div>
  );
}

type ProductStructureLine={finishedProductId:string;quantity:string};
type ProductMaterialStructureLine={itemId:string;quantity:string};
function ProductFinishedStructureLinesForm({finishedProducts,lines,onChange}:{finishedProducts:FinishedProduct[];lines:ProductStructureLine[];onChange:(lines:ProductStructureLine[])=>void}){
  const selected=new Set(lines.map(line=>line.finishedProductId).filter(Boolean));
  return <div className="structureLinesForm"><div className="structureLinesHeader"><h3>1 sản phẩm gồm</h3><button type="button" onClick={()=>onChange([...lines,{finishedProductId:"",quantity:"1"}])}>＋ Thêm thành phẩm</button></div>
    {!lines.length&&<p>Chưa có thành phẩm. Có thể bổ sung sau.</p>}
    {lines.map((line,index)=><div className="bomLine" key={`${index}-${line.finishedProductId}`}><select aria-label={`Thành phẩm cấu thành ${index+1}`} required value={line.finishedProductId} onChange={event=>onChange(lines.map((current,position)=>position===index?{...current,finishedProductId:event.target.value}:current))}><option value="">Chọn thành phẩm...</option>{finishedProducts.filter(item=>item.id===line.finishedProductId||!selected.has(item.id)).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><input aria-label={`Số lượng cấu thành sản phẩm ${index+1}`} type="number" min="1" step="1" required value={line.quantity} onChange={event=>onChange(lines.map((current,position)=>position===index?{...current,quantity:event.target.value}:current))}/><span>unit</span><button type="button" aria-label={`Xóa thành phẩm cấu thành ${index+1}`} onClick={()=>onChange(lines.filter((_,position)=>position!==index))}>×</button></div>)}
  </div>;
}

function ProductMaterialStructureLinesForm({inventoryItems,lines,onChange}:{inventoryItems:InventoryItem[];lines:ProductMaterialStructureLine[];onChange:(lines:ProductMaterialStructureLine[])=>void}){
  const selected=new Set(lines.map(line=>line.itemId).filter(Boolean));
  return <div className="structureLinesForm directMaterialStructure"><div className="structureLinesHeader"><div><h3>Vật tư đóng gói trực tiếp</h3><small>Vali, decal, kẹp… không phải thành phẩm.</small></div><button type="button" onClick={()=>onChange([...lines,{itemId:"",quantity:"1"}])}>＋ Thêm vật tư</button></div>
    {!lines.length&&<p>Chưa có vật tư đóng gói trực tiếp.</p>}
    {lines.map((line,index)=><div className="bomLine" key={`${index}-${line.itemId}`}><MaterialPicker materials={inventoryItems} selectedIds={selected} value={line.itemId} label={`Vật tư đóng gói ${index+1}`} onChange={itemId=>onChange(lines.map((current,position)=>position===index?{...current,itemId}:current))}/><input aria-label={`Số lượng vật tư đóng gói ${index+1}`} type="number" min="1" step="1" required value={line.quantity} onChange={event=>onChange(lines.map((current,position)=>position===index?{...current,quantity:event.target.value}:current))}/><span>unit</span><button type="button" aria-label={`Xóa vật tư đóng gói ${index+1}`} onClick={()=>onChange(lines.filter((_,position)=>position!==index))}>×</button></div>)}
  </div>;
}

function CreateSellableProductModal({api,finishedProducts,inventoryItems,onClose,onUpdated}:{api:Api;finishedProducts:FinishedProduct[];inventoryItems:InventoryItem[];onClose:()=>void;onUpdated:()=>Promise<void>}){
  const [lines,setLines]=useState<ProductStructureLine[]>([]);const [materialLines,setMaterialLines]=useState<ProductMaterialStructureLine[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(lines.some(line=>!line.finishedProductId)||materialLines.some(line=>!line.itemId)){setError("Chọn đầy đủ Cấu thành trước khi lưu");return;}const form=new FormData(event.currentTarget);setBusy(true);setError("");try{const product=await api.createSellableProduct({name:String(form.get("name")),note:String(form.get("note")),minimumStock:Number(form.get("minimumStock")||0),openingQuantity:Number(form.get("openingQuantity")||0)});if(lines.length||materialLines.length)await api.replaceSellableProductBom(product.id,{items:lines.map(line=>({finishedProductId:line.finishedProductId,quantity:Number(line.quantity)})),materials:materialLines.map(line=>({itemId:line.itemId,quantity:Number(line.quantity)}))});await onUpdated();onClose();}catch(err){setError(err instanceof Error?err.message:"Không lưu được sản phẩm");}finally{setBusy(false);}}
  return <div className="overlay" onMouseDown={onClose}><form className="createProductForm" onSubmit={event=>void submit(event)} onMouseDown={event=>event.stopPropagation()}><h2>THÊM SẢN PHẨM</h2><label>Tên sản phẩm<input name="name" required autoFocus/></label><label>Tồn hiện tại (bộ)<input name="openingQuantity" type="number" min="0" step="1" defaultValue="0"/></label><label>Mức dự trữ<input name="minimumStock" type="number" min="0" step="1" defaultValue="0"/></label><label>Ghi chú<textarea name="note" rows={2}/></label><ProductFinishedStructureLinesForm finishedProducts={finishedProducts} lines={lines} onChange={setLines}/><ProductMaterialStructureLinesForm inventoryItems={inventoryItems} lines={materialLines} onChange={setMaterialLines}/>{error&&<p className="error">{error}</p>}<div className="formActions"><button type="button" onClick={onClose}>Hủy</button><button className="primary" disabled={busy}>{busy?"Đang lưu...":"Thêm sản phẩm"}</button></div></form></div>;
}

function SellableProductDetailModal({api,product,finishedProducts,inventoryItems,people,admin,onClose,onUpdated,onImageUpdated}:{api:Api;product:SellableProduct;finishedProducts:FinishedProduct[];inventoryItems:InventoryItem[];people:User[];admin:boolean;onClose:()=>void;onUpdated:()=>Promise<void>;onImageUpdated:()=>void}){
  const [lines,setLines]=useState<ProductStructureLine[]>(()=>product.bom.map(line=>({finishedProductId:line.finishedProductId,quantity:String(Number(line.quantityPerProduct))})));const [history,setHistory]=useState<FinishedProductTransaction[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [materialLines,setMaterialLines]=useState<ProductMaterialStructureLine[]>(()=>product.materialBom.map(line=>({itemId:line.itemId,quantity:String(Number(line.quantityPerProduct))})));
  const [movementType,setMovementType]=useState<FinishedProductTransactionType>("ADJUSTMENT");
  const isEasyScan=normalizeMaterialSearch(product.name).includes("easyscan");
  const capacity=isEasyScan?calculateProductCapacity(product,finishedProducts,inventoryItems):null;
  useEffect(()=>{void api.sellableProductTransactions(product.id).then(setHistory);},[api,product.id]);
  async function edit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);await api.updateSellableProduct(product.id,{name:String(form.get("name")),note:String(form.get("note")),minimumStock:Number(form.get("minimumStock"))});await onUpdated();}
  async function movement(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);await api.sellableProductMovement(product.id,{type:String(form.get("type")) as FinishedProductTransactionType,quantity:Number(form.get("quantity")),note:String(form.get("note"))});await onUpdated();}
  async function saveStructure(){if(lines.some(line=>!line.finishedProductId)||materialLines.some(line=>!line.itemId)){setError("Chọn đầy đủ Cấu thành trước khi lưu");return;}setBusy(true);setError("");try{await api.replaceSellableProductBom(product.id,{items:lines.map(line=>({finishedProductId:line.finishedProductId,quantity:Number(line.quantity)})),materials:materialLines.map(line=>({itemId:line.itemId,quantity:Number(line.quantity)}))});await onUpdated();}catch(err){setError(err instanceof Error?err.message:"Không lưu được Cấu thành");}finally{setBusy(false);}}
  async function removeProduct(){if(!window.confirm(`Xóa sản phẩm “${product.name}”? Dữ liệu tồn và lịch sử vẫn được giữ lại.`))return;setBusy(true);setError("");try{await api.removeSellableProduct(product.id);await onUpdated();onClose();}catch(err){setError(err instanceof Error?err.message:"Không xóa được sản phẩm");}finally{setBusy(false);}}
  function downloadMaximumBom(){if(!capacity)return;const blob=new Blob([buildProductCapacityCsv(capacity)],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`bom-easyscan-toi-da-${currentVietnamDate()}.csv`;anchor.hidden=true;document.body.appendChild(anchor);anchor.click();anchor.remove();window.setTimeout(()=>URL.revokeObjectURL(url),0);}
  return <div className="overlay" onMouseDown={onClose}>
    <section className="inventoryDetail productDetail" onMouseDown={event=>event.stopPropagation()}>
      <header><div><h2>{product.name}</h2><small>Sản phẩm bán theo bộ</small></div><button onClick={onClose}>×</button></header>
      <div className="detailSummary"><b>{Number(product.onHandQty).toLocaleString("vi-VN")} bộ</b><span>{product.bom.length} thành phẩm · {product.materialBom.length} vật tư đóng gói</span>{admin&&capacity&&<div className="capacityExport"><span>Đóng thêm tối đa <b>{capacity.maxAdditionalUnits.toLocaleString("vi-VN")} bộ</b></span><button className="primary" onClick={downloadMaximumBom}>Xuất BOM tối đa</button></div>}</div>
      <InventoryImagePanel api={api} ownerType="SELLABLE_PRODUCT" ownerId={product.id} label="Ảnh sản phẩm" className="sellableImages" onImageUpdated={onImageUpdated}/>
      <div className="detailGrid"><div>
        <form onSubmit={event=>void edit(event)}><h3>Thông tin sản phẩm</h3><label>Tên<input name="name" defaultValue={product.name} required/></label><label>Mức dự trữ (bộ)<input name="minimumStock" type="number" min="0" step="1" defaultValue={Number(product.minimumStock)}/></label><label>Ghi chú<textarea name="note" rows={2} defaultValue={product.note??""}/></label><button>Lưu thông tin</button></form>
        <form onSubmit={event=>void movement(event)}><h3>Tồn sản phẩm</h3><select name="type" value={movementType} onChange={event=>setMovementType(event.target.value as FinishedProductTransactionType)}><option value="ADJUSTMENT">Xác nhận tồn (ghi đè)</option><option value="PRODUCED">Đóng bộ thêm (+)</option><option value="OUT">Xuất bán (-)</option></select><input name="quantity" type="number" min="0" step="1" required placeholder={movementType==="ADJUSTMENT"?"Tồn thực tế":"Số lượng"}/><input name="note" placeholder="Ghi chú"/><button className="primary">Ghi nhận</button><div className="productHistory">{history.map(row=><small key={row.id}>{row.type} · {row.balanceBefore} → {row.balanceAfter} · {people.find(person=>person.id===row.actorId)?.displayName??row.actorId.slice(0,6)}</small>)}</div></form>
        {admin&&<section className="inventoryDangerZone"><div><b>Xóa sản phẩm</b><small>Chỉ ẩn khỏi Kho; tồn và Logger vẫn được lưu.</small></div><button type="button" disabled={busy} onClick={()=>void removeProduct()}>{busy?"Đang xử lý...":"Xóa sản phẩm"}</button></section>}
      </div><div className="bomEditor">
        <ProductFinishedStructureLinesForm finishedProducts={finishedProducts} lines={lines} onChange={setLines}/>
        <ProductMaterialStructureLinesForm inventoryItems={inventoryItems} lines={materialLines} onChange={setMaterialLines}/>
        {error&&<p className="error">{error}</p>}<div className="formActions"><button disabled={busy} className="primary" onClick={()=>void saveStructure()}>Lưu Cấu thành</button></div>
      </div></div>
    </section>
  </div>;
}

function TeamDocument({ api, session, people }: { api: Api; session: Session; people: User[] }) {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [editing, setEditing] = useState<SharedDocument | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadDocuments = useCallback(async () => {
    try {
      setDocuments(await api.sharedDocuments());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được tài liệu.");
    }
  }, [api]);
  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);
  const ownerName = (id: string) => people.find((person) => person.id === id)?.displayName ?? "Thành viên";
  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title")).trim(),
      url: String(form.get("url")).trim(),
      description: String(form.get("description")).trim(),
    };
    setBusy(true);
    setError("");
    try {
      if (editing) await api.updateSharedDocument(editing.id, input);
      else await api.createSharedDocument(input);
      setEditing(null);
      setCreating(false);
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không lưu được tài liệu.");
    } finally {
      setBusy(false);
    }
  }
  async function removeDocument(document: SharedDocument) {
    if (!window.confirm(`Xóa tài liệu “${document.title}”?`)) return;
    setBusy(true);
    try {
      await api.removeSharedDocument(document.id);
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được tài liệu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="teamDocument">
      <header>
        <div>
          <h1>DOCUMENT</h1>
          <p>Link file mạch, sơ đồ dây và tài liệu dùng chung.</p>
        </div>
      </header>
      <section className="sharedDocuments">
        <div className="sharedDocumentsHead">
          <div><h2>CÁC TÀI LIỆU SHARE</h2><p>Link file mạch, sơ đồ dây và tài liệu dùng chung.</p></div>
          <button className="primary" onClick={() => { setEditing(null); setCreating(true); }}>＋ Thêm tài liệu</button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="sharedDocumentList">
          {documents.map((document) => {
            const canManage = session.user.role === "ADMIN" || document.createdById === session.user.id;
            return <article key={document.id}>
              <div><h3>{document.title}</h3>{document.description && <p>{document.description}</p>}<small>Thêm bởi {ownerName(document.createdById)} · {new Date(document.updatedAt).toLocaleDateString("vi-VN")}</small></div>
              <div className="sharedDocumentActions"><a href={document.url} target="_blank" rel="noreferrer">Mở link ↗</a>{canManage && <button onClick={() => { setCreating(false); setEditing(document); }}>Sửa</button>}{canManage && <button disabled={busy} onClick={() => void removeDocument(document)}>Xóa</button>}</div>
            </article>;
          })}
          {!documents.length && !error && <div className="emptySharedDocuments"><b>CHƯA CÓ TÀI LIỆU</b><p>Mọi thành viên có thể thêm link dùng chung.</p></div>}
        </div>
      </section>
      {(creating || editing) && <div className="overlay" onMouseDown={() => { setCreating(false); setEditing(null); }}>
        <form className="sharedDocumentForm" onSubmit={(event) => void saveDocument(event)} onMouseDown={(event) => event.stopPropagation()}>
          <h2>{editing ? "SỬA TÀI LIỆU" : "THÊM TÀI LIỆU"}</h2>
          <label>Tên tài liệu<input name="title" defaultValue={editing?.title ?? ""} required autoFocus /></label>
          <label>Link<input name="url" type="url" defaultValue={editing?.url ?? ""} placeholder="https://..." required /></label>
          <label>Mô tả ngắn<textarea name="description" rows={3} defaultValue={editing?.description ?? ""} /></label>
          {error && <p className="error">{error}</p>}
          <div className="formActions"><button type="button" onClick={() => { setCreating(false); setEditing(null); }}>Hủy</button><button className="primary" disabled={busy}>{busy ? "Đang lưu..." : "Lưu tài liệu"}</button></div>
        </form>
      </div>}
    </section>
  );
}

type NormalizationInput = {
  itemId: string;
  quantity: number;
  unit: InventoryUnit;
};
function NormalizationModal({
  items,
  onClose,
  onSubmit,
}: {
  items: InventoryItem[];
  onClose: () => void;
  onSubmit: (items: NormalizationInput[]) => Promise<boolean>;
}) {
  const pending = items.filter((item) => item.onHandQty === null);
  const [drafts, setDrafts] = useState(
    () =>
      Object.fromEntries(
        pending.map((item) => [
          item.id,
          {
            selected: false,
            quantity: item.normalizationSuggestion?.quantity?.toString() ?? "",
          },
        ]),
      ) as Record<string, { selected: boolean; quantity: string }>,
  );
  const [busy, setBusy] = useState(false);
  const selected = pending.filter((item) => drafts[item.id].selected);
  function update(id: string, patch: Partial<(typeof drafts)[string]>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }
  function selectSuggested() {
    setDrafts(
      (current) =>
        Object.fromEntries(
          Object.entries(current).map(([id, draft]) => [
            id,
            { ...draft, selected: draft.quantity !== "" },
          ]),
        ) as typeof current,
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected.length) return;
    setBusy(true);
    const ok = await onSubmit(
      selected.map((item) => ({
        itemId: item.id,
        quantity: Number(drafts[item.id].quantity),
        unit: "unit",
      })),
    );
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="normalizationModal"
        onSubmit={(e) => void submit(e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="normalizationTitle">
          <div>
            <h2>CHUẨN HÓA KHO</h2>
            <small>
              1 cuộn = 4.000 unit · 1 túi = 1.000 unit · Chỉ lưu dòng Admin đã
              chọn
            </small>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="normalizationToolbar">
          <button type="button" onClick={selectSuggested}>
            Chọn dòng có đề xuất
          </button>
          <b>
            {selected.length} / {pending.length} đã chọn
          </b>
        </div>
        <div className="normalizationList">
          {pending.map((item) => {
            const draft = drafts[item.id];
            return (
              <div className={draft.selected ? "selected" : ""} key={item.id}>
                <input
                  aria-label={`Chọn ${item.name}`}
                  type="checkbox"
                  checked={draft.selected}
                  onChange={(e) =>
                    update(item.id, { selected: e.target.checked })
                  }
                />
                <div>
                  <b>{item.name}</b>
                  <small>
                    {item.groupName} · Sheet: {item.sourceStockText || "trống"}
                  </small>
                  <em>{item.normalizationSuggestion?.reason}</em>
                </div>
                <input
                  aria-label={`Tồn đầu ${item.name}`}
                  type="number"
                  min="0"
                  step="1"
                  value={draft.quantity}
                  required={draft.selected}
                  placeholder="Tồn đầu"
                  onChange={(e) =>
                    update(item.id, { quantity: e.target.value })
                  }
                />
                <b className="fixedUnit">unit</b>
              </div>
            );
          })}
        </div>
        <div className="formActions">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary" disabled={busy || !selected.length}>
            {busy ? "Đang chuẩn hóa..." : `Xác nhận ${selected.length} dòng`}
          </button>
        </div>
      </form>
    </div>
  );
}

function HistoryModal({
  api,
  item,
  admin,
  onClose,
  onUpdated,
}: {
  api: Api;
  item: InventoryItem;
  admin: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [rows, setRows] = useState<InventoryTransaction[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void api
      .inventoryTransactions(item.id)
      .then(setRows)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Không tải được lịch sử"),
      );
  }, [api, item.id]);
  async function deactivate() {
    try {
      await api.updateInventoryItem(item.id, { isActive: false });
      await onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể ngưng sử dụng");
    }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <section
        className="historyModal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="historyTitle">
          <div>
            <h2>{item.name}</h2>
            <small>
              {item.groupName} ·{" "}
              {item.onHandQty === null
                ? "Chưa chuẩn hóa"
                : `${Number(item.onHandQty).toLocaleString("vi-VN")} ${item.unit}`}
            </small>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="historyList">
          {rows === null ? (
            <p>Đang tải...</p>
          ) : rows.length ? (
            rows.map((row) => (
              <div key={row.id}>
                <b>{row.type}</b>
                <span>
                  {Number(row.quantity).toLocaleString("vi-VN")} {row.unit}
                </span>
                <span>
                  {row.balanceBefore === null
                    ? "—"
                    : Number(row.balanceBefore).toLocaleString("vi-VN")}{" "}
                  → {Number(row.balanceAfter).toLocaleString("vi-VN")}
                </span>
                <small>
                  {row.reference || row.note || "—"} ·{" "}
                  {new Date(row.createdAt).toLocaleString("vi-VN")}
                </small>
              </div>
            ))
          ) : (
            <p>Chưa có giao dịch.</p>
          )}
        </div>
        {admin && (
          <div className="historyActions">
            <button className="danger" onClick={() => void deactivate()}>
              Ngưng sử dụng linh kiện
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function MovementModal({
  item,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSubmit: (input: {
    opening: boolean;
    type: InventoryTransactionType;
    quantity: number;
    unit?: string;
    note?: string;
    reference?: string;
  }) => Promise<boolean>;
}) {
  const opening = item.onHandQty === null;
  const [type, setType] = useState<InventoryTransactionType>(
    "ADJUSTMENT",
  );
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const ok = await onSubmit({
      opening,
      type,
      quantity: Number(f.get("quantity")),
      unit: String(f.get("unit") ?? ""),
      note: String(f.get("note") ?? ""),
      reference: String(f.get("reference") ?? ""),
    });
    setBusy(false);
    if (ok) onClose();
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        onSubmit={(e) => void submit(e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>{item.name}</h2>
        {opening ? (
          <p className="formHint">
            Tồn từ Sheet chưa được tự động quy đổi. Admin xác nhận số lượng mở
            đầu theo unit.
          </p>
        ) : (
          <label>
            Loại
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as InventoryTransactionType)
              }
            >
              <option value="ADJUSTMENT">Xác nhận tồn (ghi đè)</option>
              <option value="IN">Nhập kho (+)</option>
              <option value="OUT">Xuất kho (-)</option>
            </select>
          </label>
        )}
        <label>
          {opening || type === "ADJUSTMENT"
            ? "Tồn thực tế (unit)"
            : "Số lượng (unit)"}
          <input
            name="quantity"
            type="number"
            min="0"
            step="1"
            defaultValue={
              opening ? (item.normalizationSuggestion?.quantity ?? "") : ""
            }
            required
            autoFocus
          />
        </label>
        {opening && <input name="unit" type="hidden" value="unit" />}
        <label>
          Ghi chú
          <input name="note" />
        </label>
        {!opening && (
          <label>
            Tham chiếu
            <input name="reference" placeholder="Phiếu nhập/xuất..." />
          </label>
        )}
        <div className="formActions">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu giao dịch"}
          </button>
        </div>
      </form>
    </div>
  );
}

type TaskFormInput = { title: string; note: string; suggestion?: string; assigneeIds: string[]; criteria: string[] };

type TaskDraftInput = { topic: string; description?: string; assigneeIds: string[] };

function TaskDraftFormModal({ people, onClose, onSubmit }: { people: User[]; onClose: () => void; onSubmit: (input: TaskDraftInput) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const description = String(form.get("description")).trim();
    const ok = await onSubmit({ topic: String(form.get("topic")), assigneeIds, ...(description ? { description } : {}) });
    setBusy(false);
    if (ok) onClose();
  }
  return <div className="overlay" onMouseDown={onClose}><form className="taskForm draftForm" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}><h2>THÊM VIỆC VÀO TASK</h2><p>Chỉ cần Topic. Các mục còn lại có thể hoàn thiện sau.</p><label>Topic<input name="topic" required maxLength={80} autoFocus placeholder="Ví dụ: KEYBOX"/></label><label>Việc đang nghĩ tới<textarea name="description" rows={3} placeholder="Có thể để trống"/></label><AssigneeOrderPicker people={people} selected={assigneeIds} onChange={setAssigneeIds}/><div className="formActions"><button type="button" onClick={onClose}>Hủy</button><button className="primary" disabled={busy}>{busy ? "Đang lưu..." : "Lưu việc"}</button></div></form></div>;
}

export function TaskFormModal({ task, draft, people, onClose, onSubmit, onSaveDraft }: { task?: Task; draft?: TaskDraft; people: User[]; onClose: () => void; onSubmit: (input: TaskFormInput) => Promise<boolean>; onSaveDraft?: (input: TaskFormInput) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(() => task?.assignees.map((assignment) => assignment.userId) ?? draft?.assigneeIds ?? []);
  const [criteria, setCriteria] = useState<string[]>(() => task?.criteria.map((criterion) => criterion.text) ?? (draft?.criteria.length ? draft.criteria : [""]));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const saveDraft = !!draft && (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'promote';
    const input = {
      title: String(f.get("title")).trim(),
      note: String(f.get("note")).trim(),
      suggestion: String(f.get("suggestion")).trim(),
      assigneeIds,
      criteria: criteria.map((criterion) => criterion.trim()).filter(Boolean),
    };
    if (!input.title) { setError('Nhập Topic để lưu.'); return; }
    if (!saveDraft && !task && (!assigneeIds.length || !input.note || !input.criteria.length)) {
      setError('Cần mô tả, checklist và người phụ trách để hoàn thiện Task. Bạn vẫn có thể lưu ở Backlog.'); return;
    }
    const action = saveDraft ? onSaveDraft : onSubmit;
    if (!action) return;
    setError('');
    setBusy(true);
    try { if (await action(input)) onClose(); } finally { setBusy(false); }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <form
        className="taskForm"
        onSubmit={(e) => void submit(e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>{task ? "SỬA TASK" : draft ? "BỔ SUNG TASK BACKLOG" : "TẠO TASK"}</h2>
        <label>
          Topic
          <input
            name="title"
            maxLength={draft ? 80 : 240}
            defaultValue={task ? (task.note ? task.title : "") : draft?.topic ?? ""}
            required
            autoFocus
            placeholder="Ví dụ: SCANBOX"
          />
        </label>
        <label>
          Mô tả
          <textarea
            name="note"
            maxLength={2000}
            defaultValue={task ? (task.note ?? task.title) : draft?.description ?? ""}
            required={!draft}
            rows={8}
            placeholder="Mô tả việc và kết quả cần giao"
          />
        </label>
        <label>
          Gợi ý / tài liệu
          <textarea name="suggestion" defaultValue={task?.suggestion ?? draft?.suggestion ?? ""} maxLength={2000} rows={2} placeholder="Cách tiếp cận, link hoặc lưu ý — có thể để trống"/>
        </label>
        <CriteriaEditor values={criteria} onChange={setCriteria} required={!draft}/>
        <AssigneeOrderPicker people={people} previousPeople={task?.assignees.map(assignment => assignment.user) ?? draft?.assignees ?? []} selected={assigneeIds} onChange={setAssigneeIds}/>
        {!assigneeIds.length&&<p>{task||draft?'Chưa giao · Có thể lưu và giao người phụ trách sau.':'Chọn ít nhất một người phụ trách để tạo Task.'}</p>}
        {draft&&<p>Lưu để giữ việc ở Backlog. Chỉ hoàn thiện Task khi đã đủ thông tin.</p>}
        {error&&<p role="alert">{error}</p>}
        <div className="formActions">
          <button type="button" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button className="primary" disabled={busy} type="submit" value="save">
            {busy ? "Đang lưu..." : task ? "Lưu" : draft ? "Lưu — giữ Backlog" : "Tạo Task"}
          </button>
          {draft&&<button type="submit" value="promote" disabled={busy}>Hoàn thiện Task</button>}
        </div>
      </form>
    </div>
  );
}

function ClaimDraftModal({ draft, onClose, onSubmit }: { draft: TaskDraft; onClose: () => void; onSubmit: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const ok = await onSubmit();
    setBusy(false);
    if (ok) onClose();
  }
  return <div className="overlay" onMouseDown={onClose}>
    <form className="taskForm claimDraftForm" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
      <div className="claimDraftHead"><div><b className="taskTopic" style={topicColor(draft.topic)}>{draft.topic}</b><h2>NHẬN VIỆC</h2></div></div>
      <section><small>MÔ TẢ</small><p>{draft.description}</p></section>
      <section><small>XONG KHI · {draft.criteria.length}</small><ol>{draft.criteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ol></section>
      <p className="claimNote">Sau khi nhận, Task chuyển sang Đang làm. Worklog thực tế có thể gắn với Task này.</p>
      <div className="formActions"><button type="button" onClick={onClose}>Hủy</button><button className="primary" disabled={busy}>{busy ? "Đang nhận..." : "Xác nhận nhận việc"}</button></div>
    </form>
  </div>;
}

function currentVietnamMonth() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export function currentVietnamDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function worklogDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const WORKLOG_VALUE_LEVELS:Record<WorklogValueLevel,{label:string;rate:number}> = {
  BASIC:{label:"BASIC",rate:50},
  DEV:{label:"DEV",rate:100},
  RND:{label:"R&D",rate:300},
};

function worklogStabilityRate(reopenCount:number,stabilityConfirmed=false) { return reopenCount === 0 && stabilityConfirmed ? 1 : 0.8; }
export function calculateWorklogPoint(valueLevel:WorklogValueLevel,standardHours:number,completionRate:number,reopenCount:number,stabilityConfirmed=false) {
  return Math.round(standardHours * WORKLOG_VALUE_LEVELS[valueLevel].rate * completionRate * worklogStabilityRate(reopenCount,stabilityConfirmed));
}
export function worklogStatusLabel(status:WorklogStatus, progress?:{achieved:number;total:number}|null) {
  if (status === "OPEN") return "ĐANG LÀM";
  if (status === "ENDED") return "KHÔNG HOÀN THÀNH";
  if (status === "DONE") return progress ? `HOÀN THÀNH (${progress.achieved}/${progress.total})` : "HOÀN THÀNH";
  return status;
}
function pendingWorklogStabilityPoint(log:Worklog) {
  if (log.point === null || !log.valueLevel || log.workType === "REOPEN" || log.stabilityStatus === "CONFIRMED" || (log.reopenCount ?? 0) > 0) return 0;
  const fullPoint=calculateWorklogPoint(log.valueLevel,Number(log.standardHours??log.hoursWorked??0),Number(log.completionRate??0),0,true);
  return Math.max(0,fullPoint-log.point);
}

const DEFAULT_WEEKLY_TARGET_HOURS = 40;
const WEEKLY_TARGET_HOURS_BY_USERNAME:Record<string,number> = { vinh:30 };

export function weeklyWorklogPerformance(member: Pick<WorklogSummary, "hours"> & Partial<Pick<WorklogSummary,"username">>) {
  const targetHours = WEEKLY_TARGET_HOURS_BY_USERNAME[member.username?.toLowerCase() ?? ""] ?? DEFAULT_WEEKLY_TARGET_HOURS;
  return {
    targetHours,
    capacityPercent: Math.min(100, Number((member.hours / targetHours * 100).toFixed(1))),
    overtimeHours: Math.max(0, Number((member.hours - targetHours).toFixed(2))),
  };
}

export function weeklyWorklogInsight(member: WorklogSummary) {
  const performance = weeklyWorklogPerformance(member);
  const linkedPercent = member.worklogs > 0 ? Math.round(member.linkedWorklogs / member.worklogs * 100) : 0;
  const capacity = performance.capacityPercent >= 100
    ? `Đã đủ nhịp ${performance.targetHours}h tuần${performance.overtimeHours > 0 ? ` và vượt ${performance.overtimeHours.toLocaleString("vi-VN",{maximumFractionDigits:2})}h` : ""}.`
    : performance.capacityPercent >= 70
      ? `Đạt ${performance.capacityPercent}% nhịp H tuần; còn ${Math.max(0,performance.targetHours-member.hours).toLocaleString("vi-VN",{maximumFractionDigits:2})}h so với mục tiêu.`
      : `Mẫu tuần mới đạt ${performance.capacityPercent}% nhịp H; chưa nên kết luận năng lực chỉ từ tổng Point.`;
  const conversion = member.productiveBasePoint + member.endedBasePoint <= 0
    ? "Chưa đủ dữ liệu Value để đọc tỷ lệ chuyển hoá."
    : member.conversionPercent >= 80
      ? `Khép kết quả tốt: ${member.conversionPercent.toLocaleString("vi-VN",{maximumFractionDigits:1})}% giá trị đã chuyển thành Output.`
      : member.conversionPercent >= 65
        ? `Khép kết quả ở mức khá (${member.conversionPercent.toLocaleString("vi-VN",{maximumFractionDigits:1})}%); nên chốt OUT rõ hơn trước khi bắt đầu.`
        : `Cần cải thiện khép Output (${member.conversionPercent.toLocaleString("vi-VN",{maximumFractionDigits:1})}%); ưu tiên chia Worklog nhỏ và kiểm đủ OUT trước khi hoàn thành.`;
  const mix = member.rndWorklogs > 0
    ? `${member.rndWorklogs} R&D / ${member.devWorklogs} DEV / ${member.basicWorklogs} BASIC trong ${member.worklogs} Worklog.`
    : member.devWorklogs > member.basicWorklogs
      ? `${member.devWorklogs} DEV / ${member.basicWorklogs} BASIC trong ${member.worklogs} Worklog.`
      : `${member.basicWorklogs} BASIC / ${member.devWorklogs} DEV trong ${member.worklogs} Worklog.`;
  const discipline = member.worklogs > 0
    ? `${linkedPercent}% Worklog có Task nguồn${member.reopenWorklogs > 0 ? `; có ${member.reopenWorklogs} RE-OPEN cần xem lại bước test` : "; chưa có RE-OPEN"}.`
    : "Chưa có Worklog để đánh giá kỷ luật liên kết Task.";
  const evidence = member.v2Worklogs === 0
    ? "Dữ liệu tuần này là V1: tỷ lệ trên chưa phải checklist OUT X/Y và chưa đủ để kết luận Reliability."
    : `${member.v2Worklogs}/${member.worklogs} Worklog đã dùng checklist OUT V2; Reliability chỉ chốt sau giai đoạn ổn định.`;
  const summary = member.worklogs === 0
    ? "Chưa có Worklog trong tuần."
    : member.v2Worklogs === 0
      ? `${member.hours.toLocaleString("vi-VN",{maximumFractionDigits:2})}/${performance.targetHours}h · ${member.point.toLocaleString("vi-VN")} Point. Chưa có OUT checklist mới nên chưa đủ dữ liệu kết luận hiệu suất.`
      : `${member.hours.toLocaleString("vi-VN",{maximumFractionDigits:2})}/${performance.targetHours}h · ${member.conversionPercent.toLocaleString("vi-VN",{maximumFractionDigits:1})}% Output · ${member.point.toLocaleString("vi-VN")} Point hiện có.`;
  const missingTaskLinks = Math.max(0,member.worklogs-member.linkedWorklogs);
  const nextAction = member.reopenWorklogs > 0
    ? `${member.reopenWorklogs} Worklog RE-OPEN cần kiểm tra.`
    : missingTaskLinks > 0
      ? `${missingTaskLinks} Worklog chưa gắn Task nguồn.`
      : member.pendingStabilityPoint > 0
        ? `${member.pendingStabilityPoint.toLocaleString("vi-VN")} Point đang chờ ổn định.`
        : "Không có mục cần kiểm tra từ dữ liệu hiện tại.";
  return { capacity, conversion, mix, discipline, evidence, summary, nextAction, linkedPercent };
}

export function worklogConversionLabel(member: Pick<WorklogSummary, "conversionPercent"|"productiveBasePoint"|"endedBasePoint">) {
  if (member.productiveBasePoint + member.endedBasePoint <= 0) return "—";
  return `${member.conversionPercent.toLocaleString("vi-VN",{maximumFractionDigits:1})}%`;
}

export function worklogCapitalLabel(member: Pick<WorklogSummary, "capitalPoint"|"ended"|"endedBasePoint">) {
  if (member.ended > 0 && member.endedBasePoint <= 0) return "Chưa xếp mức";
  return member.capitalPoint.toLocaleString("vi-VN");
}

export function weeklyAchievedOutputLabels(logs:Worklog[],userId:string,weekStart:string,weekEnd:string) {
  const outputs=logs.filter((log)=>log.userId===userId&&currentVietnamDate(new Date(log.startedAt))>=weekStart&&currentVietnamDate(new Date(log.startedAt))<=weekEnd).flatMap((log)=>{
    const achieved=(log.outputCriteria??[]).filter((criterion)=>criterion.achieved===true).map((criterion)=>criterion.actual?.trim()||criterion.expected.trim()).filter(Boolean);
    if(achieved.length)return achieved;
    return log.status==='DONE'&&log.output?.trim()?[log.output.trim()]:[];
  });
  return [...new Set(outputs)];
}

export function formatWorklogWeek(weekStart:string,weekEnd:string) {
  const format = (value:string) => { const [,month,day]=value.split("-"); return `${day}/${month}`; };
  return `${format(weekStart)} – ${format(weekEnd)}`;
}

function notificationAppearance(item:AppNotification) {
  if(item.kind==='PRODUCTION_PAYMENT_READY')return {tone:'attention',label:'Chờ thanh toán',icon:'clock'};
  const event=item.eventType;
  if(event==='INVENTORY_COUNT_ASSIGNED')return {tone:'attention',label:'Yêu cầu kiểm kho',icon:'clock'};
  if(event==='INVENTORY_COUNT_COMPLETED')return {tone:'success',label:'Đã kiểm kho',icon:'check'};
  if(item.personalKind==='MENTION')return {tone:'comment',label:'Nhắc đến bạn',icon:'comment'};
  if(item.kind==='TASK_COMMENT'||item.kind==='TASK_MENTION'||event==='WORKLOG_COMMENT'||event==='WORKLOG_MENTION')return {tone:'comment',label:'Bình luận',icon:'comment'};
  if(event==='PURCHASE_REQUEST_RECEIVED')return {tone:'success',label:'Đã nhận hàng',icon:'check'};
  if(event==='PRODUCTION_PAYMENT_PAID')return {tone:'success',label:'Đã thanh toán',icon:'check'};
  if(event==='COMPLETED')return {tone:'success',label:'Hoàn thành',icon:'check'};
  if(event==='DONE')return {tone:'attention',label:'Chờ duyệt',icon:'clock'};
  if(event==='RISK_REPORTED')return {tone:'attention',label:'Báo rủi ro',icon:'alert'};
  if(event==='REOPENED')return {tone:'attention',label:'Mở lại',icon:'alert'};
  if(item.personalKind==='ASSIGNED'||event==='ASSIGNED'||event==='PURCHASE_BUYER_ASSIGNED')return {tone:'attention',label:'Giao việc',icon:'clock'};
  if(event==='PURCHASE_REQUEST_CANCELLED'||event==='DELETED'||event==='ARCHIVED')return {tone:'neutral',label:event==='PURCHASE_REQUEST_CANCELLED'?'Đã huỷ':event==='DELETED'?'Đã xoá':'Lưu trữ',icon:'archive'};
  return {tone:'update',label:'Cập nhật',icon:'edit'};
}

function notificationIcon(icon:string) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon==='comment'?<path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z"/>:icon==='check'?<><path d="m7 12 3 3 7-7"/><circle cx="12" cy="12" r="9"/></>:icon==='clock'?<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>:icon==='alert'?<><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/></>:icon==='archive'?<><path d="M4 8h16v13H4zM3 3h18v5H3zm7 9h4"/></>:<><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z"/></>}</svg>;
}

function NotificationCenter({notifications,onOpen,onReadAll,ready}:{notifications:AppNotification[];onOpen:(notification:AppNotification,element:HTMLButtonElement)=>Promise<void>;onReadAll:()=>Promise<void>;ready:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const [unreadOnly,setUnreadOnly]=useState(false);
  const [selectedKey,setSelectedKey]=useState<string|null>(null);
  const keyOf=(item:AppNotification)=>`${item.kind}-${item.id}`;
  const unread=notifications.filter(item=>!item.readAt).length;
  const startupChecked=useRef(false);
  useEffect(()=>{
    if(!ready||startupChecked.current)return;
    startupChecked.current=true;
    if(unread>0){setUnreadOnly(true);dialog.current?.showModal();}
  },[ready,unread]);
  const visible=notifications.filter(item=>!unreadOnly||!item.readAt);
  const selected=visible.find(item=>keyOf(item)===selectedKey)??visible[0];
  const title=(item:AppNotification)=>item.kind==='PRODUCTION_PAYMENT_READY'?`${item.memberName} · Kết công`:item.kind==='SYSTEM_EVENT'?item.entityLabel:item.topic;
  const message=(item:AppNotification)=>item.kind==='PRODUCTION_PAYMENT_READY'?`${item.sessionDates.map(date=>formatShortDate(date)).join(' · ')} · ${Number(item.totalHours)} giờ`:`${item.actorName} ${item.message}`;
  const actorName=(item:AppNotification)=>item.kind==='PRODUCTION_PAYMENT_READY'?item.memberName:item.actorName||'Hệ thống';
  const eventBadge=(item:AppNotification)=>{const appearance=notificationAppearance(item);return <span className={`noticeEventBadge noticeTone-${appearance.tone}`}><span className="noticeEventIcon">{notificationIcon(appearance.icon)}</span><small>{appearance.label}</small></span>;};
  function close(){dialog.current?.close();trigger.current?.focus();}
  return <><button ref={trigger} type="button" className="noticeTrigger" aria-label={`Thông báo, ${unread} chưa đọc`} onClick={()=>dialog.current?.showModal()}>🔔{unread>0&&<b>{unread}</b>}</button>
    {createPortal(<dialog ref={dialog} className="noticeCenter" aria-labelledby="noticeTitle" onClick={event=>{if(event.target===dialog.current)close();}}>
      <header><div><h2 id="noticeTitle">Thông báo</h2><p>{unread} chưa đọc · {notifications.length} thông báo</p></div><button type="button" aria-label="Đóng thông báo" onClick={close}>×</button></header>
      <div className="noticeToolbar"><button type="button" aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>Tất cả</button><button type="button" aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Chưa đọc ({unread})</button><button type="button" disabled={!unread} onClick={()=>void onReadAll()}>Đánh dấu tất cả đã đọc</button></div>
      <div className="noticeColumns"><nav aria-label="Danh sách thông báo"><div className="noticeListHeader"><b>DANH SÁCH</b><span>{visible.length}</span></div>{visible.map(item=><button type="button" key={keyOf(item)} className={`${selected&&keyOf(selected)===keyOf(item)?'selected ':''}${item.readAt?'read':'unread'}`} aria-current={selected&&keyOf(selected)===keyOf(item)?'true':undefined} onClick={()=>setSelectedKey(keyOf(item))}><span className="noticeListMeta">{eventBadge(item)}{!item.readAt&&<span className="noticeUnreadDot" role="img" aria-label="Chưa đọc"/>}</span><strong>{title(item)}</strong><span>{message(item)}</span><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time></button>)}{!visible.length&&<p>Không có thông báo {unreadOnly?'chưa đọc':''}.</p>}</nav>
      <section aria-label="Chi tiết thông báo">{selected?<><div className={`noticeDetailCard noticeTone-${notificationAppearance(selected).tone}`}>{eventBadge(selected)}<div className="noticeDetailActor"><small className={`noticeDetailState ${selected.readAt?'read':'unread'}`}><b>{actorName(selected)}</b><span>{selected.readAt?'Đã đọc':'● Chưa đọc'}</span><time>{new Date(selected.createdAt).toLocaleString('vi-VN')}</time></small></div><h3>{title(selected)}</h3><p className="noticeEvent">{message(selected)}</p>{selected.kind!=='PRODUCTION_PAYMENT_READY'&&selected.bodyPreview&&<p className="noticeBody">{selected.bodyPreview}</p>}</div><footer className="noticeDetailActions"><button type="button" className="primary" onClick={event=>{close();void onOpen(selected,event.currentTarget);}}>Mở công việc <span aria-hidden="true">→</span></button><small>Thông báo được đánh dấu đã đọc khi mở công việc.</small></footer></>:<p className="noticeEmptyDetail">Chọn thông báo để xem nội dung.</p>}</section></div>
    </dialog>,document.body)}</>;
}

export function personalUnreadNotifications(notifications:AppNotification[]) {
  return notifications.filter((notification): notification is Extract<AppNotification,{personalKind:'ASSIGNED'|'MENTION'|null}> =>
    notification.kind !== "PRODUCTION_PAYMENT_READY"
      && (notification.personalKind === "ASSIGNED" || notification.personalKind === "MENTION")
      && notification.readAt === null,
  );
}

export function pendingPersonalNoticeNotifications(notifications:AppNotification[],acknowledgedIds:string[]) {
  const acknowledged = new Set(acknowledgedIds);
  return personalUnreadNotifications(notifications).filter((notification) => !acknowledged.has(notification.id));
}

export function worklogOutputParts(value:string) {
  const parts:{text:string;href?:string}[] = [];
  const pattern = /https?:\/\/[^\s<>"']+/gi;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({text:value.slice(cursor,start)});
    const matched = match[0];
    const url = matched.replace(/[),.;!?]+$/g,"");
    const trailing = matched.slice(url.length);
    if (url) parts.push({text:url,href:url});
    if (trailing) parts.push({text:trailing});
    cursor = start + matched.length;
  }
  if (cursor < value.length) parts.push({text:value.slice(cursor)});
  return parts.length ? parts : [{text:value}];
}

function WorklogOutputText({value}:{value:string}) {
  return <>{worklogOutputParts(value).map((part,index)=>part.href
    ? <a href={part.href} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()} key={`${part.href}-${index}`}>{part.text}</a>
    : <span key={`text-${index}`}>{part.text}</span>)}</>;
}

function latestWorklogReport(worklog:Worklog) {
  const comments=worklog.comments??[];
  return comments.length ? comments[comments.length-1].body : worklog.output??"";
}

function newWorklogCriterion():WorklogOutputCriterion {
  return {id:`out-${Date.now()}-${Math.random().toString(16).slice(2)}`,expected:"",actual:null,achieved:null};
}

function worklogOutputProgress(worklog:Worklog) {
  const criteria=worklog.outputCriteria??[];
  if(!criteria.length)return null;
  return {achieved:criteria.filter(item=>item.achieved===true).length,total:criteria.length};
}

function WorklogComments({api,worklogId,initialComments,people}:{api:Api;worklogId:string;initialComments:WorklogComment[];people:User[]}) {
  const [comments,setComments]=useState(initialComments);
  const [body,setBody]=useState("");
  const [mentionedIds,setMentionedIds]=useState<string[]>([]);
  const [image,setImage]=useState<File|null>(null);
  const [imagePreview,setImagePreview]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>setComments(initialComments),[initialComments]);
  useEffect(()=>()=>{if(imagePreview)URL.revokeObjectURL(imagePreview);},[imagePreview]);
  const mentionQuery=body.match(/@([^@\s]*)$/)?.[1]?.toLocaleLowerCase("vi");
  const suggestions=mentionQuery===undefined?[]:people.filter(person=>person.displayName.toLocaleLowerCase("vi").includes(mentionQuery));
  function chooseMention(person:User){
    setBody(current=>current.replace(/@([^@\s]*)$/,`@${person.displayName} `));
    setMentionedIds(current=>current.includes(person.id)?current:[...current,person.id]);
  }
  async function submit(){
    const text=body.trim();
    if((!text&&!image)||busy)return;
    setBusy(true);setError("");
    try{
      const activeMentions=mentionedIds.filter(id=>{
        const person=people.find(candidate=>candidate.id===id);
        return person&&text.includes(`@${person.displayName}`);
      });
      const saved=await api.commentWorklog(worklogId,{body:text,mentionedUserIds:activeMentions,image});
      if(imagePreview)URL.revokeObjectURL(imagePreview);
      setComments(current=>[...current,saved]);setBody("");setMentionedIds([]);setImage(null);setImagePreview(null);
    }catch(cause){setError(cause instanceof Error?cause.message:"Không gửi được comment");}
    finally{setBusy(false);}
  }
  return <section className="worklogComments">
    <header><div><b>TRAO ĐỔI</b><small>Hỏi đáp, bằng chứng và cập nhật tiếp theo</small></div><span>{comments.length} comment</span></header>
    <div className="worklogCommentList">{comments.map(comment=><article key={comment.id}>
      <span className="avatar" style={{backgroundColor:avatarColor(comment.author.id,comment.author.displayName)}}><AvatarContent userId={comment.author.id} name={comment.author.displayName}/></span>
      <div><b>{comment.author.displayName}</b><time>{new Date(comment.createdAt).toLocaleString("vi-VN")}</time>{comment.body&&<p><LinkedText text={comment.body}/></p>}{comment.imageUrl&&<WorklogCommentImage api={api} imageUrl={comment.imageUrl} author={comment.author.displayName}/>}</div>
    </article>)}{!comments.length&&<p className="worklogCommentEmpty">Chưa có trao đổi.</p>}</div>
    {error&&<p className="error">{error}</p>}
    <div className="worklogCommentComposer">
      <textarea rows={3} maxLength={4000} value={body} onChange={event=>setBody(event.target.value)} placeholder="Viết comment, gõ @ để tag thành viên..."/>
      {imagePreview&&<div className="commentImagePreview"><img src={imagePreview} alt="Ảnh chuẩn bị gửi"/><button type="button" onClick={()=>{URL.revokeObjectURL(imagePreview);setImage(null);setImagePreview(null);}}>×</button></div>}
      {suggestions.length>0&&<div className="mentionSuggestions">{suggestions.map(person=><button type="button" key={person.id} onClick={()=>chooseMention(person)}><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span>{person.displayName}</button>)}</div>}
      <div><label className="commentImageButton">＋ Ảnh<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0]??null;if(!file)return;if(file.size>2*1024*1024){setError("Ảnh tối đa 2 MB");event.target.value="";return;}if(imagePreview)URL.revokeObjectURL(imagePreview);setImage(file);setImagePreview(URL.createObjectURL(file));setError("");}}/></label><small>JPEG, PNG, WebP · tối đa 2 MB</small><button type="button" className="primary" disabled={(!body.trim()&&!image)||busy} onClick={()=>void submit()}>{busy?"Đang gửi...":"Gửi"}</button></div>
    </div>
  </section>;
}

function InitialWorklogReport({body,setBody,mentionedIds,setMentionedIds,people}:{body:string;setBody:(value:string)=>void;mentionedIds:string[];setMentionedIds:(value:string[])=>void;people:User[]}) {
  const mentionQuery=body.match(/@([^@\s]*)$/)?.[1]?.toLocaleLowerCase("vi");
  const suggestions=mentionQuery===undefined?[]:people.filter(person=>person.displayName.toLocaleLowerCase("vi").includes(mentionQuery));
  function chooseMention(person:User){
    setBody(body.replace(/@([^@\s]*)$/,`@${person.displayName} `));
    if(!mentionedIds.includes(person.id))setMentionedIds([...mentionedIds,person.id]);
  }
  return <section className="worklogComments worklogInitialReport">
    <header><div><b>TRAO ĐỔI ĐẦU TIÊN</b><small>Có thể để trống và cập nhật sau</small></div><span>Comment</span></header>
    <div className="worklogCommentComposer">
      <textarea rows={9} maxLength={4000} value={body} onChange={event=>setBody(event.target.value)} placeholder="Câu hỏi, bằng chứng, vướng mắc hoặc bước tiếp theo. Gõ @ để tag thành viên..."/>
      {suggestions.length>0&&<div className="mentionSuggestions">{suggestions.map(person=><button type="button" key={person.id} onClick={()=>chooseMention(person)}><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span>{person.displayName}</button>)}</div>}
      <div><small>Text thuần · Lưu Worklog sẽ đăng báo cáo này</small></div>
    </div>
  </section>;
}

type WorklogFormValue = { userId?:string; primaryTaskId?:string; taskIds:string[]; input:string; outputCriteria?:WorklogOutputCriterion[]; links:string[]; initialReport?:string; initialMentionedUserIds:string[]; startedAt:string; hoursWorked?:number; valueLevel:WorklogValueLevel; workType:WorklogType; reopenedWorklogId?:string; status:WorklogStatus };

export function filterWorklogSourceTasks(tasks: Task[], query: string) {
  const normalizedQuery = normalizeMaterialSearch(query);
  return tasks.filter((task) => ["BACKLOG", "ACTIVE"].includes(task.status) && (!normalizedQuery || normalizeMaterialSearch(`${task.title} ${task.note ?? ""}`).includes(normalizedQuery)));
}

export function worklogSourceIds(primaryTaskId:string|null|undefined, tasks:{id:string}[]) {
  return [...new Set([...(primaryTaskId?[primaryTaskId]:[]),...tasks.map(task=>task.id)])];
}
export function addWorklogSource(ids:string[],id:string) {
  return !id||ids.includes(id)||ids.length>=10?ids:[...ids,id];
}
export function worklogMatchesSource(log:{primaryTaskId:string|null;tasks:{id:string}[]},id:string) {
  return !id||worklogSourceIds(log.primaryTaskId,log.tasks).includes(id);
}

function WorklogEditor({ api, worklog, currentUser, people, tasks, worklogs, busy, readOnly=false, onClose, onSave, onUpdated }: { api:Api; worklog:Worklog|null; currentUser:User; people:User[]; tasks:Task[]; worklogs:Worklog[]; busy:boolean; readOnly?:boolean; onClose:()=>void; onSave:(value:WorklogFormValue)=>Promise<void>; onUpdated:()=>Promise<void> }) {
  const usesOutputCriteria = !worklog || worklog.resultModelVersion === 2;
  const initialStatus:WorklogStatus = usesOutputCriteria&&worklog?.status==="ENDED" ? "DONE" : worklog?.status ?? "OPEN";
  const [status, setStatus] = useState<WorklogStatus>(initialStatus);
  const [valueLevel, setValueLevel] = useState<WorklogValueLevel|"">(worklog?.valueLevel ?? "");
  const [workType, setWorkType] = useState<WorklogType>(worklog?.workType ?? "NORMAL");
  const [reopenedWorklogId, setReopenedWorklogId] = useState(worklog?.reopenedWorklogId ?? "");
  const [links, setLinks] = useState<string[]>(worklog?.links??[]);
  const [initialReport,setInitialReport]=useState("");
  const [initialMentionedUserIds,setInitialMentionedUserIds]=useState<string[]>([]);
  const [selectedTaskIds,setSelectedTaskIds]=useState(()=>worklogSourceIds(worklog?.primaryTaskId,worklog?.tasks??[]));
  const primaryTaskId=selectedTaskIds[0]??"";
  const [outputCriteria,setOutputCriteria]=useState<WorklogOutputCriterion[]>(()=>usesOutputCriteria&&worklog?.outputCriteria?.length?worklog.outputCriteria:[newWorklogCriterion(),newWorklogCriterion()]);
  const [sourceError, setSourceError] = useState("");
  const [stabilityBusy,setStabilityBusy]=useState(false);
  const [pendingFinish,setPendingFinish]=useState<WorklogFormValue|null>(null);
  const finishIntentRef=useRef(false);
  const sourceTasks = [...tasks, ...(worklog?.tasks ?? [])].filter((task, index, values) => values.findIndex((value) => value.id === task.id) === index);
  const availablePrimaryTasks=filterWorklogSourceTasks(sourceTasks,"");
  const reopenCandidates = worklogs.filter((candidate) => candidate.id !== worklog?.id && candidate.status === "DONE" && candidate.workType !== "REOPEN");
  const requiresTaskSource = currentUser.role !== "ADMIN";
  const isFinished = status === "DONE" || status === "ENDED";
  const workDate = worklog ? localDate(new Date(worklog.startedAt)) : currentVietnamDate();
  const memberCanChooseDate = currentUser.role !== "ADMIN" && !worklog && !readOnly;
  const outputProgress={achieved:outputCriteria.filter(item=>item.achieved===true).length,total:outputCriteria.length};
  async function confirmStability(){
    if(!worklog||currentUser.role!=="ADMIN"||stabilityBusy)return;
    const retained=pendingWorklogStabilityPoint(worklog);
    if(!window.confirm(`Xác nhận Worklog đã ổn định${retained>0?` và trả thêm ${retained} Point`:""}?`))return;
    setStabilityBusy(true);setSourceError("");
    try{await api.confirmWorklogStability(worklog.id);await onUpdated();onClose();}
    catch(cause){setSourceError(cause instanceof Error?cause.message:"Không chốt được Worklog ổn định");}
    finally{setStabilityBusy(false);}
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const submittedStatus:WorklogStatus=finishIntentRef.current?"DONE":status;
    finishIntentRef.current=false;
    const submittedFinished=submittedStatus==="DONE"||submittedStatus==="ENDED";
    if (requiresTaskSource && !primaryTaskId) { setSourceError("Cần chọn một Task nguồn trước khi tạo Worklog."); return; }
    if (workType === "REOPEN" && !reopenedWorklogId) { setSourceError("RE-OPEN cần chọn Worklog gốc."); return; }
    if(usesOutputCriteria){
      if(outputCriteria.some(item=>!item.expected.trim())){setSourceError("Mỗi OUT kỳ vọng cần có nội dung.");return;}
    }
    const form = new FormData(event.currentTarget);
    const hours = String(form.get("hoursWorked")).trim();
    if(submittedFinished&&(!hours||Number(hours)<=0)){setSourceError("Cần nhập Số H thực tế trước khi hoàn thành Worklog.");return;}
    const report=initialReport.trim();
    const activeMentionedUserIds=initialMentionedUserIds.filter(id=>{
      const person=people.find(candidate=>candidate.id===id);
      return person&&report.includes(`@${person.displayName}`);
    });
    const value:WorklogFormValue={
      userId:currentUser.role === "ADMIN" ? String(form.get("userId")) : undefined,
      primaryTaskId:primaryTaskId||undefined,
      taskIds:selectedTaskIds,
      input:String(form.get("input")).trim(),
      outputCriteria:usesOutputCriteria?outputCriteria.map(item=>({...item,expected:item.expected.trim(),actual:item.actual?.trim()||null,achieved:submittedFinished?item.achieved===true:item.achieved})):undefined,
      links:[...new Set(links.map(link=>link.trim()).filter(Boolean))],
      initialReport:report||undefined,
      initialMentionedUserIds:activeMentionedUserIds,
      startedAt:new Date(`${String(form.get("workDate"))}T00:00:00+07:00`).toISOString(),
      hoursWorked:hours ? Number(hours) : undefined,
      valueLevel:String(form.get("valueLevel")) as WorklogValueLevel,
      workType,
      reopenedWorklogId:workType === "REOPEN" ? reopenedWorklogId : undefined,
      status:submittedStatus,
    };
    if(usesOutputCriteria&&submittedFinished){setPendingFinish(value);return;}
    if (!window.confirm(worklog ? "Xác nhận lưu thay đổi Worklog?" : "Xác nhận tạo Worklog?")) return;
    await onSave(value);
  }
  return <div className="overlay worklogEditorOverlay" onMouseDown={onClose}><form className="worklogForm worklogEditorForm" onSubmit={(event) => void submit(event)} onMouseDown={(event) => event.stopPropagation()}>
    <div className="worklogEditorHead">
      <h2>{readOnly ? "CHI TIẾT WORKLOG" : worklog ? "WORKLOG" : "TẠO WORKLOG"}</h2>
      <p>Ghi việc theo ngày và tổng số giờ thực tế.</p>
    </div>
    <div className="worklogEditorBody"><div className="worklogEditorScroll worklogEditorInfo">
    {currentUser.role === "ADMIN" && <label>Người thực hiện<select name="userId" disabled={readOnly} defaultValue={worklog?.userId ?? currentUser.id}>{people.map((person) => <option value={person.id} key={person.id}>{person.displayName}</option>)}</select></label>}
    {currentUser.role !== "ADMIN" && readOnly && worklog && <label>Người thực hiện<input disabled value={worklog.user.displayName}/></label>}
    <label>Loại Worklog<select disabled={readOnly} value={workType} onChange={(event) => { const next = event.target.value as WorklogType; setWorkType(next); if (next !== "REOPEN") setReopenedWorklogId(""); }}><option value="NORMAL">CÔNG VIỆC</option><option value="BUGFIX">BUGFIX</option><option value="REOPEN">RE-OPEN</option></select></label>
    {workType === "REOPEN" && <label>Worklog gốc<select disabled={readOnly} required value={reopenedWorklogId} onChange={(event) => { setReopenedWorklogId(event.target.value); setSourceError(""); }}><option value="">Chọn Worklog cần sửa lại…</option>{reopenCandidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.user.displayName} · {worklogDate(candidate.startedAt)} · {candidate.input}</option>)}</select><small>RE-OPEN ghi nhận H nhưng nhận 0 Point; Worklog gốc sẽ được tính lại độ ổn định.</small></label>}
    <fieldset className="worklogTaskPicker worklogThreadPicker">
      <legend>Task nguồn <small>{requiresTaskSource ? "bắt buộc" : "không bắt buộc với Admin"} · dùng để nối cả quá trình</small></legend>
      <div className="worklogTaskPickerRow">
        <div className={`worklogTaskTags${selectedTaskIds.length?"":" empty"}`}>
          {selectedTaskIds.map((id,index)=>{const title=sourceTasks.find(task=>task.id===id)?.title??"Task nguồn";return <span className="worklogSourceChip" key={id} title={title}><span>#{title}</span>{index===0&&<em>CHÍNH</em>}{!readOnly&&<button type="button" aria-label={`Bỏ Task nguồn ${title}`} onClick={()=>{setSelectedTaskIds(ids=>ids.filter(value=>value!==id));setSourceError("");}}>×</button>}</span>;})}
          {!selectedTaskIds.length&&<small>{requiresTaskSource?"Chưa chọn Task nguồn":"Không gắn Task"}</small>}
        </div>
        {!readOnly&&<select aria-label="Browse Task nguồn" value="" disabled={selectedTaskIds.length>=10} onChange={event=>{const id=event.target.value;setSelectedTaskIds(ids=>addWorklogSource(ids,id));setSourceError("");}}>
          <option value="">{selectedTaskIds.length>=10?"Đã chọn tối đa 10 Task":"＋ Chọn thêm Task nguồn…"}</option>
          {availablePrimaryTasks.filter(task=>!selectedTaskIds.includes(task.id)).map(task=><option value={task.id} key={task.id}>{task.title}{task.note?` — ${task.note}`:""}</option>)}
        </select>}
      </div>
      <small className="worklogSourceHint">{selectedTaskIds.length}/10 Task · Task CHÍNH dùng để chốt ổn định. H và Point chỉ tính một lần cho Worklog.</small>
      {!tasks.length && <p>{requiresTaskSource ? "Chưa có Task chưa Complete. Hãy tạo Task trước." : "Chưa có Task chưa Complete; Admin vẫn có thể lưu Worklog."}</p>}
      {worklog?.status==="DONE"&&worklog.workType!=="REOPEN"&&<div className="worklogStabilityGate">
        <span><b>HOÀN THÀNH ({worklogOutputProgress(worklog)?.achieved??0}/{worklogOutputProgress(worklog)?.total??0})</b><small>{worklog.stabilityStatus==="CONFIRMED"?"Output đã được chốt ổn định.":(worklog.reopenCount??0)>0?"Đã phát sinh RE-OPEN, không nhận phần Point ổn định.":worklog.primaryTaskId&&worklog.primaryTask?.status!=="COMPLETE"?"Chờ Task nguồn COMPLETE để chốt ổn định.":"CHỜ ỔN ĐỊNH"}</small></span>
        {worklog.stabilityStatus==="CONFIRMED"?<em className="complete">ĐÃ ỔN ĐỊNH</em>:currentUser.role==="ADMIN"&&(worklog.reopenCount??0)===0&&(!worklog.primaryTaskId||worklog.primaryTask?.status==="COMPLETE")&&<button type="button" className="primary" disabled={stabilityBusy} onClick={()=>void confirmStability()}>{stabilityBusy?"Đang chốt...":`Chốt ổn định${pendingWorklogStabilityPoint(worklog)>0?` +${pendingWorklogStabilityPoint(worklog)} Point`:""}`}</button>}
      </div>}
      {sourceError && <p className="error">{sourceError}</p>}
    </fieldset>
    <label>Ngày làm{currentUser.role === "ADMIN"
      ? <input name="workDate" type="date" disabled={readOnly} defaultValue={workDate} required/>
      : memberCanChooseDate
        ? <input name="workDate" type="date" max={currentVietnamDate()} defaultValue={workDate} required/>
        : <><input type="date" disabled value={workDate}/><input name="workDate" type="hidden" value={workDate}/></>}</label>
    <label>Input · Việc làm<textarea name="input" rows={3} maxLength={500} required disabled={readOnly} autoFocus={!readOnly} defaultValue={worklog?.input ?? ""} placeholder="Ví dụ: Hàn board ScanBox"/></label>
    {usesOutputCriteria?<section className="worklogCriteria">
      <header><b>OUT CẦN ĐẠT</b>{!readOnly&&<button type="button" onClick={()=>setOutputCriteria(current=>[...current,newWorklogCriterion()])}>＋ Thêm OUT</button>}</header>
      <div>{outputCriteria.map((criterion,index)=><article key={criterion.id} className={criterion.achieved===true?"achieved":criterion.achieved===false?"missed":""}>
        <label className="worklogCriterionCheck" aria-label={`OUT ${index+1} đạt`}><input type="checkbox" disabled={readOnly} checked={criterion.achieved===true} onChange={event=>setOutputCriteria(current=>current.map(item=>item.id===criterion.id?{...item,achieved:event.target.checked}:item))}/></label>
        <b className="worklogCriterionIndex">OUT {index+1}</b>
        <textarea className="worklogCriterionExpected" aria-label={`Kết quả kỳ vọng OUT ${index+1}`} disabled={readOnly} rows={1} maxLength={500} value={criterion.expected} onChange={event=>setOutputCriteria(current=>current.map(item=>item.id===criterion.id?{...item,expected:event.target.value}:item))} placeholder="Kết quả kỳ vọng quan sát được"/>
        {!readOnly&&outputCriteria.length>1&&<button type="button" className="worklogCriterionDelete" aria-label="Xoá OUT" onClick={()=>setOutputCriteria(current=>current.filter(item=>item.id!==criterion.id))}>×</button>}
      </article>)}</div>
    </section>:<div className="worklogLegacyNotice"><b>WORKLOG LỊCH SỬ</b><span>Dữ liệu cũ giữ nguyên Point/H; chỉ Worklog mới dùng OUT checklist.</span></div>}
    <section className="worklogLinks"><header><div><b>LINK</b><small>Tài liệu, commit, Drive hoặc bằng chứng</small></div>{!readOnly&&<button type="button" onClick={()=>setLinks(current=>[...current,""])}>＋ Thêm link</button>}</header>
      <div>{links.map((link,index)=><div className="worklogLinkRow" key={index}>{readOnly
        ? <a href={link} target="_blank" rel="noreferrer">{link}</a>
        : <><input type="url" inputMode="url" value={link} onChange={event=>setLinks(current=>current.map((value,position)=>position===index?event.target.value:value))} placeholder="https://..."/>{link&&<a href={link} target="_blank" rel="noreferrer">Mở ↗</a>}<button type="button" aria-label="Xoá link" onClick={()=>setLinks(current=>current.filter((_,position)=>position!==index))}>×</button></>}</div>)}{!links.length&&<small>Chưa có link.</small>}</div>
    </section>
    <label>Mức Value<select name="valueLevel" disabled={readOnly} value={valueLevel} onChange={(event)=>setValueLevel(event.target.value as WorklogValueLevel|"")} required><option value="">Chọn mức...</option>{Object.entries(WORKLOG_VALUE_LEVELS).map(([value,level])=><option value={value} key={value}>{level.label} · {level.rate} Point/H chuẩn</option>)}</select></label>
    <label>Số H thực tế<input name="hoursWorked" type="number" min={usesOutputCriteria?"0.5":"0.25"} max="24" step={usesOutputCriteria?"0.5":"0.25"} disabled={readOnly} defaultValue={worklog?.hoursWorked ?? ""} required={isFinished} placeholder="Ví dụ: 3.5"/></label>
    <label>Trạng thái<select value={status} disabled={readOnly} onChange={(event) => setStatus(event.target.value as WorklogStatus)}><option value="BACKLOG">BACKLOG</option><option value="OPEN">ĐANG LÀM</option>{usesOutputCriteria?<option value="DONE">HOÀN THÀNH · chốt Output</option>:<><option value="ENDED">KHÔNG HOÀN THÀNH</option><option value="DONE">DONE</option></>}</select></label>
      {usesOutputCriteria?<small>{isFinished?`HOÀN THÀNH (${outputProgress.achieved}/${outputProgress.total}) · sau khi xác nhận sẽ CHỜ ỔN ĐỊNH.`:"Worklog đang làm chưa cộng Point."}</small>:status === "ENDED" ? <div className={`worklogCapitalNotice ${valueLevel === "RND" ? "rnd" : ""}`}><b>{valueLevel === "RND" ? "R&D: ghi nhận 50% Vốn · 150 Vốn/H" : valueLevel === "DEV" ? "DEV: ghi nhận 25% Vốn · 25 Vốn/H" : "BASIC: 0 Point · 0 Vốn"}</b><span>{valueLevel === "BASIC" ? "Không có phần Point hoặc Vốn trả sau." : "Point đạt = 0. Vốn chỉ phản ánh công sức đã bỏ ra, không phải Point thưởng."}</span></div> : <small>{status === "DONE" ? "DONE: nhận ngay 80% Point công sức; 20% chờ ổn định." : "Có thể bổ sung Output và H trong lúc làm."}</small>}
    </div><aside className="worklogReportPane">{worklog
      ? <WorklogComments api={api} worklogId={worklog.id} initialComments={worklog.comments??[]} people={people}/>
      : <InitialWorklogReport body={initialReport} setBody={setInitialReport} mentionedIds={initialMentionedUserIds} setMentionedIds={setInitialMentionedUserIds} people={people}/>}</aside></div>
    <div className="formActions"><button type="button" onClick={onClose}>{readOnly ? "Đóng" : "Hủy"}</button>{!readOnly&&<button disabled={busy}>{worklog?"Lưu thay đổi":"Lưu Worklog"}</button>}{!readOnly&&!isFinished&&<button type="button" className="primary" disabled={busy} onClick={event=>{const form=event.currentTarget.form;if(!form?.reportValidity()){finishIntentRef.current=false;return;}finishIntentRef.current=true;form.requestSubmit();}}>Hoàn thành Worklog</button>}</div>
    {pendingFinish&&<div className="worklogFinishOverlay" onMouseDown={()=>setPendingFinish(null)}><section className="worklogFinishConfirm" onMouseDown={event=>event.stopPropagation()}>
      <header><div><h3>XÁC NHẬN HOÀN THÀNH</h3><p>Chốt đủ Output trước khi khóa Worklog.</p></div><strong>{outputProgress.achieved}/{outputProgress.total}</strong></header>
      <div className="worklogFinishOutputs">{outputCriteria.map((criterion,index)=><article className={criterion.achieved?"achieved":"missed"} key={criterion.id}><span>{criterion.achieved?"✓":"×"}</span><div><b>OUT {index+1} · {criterion.expected}</b></div><em>{criterion.achieved?"ĐẠT":"CHƯA ĐẠT"}</em></article>)}</div>
      <div className="worklogFinishMeta"><span><small>Số H</small><b>{pendingFinish.hoursWorked?.toLocaleString("vi-VN")}h</b></span><span><small>Point công sức</small><b>{pendingFinish.valueLevel&&pendingFinish.hoursWorked!==undefined?calculateWorklogPoint(pendingFinish.valueLevel,pendingFinish.hoursWorked,outputProgress.achieved/outputProgress.total,0):0}</b></span><span><small>Sau khi lưu</small><b>CHỜ ỔN ĐỊNH</b></span></div>
      <p>Sau khi hoàn thành, Worklog chỉ mở sửa lại nếu Task Review bị đánh KHÔNG ĐẠT.</p>
      <footer><button type="button" onClick={()=>setPendingFinish(null)}>Xem lại</button><button type="button" className="primary" disabled={busy} onClick={()=>void onSave(pendingFinish)}>Xác nhận hoàn thành</button></footer>
    </section></div>}
  </form></div>;
}

function WorklogView({ api, currentUser, people, tasks, sprintStart, onOpenTask, focusWorklogId, onFocusConsumed }: { api: Api; currentUser: User; people:User[]; tasks:Task[]; sprintStart:string; onOpenTask:(taskId:string)=>void; focusWorklogId:string|null; onFocusConsumed:()=>void }) {
  const [month, setMonth] = useState(sprintStart.slice(0, 7));
  const [dashboard, setDashboard] = useState<WorklogDashboard | null>(null);
  const [selectedUserId, setSelectedUserId] = useState(() => currentUser.role === "ADMIN" ? "" : currentUser.id);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const selectedWeekStart = sprintStart;
  const [goalItems, setGoalItems] = useState<SprintGoalItem[]>([]);
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalExpanded,setGoalExpanded]=useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Worklog | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canCreateWorklog = currentUser.role === "ADMIN" || ["thang", "vinh", "phu"].includes(currentUser.username.toLowerCase());
  const loadWorklogs = useCallback(async () => {
    try {
      setDashboard(await api.worklogs(month, sprintStart));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được Worklog");
    }
  }, [api, month, sprintStart]);
  useEffect(() => {
    void loadWorklogs();
    const socket = api.connect(() => void loadWorklogs());
    return () => { socket.disconnect(); };
  }, [api, loadWorklogs]);
  useEffect(() => { if (month !== sprintStart.slice(0, 7)) setMonth(sprintStart.slice(0, 7)); }, [month, sprintStart]);
  const selectedWeek = dashboard?.weeks.find((week) => week.weekStart === selectedWeekStart) ?? null;
  const createState=selectedWeek?worklogSprintCreateState(selectedWeek.weekStart,selectedWeek.status):{enabled:false,label:"CHƯA CÓ SPRINT"};
  useEffect(() => { setGoalItems(parseSprintGoals(selectedWeek?.goal)); setGoalEditing(false); setGoalExpanded(false); }, [selectedWeek?.goal, selectedWeek?.weekStart]);
  useEffect(()=>{
    if(!focusWorklogId)return;
    let cancelled=false;
    void api.worklog(focusWorklogId).then(log=>{
      if(cancelled)return;
      const failedReview=log.primaryTask?.status==='DONE'&&log.primaryTask.reviewResult==='FAILED';
      setEditing(log);setEditorReadOnly((weekIsClosedForMember(log)&&!failedReview) || !(currentUser.role==="ADMIN"||(log.userId===currentUser.id&&(!(["DONE","ENDED"].includes(log.status)&&log.scoredAt)||failedReview))));setEditorOpen(true);onFocusConsumed();
    }).catch(cause=>{if(!cancelled)setError(cause instanceof Error?cause.message:"Không mở được Worklog");});
    return()=>{cancelled=true;};
  },[api,currentUser.id,currentUser.role,focusWorklogId,onFocusConsumed]);
  const visibleLogs = dashboard?.logs.filter((log) => {
    const date = localDate(new Date(log.startedAt));
    return Boolean(selectedWeek) && date >= selectedWeek!.weekStart && date <= selectedWeek!.weekEnd
      && (!selectedUserId || log.userId === selectedUserId)
      && worklogMatchesSource(log,selectedThreadId);
  }) ?? [];
  const worklogDays = useMemo(() => {
    const grouped = new Map<string, Worklog[]>();
    visibleLogs.forEach((log) => {
      const key = localDate(new Date(log.startedAt));
      grouped.set(key, [...(grouped.get(key) ?? []), log]);
    });
    return [...grouped.entries()];
  }, [visibleLogs]);
  async function perform(action: () => Promise<unknown>, close: () => void) {
    setBusy(true); setError("");
    try { await action(); close(); await loadWorklogs(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được Worklog"); }
    finally { setBusy(false); }
  }
  async function saveWorklog(value:WorklogFormValue) {
    const {initialReport,initialMentionedUserIds,...input}=value;
    await perform(async () => {
      if(editing)return api.updateWorklog(editing.id,input);
      const created=await api.createWorklog({...input,outputCriteria:input.outputCriteria??[]});
      if(initialReport)await api.commentWorklog(created.id,{body:initialReport,mentionedUserIds:initialMentionedUserIds});
      return created;
    }, () => { setEditorOpen(false); setEditing(null); });
  }
  async function removeWorklog(log:Worklog) {
    const message = log.scoredAt
      ? `Xóa Worklog của ${log.user.displayName}? ${log.point ?? 0} Point sẽ bị loại khỏi bảng điểm.`
      : `Xóa Worklog của ${log.user.displayName}? Worklog sẽ bị loại khỏi tổng kết H và Point.`;
    if (!window.confirm(message)) return;
    await perform(() => api.removeWorklog(log.id), () => { setEditorOpen(false); setEditing(null); });
  }
  async function saveWeekGoal() {
    if (!selectedWeek) return;
    await perform(() => api.updateWorklogWeek(selectedWeek.weekStart, serializeSprintGoals(goalItems)), () => setGoalEditing(false));
  }
  function updateGoalItem(index:number,patch:Partial<SprintGoalItem>){setGoalItems(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item));}
  function toggleGoalAssignee(index:number,userId:string){
    const item=goalItems[index];
    updateGoalItem(index,{assigneeIds:item.assigneeIds.includes(userId)?item.assigneeIds.filter(id=>id!==userId):[...item.assigneeIds,userId]});
  }
  function goalPeople(ids:string[]){return ids.map(id=>people.find(person=>person.id===id)).filter((person):person is User=>Boolean(person));}
  async function closeWeek() {
    if (!selectedWeek || !window.confirm(`Chốt Sprint ${worklogSprintNumber(selectedWeek.weekStart)} (${formatWorklogWeek(selectedWeek.weekStart, selectedWeek.weekEnd)})? Member sẽ chỉ xem Worklog của Sprint này.`)) return;
    await perform(() => api.closeWorklogWeek(selectedWeek.weekStart), () => undefined);
  }
  async function reopenWeek() {
    if (!selectedWeek || !window.confirm(`Mở lại Sprint ${worklogSprintNumber(selectedWeek.weekStart)} (${formatWorklogWeek(selectedWeek.weekStart, selectedWeek.weekEnd)}) để cập nhật?`)) return;
    await perform(() => api.reopenWorklogWeek(selectedWeek.weekStart), () => undefined);
  }
  function weekIsClosedForMember(log:Worklog) {
    if (currentUser.role === "ADMIN") return false;
    const date = localDate(new Date(log.startedAt));
    return dashboard?.weeks.some((week) => week.status === "CLOSED" && date >= week.weekStart && date <= week.weekEnd) ?? false;
  }
  function openWorklog(log:Worklog) {
    const failedReview=log.primaryTask?.status==='DONE'&&log.primaryTask.reviewResult==='FAILED';
    const canEdit = (!weekIsClosedForMember(log)||failedReview) && (currentUser.role === "ADMIN" || (log.userId === currentUser.id && (!(["DONE","ENDED"].includes(log.status) && log.scoredAt)||failedReview)));
    setEditing(log);
    setEditorReadOnly(!canEdit);
    setEditorOpen(true);
  }
  return <section className="worklogsView">
    <header className="worklogsHead">
      <div><h1>WORKLOG</h1><p>Member gắn Task nguồn để nối kế hoạch với kết quả; Admin có thể ghi việc phát sinh chưa có Task.</p></div>
      <div className="worklogsHeadActions">{canCreateWorklog&&<button className={createState.enabled?"primary":""} disabled={!createState.enabled} title={createState.enabled?"Tạo Worklog trong Sprint hiện tại":createState.label} onClick={() => { setEditing(null); setEditorReadOnly(false); setEditorOpen(true); }}>{createState.label}</button>}</div>
    </header>
    {error && <p className="error">{error}</p>}
    {selectedWeek && <>
      <section className={`worklogWeekPanel ${selectedWeek.status.toLowerCase()} ${!goalExpanded&&!goalEditing?"goalCompact":""}`}>
        {!goalExpanded&&!goalEditing&&<button type="button" className="worklogGoalCompactBar" aria-expanded="false" onClick={()=>setGoalExpanded(true)}><b>GOAL SPRINT</b><span>{goalItems[0]?.text||"Admin chưa đặt Goal cho Sprint này."}</span>{goalItems.length>1&&<small>+{goalItems.length-1}</small>}<span className="goalCompactPeople">{goalPeople([...new Set(goalItems.flatMap(item=>item.assigneeIds))]).slice(0,3).map(person=><i className="avatar" key={person.id} title={person.displayName} style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></i>)}</span><em>⌄</em></button>}
        <header><div><span className="worklogWeekStatus">{selectedWeek.status === "CLOSED" ? "ĐÃ CHỐT" : "ĐANG CHẠY"}</span><h2>{worklogSprintLabel(selectedWeek.weekStart)} · {formatWorklogWeek(selectedWeek.weekStart, selectedWeek.weekEnd)}</h2></div><div className="worklogWeekHeaderActions">{!goalEditing&&<button type="button" onClick={()=>setGoalExpanded(false)}>Thu gọn Goal</button>}{currentUser.role === "ADMIN" && (selectedWeek.status === "CLOSED" ? <button type="button" disabled={busy} onClick={() => void reopenWeek()}>Mở lại Sprint</button> : <button type="button" className="primary" disabled={busy} onClick={() => void closeWeek()}>Chốt Sprint</button>)}</div></header>
        <div className="worklogWeekGoal">
          <div className="worklogWeekGoalHead"><b>GOAL SPRINT</b>{currentUser.role === "ADMIN" && selectedWeek.status === "OPEN" && !goalEditing && <button type="button" aria-label="Sửa Goal Sprint" title="Sửa Goal Sprint" onClick={() => { if(!goalItems.length)setGoalItems([{text:"",assigneeIds:[]}]); setGoalEditing(true); }}>✎</button>}</div>
          {currentUser.role === "ADMIN" && selectedWeek.status === "OPEN" && goalEditing ? <div className="sprintGoalEditor">
            {goalItems.map((item,index)=><section className="sprintGoalEditRow" key={index}><b>{index+1}</b><div><input value={item.text} maxLength={300} autoFocus={index===0} placeholder="Một mục tiêu rõ ràng" onChange={event=>updateGoalItem(index,{text:event.target.value})}/><div className="sprintGoalAssignees"><button type="button" className={item.assigneeIds.length===0?"active":""} onClick={()=>updateGoalItem(index,{assigneeIds:[]})}>CẢ TEAM</button>{people.map(person=><button type="button" className={item.assigneeIds.includes(person.id)?"active":""} key={person.id} onClick={()=>toggleGoalAssignee(index,person.id)}><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span>{person.displayName}</button>)}</div></div><button type="button" aria-label="Xóa mục tiêu" disabled={goalItems.length<=1} onClick={()=>setGoalItems(current=>current.filter((_,itemIndex)=>itemIndex!==index))}>×</button></section>)}
            <button type="button" className="sprintGoalAdd" onClick={()=>setGoalItems(current=>[...current,{text:"",assigneeIds:[]}])}>＋ Thêm mục tiêu</button>
            <div className="worklogWeekGoalActions"><button type="button" disabled={busy} onClick={() => { setGoalItems(parseSprintGoals(selectedWeek.goal)); setGoalEditing(false); }}>Hủy</button><button type="button" className="primary" disabled={busy||!goalItems.some(item=>item.text.trim())||serializeSprintGoals(goalItems)===serializeSprintGoals(parseSprintGoals(selectedWeek.goal))} onClick={() => void saveWeekGoal()}>Lưu Goal</button></div>
          </div> : goalItems.length?<ol className="sprintGoalList">{goalItems.map((item,index)=>{const assigned=goalPeople(item.assigneeIds);return <li key={`${item.text}-${index}`}><span>{item.text}</span><div className="sprintGoalTags">{assigned.length===0?<em>CẢ TEAM</em>:<>{assigned.slice(0,3).map(person=><i className="avatar" key={person.id} title={person.displayName} style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></i>)}{assigned.length>3&&<b>+{assigned.length-3}</b>}</>}</div></li>})}</ol>:<p>Admin chưa đặt Goal cho Sprint này.</p>}
        </div>
      </section>
    </>}
    {!selectedWeek && <div className="emptyWorklogs"><b>CHƯA CÓ SPRINT</b><p>Hệ thống chưa tạo Sprint Worklog này.</p></div>}
    <div className="worklogListHead"><div className="worklogFilters"><label className="worklogMemberFilter">Xem người<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Tất cả thành viên</option>{dashboard?.summary.map((member) => <option value={member.userId} key={member.userId}>{member.displayName}</option>)}</select></label><label className="worklogMemberFilter">Task nguồn<select value={selectedThreadId} onChange={(event) => setSelectedThreadId(event.target.value)}><option value="">Tất cả Task</option>{[...new Map((dashboard?.logs??[]).flatMap(log=>[...(log.primaryTask?[log.primaryTask]:[]),...log.tasks]).map(task=>[task.id,task])).values()].map(task=><option value={task.id} key={task.id}>{task.title}</option>)}</select></label></div><span>{visibleLogs.length} Worklog</span></div>
    <div className="worklogList">
      {worklogDays.map(([day, logs]) => <section className="worklogDay" key={day}><header><b>{worklogDate(logs[0].startedAt)}</b><span>{logs.length} Worklog · {logs.reduce((sum, log) => sum + Number(log.hoursWorked ?? 0), 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</span></header><div className="worklogColumnHead"><span>NGƯỜI</span><span>CÔNG VIỆC</span><span>TASK NGUỒN</span><span>KẾT QUẢ</span><span>H</span><span>POINT</span><span aria-hidden="true"></span></div>{logs.map((log) => <article className="worklogRow" role="button" tabIndex={0} key={log.id} style={{ "--member-color": avatarColor(log.userId, log.user.displayName) } as CSSProperties} onClick={() => openWorklog(log)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openWorklog(log); } }}>
        <span className="avatar" style={{ backgroundColor: avatarColor(log.userId, log.user.displayName) }}><AvatarContent userId={log.userId} name={log.user.displayName}/></span>
        <div className="worklogMain"><div><b>{log.user.displayName}</b><em className={`worklogTypeTag ${log.workType.toLowerCase()}`}>{log.workType === "NORMAL" ? "CÔNG VIỆC" : log.workType === "REOPEN" ? "RE-OPEN" : "BUGFIX"}</em><em className={`worklogValueTag ${log.valueLevel?.toLowerCase()??"unrated"}`}>{log.valueLevel ? `${WORKLOG_VALUE_LEVELS[log.valueLevel].label} · ${WORKLOG_VALUE_LEVELS[log.valueLevel].rate}pt/H` : "CHƯA XẾP MỨC"}</em>{log.createdById !== log.userId && <small>Tạo bởi {log.createdBy.displayName}</small>}</div>{log.primaryTask&&<button type="button" className="worklogPrimaryTag" onClick={(event)=>{event.stopPropagation();onOpenTask(log.primaryTask!.id);}}>#{log.primaryTask.title}{worklogSourceIds(log.primaryTaskId,log.tasks).length>1&&<span className="worklogExtraSources" title={log.tasks.filter(task=>task.id!==log.primaryTaskId).map(task=>task.title).join(" · ")}>+{worklogSourceIds(log.primaryTaskId,log.tasks).length-1} Task</span>}</button>}{log.reopenedWorklog && <small className="worklogReopenSource">↳ Re-open: {log.reopenedWorklog.input}</small>}<h3>{log.input}</h3>{log.resultModelVersion===2?(log.outputCriteria.length>0&&<p>{log.outputCriteria.map(item=>`${item.achieved===true?"✓":item.achieved===false?"×":"○"} ${item.actual||item.expected}`).join(" · ")}</p>):latestWorklogReport(log) && <p><WorklogOutputText value={latestWorklogReport(log)}/></p>}</div>
        <div className="worklogResult"><span><em className={`worklogStatus ${log.status.toLowerCase()}`}>{worklogStatusLabel(log.status,worklogOutputProgress(log))}</em>{log.hoursWorked !== null && <b>{Number(log.hoursWorked).toLocaleString("vi-VN")}h</b>}</span>{(log.comments?.length??0)>0&&<span className="commentCount"><span aria-hidden="true">💬</span> {log.comments.length}</span>}{log.point !== null ? <strong>{log.point} <small>POINT</small></strong> : null}{log.point !== null && log.workType !== "REOPEN" && <small>{log.stabilityStatus === "CONFIRMED" ? "ĐÃ ỔN ĐỊNH" : (log.reopenCount ?? 0) > 0 ? "Không nhận Point ổn định" : `CHỜ ỔN ĐỊNH · +${pendingWorklogStabilityPoint(log)} Point`}</small>}</div>
        <details className="worklogActions" onClick={(event) => event.stopPropagation()}><summary aria-label="Thao tác Worklog">•••</summary><div>{(currentUser.role === "ADMIN" || (log.userId === currentUser.id && !(["DONE","ENDED"].includes(log.status) && log.scoredAt))) && <button onClick={() => openWorklog(log)}>Sửa</button>}{currentUser.role === "ADMIN" && <button className="danger" onClick={() => void removeWorklog(log)}>Xóa</button>}</div></details>
      </article>)}</section>)}
      {!visibleLogs.length && <div className="emptyWorklogs"><b>CHƯA CÓ WORKLOG</b><p>Bắt đầu một việc thực tế để ghi Input, H và Output.</p></div>}
    </div>
    {editorOpen && <WorklogEditor
      api={api}
      worklog={editing}
      currentUser={currentUser}
      people={people}
      tasks={tasks}
      worklogs={dashboard?.reopenCandidates ?? []}
      busy={busy}
      readOnly={editorReadOnly}
      onClose={() => { setEditorOpen(false); setEditing(null); setEditorReadOnly(false); }}
      onSave={saveWorklog}
      onUpdated={loadWorklogs}
    />}
  </section>;
}

const ACTIVATION_PRODUCT_OPTIONS:Record<ActivationProduct,{label:string;packages:{value:string;label:string}[]}>= {
  EASYSCAN:{label:"EasyScan",packages:[{value:"V2",label:"EasyScan V2"},{value:"V3",label:"EasyScan V3 SmartKey/SCU"},{value:"V2_PLUS",label:"EasyScan V2+ Yamaha/Vespa"},{value:"V3_PLUS",label:"EasyScan V3+ Yamaha/Vespa"}]},
  SCANBOX:{label:"ScanBox",packages:[{value:"YAMAHA_VESPA_FLASH",label:"Nạp phần mềm Yamaha/Vespa"},{value:"SMARTKEY",label:"SmartKey"}]},
  KEYSCAN:{label:"KeyScan",packages:[{value:"KLINE_ECU",label:"KLINE ECU"},{value:"RH850",label:"RH850"}]},
};
const ACTIVATION_SOURCES=["Trần Hoan","TAD","Khiêm chipp","Motorcycles TV","Tay ga Đình Tuấn","Auto2Tech"];
function activationPackageLabel(product:ActivationProduct,code:string){return ACTIVATION_PRODUCT_OPTIONS[product].packages.find(item=>item.value===code)?.label??code;}
export function normalizeActivationSeries(input:string){const parts=input.trim().split(/[-:\s]+/).filter(Boolean);if(parts.length!==8||parts.some(part=>!/^[0-9a-fA-F]{1,2}$/.test(part)))return null;return parts.map(part=>parseInt(part,16).toString(16).toUpperCase().padStart(2,'0')).join('-');}
function ActivationView({api}:{api:Api}){
  const [history,setHistory]=useState<ActivationRecord[]>([]);const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState("");const [series,setSeries]=useState("");const [product,setProduct]=useState<ActivationProduct>("EASYSCAN");const [packageCode,setPackageCode]=useState("V2");const [source,setSource]=useState("Auto2Tech");const [paymentStatus,setPaymentStatus]=useState<ActivationPaymentStatus>("PAID");const [busy,setBusy]=useState(false);const [ocrMessage,setOcrMessage]=useState("");const [error,setError]=useState("");const [result,setResult]=useState<ActivationRecord|null>(null);const inputRef=useRef<HTMLInputElement>(null);
  const load=useCallback(()=>api.activationHistory().then(setHistory).catch(err=>setError(err instanceof Error?err.message:"Không tải được lịch sử")),[api]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{
    function preventFileNavigation(event:DragEvent){if(event.dataTransfer?.types.includes('Files'))event.preventDefault();}
    function receiveDroppedFile(event:DragEvent){const target=event.target as Element|null;if(!target?.closest('.activationUpload'))return;event.preventDefault();event.stopPropagation();choose(event.dataTransfer?.files[0]);}
    function receivePastedFile(event:ClipboardEvent){const image=[...(event.clipboardData?.files??[])].find(item=>item.type.startsWith('image/'));if(image){event.preventDefault();choose(image);}}
    document.addEventListener('dragenter',preventFileNavigation,true);document.addEventListener('dragover',preventFileNavigation,true);document.addEventListener('drop',receiveDroppedFile,true);document.addEventListener('paste',receivePastedFile,true);
    return()=>{document.removeEventListener('dragenter',preventFileNavigation,true);document.removeEventListener('dragover',preventFileNavigation,true);document.removeEventListener('drop',receiveDroppedFile,true);document.removeEventListener('paste',receivePastedFile,true);};
  },[preview]);
  function choose(next:File|undefined){if(!next)return;if(!["image/jpeg","image/png","image/webp"].includes(next.type)){setError("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");return;}if(next.size>8*1024*1024){setError("Ảnh tối đa 8 MB.");return;}if(preview)URL.revokeObjectURL(preview);setFile(next);setPreview(URL.createObjectURL(next));setOcrMessage("");setError("");}
  async function recognize(){if(!file)return;setBusy(true);setError("");setOcrMessage("Đang đọc Series từ ảnh...");try{const response=await api.recognizeActivation(file);if(response.candidates[0]){setSeries(response.candidates[0]);setOcrMessage(`Đã nhận Series · độ tin cậy OCR ${response.confidence}% — hãy kiểm tra lại.`);}else setOcrMessage("Không nhận được đủ 8 byte HEX. Vui lòng nhập Series thủ công.");}catch(err){setError(err instanceof Error?err.message:"Không xử lý được ảnh");setOcrMessage("");}finally{setBusy(false);}}
  function changeProduct(next:ActivationProduct){setProduct(next);setPackageCode(ACTIVATION_PRODUCT_OPTIONS[next].packages[0].value);setResult(null);}
  function changeSource(next:string){setSource(next);setPaymentStatus(next==="Auto2Tech"?"PAID":"UNPAID");}
  async function generate(event:FormEvent){event.preventDefault();setError("");const normalized=normalizeActivationSeries(series);if(!normalized){setError("Series phải có đúng 8 byte HEX.");return;}setSeries(normalized);const productLabel=ACTIVATION_PRODUCT_OPTIONS[product].label;const packageLabel=activationPackageLabel(product,packageCode);if(!window.confirm(`KIỂM TRA LẠI SERIES\n\n${normalized}\n\n${productLabel} · ${packageLabel}\n\nMã sai sẽ không kích hoạt được thiết bị. Chỉ tiếp tục sau khi đã đối chiếu với ảnh.`))return;setBusy(true);try{const record=await api.generateActivation({series:normalized,product,packageCode,source,paymentStatus});setResult(record);setSeries(record.series);await load();}catch(err){setError(err instanceof Error?err.message:"Không tạo được mã");}finally{setBusy(false);}}
  return <section className="activationView"><header className="activationHead"><div><small>SALE &amp; ORDERS</small><h1>MÃ KÍCH HOẠT</h1><p>Đọc Series từ ảnh, xác nhận gói và tạo mã cho đại lý.</p></div></header><div className="activationWorkspace"><form className="activationForm" onSubmit={event=>void generate(event)}><section className="activationUpload" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();choose(event.dataTransfer.files[0]);}}>{preview?<img src={preview} alt="Ảnh chứa Series"/>:<div><b>Thả ảnh vào đây</b><span>hoặc chọn ảnh từ máy · JPEG, PNG, WebP</span></div>}<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{choose(event.target.files?.[0]);event.target.value="";}}/><div><button type="button" onClick={()=>inputRef.current?.click()}>{file?"Đổi ảnh":"Chọn ảnh"}</button><button type="button" className="primary" disabled={!file||busy} onClick={()=>void recognize()}>{busy?"Đang xử lý...":"Đọc Series"}</button></div></section>{ocrMessage&&<p className="activationOcrMessage">{ocrMessage}</p>}<label>Series thiết bị<input value={series} onChange={event=>{setSeries(event.target.value.toUpperCase());setResult(null);}} placeholder="AA-FA-AC-13-3D-00-12-FF" required/><small>Đúng 8 byte HEX; chấp nhận dấu gạch, dấu hai chấm hoặc khoảng trắng.</small></label><div className="activationGrid"><label>Sản phẩm<select value={product} onChange={event=>changeProduct(event.target.value as ActivationProduct)}>{Object.entries(ACTIVATION_PRODUCT_OPTIONS).map(([value,item])=><option value={value} key={value}>{item.label}</option>)}</select></label><label>Gói nâng cấp<select value={packageCode} onChange={event=>{setPackageCode(event.target.value);setResult(null);}}>{ACTIVATION_PRODUCT_OPTIONS[product].packages.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Nguồn<select value={source} onChange={event=>changeSource(event.target.value)}>{ACTIVATION_SOURCES.map(item=><option value={item} key={item}>{item}</option>)}</select></label><label>Thanh toán<select value={paymentStatus} disabled={source==="Auto2Tech"} onChange={event=>setPaymentStatus(event.target.value as ActivationPaymentStatus)}><option value="UNPAID">Chưa thanh toán</option><option value="PAID">Đã thanh toán</option></select></label></div>{error&&<p className="error">{error}</p>}<button className="primary activationGenerate" disabled={busy}>Gen code</button>{result&&<section className="activationResult"><small>MÃ KÍCH HOẠT</small><strong>{result.activationCode}</strong><p>{result.series} · {ACTIVATION_PRODUCT_OPTIONS[result.product].label} · {activationPackageLabel(result.product,result.packageCode)}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(result.activationCode)}>Sao chép mã</button></section>}</form><aside className="activationHistory"><header><h2>LỊCH SỬ GẦN ĐÂY</h2><span>{history.length} lượt</span></header>{history.map(record=><article key={record.id}><div><b>{record.series}</b><small>{ACTIVATION_PRODUCT_OPTIONS[record.product].label} · {activationPackageLabel(record.product,record.packageCode)}</small></div><strong>{record.activationCode}</strong><div><span>{record.source}</span><em className={record.paymentStatus.toLowerCase()}>{record.paymentStatus==="PAID"?"ĐÃ THANH TOÁN":"CHƯA THANH TOÁN"}</em><time>{new Date(record.createdAt).toLocaleString("vi-VN")}</time></div></article>)}{!history.length&&<p>Chưa có mã nào được tạo.</p>}</aside></div></section>;
}

function ScoreboardView({ api, currentUser, onOpenTask }: { api: Api; currentUser: User; onOpenTask:(id:string)=>void }) {
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [worklogDashboard, setWorklogDashboard] = useState<WorklogDashboard | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(() => currentUser.role === "ADMIN" || !["thang", "vinh", "phu"].includes(currentUser.username) ? "" : currentUser.id);
  const [error, setError] = useState("");
  const loadScoreboard = useCallback(async () => {
    try { setWorklogDashboard(await api.worklogs(month)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Không tải được bảng điểm"); }
  }, [api, month]);
  useEffect(() => { void loadScoreboard(); const socket=api.connect(()=>void loadScoreboard()); socket.on('connect',loadScoreboard); return()=>{socket.disconnect();}; }, [api,loadScoreboard]);
  useEffect(() => {
    const weeks = worklogDashboard?.weeks ?? [];
    if (!weeks.some((week) => week.weekStart === selectedWeekStart)) setSelectedWeekStart(weeks[0]?.weekStart ?? "");
  }, [selectedWeekStart, worklogDashboard]);
  const devUsernames = ["thang", "vinh", "phu"];
  const filterMembers = worklogDashboard?.summary.filter((member) => devUsernames.includes(member.username.toLowerCase())) ?? [];
  const selectedWeek = (worklogDashboard?.weeks ?? []).find((week) => week.weekStart === selectedWeekStart) ?? null;
  const weeklyMembers = selectedWeek?.summary.filter((member) => devUsernames.includes(member.username.toLowerCase()) && (!selectedUserId || member.userId === selectedUserId)) ?? [];
  return <section className="scoreboard">
    <header><div><h1>BẢNG ĐIỂM</h1><p>Hiệu suất Worklog thực tế theo tháng</p></div><label>Tháng<input type="month" value={month} onChange={(event) => setMonth(event.target.value)}/></label></header>
    {error && <p className="error">{error}</p>}
    <PerformanceBoard key={month} api={api} month={month} admin={currentUser.role==='ADMIN'} onOpenTask={onOpenTask}/>
    <details><summary>Point Worklog theo cơ chế cũ · không dùng để xếp thưởng mới</summary>
    <div className="scoreboardToolbar"><label>Xem thành viên<select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Tất cả Dev</option>{filterMembers.map((member) => <option value={member.userId} key={member.userId}>{member.displayName}</option>)}</select></label><small>{filterMembers.map(member=>member.displayName).join(' · ')}</small></div>
    <section className="weeklyScoreboard">
      <div className="scoreSectionHead"><b>BÁO CÁO TUẦN</b>{(worklogDashboard?.weeks ?? []).length > 0 && <label>Tuần<select value={selectedWeekStart} onChange={(event) => setSelectedWeekStart(event.target.value)}>{(worklogDashboard?.weeks ?? []).map((week) => <option value={week.weekStart} key={week.weekStart}>{formatWorklogWeek(week.weekStart,week.weekEnd)}</option>)}</select></label>}</div>
      {weeklyMembers.length > 0 ? <div className="weeklyOutputReport"><div className="weeklyOutputHead"><span>Thành viên</span><span>H</span><span>Đầu ra đã đạt</span><span>Point đã nhận</span><span>Point đang chờ</span><span>Cần Admin xử lý</span></div>{weeklyMembers.map((member) => {const insight=weeklyWorklogInsight(member);const outputs=selectedWeek?weeklyAchievedOutputLabels(worklogDashboard?.logs??[],member.userId,selectedWeek.weekStart,selectedWeek.weekEnd):[];return <article key={member.userId} style={{"--member-color":avatarColor(member.userId,member.displayName)} as CSSProperties}><span className="weeklyOutputMember"><span className="avatar" style={{backgroundColor:avatarColor(member.userId,member.displayName)}}><AvatarContent userId={member.userId} name={member.displayName}/></span><b>{member.displayName}</b></span><strong data-label="H">{member.hours.toLocaleString("vi-VN",{maximumFractionDigits:2})}h</strong><span className="weeklyOutputList" data-label="Đầu ra đã đạt">{outputs.length?outputs.map((output)=><span key={output}>{output}</span>):<em>Chưa ghi nhận OUT đạt</em>}</span><strong data-label="Point đã nhận">{member.point.toLocaleString("vi-VN")}</strong><strong data-label="Point đang chờ" className={member.pendingStabilityPoint>0?'pending':''}>{member.pendingStabilityPoint>0?`+${member.pendingStabilityPoint.toLocaleString("vi-VN")}`:'—'}</strong><span data-label="Cần Admin xử lý" className={insight.nextAction.startsWith('Không có')?'weeklyActionClear':'weeklyActionRequired'}>{insight.nextAction.startsWith('Không có')?'Không có':insight.nextAction}</span></article>;})}</div> : <p className="scoreEmpty">Chưa có dữ liệu Worklog trong tuần của tháng này.</p>}
    </section>
    <details className="scoreRule scoreRuleCompact"><summary>Xem cách tính Point</summary><p>Point nền = H thực tế × mức Value × OUT đạt / tổng OUT. Nhận 80% khi hoàn thành; 20% còn lại sau khi Task ổn định.</p><small>BASIC 50 · DEV 100 · R&amp;D 300 Point/H. RE-OPEN không sinh thêm Point.</small></details>
    </details>
  </section>;
}

const PRODUCTION_MODULES:Record<ProductionModule,{label:string;types:string[]}>= {
  CABLE:{label:"Làm cáp",types:["Cắt dây","Bấm cos","Hàn","Hoàn thiện cáp"]},
  DEVICE:{label:"Device",types:["Lắp device","Nâng cấp device","Sửa device"]},
  PACKING:{label:"Đóng bộ",types:["Đóng máy","Đóng vali","Đóng sản phẩm"]},
  TEST:{label:"Test",types:["Test cáp","Test device","Test sản phẩm"]},
  SUPPORT:{label:"Hỗ trợ",types:["Training","Hỗ trợ khác"]},
};

export function productionDayState(session:{isRegistered:boolean;hoursWorked:string|null}|undefined,entryCount:number,paymentStatus?:'REQUESTED'|'PAID'){
  if(!session?.isRegistered)return {label:"—",className:"empty",detail:"Chưa đăng ký"};
  if(session.hoursWorked===null||entryCount===0)return {label:"Thiếu",className:"missing",detail:"Thiếu báo cáo"};
  if(paymentStatus==='PAID')return {label:`${Number(session.hoursWorked)}h`,className:"paid",detail:"Đã thanh toán"};
  if(paymentStatus==='REQUESTED')return {label:`${Number(session.hoursWorked)}h`,className:"settlement",detail:"Chờ thanh toán"};
  return {label:`${Number(session.hoursWorked)}h`,className:"reported",detail:`${entryCount} việc`};
}

export function productionReportForDay(entries:ProductionEntry[],userId:string,workDate:string){
  return entries.find(entry=>entry.userId===userId&&entry.workDate===workDate&&(entry.workType==="Báo cáo tự do"||entry.workType==="Báo cáo theo Worklog"))??null;
}

export function productionLotIdsForEntry(lots:ProductionLot[],entryId:string|null){
  if(!entryId)return [];
  return lots.filter(lot=>lot.reports.some(report=>report.id===entryId)).map(lot=>lot.id);
}

export function activeProductionLotIdsForMember(lots:ProductionLot[],userId:string,entryId:string|null){
  return [...new Set([
    ...productionLotIdsForEntry(lots,entryId),
    ...lots.filter(lot=>lot.status!=="DONE"&&lot.participants.some(person=>person.id===userId)).map(lot=>lot.id),
  ])];
}

type ProductionReportDraft=ProductionReportItem&{key:string};
const newProductionReportDraft=(lotId='',stage:ProductionReportItem['stage']='ASSEMBLE'):ProductionReportDraft=>({key:`report-${Date.now()}-${Math.random()}`,lotId,stage,quantity:1,result:'PASSED',note:''});
const PRODUCTION_STAGE_LABELS:Record<ProductionReportItem['stage'],string>={ASSEMBLE:'Lắp ráp',SOLDER:'Hàn',PACK:'Đóng gói',TEST:'Test',OTHER:'Khác'};
const PRODUCTION_RESULT_LABELS:Record<ProductionReportItem['result'],string>={PASSED:'Đạt',FAILED:'Lỗi',IN_PROGRESS:'Đang làm dở'};

function localDate(date:Date){const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,"0");const d=String(date.getDate()).padStart(2,"0");return `${y}-${m}-${d}`;}
function mondayOf(date=new Date()){const result=new Date(date);result.setHours(0,0,0,0);result.setDate(result.getDate()-((result.getDay()+6)%7));return result;}
function defaultProductionWeek(date=new Date()){const result=mondayOf(date);if(date.getDay()===0)result.setDate(result.getDate()+7);return result;}

type ProductionRunLine={actionType:'ASSEMBLE'|'PACK'|'TEST';outputId:string;targetQuantity:string};

function LegacyProductionView({api,people:allPeople,currentUser,finishedProducts,sellableProducts}:{api:Api;people:User[];currentUser:User;finishedProducts:FinishedProduct[];sellableProducts:SellableProduct[]}){
  const people=useMemo(()=>allPeople.filter(person=>["GIANG","MỸ","NAM","QUANG BK","THANH BK","PHONG BK","MINH BK"].includes(person.displayName.trim().toLocaleUpperCase("vi"))),[allPeople]);
  const [weekStart,setWeekStart]=useState(()=>localDate(defaultProductionWeek()));
  const [overview,setOverview]=useState<ProductionOverview|null>(null);
  const [lots,setLots]=useState<ProductionLot[]>([]);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
  const [selected,setSelectedState]=useState<{userId:string;date:string}|null>(null);
  const [registering,setRegistering]=useState(false);
  const [registeredDates,setRegisteredDates]=useState<string[]>([]);
  const [creatingRun,setCreatingRun]=useState(false);
  const [runLines,setRunLines]=useState<ProductionRunLine[]>([{actionType:'ASSEMBLE',outputId:'',targetQuantity:'50'}]);
  const [selectedLot,setSelectedLot]=useState<ProductionLot|null>(null);
  const [reportLotIds,setReportLotIds]=useState<string[]>([]);
  const [reportWorkText,setReportWorkText]=useState("");
  const [completionQuantity,setCompletionQuantity]=useState("");
  const [completionImpact,setCompletionImpact]=useState<ProductionLotImpact|null>(null);
  const [deletePreview,setDeletePreview]=useState<ProductionLotDeletePreview|null>(null);
  const [lotFilter,setLotFilter]=useState<'ACTIVE'|'DONE'>('ACTIVE');
  const [productionSection]=useState<"schedule"|"report">("schedule");
  const weekDates=useMemo(()=>Array.from({length:7},(_,index)=>{const date=new Date(`${weekStart}T00:00:00`);date.setDate(date.getDate()+index);return localDate(date);}),[weekStart]);
  const weekEnd=weekDates[6];
  const loadProduction=useCallback(async()=>{try{const [nextOverview,nextLots]=await Promise.all([api.productionOverview(weekStart,weekEnd),api.productionLots(true)]);setOverview(nextOverview);setLots(nextLots);setSelectedLot(current=>current?nextLots.find(lot=>lot.id===current.id)??null:null);setError("");}catch(err){setError(err instanceof Error?err.message:"Không tải được báo cáo sản xuất");}},[api,weekStart,weekEnd]);
  useEffect(()=>{void loadProduction();const socket=api.connect(()=>void loadProduction());return()=>{socket.disconnect();};},[api,loadProduction]);
  function setSelected(next:{userId:string;date:string}|null){
    if(!next){setSelectedState(null);setReportLotIds([]);setReportWorkText("");return;}
    if(currentUser.role!=="ADMIN"&&next.userId!==currentUser.id)return;
    const report=productionReportForDay(overview?.entries??[],next.userId,next.date);
    setReportLotIds(activeProductionLotIdsForMember(lots,next.userId,report?.id??null));setReportWorkText(report?.rawText??"");
    setSelectedState(next);
  }
  async function toggleRegistration(isRegistered:boolean){
    if(!selected)return;
    setBusy(true);setError("");
    try{
      await api.upsertProductionSession({userId:selected.userId,workDate:selected.date,isRegistered,hoursWorked:selectedSession?.hoursWorked===null||selectedSession?.hoursWorked===undefined?null:Number(selectedSession.hoursWorked)});
      setMessage(isRegistered?"Đã đăng ký ngày làm":"Đã bỏ đăng ký ngày làm");
      await loadProduction();
    }catch(err){setError(err instanceof Error?err.message:"Không cập nhật được đăng ký");}
    finally{setBusy(false);}
  }
  function moveWeek(days:number){const date=new Date(`${weekStart}T00:00:00`);date.setDate(date.getDate()+days);setWeekStart(localDate(date));}
  function openRegistration(){setRegisteredDates(weekDates.filter(date=>overview?.sessions.some(row=>row.userId===currentUser.id&&row.workDate===date&&row.isRegistered)));setRegistering(true);}
  async function saveRegistration(){setBusy(true);setError("");try{for(const date of weekDates){const old=overview?.sessions.find(row=>row.userId===currentUser.id&&row.workDate===date);await api.upsertProductionSession({userId:currentUser.id,workDate:date,isRegistered:registeredDates.includes(date),hoursWorked:old?.hoursWorked===null||old?.hoursWorked===undefined?null:Number(old.hoursWorked)});}setRegistering(false);setMessage("Đã lưu lịch đăng ký tuần");await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không lưu được lịch tuần");}finally{setBusy(false);}}
  async function saveDay(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selected)return;const form=new FormData(event.currentTarget);const hours=Number(form.get("hoursWorked"));const workText=reportWorkText.trim();if(!workText){setError("Cần nhập việc đã làm");return;}if(!reportLotIds.length){setError("Cần đăng ký ít nhất một Lô đang sản xuất trước khi báo cáo");return;}setBusy(true);setError("");try{await api.upsertProductionSession({userId:selected.userId,workDate:selected.date,isRegistered:true,hoursWorked:hours});const input={userId:selected.userId,workDate:selected.date,module:"SUPPORT" as const,workType:"Báo cáo tự do",outputType:"LABEL" as const,outputLabel:"Việc đã làm",rawText:workText,needsReview:true};if(selectedReport)await api.updateProductionEntry(selectedReport.id,input);else await api.createProductionEntry(input);setMessage(selectedReport?"Đã cập nhật báo cáo ngày":"Đã lưu báo cáo ngày");await loadProduction();setSelected(null);}catch(err){setError(err instanceof Error?err.message:"Không lưu được báo cáo");}finally{setBusy(false);}}
  async function createRun(event:FormEvent<HTMLFormElement>){event.preventDefault();const lines=runLines.map(line=>({...line,outputType:line.actionType==='PACK'?'SELLABLE_PRODUCT' as const:'FINISHED_PRODUCT' as const,targetQuantity:Number(line.targetQuantity)}));if(lines.some(line=>!line.outputId||!Number.isInteger(line.targetQuantity)||line.targetQuantity<1)){setError("Mỗi Lô cần Thành phẩm/Sản phẩm và số lượng nguyên dương");return;}setBusy(true);setError("");try{await api.createProductionRun({lots:lines});setCreatingRun(false);setRunLines([{actionType:'ASSEMBLE',outputId:'',targetQuantity:'50'}]);setMessage(`Đã tạo ${lines.length} Lô sản xuất`);await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không tạo được Đợt sản xuất");}finally{setBusy(false);}}
  function outputOptions(line:ProductionRunLine){return line.actionType==='PACK'?sellableProducts:finishedProducts.filter(item=>item.isProductionOutput);}
  function lotActionLabel(actionType:ProductionLot['actionType']){return actionType==='TEST'?'Test thành phẩm':actionType==='PACK'?'Đóng bộ máy':'Lắp thành phẩm';}
  async function claimLot(lot:ProductionLot){setBusy(true);setError("");try{await api.claimProductionLot(lot.id);setMessage(`Đã đăng ký làm ${lot.outputLabel}`);await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không đăng ký được Lô");}finally{setBusy(false);}}
  async function testLot(lot:ProductionLot){if(!window.confirm(`Xác nhận ${lot.outputLabel} đã thật sự TEST? Nếu sau đó phát hiện lỗi, người xác nhận sẽ bị ghi nhận để xử lý/phạt.`))return;setBusy(true);setError("");try{await api.testProductionLot(lot.id);setMessage(`Đã xác nhận TEST ${lot.outputLabel}`);await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không xác nhận TEST được Lô");}finally{setBusy(false);}}
  async function previewCompletion(){if(!selectedLot)return;const quantity=Number(completionQuantity);if(!Number.isInteger(quantity)||quantity<1){setError("Số lượng DONE phải là số nguyên dương");return;}setBusy(true);setError("");try{setCompletionImpact(await api.previewProductionLot(selectedLot.id,quantity));}catch(err){setError(err instanceof Error?err.message:"Không tính được thay đổi Kho");}finally{setBusy(false);}}
  async function confirmCompletion(){if(!selectedLot||!completionImpact)return;const quantity=Number(completionQuantity);setBusy(true);setError("");try{const result=await api.completeProductionLot(selectedLot.id,quantity);setMessage(!result.impact.inventoryChanged?"Đã DONE Lô Test · Kho không thay đổi":result.impact.warnings.length?`Đã DONE Lô · ${result.impact.warnings.length} cảnh báo lệch Kho`:"Đã DONE Lô và đồng bộ Kho");setCompletionImpact(null);setSelectedLot(null);await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không DONE được Lô");}finally{setBusy(false);}}
  async function saveLotNote(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selectedLot)return;const note=String(new FormData(event.currentTarget).get("note")||"");setBusy(true);setError("");try{await api.updateProductionLotNote(selectedLot.id,note);setMessage("Đã lưu ghi chú Lô");await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không lưu được ghi chú");}finally{setBusy(false);}}
  async function undoLot(){if(!selectedLot||!window.confirm(selectedLot.actionType==='TEST'?`Undo ${selectedLot.code}? Trạng thái Test sẽ được mở lại.`:`Undo ${selectedLot.code}? Kho sẽ tạo giao dịch đảo.`))return;setBusy(true);setError("");try{await api.undoProductionLot(selectedLot.id);setMessage(selectedLot.actionType==='TEST'?"Đã mở lại Lô Test; Kho không thay đổi":"Đã Undo Lô và đảo giao dịch Kho");setSelectedLot(null);await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không Undo được Lô");}finally{setBusy(false);}}
  async function previewDeleteLot(){if(!selectedLot)return;setBusy(true);setError("");try{setDeletePreview(await api.previewDeleteProductionLot(selectedLot.id));}catch(err){setError(err instanceof Error?err.message:"Không kiểm tra được việc xoá Đợt");}finally{setBusy(false);}}
  async function confirmDeleteLot(){if(!selectedLot||!deletePreview)return;setBusy(true);setError("");try{await api.deleteProductionLot(selectedLot.id);setMessage(deletePreview.stockImpact?"Đã xoá Đợt và đảo toàn bộ thay đổi Kho":"Đã xoá Đợt; báo cáo ngày vẫn được giữ");setDeletePreview(null);setSelectedLot(null);await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không xoá được Đợt");}finally{setBusy(false);}}
  const actor=(id:string)=>people.find(person=>person.id===id)?.displayName??id.slice(0,6);
  async function confirmProductionPayment(id:string,userId:string,totalHours:number){if(!window.confirm(`Xác nhận đã thanh toán ${totalHours.toLocaleString("vi-VN")} giờ cho ${actor(userId)}?`))return;setBusy(true);setError("");try{await api.markProductionPaymentPaid(id);setMessage("Đã chốt thanh toán kết công");await loadProduction();}catch(err){setError(err instanceof Error?err.message:"Không cập nhật được");}finally{setBusy(false);}}
  const dayLabel=(date:string)=>new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit"});
  const shortDate=(date:string)=>new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit"});
  const selectedSession=selected?overview?.sessions.find(row=>row.userId===selected.userId&&row.workDate===selected.date):null;
  const selectedEntries=selected?overview?.entries.filter(row=>row.userId===selected.userId&&row.workDate===selected.date)??[]:[];
  const selectedReport=selected?productionReportForDay(overview?.entries??[],selected.userId,selected.date):null;
  const otherSelectedEntries=selectedEntries.filter(entry=>entry.id!==selectedReport?.id);
  const activeLots=lots.filter(lot=>lot.status!=="DONE");
  const visibleLots=lots.filter(lot=>lotFilter==='DONE'?lot.status==='DONE':lot.status!=="DONE");
  const canCreateRun=currentUser.role==='ADMIN'||['giang','my','nam','quangbk','thanhbk','phongbk','minhbk','locbk'].includes(currentUser.username.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())||['giang','my','nam','quang bk','thanh bk','phong bk','minh bk','loc bk'].includes(currentUser.displayName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
  const canCompleteLot=canCompleteProductionLot(currentUser,selectedLot);
  const visiblePayments=(overview?.paymentRequests??[]).filter(row=>currentUser.role==="ADMIN"||row.userId===currentUser.id).sort((a,b)=>Math.max(0,...b.workSummary.map(item=>new Date(`${item.date}T00:00:00`).getTime()))-Math.max(0,...a.workSummary.map(item=>new Date(`${item.date}T00:00:00`).getTime())));
  function cellState(userId:string,date:string){const session=overview?.sessions.find(row=>row.userId===userId&&row.workDate===date);const entries=overview?.entries.filter(row=>row.userId===userId&&row.workDate===date)??[];const payment=session?overview?.paymentRequests.find(row=>row.sessionIds.includes(session.id)):undefined;return productionDayState(session,entries.length,payment?.status);}
  return <section className="productionSpace">
    <div className="productionHeading"><div><h1>SẢN XUẤT</h1><p>Đăng ký lịch và báo cáo thực tế.</p></div><div className="weekControls"><button onClick={()=>moveWeek(-7)}>‹</button><label><span>Tuần</span><input type="date" value={weekStart} onChange={event=>setWeekStart(localDate(mondayOf(new Date(`${event.target.value}T00:00:00`))))}/></label><button onClick={()=>moveWeek(7)}>›</button></div></div>
    {(message||error)&&<div className={error?"productionFeedback error":"productionFeedback"}>{error||message}</div>}
    <section className="productionLots productionSectionCard">
      <div className="productionSectionTitle"><div><h2>LÔ ĐANG SẢN XUẤT</h2><p>Đăng ký làm ngay tại Lô. Báo cáo ngày tự liên kết các Lô đã nhận.</p></div>{canCreateRun&&<button className="primary" onClick={()=>setCreatingRun(true)}>+ Tạo đợt</button>}</div>
      <div className="lotFilters"><button className={lotFilter==='ACTIVE'?'active':''} onClick={()=>setLotFilter('ACTIVE')}>Đang chạy · {activeLots.length}</button><button className={lotFilter==='DONE'?'active':''} onClick={()=>setLotFilter('DONE')}>Done · {lots.length-activeLots.length}</button></div>
      <div className="productionLotList">{visibleLots.map(lot=>{
        const joined=lot.participants.some(person=>person.id===currentUser.id);
        const canTest=currentUser.role==='ADMIN'||joined;
        return <article className="productionLotRow" key={lot.id}>
          <button className="lotOpenButton" onClick={()=>{setSelectedLot(lot);setCompletionQuantity(String(lot.targetQuantity));setCompletionImpact(null);setDeletePreview(null);}}>
            <InventoryThumbnail api={api} ownerType={lot.outputType==='FINISHED_PRODUCT'?'FINISHED_PRODUCT':'SELLABLE_PRODUCT'} ownerId={lot.outputId} label={`Ảnh ${lot.outputLabel}`} revision={0} className="productionLotThumbnail"/>
            <span className="lotIdentity"><small>{lot.code}</small><b>{lot.outputLabel}</b></span>
          </button>
          <span className="lotTarget"><b>{lot.completedQuantity??lot.targetQuantity}</b><small>{lot.status==='DONE'?'THỰC TẾ':'MỤC TIÊU'}</small></span>
          <span className={`lotStatus ${lot.status.toLowerCase()} ${lot.syncWarnings.length?'warning':''}`}>{lot.status==='NEW'?'CHƯA BẮT ĐẦU':lot.status==='IN_PROGRESS'?'ĐANG LÀM':lot.syncWarnings.length?'DONE · LỆCH KHO':'DONE'}</span>
          <span className="lotPeople">{lot.participants.length?lot.participants.map(person=><span className="avatar" title={person.displayName} style={{backgroundColor:avatarColor(person.id,person.displayName)}} key={person.id}><AvatarContent userId={person.id} name={person.displayName}/></span>):<small>Chưa ai nhận</small>}{lot.status!=='DONE'&&canCreateRun&&!joined&&<button className="lotClaim" disabled={busy} onClick={()=>void claimLot(lot)}>{lot.participants.length?'+ Tham gia':'Đăng ký làm'}</button>}</span>
          <span className="lotTest">{lot.testedAt?<b>ĐÃ TEST</b>:lot.status!=='DONE'&&canTest?<button disabled={busy} onClick={()=>void testLot(lot)}>ĐÃ TEST</button>:<small>Chưa test</small>}</span>
          <button className="lotChevron" aria-label={`Mở ${lot.outputLabel}`} onClick={()=>{setSelectedLot(lot);setCompletionQuantity(String(lot.targetQuantity));setCompletionImpact(null);setDeletePreview(null);}}>›</button>
        </article>;
      })}{!visibleLots.length&&<p className="emptyLot">{lotFilter==='ACTIVE'?'Chưa có Lô đang sản xuất.':'Chưa có Lô DONE.'}</p>}</div>
    </section>
    {productionSection==="schedule"&&<section className="productionSectionCard"><div className="productionSectionTitle"><div><h2>TUẦN VIỆC</h2><p>Bấm ô ngày để đăng ký hoặc ghi báo cáo.</p></div></div>
    <div className="productionToolbar"><div><b>{shortDate(weekStart)} – {shortDate(weekEnd)}</b><span>{overview?.summary.reduce((sum,row)=>sum+row.hours,0).toFixed(1)??"0.0"} giờ · {overview?.entries.length??0} việc</span></div></div>
    <div className="weekMatrix"><div className="weekMatrixHead"><span>Thành viên</span>{weekDates.map(date=><b key={date}>{dayLabel(date)}</b>)}<b>Tổng</b></div>{people.map(person=>{const summary=overview?.summary.find(row=>row.userId===person.id);return <div className="weekMatrixRow" key={person.id}><div className="memberCell"><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span><b>{person.displayName}</b></div>{weekDates.map(date=>{const state=cellState(person.id,date);return <button className={`dayCell ${state.className}`} title={state.detail} key={date} onClick={()=>setSelected({userId:person.id,date})}><b>{state.label}</b><small>{state.detail}</small></button>})}<div className="weekTotal"><b>{(summary?.hours??0).toFixed(1)}h</b><small>{summary?.entries??0} việc</small></div></div>})}</div>
    </section>}
    <section className="productionSectionCard paymentDashboard"><div className="paymentDashboardHead"><div><h2>KẾT CÔNG</h2><p>Danh sách các lần tổng kết ba buổi theo ngày thực tế.</p></div><div><b>{visiblePayments.filter(row=>row.status==="REQUESTED").length}</b><span>CHỜ THANH TOÁN</span></div></div><div className="paymentTable"><div className="paymentTableHeader"><span>Thành viên</span><span>3 ngày kết công</span><span>Tổng giờ</span><span>Trạng thái</span></div>{visiblePayments.map(row=><article key={row.id}><b>{actor(row.userId)}</b><span>{row.workSummary.map(item=>shortDate(item.date)).join(" · ")}</span><strong>{Number(row.totalHours)} giờ</strong>{row.status==="REQUESTED"&&currentUser.role==="ADMIN"?<button disabled={busy} onClick={()=>void confirmProductionPayment(row.id,row.userId,Number(row.totalHours))}>Đã thanh toán</button>:<span className={`paymentStatus ${row.status.toLowerCase()}`}>{row.status==="PAID"?"Đã thanh toán":"Chờ thanh toán"}</span>}</article>)}{!visiblePayments.length&&<p className="emptyPayment">Chưa có lần kết công nào.</p>}</div></section>
    {productionSection==="report"&&<><div className="productionToolbar"><div><b>{shortDate(weekStart)} – {shortDate(weekEnd)}</b><span>{overview?.summary.reduce((sum,row)=>sum+row.hours,0).toFixed(1)??"0.0"} giờ · {overview?.entries.length??0} việc</span></div><button className="primary" onClick={()=>setSelected({userId:currentUser.id,date:localDate(new Date())})}>Báo cáo hôm nay</button></div><div className="paymentDashboard"><div className="paymentDashboardHead"><div><h2>KẾT CÔNG</h2><p>Ba buổi theo ngày thực tế, sinh từ Report.</p></div><div><b>{visiblePayments.filter(row=>row.status==="REQUESTED").length}</b><span>CHỜ THANH TOÁN</span></div></div><div className="paymentTable"><div className="paymentTableHeader"><span>Thành viên</span><span>3 ngày kết công</span><span>Tổng giờ</span><span>Trạng thái</span></div>{visiblePayments.map(row=><article key={row.id}><b>{actor(row.userId)}</b><span>{row.workSummary.map(item=>shortDate(item.date)).join(" · ")}</span><strong>{Number(row.totalHours)} giờ</strong>{row.status==="REQUESTED"&&currentUser.role==="ADMIN"?<button disabled={busy} onClick={()=>void confirmProductionPayment(row.id,row.userId,Number(row.totalHours))}>Đã thanh toán</button>:<span className={`paymentStatus ${row.status.toLowerCase()}`}>{row.status==="PAID"?"Đã thanh toán":"Chờ thanh toán"}</span>}</article>)}{!visiblePayments.length&&<p className="emptyPayment">Chưa có lần kết công nào.</p>}</div></div><div className="weekMatrix"><div className="weekMatrixHead"><span>Thành viên</span>{weekDates.map(date=><b key={date}>{dayLabel(date)}</b>)}<b>Tổng</b></div>{people.map(person=>{const summary=overview?.summary.find(row=>row.userId===person.id);return <div className="weekMatrixRow" key={person.id}><div className="memberCell"><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span><b>{person.displayName}</b></div>{weekDates.map(date=>{const state=cellState(person.id,date);return <button className={`dayCell ${state.className}`} title={state.detail} key={date} onClick={()=>setSelected({userId:person.id,date})}><b>{state.label}</b><small>{state.detail}</small></button>})}<div className="weekTotal"><b>{(summary?.hours??0).toFixed(1)}h</b><small>{summary?.entries??0} việc</small></div></div>})}</div></>}
    {creatingRun&&<div className="modalBackdrop"><form className="productionModal createRunModal" onSubmit={event=>void createRun(event)}><div className="productionModalHead"><div><h2>Tạo đợt sản xuất</h2><p>Mỗi dòng sẽ sinh một Lô có ID riêng.</p></div><button type="button" onClick={()=>setCreatingRun(false)}>×</button></div><div className="runLines">{runLines.map((line,index)=><div className="runLine" key={index}><select aria-label="Loại công việc" value={line.actionType} onChange={event=>setRunLines(current=>current.map((item,position)=>position===index?{...item,actionType:event.target.value as ProductionRunLine['actionType'],outputId:''}:item))}><option value="ASSEMBLE">Lắp thành phẩm</option><option value="PACK">Đóng bộ máy</option><option value="TEST">Test thành phẩm</option></select><select aria-label="Đầu ra" value={line.outputId} onChange={event=>setRunLines(current=>current.map((item,position)=>position===index?{...item,outputId:event.target.value}:item))} required><option value="">Chọn {line.actionType==='PACK'?'sản phẩm':'thành phẩm'}...</option>{outputOptions(line).filter(item=>item.isActive).map(item=><option value={item.id} key={item.id} disabled={line.actionType==='ASSEMBLE'&&'productionReady' in item&&!item.productionReady}>{item.name}{line.actionType==='ASSEMBLE'&&'productionReady' in item&&!item.productionReady?' · CHƯA ĐỦ CẤU HÌNH':''}</option>)}</select><input aria-label="Số lượng mục tiêu" type="number" min="1" step="1" value={line.targetQuantity} onChange={event=>setRunLines(current=>current.map((item,position)=>position===index?{...item,targetQuantity:event.target.value}:item))} required/><button type="button" aria-label="Xóa dòng" disabled={runLines.length===1} onClick={()=>setRunLines(current=>current.filter((_,position)=>position!==index))}>×</button></div>)}</div><button type="button" onClick={()=>setRunLines(current=>[...current,{actionType:'ASSEMBLE',outputId:'',targetQuantity:'50'}])}>+ Thêm loại</button><div className="formActions"><button type="button" onClick={()=>setCreatingRun(false)}>Hủy</button><button className="primary" disabled={busy}>Tạo {runLines.length} Lô</button></div></form></div>}
    {selectedLot&&<div className="modalBackdrop"><div className="productionModal lotDetailModal"><div className="productionModalHead lotDetailHead"><InventoryThumbnail api={api} ownerType={selectedLot.outputType==='FINISHED_PRODUCT'?'FINISHED_PRODUCT':'SELLABLE_PRODUCT'} ownerId={selectedLot.outputId} label={`Ảnh ${selectedLot.outputLabel}`} revision={0} className="lotDetailThumbnail"/><div><small>{selectedLot.code}</small><h2>{selectedLot.outputLabel}</h2><p>{lotActionLabel(selectedLot.actionType)} · Mục tiêu {selectedLot.targetQuantity}</p></div><button onClick={()=>{setSelectedLot(null);setCompletionImpact(null);setDeletePreview(null);}}>×</button></div><div className="lotDetailSummary"><span className={`lotStatus ${selectedLot.status.toLowerCase()}`}>{selectedLot.status==='NEW'?'CHƯA BẮT ĐẦU':selectedLot.status==='IN_PROGRESS'?'ĐANG LÀM':'DONE'}</span><b>{selectedLot.completedQuantity??selectedLot.targetQuantity} <small>{selectedLot.status==='DONE'?'thực tế':'mục tiêu'}</small></b><div className="lotPeople">{selectedLot.participants.map(person=><span className="avatar" title={person.displayName} style={{backgroundColor:avatarColor(person.id,person.displayName)}} key={person.id}><AvatarContent userId={person.id} name={person.displayName}/></span>)}{!selectedLot.participants.length&&<small>Chưa có người Incharge</small>}</div></div>{selectedLot.status!=='DONE'&&canCreateRun&&!selectedLot.participants.some(person=>person.id===currentUser.id)&&<button className="lotDetailClaim" disabled={busy} onClick={()=>void claimLot(selectedLot)}>Đăng ký làm Lô này</button>}<div className="lotQualityGate"><span>{selectedLot.testedAt?`ĐÃ TEST · ${new Date(selectedLot.testedAt).toLocaleString('vi-VN')}`:'CHƯA TEST'}</span>{selectedLot.status!=='DONE'&&(currentUser.role==='ADMIN'||selectedLot.participants.some(person=>person.id===currentUser.id))&&!selectedLot.testedAt&&<button disabled={busy} onClick={()=>void testLot(selectedLot)}>Xác nhận ĐÃ TEST</button>}</div><form className="lotNote compact" onSubmit={event=>void saveLotNote(event)}><label>Ghi chú (không bắt buộc)<input name="note" defaultValue={selectedLot.note??''} placeholder="Thiếu vật tư, chờ test..."/></label><button disabled={busy}>Lưu</button></form>{selectedLot.status!=='DONE'&&canCompleteLot&&selectedLot.testedAt&&<section className="lotCompletion"><div><h3>DONE Lô</h3><p>{selectedLot.actionType==='TEST'?'Xác nhận kết quả Test, không thay đổi Kho.':'Preview thay đổi Kho trước khi xác nhận.'}</p></div><label>Số lượng thực tế đạt<input type="number" min="1" step="1" value={completionQuantity} onChange={event=>{setCompletionQuantity(event.target.value);setCompletionImpact(null);}}/></label>{!completionImpact?<button className="primary" disabled={busy} onClick={()=>void previewCompletion()}>{selectedLot.actionType==='TEST'?'Kiểm tra DONE':'Kiểm tra thay đổi Kho'}</button>:<div className="lotImpact">{completionImpact.inventoryChanged?<><b>Kho sẽ thay đổi</b><p className="impactOutput">+{completionImpact.output.change} {completionImpact.output.label} · {completionImpact.output.before} → {completionImpact.output.after}</p>{completionImpact.components.map(line=><p key={`${line.kind}-${line.id}`}>{line.change} {line.label} · {line.before} → {line.after}</p>)}{completionImpact.warnings.map(warning=><p className="warning" key={warning}>LỆCH KHO · {warning}</p>)}</>:<><b>Không thay đổi Kho</b><p>Lô chỉ ghi nhận số lượng Thành phẩm đã test.</p></>}<div className="formActions"><button onClick={()=>setCompletionImpact(null)}>Xem lại</button><button className="primary" disabled={busy} onClick={()=>void confirmCompletion()}>Xác nhận DONE</button></div></div>}</section>}{selectedLot.status==='DONE'&&currentUser.role==='ADMIN'&&<div className="lotUndo"><button disabled={busy} onClick={()=>void undoLot()}>Undo DONE</button><small>{selectedLot.actionType==='TEST'?'Hoàn tác trạng thái, Kho không thay đổi.':'Tạo giao dịch đảo, không xóa lịch sử.'}</small></div>}{currentUser.role==='ADMIN'&&<section className="lotDelete">{!deletePreview?<><button disabled={busy} onClick={()=>void previewDeleteLot()}>Xoá đợt</button><small>Đợt sẽ ẩn; báo cáo ngày vẫn được giữ.</small></>:<div className="lotDeleteAlert"><h3>Xoá {deletePreview.code}?</h3><p>{deletePreview.linkedReportCount} báo cáo ngày vẫn được giữ lại.</p>{deletePreview.stockImpact?<div className="lotImpact"><b>Kho sẽ được đảo lại</b><p className="impactOutput">{deletePreview.stockImpact.output.change} {deletePreview.stockImpact.output.label} · {deletePreview.stockImpact.output.before} → {deletePreview.stockImpact.output.after}</p>{deletePreview.stockImpact.components.map(line=><p key={`${line.kind}-${line.id}`}>+{line.change} {line.label} · {line.before} → {line.after}</p>)}</div>:<p>Kho không thay đổi.</p>}<div className="formActions"><button disabled={busy} onClick={()=>setDeletePreview(null)}>Huỷ</button><button className="deleteConfirm" disabled={busy} onClick={()=>void confirmDeleteLot()}>Xác nhận xoá</button></div></div>}</section>}<details className="lotOptional"><summary>Báo cáo & Logger · {selectedLot.reports.length} báo cáo</summary><div className="lotDetailGrid"><section className="lotReports"><h3>Báo cáo liên quan</h3>{selectedLot.reports.map(report=><article key={report.id}><b>{actor(report.userId)} · {shortDate(report.workDate)}</b><p>{report.rawText}</p></article>)}{!selectedLot.reports.length&&<p className="empty">Chưa có báo cáo chọn Lô này.</p>}</section><aside className="lotLogger"><h3>Logger</h3>{selectedLot.events.map(event=><article key={event.id}><b>{event.type}</b><small>{allPeople.find(person=>person.id===event.actorId)?.displayName??event.actorId.slice(0,6)} · {new Date(event.createdAt).toLocaleString('vi-VN')}</small></article>)}</aside></div></details></div></div>}
    {registering&&<div className="modalBackdrop"><div className="productionModal compact"><div className="productionModalHead"><div><h2>Đăng ký tuần</h2><p>{shortDate(weekStart)} – {shortDate(weekEnd)}</p></div><button onClick={()=>setRegistering(false)}>×</button></div><div className="registrationDays">{weekDates.map(date=><label key={date}><input type="checkbox" checked={registeredDates.includes(date)} onChange={event=>setRegisteredDates(current=>event.target.checked?[...current,date]:current.filter(item=>item!==date))}/><span>{dayLabel(date)}</span></label>)}</div><button className="primary" disabled={busy} onClick={()=>void saveRegistration()}>Lưu lịch tuần</button></div></div>}
    {selected&&<div className="modalBackdrop"><div className="productionModal">
      <div className="productionModalHead"><div><h2>{actor(selected.userId)} · {dayLabel(selected.date)}</h2><p>{selectedSession?.hoursWorked!==null&&selectedSession?.hoursWorked!==undefined?`${Number(selectedSession.hoursWorked)} giờ đã ghi`:"Chưa ghi giờ làm"}</p></div><button onClick={()=>setSelected(null)}>×</button></div>
      <label className="dayRegistration"><input type="checkbox" checked={selectedSession?.isRegistered??false} disabled={busy} onChange={event=>void toggleRegistration(event.target.checked)}/><span>Đăng ký làm ngày này</span></label>
      {otherSelectedEntries.length>0&&<div className="dayEntries">{otherSelectedEntries.map(entry=><article className="dayEntryCard" key={entry.id}><div className="dayEntryMain"><b>{entry.outputLabel}</b>{entry.quantity!==null&&<strong>{Number(entry.quantity).toLocaleString("vi-VN")} <small>unit</small></strong>}</div><div className="dayEntryMeta"><span>{PRODUCTION_MODULES[entry.module].label}</span><span>{entry.workType}</span></div>{entry.rawText&&<p className="dayEntryRaw">{entry.rawText}</p>}</article>)}</div>}
      <form className="dayReportForm freeReportForm" onSubmit={event=>void saveDay(event)}><div className="reportFormHead"><div><h3>{selectedReport?"Cập nhật báo cáo ngày":"Báo cáo buổi làm"}</h3><p>Chỉ điền giờ và việc đã làm. Lô được lấy tự động từ đăng ký phía trên.</p></div><label>Giờ làm trong ngày<input name="hoursWorked" type="number" min="0.25" max="24" step="0.25" defaultValue={selectedSession?.hoursWorked??""} placeholder="4" required/></label></div><label className="freeWorkText">Việc đã làm<textarea name="workText" rows={7} value={reportWorkText} onChange={event=>setReportWorkText(event.target.value)} placeholder={"Ví dụ:\n- Cắt và bấm đầu cáp Honda\n- Test đủ 50 bộ"} required/></label><div className="reportLots autoLinkedLots"><b>Lô tự liên kết</b><div className="selectedReportLots">{reportLotIds.map(id=>{const lot=lots.find(item=>item.id===id);return lot?<span key={id}>{lot.outputLabel} · {lot.code}</span>:null;})}{!reportLotIds.length&&<small>Chưa đăng ký Lô nào. Hãy đăng ký ở danh sách Lô đang sản xuất.</small>}</div></div><button className="primary reportSubmit" disabled={busy}>{selectedReport?"Cập nhật báo cáo":"Lưu báo cáo ngày"}</button></form>
    </div></div>}
  </section>;
}

export function ProductionTestAction({lot,currentUser,disabled,canOperate,onClaim,onResult}:{lot:ProductionLot;currentUser:Pick<User,'id'|'role'>;disabled:boolean;canOperate:boolean;onClaim:(lot:ProductionLot)=>void;onResult:(lot:ProductionLot)=>void}){
  if(lot.status==='WAITING_TEST')return <button type="button" className="primary" disabled={disabled||!canOperate} onClick={()=>onClaim(lot)}>Nhận Test</button>;
  if(lot.status==='TESTING')return <><span className="productionTestBadge standalone">Đang Test</span>{(lot.testClaimedById===currentUser.id||currentUser.role==='ADMIN')&&<button type="button" disabled={disabled||!canOperate} onClick={()=>onResult(lot)}>Nhập kết quả</button>}</>;
  return null;
}

function ProductionView({api,people:allPeople,currentUser,finishedProducts,sellableProducts}:{api:Api;people:User[];currentUser:User;finishedProducts:FinishedProduct[];sellableProducts:SellableProduct[]}){
  const personKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const people=allPeople.filter(person=>['giang','my','nam','quangbk','thanhbk','phongbk','minhbk','locbk'].includes(personKey(person.username))||['giang','my','nam','quang bk','thanh bk','phong bk','minh bk','loc bk'].includes(personKey(person.displayName)));
  const addDays=(date:Date,days:number)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next;};
  const shortDate=(date:string)=>new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
  const dayLabel=(date:string)=>new Date(`${date}T00:00:00`).toLocaleDateString('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit'});
  const [weekStart,setWeekStart]=useState(()=>localDate(mondayOf(new Date())));
  const [overview,setOverview]=useState<ProductionOverview|null>(null);
  const [lots,setLots]=useState<ProductionLot[]>([]);
  const [productionFinished,setProductionFinished]=useState(finishedProducts);const [productionSellable,setProductionSellable]=useState(sellableProducts);
  const [worklogStatus,setWorklogStatus]=useState<ProductionStatusFilterId>('IN_PROGRESS');
  const visibleWorklogs=filterProductionLots(lots,worklogStatus);
  const [busy,setBusy]=useState(false);const [claimingTestLotId,setClaimingTestLotId]=useState<string|null>(null);const [message,setMessage]=useState('');const [error,setError]=useState('');
  const [scheduleDay,setScheduleDay]=useState<{userId:string;date:string}|null>(null);
  const [reportDrafts,setReportDrafts]=useState<ProductionReportDraft[]>([]);
  const [reportHours,setReportHours]=useState('');
  const [legacyReportText,setLegacyReportText]=useState('');
  const [testError,setTestError]=useState('');
  const [creating,setCreating]=useState(false);const [testLot,setTestLot]=useState<ProductionLot|null>(null);const [editingLot,setEditingLot]=useState<ProductionLot|null>(null);const [worklogDeletePreview,setWorklogDeletePreview]=useState<ProductionLotDeletePreview|null>(null);
  const weekEnd=useMemo(()=>localDate(addDays(new Date(`${weekStart}T00:00:00`),6)),[weekStart]);
  const weekDates=useMemo(()=>Array.from({length:7},(_,index)=>localDate(addDays(new Date(`${weekStart}T00:00:00`),index))),[weekStart]);
  const canOperate=currentUser.role==='ADMIN'||people.some(person=>person.id===currentUser.id);
  const actor=(id:string|null)=>allPeople.find(person=>person.id===id)?.displayName??'—';
  const load=useCallback(async()=>{const [nextOverview,nextLots]=await Promise.all([api.productionOverview(weekStart,weekEnd),api.productionLots(true)]);setOverview(nextOverview);setLots(nextLots);const [nextFinished,nextSellable]=await Promise.allSettled([api.finishedProducts(),api.sellableProducts()]);if(nextFinished.status==='fulfilled')setProductionFinished(nextFinished.value);if(nextSellable.status==='fulfilled')setProductionSellable(nextSellable.value);},[api,weekEnd,weekStart]);
  useEffect(()=>{void load().catch(err=>setError(err instanceof Error?err.message:'Không tải được Sản xuất'));},[load]);
  const run=async(action:()=>Promise<unknown>,success:string)=>{setBusy(true);setError('');try{await action();setMessage(success);await load();}catch(err){setError(err instanceof Error?err.message:'Không thực hiện được');}finally{setBusy(false);}};
  const testLocked=(lot:ProductionLot)=>lot.status==='TESTING'||lot.status==='DONE';
  const lotStatus=(lot:ProductionLot)=>lot.status==='NEW'?'CHỜ NHẬN':lot.status==='IN_PROGRESS'?'ĐANG LÀM':lot.status==='WAITING_TEST'?'ĐÃ XONG · CHỜ TEST':lot.status==='TESTING'?'ĐANG TEST':'HOÀN THÀNH';
  const eventLabel=(event:ProductionLot['events'][number])=>{const action=String(event.payload?.action??'');if(action==='DEVICE_TEST_RETIRED')return 'Đã chuyển sang Test thủ công · lịch sử ESP32 được giữ';if(action==='COMMENT')return String(event.payload?.text??'Đã bình luận');if(action==='ASSIGNEES_UPDATED')return 'Đã thay đổi người làm';if(action==='WORKLOG_EDITED')return 'Đã cập nhật thông tin hoặc trạng thái';if(action==='DEVICE_TEST_PUBLISHED')return 'Đã gửi ESP32 (lịch sử)';if(event.type==='TEST_CLAIMED')return event.payload?.source==='DEVICE_TEST'?'Máy Cloud đã nhận lô':'Đã nhận Test';if(event.type==='TESTED')return event.payload?.source==='DEVICE_TEST'?'Đã đồng bộ kết quả từ máy Cloud':'Đã lưu kết quả Test';return event.type==='CREATED'?'Đã tạo Worklog':event.type==='CLAIMED'?'Đã đăng ký làm':event.type==='STARTED'?'Đã bắt đầu làm':event.type==='PRODUCTION_FINISHED'?'Đã báo xong · Chờ Test':event.type==='DONE'?'Đã hoàn thành':'Đã cập nhật Worklog';};
  const waitingLots=lots.filter(lot=>lot.status==='WAITING_TEST'||lot.status==='TESTING');
  function openScheduleDay(userId:string,date:string){
    const report=productionReportForDay(overview?.entries??[],userId,date);
    const session=overview?.sessions.find(row=>row.userId===userId&&row.workDate===date);
    const items=report?.reportItems??[];
    const memberLots=lots.filter(lot=>lot.status!=='DONE'&&lot.participants.some(person=>person.id===userId));
    setReportDrafts(items.length?items.map((item,index)=>({...item,key:`saved-${index}-${item.lotId}`})):[newProductionReportDraft(memberLots[0]?.id??'',memberLots[0]?.actionType==='SOLDER'?'SOLDER':'ASSEMBLE')]);
    setReportHours(session?.hoursWorked??'');
    setLegacyReportText(items.length?'':report?.rawText??'');
    setScheduleDay({userId,date});
  }
  async function createWorklog(input:ProductionWorklogInput){await run(async()=>{const created=await api.createProductionRun({lots:[input]});await api.claimProductionLot(created.lots[0].id);setCreating(false);},'Đã bắt đầu Worklog Sản xuất');}
  async function saveScheduleDayReport(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!scheduleDay)return;
    const report=productionReportForDay(overview?.entries??[],scheduleDay.userId,scheduleDay.date);
    const reportItems=reportDrafts.map(({key:_,...item})=>({...item,quantity:Number(item.quantity),note:item.note?.trim()||undefined}));
    if(!reportItems.length||reportItems.some(item=>!item.lotId||!Number.isInteger(item.quantity)||item.quantity<1)){setError('Mỗi dòng cần Worklog và số lượng hợp lệ');return;}
    const hoursWorked=Number(reportHours);
    if(!Number.isFinite(hoursWorked)||hoursWorked<=0||hoursWorked>24){setError('Nhập Tổng H trong ngày từ 0 đến 24 giờ');return;}
    const rawText=reportItems.map(item=>{const lot=lots.find(row=>row.id===item.lotId);return `${lot?.outputLabel??'Worklog'} · ${PRODUCTION_STAGE_LABELS[item.stage]} · SL ${item.quantity} · ${PRODUCTION_RESULT_LABELS[item.result]}${item.note?` · ${item.note}`:''}`;}).join('\n');
    await run(async()=>{await api.upsertProductionSession({userId:scheduleDay.userId,workDate:scheduleDay.date,isRegistered:true,hoursWorked});const input={userId:scheduleDay.userId,workDate:scheduleDay.date,module:'SUPPORT' as const,workType:'Báo cáo theo Worklog',outputType:'LABEL' as const,outputLabel:'Việc đã làm',rawText,reportItems,lotIds:[...new Set(reportItems.map(item=>item.lotId))],needsReview:true};if(report)await api.updateProductionEntry(report.id,input);else await api.createProductionEntry(input);},report?'Đã cập nhật báo công':'Đã lưu báo công');setScheduleDay(null);
  }
  async function saveProductionWorklog(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!editingLot)return;const data=new FormData(event.currentTarget);const status=String(data.get('status')??editingLot.status) as ProductionLot['status'];const participantIds=currentUser.role==='ADMIN'?data.getAll('participantIds').map(String):undefined;const input={targetQuantity:Number(data.get('targetQuantity')),producedQuantity:Number(data.get('producedQuantity')),note:String(data.get('note')??'').trim(),status,participantIds};await run(()=>api.updateProductionLot(editingLot.id,input),'Đã cập nhật Worklog Sản xuất');setEditingLot(null);}
  async function joinProductionWorklog(lot:ProductionLot){await run(()=>api.claimProductionLot(lot.id),lot.participants.length?'Đã tham gia Worklog':'Đã đăng ký làm Worklog');}
  async function changeProductionStatus(lot:ProductionLot,status:ProductionLot['status']){if(status===lot.status)return;await run(()=>api.updateProductionLot(lot.id,{status}),`Đã chuyển sang ${lotStatus({...lot,status})}`);}
  function openTestResult(lot:ProductionLot){setTestError('');setTestLot(lot);}
  async function claimManualTest(lot:ProductionLot){
    if(claimingTestLotId!==null||!canOperate)return;
    setClaimingTestLotId(lot.id);setTestError('');setError('');
    try{
      await api.claimProductionTest(lot.id);
      setMessage('Đã nhận Test · nhập kết quả sau khi test thực tế');
      await load();
    }catch(err){setError(err instanceof Error?err.message:'Không nhận Test được');}
    finally{setClaimingTestLotId(null);}
  }
  function testAction(lot:ProductionLot){
    return <ProductionTestAction lot={lot} currentUser={currentUser} disabled={busy||claimingTestLotId!==null} canOperate={canOperate} onClaim={lot=>void claimManualTest(lot)} onResult={openTestResult}/>;
  }
  async function addProductionComment(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!editingLot)return;const form=event.currentTarget;const comment=String(new FormData(form).get('comment')??'').trim();if(!comment)return;await run(()=>api.updateProductionLot(editingLot.id,{comment}),'Đã thêm trao đổi');form.reset();setEditingLot(null);}
  async function previewWorklogDelete(){if(!editingLot)return;setBusy(true);setError('');try{setWorklogDeletePreview(await api.previewDeleteProductionLot(editingLot.id));}catch(err){setError(err instanceof Error?err.message:'Không kiểm tra được ảnh hưởng khi xoá');}finally{setBusy(false);}}
  async function confirmWorklogDelete(){if(!editingLot||!worklogDeletePreview)return;setBusy(true);setError('');try{await api.deleteProductionLot(editingLot.id);setMessage(worklogDeletePreview.stockImpact?'Đã xoá lô và đảo thay đổi Kho':'Đã xoá lô; báo công liên quan vẫn được giữ');setWorklogDeletePreview(null);setEditingLot(null);await load();}catch(err){setError(err instanceof Error?err.message:'Không xoá được lô');}finally{setBusy(false);}}
  async function submitTest(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!testLot||busy)return;
    const data=new FormData(event.currentTarget);
    const input={testedQuantity:Number(data.get('tested')),passedQuantity:Number(data.get('passed')),failedQuantity:Number(data.get('failed')),note:String(data.get('note')??'').trim()||undefined};
    if(input.passedQuantity+input.failedQuantity!==input.testedQuantity){setTestError('Số đạt + lỗi phải bằng số đã Test');return;}
    setBusy(true);setTestError('');setError('');
    try{await api.completeProductionTest(testLot.id,input);setTestLot(null);setMessage('Đã lưu kết quả Test và cập nhật Kho');await load();}
    catch(err){const message=err instanceof Error?err.message:'Chưa lưu được kết quả Test. Hãy thử lại.';setTestError(message);setError(message);}
    finally{setBusy(false);}
  }
  return <section className="productionSpace productionWorklogSpace">
    <div className="productionHeading"><div><h1>SẢN XUẤT SPACE</h1><p>Đăng ký lịch, mở Worklog và cập nhật kết quả ngay trên một luồng.</p></div></div>
    {(message||error)&&<div className={error?'productionFeedback error':'productionFeedback'}>{error||message}</div>}
    <section className="productionSectionCard compactSchedule"><div className="productionSectionTitle"><div><h2>THỜI KHÓA BIỂU</h2><p>Bấm ô ngày để đăng ký, nhập việc đã làm và Tổng H.</p></div><div className="weekControls"><button aria-label="Tuần trước" onClick={()=>setWeekStart(localDate(addDays(new Date(`${weekStart}T00:00:00`),-7)))}>‹</button><b>{shortDate(weekStart)} – {shortDate(weekEnd)}</b><button aria-label="Tuần sau" onClick={()=>setWeekStart(localDate(addDays(new Date(`${weekStart}T00:00:00`),7)))}>›</button></div></div>
      <ProductionSchedule people={people} dates={weekDates} sessions={overview?.sessions??[]} entries={overview?.entries??[]} dayLabel={dayLabel} onOpen={openScheduleDay}/>
      <ProductionReportWarnings admin={currentUser.role==='ADMIN'} warnings={overview?.productivityWarnings??[]} name={actor} onOpen={openScheduleDay}/>
    </section>
    <div className="productionMiniGrid">
      <section className="productionSectionCard"><div className="productionSectionTitle"><div><h2>CHỜ TEST</h2><p>{waitingLots.length} Worklog cần xử lý</p></div></div><div className="testQueue">{waitingLots.slice(0,5).map(lot=>{const testerName=actor(lot.testClaimedById);return <article key={lot.id}><InventoryThumbnail api={api} ownerType={lot.outputType==='FINISHED_PRODUCT'?'FINISHED_PRODUCT':'SELLABLE_PRODUCT'} ownerId={lot.outputId} label={`Ảnh ${lot.outputLabel}`} revision={0} className="productionMiniThumb"/><div><ProductionWorklogTag actionType={lot.actionType}/><b>{lot.producedQuantity??lot.targetQuantity} {lot.outputLabel}</b>{lot.status==='WAITING_TEST'&&<small>{lot.testProfileKey?'Chờ máy Test nhận':`${actor(lot.participants[0]?.id??null)} đã làm`}</small>}</div><span className="testQueueTesterSlot">{lot.status==='TESTING'&&lot.testClaimedById&&<span className="avatar testQueueTester" title={testerName} aria-label={`${testerName} đang Test`} style={{backgroundColor:avatarColor(lot.testClaimedById,testerName)}}><AvatarContent userId={lot.testClaimedById} name={testerName}/></span>}</span><div className="productionTestActions">{testAction(lot)}</div></article>;})}{!waitingLots.length&&<p className="empty">Không có Worklog chờ Test.</p>}</div></section>
      <section className="productionSectionCard"><div className="productionSectionTitle"><div><h2>KHO HIỆN TẠI</h2><p>Thành phẩm và Sản phẩm</p></div></div><div className="stockMiniList">{productionFinished.filter(item=>item.isProductionOutput&&item.isActive).slice(0,3).map(item=><span key={item.id}><InventoryThumbnail api={api} ownerType="FINISHED_PRODUCT" ownerId={item.id} label={`Ảnh ${item.name}`} revision={0} className="productionMiniThumb"/><b>{item.name}</b><strong>{Number(item.onHandQty).toLocaleString('vi-VN')}</strong></span>)}{productionSellable.filter(item=>item.isActive).slice(0,1).map(item=><span key={item.id}><InventoryThumbnail api={api} ownerType="SELLABLE_PRODUCT" ownerId={item.id} label={`Ảnh ${item.name}`} revision={0} className="productionMiniThumb"/><b>{item.name}</b><strong>{Number(item.onHandQty).toLocaleString('vi-VN')}</strong></span>)}</div></section>
    </div>
    <section className="productionSectionCard productionWorklogs"><div className="productionSectionTitle"><div><h2>WORKLOG SẢN XUẤT</h2><p>Nhiều người có thể cùng đăng ký; bấm vào việc để xem chi tiết.</p></div><button className="primary" disabled={!canOperate} onClick={()=>{setError('');setCreating(true);}}>+ Worklog SX</button></div><ProductionStatusFilter lots={lots} value={worklogStatus} onChange={setWorklogStatus}/><div className="productionWorklogHead"><span>VIỆC</span><span>NGÀY TẠO</span><span>NGƯỜI</span><span>SL</span><span>LOGGER</span><span>TRẠNG THÁI</span></div>{visibleWorklogs.map(lot=><article className={`productionWorklogRow ${['WAITING_TEST','TESTING'].includes(lot.status)?'production-finished':''}`} key={lot.id} onClick={()=>{setWorklogDeletePreview(null);setEditingLot(lot);}}><div className="productionWorklogIdentity"><InventoryThumbnail api={api} ownerType={lot.outputType==='FINISHED_PRODUCT'?'FINISHED_PRODUCT':'SELLABLE_PRODUCT'} ownerId={lot.outputId} label={`Ảnh ${lot.outputLabel}`} revision={0} className="productionWorklogThumb"/><span><ProductionWorklogTag actionType={lot.actionType}/><small>{lot.code}</small><b>{lot.targetQuantity} {lot.outputLabel}</b></span></div><ProductionLotCreatedDate createdAt={lot.createdAt}/><div className="productionWorklogPeople"><div className="assigneeAvatars">{lot.participants.map(person=><span className="avatar" title={person.displayName} style={{backgroundColor:avatarColor(person.id,person.displayName)}} key={person.id}><AvatarContent userId={person.id} name={person.displayName}/></span>)}</div>{canOperate&&!lot.participants.some(person=>person.id===currentUser.id)&&['NEW','IN_PROGRESS'].includes(lot.status)&&<button type="button" className="productionJoinWorklog" disabled={busy} onClick={event=>{event.stopPropagation();void joinProductionWorklog(lot);}}>{lot.participants.length?'+ Tham gia':'Đăng ký'}</button>}</div><strong>{(lot.status==='DONE'?lot.completedQuantity:lot.producedQuantity)??0}/{lot.targetQuantity}</strong><small>{lot.events.length} hoạt động</small><div className="productionRowActions" onClick={event=>event.stopPropagation()}>{testAction(lot)}<select className={`productionStatusSelect ${lot.status.toLowerCase()}`} aria-label={`Trạng thái ${lot.outputLabel}`} value={lot.status} disabled={busy||testLocked(lot)||lot.status==='DONE'} onClick={event=>event.stopPropagation()} onChange={event=>{event.stopPropagation();void changeProductionStatus(lot,event.target.value as ProductionLot['status']);}}><option value="NEW" disabled={currentUser.role!=='ADMIN'}>Chờ nhận</option><option value="IN_PROGRESS">Đang làm</option><option value="WAITING_TEST">Đã xong · Chờ Test</option>{lot.status==='TESTING'&&<option value="TESTING">Đang Test</option>}{lot.status==='DONE'&&<option value="DONE">Hoàn thành</option>}</select></div></article>)}{!visibleWorklogs.length&&<p className="emptyList">Không có Worklog ở trạng thái này.</p>}</section>
    <ProductionPayments payments={overview?.paymentRequests??[]} currentUser={currentUser} name={actor} color={avatarColor} busy={busy} error={error} onPay={id=>run(()=>api.markProductionPaymentPaid(id),'Đã xác nhận thanh toán')}/>
    {creating&&<ProductionWorklogForm finishedProducts={productionFinished} sellableProducts={productionSellable} busy={busy} error={error} onCreate={createWorklog} onClose={()=>setCreating(false)}/> }
    {editingLot&&<div className="modalBackdrop"><div className="productionModal productionWorklogDetail"><div className="productionModalHead"><div><ProductionWorklogTag actionType={editingLot.actionType}/><h2>{editingLot.outputLabel}</h2><p>{editingLot.code} · {lotStatus(editingLot)}</p></div><button type="button" onClick={()=>{setWorklogDeletePreview(null);setEditingLot(null);}}>×</button></div><div className="productionDetailColumns"><form className="productionDetailInfo" onSubmit={event=>void saveProductionWorklog(event)}><h3>THÔNG TIN</h3><div className="productionDetailNumbers"><label>SL mục tiêu<input name="targetQuantity" type="number" min={editingLot.producedQuantity??1} step="1" defaultValue={editingLot.targetQuantity} readOnly={testLocked(editingLot)} required/></label><label>SL đã làm<input name="producedQuantity" type="number" min="0" max={editingLot.targetQuantity} step="1" defaultValue={editingLot.producedQuantity??0} readOnly={testLocked(editingLot)} required/></label></div><label>Trạng thái<select name="status" defaultValue={editingLot.status} disabled={testLocked(editingLot)}><option value="NEW">Chờ nhận</option><option value="IN_PROGRESS">Đang làm</option><option value="WAITING_TEST">Đã xong · Chờ Test</option>{editingLot.status==='TESTING'&&<option value="TESTING">Đang Test</option>}<option value="DONE" disabled>Hoàn thành · chốt từ kết quả Test</option></select></label><fieldset className="productionAssigneePicker" disabled={currentUser.role!=='ADMIN'}><legend>Người đăng ký làm · có thể chọn nhiều</legend>{people.map(person=><label key={person.id}><input type="checkbox" name="participantIds" value={person.id} defaultChecked={editingLot.participants.some(item=>item.id===person.id)}/><span className="avatar" style={{backgroundColor:avatarColor(person.id,person.displayName)}}><AvatarContent userId={person.id} name={person.displayName}/></span>{person.displayName}</label>)}</fieldset><label>Ghi chú<textarea name="note" rows={3} defaultValue={editingLot.note??''} placeholder="Thông tin cần cập nhật"/></label><div className="formActions"><button type="button" onClick={()=>{setWorklogDeletePreview(null);setEditingLot(null);}}>Hủy</button><button className="primary" disabled={busy||editingLot.status==='DONE'}>Lưu thay đổi</button></div>{currentUser.role==='ADMIN'&&<section className="lotDelete">{!worklogDeletePreview?<><button type="button" disabled={busy} onClick={()=>void previewWorklogDelete()}>Xoá lô</button><small>Lô sẽ ẩn; báo công liên quan vẫn được giữ.</small></>:<div className="lotDeleteAlert"><h3>Xoá {worklogDeletePreview.code}?</h3><p>{worklogDeletePreview.linkedReportCount} báo công liên quan vẫn được giữ lại.</p>{worklogDeletePreview.stockImpact?<div className="lotImpact"><b>Kho sẽ được đảo lại</b><p className="impactOutput">{worklogDeletePreview.stockImpact.output.change} {worklogDeletePreview.stockImpact.output.label} · {worklogDeletePreview.stockImpact.output.before} → {worklogDeletePreview.stockImpact.output.after}</p>{worklogDeletePreview.stockImpact.components.map(line=><p key={line.kind+'-'+line.id}>+{line.change} {line.label} · {line.before} → {line.after}</p>)}</div>:<p>Kho không thay đổi.</p>}<div className="formActions"><button type="button" disabled={busy} onClick={()=>setWorklogDeletePreview(null)}>Huỷ</button><button type="button" className="deleteConfirm" disabled={busy} onClick={()=>void confirmWorklogDelete()}>Xác nhận xoá</button></div></div>}</section>}</form><aside className="productionDetailLog"><h3>TRAO ĐỔI & LỊCH SỬ</h3><form className="productionCommentForm" onSubmit={event=>void addProductionComment(event)}><textarea name="comment" rows={2} placeholder="Viết comment..." required/><button disabled={busy}>Gửi</button></form><div className="productionEventList">{editingLot.events.map(event=><article key={event.id}><span className="avatar" style={{backgroundColor:avatarColor(event.actorId,actor(event.actorId))}}><AvatarContent userId={event.actorId} name={actor(event.actorId)}/></span><div><b>{event.payload?.source==='SYSTEM'?'Hệ thống':actor(event.actorId)}</b><p>{eventLabel(event)}</p><small>{new Date(event.createdAt).toLocaleString('vi-VN')}</small></div></article>)}</div></aside></div></div></div>}
    {testLot&&<div className="modalBackdrop"><form className="productionModal compact testResultModal" role="dialog" aria-modal="true" aria-label="Kết quả Test" onSubmit={event=>void submitTest(event)}><div className="productionModalHead"><div><ProductionWorklogTag actionType={testLot.actionType}/><h2>Kết quả Test</h2><p>{testLot.code} · {testLot.outputLabel} · {actor(testLot.testClaimedById)}</p></div><button type="button" disabled={busy} onClick={()=>setTestLot(null)}>×</button></div><p className="testCloudNote">Kết quả lưu trên Auto2Tech cùng người test và thời gian. Chỉ xác nhận sau khi đã test thực tế.</p>{testError&&<p className="productionTestError" role="alert">{testError}</p>}<div className="testResultFields"><label>Đã Test<input name="tested" type="number" min="1" max={testLot.producedQuantity??testLot.targetQuantity} defaultValue={testLot.producedQuantity??testLot.targetQuantity} required/></label><label>Đạt<input name="passed" type="number" min="0" max={testLot.producedQuantity??testLot.targetQuantity} placeholder="Nhập số đạt thực tế" required/></label><label>Lỗi<input name="failed" type="number" min="0" defaultValue="0" required/></label></div><label>Ghi chú lỗi<textarea name="note" rows={3} placeholder="Không bắt buộc nếu không có lỗi"/></label><div className="formActions"><button type="button" disabled={busy} onClick={()=>setTestLot(null)}>Hủy</button><button className="primary" disabled={busy}>{busy?'Đang lưu…':'Lưu kết quả'}</button></div></form></div>}
    {scheduleDay&&<div className="modalBackdrop"><div className="productionModal productionDailyReportModal"><div className="productionModalHead"><div><h2>{actor(scheduleDay.userId)} · {dayLabel(scheduleDay.date)}</h2><p>Ghi rõ việc đã làm; Tổng H trong ngày được nhập riêng.</p></div><button onClick={()=>setScheduleDay(null)}>×</button></div>{(()=>{const session=overview?.sessions.find(row=>row.userId===scheduleDay.userId&&row.workDate===scheduleDay.date);const report=productionReportForDay(overview?.entries??[],scheduleDay.userId,scheduleDay.date);const canEdit=currentUser.role==='ADMIN'||scheduleDay.userId===currentUser.id;const reportableLots=lots.filter(lot=>(lot.status!=='DONE'&&lot.participants.some(person=>person.id===scheduleDay.userId))||reportDrafts.some(item=>item.lotId===lot.id));return <><ProductionRegistration key={`${scheduleDay.userId}:${scheduleDay.date}`} api={api} userId={scheduleDay.userId} workDate={scheduleDay.date} session={session} reported={Boolean(report&&session?.hoursWorked!=null)} canEdit={canEdit} onSaved={load}/>{session?.isRegistered?<form className="structuredReportForm" onSubmit={event=>void saveScheduleDayReport(event)}>{legacyReportText&&<div className="legacyReportNotice"><b>Báo cáo cũ</b><p>{legacyReportText}</p><small>Hãy chuyển nội dung trên thành các dòng rõ ràng bên dưới khi cập nhật.</small></div>}<div className="structuredReportHead"><div><h3>VIỆC ĐÃ LÀM</h3><p>Mỗi dòng là một phần việc; không ràng buộc thời gian theo Worklog.</p></div>{canEdit&&<button type="button" onClick={()=>setReportDrafts(items=>[...items,newProductionReportDraft(reportableLots[0]?.id??'',reportableLots[0]?.actionType==='SOLDER'?'SOLDER':'ASSEMBLE')])}>+ Thêm việc</button>}</div><div className="structuredReportLines">{reportDrafts.map((item,index)=><article key={item.key}><span className="reportLineNumber">{index+1}</span><label>Worklog SX<select disabled={!canEdit} value={item.lotId} onChange={event=>setReportDrafts(items=>items.map(row=>row.key===item.key?{...row,lotId:event.target.value,stage:lots.find(lot=>lot.id===event.target.value)?.actionType==='SOLDER'?'SOLDER':'ASSEMBLE'}:row))} required><option value="">Chọn Worklog...</option>{reportableLots.map(lot=><option value={lot.id} key={lot.id}>{lot.code} · {lot.outputLabel}</option>)}</select></label><label>Công đoạn<select disabled={!canEdit} value={item.stage} onChange={event=>setReportDrafts(items=>items.map(row=>row.key===item.key?{...row,stage:event.target.value as ProductionReportItem['stage']}:row))}>{Object.entries(PRODUCTION_STAGE_LABELS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>SL<input disabled={!canEdit} type="number" min="1" step="1" value={item.quantity} onChange={event=>setReportDrafts(items=>items.map(row=>row.key===item.key?{...row,quantity:Number(event.target.value)}:row))} required/></label><label>Kết quả<select disabled={!canEdit} value={item.result} onChange={event=>setReportDrafts(items=>items.map(row=>row.key===item.key?{...row,result:event.target.value as ProductionReportItem['result']}:row))}>{Object.entries(PRODUCTION_RESULT_LABELS).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className="reportLineNote">Ghi chú<input disabled={!canEdit} value={item.note??''} onChange={event=>setReportDrafts(items=>items.map(row=>row.key===item.key?{...row,note:event.target.value}:row))} placeholder="Không bắt buộc"/></label>{canEdit&&reportDrafts.length>1&&<button type="button" className="reportLineDelete" aria-label={`Xóa việc ${index+1}`} onClick={()=>setReportDrafts(items=>items.filter(row=>row.key!==item.key))}>×</button>}</article>)}</div><label className="structuredReportHours">Tổng H trong ngày<input disabled={!canEdit} type="number" min="0.25" max="24" step="0.25" value={reportHours} onChange={event=>setReportHours(event.target.value)} placeholder="Ví dụ: 5" required/></label>{canEdit?<button className="primary reportSubmit" disabled={busy||!reportableLots.length}>{report?'Cập nhật báo công':'Lưu báo công'}</button>:<p className="formHint">Chỉ thành viên này hoặc Admin được sửa báo công.</p>}{!reportableLots.length&&<p className="formHint warning">Thành viên chưa tham gia Worklog Sản xuất nào đang mở.</p>}</form>:<p className="formHint">Đăng ký ngày làm để nhập việc đã làm.</p>}</>;})()}</div></div>}
  </section>;
}

const WARRANTY_STATUSES: WarrantyStatus[] = ["RECEIVED", "REPAIRED", "TESTED", "RETURNED"];
const WARRANTY_STATUS_LABELS: Record<WarrantyStatus,string> = {
  RECEIVED: "ĐÃ NHẬN",
  REPAIRED: "ĐÃ SỬA",
  TESTED: "ĐÃ TEST",
  RETURNED: "ĐÃ TRẢ",
};

function addDateKeyDays(dateKey:string,days:number){
  const [year,month,day]=dateKey.split("-").map(Number);
  return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10);
}
function formatDateKey(dateKey:string){const [year,month,day]=dateKey.split("-");return `${day}/${month}/${year}`;}
export function warrantyWeekStart(value:string|Date){
  const dateKey=typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:currentVietnamDate(new Date(value));
  const weekday=new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return addDateKeyDays(dateKey,-((weekday+6)%7));
}
export function warrantyCasesForWeek(cases:WarrantyCase[],weekStart:string){
  const weekEnd=addDateKeyDays(weekStart,7);
  return cases.filter(row=>{const receivedDate=currentVietnamDate(new Date(row.createdAt));return receivedDate>=weekStart&&receivedDate<weekEnd;});
}

function WarrantyForm({warrantyCase,currentUser,people,sellableProducts,onClose,onSave}:{warrantyCase:WarrantyCase|null;currentUser:User;people:User[];sellableProducts:SellableProduct[];onClose:()=>void;onSave:(input:WarrantyCaseInput)=>Promise<boolean>}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    setBusy(true);setError("");
    const input:WarrantyCaseInput={
      customerReference:String(data.get("customerReference")??"").trim(),
      customerName:String(data.get("customerName")??"").trim(),
      customerAddress:String(data.get("customerAddress")??"").trim(),
      shippingCarrier:String(data.get("shippingCarrier")??"").trim(),
      productName:String(data.get("productName")??"").trim(),
      receivedItems:String(data.get("receivedItems")??"").trim(),
      issue:String(data.get("issue")??"").trim(),
      repairResult:String(data.get("repairResult")??"").trim(),
      status:String(data.get("status")) as WarrantyStatus,
      isChargeable:data.get("isChargeable")==="on",
      assigneeId:String(data.get("assigneeId")??"")||null,
    };
    try{if(await onSave(input))onClose();}
    catch(err){setError(err instanceof Error?err.message:"Không lưu được bảo hành");}
    finally{setBusy(false);}
  }
  const defaultAssignee=warrantyCase?.assigneeId??currentUser.id;
  return <div className="overlay warrantyOverlay" onMouseDown={onClose}>
    <form className="warrantyForm" onSubmit={(event)=>void submit(event)} onMouseDown={(event)=>event.stopPropagation()}>
      <header><div><h2>{warrantyCase?`BẢO HÀNH · ${warrantyCase.code}`:"TIẾP NHẬN BẢO HÀNH"}</h2><p>Thông tin vừa đủ để team theo máy đến khi đã trả.</p></div><button type="button" aria-label="Đóng" onClick={onClose}>×</button></header>
      <div className="warrantyFormScroll">
        <div className="warrantyFormGrid">
          <label>Tracking number<input name="customerReference" required maxLength={160} placeholder="Ví dụ: VN123456" defaultValue={warrantyCase?.customerReference??""}/></label>
          <label>Đơn vị vận chuyển <small>Không bắt buộc</small><input name="shippingCarrier" maxLength={120} placeholder="Ví dụ: Viettel Post" defaultValue={warrantyCase?.shippingCarrier??""}/></label>
        </div>
        <div className="warrantyFormGrid">
          <label>Tên khách <small>Không bắt buộc</small><input name="customerName" maxLength={160} placeholder="Ví dụ: Anh Nam" defaultValue={warrantyCase?.customerName??""}/></label>
          <label>Địa chỉ <small>Không bắt buộc</small><input name="customerAddress" maxLength={320} placeholder="Tỉnh/thành, quận/huyện hoặc địa chỉ nhận trả" defaultValue={warrantyCase?.customerAddress??""}/></label>
        </div>
        <div className="warrantyFormGrid">
          <label>Sản phẩm<input name="productName" required maxLength={120} list="warranty-products" defaultValue={warrantyCase?.productName??""}/><datalist id="warranty-products">{sellableProducts.filter(product=>product.isActive).map(product=><option value={product.name} key={product.id}/>)}</datalist></label>
          <label>Đồ đã nhận<input name="receivedItems" required maxLength={240} placeholder="Ví dụ: 1 máy, 4 cáp, 1 vali" defaultValue={warrantyCase?.receivedItems??""}/></label>
        </div>
        <label>Lỗi khách báo<textarea name="issue" required maxLength={2000} rows={4} defaultValue={warrantyCase?.issue??""}/></label>
        <label>Kết quả sửa / ghi chú kỹ thuật <small>Không bắt buộc</small><textarea name="repairResult" maxLength={3000} rows={4} defaultValue={warrantyCase?.repairResult??""}/></label>
        <div className="warrantyFormGrid">
          <label>Trạng thái<select name="status" defaultValue={warrantyCase?.status??"RECEIVED"}>{WARRANTY_STATUSES.map(status=><option value={status} key={status}>{WARRANTY_STATUS_LABELS[status]}</option>)}</select></label>
          <label>Người phụ trách<select name="assigneeId" defaultValue={defaultAssignee} disabled={currentUser.role!=="ADMIN"}>{people.map(person=><option value={person.id} key={person.id}>{person.displayName}</option>)}</select>{currentUser.role!=="ADMIN"&&<input type="hidden" name="assigneeId" value={defaultAssignee}/>}</label>
        </div>
        <label className="warrantyCharge"><input name="isChargeable" type="checkbox" defaultChecked={warrantyCase?.isChargeable??false}/><span><b>Bảo hành có tính phí</b><small>Chỉ dùng để lọc và đếm, chưa tính tiền.</small></span></label>
        {error&&<p className="error">{error}</p>}
      </div>
      <div className="formActions"><button type="button" onClick={onClose}>Hủy</button><button className="primary" disabled={busy}>{busy?"Đang lưu...":"Lưu bảo hành"}</button></div>
    </form>
  </div>;
}

function WarrantyView({api,cases,currentUser,people,sellableProducts,onUpdated}:{api:Api;cases:WarrantyCase[];currentUser:User;people:User[];sellableProducts:SellableProduct[];onUpdated:()=>Promise<void>}){
  const [editing,setEditing]=useState<WarrantyCase|null|undefined>(undefined);
  const [statusFilter,setStatusFilter]=useState<"ALL"|WarrantyStatus|"CHARGEABLE">("ALL");
  const [query,setQuery]=useState("");
  const [returningId,setReturningId]=useState<string|null>(null);
  const [actionError,setActionError]=useState("");
  const [weekStart,setWeekStart]=useState(()=>warrantyWeekStart(currentVietnamDate()));
  const weekEnd=addDateKeyDays(weekStart,6);
  const weekCases=useMemo(()=>warrantyCasesForWeek(cases,weekStart),[cases,weekStart]);
  const visible=useMemo(()=>{
    const normalized=normalizeMaterialSearch(query);
    return weekCases.filter(row=>{
      if(statusFilter==="CHARGEABLE"&&!row.isChargeable)return false;
      if(statusFilter!=="ALL"&&statusFilter!=="CHARGEABLE"&&row.status!==statusFilter)return false;
      return !normalized||normalizeMaterialSearch(`${row.code} ${row.customerName??""} ${row.customerAddress??""} ${row.shippingCarrier??""} ${row.customerReference} ${row.productName} ${row.receivedItems} ${row.issue} ${row.repairResult??""}`).includes(normalized);
    });
  },[query,statusFilter,weekCases]);
  async function save(input:WarrantyCaseInput){
    if(editing)await api.updateWarrantyCase(editing.id,input);else{await api.createWarrantyCase(input);setWeekStart(warrantyWeekStart(currentVietnamDate()));}
    await onUpdated();return true;
  }
  async function markReturned(row:WarrantyCase){
    if(!window.confirm(`Xác nhận đã trả ${row.productName} cho khách?`))return;
    setReturningId(row.id);setActionError("");
    try{await api.markWarrantyReturned(row.id);await onUpdated();}
    catch(error){setActionError(error instanceof Error?error.message:"Không cập nhật được trạng thái trả khách");}
    finally{setReturningId(null);}
  }
  return <section className="warrantyView">
    <header className="warrantyHeading"><div><h1>BẢO HÀNH</h1><p>Chốt theo tuần tiếp nhận, từ Thứ Hai đến Chủ Nhật.</p></div><button className="primary" onClick={()=>setEditing(null)}>＋ Tiếp nhận máy</button></header>
    <div className="warrantyWeekBar">
      <button type="button" aria-label="Tuần trước" onClick={()=>setWeekStart(addDateKeyDays(weekStart,-7))}>‹</button>
      <label><span>TUẦN TIẾP NHẬN</span><input type="date" value={weekStart} onChange={(event)=>setWeekStart(warrantyWeekStart(event.target.value))}/></label>
      <button type="button" aria-label="Tuần sau" onClick={()=>setWeekStart(addDateKeyDays(weekStart,7))}>›</button>
      <div><b>{weekCases.length} ca</b><span>{formatDateKey(weekStart)} – {formatDateKey(weekEnd)} · {weekCases.filter(row=>row.status==="RETURNED").length} đã trả · {weekCases.filter(row=>row.isChargeable).length} có phí</span></div>
    </div>
    <div className="warrantyToolbar">
      <div className="warrantyFilters">
        <button className={statusFilter==="ALL"?"active":""} onClick={()=>setStatusFilter("ALL")}><b>{weekCases.length}</b><span>TẤT CẢ</span></button>
        {WARRANTY_STATUSES.map(status=><button className={statusFilter===status?"active":""} onClick={()=>setStatusFilter(status)} key={status}><b>{weekCases.filter(row=>row.status===status).length}</b><span>{WARRANTY_STATUS_LABELS[status]}</span></button>)}
        <button className={statusFilter==="CHARGEABLE"?"active":""} onClick={()=>setStatusFilter("CHARGEABLE")}><b>{weekCases.filter(row=>row.isChargeable).length}</b><span>TÍNH PHÍ</span></button>
      </div>
      <input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Tìm sản phẩm, tên, vận chuyển, tracking..." aria-label="Tìm bảo hành"/>
    </div>
    {actionError&&<p className="error warrantyActionError">{actionError}</p>}
    <div className="warrantyList">
      <div className="warrantyListHeader"><span>KHÁCH HÀNG</span><span>MÃ / VẬN CHUYỂN</span><span>SẢN PHẨM</span><span>LỖI</span><span>CÁCH SỬA</span><span>PHỤ TRÁCH</span><span>TRẠNG THÁI</span><span>TRẢ KHÁCH</span></div>
      {visible.map(row=><article className="warrantyRow" key={row.id} role="button" tabIndex={0} onClick={()=>setEditing(row)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setEditing(row);}}}>
        <div className="warrantyContact"><b>{row.customerName||"Chưa có tên"}</b><small>{row.customerAddress||"Chưa có địa chỉ"}</small></div>
        <div className="warrantyShipment"><strong>{row.code}</strong><b>{row.customerReference}</b><small>{row.shippingCarrier||"Chưa có đơn vị vận chuyển"}</small></div>
        <div className="warrantyIdentity"><b className="warrantyProductTag" style={warrantyProductColor(row.productName)}>{row.productName}</b><span>{row.receivedItems}</span></div>
        <p className="warrantyIssue"><b>{row.issue}</b></p>
        <p className={`warrantyRepair ${row.repairResult?"":"empty"}`}><b>{row.repairResult||"Chưa cập nhật"}</b></p>
        <div className="warrantyOwner">{row.assignee?<><span className="avatar" style={{backgroundColor:avatarColor(row.assignee.id,row.assignee.displayName)}}><AvatarContent userId={row.assignee.id} name={row.assignee.displayName}/></span><small>{row.assignee.displayName}</small></>:<small>Chưa giao</small>}</div>
        <div className="warrantyState"><em className={`warrantyStatus ${row.status.toLowerCase()}`}>{WARRANTY_STATUS_LABELS[row.status]}</em>{row.isChargeable&&<strong>CÓ PHÍ</strong>}<time>Nhận {new Date(row.createdAt).toLocaleDateString("vi-VN")}</time></div>
        <div className={`warrantyReturn ${row.returnedAt?"returned":""}`}>{row.returnedAt?<><b>ĐÃ TRẢ</b><time>{new Date(row.returnedAt).toLocaleDateString("vi-VN")}</time></>:<button type="button" disabled={returningId===row.id} onMouseDown={(event)=>event.stopPropagation()} onClick={(event)=>{event.stopPropagation();void markReturned(row);}}>{returningId===row.id?"Đang lưu...":"Đã trả khách"}</button>}</div>
      </article>)}
      {!visible.length&&<p className="emptyList">Tuần này chưa có ca bảo hành phù hợp.</p>}
    </div>
    {editing!==undefined&&<WarrantyForm warrantyCase={editing} currentUser={currentUser} people={people} sellableProducts={sellableProducts} onClose={()=>setEditing(undefined)} onSave={save}/>}
  </section>;
}

export function themeFromPreference(value: string | null): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    themeFromPreference(localStorage.getItem("auto2tech.theme")),
  );
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(SESSION_KEY) ?? "null",
      ) as Session | null;
    } catch {
      return null;
    }
  });
  const api = useMemo(
    () => (session ? new Api(session.accessToken) : null),
    [session],
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [avatarManagerOpen,setAvatarManagerOpen]=useState(false);
  const [onlinePeople, setOnlinePeople] = useState<OnlineMember[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [sellableProducts, setSellableProducts] = useState<SellableProduct[]>([]);
  const [stockCountSheets,setStockCountSheets]=useState<StockCountSheet[]>([]);
  const [activeProductionLotCount, setActiveProductionLotCount] = useState(0);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>(
    [],
  );
  const [warrantyCases, setWarrantyCases] = useState<WarrantyCase[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [focusInventoryItemId, setFocusInventoryItemId] = useState<string | null>(null);
  const [focusPurchaseRequestId, setFocusPurchaseRequestId] = useState<string | null>(null);
  const [focusOverduePurchases,setFocusOverduePurchases]=useState(false);
  const [focusWorklogId, setFocusWorklogId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [promotingDraft, setPromotingDraft] = useState<TaskDraft | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [taskStatusBusy, setTaskStatusBusy] = useState<string | null>(null);
  const [openTaskMenu, setOpenTaskMenu] = useState<string | null>(null);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const [selectedWorklogSprint, setSelectedWorklogSprint] = useState(() => worklogSprintFromHash(window.location.hash));
  const [taskStockFilter, setTaskStockFilter] = useState<TaskStockFilter>(() => {
    return taskStockFilterForView(viewFromHash(window.location.hash));
  });
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [onlyHighPriority, setOnlyHighPriority] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const admin = session?.user.role === "ADMIN";
  const workplacePeople = useMemo(() => people.filter((person) => ["thang", "vinh", "phu"].includes(person.username)), [people]);
  const activeTasks = useMemo(() => tasks.filter((task) => task.status === "ACTIVE"), [tasks]);
  const reviewTasks = useMemo(() => tasks.filter((task) => task.status === "DONE" && !isFailedTask(task)), [tasks]);
  const failedTasks = useMemo(() => tasks.filter(isFailedTask), [tasks]);
  const visibleActiveTasks = useMemo(
    () => activeTasks.filter((task) => taskMatchesAssignee(task, assigneeFilter) && taskMatchesPriority(task, onlyHighPriority)),
    [activeTasks, assigneeFilter, onlyHighPriority],
  );
  const visibleReviewTasks = useMemo(
    () => reviewTasks.filter((task) => taskMatchesAssignee(task, assigneeFilter) && taskMatchesPriority(task, onlyHighPriority)),
    [reviewTasks, assigneeFilter, onlyHighPriority],
  );
  const visibleFailedTasks = useMemo(
    () => failedTasks.filter((task) => taskMatchesAssignee(task, assigneeFilter) && taskMatchesPriority(task, onlyHighPriority)),
    [failedTasks, assigneeFilter, onlyHighPriority],
  );
  const visibleReviewQueue = taskStockFilter === 'failed' ? visibleFailedTasks : visibleReviewTasks;
  const visibleBacklogTasks = useMemo(
    () => backlogTasks.filter((task) => taskMatchesAssignee(task, assigneeFilter) && taskMatchesPriority(task, onlyHighPriority)),
    [assigneeFilter, backlogTasks, onlyHighPriority],
  );
  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => taskMatchesAssignee(draft, assigneeFilter) && taskMatchesPriority(draft, onlyHighPriority)),
    [assigneeFilter, drafts, onlyHighPriority],
  );
  const visibleCompletedTasks = useMemo(
    () => completed.filter((task) => taskMatchesAssignee(task, assigneeFilter) && taskMatchesPriority(task, onlyHighPriority)),
    [assigneeFilter, completed, onlyHighPriority],
  );
  const taskSectionMeta:Record<TaskStockFilter,{label:string;count:number}>={
    backlog:{label:"BACKLOG",count:visibleDrafts.length+visibleBacklogTasks.length},
    active:{label:"ĐANG LÀM",count:visibleActiveTasks.length},
    review:{label:"CHỜ REVIEW",count:visibleReviewTasks.length},
    failed:{label:"KHÔNG HOÀN THÀNH",count:visibleFailedTasks.length},
    complete:{label:"HOÀN THÀNH",count:visibleCompletedTasks.length},
  };
  const worklogSourceTasks = useMemo(() => [...backlogTasks, ...tasks], [backlogTasks, tasks]);
  const purchaseWarnings=useMemo(()=>session?overduePurchaseRequests(purchaseRequests,session.user):[],[purchaseRequests,session]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("auto2tech.theme", theme);
  }, [theme]);
  useEffect(() => {
    function syncViewFromHash() {
      const nextView = viewFromHash(window.location.hash);
      setView(nextView);
      if (nextView === "worklogs") setSelectedWorklogSprint(worklogSprintFromHash(window.location.hash));
      if (["drafts", "truck", "trash"].includes(nextView)) setTaskStockFilter(taskStockFilterForView(nextView));
      const expectedHash = VIEW_HASHES[nextView];
      const validWorklogHash = nextView === "worklogs" && (/^#\/worklog\/sprint\/\d{4}-\d{2}-\d{2}$/.test(window.location.hash) || window.location.hash === "#/worklog");
      if (!validWorklogHash && window.location.hash !== expectedHash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${expectedHash}`);
      }
    }
    syncViewFromHash();
    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);
  function navigate(nextView: View) {
    const nextHash = VIEW_HASHES[nextView];
    if (window.location.hash === nextHash) setView(nextView);
    else window.location.hash = nextHash;
  }
  function navigateWorklogs(start = worklogSprintStart(currentVietnamDate())) {
    const nextHash = worklogSprintRoute(start);
    setSelectedWorklogSprint(start);
    if (window.location.hash === nextHash) setView("worklogs");
    else window.location.hash = nextHash;
  }
  function openTaskStock(filter: TaskStockFilter = "active") {
    setTaskStockFilter(filter);
    navigate("trash");
  }
  useEffect(() => {
    const close = () => setOpenTaskMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  const load = useCallback(async () => {
    if (!api) return;
    try {
      const [trash, taskDrafts, truckTasks, users, items, finished, sellable, stockCounts, requests, warranty, activeProductionLots, taskNotifications, productionNotifications, systemNotifications] =
        await Promise.all([
          api.trash(),
          api.taskDrafts(),
          api.truck(),
          api.users(),
          api.inventoryItems(),
          api.finishedProducts(),
          api.sellableProducts(),
          api.stockCountSheets(),
          api.purchaseRequests(),
          api.warrantyCases(),
          api.productionLots(false),
          api.taskNotifications(),
          api.productionNotifications(),
          api.systemNotifications(),
        ]);
      setBacklogTasks(trash.filter((task) => task.status === "BACKLOG"));
      setTasks(trash.filter((task) => task.status !== "BACKLOG"));
      setDrafts(taskDrafts);
      setCompleted(truckTasks);
      setPeople(users);
      setInventory(items);
      setProducts(finished);
      setSellableProducts(sellable);
      setStockCountSheets(stockCounts);
      setPurchaseRequests(requests);
      setWarrantyCases(warranty);
      setActiveProductionLotCount(activeProductionLots.length);
      setNotifications([...taskNotifications,...productionNotifications,...systemNotifications].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)));
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    if (!api) return;
    if (!viewNeedsAppData(view)) {
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    void load();
    const socket = api.connect(() => void load());
    return () => {
      socket.disconnect();
    };
  }, [api, load, view]);
  useEffect(() => {
    if(!api){setOnlinePeople([]);return;}
    const socket=api.connectPresence(setOnlinePeople);
    socket.on('connect_error', (error: Error) => {
      if (error.message === 'Unauthorized') logout();
    });
    return()=>{socket.disconnect();};
  },[api]);
  function acceptSession(next: Session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setTasks([]);
    setBacklogTasks([]);
    setDrafts([]);
    setCompleted([]);
    setOnlinePeople([]);
    setInventory([]);
    setWarrantyCases([]);
    setNotifications([]);
  }
  async function openNotification(notification: AppNotification, element: HTMLButtonElement) {
    element.closest("details")?.removeAttribute("open");
    if(notification.kind==="SYSTEM_EVENT"){
      if(notification.module==="INVENTORY"){setFocusInventoryItemId(notification.entityId);navigate("materials");}
      else if(notification.module==="PRODUCTION")navigate("production");
      else if(notification.module==="WORKLOG"){setFocusWorklogId(notification.entityId);navigate("worklogs");}
      else { setFocusOverduePurchases(false); setFocusPurchaseRequestId(notification.entityId); navigate("purchasing"); }
    }else if(notification.kind==="PRODUCTION_PAYMENT_READY")navigate("production");
    else setDetailTaskId(notification.taskId);
    if (notification.readAt || !api) return;
    try {
      const updated = notification.kind==="SYSTEM_EVENT"?await api.readSystemNotification(notification.id):notification.kind==="PRODUCTION_PAYMENT_READY"?await api.readProductionNotification(notification.id):await api.readTaskNotification(notification.id);
      setNotifications((current) => current.map((item) => item.kind===updated.kind&&item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được notification");
    }
  }
  async function readAllNotifications() {
    if (!api || !notifications.some((notification) => !notification.readAt)) return;
    try {
      const [taskResult, productionResult, systemResult] = await Promise.all([api.readAllTaskNotifications(), api.readAllProductionNotifications(), api.readAllSystemNotifications()]);
      const readAt = [taskResult.readAt,productionResult.readAt,systemResult.readAt].sort().at(-1)!;
      setNotifications((current) => current.map((notification) => notification.readAt ? notification : { ...notification, readAt }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đánh dấu được notification");
    }
  }
  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return false;
      }
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
      return false;
    }
  }
  async function create(input: TaskFormInput) {
    if (!api) return false;
    if (!input.assigneeIds.length) {
      setError("Task cần ít nhất một Assignee");
      return false;
    }
    const ok = await run(() => api.create(input));
    if (ok) setCreating(false);
    return ok;
  }
  async function createDraft(input: TaskDraftInput) {
    if (!api) return false;
    return run(() => api.createTaskDraft(input));
  }
  async function promoteDraft(input: TaskFormInput) {
    if (!api || !promotingDraft) return false;
    return run(() => api.promoteTaskDraft(promotingDraft.id, input));
  }
  async function saveDraft(input: TaskFormInput) {
    if (!api || !promotingDraft) return false;
    return run(() => api.updateTaskDraft(promotingDraft.id, { topic: input.title, description: input.note, suggestion: input.suggestion ?? '', assigneeIds: input.assigneeIds, criteria: input.criteria }));
  }
  async function editTask(input: TaskFormInput) {
    if (!api || !editingTask) return false;
    return run(() => api.updateTask(editingTask.id, input));
  }
  async function quickAssignTask(task:Task,assigneeIds:string[]){
    if(!api||!admin)return;
    await run(()=>api.updateTask(task.id,{assigneeIds}));
  }
  async function quickChangeTaskState(task:Task,next:TaskQuickStatus){
    if(!api||(isFailedTask(task)?'FAILED':task.status)===next)return;
    if(admin){
      if(taskStatusBusy)return;
      if(next!=="FAILED"&&task.status==="COMPLETE"&&!window.confirm(`Mở lại Task "${task.title}" sang ${{BACKLOG:"Backlog",ACTIVE:"Đang làm",DONE:"Chờ review",COMPLETE:"Hoàn thành"}[next]}?\nWorklog, điểm và lịch sử đã ghi được giữ nguyên.`))return;
      setTaskStatusBusy(task.id);
      try{
        const ok=await run(()=>next==='FAILED'?api.failTaskReview(task.id):next==='DONE'&&isFailedTask(task)?api.resetTaskReview(task.id):api.setTaskStatus(task.id,next));
        if(ok&&next==='FAILED')setTaskStockFilter('failed');
      }finally{setTaskStatusBusy(null);}
      return;
    }
    if(next==="ACTIVE")await run(()=>api.action(task.id,"start"));
    else if(next==="DONE")await run(()=>api.requestTaskReview(task.id));
  }
  async function confirmRemove() {
    if (!api || !deletingTask) return;
    const task = deletingTask;
    setDeletingTask(null);
    await run(() => api.remove(task.id));
  }
  async function retryFailedTask(task: Task) {
    if (!api || taskStatusBusy) return;
    setTaskStatusBusy(task.id);
    try { if (await run(() => api.action(task.id, 'reopen'))) setTaskStockFilter('active'); }
    finally { setTaskStatusBusy(null); }
  }
  async function movement(input: {
    opening: boolean;
    type: InventoryTransactionType;
    quantity: number;
    unit?: string;
    note?: string;
    reference?: string;
  }) {
    if (!api || !movementItem) return false;
    return input.opening
      ? run(() =>
          api.openingBalance(movementItem.id, {
            quantity: input.quantity,
            unit: input.unit!,
            note: input.note,
          }),
        )
      : run(() =>
          api.inventoryMovement(movementItem.id, {
            type: input.type,
            quantity: input.quantity,
            note: input.note,
            reference: input.reference,
          }),
        );
  }
  if (!session) return <Login onLogin={acceptSession} />;
  return (
    <MemberAvatarProvider api={api!} people={people}><main className="appShell">
      <aside className="sidebar">
        <strong className="brand">AUTO2TECH</strong>
        <nav className="sideNav">
          <button
            className={`navParent ${!["materials", "products", "sellableProducts", "stockCount", "purchasing", "production", "diagramStudio", "activation"].includes(view) ? "current" : ""}`}
            onClick={() => openTaskStock()}
          >
            <span className="navGroupIcon" aria-hidden="true">◆</span><span className="navGroupLabel">Workplace</span>
          </button>
          <div className="navChildren">
            <button
              className={["drafts", "trash", "truck"].includes(view) ? "active" : ""}
              onClick={() => openTaskStock()}
            >
              Task <span>{drafts.length + backlogTasks.length + tasks.length}</span>
            </button>
            <button
              className={view === "document" ? "active" : ""}
              onClick={() => navigate("document")}
            >
              Document
            </button>
            <button
              className={view === "scoreboard" ? "active" : ""}
              onClick={() => navigate("scoreboard")}
            >
              Bảng điểm
            </button>
            <div className="worklogNavGroup">
              <button className={view === "worklogs" ? "active" : ""} onClick={() => navigateWorklogs()}>Worklog</button>
              {view === "worklogs" && <div className="worklogSubNav" aria-label="Danh sách Sprint">{worklogSprintOptions().map(start=>{const end=addLocalDays(start,13);const today=currentVietnamDate();const current=today>=start&&today<=end;return <button className={selectedWorklogSprint===start?"active":""} key={start} onClick={()=>navigateWorklogs(start)}><span className="worklogSprintName"><b>{worklogSprintLabel(start)}</b>{current&&<em>HIỆN TẠI</em>}</span><small>{formatWorklogWeek(start,end)}</small></button>;})}</div>}
            </div>
            <button className={view === "warranty" ? "active" : ""} onClick={() => navigate("warranty")}>
              Bảo hành <span>{warrantyCases.filter(row=>row.status!=="RETURNED").length}</span>
            </button>
          </div>
          <button
            className={`navParent ${["diagramStudio","pcbLayout"].includes(view) ? "current" : ""}`}
            onClick={() => navigate("diagramStudio")}
          >
            <span className="navGroupIcon" aria-hidden="true">⌁</span><span className="navGroupLabel">KỸ THUẬT</span>
          </button>
          <div className="navChildren">
            <button
              className={view === "diagramStudio" ? "active" : ""}
              onClick={() => navigate("diagramStudio")}
            >
              Diagram Studio
            </button>
            <button className={view === "pcbLayout" ? "active" : ""} onClick={() => navigate("pcbLayout")}>PCB Layout</button>
          </div>
          <button
            className={`navParent ${["materials", "products", "sellableProducts", "stockCount", "purchasing", "production"].includes(view) ? "current" : ""}`}
            onClick={() => navigate("materials")}
          >
            <span className="navGroupIcon" aria-hidden="true">▦</span><span className="navGroupLabel">Kho &amp; Sản xuất</span>
          </button>
          <div className="navChildren">
            <button
              className={view === "materials" ? "active" : ""}
              onClick={() => navigate("materials")}
            >
              Kho vật tư <span>{inventory.length}</span>
            </button>
            <button
              className={view === "products" ? "active" : ""}
              onClick={() => navigate("products")}
            >
              Kho thành phẩm <span>{products.length}</span>
            </button>
            <button className={view === "sellableProducts" ? "active" : ""} onClick={() => navigate("sellableProducts")}>
              Kho sản phẩm <span>{sellableProducts.length}</span>
            </button>
            <button className={view === "stockCount" ? "active" : ""} onClick={() => navigate("stockCount")}>
              Kiểm kho <span>{stockCountSheets.filter(sheet=>sheet.status!=="FINALIZED").length}</span>
            </button>
            <button className={view === "purchasing" ? "active" : ""} onClick={() => {setFocusOverduePurchases(false);navigate("purchasing");}}>
              Mua hàng <span>{purchaseRequests.filter(request=>request.status==="REQUESTED"||request.status==="ORDERED").length}</span>
            </button>
            <button
              className={view === "production" ? "active" : ""}
              onClick={() => navigate("production")}
            >
              Sản xuất Space <span>{activeProductionLotCount}</span>
            </button>
          </div>
          {admin&&<><button className={`navParent ${view==="activation"?"current":""}`} onClick={()=>navigate("activation")}><span className="navGroupIcon" aria-hidden="true">◎</span><span className="navGroupLabel">Sale &amp; Orders</span></button><div className="navChildren"><button className={view==="activation"?"active":""} onClick={()=>navigate("activation")}>Mã kích hoạt</button></div></>}
        </nav>
      </aside>
      <div className={`workspace ${purchaseWarnings.length>0?"hasPurchaseWarning":""}`}>
        <header>
          <strong>
            {["drafts", "trash", "truck"].includes(view)
              ? "Task"
                : view === "document"
                  ? "Document"
                : view === "diagramStudio"
                  ? "Diagram Studio"
                : view === "pcbLayout"
                  ? "PCB Layout"
                  : view === "scoreboard"
                    ? "Bảng điểm"
                  : view === "worklogs"
                    ? "Worklog"
                  : view === "warranty"
                    ? "Bảo hành"
                  : view === "materials"
                    ? "Kho vật tư"
                  : view === "products"
                      ? "Kho thành phẩm"
                      : view === "sellableProducts"
                        ? "Kho sản phẩm"
                      : view === "stockCount"
                        ? "Kiểm kho"
                      : view === "purchasing" ? "Mua hàng" : view === "activation" ? "Mã kích hoạt" : "Sản xuất Space"}
          </strong>
          <div className="identity">
            <OnlineMembers people={onlinePeople}/>
            <button
              className="themeToggle"
              type="button"
              aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
              onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
            </button>
            <NotificationCenter key={session.user.id} ready={!loading} notifications={notifications} onOpen={openNotification} onReadAll={readAllNotifications}/>
            <span
              className="meAvatar"
              style={{
                backgroundColor: avatarColor(
                  session.user.id,
                  session.user.displayName,
                ),
              }}
            >
              <AvatarContent userId={session.user.id} name={session.user.displayName}/>
            </span>
            <span>{session.user.displayName}</span>
            {admin && <b>ADMIN</b>}
            {admin&&<button onClick={()=>setAvatarManagerOpen(true)}>Ảnh thành viên</button>}
            <button onClick={logout}>Thoát</button>
          </div>
        </header>
        {purchaseWarnings.length>0&&<button type="button" className={`globalPurchaseWarning ${purchaseWarnings.some(item=>item.severity==="critical")?"critical":"warning"}`} onClick={()=>{setFocusOverduePurchases(true);navigate("purchasing");}}><span aria-hidden="true">!</span><div><b>{purchaseWarnings.length} REQUEST MUA HÀNG CHƯA XỬ LÝ</b><small>{purchaseWarnings.slice(0,3).map(item=>`${inventory.find(material=>material.id===item.request.itemId)?.name??"Vật tư"} · ${item.ageDays} ngày`).join("  •  ")}{purchaseWarnings.length>3?`  •  +${purchaseWarnings.length-3} request khác`:""}</small></div><strong>XEM NGAY →</strong></button>}
        {error && viewNeedsAppData(view) && (
          <div className="errorBar">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {view === "diagramStudio" ? (
          <DiagramProjectManagerView api={api!} admin={session.user.role === 'ADMIN'} canEdit={session.user.role === 'ADMIN' || ['thang', 'vinh', 'phu'].includes(session.user.username.toLowerCase())} />
        ) : view === "pcbLayout" ? (
          <PcbLayoutView api={api!} currentUser={session.user}/>
        ) : loading ? (
          <p>Đang tải...</p>
        ) : view === "activation" && admin ? (
          <ActivationView api={api!}/>
        ) : view === "materials" || view === "products" || view === "sellableProducts" ? (
          <InventoryView
            api={api!}
            items={inventory}
            products={products}
            sellableProducts={sellableProducts}
            requests={purchaseRequests}
            people={people}
            admin={admin}
            openStockCountSheets={stockCountSheets.filter(sheet=>sheet.status!=="FINALIZED").length}
            onOpenStockCount={()=>navigate("stockCount")}
            onUpdated={load}
            initialTab={view}
            focusItemId={focusInventoryItemId}
            onFocusConsumed={()=>setFocusInventoryItemId(null)}
          />
        ) : view === "stockCount" ? (
          <StockCountView api={api!} sheets={stockCountSheets} people={people} currentUser={session.user} admin={admin} onUpdated={load}/>
        ) : view === "purchasing" ? (
          <PurchasingView api={api!} items={inventory} requests={purchaseRequests} people={people} currentUser={session.user} onUpdated={load} focusRequestId={focusPurchaseRequestId} focusOverdue={focusOverduePurchases} onFocusConsumed={()=>setFocusPurchaseRequestId(null)}/>
        ) : view === "production" ? (
          <ProductionView api={api!} people={people} currentUser={session.user} finishedProducts={products} sellableProducts={sellableProducts}/>
        ) : view === "worklogs" ? (
          <WorklogView api={api!} currentUser={session.user} people={people} tasks={worklogSourceTasks} sprintStart={selectedWorklogSprint} onOpenTask={setDetailTaskId} focusWorklogId={focusWorklogId} onFocusConsumed={()=>setFocusWorklogId(null)}/>
        ) : view === "warranty" ? (
          <WarrantyView api={api!} cases={warrantyCases} currentUser={session.user} people={people} sellableProducts={sellableProducts} onUpdated={load}/>
        ) : view === "document" ? (
          <TeamDocument api={api!} session={session} people={people} />
        ) : view === "scoreboard" ? (
          <ScoreboardView api={api!} currentUser={session.user} onOpenTask={setDetailTaskId}/>
        ) : (
          <section className="taskStock">
            <header className="taskStockHeading"><div><h1>TASK</h1><p>Kho việc chung để team đọc, nhận và nắm kế hoạch.</p></div><strong>{drafts.length + backlogTasks.length + tasks.length} việc cần xử lý</strong></header>
          <div className="taskFilterBar">
            <div className="taskStockFilters" aria-label="Lọc trạng thái Task">
              {([["backlog","BACKLOG",drafts.length+backlogTasks.length],["active","ĐANG LÀM",activeTasks.length],["review","CHỜ REVIEW",reviewTasks.length],["failed","KHÔNG HOÀN THÀNH",failedTasks.length],["complete","HOÀN THÀNH",completed.length]] as [TaskStockFilter,string,number][]).map(([value,label,count])=><button type="button" className={`${value} ${taskStockFilter===value?"active":""}`} aria-pressed={taskStockFilter===value} onClick={()=>setTaskStockFilter(value)} key={value}><span>{label}</span><b>{count}</b></button>)}
            </div>
            <label>Thành viên<select aria-label="Lọc Task theo thành viên" value={assigneeFilter} onChange={event=>setAssigneeFilter(event.target.value)}><option value="">Tất cả thành viên</option>{workplacePeople.map(person=><option value={person.id} key={person.id}>{person.displayName}</option>)}</select></label>
            <TaskPriorityFilter onlyHigh={onlyHighPriority} onChange={setOnlyHighPriority}/>
            {admin&&<button className="primary taskGlobalCreate" onClick={()=>setCreatingDraft(true)}>＋ THÊM VIỆC</button>}
          </div>
          <header className={`taskSectionHeader ${taskStockFilter}`}><div><i aria-hidden="true"/><b>{taskSectionMeta[taskStockFilter].label}</b><span>{taskSectionMeta[taskStockFilter].count}</span></div></header>
          <TaskListColumnLabels/>
          {taskStockFilter === "backlog" && <section className="draftStack">
            <div className="draftList">
              {visibleBacklogTasks.map((task) => <article className="compactTaskRow taskClassifiedRow" data-topic={classifyTaskTitle(task.title).topic} key={task.id} onClick={() => setDetailTaskId(task.id)}>
                <div className="draftSource"><span>BACKLOG</span></div>
                <div className="draftBody"><TaskTopicTitle title={task.title}/><h2 title={task.note || undefined}>{task.note || "Chưa có mô tả"}</h2></div>
                <TaskPriorityCell title={task.title} priority={task.priority} admin={admin} onChange={priority=>run(()=>api!.setTaskPriority(task.id,priority))}/>
                <div className="taskEvidenceCell"><span>{task.worklogCount ?? 0} Worklog · {Number(task.worklogHours ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</span>{(task.commentCount??0)>0&&<span className="commentCount">💬 {task.commentCount}</span>}</div>
                <div className="taskPeopleCell"><TaskAssigneeQuickEdit task={task} people={workplacePeople} editable={admin} onChange={ids=>void quickAssignTask(task,ids)}/></div>
                <div className="draftActions taskStatusCell" onClick={(event) => event.stopPropagation()}><TaskStatusQuickEdit task={task} admin={admin} busy={Boolean(taskStatusBusy)} currentUserId={session.user.id} onChange={status=>void quickChangeTaskState(task,status)}/><details className="taskRowMenu"><summary aria-label={`Thao tác ${task.note||task.title}`}>•••</summary><div>{admin&&<button onClick={()=>setEditingTask(task)}>Sửa</button>}{admin&&<button className="danger" onClick={()=>setDeletingTask(task)}>Xóa</button>}</div></details></div>
              </article>)}
              {visibleDrafts.map((draft) => <article className="compactTaskRow taskClassifiedRow" data-topic={classifyTaskTitle(draft.topic).topic} key={draft.id}>
                <div className="draftSource"><span>{draft.sourceStatus ?? "DỰ BỊ"}</span>{draft.sourcePriority && <b>{draft.sourcePriority}</b>}</div>
                <div className="draftBody"><div className="draftTitleLine"><TaskTopicTitle title={draft.topic}/><span className="taskDraftBadge">Cần bổ sung</span></div><h2 title={draft.description || undefined}>{draft.description || "Chưa có mô tả"}</h2></div>
                <TaskPriorityCell title={draft.topic} priority={draft.priority} admin={admin} onChange={priority=>run(()=>api!.setTaskDraftPriority(draft.id,priority))}/>
                <div className="taskEvidenceCell">—</div>
                <div className="taskPeopleCell"><div className="assigneeAvatars">{draft.assignees.map((person) => <span className="avatar" style={{backgroundColor: avatarColor(person.id, person.displayName)}} title={person.displayName} key={person.id}><AvatarContent userId={person.id} name={person.displayName}/></span>)}</div></div>
                {admin && <div className="draftActions taskStatusCell"><button className="taskDraftEdit" onClick={() => setPromotingDraft(draft)}>Bổ sung thông tin</button><details className="taskRowMenu"><summary aria-label={`Thao tác ${draft.topic}`}>•••</summary><div><button className="danger" onClick={() => { if (window.confirm("Xóa việc này khỏi Task?")) void run(() => api!.removeTaskDraft(draft.id)); }}>Xóa</button></div></details></div>}
              </article>)}
              {!visibleDrafts.length && !visibleBacklogTasks.length && <div className="filterEmpty"><b>{onlyHighPriority ? 'KHÔNG CÓ TASK ƯU TIÊN CAO PHÙ HỢP' : assigneeFilter ? "KHÔNG CÓ VIỆC CỦA THÀNH VIÊN NÀY" : "BACKLOG ĐANG TRỐNG"}</b><p>{onlyHighPriority ? 'Tắt lọc Ưu tiên cao hoặc chọn thành viên khác.' : assigneeFilter ? "Chọn thành viên khác hoặc xem tất cả." : "Admin có thể thêm việc mới vào đây."}</p></div>}
            </div>
          </section>}
          {taskStockFilter === "active" && <section className={`trash ${activeTasks.length === 0 ? "empty" : ""}`}>
            {activeTasks.length === 0 ? (
              <div className="celebrate">
                <b>CHƯA CÓ VIỆC ĐANG LÀM</b>
                <p>Team có thể nhận việc ở Backlog.</p>
              </div>
            ) : visibleActiveTasks.length === 0 ? (
              <div className="filterEmpty">
                <b>KHÔNG CÓ TASK</b>
                <p>{onlyHighPriority ? 'Không có Task ưu tiên cao phù hợp. Tắt bộ lọc để xem các việc khác.' : 'Thành viên này chưa có task đang xử lý.'}</p>
              </div>
            ) : (
              <div className="stack">
                {visibleActiveTasks.map((task) => {
                  const description = task.note ?? task.title;
                  return (
                    <article className="compactTaskRow taskClassifiedRow" data-topic={classifyTaskTitle(task.title).topic}
                      key={task.id}
                      onClick={() => setDetailTaskId(task.id)}
                    >
                      <div className="taskMain calmTaskMain">
                        <div className="taskTitle">
                          <TaskTopicTitle title={task.title}/>
                          <h2>{description}</h2>
                        </div>
                        <div className="taskMeta taskEvidenceCell">
                          <span className="taskEvidence">{task.worklogCount ?? 0} Worklog · {Number(task.worklogHours ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</span>
                          {(task.commentCount ?? 0) > 0 && (
                            <span className="commentCount" aria-label={`${task.commentCount} comment`}>
                              <span aria-hidden="true">💬</span> {task.commentCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <TaskPriorityCell title={task.title} priority={task.priority} admin={admin} onChange={priority=>run(()=>api!.setTaskPriority(task.id,priority))}/>
                      <div className="taskRight">
                        <div className="taskPeopleCell"><TaskAssigneeQuickEdit task={task} people={workplacePeople} editable={admin} onChange={ids=>void quickAssignTask(task,ids)}/></div>
                        <div
                          className="actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                        {(admin || task.assignees.some((assignment) => assignment.userId === session.user.id)) && (
                          <>
                            <TaskStatusQuickEdit task={task} admin={admin} busy={Boolean(taskStatusBusy)} currentUserId={session.user.id} onChange={status=>void quickChangeTaskState(task,status)}/>
                            <div className="taskMenu">
                            <button
                              className="menuTrigger"
                              aria-label="Thêm thao tác"
                              aria-expanded={openTaskMenu === task.id}
                              onClick={() =>
                                setOpenTaskMenu((current) =>
                                  current === task.id ? null : task.id,
                                )
                              }
                            >
                              ⋯
                            </button>
                            {openTaskMenu === task.id && (
                              <div className="taskMenuPanel">
                                <button onClick={() => { setOpenTaskMenu(null); if(window.confirm('Gửi Task sang CHỜ REVIEW? Task cần có ít nhất một Worklog HOÀN THÀNH.'))void run(()=>api!.requestTaskReview(task.id)); }}>Gửi chờ Review</button>
                                {admin && <button onClick={() => { setOpenTaskMenu(null); void run(() => api!.action(task.id, "backlog")); }}>Về Backlog</button>}
                                {admin && <button
                                  onClick={() => {
                                    setOpenTaskMenu(null);
                                    setEditingTask(task);
                                  }}
                                >
                                  Sửa
                                </button>}
                                {admin && <button
                                  className="danger"
                                  onClick={() => {
                                    setOpenTaskMenu(null);
                                    setDeletingTask(task);
                                  }}
                                >
                                  Xóa
                                </button>}
                              </div>
                            )}
                            </div>
                          </>
                        )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>}
          {(taskStockFilter === "review" || taskStockFilter === "failed") && <section className="truck taskReviewQueue">
            {visibleReviewQueue.length?<div className="truckList">{visibleReviewQueue.map(task=><article className="compactTaskRow taskClassifiedRow" data-topic={classifyTaskTitle(task.title).topic} key={task.id} onClick={()=>setDetailTaskId(task.id)}>
              <div className="truckTaskBody"><TaskTopicTitle title={task.title}/><strong>{task.note||task.title}</strong>{isFailedTask(task)&&<TaskFailedReview task={task}/>}</div>
              <TaskPriorityCell title={task.title} priority={task.priority} admin={admin} onChange={priority=>run(()=>api!.setTaskPriority(task.id,priority))}/>
              <div className="taskEvidenceCell"><span>{task.worklogCount??0} Worklog · {Number(task.worklogHours??0).toLocaleString("vi-VN",{maximumFractionDigits:2})}h</span><em className={`taskReviewBadge ${task.reviewResult==='FAILED'?'failed':''}`}>{task.reviewResult==='FAILED'?'KHÔNG ĐẠT':'CHỜ REVIEW'}</em></div>
              <div className="taskPeopleCell"><TaskAssigneeQuickEdit task={task} people={workplacePeople} editable={admin} onChange={ids=>void quickAssignTask(task,ids)}/></div>
              <div className="taskReviewActions" onClick={event=>event.stopPropagation()}><TaskStatusQuickEdit task={task} admin={admin} busy={Boolean(taskStatusBusy)} currentUserId={session.user.id} onChange={status=>void quickChangeTaskState(task,status)}/>
                <button className="taskCommentShortcut" onClick={()=>setDetailTaskId(task.id)}>Bình luận{task.commentCount?` · ${task.commentCount}`:''}</button>
                {isFailedTask(task)&&(admin||task.assignees.some(assignment=>assignment.userId===session.user.id))&&<button className="taskRetryButton" disabled={Boolean(taskStatusBusy)} onClick={()=>void retryFailedTask(task)}>Làm lại</button>}
                {admin&&<details className="taskRowMenu"><summary aria-label={`Thao tác review ${task.note||task.title}`}>•••</summary><div>
                  {task.reviewResult==='FAILED'&&<button onClick={()=>void run(()=>api!.resetTaskReview(task.id))}>Đưa về chờ Review</button>}
                  {admin&&<button onClick={()=>{if(window.confirm('Xác nhận Task đã đạt và chuyển Complete? 20% Point ổn định của Worklog chỉ được chốt sau bước này.'))void run(()=>api!.action(task.id,'complete'));}}>Xác nhận hoàn thành</button>}
                  {admin&&<button onClick={()=>setEditingTask(task)}>Sửa</button>}
                  {admin&&<button className="danger" onClick={()=>setDeletingTask(task)}>Xóa</button>}
                </div></details>}
              </div>
            </article>)}</div>:<div className="filterEmpty"><b>{taskStockFilter==='failed'?'KHÔNG CÓ TASK KHÔNG HOÀN THÀNH':'KHÔNG CÓ TASK CHỜ REVIEW'}</b><p>{onlyHighPriority ? 'Không có Task ưu tiên cao phù hợp. Tắt bộ lọc để xem các việc khác.' : taskStockFilter==='failed'?'Chỉ liệt kê Task đã được đánh Không đạt và phù hợp bộ lọc thành viên.':'Dev dùng menu Task để gửi chờ Review sau khi đã có Worklog hoàn thành.'}</p></div>}
          </section>}
          {taskStockFilter === "complete" && <section className="truck taskStockCompleted">
            {visibleCompletedTasks.length ? (
              <div className="truckList">{visibleCompletedTasks.map((task) => {
                const doneBy = people.find((person) => person.id === task.doneById);
                return <article className="compactTaskRow taskClassifiedRow" data-topic={classifyTaskTitle(task.title).topic} key={task.id} onClick={() => setDetailTaskId(task.id)}>
                  <div className="truckTaskBody">
                    <TaskTopicTitle title={task.title}/>
                    <strong>{task.note || task.title}</strong>
                  </div>
                  <TaskPriorityCell title={task.title} priority={task.priority} admin={admin} onChange={priority=>run(()=>api!.setTaskPriority(task.id,priority))}/>
                  <div className="taskEvidenceCell">
                    <span>{task.worklogCount ?? 0} Worklog · {Number(task.worklogHours ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}h</span>
                    {doneBy && <span className="truckDoneBy" title={`Done bởi ${doneBy.displayName}`}><span className="avatar" style={{ backgroundColor: avatarColor(doneBy.id, doneBy.displayName) }}><AvatarContent userId={doneBy.id} name={doneBy.displayName}/></span><small>{doneBy.displayName}</small></span>}
                    {(task.commentCount ?? 0) > 0 && <span className="commentCount"><span aria-hidden="true">💬</span> {task.commentCount}</span>}
                    <time>{formatCompletedDate(task.completedAt)}</time>
                  </div>
                  <div className="taskPeopleCell"><TaskAssigneeQuickEdit task={task} people={workplacePeople} editable={admin} onChange={ids=>void quickAssignTask(task,ids)}/></div>
                  {admin && <div className="taskStatusCell" onClick={(event) => event.stopPropagation()}><TaskStatusQuickEdit task={task} admin={admin} busy={Boolean(taskStatusBusy)} currentUserId={session.user.id} onChange={status=>void quickChangeTaskState(task,status)}/><details className="taskRowMenu"><summary aria-label={`Thao tác ${task.note||task.title}`}>•••</summary><div><button onClick={()=>setEditingTask(task)}>Sửa</button><button className="danger" onClick={()=>setDeletingTask(task)}>Xóa</button></div></details></div>}
                </article>;
              })}</div>
            ) : (
              <div className="filterEmpty"><b>KHÔNG CÓ TASK COMPLETE</b><p>{onlyHighPriority ? 'Không có Task ưu tiên cao phù hợp. Tắt bộ lọc để xem các việc khác.' : assigneeFilter?'Thành viên này chưa có Task Complete.':'Chưa có Task Complete.'}</p></div>
            )}
          </section>}
          </section>
        )}
        {creating && (
          <TaskFormModal people={workplacePeople} onClose={() => setCreating(false)} onSubmit={create}/>
        )}
        {movementItem && (
          <MovementModal
            item={movementItem}
            onClose={() => setMovementItem(null)}
            onSubmit={movement}
          />
        )}
        {deletingTask && (
          <div className="overlay" onMouseDown={() => setDeletingTask(null)}>
            <div
              className="confirmCard"
              role="alertdialog"
              aria-labelledby="deleteTaskTitle"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 id="deleteTaskTitle">Xóa task này?</h2>
              <p>{deletingTask.note ?? deletingTask.title}</p>
              <small>Thao tác này không thể hoàn tác.</small>
              <div className="formActions">
                <button onClick={() => setDeletingTask(null)}>Hủy</button>
                <button
                  className="deleteConfirm"
                  onClick={() => void confirmRemove()}
                >
                  Xóa task
                </button>
              </div>
            </div>
          </div>
        )}
        {editingTask && (
          <TaskFormModal
            task={editingTask}
            people={workplacePeople}
            onClose={() => setEditingTask(null)}
            onSubmit={editTask}
          />
        )}
        {creatingDraft && (
          <TaskDraftFormModal people={workplacePeople} onClose={() => setCreatingDraft(false)} onSubmit={createDraft}/>
        )}
        {promotingDraft && (
          <TaskFormModal
            draft={promotingDraft}
            people={workplacePeople}
            onClose={() => setPromotingDraft(null)}
            onSubmit={promoteDraft}
            onSaveDraft={saveDraft}
          />
        )}
        {detailTaskId && api && (
          <TaskDetailModal api={api} taskId={detailTaskId} people={people} onClose={() => setDetailTaskId(null)}/>
        )}
        {historyItem && api && (
          <HistoryModal
            api={api}
            item={historyItem}
            admin={admin}
            onClose={() => setHistoryItem(null)}
            onUpdated={load}
          />
        )}
      </div>
      {admin&&avatarManagerOpen&&<MemberAvatarManager api={api!} people={people} onUpdated={async()=>setPeople(await api!.users())} onClose={()=>setAvatarManagerOpen(false)}/>}
    </main></MemberAvatarProvider>
  );
}

import { io, Socket } from 'socket.io-client';
import type { PerformanceReport, PerformancePeriodInput, PerformancePlanInput } from './performance-types';

export type Role = 'MEMBER' | 'ADMIN';
export type ActivationProduct='EASYSCAN'|'SCANBOX'|'KEYSCAN';
export type ActivationPaymentStatus='PAID'|'UNPAID';
export type ActivationRecord={id:string;series:string;product:ActivationProduct;packageCode:string;activationCode:string;source:string;paymentStatus:ActivationPaymentStatus;createdBy:User;createdAt:string};
export type ActivationOcrResult={candidates:string[];confidence:number;recognized:boolean};
export type DiagramAiDraftResult={diagram:unknown;warnings:string[];uncertainItems:string[];model:string};
export type DiagramCircuitStatus='REGISTERED'|'MISSING_OUTPUT'|'NEEDS_REVIEW'|'DRAFT_READY'|'LAYOUT_REVIEWED'|'ELECTRICALLY_REVIEWED';
import type { PreparationManifest } from './diagram-studio/kit-image';
export type DiagramCircuit={id:string;projectId:string;circuitKey:string;circuitTitle:string;position:number;required:boolean;status:DiagramCircuitStatus;sourceFileName:string|null;sourceMimeType:string|null;sourceByteSize:number|null;schema:Record<string,unknown>|null;aiReview:{warnings:string[];uncertainItems:string[];preparation?:PreparationManifest}|null;validationErrors:string[]|null;generatedByModel:string|null;createdAt:string;updatedAt:string};
export type DiagramCompleteness={outputCount:number;requiredCount:number;missingCount:number;complete:boolean};
export type DiagramProject={id:string;vehicleId:string;vehicleTitle:string;manufacturer:string|null;modelYear:string|null;ecmId:string|null;scuId:string|null;status:'ACTIVE'|'ARCHIVED';circuits:DiagramCircuit[];completeness:DiagramCompleteness;createdAt:string;updatedAt:string};
export type DiagramProjectInput={vehicleId:string;vehicleTitle:string;manufacturer?:string;modelYear?:string;ecmId?:string;scuId?:string;circuits:{circuitKey:string;circuitTitle:string;required?:boolean}[]};
export type DiagramProjectEditInput={vehicleId:string;vehicleTitle:string;manufacturer:string;modelYear:string;ecmId:string;scuId:string;circuits:{id?:string;circuitKey:string;circuitTitle:string;required:boolean}[]};
export type User = { id:string; username:string; displayName:string; email:string|null; avatarDataUrl?:string|null; role:Role };
export type OnlineMember = { id:string; username:string; displayName:string };
export type Assignment = { userId:string; user:User; position:number; sharePercent:string };
export type FailedTaskReview = { reason:string|null; reviewedAt:string; reviewerName:string|null };
export type Status = 'BACKLOG' | 'ACTIVE' | 'DONE' | 'COMPLETE' | 'ARCHIVED';
export type TaskPriority = 'HIGH' | 'NORMAL' | 'LOW';
export type TaskPointFactors={outputScope:number;complexity:number;uncertainty:number;risk:number;verification:number};
export type TaskCriterion={id:string;text:string;position:number;passed:boolean;firstReviewPassed:boolean|null};
export type Task = { id:string; title:string; priority?:TaskPriority; note:string|null; suggestion:string|null; assignees:Assignment[]; criteria:TaskCriterion[]; dueDate:string|null; point:string|null; basePoint:string|null; earnedPoint:string|null; completionRate:string|null; dueRate:string|null; qualityRate:string|null; reliabilityRate:string|null; outputScopeScore:number|null;complexityScore:number|null;uncertaintyScore:number|null;riskScore:number|null;verificationScore:number|null;riskReportedAt:string|null;status:Status; reviewResult:'PENDING'|'FAILED'|null; failedReview?:FailedTaskReview|null; doneById:string|null; doneAt:string|null; completedAt:string|null; commentCount?:number; worklogCount?:number; worklogHours?:number };
export type TaskTimelineItem =
  | {kind:'ACTIVITY';id:string;type:string;actor:User;payload:Record<string,unknown>|null;createdAt:string}
  | {kind:'COMMENT';id:string;body:string;imageUrl:string|null;author:User;mentions:User[];createdAt:string};
export type TaskDetail={task:Task;timeline:TaskTimelineItem[];worklogs:Worklog[];canComment:boolean};
export type TaskNotification={kind:'TASK_MENTION'|'TASK_COMMENT'|'TASK_EVENT';personalKind:'ASSIGNED'|'MENTION'|null;id:string;taskId:string;commentId:string|null;eventType:string|null;topic:string;message:string;bodyPreview:string;actorName:string;readAt:string|null;createdAt:string};
export type ProductionNotification={kind:'PRODUCTION_PAYMENT_READY';id:string;paymentRequestId:string;memberName:string;totalHours:string;sessionDates:string[];readAt:string|null;createdAt:string};
export type SystemNotification={kind:'SYSTEM_EVENT';personalKind:'MENTION'|null;id:string;module:'PURCHASING'|'PRODUCTION'|'WORKLOG'|'INVENTORY';eventType:string;entityType:string;entityId:string;entityLabel:string;message:string;bodyPreview:string|null;actorName:string;readAt:string|null;createdAt:string};
export type AppNotification=TaskNotification|ProductionNotification|SystemNotification;
export type TaskScoreboardMember={userId:string;username:string;displayName:string;assignedTasks:number;doneTasks:number;earnedPoint:number;progressPercent:number};
export type TaskScoreboard={month:string;targetPoint:number;members:TaskScoreboardMember[]};
export type WorklogStatus='BACKLOG'|'OPEN'|'ENDED'|'DONE';
export type WorklogValueLevel='BASIC'|'DEV'|'RND';
export type WorklogType='NORMAL'|'BUGFIX'|'REOPEN';
export type WorklogStabilityStatus='PENDING'|'CONFIRMED';
export type WorklogComment={id:string;worklogId:string;authorId:string;author:User;body:string;imageUrl:string|null;mentions:{commentId:string;userId:string;user:User}[];createdAt:string};
export type WorklogOutputCriterion={id:string;expected:string;actual:string|null;achieved:boolean|null};
export type Worklog={id:string;userId:string;user:User;createdById:string;createdBy:User;tasks:Task[];primaryTaskId:string|null;primaryTask:Task|null;comments:WorklogComment[];input:string;output:string|null;outputCriteria:WorklogOutputCriterion[];resultModelVersion:number;links:string[];workType:WorklogType;reopenedWorklogId:string|null;reopenedWorklog:Worklog|null;status:WorklogStatus;startedAt:string;endedAt:string|null;hoursWorked:string|null;valueLevel:WorklogValueLevel|null;valueRate:number|null;standardHours:string|null;completionRate:string|null;reopenBaseCount:number;reopenCount:number|null;stabilityStatus:WorklogStabilityStatus;stabilityRate:string|null;point:number|null;scoredById:string|null;scoredAt:string|null;createdAt:string;updatedAt:string};
export type WorklogSummary={userId:string;username:string;displayName:string;hours:number;point:number;confirmedPoint:number;provisionalPoint:number;backlog:number;open:number;done:number;ended:number;pendingPoint:number;pendingStability:number;pendingStabilityPoint:number;capitalPoint:number;productiveBasePoint:number;endedBasePoint:number;conversionPercent:number;worklogs:number;basicWorklogs:number;devWorklogs:number;rndWorklogs:number;reopenWorklogs:number;linkedWorklogs:number;v2Worklogs:number};
export type WorklogWeekStatus='OPEN'|'CLOSED';
export type WorklogWeekSummary={weekStart:string;weekEnd:string;goal:string|null;status:WorklogWeekStatus;closedAt:string|null;closedBy:Pick<User,'id'|'username'|'displayName'>|null;worklogCount:number;totalHours:number;outputAchieved:number;outputTotal:number;point:number;pendingStabilityPoint:number;taskCount:number;taskTitles:string[];summary:WorklogSummary[]};
export type WorklogThreadSummary={task:Task;members:Pick<User,'id'|'username'|'displayName'>[];worklogCount:number;totalHours:number;doneHours:number;endedHours:number;openCount:number;firstActivityAt:string;lastActivityAt:string;calendarDays:number};
export type WorklogDashboard={month:string;logs:Worklog[];reopenCandidates:Worklog[];summary:WorklogSummary[];weeks:WorklogWeekSummary[];threads:WorklogThreadSummary[]};
export type TaskDraft={id:string;topic:string;priority?:TaskPriority;description:string|null;suggestion?:string|null;assigneeIds:string[];assignees:User[];criteria:string[];pointFactors:TaskPointFactors|null;basePoint:number|null;dueDate:string|null;sourceStatus:string|null;sourcePriority:string|null;createdAt:string;updatedAt:string};
export type InventoryUnit='unit';
export type InventoryBomKind='BOARD_COMPONENT'|'OTHER';
export type NormalizationSuggestion={quantity:number|null;unit:InventoryUnit;reason:string};
export type InventoryItem={id:string;groupName:string;name:string;sku:string|null;unit:string|null;onHandQty:string|null;easycanQtyPerBoard:string|null;scanboxQtyPerBoard:string|null;easyscuQtyPerBoard:string|null;bomKind:InventoryBomKind|null;purchaseUrl:string|null;purchaseLinks:string[];price:string|null;location:string|null;minimumStock:string;note:string|null;lastCountedAt:string|null;lastCountedById:string|null;checkRequestedAt:string|null;checkRequestedById:string|null;checkAssignedToId?:string|null;checkRequestNote?:string|null;sourceRow:number|null;sourceStockText:string|null;isActive:boolean;normalizationSuggestion:NormalizationSuggestion|null;isLowStock:boolean;needsCount:boolean;expectedIncoming:number};
export type InventoryTransactionType='IN'|'OUT'|'ADJUSTMENT'|'STOCK_COUNT';
export type InventoryTransaction={id:string;itemId:string;type:InventoryTransactionType;quantity:string;balanceBefore:string|null;balanceAfter:string;unit:string;note:string|null;reference:string|null;actorId:string;createdAt:string};
export type InventoryAudit={id:string;itemId:string;actorId:string;changes:Record<string,{before:unknown;after:unknown}>;createdAt:string};
export type PurchaseRequestStatus='REQUESTED'|'ORDERED'|'RECEIVED'|'CANCELLED';
export type PurchasePaymentStatus='UNPAID'|'PARTIAL'|'PAID';
export type PurchasePaymentLog={id:string;requestId:string;fromStatus:PurchasePaymentStatus;toStatus:PurchasePaymentStatus;actorId:string;createdAt:string};
export type PurchaseRequest={id:string;itemId:string;requestedQty:string;receivedQty:string|null;status:PurchaseRequestStatus;paymentStatus:PurchasePaymentStatus;paymentLogs:PurchasePaymentLog[];note:string|null;orderUrl:string|null;orderCode:string|null;requesterId:string;assignedBuyerId:string|null;updatedById:string;orderedAt:string|null;receivedAt:string|null;createdAt:string;updatedAt:string};
export type InventoryImageOwnerType='MATERIAL'|'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';
export type SharedDocument={id:string;title:string;url:string;description:string|null;createdById:string;updatedById:string;createdAt:string;updatedAt:string};
export type PcbLayoutProduct='KEYSCAN'|'EASYSCAN'|'SCANBOX';
export type PcbLayout={id:string;product:PcbLayoutProduct;fileName:string;mimeType:string;byteSize:number;progress:Record<string,string>;progressVersion:number;createdById:string;updatedById:string;createdAt:string;updatedAt:string};
export type WarrantyStatus='RECEIVED'|'REPAIRED'|'TESTED'|'RETURNED';
export type WarrantyCase={id:string;code:string;customerReference:string;customerName:string|null;customerAddress:string|null;shippingCarrier:string|null;productName:string;receivedItems:string;issue:string;repairResult:string|null;status:WarrantyStatus;isChargeable:boolean;assigneeId:string|null;assignee:User|null;createdById:string;createdBy:User;updatedById:string;updatedBy:User;repairedAt:string|null;testedAt:string|null;returnedAt:string|null;createdAt:string;updatedAt:string};
export type WarrantyCaseInput={customerReference:string;customerName?:string;customerAddress?:string;shippingCarrier?:string;productName:string;receivedItems:string;issue:string;repairResult?:string;status:WarrantyStatus;isChargeable:boolean;assigneeId?:string|null};
export type BomLine={id:string;productId:string;itemId:string;quantityPerProduct:string};
export type FinishedProductComponentLine={id:string;productId:string;componentProductId:string;quantityPerProduct:string};
export type FinishedProductCategory='PCB'|'CABLE'|'DEVICE'|'OTHER';
export type FinishedProduct={id:string;sku:string|null;name:string;category:FinishedProductCategory;onHandQty:string;minimumStock:string;location:string|null;note:string|null;isProductionOutput:boolean;productionReady:boolean;isActive:boolean;bom:BomLine[];componentBom:FinishedProductComponentLine[]};
export type ProductBomLine={id:string;productId:string;finishedProductId:string;quantityPerProduct:string};
export type ProductMaterialBomLine={id:string;productId:string;itemId:string;quantityPerProduct:string};
export type SellableProduct={id:string;name:string;onHandQty:string;minimumStock:string;note:string|null;isActive:boolean;bom:ProductBomLine[];materialBom:ProductMaterialBomLine[]};
export type StockCountSheetStatus='DRAFT'|'SUBMITTED'|'FINALIZED';
export type StockCountLine={ownerType:'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';ownerId:string;label:string;systemQuantity:number;countedQuantity:number|null;note:string|null};
export type StockCountSheet={id:string;code:string;periodStart:string;dueDate:string;status:StockCountSheetStatus;assigneeId:string;createdById:string;submittedById:string|null;submittedAt:string|null;finalizedById:string|null;finalizedAt:string|null;lines:StockCountLine[];createdAt:string;updatedAt:string};
export type MaterialPlanStatus='ĐỦ'|'CẦN MUA'|'CHƯA KIỂM'|'THIẾU CẤU HÌNH';
export type MaterialPlan={output:{type:'SELLABLE_PRODUCT'|'FINISHED_PRODUCT';id:string;name:string;quantity:number};materials:{itemId:string;name:string;groupName:string;sku:string;unit:string;usedBy:string[];requiredQty:number;onHandQty:number|null;orderedQty:number;purchaseQty:number;purchaseLinks:string[];status:MaterialPlanStatus}[];components:{id:string;name:string;requiredQty:number;stockUsedQty:number;productionQty:number}[];warnings:string[]};
export type BomAuditIssueType='BOM_MISSING_MATERIAL'|'DUPLICATE_MATERIAL'|'UNASSIGNED_COMPONENT'|'SOURCE_CONFLICT';
export type BomAuditIssue={type:BomAuditIssueType;boardKey?:'EASYSCAN'|'SCANBOX'|'KEYSCAN';itemId?:string;itemName:string;message:string;sourceSheet?:string;sourceRow?:number;duplicateItemIds?:string[]};
export type BomAudit={boards:{key:'EASYSCAN'|'SCANBOX'|'KEYSCAN';sku:string;name:string;productId:string|null;configuredLines:number;totalUnits:number;issueCount:number}[];issues:BomAuditIssue[];summary:{total:number;missing:number;duplicates:number;unassigned:number;sourceConflicts:number}};
export type FinishedProductTransactionType='PRODUCED'|'OUT'|'ADJUSTMENT';
export type FinishedProductTransaction={id:string;productId:string;type:FinishedProductTransactionType;quantity:string;balanceBefore:string;balanceAfter:string;note:string|null;reference?:string|null;actorId:string;createdAt:string};
export type ProductionModule='CABLE'|'DEVICE'|'PACKING'|'TEST'|'SUPPORT';
export type ProductionOutputType='FINISHED_PRODUCT'|'SELLABLE_PRODUCT'|'LABEL';
export type ProductionWorkSession={id:string;userId:string;workDate:string;isRegistered:boolean;plannedStartTime?:string|null;registrationTimeMissing?:boolean;hoursWorked:string|null;updatedById:string};
export type ProductionReportItem={lotId:string;stage:'ASSEMBLE'|'SOLDER'|'PACK'|'TEST'|'OTHER';quantity:number;result:'PASSED'|'FAILED'|'IN_PROGRESS';note?:string};
export type ProductionEntry={id:string;userId:string;workDate:string;module:ProductionModule;workType:string;outputType:ProductionOutputType;outputId:string|null;outputLabel:string;quantity:number|null;progressPercent:string|null;note:string|null;rawText:string|null;reportItems:ProductionReportItem[];needsReview:boolean;createdById:string;createdAt:string};
export type ProductionLotStatus='NEW'|'IN_PROGRESS'|'WAITING_TEST'|'TESTING'|'DONE';
export type ProductionLotActionType='ASSEMBLE'|'PACK'|'TEST'|'SOLDER';
export type ProductionLotEvent={id:string;lotId:string;type:'CREATED'|'CLAIMED'|'STARTED'|'PAUSED'|'PRODUCTION_FINISHED'|'TEST_CLAIMED'|'TESTED'|'REPORT_LINKED'|'NOTE_UPDATED'|'DONE'|'UNDONE'|'DELETED';actorId:string;payload:Record<string,unknown>|null;createdAt:string};
export type ProductionLot={id:string;runId:string;code:string;actionType:ProductionLotActionType;outputType:Exclude<ProductionOutputType,'LABEL'>;outputId:string;outputLabel:string;targetQuantity:number;status:ProductionLotStatus;completedQuantity:number|null;producedQuantity:number|null;failedQuantity:number|null;accumulatedMinutes:number;activeById:string|null;activeStartedAt:string|null;workStartedAt:string|null;workEndedAt:string|null;note:string|null;createdById:string;completedById:string|null;completedAt:string|null;testedById:string|null;testedAt:string|null;testClaimedById:string|null;testClaimedAt:string|null;testProfileKey:string|null;testProfileVersion:number|null;testStationId:string|null;deviceTestStartedAt:string|null;deviceTestTargetPassCount:number|null;deviceTestPassCount:number;deviceTestFailCount:number;deviceTestRemainingCount:number;deletedAt:string|null;deletedById:string|null;createdAt:string;updatedAt:string;syncWarnings:string[];participants:{id:string;username:string;displayName:string}[];reports:{id:string;userId:string;workDate:string;rawText:string|null;reportItems:ProductionReportItem[];createdAt:string}[];events:ProductionLotEvent[]};
export type ProductionLotImpactLine={kind:'MATERIAL'|'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';id:string;label:string;before:number;change:number;after:number};
export type ProductionLotImpact={inventoryChanged:boolean;output:ProductionLotImpactLine;components:ProductionLotImpactLine[];warnings:string[]};
export type ProductionLotDeletePreview={lotId:string;code:string;status:ProductionLotStatus;linkedReportCount:number;stockImpact:ProductionLotImpact|null};
export type ProductionSummary={userId:string;hours:number;sessions:number;entries:number;outputs:Record<string,number>};
export type ProductionPaymentRequest={id:string;userId:string;sessionIds:string[];totalHours:string;workSummary:{date:string;outputs:{label:string;quantity:number|null}[]}[];status:'REQUESTED'|'PAID';paidAt:string|null};
export type ProductionProductivityWarning={entryId:string;userId:string;workDate:string;status:'WARNING'|'INSUFFICIENT_DATA';actualHours:number;expectedHours:number|null;deviationPercent:number|null;direction:'FASTER'|'SLOWER'|null;sampleCount:number;message:string};
export type ProductionOverview={from:string;to:string;sessions:ProductionWorkSession[];entries:ProductionEntry[];paymentRequests:ProductionPaymentRequest[];summary:ProductionSummary[];productivityWarnings:ProductionProductivityWarning[]};

const API_URL = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? 'http://127.0.0.1:3000/api' : `${window.location.origin}/api`);
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

export class ApiError extends Error { constructor(message:string,readonly status:number){super(message);} }

export class Api {
  async uploadUserAvatar(userId:string,file:File){const body=new FormData();body.append('file',file);const response=await fetch(`${API_URL}/users/${userId}/avatar`,{method:'PUT',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null);throw new ApiError(Array.isArray(result?.message)?result.message.join(', '):result?.message??'Không upload được ảnh',response.status);}return response.json() as Promise<{id:string;avatarDataUrl:string}>;}
  constructor(private readonly token:string) {}
  private async request<T>(path:string, init:RequestInit={}) {
    const response=await fetch(`${API_URL}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.token}`,...init.headers}});
    if(!response.ok){const body=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(body?.message)?body.message.join(', '):body?.message;throw new ApiError(message??`Request failed (${response.status})`,response.status);}
    return response.json() as Promise<T>;
  }
  users(){return this.request<User[]>('/users');}
  activationHistory(){return this.request<ActivationRecord[]>('/activation');}
  generateActivation(input:{series:string;product:ActivationProduct;packageCode:string;source:string;paymentStatus:ActivationPaymentStatus}){return this.request<ActivationRecord>('/activation',{method:'POST',body:JSON.stringify(input)});}
  async recognizeActivation(file:File){const body=new FormData();body.append('file',file);const response=await fetch(`${API_URL}/activation/ocr`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`Không đọc được ảnh (${response.status})`,response.status);}return response.json() as Promise<ActivationOcrResult>;}
  async generateDiagramDraft(file:File){const body=new FormData();body.append('file',file);const response=await fetch(`${API_URL}/diagram-ai/draft`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`AI không tạo được draft (${response.status})`,response.status);}return response.json() as Promise<DiagramAiDraftResult>;}
  diagramProjects(){return this.request<DiagramProject[]>('/diagram-projects');}
  diagramProject(id:string){return this.request<DiagramProject>(`/diagram-projects/${id}`);}
  createDiagramProject(input:DiagramProjectInput){return this.request<DiagramProject>('/diagram-projects',{method:'POST',body:JSON.stringify(input)});}
  updateDiagramProject(id:string,input:DiagramProjectEditInput){return this.request<DiagramProject>(`/diagram-projects/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  archiveDiagramProject(id:string,confirmationTitle:string){return this.request<{id:string;status:'ARCHIVED'}>(`/diagram-projects/${id}/archive`,{method:'POST',body:JSON.stringify({confirmationTitle})});}
  addDiagramCircuit(projectId:string,input:{circuitKey:string;circuitTitle:string;required?:boolean}){return this.request<DiagramProject>(`/diagram-projects/${projectId}/circuits`,{method:'POST',body:JSON.stringify(input)});}
  async saveDiagramCircuitDraft(circuitId:string,file:File,input:{schema:unknown;warnings:string[];uncertainItems:string[];validationErrors:string[];model:string;preparation?:PreparationManifest}){const body=new FormData();body.append('file',file);body.append('schema',JSON.stringify(input.schema));body.append('warnings',JSON.stringify(input.warnings));body.append('uncertainItems',JSON.stringify(input.uncertainItems));body.append('validationErrors',JSON.stringify(input.validationErrors));body.append('model',input.model);if(input.preparation)body.append('preparation',JSON.stringify(input.preparation));const response=await fetch(`${API_URL}/diagram-projects/circuits/${circuitId}/draft`,{method:'PUT',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`Không lưu được draft (${response.status})`,response.status);}return response.json() as Promise<DiagramProject>;}
  async diagramCircuitSource(circuitId:string){const response=await fetch(`${API_URL}/diagram-projects/circuits/${circuitId}/source`,{headers:{Authorization:`Bearer ${this.token}`}});if(!response.ok)throw new ApiError(`Không đọc được ảnh nguồn (${response.status})`,response.status);return response.blob();}
  updateDiagramCircuitStatus(circuitId:string,status:DiagramCircuitStatus){return this.request<DiagramProject>(`/diagram-projects/circuits/${circuitId}/status`,{method:'PATCH',body:JSON.stringify({status})});}
  updateUserEmail(id:string,email:string|null){return this.request<User>(`/users/${id}/email`,{method:'PATCH',body:JSON.stringify({email})});}
  trash(){return this.request<Task[]>('/tasks/trash');}
  truck(){return this.request<Task[]>('/tasks/truck');}
  taskDrafts(){return this.request<TaskDraft[]>('/tasks/drafts');}
  createTaskDraft(input:{topic:string;description?:string;assigneeIds?:string[];dueDate?:string}){return this.request<TaskDraft>('/tasks/drafts',{method:'POST',body:JSON.stringify(input)});}
  updateTaskDraft(id:string,input:{topic:string;description:string;suggestion:string;assigneeIds:string[];criteria:string[]}){return this.request<TaskDraft>(`/tasks/drafts/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  setTaskPriority(id:string,priority:TaskPriority){return this.request<Task>(`/tasks/${id}/priority`,{method:'PATCH',body:JSON.stringify({priority})});}
  setTaskDraftPriority(id:string,priority:TaskPriority){return this.request<TaskDraft>(`/tasks/drafts/${id}/priority`,{method:'PATCH',body:JSON.stringify({priority})});}
  promoteTaskDraft(id:string,input:{title:string;note:string;suggestion?:string;assigneeIds:string[];criteria:string[]}){return this.request<Task>(`/tasks/drafts/${id}/promote`,{method:'POST',body:JSON.stringify(input)});}
  claimTaskDraft(id:string){return this.request<Task>(`/tasks/drafts/${id}/claim`,{method:'POST',body:'{}'});}
  removeTaskDraft(id:string){return this.request<{id:string}>(`/tasks/drafts/${id}`,{method:'DELETE'});}
  taskScoreboard(month:string){return this.request<TaskScoreboard>(`/tasks/scoreboard?month=${encodeURIComponent(month)}`);}
  taskDetail(id:string){return this.request<TaskDetail>(`/tasks/${id}/detail`);}
  taskNotifications(){return this.request<TaskNotification[]>('/tasks/notifications');}
  readAllTaskNotifications(){return this.request<{readAt:string}>('/tasks/notifications/read-all',{method:'PATCH'});}
  readTaskNotification(id:string){return this.request<TaskNotification>(`/tasks/notifications/${id}/read`,{method:'PATCH'});}
  async commentTask(id:string,input:{body:string;mentionedUserIds:string[];image?:File|null}){const body=new FormData();body.append('body',input.body);body.append('mentionedUserIds',JSON.stringify(input.mentionedUserIds));if(input.image)body.append('image',input.image);const response=await fetch(`${API_URL}/tasks/${id}/comments`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`Không gửi được comment (${response.status})`,response.status);}return response.json();}
  async taskCommentImage(imageUrl:string){const response=await fetch(`${API_URL.replace(/\/api\/?$/,'')}${imageUrl}`,{headers:{Authorization:`Bearer ${this.token}`}});if(!response.ok)throw new ApiError(`Không tải được ảnh comment (${response.status})`,response.status);return response.blob();}
  create(input:{title:string;note:string;suggestion?:string;assigneeIds:string[];criteria:string[]}){return this.request<Task>('/tasks',{method:'POST',body:JSON.stringify(input)});}
  updateTask(id:string,input:{title?:string;note?:string;suggestion?:string;assigneeIds?:string[];criteria?:string[]}){return this.request<Task>(`/tasks/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  action(id:string,action:'backlog'|'start'|'reopen'|'complete'|'undo-complete'|'archive'){return this.request<Task|{id:string}>(`/tasks/${id}/${action}`,{method:'POST'});}
  reportTaskRisk(id:string){return this.request<Task>(`/tasks/${id}/risk`,{method:'POST',body:'{}'});}
  reviewTask(id:string,passedCriterionIds:string[]){return this.request<Task>(`/tasks/${id}/review`,{method:'POST',body:JSON.stringify({passedCriterionIds})});}
  failTaskReview(id:string,reason?:string){return this.request<Task>(`/tasks/${id}/review-failed`,{method:'POST',body:JSON.stringify({reason})});}
  resetTaskReview(id:string){return this.request<Task>(`/tasks/${id}/review-pending`,{method:'POST',body:'{}'});}
  remove(id:string){return this.request<{id:string}>(`/tasks/${id}`,{method:'DELETE'});}
  worklogs(month:string,sprintStart?:string){const params=new URLSearchParams({month});if(sprintStart)params.set('sprintStart',sprintStart);return this.request<WorklogDashboard>(`/worklogs?${params.toString()}`);}
  performance(month:string){return this.request<PerformanceReport>(`/performance?month=${encodeURIComponent(month)}`);}
  createPerformancePeriod(input:PerformancePeriodInput){return this.request<PerformanceReport>('/performance/periods',{method:'POST',body:JSON.stringify(input)});}
  createPerformancePlan(input:PerformancePlanInput){return this.request<PerformanceReport>('/performance/plans',{method:'POST',body:JSON.stringify(input)});}
  attestPerformance(month:string,userId:string,fingerprint:string){return this.request<PerformanceReport>(`/performance/${encodeURIComponent(month)}/members/${userId}/attest`,{method:'POST',body:JSON.stringify({fingerprint})});}
  updateWorklogWeek(weekStart:string,goal:string){return this.request<WorklogWeekSummary>(`/worklogs/weeks/${weekStart}`,{method:'PATCH',body:JSON.stringify({goal})});}
  closeWorklogWeek(weekStart:string){return this.request<WorklogWeekSummary>(`/worklogs/weeks/${weekStart}/close`,{method:'POST',body:'{}'});}
  reopenWorklogWeek(weekStart:string){return this.request<WorklogWeekSummary>(`/worklogs/weeks/${weekStart}/reopen`,{method:'POST',body:'{}'});}
  worklog(id:string){return this.request<Worklog>(`/worklogs/${id}`);}
  async commentWorklog(id:string,input:{body:string;mentionedUserIds:string[];image?:File|null}){const body=new FormData();body.append('body',input.body);body.append('mentionedUserIds',JSON.stringify(input.mentionedUserIds));if(input.image)body.append('image',input.image);const response=await fetch(`${API_URL}/worklogs/${id}/comments`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`Không gửi được comment (${response.status})`,response.status);}return response.json() as Promise<WorklogComment>;}
  async worklogCommentImage(imageUrl:string){const response=await fetch(`${API_URL.replace(/\/api\/?$/,'')}${imageUrl}`,{headers:{Authorization:`Bearer ${this.token}`}});if(!response.ok)throw new ApiError(`Không tải được ảnh comment (${response.status})`,response.status);return response.blob();}
  requestTaskReview(taskId:string){return this.request<Task>(`/tasks/${taskId}/request-review`,{method:'POST'});}
  setTaskStatus(taskId:string,status:Exclude<Status,'ARCHIVED'>){return this.request<Task>(`/tasks/${taskId}/status`,{method:'PATCH',body:JSON.stringify({status})});}
  createWorklog(input:{userId?:string;primaryTaskId?:string;taskIds:string[];input:string;outputCriteria:WorklogOutputCriterion[];links:string[];startedAt:string;endedAt?:string;hoursWorked?:number;valueLevel:WorklogValueLevel;workType:WorklogType;reopenedWorklogId?:string;status:WorklogStatus}){return this.request<Worklog>('/worklogs',{method:'POST',body:JSON.stringify(input)});}
  updateWorklog(id:string,input:{userId?:string;primaryTaskId?:string;taskIds:string[];input:string;outputCriteria?:WorklogOutputCriterion[];links:string[];startedAt:string;endedAt?:string;hoursWorked?:number;valueLevel:WorklogValueLevel;workType:WorklogType;reopenedWorklogId?:string;status:WorklogStatus}){return this.request<Worklog>(`/worklogs/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  scoreWorklog(id:string,input:{valueLevel:WorklogValueLevel;standardHours:number;completionRate:0|0.6|1;stabilityConfirmed?:boolean}){return this.request<Worklog>(`/worklogs/${id}/point`,{method:'PATCH',body:JSON.stringify(input)});}
  confirmWorklogStability(id:string){return this.request<Worklog>(`/worklogs/${id}/stability`,{method:'PATCH'});}
  removeWorklog(id:string){return this.request<{id:string}>(`/worklogs/${id}`,{method:'DELETE'});}
  inventoryItems(){return this.request<InventoryItem[]>('/inventory/items');}
  bomAudit(){return this.request<BomAudit>('/inventory/bom-audit');}
  createInventoryItem(input:{name:string;groupName:string;bomKind?:InventoryBomKind;sku?:string;location?:string;note?:string;minimumStock?:number;price?:number;purchaseLinks?:string[];openingQuantity?:number}){return this.request<InventoryItem>('/inventory/items',{method:'POST',body:JSON.stringify(input)});}
  inventoryTransactions(id:string){return this.request<InventoryTransaction[]>(`/inventory/items/${id}/transactions`);}
  inventoryAudits(id:string){return this.request<InventoryAudit[]>(`/inventory/items/${id}/audits`);}
  openingBalance(id:string,input:{quantity:number;unit:string;note?:string}){return this.request(`/inventory/items/${id}/opening-balance`,{method:'POST',body:JSON.stringify(input)});}
  normalizeInventory(input:{items:{itemId:string;quantity:number;unit:InventoryUnit}[];note?:string}){return this.request<{normalized:number}>('/inventory/normalize',{method:'POST',body:JSON.stringify(input)});}
  inventoryMovement(id:string,input:{type:InventoryTransactionType;quantity:number;note?:string;reference?:string}){return this.request(`/inventory/items/${id}/movements`,{method:'POST',body:JSON.stringify(input)});}
  updateInventoryItem(id:string,input:{unit?:string;sku?:string;name?:string;groupName?:string;bomKind?:InventoryBomKind;location?:string;note?:string;minimumStock?:number;price?:number;purchaseLinks?:string[];isActive?:boolean}){return this.request<InventoryItem>(`/inventory/items/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  removeInventoryItem(id:string){return this.request<InventoryItem>(`/inventory/items/${id}`,{method:'DELETE'});}
  requestInventoryCount(id:string,input:{assigneeId:string;note?:string}){return this.request<InventoryItem>(`/inventory/items/${id}/request-count`,{method:'POST',body:JSON.stringify(input)});}
  purchaseRequests(){return this.request<PurchaseRequest[]>('/inventory/purchase-requests');}
  createPurchaseRequest(id:string,input:{quantity:number;note?:string;assignedBuyerId?:string|null}){return this.request<PurchaseRequest>(`/inventory/items/${id}/purchase-requests`,{method:'POST',body:JSON.stringify(input)});}
  updatePurchaseRequest(id:string,input:{itemId?:string;quantity?:number;note?:string;status?:PurchaseRequestStatus;receivedQuantity?:number;paymentStatus?:PurchasePaymentStatus;orderUrl?:string|null;orderCode?:string|null;assignedBuyerId?:string|null}){return this.request<PurchaseRequest>(`/inventory/purchase-requests/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  removePurchaseRequest(id:string){return this.request<{id:string}>(`/inventory/purchase-requests/${id}`,{method:'DELETE'});}
  async inventoryImage(ownerType:InventoryImageOwnerType,ownerId:string){const response=await fetch(`${API_URL}/inventory/images/${ownerType}/${ownerId}`,{headers:{Authorization:`Bearer ${this.token}`},cache:'no-store'});if(response.status===404)return null;if(!response.ok)throw new ApiError(`Không tải được ảnh (${response.status})`,response.status);return response.blob();}
  async uploadInventoryImage(ownerType:InventoryImageOwnerType,ownerId:string,file:File){const body=new FormData();body.append('file',file);const response=await fetch(`${API_URL}/inventory/images/${ownerType}/${ownerId}`,{method:'PUT',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`Không upload được ảnh (${response.status})`,response.status);}return response.json();}
  removeInventoryImage(ownerType:InventoryImageOwnerType,ownerId:string){return this.request(`/inventory/images/${ownerType}/${ownerId}`,{method:'DELETE'});}
  finishedProducts(){return this.request<FinishedProduct[]>('/inventory/finished-items');}
  createFinishedProduct(input:{name:string;category:FinishedProductCategory;note?:string;minimumStock?:number;openingQuantity?:number}){return this.request<FinishedProduct>('/inventory/finished-items',{method:'POST',body:JSON.stringify(input)});}
  updateFinishedProduct(id:string,input:{name?:string;category?:FinishedProductCategory;note?:string;minimumStock?:number;isActive?:boolean}){return this.request<FinishedProduct>(`/inventory/finished-items/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  removeFinishedProduct(id:string){return this.request<FinishedProduct>(`/inventory/finished-items/${id}`,{method:'DELETE'});}
  finishedProductTransactions(id:string){return this.request<FinishedProductTransaction[]>(`/inventory/finished-items/${id}/transactions`);}
  finishedProductMovement(id:string,input:{type:FinishedProductTransactionType;quantity:number;note?:string}){return this.request(`/inventory/finished-items/${id}/movements`,{method:'POST',body:JSON.stringify(input)});}
  replaceBom(id:string,input:{items:{itemId:string;quantity:number}[];components?:{componentProductId:string;quantity:number}[]}){return this.request<FinishedProduct[]>(`/inventory/finished-items/${id}/bom`,{method:'PATCH',body:JSON.stringify(input)});}
  sellableProducts(){return this.request<SellableProduct[]>('/inventory/products');}
  createSellableProduct(input:{name:string;note?:string;minimumStock?:number;openingQuantity?:number}){return this.request<SellableProduct>('/inventory/products',{method:'POST',body:JSON.stringify(input)});}
  updateSellableProduct(id:string,input:{name?:string;note?:string;minimumStock?:number;isActive?:boolean}){return this.request<SellableProduct>(`/inventory/products/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  removeSellableProduct(id:string){return this.request<SellableProduct>(`/inventory/products/${id}`,{method:'DELETE'});}
  sellableProductTransactions(id:string){return this.request<FinishedProductTransaction[]>(`/inventory/products/${id}/transactions`);}
  sellableProductMovement(id:string,input:{type:FinishedProductTransactionType;quantity:number;note?:string}){return this.request(`/inventory/products/${id}/movements`,{method:'POST',body:JSON.stringify(input)});}
  replaceSellableProductBom(id:string,input:{items:{finishedProductId:string;quantity:number}[];materials:{itemId:string;quantity:number}[]}){return this.request<SellableProduct[]>(`/inventory/products/${id}/bom`,{method:'PATCH',body:JSON.stringify(input)});}
  materialPlan(input:{outputType:'SELLABLE_PRODUCT'|'FINISHED_PRODUCT';outputId:string;quantity:number}){return this.request<MaterialPlan>('/inventory/material-plan',{method:'POST',body:JSON.stringify(input)});}
  stockCountSheets(){return this.request<StockCountSheet[]>('/inventory/stock-count-sheets');}
  createStockCountSheet(input:{assigneeId:string}){return this.request<StockCountSheet>('/inventory/stock-count-sheets',{method:'POST',body:JSON.stringify(input)});}
  updateStockCountSheet(id:string,input:{lines:{ownerType:StockCountLine['ownerType'];ownerId:string;countedQuantity:number|null;note?:string}[]}){return this.request<StockCountSheet>(`/inventory/stock-count-sheets/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  submitStockCountSheet(id:string){return this.request<StockCountSheet>(`/inventory/stock-count-sheets/${id}/submit`,{method:'POST'});}
  finalizeStockCountSheet(id:string){return this.request<StockCountSheet>(`/inventory/stock-count-sheets/${id}/finalize`,{method:'POST'});}
  sharedDocuments(){return this.request<SharedDocument[]>('/documents/shared');}
  createSharedDocument(input:{title:string;url:string;description?:string}){return this.request<SharedDocument>('/documents/shared',{method:'POST',body:JSON.stringify(input)});}
  updateSharedDocument(id:string,input:{title?:string;url?:string;description?:string}){return this.request<SharedDocument>(`/documents/shared/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  removeSharedDocument(id:string){return this.request<{id:string}>(`/documents/shared/${id}`,{method:'DELETE'});}
  pcbLayouts(){return this.request<PcbLayout[]>('/pcb-layouts');}
  async pcbLayoutHtml(product:PcbLayoutProduct){const response=await fetch(`${API_URL}/pcb-layouts/${product}/html`,{headers:{Authorization:`Bearer ${this.token}`}});if(!response.ok)throw new ApiError(`Không tải được PCB Layout (${response.status})`,response.status);return response.text();}
  async uploadPcbLayout(product:PcbLayoutProduct,file:File){const body=new FormData();body.append('file',file);const response=await fetch(`${API_URL}/pcb-layouts/${product}`,{method:'PUT',headers:{Authorization:`Bearer ${this.token}`},body});if(!response.ok){const result=await response.json().catch(()=>null) as {message?:string|string[]}|null;const message=Array.isArray(result?.message)?result.message.join(', '):result?.message;throw new ApiError(message??`Không tải được file (${response.status})`,response.status)}return response.json() as Promise<PcbLayout>;}
  updatePcbLayoutProgress(product:PcbLayoutProduct,input:{checkbox:'Sourced'|'Placed';refs:string}){return this.request<PcbLayout>(`/pcb-layouts/${product}/progress`,{method:'PATCH',body:JSON.stringify(input)});}
  warrantyCases(){return this.request<WarrantyCase[]>('/warranty');}
  createWarrantyCase(input:WarrantyCaseInput){return this.request<WarrantyCase>('/warranty',{method:'POST',body:JSON.stringify(input)});}
  updateWarrantyCase(id:string,input:WarrantyCaseInput){return this.request<WarrantyCase>(`/warranty/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  markWarrantyReturned(id:string){return this.request<WarrantyCase>(`/warranty/${id}`,{method:'PATCH',body:JSON.stringify({status:'RETURNED'})});}
  productionOverview(from:string,to:string){return this.request<ProductionOverview>(`/production/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);}
  productionLots(includeDone=true){return this.request<ProductionLot[]>(`/production/lots?includeDone=${includeDone}`);}
  createProductionRun(input:{lots:{actionType:ProductionLotActionType;outputType:'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';outputId:string;targetQuantity:number}[]}){return this.request<{lots:ProductionLot[]}>('/production/runs',{method:'POST',body:JSON.stringify(input)});}
  claimProductionLot(id:string){return this.request<ProductionLot>(`/production/lots/${id}/claim`,{method:'POST',body:'{}'});}
  pauseProductionLot(id:string){return this.request<ProductionLot>(`/production/lots/${id}/pause`,{method:'POST',body:'{}'});}
  finishProductionLot(id:string,input:{quantity:number}){return this.request<ProductionLot>(`/production/lots/${id}/finish-production`,{method:'POST',body:JSON.stringify(input)});}
  updateProductionLot(id:string,input:{targetQuantity?:number;producedQuantity?:number;note?:string;status?:ProductionLotStatus;participantIds?:string[];comment?:string}){return this.request<ProductionLot>(`/production/lots/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  claimProductionTest(id:string){return this.request<ProductionLot>(`/production/lots/${id}/claim-test`,{method:'POST',body:'{}'});}
  completeProductionTest(id:string,input:{testedQuantity:number;passedQuantity:number;failedQuantity:number;note?:string}){return this.request<{lot:ProductionLot;impact:ProductionLotImpact}>(`/production/lots/${id}/test-result`,{method:'POST',body:JSON.stringify(input)});}
  testProductionLot(id:string){return this.request<ProductionLot>(`/production/lots/${id}/test`,{method:'POST',body:'{}'});}
  updateProductionLotNote(id:string,note:string){return this.request<ProductionLot>(`/production/lots/${id}/note`,{method:'PATCH',body:JSON.stringify({note})});}
  previewProductionLot(id:string,quantity:number){return this.request<ProductionLotImpact>(`/production/lots/${id}/preview`,{method:'POST',body:JSON.stringify({quantity})});}
  completeProductionLot(id:string,quantity:number){return this.request<{lot:ProductionLot;impact:ProductionLotImpact}>(`/production/lots/${id}/done`,{method:'POST',body:JSON.stringify({quantity})});}
  undoProductionLot(id:string){return this.request<ProductionLot>(`/production/lots/${id}/undo`,{method:'POST',body:'{}'});}
  previewDeleteProductionLot(id:string){return this.request<ProductionLotDeletePreview>(`/production/lots/${id}/delete-preview`,{method:'POST',body:'{}'});}
  deleteProductionLot(id:string){return this.request<{id:string;deletedAt:string;stockImpact:ProductionLotImpact|null}>(`/production/lots/${id}`,{method:'DELETE'});}
  productionNotifications(){return this.request<ProductionNotification[]>('/production/notifications');}
  readAllProductionNotifications(){return this.request<{readAt:string}>('/production/notifications/read-all',{method:'PATCH'});}
  readProductionNotification(id:string){return this.request<ProductionNotification>(`/production/notifications/${id}/read`,{method:'PATCH'});}
  systemNotifications(){return this.request<SystemNotification[]>('/notifications');}
  readAllSystemNotifications(){return this.request<{readAt:string}>('/notifications/read-all',{method:'PATCH'});}
  readSystemNotification(id:string){return this.request<SystemNotification>(`/notifications/${id}/read`,{method:'PATCH'});}
  upsertProductionSession(input:{userId:string;workDate:string;isRegistered:boolean;plannedStartTime?:string|null;hoursWorked?:number|null}){return this.request<ProductionWorkSession>('/production/sessions',{method:'POST',body:JSON.stringify(input)});}
  createProductionEntry(input:{userId:string;workDate:string;module:ProductionModule;workType:string;outputType:ProductionOutputType;outputId?:string|null;outputLabel:string;quantity?:number|null;progressPercent?:number|null;note?:string;rawText?:string;reportItems?:ProductionReportItem[];needsReview?:boolean;lotIds?:string[]}){return this.request<ProductionEntry>('/production/entries',{method:'POST',body:JSON.stringify(input)});}
  updateProductionEntry(id:string,input:{userId:string;workDate:string;module:ProductionModule;workType:string;outputType:ProductionOutputType;outputId?:string|null;outputLabel:string;quantity?:number|null;progressPercent?:number|null;note?:string;rawText?:string;reportItems?:ProductionReportItem[];needsReview?:boolean;lotIds?:string[]}){return this.request<ProductionEntry>(`/production/entries/${id}`,{method:'PATCH',body:JSON.stringify(input)});}
  markProductionPaymentPaid(id:string){return this.request<ProductionPaymentRequest>(`/production/payment-requests/${id}/paid`,{method:'PATCH'});}
  connect(onChange:()=>void):Socket{
    const socket=io(SOCKET_URL,{auth:{token:this.token}});
    ['task.created','task.updated','task.done','task.reopened','task.completed','task.deleted','task.archived','task.draft.updated','task.comment.created','inventory.imported','inventory.item.updated','inventory.movement.created','inventory.normalized','inventory.purchase.updated','inventory.product.updated','inventory.sellable-product.updated','inventory.image.updated','document.updated','production.updated','worklog.updated','warranty.updated'].forEach(event=>socket.on(event,onChange));
    return socket;
  }
  connectPresence(onPresence:(people:OnlineMember[])=>void):Socket{
    const socket=io(SOCKET_URL,{auth:{token:this.token}});
    socket.on('presence.updated',onPresence);
    return socket;
  }
  connectPcbLayouts(onChange:()=>void):Socket{const socket=io(SOCKET_URL,{auth:{token:this.token}});socket.on('pcb-layout.updated',onChange);return socket;}
}

export async function login(username:string,password:string){
  const response=await fetch(`${API_URL}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  if(!response.ok)throw new Error('Sai tài khoản hoặc mật khẩu');
  return response.json() as Promise<{accessToken:string;user:User}>;
}

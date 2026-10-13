import { describe, expect, it } from 'vitest';
import { normalizeActivationSeries, worklogSourceIds, addWorklogSource, worklogMatchesSource, themeFromPreference } from './App';
import { avatarColor, calculateWorklogPoint, canCompleteProductionLot, canDeleteProductionLot, canDoneTask, currentVietnamDate, filterMaterialOptions, filterWorklogSourceTasks, finishedProductsForCategory, finishedProductsForMaterial, formatRecentCountTime, formatWorklogWeek, inventoryAuditDescription, inventoryItemMissingLocation, overduePurchaseRequests, isRecentlyCounted, parseSprintGoals, pendingPersonalNoticeNotifications, personalUnreadNotifications, productionDayState, productionLotIdsForEntry, productionReportForDay, purchaseMaterialMatches, purchaseReceivedDate, purchaseReceivedQuantity, serializeSprintGoals, taskMatchesAssignee, taskStockFilterForView, topicColor, urgency, VIEW_HASHES, viewFromHash, viewNeedsAppData, warrantyCasesForWeek, warrantyProductColor, warrantyWeekStart, weeklyAchievedOutputLabels, weeklyWorklogInsight, weeklyWorklogPerformance, worklogCapitalLabel, worklogConversionLabel, worklogOutputParts, worklogSprintCreateState, worklogSprintNumber, worklogSprintStart, worklogStatusLabel } from './App';
import type { AppNotification, FinishedProduct, InventoryItem, ProductionEntry, ProductionLot, PurchaseRequest, Task, WarrantyCase, Worklog, WorklogSummary } from './api';

describe('theme preference', () => {
  it('defaults to light for a new browser', () => expect(themeFromPreference(null)).toBe('light'));
  it('defaults to light for an invalid saved value', () => {
    expect(themeFromPreference('')).toBe('light');
    expect(themeFromPreference('invalid')).toBe('light');
  });
  it('preserves an explicit light preference', () => expect(themeFromPreference('light')).toBe('light'));
  it('preserves an explicit dark preference', () => expect(themeFromPreference('dark')).toBe('dark'));
});

describe('activation Series confirmation',()=>{
  it('normalizes valid input before confirmation',()=>expect(normalizeActivationSeries('1 2 a b 10 20 fe ff')).toBe('01-02-0A-0B-10-20-FE-FF'));
  it('rejects incomplete or non-hex Series',()=>{expect(normalizeActivationSeries('01-02-03')).toBeNull();expect(normalizeActivationSeries('01-02-03-04-05-06-07-GG')).toBeNull();});
});

describe('urgency label', () => {
  const now = new Date('2026-07-21T05:00:00.000Z');
  it('shows working days left and overdue', () => {
    expect(urgency('2026-07-20', 'ACTIVE', now)?.label).toBe('1 day overdue');
    expect(urgency('2026-07-21', 'ACTIVE', now)?.label).toBe('Due today');
    expect(urgency('2026-07-22', 'ACTIVE', now)?.label).toBe('1 day left');
    expect(urgency('2026-07-27', 'ACTIVE', now)?.label).toBe('5 days left');
  });
  it('counts Saturday and skips Sunday', () => {
    const friday = new Date('2026-07-24T05:00:00.000Z');
    expect(urgency('2026-07-25', 'ACTIVE', friday)?.label).toBe('1 day left');
    expect(urgency('2026-07-27', 'ACTIVE', friday)?.label).toBe('2 days left');
  });
  it('does not show urgency for Done tasks', () => expect(urgency('2026-07-20', 'DONE', now)).toBeNull());
});

describe('avatar color', () => {
  it('keeps a stable color per member', () => {
    expect(avatarColor('member-thang')).toBe(avatarColor('member-thang'));
    expect(avatarColor('member-thang')).not.toBe(avatarColor('member-vinh'));
  });
  it('uses the approved fixed color for known members', () => {
    expect(avatarColor('any-id', 'THẮNG')).toBe('#0066ff');
    expect(avatarColor('another-id', 'vinh')).toBe('#f97316');
    expect(avatarColor('phu-id', 'PHÚ')).toBe('#9333ea');
    expect(avatarColor('admin-id', 'Admin')).toBe('#374151');
  });
});

describe('Worklog Vietnam date', () => {
  it('uses the Vietnam calendar day for member-created Worklogs', () => {
    expect(currentVietnamDate(new Date('2026-08-12T17:30:00.000Z'))).toBe('2026-08-13');
  });
});

describe('Worklog routes', () => {
  it('keeps Sprint routes in the Worklog module', () => {
    expect(viewFromHash('#/worklog')).toBe('worklogs');
    expect(viewFromHash('#/worklog/sprint/2026-08-17')).toBe('worklogs');
    expect(worklogSprintStart('2026-08-30')).toBe('2026-08-17');
    expect(worklogSprintStart('2026-08-31')).toBe('2026-08-31');
    expect(worklogSprintNumber('2026-08-31')).toBe(2);
  });

  it('allows creation only in the current open Sprint',()=>{
    expect(worklogSprintCreateState('2026-08-17','OPEN','2026-08-20')).toEqual({enabled:true,label:'＋ Worklog'});
    expect(worklogSprintCreateState('2026-08-03','OPEN','2026-08-20')).toEqual({enabled:false,label:'SPRINT ĐÃ QUA'});
    expect(worklogSprintCreateState('2026-08-31','OPEN','2026-08-20')).toEqual({enabled:false,label:'CHƯA BẮT ĐẦU'});
    expect(worklogSprintCreateState('2026-08-17','CLOSED','2026-08-20')).toEqual({enabled:false,label:'SPRINT ĐÃ CHỐT'});
  });
});

describe('Sprint Goal document',()=>{
  it('keeps legacy Goal text readable as separate items',()=>{
    expect(parseSprintGoals('- Hoàn thành ScanBox\n2. Kiểm lại kho')).toEqual([
      {text:'Hoàn thành ScanBox',assigneeIds:[]},
      {text:'Kiểm lại kho',assigneeIds:[]},
    ]);
  });
  it('round-trips tagged Goal items in the existing Goal field',()=>{
    const items=[{text:'Đóng case máy test',assigneeIds:['thang','phu']},{text:'Kiểm kho',assigneeIds:[]}];
    expect(parseSprintGoals(serializeSprintGoals(items))).toEqual(items);
  });
});

describe('Diagram Studio route', () => {
  it('keeps the read-only studio on its dedicated hash', () => {
    expect(VIEW_HASHES.diagramStudio).toBe('#/diagram-studio');
    expect(viewFromHash('#/diagram-studio')).toBe('diagramStudio');
    expect(viewNeedsAppData('diagramStudio')).toBe(false);
    expect(viewNeedsAppData('pcbLayout')).toBe(false);
    expect(viewNeedsAppData('trash')).toBe(true);
  });
});

describe('Worklog Value Point', () => {
  it('uses standard H, Value rate, completion and Re-open stability', () => {
    expect(calculateWorklogPoint('BASIC', 3, 1, 0)).toBe(120);
    expect(calculateWorklogPoint('BASIC', 3, 1, 0, true)).toBe(150);
    expect(calculateWorklogPoint('DEV', 3, 1, 1)).toBe(240);
    expect(calculateWorklogPoint('RND', 4, 0.6, 2)).toBe(576);
  });
});

describe('weekly Worklog performance', () => {
  it('caps capacity at 100 percent and exposes overtime separately', () => {
    expect(weeklyWorklogPerformance({ hours: 45 })).toEqual({ targetHours:40, capacityPercent: 100, overtimeHours: 5 });
    expect(weeklyWorklogPerformance({ hours: 20 })).toEqual({ targetHours:40, capacityPercent: 50, overtimeHours: 0 });
    expect(weeklyWorklogPerformance({ hours:30, username:'vinh' })).toEqual({ targetHours:30, capacityPercent:100, overtimeHours:0 });
    expect(weeklyWorklogPerformance({ hours:33, username:'VINH' })).toEqual({ targetHours:30, capacityPercent:100, overtimeHours:3 });
  });

  it('formats the Monday to Sunday range for the weekly selector', () => {
    expect(formatWorklogWeek('2026-08-17', '2026-08-23')).toBe('17/08 – 23/08');
  });

  it('shows distinct achieved OUT content for the selected member and week', () => {
    const base={userId:'phu-id',startedAt:'2026-08-18T01:00:00.000Z',status:'DONE',output:null,outputCriteria:[]} as unknown as Worklog;
    const logs=[
      {...base,id:'1',outputCriteria:[{id:'out-1',expected:'Board lên nguồn',actual:'2/2 board lên nguồn',achieved:true}]},
      {...base,id:'2',outputCriteria:[{id:'out-2',expected:'Board lên nguồn',actual:'2/2 board lên nguồn',achieved:true}]},
      {...base,id:'3',userId:'vinh-id',outputCriteria:[{id:'out-3',expected:'Không lấy',actual:null,achieved:true}]},
    ] as Worklog[];
    expect(weeklyAchievedOutputLabels(logs,'phu-id','2026-08-17','2026-08-23')).toEqual(['2/2 board lên nguồn']);
  });

  it('does not present legacy unrated Worklogs as zero performance', () => {
    expect(worklogConversionLabel({conversionPercent:0,productiveBasePoint:0,endedBasePoint:0})).toBe('—');
    expect(worklogCapitalLabel({capitalPoint:0,ended:2,endedBasePoint:0})).toBe('Chưa xếp mức');
    expect(worklogConversionLabel({conversionPercent:75,productiveBasePoint:300,endedBasePoint:100})).toBe('75%');
    expect(worklogCapitalLabel({capitalPoint:25,ended:1,endedBasePoint:100})).toBe('25');
  });

  it('turns weekly metrics into a short Dev self-review', () => {
    const member = {
      userId:'vinh-id',username:'vinh',displayName:'VINH',hours:33,point:860,confirmedPoint:0,provisionalPoint:860,backlog:0,open:0,done:8,ended:0,pendingPoint:0,pendingStability:8,pendingStabilityPoint:215,capitalPoint:0,productiveBasePoint:1075,endedBasePoint:0,conversionPercent:79.7,worklogs:8,basicWorklogs:4,devWorklogs:4,rndWorklogs:0,reopenWorklogs:1,linkedWorklogs:7,v2Worklogs:0,
    } satisfies WorklogSummary;
    const insight = weeklyWorklogInsight(member);
    expect(insight.summary).toBe('33/30h · 860 Point. Chưa có OUT checklist mới nên chưa đủ dữ liệu kết luận hiệu suất.');
    expect(insight.nextAction).toBe('1 Worklog RE-OPEN cần kiểm tra.');
    expect(insight.linkedPercent).toBe(88);
  });
});

describe('personal opening notice', () => {
  const taskNotification = (id:string,personalKind:'ASSIGNED'|'MENTION'|null,readAt:string|null=null) => ({
    kind:'TASK_EVENT',personalKind,id,taskId:`task-${id}`,commentId:null,eventType:'CREATED',topic:'Task',message:'đã giao',bodyPreview:'',actorName:'Admin',readAt,createdAt:'2026-08-18T00:00:00.000Z',
  }) as AppNotification;

  it('keeps only unread direct assignments and mentions', () => {
    const notifications = [
      taskNotification('assigned','ASSIGNED'),
      taskNotification('mention','MENTION'),
      taskNotification('general',null),
      taskNotification('read','ASSIGNED','2026-08-18T01:00:00.000Z'),
      {kind:'SYSTEM_EVENT',personalKind:null,id:'system',module:'PURCHASING',eventType:'UPDATED',entityType:'PURCHASE_REQUEST',entityId:'request',entityLabel:'Mua hàng',message:'đã cập nhật',bodyPreview:null,actorName:'Admin',readAt:null,createdAt:'2026-08-18T00:00:00.000Z'} as AppNotification,
      {kind:'SYSTEM_EVENT',personalKind:'MENTION',id:'worklog-mention',module:'WORKLOG',eventType:'WORKLOG_MENTION',entityType:'WORKLOG',entityId:'worklog',entityLabel:'Hàn board',message:'nhắc bạn trong Worklog',bodyPreview:'@VINH xem giúp',actorName:'PHÚ',readAt:null,createdAt:'2026-08-18T00:00:00.000Z'} as AppNotification,
    ];
    expect(personalUnreadNotifications(notifications).map((notification) => notification.id)).toEqual(['assigned','mention','worklog-mention']);
  });

  it('hides acknowledged popup items without changing the source notifications', () => {
    const notifications = [taskNotification('assigned','ASSIGNED'),taskNotification('mention','MENTION')];
    expect(pendingPersonalNoticeNotifications(notifications,['assigned']).map((notification) => notification.id)).toEqual(['mention']);
    expect(notifications.every((notification) => notification.readAt === null)).toBe(true);
  });
});

describe('Worklog status label', () => {
  it('shows ENDED as not completed without changing the API status', () => {
    expect(worklogStatusLabel('ENDED')).toBe('KHÔNG HOÀN THÀNH');
    expect(worklogStatusLabel('OPEN')).toBe('ĐANG LÀM');
    expect(worklogStatusLabel('DONE')).toBe('HOÀN THÀNH');
    expect(worklogStatusLabel('DONE', { achieved: 3, total: 5 })).toBe('HOÀN THÀNH (3/5)');
  });
});

describe('Inventory logger and location cleanup', () => {
  it('treats null, empty and whitespace-only locations as missing', () => {
    expect(inventoryItemMissingLocation({ location: null })).toBe(true);
    expect(inventoryItemMissingLocation({ location: '   ' })).toBe(true);
    expect(inventoryItemMissingLocation({ location: 'Khay A · Cột 2' })).toBe(false);
  });

  it('translates audit keys and removes duplicated purchase link fields', () => {
    expect(inventoryAuditDescription({
      name: { before: 'Cũ', after: 'Mới' },
      purchaseUrl: { before: null, after: 'https://example.com' },
      purchaseLinks: { before: [], after: ['https://example.com'] },
    })).toBe('Đã cập nhật tên vật tư, link mua');
  });
});

describe('Worklog Output links', () => {
  it('detects multiple web links and keeps surrounding text', () => {
    expect(worklogOutputParts('File https://drive.google.com/a và http://example.com/test.')).toEqual([
      { text: 'File ' },
      { text: 'https://drive.google.com/a', href: 'https://drive.google.com/a' },
      { text: ' và ' },
      { text: 'http://example.com/test', href: 'http://example.com/test' },
      { text: '.' },
    ]);
  });
});

describe('Worklog Task source search', () => {
  const tasks = [
    { id: 'scanbox', title: 'SCANBOX · Báo cáo chuyên sâu', note: 'Tự động mở popup phân tích', status: 'ACTIVE' },
    { id: 'keyscan', title: 'KEYSCAN · Kiểm tra RH850', note: 'Đọc lại giao tiếp sau khi back', status: 'ACTIVE' },
    { id: 'backlog', title: 'SCANBOX · Chờ làm', note: 'Task chưa bắt đầu', status: 'BACKLOG' },
    { id: 'done', title: 'KEYBOX · Chờ Admin Complete', note: 'Dev đã báo Done', status: 'DONE' },
    { id: 'complete', title: 'RH850 · Đã hoàn tất', note: null, status: 'COMPLETE' },
    { id: 'archived', title: 'KEYBOX · Đã archive', note: null, status: 'ARCHIVED' },
  ] as Task[];

  it('filters by a partial Title without casing or Vietnamese accents', () => {
    expect(filterWorklogSourceTasks(tasks, 'bao cao').map((task) => task.id)).toEqual(['scanbox']);
    expect(filterWorklogSourceTasks(tasks, 'rh850').map((task) => task.id)).toEqual(['keyscan']);
    expect(filterWorklogSourceTasks(tasks, 'popup phan tich').map((task) => task.id)).toEqual(['scanbox']);
  });

  it('lists Backlog, Active and Done but excludes Complete and Archived', () => {
    expect(filterWorklogSourceTasks(tasks, '').map((task) => task.id)).toEqual(['scanbox', 'keyscan', 'backlog']);
  });
});

describe('Warranty weekly listing', () => {
  it('uses a Monday to Sunday week', () => {
    expect(warrantyWeekStart('2026-08-19')).toBe('2026-08-17');
    expect(warrantyWeekStart('2026-08-23')).toBe('2026-08-17');
    expect(warrantyWeekStart('2026-08-24')).toBe('2026-08-24');
  });

  it('keeps a case in its received week after later status updates', () => {
    const cases = [
      { id: 'old', createdAt: '2026-08-18T02:00:00.000Z', updatedAt: '2026-08-26T02:00:00.000Z' },
      { id: 'next', createdAt: '2026-08-24T02:00:00.000Z', updatedAt: '2026-08-24T02:00:00.000Z' },
    ] as WarrantyCase[];
    expect(warrantyCasesForWeek(cases, '2026-08-17').map((row) => row.id)).toEqual(['old']);
  });
});

describe('Purchasing received columns', () => {
  const base = {
    requestedQty: '15.000',
    receivedQty: null,
    receivedAt: null,
    updatedAt: '2026-08-19T03:00:00.000Z',
  } as Pick<PurchaseRequest, 'status'|'requestedQty'|'receivedQty'|'receivedAt'|'updatedAt'>;

  it('keeps pending requests empty', () => {
    expect(purchaseReceivedQuantity({ ...base, status: 'ORDERED' })).toBeNull();
    expect(purchaseReceivedDate({ ...base, status: 'ORDERED' })).toBeNull();
  });

  it('shows legacy received requests using their requested quantity and last update date', () => {
    expect(purchaseReceivedQuantity({ ...base, status: 'RECEIVED' })).toBe('15.000');
    expect(purchaseReceivedDate({ ...base, status: 'RECEIVED' })).toBe(base.updatedAt);
  });

  it('prefers the actual received quantity and date', () => {
    const received = { ...base, status: 'RECEIVED' as const, receivedQty: '12.000', receivedAt: '2026-08-19T04:00:00.000Z' };
    expect(purchaseReceivedQuantity(received)).toBe('12.000');
    expect(purchaseReceivedDate(received)).toBe(received.receivedAt);
  });
});

describe('topic color', () => {
  it('keeps one fixed color for a product keyword regardless of the rest of the Topic', () => {
    expect(topicColor('ScanBox - lỗi treo K-Line')).toEqual(topicColor('SCANBOX · 9S12 timeout'));
    expect(topicColor('sản xuất - đóng máy')).toEqual(topicColor('SẢN XUẤT · Test cáp'));
  });
  it('uses distinct fixed colors for the six approved keyword groups', () => {
    const colors = ['KeyBox', 'KeyScan', 'EasyScan', 'ScanBox', 'Sản xuất', 'Bảo hành'].map(topicColor);
    expect(new Set(colors.map((color) => `${color.backgroundColor}:${color.color}`)).size).toBe(6);
  });
  it('keeps topics outside the approved groups neutral', () => {
    expect(topicColor('CHUNG')).toEqual({ backgroundColor: '#eef1f4', color: '#5f6368' });
    expect(topicColor('SCU 2025 Yamaha')).toEqual(topicColor('CHUNG'));
  });
});

describe('warranty product color', () => {
  it('uses blue for ScanBox, green for ScanPro and brand orange-yellow for EasyScan or EasyCan', () => {
    expect(warrantyProductColor('Máy ScanBox')).toEqual({ backgroundColor: '#dbeafe', color: '#1d4ed8' });
    expect(warrantyProductColor('Máy SCANPRO')).toEqual({ backgroundColor: '#dcfce7', color: '#15803d' });
    expect(warrantyProductColor('Máy EasyScan')).toEqual({ backgroundColor: '#fff0d6', color: '#b45309' });
    expect(warrantyProductColor('EASYCAN')).toEqual(warrantyProductColor('Máy EasyScan'));
  });
  it('keeps known product colors distinct and gives unknown products a stable color', () => {
    expect(warrantyProductColor('Máy EasyScan')).not.toEqual(warrantyProductColor('Máy ScanBox'));
    expect(warrantyProductColor('Cáp bơm')).toEqual(warrantyProductColor('Cáp bơm'));
    expect(warrantyProductColor('Cáp bơm')).not.toEqual({ backgroundColor: '#eef1f4', color: '#5f6368' });
  });
});

describe('Backlog assignee filter', () => {
  it('keeps all work when no member is selected', () => {
    expect(taskMatchesAssignee({ assigneeIds: [] }, '')).toBe(true);
  });
  it('matches Task and draft assignments, including multiple assignees', () => {
    expect(taskMatchesAssignee({ assigneeIds: ['thang', 'vinh'] }, 'vinh')).toBe(true);
    expect(taskMatchesAssignee({ assigneeIds: ['thang'] }, 'vinh')).toBe(false);
    expect(taskMatchesAssignee({ assignees: [{ userId: 'phu' }] } as Pick<Task, 'assignees'>, 'phu')).toBe(true);
  });
});

describe('view hash routing', () => {
  it('maps every stable hash back to its view', () => {
    for (const [view, hash] of Object.entries(VIEW_HASHES)) {
      expect(viewFromHash(hash)).toBe(view);
    }
  });

  it('falls back to trash for empty or unknown hashes', () => {
    expect(viewFromHash('')).toBe('worklogs');
    expect(viewFromHash('#/unknown')).toBe('worklogs');
  });

  it('keeps the old Trash URL compatible with the unified Task view', () => {
    expect(VIEW_HASHES.trash).toBe('#/task');
    expect(viewFromHash('#/thung-rac')).toBe('trash');
  });

  it('opens the unified Task view on ĐANG LÀM by default', () => {
    expect(taskStockFilterForView('trash')).toBe('active');
    expect(taskStockFilterForView('drafts')).toBe('backlog');
    expect(taskStockFilterForView('truck')).toBe('complete');
  });
});

describe('Done visibility', () => {
  const task={status:'ACTIVE',assignees:[{userId:'member-a'}]} as Task;
  it('allows the Assignee or Admin', () => {
    expect(canDoneTask(task,'member-a',false)).toBe(true);
    expect(canDoneTask(task,'member-b',true)).toBe(true);
  });
  it('rejects an unrelated Member and any Done task', () => {
    expect(canDoneTask(task,'member-b',false)).toBe(false);
    expect(canDoneTask({...task,status:'DONE'},'member-a',true)).toBe(false);
  });
});

describe('recent stock count filter', () => {
  const now = Date.parse('2026-08-09T12:00:00.000Z');

  it('includes physical counts from the last three days only', () => {
    expect(isRecentlyCounted('2026-08-07T12:00:00.000Z', now)).toBe(true);
    expect(isRecentlyCounted('2026-08-06T11:59:59.000Z', now)).toBe(false);
    expect(isRecentlyCounted(null, now)).toBe(false);
  });

  it('formats the age for the row tag', () => {
    expect(formatRecentCountTime('2026-08-09T10:00:00.000Z', now)).toBe('2 giờ trước');
    expect(formatRecentCountTime('2026-08-07T12:00:00.000Z', now)).toBe('2 ngày trước');
  });
});

describe('production settlement day color', () => {
  const session={isRegistered:true,hoursWorked:'4.00'};
  it('keeps valid sessions green until they enter settlement', () => {
    expect(productionDayState(session,1).className).toBe('reported');
  });
  it('shows requested sessions yellow and paid sessions gray', () => {
    expect(productionDayState(session,1,'REQUESTED').className).toBe('settlement');
    expect(productionDayState(session,1,'PAID').className).toBe('paid');
  });
});

describe('material picker search', () => {
  const material=(id:string,name:string,groupName:string,sku:string|null=null)=>({id,name,groupName,sku} as InventoryItem);
  const materials=[
    material('coil','Cuộn cảm 10uH, 3A','SCANBOX'),
    material('db15','DB15 đực trên board','CONNECTOR','DB15-M'),
  ];

  it('finds materials without requiring Vietnamese accents or exact casing', () => {
    expect(filterMaterialOptions(materials,'10UH').map((item)=>item.id)).toEqual(['coil']);
    expect(filterMaterialOptions(materials,'cuon cam').map((item)=>item.id)).toEqual(['coil']);
  });

  it('finds materials by group or SKU', () => {
    expect(filterMaterialOptions(materials,'scanbox').map((item)=>item.id)).toEqual(['coil']);
    expect(filterMaterialOptions(materials,'db15-m').map((item)=>item.id)).toEqual(['db15']);
  });
});

describe('material reverse finished-product structure', () => {
  const products=[
    {id:'board-easy',name:'Board mạch EasyScan',bom:[{itemId:'ss34',quantityPerProduct:'1.000'}]},
    {id:'board-scan',name:'Board mạch ScanBox',bom:[{itemId:'ss34',quantityPerProduct:'2.000'}]},
  ] as FinishedProduct[];

  it('lists every finished product using the material', () => {
    expect(finishedProductsForMaterial(products,'ss34')).toEqual([
      {productId:'board-easy',productName:'Board mạch EasyScan',quantityPerProduct:'1.000'},
      {productId:'board-scan',productName:'Board mạch ScanBox',quantityPerProduct:'2.000'},
    ]);
  });

  it('returns an empty list for an unassigned material', () => {
    expect(finishedProductsForMaterial(products,'unused')).toEqual([]);
  });
});

describe('finished-product category filter', () => {
  const products=[
    {id:'board',category:'PCB'},
    {id:'cable',category:'CABLE'},
    {id:'device',category:'DEVICE'},
  ] as FinishedProduct[];

  it('keeps all products for ALL and filters one exact category', () => {
    expect(finishedProductsForCategory(products,'ALL')).toHaveLength(3);
    expect(finishedProductsForCategory(products,'CABLE').map(product=>product.id)).toEqual(['cable']);
  });
});

describe('production daily report restore',()=>{
  const entries=[
    {id:'old',userId:'giang',workDate:'2026-08-14',workType:'Báo cáo tự do',rawText:'Làm cáp cũ'},
    {id:'today',userId:'giang',workDate:'2026-08-15',workType:'Báo cáo tự do',rawText:'Đóng 5 máy'},
  ] as ProductionEntry[];
  const lots=[
    {id:'lot-a',reports:[{id:'today'}]},
    {id:'lot-b',reports:[{id:'other'}]},
  ] as ProductionLot[];

  it('loads the existing free-text report for the selected member and day',()=>{
    expect(productionReportForDay(entries,'giang','2026-08-15')?.rawText).toBe('Đóng 5 máy');
    expect(productionReportForDay(entries,'nam','2026-08-15')).toBeNull();
  });

  it('restores every Lot linked to that report',()=>{
    expect(productionLotIdsForEntry(lots,'today')).toEqual(['lot-a']);
    expect(productionLotIdsForEntry(lots,null)).toEqual([]);
  });
});

describe('production Lot completion visibility',()=>{
  const lot={participants:[{id:'giang'},{id:'nam'}]} as ProductionLot;

  it('lets Admin or an Incharge member see the Complete action',()=>{
    expect(canCompleteProductionLot({id:'admin',role:'ADMIN'},lot)).toBe(true);
    expect(canCompleteProductionLot({id:'nam',role:'MEMBER'},lot)).toBe(true);
  });

  it('hides the Complete action from an unlinked member',()=>{
    expect(canCompleteProductionLot({id:'my',role:'MEMBER'},lot)).toBe(false);
  });
});

describe('production Lot delete visibility',()=>{
  it('allows only Admin to see the destructive action',()=>{
    expect(canDeleteProductionLot({role:'ADMIN'})).toBe(true);
    expect(canDeleteProductionLot({role:'MEMBER'})).toBe(false);
  });
});

describe('purchase material search', () => {
  it('matches material names without requiring accents or exact casing', () => {
    expect(purchaseMaterialMatches({name:'Cuộn cảm 10uH'},'CUON CAM')).toBe(true);
    expect(purchaseMaterialMatches({name:'Cuộn cảm 10uH'},'relay')).toBe(false);
  });

  it('keeps all rows visible for an empty query', () => {
    expect(purchaseMaterialMatches(undefined,'')).toBe(true);
  });
});

describe('global overdue purchase warning',()=>{
  const request=(id:string,createdAt:string,assignedBuyerId:string|null,status:PurchaseRequest['status']='REQUESTED')=>({id,createdAt,assignedBuyerId,status} as PurchaseRequest);
  const requests=[
    request('critical','2026-08-31T02:00:00.000Z','buyer'),
    request('warning','2026-09-01T02:00:00.000Z','buyer'),
    request('fresh','2026-09-02T02:00:00.000Z','buyer'),
    request('unassigned','2026-08-30T02:00:00.000Z',null),
    request('ordered','2026-08-25T02:00:00.000Z','buyer','ORDERED'),
  ];

  it('turns yellow at two days and red from three days',()=>{
    const result=overduePurchaseRequests(requests,{id:'admin',role:'ADMIN'},'2026-09-03');
    expect(result.map(item=>[item.request.id,item.ageDays,item.severity])).toEqual([
      ['unassigned',4,'critical'],['critical',3,'critical'],['warning',2,'warning'],
    ]);
  });

  it('shows members only requests assigned to them',()=>{
    expect(overduePurchaseRequests(requests,{id:'buyer',role:'MEMBER'},'2026-09-03').map(item=>item.request.id)).toEqual(['critical','warning']);
    expect(overduePurchaseRequests(requests,{id:'other',role:'MEMBER'},'2026-09-03')).toEqual([]);
  });
});
describe('multiple Worklog sources',()=>{
  it('keeps primary first and preserves every existing relation without duplicates',()=>{
    expect(worklogSourceIds('b',[{id:'a'},{id:'b'}])).toEqual(['b','a']);
    expect(worklogSourceIds(null,[])).toEqual([]);
  });
  it('adds without replacing, ignores duplicates and caps selection at ten',()=>{
    expect(addWorklogSource(['a'],'b')).toEqual(['a','b']);
    expect(addWorklogSource(['a'],'a')).toEqual(['a']);
    expect(addWorklogSource(['a'],'')).toEqual(['a']);
    const ids=Array.from({length:10},(_,i)=>String(i));
    expect(addWorklogSource(ids,'extra')).toEqual(ids);
  });
  it('promotes next remaining source and does not restore removed links',()=>{
    const ids=worklogSourceIds('a',[{id:'a'},{id:'b'},{id:'c'}]).filter(id=>id!=='a');
    expect(ids).toEqual(['b','c']);
    expect(worklogSourceIds(ids[0],ids.map(id=>({id})))).toEqual(['b','c']);
  });
  it('filters by secondary links as well as primary without double counting',()=>{
    const log={primaryTaskId:'a',tasks:[{id:'a'},{id:'b'}]};
    expect(worklogMatchesSource(log,'b')).toBe(true);
    expect(worklogMatchesSource(log,'a')).toBe(true);
    expect(worklogMatchesSource(log,'')).toBe(true);
    expect(worklogMatchesSource(log,'c')).toBe(false);
  });
});

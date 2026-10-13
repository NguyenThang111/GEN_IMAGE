export type PerformancePerson={id:string;username:string;displayName:string};
export type PerformanceRow={
  userId:string;displayName:string;point:number;calendarHours:number;carryInHours:number;totalHours:number;reworkHours:number;standardHours:number;firstPassPercent:number|null;
  contribution:number|null;efficiency:number|null;quality:number|null;score:number|null;issues:string[];dataIssues:string[];fingerprint:string;verifiedAt:string|null;
  eligible:boolean;proposedBonus:number|null;rank:number|null;
};
export type PerformancePeriodInput={month:string;effectiveDate:string;targetPoint:number;memberIds:string[]};
export type PerformancePlanInput={taskId:string;point:number;standardHours:number;shares:{userId:string;percent:number}[]};
export type PerformanceReport={
  month:string;monthClosed:boolean;comparisonReady:boolean;tied:boolean;
  period:(PerformancePeriodInput&{createdAt:string;createdById:string})|null;
  members:PerformanceRow[];candidates:PerformancePerson[];
  availableTasks:{id:string;title:string;assigneeIds:string[]}[];
  plans:(Omit<PerformancePlanInput,'standardHours'>&{standardHours:string;title:string;createdAt:string;firstCompletedAt:string|null})[];
  failures:{id:string;taskId:string;title:string;reason:string;reviewedAt:string;reviewer:string;userIds:string[];assignees:string[];assignmentHistorical:boolean;status:string|null;resolved:boolean;planned:boolean}[];
};

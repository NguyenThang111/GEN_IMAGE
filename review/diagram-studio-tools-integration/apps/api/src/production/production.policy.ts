export type PaymentSession = { id:string; workDate:string; hoursWorked:string|null };

export function missingRegistrationTime(session:{workDate:string;isRegistered:boolean;plannedStartTime?:string|null},alreadySettled=false){
  return !alreadySettled&&session.isRegistered&&session.workDate>='2026-09-14'&&!session.plannedStartTime;
}

export function nextPaymentBatch(sessions:PaymentSession[],consumedIds:Set<string>){
  const remaining=sessions
    .filter(session=>!consumedIds.has(session.id))
    .sort((a,b)=>a.workDate.localeCompare(b.workDate));
  return remaining.length>=4?remaining.slice(0,3):[];
}

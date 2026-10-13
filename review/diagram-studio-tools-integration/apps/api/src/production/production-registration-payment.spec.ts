import { missingRegistrationTime } from './production.policy';
import { ProductionService } from './production.service';
import { UserRole } from '../users/user.entity';

describe('Registration time payment cutoff',()=>{
  const session=(id:string,date:string,time:string|null=null)=>({id,userId:'u',workDate:date,isRegistered:true,plannedStartTime:time,hoursWorked:'4.00'});
  it('gates from 14/09 only, and exempts already settled sessions',()=>{
    expect(missingRegistrationTime(session('1','2026-09-13'))).toBe(false);
    expect(missingRegistrationTime(session('1','2026-09-14'))).toBe(true);
    expect(missingRegistrationTime(session('1','2026-09-14','08:00'))).toBe(false);
    expect(missingRegistrationTime(session('1','2026-09-14'),true)).toBe(false);
    expect(missingRegistrationTime({...session('1','2026-09-14'),isRegistered:false})).toBe(false);
  });
  function setup(rows:ReturnType<typeof session>[],payments:any[]=[]){
    const entries=rows.map(row=>({userId:'u',workDate:row.workDate,rawText:'Hàn mạch',workType:'Báo cáo theo Worklog',quantity:null}));
    const repos={sessions:{find:jest.fn().mockResolvedValue(rows)},entries:{find:jest.fn().mockResolvedValue(entries)},payments:{find:jest.fn().mockResolvedValue(payments),create:jest.fn(v=>v),save:jest.fn(async v=>v)}};
    const service=Object.create(ProductionService.prototype) as ProductionService;Object.assign(service,{...repos,createPaymentNotifications:jest.fn()});return {service,repos};
  }
  it('does not use missing-time days to reach the fourth-day batch threshold',async()=>{
    const rows=[session('a','2026-09-13'),session('b','2026-09-14'),session('c','2026-09-15','08:00'),session('d','2026-09-16','08:00')];const {service,repos}=setup(rows);
    expect(await (service as any).ensurePaymentRequest('u')).toBeNull();expect(repos.payments.save).not.toHaveBeenCalled();
    rows[1].plannedStartTime='09:00';await (service as any).ensurePaymentRequest('u');
    expect(repos.payments.save).toHaveBeenCalledWith(expect.objectContaining({sessionIds:['a','b','c'],totalHours:'12.00'}));expect(rows[1].hoursWorked).toBe('4.00');
  });
  it('preserves REQUESTED/PAID batches and their displayed hours; warns only unsettled days',async()=>{
    const rows=[session('paid','2026-09-14'),session('requested','2026-09-15'),session('missing','2026-09-16')];
    const payments=[{sessionIds:['paid'],status:'PAID',totalHours:'4.00'},{sessionIds:['requested'],status:'REQUESTED',totalHours:'4.00'}];const {service,repos}=setup(rows,payments);
    const result=await service.overview('2026-09-14','2026-09-20',{id:'u',username:'phongbk',displayName:'PHONG BK',role:UserRole.MEMBER});
    expect(result.sessions.map(s=>s.registrationTimeMissing)).toEqual([false,false,true]);expect(result.summary[0].hours).toBe(8);expect(result.sessions[2].hoursWorked).toBe('4.00');
    expect(result.paymentRequests).toEqual(payments);expect(repos.payments.save).not.toHaveBeenCalled();
  });
});

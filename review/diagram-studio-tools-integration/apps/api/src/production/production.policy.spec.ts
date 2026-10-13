import { nextPaymentBatch } from './production.policy';

const session=(id:string,day:number)=>({id,workDate:`2026-07-${String(day).padStart(2,'0')}`,hoursWorked:'4.00'});

describe('production payment batching',()=>{
  it('waits until the fourth valid session then closes the first three',()=>{
    expect(nextPaymentBatch([session('1',1),session('2',2),session('3',3)],new Set())).toHaveLength(0);
    expect(nextPaymentBatch([session('1',1),session('2',2),session('3',3),session('4',4)],new Set()).map(row=>row.id)).toEqual(['1','2','3']);
  });
  it('uses the fourth session as the start of the next batch',()=>{
    const rows=Array.from({length:7},(_,index)=>session(String(index+1),index+1));
    expect(nextPaymentBatch(rows,new Set(['1','2','3'])).map(row=>row.id)).toEqual(['4','5','6']);
  });
});

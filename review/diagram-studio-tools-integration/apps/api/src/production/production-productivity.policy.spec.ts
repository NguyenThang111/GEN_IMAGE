import { evaluateProductivity, ProductivityObservation } from './production-productivity.policy';

const lot={id:'lot-a',outputType:'FINISHED_PRODUCT',outputId:'product-a',outputLabel:'Cáp A'};
const observation=(entryId:string,workDate:string,hours:number,quantity=10,overrides:Partial<ProductivityObservation>={}):ProductivityObservation=>({entryId,userId:'user-a',workDate,hours,items:[{lotId:lot.id,stage:'ASSEMBLE',quantity,result:'PASSED'}],...overrides});
const history=Array.from({length:5},(_,index)=>observation(`old-${index}`,`2026-08-0${index+1}`,2));

describe('evaluateProductivity',()=>{
  it('requires five prior clean samples',()=>expect(evaluateProductivity([...history.slice(0,4),observation('now','2026-08-10',3)],[lot],'2026-08-10','2026-08-10')[0].status).toBe('INSUFFICIENT_DATA'));
  it('does not warn at exactly twenty percent',()=>expect(evaluateProductivity([...history,observation('now','2026-08-10',2.4)],[lot],'2026-08-10','2026-08-10')).toEqual([]));
  it('warns when hours are more than twenty percent above history',()=>expect(evaluateProductivity([...history,observation('now','2026-08-10',3)],[lot],'2026-08-10','2026-08-10')[0]).toMatchObject({status:'WARNING',direction:'SLOWER',expectedHours:2,deviationPercent:50}));
  it('warns when hours are more than twenty percent below history',()=>expect(evaluateProductivity([...history,observation('now','2026-08-10',1)],[lot],'2026-08-10','2026-08-10')[0]).toMatchObject({status:'WARNING',direction:'FASTER',expectedHours:2,deviationPercent:-50}));
  it('uses median so one outlier does not move the baseline',()=>{const rows=[...history,observation('outlier','2026-08-06',.1),observation('now','2026-08-10',3)];expect(evaluateProductivity(rows,[lot],'2026-08-10','2026-08-10')[0]).toMatchObject({expectedHours:2});});
  it('sums expected hours for multiple items',()=>{const lotB={...lot,id:'lot-b',outputId:'product-b',outputLabel:'Cáp B'};const oldB=Array.from({length:5},(_,index)=>observation(`b-${index}`,`2026-08-0${index+1}`,1,10,{items:[{lotId:lotB.id,stage:'ASSEMBLE',quantity:10,result:'PASSED'}]}));const current=observation('now','2026-08-10',4,10,{items:[{lotId:lot.id,stage:'ASSEMBLE',quantity:10,result:'PASSED'},{lotId:lotB.id,stage:'ASSEMBLE',quantity:10,result:'PASSED'}]});expect(evaluateProductivity([...history,...oldB,current],[lot,lotB],'2026-08-10','2026-08-10')[0]).toMatchObject({expectedHours:3,deviationPercent:33.3});});
});

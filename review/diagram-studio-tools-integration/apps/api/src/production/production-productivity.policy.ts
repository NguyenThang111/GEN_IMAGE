import { ProductionReportItem } from './production-entry.entity';

export type ProductivityLot={id:string;outputType:string;outputId:string;outputLabel:string};
export type ProductivityObservation={entryId:string;userId:string;workDate:string;hours:number;items:ProductionReportItem[]};
export type ProductivityWarning={
  entryId:string;
  userId:string;
  workDate:string;
  status:'WARNING'|'INSUFFICIENT_DATA';
  actualHours:number;
  expectedHours:number|null;
  deviationPercent:number|null;
  direction:'FASTER'|'SLOWER'|null;
  sampleCount:number;
  message:string;
};

const MIN_SAMPLES=5;
const MAX_SAMPLES=20;
const WARNING_THRESHOLD=.2;

function median(values:number[]){
  const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

function itemKey(item:ProductionReportItem,lots:Map<string,ProductivityLot>){
  const lot=lots.get(item.lotId);return lot?`${lot.outputType}:${lot.outputId}:${item.stage}`:null;
}

export function evaluateProductivity(observations:ProductivityObservation[],lotRows:ProductivityLot[],from:string,to:string):ProductivityWarning[]{
  const lots=new Map(lotRows.map(lot=>[lot.id,lot]));
  const ordered=[...observations].sort((a,b)=>a.workDate.localeCompare(b.workDate)||a.entryId.localeCompare(b.entryId));
  const history=new Map<string,{date:string;rate:number}[]>();const results:ProductivityWarning[]=[];
  for(const observation of ordered){
    const passed=observation.items.filter(item=>item.result==='PASSED'&&item.quantity>0);
    if(observation.workDate>=from&&observation.workDate<=to&&passed.length){
      const baselines=passed.map(item=>{
        const key=itemKey(item,lots);const samples=key?(history.get(`${observation.userId}:${key}`)??[]).filter(sample=>sample.date<observation.workDate).slice(-MAX_SAMPLES):[];
        return {item,samples,rate:samples.length>=MIN_SAMPLES?median(samples.map(sample=>sample.rate)):null};
      });
      const sampleCount=baselines.length?Math.min(...baselines.map(row=>row.samples.length)):0;
      if(observation.items.length!==passed.length||baselines.some(row=>row.rate===null)||observation.hours<=0){
        results.push({entryId:observation.entryId,userId:observation.userId,workDate:observation.workDate,status:'INSUFFICIENT_DATA',actualHours:observation.hours,expectedHours:null,deviationPercent:null,direction:null,sampleCount,message:'Chưa đủ dữ liệu sạch để so sánh năng suất.'});
      }else{
        const expectedHours=baselines.reduce((sum,row)=>sum+row.item.quantity/(row.rate as number),0);
        const deviation=(observation.hours-expectedHours)/expectedHours;
        if(Math.abs(deviation)>WARNING_THRESHOLD){
          const direction=deviation>0?'SLOWER':'FASTER';
          results.push({entryId:observation.entryId,userId:observation.userId,workDate:observation.workDate,status:'WARNING',actualHours:observation.hours,expectedHours:Number(expectedHours.toFixed(2)),deviationPercent:Number((deviation*100).toFixed(1)),direction,sampleCount,message:direction==='SLOWER'?'Tổng H cao hơn lịch sử. Kiểm tra phát sinh, số lượng hoặc giờ đã nhập.':'Tổng H thấp hơn lịch sử. Kiểm tra lại số lượng hoặc giờ đã nhập.'});
        }
      }
    }
    if(observation.items.length===1&&passed.length===1&&observation.hours>0){
      const key=itemKey(passed[0],lots);if(key){const historyKey=`${observation.userId}:${key}`;const samples=history.get(historyKey)??[];samples.push({date:observation.workDate,rate:passed[0].quantity/observation.hours});history.set(historyKey,samples.slice(-MAX_SAMPLES));}
    }
  }
  return results;
}

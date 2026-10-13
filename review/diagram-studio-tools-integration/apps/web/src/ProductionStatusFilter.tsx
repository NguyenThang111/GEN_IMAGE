import type {ProductionLot} from './api';

export const productionStatusFilters=[
  {id:'IN_PROGRESS',label:'Đang làm'},
  {id:'WAITING_TEST',label:'Chờ Test'},
  {id:'TESTING',label:'Đang Test'},
  {id:'DONE',label:'Hoàn thành'},
  {id:'ALL',label:'Tất cả'},
] as const;
export type ProductionStatusFilterId=typeof productionStatusFilters[number]['id'];
export function filterProductionLots<T extends Pick<ProductionLot,'status'>>(lots:T[],filter:ProductionStatusFilterId):T[]{
  return lots.filter(lot=>filter==='ALL'||lot.status===filter||(filter==='IN_PROGRESS'&&lot.status==='NEW'));
}
export function ProductionStatusFilter({lots,value,onChange}:{lots:ProductionLot[];value:ProductionStatusFilterId;onChange:(value:ProductionStatusFilterId)=>void}){
  return <div className="productionStatusFilters" role="group" aria-label="Lọc trạng thái Worklog">{productionStatusFilters.map(filter=><button type="button" key={filter.id} aria-pressed={value===filter.id} onClick={()=>onChange(filter.id)} title={filter.id==='IN_PROGRESS'?'Gồm lô chờ nhận và đang làm':undefined}>{filter.label}<span>{filterProductionLots(lots,filter.id).length}</span></button>)}</div>;
}

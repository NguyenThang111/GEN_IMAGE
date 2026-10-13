import {useState, type FormEvent} from 'react';
import type {FinishedProduct, ProductionLotActionType, SellableProduct} from './api';

export type ProductionWorklogGroup='CABLE'|'SOLDER';
export type ProductionWorklogInput={actionType:ProductionLotActionType;outputType:'FINISHED_PRODUCT'|'SELLABLE_PRODUCT';outputId:string;targetQuantity:number};

export function productionWorklogOutputs(group:ProductionWorklogGroup,finished:FinishedProduct[],sellable:SellableProduct[]){
  const products=finished.filter(item=>item.isActive&&item.productionReady&&(group==='SOLDER'?item.category==='PCB':item.isProductionOutput&&item.category!=='PCB'));
  return [
    ...products.map(item=>({value:`F:${item.id}`,label:item.name,outputType:'FINISHED_PRODUCT' as const,outputId:item.id})),
    ...(group==='SOLDER'?[]:sellable.filter(item=>item.isActive).map(item=>({value:`S:${item.id}`,label:item.name,outputType:'SELLABLE_PRODUCT' as const,outputId:item.id}))),
  ];
}

export function ProductionWorklogTag({actionType}:{actionType:ProductionLotActionType}){
  const solder=actionType==='SOLDER';
  return <span className={`productionWorklogTag ${solder?'solder':'cable'}`}>{solder?'HÀN MẠCH':'LÀM CÁP / BỌC MÁY'}</span>;
}

export function ProductionLotCreatedDate({createdAt}:{createdAt:string}){
  const date=new Date(createdAt);
  const valid=!Number.isNaN(date.getTime());
  return <div className="productionLotCreatedDate"><span className="productionLotCreatedLabel">Ngày tạo: </span>{valid?<time dateTime={createdAt}>{date.toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'})}</time>:<span>—</span>}</div>;
}

export function ProductionWorklogForm({finishedProducts,sellableProducts,busy,error,onCreate,onClose}:{finishedProducts:FinishedProduct[];sellableProducts:SellableProduct[];busy:boolean;error:string;onCreate:(input:ProductionWorklogInput)=>Promise<void>;onClose:()=>void}){
  const [group,setGroup]=useState<ProductionWorklogGroup>('CABLE');
  const [output,setOutput]=useState('');
  const options=productionWorklogOutputs(group,finishedProducts,sellableProducts);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const selected=options.find(item=>item.value===output);
    const targetQuantity=Number(new FormData(event.currentTarget).get('quantity'));
    if(busy||!selected||!Number.isInteger(targetQuantity)||targetQuantity<1)return;
    await onCreate({actionType:group==='SOLDER'?'SOLDER':selected.outputType==='SELLABLE_PRODUCT'?'PACK':'ASSEMBLE',outputType:selected.outputType,outputId:selected.outputId,targetQuantity});
  }
  return <div className="modalBackdrop"><form className="productionModal compact productionCreateWorklog" role="dialog" aria-modal="true" aria-labelledby="production-create-title" onSubmit={event=>void submit(event)}>
    <div className="productionModalHead"><div><h2 id="production-create-title">Tạo Worklog Sản xuất</h2><p>Chọn nhóm việc, thành phẩm và số lượng.</p></div><button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}>×</button></div>
    <label>Nhóm công việc<select value={group} disabled={busy} onChange={event=>{setGroup(event.target.value as ProductionWorklogGroup);setOutput('');}}><option value="CABLE">Làm cáp / bọc máy</option><option value="SOLDER">Hàn mạch</option></select></label>
    <div className="productionWorklogGroupHint"><ProductionWorklogTag actionType={group==='SOLDER'?'SOLDER':'ASSEMBLE'}/><small>Mã {group==='SOLDER'?'HM':'SX'}-… · Đang làm → Chờ Test → Hoàn thành</small></div>
    <label>{group==='SOLDER'?'Board thành phẩm cần hàn':'Thành phẩm / sản phẩm'}<select value={output} disabled={busy} onChange={event=>setOutput(event.target.value)} required><option value="">{group==='SOLDER'?'Chọn board mạch...':'Chọn thành phẩm / sản phẩm...'}</option>{(['FINISHED_PRODUCT','SELLABLE_PRODUCT'] as const).map(kind=>{const items=options.filter(item=>item.outputType===kind);return items.length?<optgroup key={kind} label={kind==='FINISHED_PRODUCT'?(group==='SOLDER'?'BOARD MẠCH':'THÀNH PHẨM'):'SẢN PHẨM'}>{items.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</optgroup>:null;})}</select></label>
    {!options.length&&<p className="formHint" role="status">{group==='SOLDER'?'Chưa có board PCB sẵn sàng. Nhờ Admin kiểm tra nhóm và cấu hình thành phẩm trong Kho.':'Chưa có thành phẩm / sản phẩm sẵn sàng.'}</p>}
    <label>Số lượng mục tiêu<input name="quantity" type="number" min="1" step="1" required disabled={busy}/></label>
    {group==='SOLDER'&&<p className="formHint">Chỉ chọn board và số lượng. Sau khi Test đạt, hệ thống nhập kho theo cấu thành đã có.</p>}
    {error&&<p className="productionTestError" role="alert">{error}</p>}
    <div className="formActions"><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="primary" disabled={busy||!output}>Tạo Worklog</button></div>
  </form></div>;
}

import type {PurchaseRequest} from './api';

export function MaterialPurchaseState({itemId,unit,requests}:{itemId:string;unit:string;requests:PurchaseRequest[]}){
  const active=requests.filter(request=>request.itemId===itemId&&(request.status==='REQUESTED'||request.status==='ORDERED'));
  const ordered=active.filter(request=>request.status==='ORDERED');
  const waiting=active.filter(request=>request.status==='REQUESTED');
  const quantity=(rows:PurchaseRequest[])=>rows.reduce((sum,row)=>sum+Number(row.requestedQty),0).toLocaleString('vi-VN');
  return <section className="materialPurchaseState" aria-label="Tình trạng mua vật tư">
    <header><b>MUA HÀNG</b><div>
      {!!ordered.length&&<span className="stockSignal ordered">ĐANG MUA · {quantity(ordered)} {unit}</span>}
      {!!waiting.length&&<span className="stockSignal count">CHỜ MUA · {quantity(waiting)} {unit}</span>}
    </div></header>
    {!active.length?<p>Không có yêu cầu mua đang mở.</p>:<>
      <p>Chờ mua: đã lên yêu cầu. Đang mua: đã đặt hàng, chưa nhận vào Kho.</p>
      <ul>{active.map(request=>{
        const orderUrl=request.orderUrl&&/^https?:\/\//i.test(request.orderUrl)?request.orderUrl:null;
        return <li key={request.id}>
          <span><b>{request.status==='ORDERED'?'Đang mua':'Chờ mua'} · {Number(request.requestedQty).toLocaleString('vi-VN')} {unit}</b><small>{request.orderCode||'Chưa có mã đơn'}</small></span>
          {orderUrl?<a href={orderUrl} target="_blank" rel="noreferrer">Mở đơn ↗</a>:<small>Chưa có link đơn</small>}
        </li>;
      })}</ul>
    </>}
  </section>;
}

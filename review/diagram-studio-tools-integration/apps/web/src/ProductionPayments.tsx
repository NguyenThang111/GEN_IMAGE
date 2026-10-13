import { useRef, useState } from 'react';
import type { ProductionPaymentRequest, User } from './api';
import './production-payments.css';
import { AvatarContent } from './MemberAvatars';

type Props = {
  payments: ProductionPaymentRequest[];
  currentUser: User;
  name: (id: string) => string;
  color: (id: string, name: string) => string;
  onPay: (id: string) => Promise<unknown>;
  busy: boolean;
  error: string;
};

export function ProductionPayments({ payments, currentUser, name, color, onPay, busy, error }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const rows = payments.filter(row => currentUser.role === 'ADMIN' || row.userId === currentUser.id)
    .sort((a, b) => Math.max(0, ...b.workSummary.map(item => Date.parse(item.date))) - Math.max(0, ...a.workSummary.map(item => Date.parse(item.date))));
  const dates = (row: ProductionPaymentRequest) => row.workSummary.map(item => new Date(`${item.date}T00:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })).join(' · ');
  const hours = (row: ProductionPaymentRequest) => `${Number(row.totalHours).toLocaleString('vi-VN')}h`;
  const state = (row: ProductionPaymentRequest) => <span className={`paymentBriefState ${row.status.toLowerCase()}`}>{row.status === 'PAID' ? 'Đã thanh toán' : 'Chờ thanh toán'}</span>;
  const identity = (row: ProductionPaymentRequest) => <span className="paymentBriefPerson"><span className="avatar" style={{ backgroundColor: color(row.userId, name(row.userId)) }}><AvatarContent userId={row.userId} name={name(row.userId)}/></span><span><b>{name(row.userId)}</b><small>{dates(row)}</small></span></span>;
  function open(id: string | null) { setSelected(id); dialog.current?.showModal(); }
  return <section className="productionSectionCard compactPayments paymentBrief">
    <div className="productionSectionTitle"><div><h2>CÔNG THANH TOÁN</h2><p>Hai lần kết công gần nhất · {rows.filter(row => row.status === 'REQUESTED').length} chờ thanh toán</p></div><button type="button" onClick={() => open(null)}>Xem tất cả</button></div>
    {rows.slice(0, 2).map(row => <button type="button" className="paymentBriefRow" key={row.id} onClick={() => open(row.id)} aria-label={`Xem kết công ${name(row.userId)} · ${dates(row)}`}>
      {identity(row)}<span className="paymentBriefTotals"><strong>{hours(row)}</strong>{state(row)}</span>
    </button>)}
    {!rows.length && <p className="emptyPayment">Chưa có lần kết công nào.</p>}
    <dialog ref={dialog} className="paymentHistoryDialog" aria-labelledby="payment-history-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="paymentHistoryContent">
        <header className="paymentHistoryHead"><div><h2 id="payment-history-title">{selected ? 'Chi tiết kết công' : 'Lịch sử công thanh toán'}</h2><p>{rows.length} lần kết công</p></div><button type="button" aria-label="Đóng lịch sử thanh toán" onClick={() => dialog.current?.close()}>×</button></header>
        {selected && <button className="paymentHistoryAll" type="button" onClick={() => setSelected(null)}>← Xem tất cả lịch sử</button>}
        {error && <p role="alert">{error}</p>}
        <div className="paymentHistoryList">
          {rows.filter(row => !selected || row.id === selected).map(row => <div className="paymentHistoryCard" key={row.id}>
            <div className="paymentHistoryCardHead">{identity(row)}<span className="paymentBriefTotals"><strong>{hours(row)}</strong>{state(row)}</span></div>
            <div className="paymentHistoryWork">{row.workSummary.map(item => <div key={item.date}><time>{new Date(`${item.date}T00:00:00`).toLocaleDateString('vi-VN')}</time><p>{item.outputs.length ? item.outputs.map(output => `${output.quantity !== null ? `${output.quantity.toLocaleString('vi-VN')} ` : ''}${output.label}`).join(' · ') : 'Chưa ghi việc'}</p></div>)}</div>
            {row.status === 'REQUESTED' && currentUser.role === 'ADMIN' && <button type="button" className="primary" disabled={busy} onClick={() => void onPay(row.id)}>{busy ? 'Đang lưu…' : 'Xác nhận đã thanh toán'}</button>}
            {row.paidAt && <small>Đã thanh toán lúc {new Date(row.paidAt).toLocaleString('vi-VN')}</small>}
          </div>)}
          {!rows.length && <p>Chưa có lần kết công nào.</p>}
        </div>
      </div>
    </dialog>
  </section>;
}

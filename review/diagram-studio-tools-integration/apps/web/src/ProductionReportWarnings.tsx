import type { ProductionOverview } from './api';

export function ProductionReportWarnings({ admin, warnings, name, onOpen }: {
  admin: boolean;
  warnings: ProductionOverview['productivityWarnings'];
  name: (id: string) => string;
  onOpen: (userId: string, date: string) => void;
}) {
  const visible = warnings.filter(item => item.status === 'WARNING');
  if (!admin || !visible.length) return null;
  return <details className="productionReportWarnings">
    <summary>Kiểm tra báo công <b>{visible.length}</b><span>Lệch giờ so với lịch sử</span></summary>
    <div className="productionReportWarningsBody">
      <p>Chỉ hỗ trợ kiểm tra giờ đã nhập; không kết luận Task không đạt hay đánh giá thành viên.</p>
      {visible.map(item => <article key={item.entryId}>
        <div><b>{name(item.userId)} · {item.workDate.split('-').reverse().join('/')}</b><span>{item.actualHours}h thực tế / {item.expectedHours}h theo lịch sử · {Number(item.deviationPercent) > 0 ? '+' : ''}{item.deviationPercent}%</span><small>{item.message}</small></div>
        <button type="button" onClick={() => onOpen(item.userId, item.workDate)}>Xem báo công</button>
      </article>)}
    </div>
  </details>;
}

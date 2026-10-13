# Bản sửa đang kiểm tra — Air Blade 2011–2012

Mở [báo cáo đối chiếu mới](../../review/verified-check/index.html). Mỗi mạch có JSON và ảnh PNG trong `preview/`.

Đã sửa các lỗi xác minh được: đầu chân ắc quy trong mạch đánh lửa và PGM-FI; vẽ lại ắc quy/relay bằng mẫu có chân định danh để nối nét đúng tọa độ; bố trí lại chữ chạm khung ECM, biểu tượng che chữ `(12)`, khung và câu ghi chú đọc mã lỗi. `corrections.json` liệt kê thay đổi từng mạch.

**Đây vẫn là bản nháp.** Đã đối chiếu mạng nối dây theo 10 ảnh nhưng chưa chép đủ mọi chữ/ký hiệu làm đáp án kiểm tra, chưa xác minh hết hình chi tiết đèn, cảm biến, giắc và mô tơ, chưa thử bản xuất thực tế trên website. Báo cáo `NEEDS_REVIEW` không có nghĩa là đã chuẩn toàn bộ.

Giữ nguyên `id`, `vehicleId`, `vehicleTitle` và `schemaVersion` của bộ trước; `vehicleTitle` là `thang`. Khi nạp vào app, renderer cần hỗ trợ lớp `drawing`. Website chỉ vẽ từ `components/wires` có thể vẫn cho hình khác với PNG ở đây.

Mẫu mới có trong `verified-symbols.json` và mã dựng `tools/diagram_check/symbols.py`. Các chân được gọi bằng âm/dương hoặc tiếp điểm/cuộn dây; thứ tự mảng chân không quyết định cực.

Hướng dẫn đầy đủ và cách đưa PNG xuất từ website vào kiểm tra: [README công cụ](../../tools/diagram_check/README.md).

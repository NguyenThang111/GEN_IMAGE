# LEAD 125 2024-2025 (CBS-LED)

12 JSON chép theo 12 ảnh được cung cấp, không thêm mạch ABS. Đây là bộ mới với vehicleId=lead-125-2024-2025-cbs-led. Nạp cùng ảnh GỐC tương ứng trong source/. Mạch 11 và 12 xoay 90 độ theo sourceTransform, không thay ảnh gốc bằng ảnh đã xoay.

SchemaVersion=1, drawing.version=1; component.type tương thích 24 loại Studio gốc. Chữ được giữ trong drawing, component.textLayout, wire.labels và annotations. Khung ghi chú căn giữa tiêu đề, căn trái nội dung, padding 10 px. preview chứa PNG 2x, SVG và ảnh nguồn xoay để đối chiếu.

Ảnh PGM-FI 12 có SHA-256 trùng tuyệt đối ảnh 12 PGM-FI của bộ AIR BLADE trước: tái sử dụng bản chép đúng ảnh, đổi nhận diện sang bộ LEAD. Không lấy pin/màu dây của mạch chi tiết để tự sửa ảnh tổng. Khác biệt VS, TP/ECT, đồng hồ, Smartkey và đánh lửa được ghi trong sourceDiscrepancies. Ảnh 08 ghi cầu chì IGN,INJ; các ảnh khác ghi IGN,C&L: giữ đúng từng ảnh. Mã V ở CKP là màu tím của ảnh gốc, không đổi thành Bu.

Mở review.html để so sánh. NEEDS_REVIEW/draft: kiểm tra cấu trúc và bảo toàn chữ không phải phê duyệt điện. Chưa cập nhật website hoặc thử giao diện trình duyệt. Khi sửa circuit đang tồn tại, phải giữ đúng các trường nhận diện và sourceCrop của circuit đó.

Dựng lại: python -X utf8 tools/build_lead_125_2024_2025.py

## Kết quả kiểm tra

12/12 JSON qua schema và quality.canExport của Studio; 24 luồng dựng giữ đủ 838 mục chữ. review.html hiển thị SVG .web.svg do DiagramPreview của Studio xuất.

Đã đối chiếu chọn lọc 142 nhãn chân, 41 trị số cầu chì, 49 mã màu dây và 50 mạng dây. Bảng mốc và kết quả nằm trong source-reference.json, source-reference-checks.json. Không chứng nhận toàn bộ nội dung điện.

Đã kiểm tra SVG không trống bằng MuPDF, liên kết review, nhận diện xe, nguồn SHA-256, ZIP CRC và từng JSON đóng gói. Chưa kiểm thử import bằng giao diện vì Browser không khả dụng. Các cảnh báo và khác biệt nguồn giữ trong web-tool-checks.json và review-report.json.

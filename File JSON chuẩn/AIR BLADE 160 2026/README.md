# AIR BLADE 160 2026

13 mạch chính, gồm ABS (12) và PGM-FI (13). Thư mục alternate chứa 1 bản PGM-FI chép riêng theo ảnh nguồn 12; không gộp chân/mạng điện giữa hai ảnh.

JSON schemaVersion=1, drawing.version=1, vehicleId=air-blade-160-2026, vehicleTitle=AIR BLADE 160 2026. Tất cả component.type thuộc 24 loại Studio gốc; symbolType giữ loại ký hiệu chi tiết. Chữ được lưu đồng thời trong drawing, component.textLayout, wire.labels và annotations. Khung ghi chú có tiêu đề căn giữa, nội dung căn trái, khoảng đệm 10 px; giữ tiếng Việt và Ω.

Nạp JSON với ảnh GỐC cùng tên sourceImage trong source/. Các mạch dọc có sourceTransform.rotateClockwise=90; không dùng ảnh đã xoay làm ảnh nguồn. Đây là bộ mới với ID riêng. Nếu sửa circuit đã tồn tại, phải dùng đúng id/vehicleId/vehicleTitle/circuitTitle của circuit đó theo quy tắc nạp Studio, không đổi tên bằng bộ AirBlade 2011-2012.

Mở review.html để đối chiếu nguồn và ảnh dựng từ JSON. preview chứa PNG 2x và SVG, source chứa nguyên bản 15 ảnh với SHA-256. Capture.PNG chỉ là ảnh tham khảo Smartkey bổ sung, không trộn vào mạch 11.

Trạng thái NEEDS_REVIEW/draft: đã kiểm tra cấu trúc, đầu dây/chân và bảo toàn chữ; chưa phê duyệt điện, chưa cập nhật website. Hình ký hiệu được đơn giản hóa. Các cảnh báo còn lại và khác biệt nguồn nằm trong review-report.json.

Dựng lại: python -X utf8 tools/build_airblade_160_2026.py

## Kết quả kiểm tra

14/14 JSON qua schema và quality.canExport của Studio; 28 luồng dựng giữ đủ 1.304 mục chữ. SVG .web.svg do chính DiagramPreview của Studio xuất; review.html hiển thị các SVG này. Đã đối chiếu riêng 158 nhãn chân, 16 trị số cầu chì và 28 mạng quan trọng với bảng mốc đọc từ ảnh, không chứng nhận toàn bộ nội dung điện.

source-reference.json và source-reference-checks.json lưu phạm vi kiểm tra. web-tool-checks.json giữ cảnh báo khoảng cách đường dây và khác biệt nguồn. Chưa kiểm thử thao tác import trên giao diện vì Browser không khả dụng. Không đánh dấu electrically-reviewed.

# Công cụ ảnh và JSON sơ đồ

Mở **Diagram Studio → Công cụ ảnh & kiểm tra**. Có thể mở từ danh sách project hoặc từ một project đang làm.

## 1. Chuyển ảnh thành bản nháp

1. Chọn PNG/JPEG/WebP, tối đa 12 MB và 24 megapixel.
2. Crop, xoay 0/90/180/270°, chọn cạnh tối đa 2400 px. Giữ đủ chữ, số chân, đầu dây và chấm nối. Mặc định sáng/tương phản 100% để giữ màu.
3. Duyệt ảnh rồi bấm GEN AI. Trong công cụ cục bộ, kết quả chỉ giữ trong tab; tải ZIP trước khi đóng.
4. Muốn lưu vào project, mở circuit tương ứng và dùng luồng chuẩn bị ảnh/tạo sơ đồ tại đó.

Server gửi PNG thay vì JPEG để giữ nét và sọc. Kích thước canvas là kích thước ảnh thực sự gửi AI sau xoay/resize. GEN sử dụng API và cấu hình model hiện có; các bước crop, kiểm tra, lấy màu, nạp JSON và xuất ảnh chạy cục bộ.

## 2. Nạp JSON có sẵn

- Một ảnh: chọn **ảnh gốc**, chuẩn bị ảnh rồi **Nạp JSON có sẵn**. Tool đọc sourceCrop/sourceTransform, kiểm tra canvas và SHA-256 nếu JSON có hash nguồn. Không tự kéo giãn để khớp.
- Nhiều JSON: **Chọn nhiều JSON**, tối đa 40 file, tổng 60 MB, mỗi file 5 MB. Xuất ZIP chứa JSON, PNG 2× (cạnh tối đa 4096 px), SVG và báo cáo từng sơ đồ. Không cần chọn ảnh cho thao tác này.
- Trong circuit của project: có nút **Dùng ảnh này để nạp JSON · không gọi AI**. JSON được gắn với ID circuit/project và lưu thành draft; lớp vector và metadata nguồn được giữ nguyên.
- Sửa JSON: nếu có drawing, phải cập nhật hình vẽ cùng với thay đổi linh kiện/dây. Tool chặn bản sửa còn hình cũ. Có thể chủ động bỏ drawing để dùng renderer linh kiện. Crop/xoay/hash nguồn được giữ cố định khi sửa.

Nên chọn ảnh gốc đúng file đã dùng tạo JSON, không chọn preview hoặc ảnh đã crop lần nữa.

## 3. Đối chiếu và kiểm tra

Chọn chồng ảnh hoặc xem cạnh nhau; điều chỉnh độ mờ và phóng to. Bấm ảnh để lấy màu từ pixel **ảnh gốc**, qua phép đổi tọa độ crop/xoay/scale. Mẫu trung vị 3×3; vùng nhiều màu hoặc trong suốt được cảnh báo.

Báo cáo kiểm ID trùng, đầu dây thiếu/không khớp chân, màu hex, thiếu màu sọc, tọa độ ngoài canvas, vector sai, kích thước ảnh và hash nguồn. Đường không vuông góc/khoảng cách dây gần được báo cần xem, vì ảnh thực tế có thể dùng đường chéo hoặc dây đi sát nhau. Crossing không tự tạo nối điện.

**FAIL** chặn xuất ảnh/bộ ZIP cho dữ liệu lỗi. **NEEDS_REVIEW** vẫn cần đọc ảnh gốc để xác minh số chân, ký hiệu, nhãn, junction và mạng điện; đây không phải chứng nhận đúng điện. Kiểm tra vị trí neo chữ không đo đầy đủ va chạm nét chữ hay mọi đường vector với chữ.

ZIP đối chiếu một ảnh giữ nguyên byte nguồn, clean.png, transforms.json, JSON, SVG/PNG và báo cáo. reference.json là mẫu để ghi bằng cách đọc ảnh nguồn độc lập; công cụ không tự điền candidate làm đáp án. Có thể tiếp tục chạy checker Python trong tools/agent-web-kit nếu cần quy trình đối chiếu độc lập.

## Kiểm thử

Tại root repo sau npm ci:

- npm test --workspace=@auto2tech/web
- npm run build --workspace=@auto2tech/web
- npm test --workspace=@auto2tech/api -- diagram-ai diagram-projects

Bản tích hợp đã kiểm tra 34 JSON thực tế: AirBlade 2011–2012 (10), SH Mode 2023–2025 (12), Vario 2023–2025 (12), bao gồm round-trip dữ liệu và dựng SVG. Các file JSON xe được giữ ở thư mục dữ liệu của người dùng, không chép vào source app.

Kiểm thử GEN dùng fetch giả, không gọi dịch vụ AI có phí. Chưa chạy kiểm thử tương tác trực tiếp trong trình duyệt của phiên làm việc này.

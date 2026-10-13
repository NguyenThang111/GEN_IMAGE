# SH Mode 2023–2025

12 mạch JSON theo ảnh trong FILE ANH/SH Mode 2023-2025. Mỗi mạch có PNG 2× và SVG dựng từ JSON. Mở review.html để xem ảnh gốc và bản dựng cạnh nhau, hoặc chọn chồng ảnh để kiểm tra sai lệch. Trang mở trực tiếp từ file, không cần mạng.

Giữ schemaVersion=1 và vehicleId/vehicleTitle=thang theo bộ AirBlade để tương thích kiểm tra project hiện tại. Tên xe thật nằm trong vehicleModel. ID các mạch dùng tiền tố sh-mode-2023-2025.

Lớp components/wires lưu linh kiện, chân và đường dây; drawing lưu vector chi tiết. Khi chỉnh components/wires cần dựng lại drawing để preview đồng bộ. sourceTransform ghi chiều xoay của hai sơ đồ dọc. Không dùng bitmap ảnh gốc trong drawing.

review-report.json ghi kiểm tra tham chiếu chân, tọa độ đầu dây, ID và các giới hạn đối chiếu. Trạng thái draft vì chưa kiểm thử ứng dụng đích và chưa kiểm chứng điện thực tế. Màu dây lấy trung vị RGB vùng 3×3 từ ảnh; tọa độ gốc nằm trong colorReference. Trang review đã kiểm tra cú pháp JavaScript và các liên kết file, chưa chạy trong trình duyệt do phiên không có trình duyệt khả dụng. Đây là bản chép theo ảnh được cung cấp, không phải tài liệu sửa chữa chính hãng.

Dựng lại: python tools/build_sh_mode.py
Dựng riêng: python tools/render_schematic.py "File JSON chuẩn/SH Mode 2023-2025/02. Mạch còi.json" --out "review/sh-mode-horn" --scale 2

## Sửa lỗi component 08/10/2026

Các loại ký hiệu mở rộng được đổi sang component.type mà Studio gốc hỗ trợ. Loại ký hiệu chi tiết nằm trong symbolType; drawing, số chân và đường dây giữ nguyên. Bộ nạp đúng ID/tên project ở review/component-repair-2026-10-08/web-ready. Đây là sửa file cục bộ; chưa thay dữ liệu trên website.

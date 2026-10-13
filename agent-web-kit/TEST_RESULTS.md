# Kết quả kiểm tra bộ giao việc

Ngày chạy: 06/10/2026, múi giờ Asia/Saigon.

| Lệnh | Kết quả |
|---|---|
| `python -m unittest discover -s agent-web-kit -p "test_*.py" -v` | 50 test đạt, không bỏ qua test nào |
| `python tools/diagram_check/test_checker.py` | 29 test hiện có của project đạt |

Bộ mới kiểm tra lỗi cố ý trên fixture tổng hợp: mất/đổi chữ, mất dấu tiếng Việt, số A và số chân sai, `Bl/BI`, `O₂/O2`, thiếu một lần xuất hiện nhãn, sai vị trí, ID trùng, đầu dây lệch chân, đảo kết nối ắc quy, mạng bị tách/gộp, dây dữ liệu và nét vẽ lệch nhau, thiếu sọc, symbol đệ quy/matrix suy biến, NaN/Infinity, JSON key trùng, reference sai cấu trúc, hash nguồn đổi, ảnh không decode được, ảnh bị cắt dữ liệu, ảnh trống/sai kích thước và nguy cơ ghi báo cáo đè file đầu vào. Có test đầu vào đúng, crop/scale, symbol transform và CLI tạo báo cáo trên các file ảnh thật được tạo riêng cho test.

29 test cũ kiểm thêm các trường hợp nét chữ chạm dây, fill che chữ, chữ xoay tràn canvas, dấu cực trên hình ắc quy, vai trò cuộn/tiếp điểm và chân relay, màu/sọc so với dữ kiện nguồn, cùng reference/hash của ảnh AirBlade đã có.

Kết quả này xác minh các checker bắt các lỗi đã nêu. Nó không chứng nhận một sơ đồ xe máy mới hoặc website chưa được truy cập. Các ảnh trong test mới là ảnh tổng hợp, không phải ảnh được xuất từ website thật. Bộ starter luôn giữ `NEEDS_REVIEW` khi chưa phát hiện lỗi; agent phía web phải triển khai và chạy phần test raster/layout, hình linh kiện đầy đủ và import/export thật theo prompt.

# Kiểm tra sơ đồ theo ảnh PNG gốc

Công cụ đọc JSON như **bản cần kiểm tra**. Các dữ kiện đối chiếu trong `reference.py` được ghi từ ảnh PNG, không trích từ JSON hoặc bộ sinh cũ. Không dùng OCR làm đáp án cho dấu tiếng Việt, số chân hay nối điện.

## Mở kết quả

- `review/independent-check/index.html`: kiểm tra bộ JSON trước khi sửa.
- `review/verified-check/index.html`: kiểm tra các bản sửa mới.
- `Bản sửa đã đối chiếu/01.AirBlade-2011-2012/`: 10 JSON đã áp dụng **những sửa đổi được xác minh**, kèm PNG. Trạng thái vẫn là `draft`, chưa chứng nhận giống toàn bộ ảnh hoặc đã chạy đúng trên website.

Trang báo cáo chạy bằng file HTML, không cần mạng. Chọn mạch, chọn lỗi để xem cận cảnh nguồn và bản dựng. Có phóng to, cuộn hai ảnh cùng nhau, lọc nhóm lỗi và ảnh đánh dấu nét khác nhau. JavaScript được kiểm tra cú pháp; giao diện chưa được kiểm thử bằng trình duyệt trong phiên này.

## Chạy

Từ thư mục dự án, Python 3.9+, Pillow, numpy, opencv-python. OCR là tùy chọn, cần rapidocr-onnxruntime và mô hình đi kèm.

```powershell
python tools/diagram_check/check.py
python tools/diagram_check/test_checker.py
python tools/diagram_check/repair_verified.py
python tools/diagram_check/check.py --input "Bản sửa đã đối chiếu/01.AirBlade-2011-2012" --out review/verified-check --ocr
```

`repair_verified.py` tạo bản sao, sửa vị trí chân theo ảnh, thay mẫu ắc quy/relay, sửa những chữ đã xác minh. Nó không gọi bộ sinh cũ, không ghi vào ảnh nguồn, JSON gốc hay cơ sở dữ liệu website. Các trường `id`, `vehicleId`, `vehicleTitle`, `schemaVersion` được giữ nguyên; đặc biệt `vehicleTitle` vẫn là `thang` theo bộ hiện tại để tránh lỗi import.

Có thể kiểm tra một mạch bằng `--only 02`. Đưa một file JSON thay thế vào thư mục kiểm tra riêng, giữ tiền tố `02. ` rồi dùng `--input` cùng `--only`.

Mã thoát: `1` khi phát hiện lỗi; `2` khi còn phần chưa xác minh. **Không có mã thành công 0/PASS** với phạm vi đối chiếu hiện tại. Điều này là chủ ý, không phải công cụ chạy hỏng.

## Ảnh xuất từ website

Xuất PNG chỉ chứa canvas sơ đồ từ website, đặt tên `01.png`…`10.png` trong một thư mục riêng. Kích thước hiện được hỗ trợ: 1499×844 hoặc 2998×1688, không gồm giao diện web. Sau đó:

```powershell
python tools/diagram_check/check.py --input "Bản sửa đã đối chiếu/01.AirBlade-2011-2012" --exports "review/anh-xuat-web" --out review/web-check
```

Ảnh web sẽ xuất hiện bên phải để đối chiếu, có ảnh sai biệt riêng. Nạp được PNG **không** tự chuyển `app_render` thành đã xác minh. Các kiểm tra mạng/chân vẫn đọc JSON; ảnh bitmap không chứng minh được ý nghĩa kết nối. Nếu dùng ảnh chụp cả giao diện, cần xác định đúng khung canvas trước, không tự kéo giãn ảnh cho khớp.

## Những gì công cụ kiểm tra

- ID linh kiện, dây, chân trùng; tham chiếu thiếu; tọa độ không hợp lệ; đầu dây khác tọa độ chân; kiểu hình không hỗ trợ hoặc symbol đệ quy.
- Cực ắc quy theo vị trí đọc từ ảnh, mạng nguồn/mass, dấu cộng/trừ thật trong nét vẽ; không dựa vào thứ tự mảng chân.
- Mạng nối dây ghi từ cả 10 ảnh. Không tự nối xuyên công tắc, relay, cầu chì hoặc gộp các điểm mass. Bắt thiếu liên kết và hai mạng riêng bị nhập làm một.
- Chân relay trong nét vẽ có trùng đầu dây không; cuộn dây có bị đổi chỗ với tiếp điểm không.
- Nét dây/sọc màu có đồng bộ với dữ liệu không; dây thừa còn trên hình hoặc dây có dữ liệu nhưng không được vẽ; màu so với các mẫu pixel nguồn đã chọn.
- Những mục chữ và số chân đã ghi trong bảng đối chiếu. Chữ được raster hóa 2× bằng Arial để kiểm tra nét chữ giao nhau, cắt dây/khung, bị hình phía sau trong thứ tự vẽ che, hoặc tràn canvas. Có xử lý chữ xoay và chữ O₂ tách thành hai glyph.
- Hash ảnh nguồn. Nếu ảnh thay đổi, công cụ báo lỗi thay vì tiếp tục coi bảng mốc cũ là đã xác minh.

## Phạm vi còn lại

Chưa chép thủ công **mọi** nhãn dây/ghi chú thành đáp án, chưa xác minh hết hình chi tiết của đèn, cảm biến, giắc, mô tơ, và chưa xác minh renderer trên website. OCR chỉ tạo mục cần xem, có thể nhầm `Bl/BI`, dấu tiếng Việt, Ω hoặc số nhỏ. Sai biệt điểm ảnh cũng chịu ảnh hưởng của nền/logo, phông chữ và khử răng cưa; không dùng một tỷ lệ giống ảnh để kết luận đúng điện.

Do đó báo cáo có thể không còn lỗi trong các phép kiểm đã chạy nhưng vẫn là **NEEDS_REVIEW**. Không được đổi tên trạng thái này thành “chuẩn 100%”.

## Mở rộng dữ kiện đối chiếu

1. Mở ảnh gốc và ghi chân, mạng, chuỗi chữ cùng vị trí/ROI bằng tọa độ ảnh gốc (1687×952).
2. Ghi chúng vào `reference.py`; không tự điền bằng dữ liệu của bản cần kiểm tra. ID chỉ là liên kết tên.
3. Giữ nguyên `source-lock.json`. Nếu thay nguồn, đọc lại các vùng liên quan rồi mới cập nhật hash tương ứng.
4. Chạy kiểm tra lỗi cố ý trong `test_checker.py`, sau đó chạy báo cáo trên cả bản trước và sau sửa.

`symbols.py` là mẫu ắc quy/relay mới có chân định danh, nhận tọa độ nguồn làm đầu vào. `verified-symbols.json` trong bộ sửa lưu hình và vị trí chân từng mẫu để tái sử dụng. Việc này không chứng nhận các mẫu linh kiện khác của bộ cũ.

# Bộ sơ đồ Air Blade 2011–2012

Mở `review.html` để đối chiếu 10 mạch. Trang chạy trực tiếp từ file, không cần mạng.
Mỗi JSON đi kèm PNG 2× và SVG trong `preview/`. Bộ dựng thực sự đọc JSON, không chèn ảnh chụp vào bản dựng.

## Trạng thái và giới hạn

- Bộ kiểm tra cũ không phát hiện được các lỗi ở chân relay và chữ trong ký hiệu. Kết quả cũ không xác nhận sơ đồ đúng với ảnh nguồn; dùng `review/verified-check/index.html` và công cụ trong `tools/diagram_check/`.
- Bảng màu dây lấy trung vị RGB từ các vùng 3×3 pixel trong ảnh; tọa độ lấy mẫu nằm trong `colorReference` của từng JSON.
- Các linh kiện được vẽ lại bằng vector. Không khẳng định giống từng pixel: ảnh chụp có nén, nền và logo đè lên một số màu/nét.
- Màu và hình dạng được bám theo phần nhìn thấy của ảnh; không thể khôi phục chắc chắn màu trước khi bị nền phủ.
- Đã có địa chỉ website nhưng phiên làm việc chưa có trình duyệt khả dụng để xác minh bản xuất trên website; không khẳng định website đã được sửa.
- Trang `review.html` và bộ JavaScript đã kiểm tra cú pháp; phiên làm việc không có trình duyệt khả dụng nên chưa kiểm thử nút bấm/xuất file trong trình duyệt. PNG/SVG đã được xuất bằng Python và mở xem trực tiếp.
- Đây là đối chiếu sơ đồ theo ảnh, chưa phải kiểm chứng thiết kế điện hoặc mô phỏng điện.
- `reviewStatus` giữ `draft`; `reviewMetadata.targetAppVerified` là `false` cho tới khi kiểm tra trên web thật.

## Dùng trên web hiện tại

Các trường `schemaVersion`, `components`, `wires`, `id`, `vehicleId` được giữ theo cấu trúc ban đầu.
`vehicleTitle` được giữ chính xác như JSON gốc (`thang` trong bộ này). Web dùng trường này để kiểm tra đúng project; đổi sang tên xe sẽ bị chặn import/lưu. Nếu web đang giữ bản lỗi, chọn **Nạp file JSON** để nạp lại file đã sửa trong thư mục này.
Các ID mạch/xe cũ được giữ, kể cả ID đặt sai tên, để tránh mất liên kết dữ liệu. `circuitTitle` đã sửa theo nội dung.

Lớp bổ sung `drawing` chứa toàn bộ hình dạng vector, số chân, nhãn, vị trí, thứ tự vẽ và các symbol dùng lại.
Bộ dựng cũ chỉ đọc `components/wires` sẽ không tự có các chi tiết mới.
Kèm file `diagram-renderer.js`, không phụ thuộc thư viện, để tích hợp:

```html
<script src="diagram-renderer.js"></script>
<div id="diagram"></div>
<script>
// data là JSON đã parse từ trình soạn thảo / API của web.
// Sau mỗi lần sửa components/wires, cần đồng bộ drawing bằng bộ build
// hoặc cập nhật lớp drawing tương ứng; hai lớp không tự đồng bộ.
document.querySelector('#diagram').replaceChildren(SchematicRenderer.render(data));
</script>
```

Nếu web có JSON validator chặn trường mới thì cần cho phép `drawing`, `sourceCrop`, `reviewChanges`, `reviewMetadata`, `colorReference`, `renderContract`, `captions`, `labels`, `symbol`, `arrow`, `combLabels`, `groundColor`.
Không chỉ xóa các trường này để qua validator: việc đó làm mất chi tiết đã dựng.

## Dựng lại và kiểm tra

Từ thư mục dự án, Python 3.9+ và Pillow:

```powershell
python tools/diagram_check/check.py
python tools/diagram_check/repair_verified.py
python tools/diagram_check/check.py --input "Bản sửa đã đối chiếu/01.AirBlade-2011-2012" --out review/verified-check
```

Dựng riêng một file:

```powershell
python tools/render_schematic.py "File JSON chuẩn/01.AirBlade-2011-2012/02. Mạch còi.json" --out "review/coi" --scale 2
```

`symbol-library.json` là thư viện hình vector dùng lại. Mỗi file mạch nhúng đúng các mẫu cần dùng nên không phụ thuộc file thư viện bên ngoài.
`review-report.json` ghi kết quả kiểm tra, `source-checksums.json` ghi hash các nguồn để so sánh về sau.

## Ghi chép của lần dựng trước (chưa phải kết luận xác minh toàn bộ)

### Mạch cấp nguồn

- Thay bản cấp nguồn 1600×902 tham chiếu JPEG không có bằng bản tọa độ đúng ảnh PNG 1687×952.
- Sửa đường mass ắc quy; sửa các giắc chia tải và nhãn bị lệch.
- Giữ nguyên chuyển màu R/Bl → R/W tại tụ như ảnh.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch còi

- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch xi nhan

- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch đèn phanh

- Sửa dây từ điện trở xuống mass thành G màu xanh đúng ảnh.
- Vẽ lại cụm LED ba nhánh và ghi đủ 10Ω 20W.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch báo xăng

- Bổ sung ghi chú dung tích 4,5 lít bị bỏ sót; vẽ đủ F/E, biểu tượng xăng và phao.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch đèn đêm

- Thay nội dung nhầm mạch cấp nguồn bằng mạch đèn đêm đúng ảnh 08-37-50.
- Vẽ đủ hai tầng công tắc đèn, công tắc pha/cốt, bóng hai sợi đốt, đèn báo pha, vị trí, biển số và đèn hậu.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch đánh lửa

- Sửa đường mass chéo bị biến thành bậc thang.
- Vẽ đủ răng rôto CKP, cuộn CKP, mô-bin, bugi và nhãn chân ECM.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch khởi động

- Sửa các đường dây chéo ở ắc quy và mô tơ bị vẽ thành bậc thang.
- Bổ sung đủ số chân ECM 33, 1, 7, 29, 25.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Mạch điện xác định vị trí xe

- Sửa tiêu đề báo tốc độ thành xác định vị trí xe; giữ ID cũ để không làm đứt liên kết dữ liệu.
- Bổ sung hình giắc 10P, số chân 1–10 và nhãn đầu nối.
- Giữ chân 9 trên hình giắc tham chiếu; không tự thêm dây vào chân không được vẽ.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.

### Sơ đồ nguyên lý hệ thống phun xăng điện tử (PGM-FI)

- Sửa tiêu đề Idling Stop thành sơ đồ nguyên lý PGM-FI; giữ ID gốc.
- Sửa số chân THL 3→5, O₂ 5→3 theo ảnh.
- Bổ sung dây nguồn trực tiếp ắc quy → rơ le khởi động, hai dây mass PG1/PG2 và nối cao áp mô-bin → bugi.
- Bổ sung giắc 33P, mã lỗi và bảng ghi chú.
- Thêm lớp vector tự chứa: hình linh kiện, nhãn và số chân; bỏ nền app khỏi bản vẽ.


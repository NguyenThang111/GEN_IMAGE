# Honda Air Blade 2011–2012 — bộ làm lại ngày 12/10/2026

Mở [review.html](review.html) để chọn từng mạch, xem ảnh nguồn cạnh bản làm lại,
chồng ảnh, phóng to và xem hình web hiện tại sau thử import. Các file JSON ở
`json/`, PNG 2× và SVG ở `preview/`; nguồn nguyên bytes ở `source/`.

## Kết quả thực tế

- Đủ 10 mạch; giữ ID/vehicleId/vehicleTitle của project server đã xác minh:
  `38770-kvg-v42`. Identity `thang` của bộ cũ lưu trong metadata để trace.
- Checker theo nguồn: 0 lỗi trong phạm vi kiểm; vẫn `NEEDS_REVIEW`/exit 2 vì
  coverage chữ/symbol/APP chưa toàn bộ. Không coi đây là duyệt điện học đầy đủ.
- Code Studio hiện có trong repo local: 10/10 file qua validator và round-trip
  không mất field; PNG/SVG dựng bằng renderer React thật của bản source đó.
- Đã thử **10/10 file trên web production**: nạp vào bản nháp được. Renderer
  web bỏ qua `drawing`; export bỏ `drawing`, `reviewMetadata`, `sourceCrop`,
  annotation, targets, pinoutData và nhiều field khác. Bằng chứng từng file ở
  [checks/live-editor/results.json](checks/live-editor/results.json).
- Thử nghiệm không bấm lưu JSON/tiến độ. Đối chiếu lại 20 file schema/ảnh và
  metadata circuit sau thử: tất cả giữ nguyên trên server.
- 15 test validator/export và 29 test fault injection checker pass; TypeScript
  snapshot pass. Trang đối chiếu đã thử bằng trình duyệt thật, có zoom/chồng
  ảnh và chế độ sáng/tối. Đây là kiểm chứng giao diện review, không phải APP native.

## Những sửa đổi trong bộ này

1. Mạch cấp nguồn giữ đủ 20 đích tải bằng dữ liệu `targets`, nhãn semantic và
   đường cấp; không chỉ giữ danh sách bằng chữ trong drawing.
2. Dựng lại cầu chì, máy phát, mô-bin và bugi bằng hình học có tham số theo
   tọa độ chân; dùng một engine nét dây cho cả 10 mạch. Giữ edge cao áp và khe
   hở bugi, không tự tạo dây nối qua khe hở.
3. Mạch định vị giữ bảng 10 khoang cùng nhãn 1–10 và 9 chân có dây; PGM-FI giữ
   đủ 33 khoang. Lưu cấu trúc từng ô và vỏ giắc có lẫy, không bịa chân từ khoang.
4. Ghi điểm tiếp xúc chưa có dây trong ký hiệu chống nghiêng của mạch đánh lửa,
   giữ cảnh báo review; không tự nối nội bộ hoặc suy số chân OEM.
5. Phân loại owner/role cho các nét annotation. Chép lại IGPLS, dấu `:` và ghi
   chú điện trở PGM-FI theo ảnh nguồn; lưu lịch sử sửa reference riêng.

## Cách nạp vào web

Mở đúng circuit của project AIR BLADE 2011–2012 → **Sửa JSON** → **Nạp file
JSON** từ `json/` → **Kiểm tra ngay**. Luồng này đã thử trong phiên làm việc.

**Bản web đang deploy cần cập nhật renderer và serializer trước khi dùng gói
này để bàn giao chuẩn.** Đừng lấy JSON export từ bản web hiện tại làm bản gốc
mới vì mất dữ liệu đã dựng. Việc cập nhật frontend/source pipeline và việc
phát hành phải được kiểm chứng riêng; gói này không chứng minh đã deploy.

Ba record còn phải sửa nguồn theo quy trình:

| Mạch | Nguồn server hiện tại | Ảnh đúng trong gói |
|---|---|---|
| 01 — cấp nguồn | PNG đã dựng lại | `source/01.original.png` |
| 02 — còi | PNG đã dựng lại | `source/02.original.png` |
| 06 — đèn đêm | Nhầm ảnh mạch cấp nguồn | `source/06.original.png` |

Bảy ảnh còn lại khớp nguyên bytes với server. Không dùng ba nguồn sai trên để
duyệt lại topology; hash ảnh đúng được ghi trong inventory và review-report.

## Trạng thái và bàn giao tiếp

**Gói đang là draft / REVIEW_REQUIRED, chưa phải PORT_COMPLETE.** Cần reviewer
APP độc lập, registry/geometry thực tế của EasyScan, parity hai consumer và
coverage mọi lần xuất hiện của chữ trước khi đóng nghiệm thu theo master contract.

`model-proposals/` có ID/version/type/port mapping đề xuất từ bảng model trong
master contract; đó không phải manifest runtime đã xác minh. JSON `json/` là
bản tương thích Studio legacy, chưa phát `symbolRef` chưa được consumer hỗ trợ.
`pinoutData` cần migrate sang `assemblyData.pinoutGroups` đúng schema.ts của APP
thật. Headlamp nguồn có thứ tự high/low/common, ngoài layout v1 ghi trong contract;
không đổi role để ép qua gate. LED panel và cụm chống nghiêng vẫn cần review nội bộ.

Đọc [session.md](session.md), [corrections.json](corrections.json),
[review-report.json](review-report.json) và [manifest.json](manifest.json) để
tiếp tục. Gói không chứa tài khoản, mật khẩu, cookie hoặc token đăng nhập.

`code-patch/task-changes.patch` ghi riêng sửa đổi validator/test của lượt này;
`code-snapshot/` là các file Studio hiện có dùng để render/round-trip. Nhiều file
snapshot đã có sửa đổi từ phiên trước; không coi chúng là một commit mới hoặc
chép đè production mà bỏ qua build, review và quy trình deploy.

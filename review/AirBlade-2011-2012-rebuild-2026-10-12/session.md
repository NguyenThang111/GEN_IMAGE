# Làm lại AirBlade 2011–2012 — 12/10/2026

Yêu cầu: làm lại xe `01.AirBlade-2011-2012` theo feedback master contract.
Phạm vi dữ liệu: 10 mạch riêng từ ảnh cục bộ trong `FILE ANH`; 2 ảnh khác là
bản chụp lặp mạch đánh lửa và định vị xe, không tạo mạch thứ 11/12.

Giữ nguyên `id`, `vehicleId`, `vehicleTitle`, `schemaVersion` đang liên kết
với project. Đối chiếu ảnh trước khi cập nhật candidate; bản cũ chỉ dùng làm
layout và dữ liệu cần kiểm. Không ghi ảnh nguồn hoặc cập nhật DB/server.

Repo Auto2Tech tìm thấy: `C:/Users/thang/Desktop/auto2techos`;
HEAD `165a4b0ba9207c39a846cf91376d02aecd932b39`, working tree có thay đổi sẵn.
Repo này chưa có dispatch `symbolRef`/shared geometry theo master contract
tại lúc kiểm. Dùng code hiện có để kiểm parse/export và render Studio,
không tự coi metadata model là bằng chứng hai consumer đã hỗ trợ.

Repo EasyScan và registry thực tế chưa được cung cấp/tìm thấy. Parity thư viện,
importer APP, render APP và review độc lập đang chờ. Record identity server đã
được xác minh ở bước thử web ghi bên dưới.
Chuẩn bị gói dữ liệu và bằng chứng cục bộ đầy đủ; giữ `REVIEW_REQUIRED` cho
nghiệm thu PORT nếu các điều kiện này chưa được kiểm.

Inventory: `inventory/01.json`…`10.json`, đọc bằng ảnh gốc và nguồn network
reference đã khóa hash. `tools/airblade_rebuild/source_inventory.py` là bảng
ghi nguồn thủ công; không tự sinh đáp án từ candidate.

Baseline: checker cũ báo 0 lỗi trong phạm vi đã kiểm trên cả 10 mạch; mỗi mạch
còn coverage chữ/symbol/APP chưa đủ và sai biệt ảnh cần review. Số này không
chứng minh bộ cũ đáp ứng feedback mới.

Đầu ra: 10 JSON làm lại riêng, PNG/SVG từ code Studio thật, trang đối chiếu,
manifest/hash, báo cáo corrections/findings và gói ZIP.

## Xác minh web theo chỉ dẫn tiếp theo của người dùng

Đã đăng nhập web bằng thông tin người dùng cung cấp; không lưu mật khẩu/token
vào artifacts. Project AirBlade có vehicleId `38770-kvg-v42`, projectId
`a8867bdf-059b-4ecd-a535-e02714ac0e38`. Tải snapshot qua UI trước khi thử nạp.
Khi đã có authority này, bản mới giữ ID của server; ID `thang` trong bản cũ
lưu tại `reviewMetadata.legacyLocalIdentity`, không ghi đè file cũ.

7 ảnh server khớp nguyên bytes ảnh gốc local. Mạch cấp nguồn và còi đang dùng
PNG dựng lại làm source; mạch đèn đêm dùng nhầm ảnh cấp nguồn. Các findings này
được ghi riêng, không coi snapshot server là nguồn đúng cho ba mạch đó.

Luồng thử import: mở đúng circuit → Sửa JSON → Nạp file JSON → Kiểm tra ngay;
chỉ thay bản nháp trong browser, không bấm Lưu JSON vào project hoặc Lưu tiến độ.
Renderer production hiện không đọc drawing.version=1; import được không chứng
minh hình chuẩn. Kiểm thực tế theo từng mạch và lưu screenshot/SVG tại checks.

Đã thử 10/10 mạch: file nạp vào draft được, renderer production không dispatch
drawing, export mất 8 field cấp schema và nhiều extension field của component.
Lưu ảnh screenshot preview cùng JSON tải lại trong `checks/live-editor/`.
Không có POST/PUT/PATCH/DELETE vào API diagram trong lượt thử. Tải lại snapshot:
20 schema/source files cùng identity/status/progress/timestamps giữ nguyên.

## Sửa code và kiểm chứng

Đã sửa có giới hạn `validate-diagram.ts` và thêm 4 case trong
`validate-diagram.test.ts` ở repo Auto2Tech local: giữ dây chéo có drawing,
sourceCrop và hash nguồn, vẫn chặn đầu dây lệch/chân thiếu. File validator đã
có sửa đổi của lần trước; backup ngay trước lượt này ở `before-code/`.
Không commit, push hoặc deploy.

15 test validator/export pass; TypeScript của snapshot liên quan pass; 29 test
fault injection checker pass. Từng mạch được kiểm source checker, validator,
round-trip và render nguồn Studio. Trang review được kiểm trong Edge thật:
chọn mạch, ảnh load, zoom 150%, overlay, đổi sáng/tối và so với web production.

Các bước còn cần để nghiệm thu chuẩn: cập nhật renderer/serializer production;
sửa ảnh nguồn 01/02/06 qua workflow đúng record; lấy registry/geometry APP thật,
migrate model refs/pinout, review ảnh → schema → render APP bởi reviewer độc lập.
Giữ draft/REVIEW_REQUIRED đến khi đủ các bằng chứng đó.

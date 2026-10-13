# Tránh lỗi component khi nhập GEN vào Auto2Tech

Ngày: 12/10/2026. Sự cố thực tế: bộ 06.SCOOPY 2023.
Tài liệu bổ sung cho master contract và phương pháp làm việc; không thay
quy chuẩn symbol, review ảnh hoặc nghiệm thu PORT.

## Nguyên nhân đã xác minh

Mạch cấp nguồn báo components[17] đến components[26]: unsupported type.
Mười đối tượng này là nhánh ra tải, được GEN phát type=loadGroup.
Ngoài ra bảy bảng pinout trong các mạch 05/07/08/10/12 phát type=pinout.

Studio local khai báo thêm các type này, nhưng bundle production và enum API
đang kiểm chỉ nhận 23 type. PASS của validator local không chứng minh web
production chấp nhận JSON. Tôi đã bỏ sót bước đối chiếu consumer ở lần GEN đầu.

Bằng chứng production được lấy mới bằng HTTP GET công khai:

- Origin: https://auto2tech-app-production.up.railway.app
- Asset và SHA-256: xem production-contract.json; lấy hash từ bytes thực tế,
  không sao chép hash lịch sử vào lần kiểm mới.
- Profile, lỗi tái hiện và kết quả sau sửa:
  review/SCOOPY-2023-gen-2026-10-12/component-fix-r02/
- Repo local: C:/Users/thang/Desktop/auto2techos, HEAD
  165a4b0ba9207c39a846cf91376d02aecd932b39, working tree có thay đổi sẵn.

Profile tại thời điểm này:

    battery, fuse, relay, switch, selectorSwitch, scu, ecm, acg,
    connector, ground, junction, horn, flasher, diode, lamp, gauge,
    sensor, ignitionCoil, sparkPlug, motor, injector, pump, valve, device

Đây là snapshot, không phải danh sách bất biến. Xác minh consumer và revision
cho mỗi nhiệm vụ mới; không suy production giống working tree local.

## Cách sửa có bảo toàn ý nghĩa

| Đối tượng đã xác minh từ ảnh | Type production | Metadata phải giữ |
|---|---|---|
| Nhánh ra tải có một anchor | device | symbolType=loadGroup, semanticKind=continuation.loads, targets, một terminal nguồn, textLayout.kind=load-list |
| Bảng khoang giắc, không có chân điện | connector | symbolType=pinout, presentationOnly=true, pinoutData, số/nhóm khoang, nhãn, không thêm terminal |

Đây là encoding compatibility của hai đối tượng đã biết. Không đổi mọi type
lạ thành device; unknown phải báo finding và giữ draft. Khi consumer có shared
symbolRef thật, dùng contract đó và kiểm serializer/model đầy đủ. symbolType
không tự chứng minh production render đúng model.

Giữ IDs, terminal IDs/tọa độ/nhãn, endpoint dây, mã màu, danh sách đích,
reviewIssues, provenance và source hash. Không xóa component bị lỗi để qua
validator, không biến nhánh tải thành chữ rời, không bịa chân ECM hay khoang
thành chân có dây. Master contract cho phép continuation.loads dùng type
device, nhưng shared model chưa được xác minh trong gói compatibility.

Sau khi sửa type, production mới đi tới bước kiểm graph và có thể phát hiện
lỗi tiếp theo. Trong SCOOPY, còn các đoạn dây chéo mà local cho phép nhờ
source-traced drawing. GEN đã thêm góc ngang/dọc vào points tại lớp schema,
giữ nguyên hai endpoint, terminal và topology. Drawing dây dựng lại từ chính
points đó. Routes quan sát từ ảnh vẫn giữ trong inventory; không vá renderer
hoặc tắt validator để che lỗi.

## Gate trước khi giao file

1. Chốt consumer thực tế: web production, API, Studio local, APP; ghi enum,
   URL asset hoặc commit, hash và phạm vi chứng minh của từng checker.
2. Tạo inventory từ ảnh trước candidate. Chọn representation được target
   consumer hỗ trợ, giữ các đối tượng còn chưa rõ ở draft.
3. Kiểm toàn bộ schema của xe, không chỉ mạch có ảnh báo lỗi. Không dùng
   candidate làm nguồn enum hỗ trợ.
4. Chạy type gate với profile consumer đã xác minh:

    python tools/check_component_types.py --profile review/SCOOPY-2023-gen-2026-10-12/component-fix-r02/production-contract.json --input "FILE GEN JSON/06.SCOOPY 2023" --out review/SCOOPY-2023-gen-2026-10-12/component-fix-r02/type-validation.json

5. Type gate chỉ kiểm type. Tiếp tục chạy validator đầy đủ của consumer:
   terminal minimum, IDs trùng, endpoint tồn tại/khớp, dây ngang-dọc, clearance,
   màu và identity. Trong lần sửa này, check_production.mjs chạy nguyên các
   hàm validator production đã lấy mới trong VM; không đăng nhập hay ghi DB.
   Đổi bundle phải đọc lại code/markers, không tự tái dùng snapshot cũ.
6. Thử âm: đưa loadGroup/pinout về type lần trước phải bị target validator
   chặn. Bản gốc phải tái hiện đúng lỗi screenshot. Chỉ dùng clone để thử âm.
7. So trước/sau để đảm bảo giữ toàn bộ terminal, endpoint, code, targets và
   pinout. Render lại bản cuối, kiểm các đoạn đã đổi, kiểm round-trip.
8. Chốt hash schema mới; verdict cũ theo hash cũ hết hiệu lực. Đóng gói phải
   fail nếu profile/type/validator/report hash chưa khớp file cuối.

Tài liệu và type gate dùng lại cho xe sau; profile SCOOPY chỉ dùng lại khi
consumer/revision/hash vẫn là target đã xác minh.

## Giới hạn phải báo riêng

Chấp nhận type, import cấu trúc, round-trip giữ fields và render đúng ảnh là
các kết quả khác nhau. Production snapshot này chưa dispatch drawing.version=1
và serializer cũ còn bỏ extension fields. Vì vậy không dùng PASS validator
để tuyên bố nhánh tải/pinout render chính xác trên production hoặc PORT hoàn tất.
Bản sửa SCOOPY vẫn giữ draft và findings về thư viện APP/review độc lập.
Không đổi DB status hay deploy chỉ để làm biên bản kiểm xanh.

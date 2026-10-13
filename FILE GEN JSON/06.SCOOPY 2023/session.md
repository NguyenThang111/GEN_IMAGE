# GEN 06.SCOOPY 2023 — 12/10/2026

Phạm vi: 12 ảnh cục bộ trong FILE ANH/06.SCOOPY 2023; tạo bộ JSON riêng,
inventory từ ảnh, preview Studio, hash và findings. Không sửa dữ liệu xe khác,
không sửa DB, không deploy, không PORT sang APP.

Workspace không có Git. Auto2Tech thực tế: C:/Users/thang/Desktop/auto2techos,
HEAD 165a4b0ba9207c39a846cf91376d02aecd932b39, nhiều thay đổi có sẵn.
Chỉ đọc code repo này; không ghi đè working tree. Contract và renderer hiện tại
có drawing.version=1, chưa có dispatch symbolRef/shared APP models.

Ảnh local đủ 12 mạch; source-manifest.json khóa bytes và kích thước.
Chưa có record/project ID trên server; dùng identity local scoopy-2023,
không tuyên bố ID server. Chưa có repo/registry/geometry EasyScan thật.
Model mapping theo bảng master contract chỉ là đề xuất sidecar, không phải
chứng nhận parity. JSON dùng drawing tương thích Studio, giữ draft.

Inventory được chép bằng mắt từ ảnh trước candidate, không lấy xe khác làm
đáp án. Mạch 12 xoay 90° theo chiều kim đồng hồ để đọc; nguồn giữ nguyên.
Reviewer độc lập và APP render chưa có; appReview=PENDING,
deliveryVerdict=REVIEW_REQUIRED. Thực hiện phần GEN cục bộ có đủ nguồn.

## Kết quả bàn giao

Đã tạo 12 JSON trong FILE GEN JSON/06.SCOOPY 2023, ảnh nguồn nguyên bytes,
12 preview SVG/PNG từ code Studio hiện tại, inventory, model proposals,
evidence, findings và index.html. Gói ZIP nằm cạnh thư mục này.

Validator và vector validator Studio: 12/12 đạt. Serializer editor round-trip
giữ đầy đủ field; deterministic export đạt. Graph/source transcription carry
và selected net cases đạt, 12 schema chạy generator lại có hash không đổi.
Fault injection phát hiện missing endpoint và nonnumeric vector point.
Review page thử trong Edge headless thật: 12 asset tải được, chọn mạch,
zoom150, overlay, nền trang tối đạt; không phải kiểm APP theme.

Không sửa repo Auto2Tech, DB, production hoặc dữ liệu xe khác. Renderer static
lấy từ repo Auto2Tech thật; dependencies tái dùng ở bản sao tích hợp.
Checks ghi hash nguồn code và hash schema/preview. Không có registry APP thật.

GEN phần draft cục bộ đã giao; source exact text/contour coverage, strict
symbolRef/shared geometry, server identity, API/production/APP round-trip,
APP render và review độc lập vẫn mở. Xem README.md và evidence/*.json trong
gói để tiếp tục. Không coi kết quả kỹ thuật là nghiệm thu điện học.

## Sửa lỗi component r02 theo ảnh báo lỗi

Xác minh lại bundle production bằng HTTP GET công khai. Production chỉ nhận
23 type; local rộng hơn. Tái hiện đúng 10 lỗi components[17..26] của mạch
cấp nguồn; rà cả xe thấy thêm 7 bảng pinout có type chưa được hỗ trợ.

Sửa tại generator/schema: nhánh tải dùng device envelope, giữ semanticKind,
symbolType, targets, anchor và textLayout; pinout dùng connector presentation,
không thêm terminal. Thêm góc ngang/dọc cho 22 route bị production chặn.
So trước/sau xác nhận IDs, terminal, endpoints, codes/colors/states, targets,
pinoutData, reviewIssues, source hash và annotations giữ nguyên.

12/12 đạt cả validator đầy đủ production thực tế và local Studio,
round-trip/preview đã kiểm lại theo hash r02. Production validator chạy từ
bundle đã khóa hash trong VM, không đăng nhập UI và không ghi DB. Chưa
dispatch shared models/drawing ở production; không tuyên bố render APP đạt.

Evidence và bản cũ lưu component-fix-r02/. Quy tắc phòng lỗi:
AUTO2TECH_COMPONENT_IMPORT_COMPATIBILITY.md, đã liên kết từ AGENTS.md.
Type gate ở tools/check_component_types.py; generator chặn emitter type
ngoài profile, packager chặn report production lỗi hoặc hash stale.

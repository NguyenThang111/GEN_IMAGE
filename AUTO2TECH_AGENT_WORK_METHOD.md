# Phương pháp làm việc cho agent GEN và PORT sơ đồ Auto2Tech → EasyScan

| Thuộc tính | Giá trị |
|---|---|
| Mã tài liệu | AUTO2TECH-AGENT-WORK-METHOD |
| Phiên bản | 1.0 |
| Ngày ban hành | 12/10/2026 |
| Phạm vi | GEN, thư viện symbol, Diagram Studio, export/import và PORT sang EasyScan |
| Nguồn yêu cầu | [Master contract ngày 12/10/2026](AUTO2TECH_GEN_PORT_MASTER_CONTRACT_2026-10-12.md) |
| SHA-256 tài liệu nguồn | `846d0b3dd08a5bcecdc37032481fa931d46ce37a9d8781a275087d58f91c4c65` |
| Loại tài liệu | Quy trình thực hành và bàn giao cho agent tiếp theo |

Tài liệu này chỉ dẫn cách thực hiện và cách chứng minh kết quả. Nó không xác
nhận code upstream, DB, thư viện dùng chung hoặc bản phát hành đã được cập nhật.
Các mẫu sidecar bên dưới là đề xuất lưu bằng chứng ngoài schema API.

## 1. Cách bắt đầu một nhiệm vụ

Agent đọc master contract, tài liệu này, rồi code thực tế của repo được giao.
Trong master contract, đọc kỹ mục 4–8 về dữ liệu và pipeline, mục 13 về việc
chưa hoàn tất; tra mục 14 khi cần danh sách model tại mốc APP.

Trước khi sửa, ghi vào `session.md`:

1. Nhiệm vụ là sửa nền tảng, GEN xe mới, sửa mạch hiện có hay PORT.
2. Repo upstream và repo APP thực sự đang sử dụng; branch/commit nếu có Git.
3. Project/vehicle/circuit/record IDs, đời xe và phiên bản thuộc phạm vi.
4. Các file được phép thay đổi, đầu ra cần giao và giới hạn truy cập hiện có.
5. Nguồn ảnh, schema, thư viện và bằng chứng còn thiếu.

Nếu thiếu repo APP hoặc ảnh nguồn, vẫn xử lý các phần độc lập có đủ dữ liệu;
ghi phần chưa kiểm được là `NOT_RUN` hoặc `REVIEW_REQUIRED`. Việc thiếu một
consumer không cho phép kết luận parity hoặc PORT đã hoàn tất.

## 2. Nguồn quyết định và thuật ngữ

| Nguồn | Quyết định điều gì |
|---|---|
| Chỉ dẫn người dùng và master contract | Phạm vi và yêu cầu phải đáp ứng |
| Ảnh gốc đúng record/xe/đời/phiên bản | Linh kiện, chân, dây, chữ và topology cần tái dựng |
| Registry, schema, validator hiện hành | Model/version và cấu trúc dữ liệu được consumer hỗ trợ |
| Render Studio và render APP thật | Hành vi hiển thị ở từng consumer |
| Inventory và biên bản review | Mức độ đầy đủ, finding và verdict theo đúng revision |
| JSON cũ, gallery, OCR, báo cáo test | Tài liệu hỗ trợ; mỗi loại có phạm vi kiểm chứng riêng |

Khi nguồn mâu thuẫn, ghi hai bằng chứng và vùng mâu thuẫn. Không tự đổi ảnh
thành topology quen thuộc, cũng không dùng schema cũ để ghi đè dữ kiện đọc từ ảnh.

- **GEN:** đọc nguồn, lập inventory, chọn model, tạo schema và bố cục.
- **PORT:** kiểm gói bàn giao, import bằng helper, render APP và kiểm hồi quy.
- **Model:** định nghĩa hình học và chân có ID/version, dùng lại giữa nhiều mạch.
- **Instance:** một linh kiện trong một mạch, có ID, bounds, terminal và nhãn riêng.
- **Graph/topology:** các chân và quan hệ nối điện; nét nhìn thấy không thay thế graph.
- **Presentation:** khung, chú thích, alias và nét trình bày có role/owner xác định.
- **Round-trip:** dữ liệu đi qua API → editor → export → importer → APP mà giữ đủ ý nghĩa.

Ảnh trả lời “mạch cần có gì”; registry trả lời “biểu diễn bằng model nào”. Không
lấy hình giống nhau hoặc số chân giống nhau làm chứng cứ hai linh kiện cùng nghĩa.

## 3. Nhận diện workspace hiện tại

Các đường dẫn trong bảng tính từ thư mục chứa tài liệu này. Đây là những nguồn
cục bộ đã kiểm tra khi viết tài liệu, không phải danh sách code đang deploy.

| Đường dẫn | Cách sử dụng |
|---|---|
| `FILE ANH/` | Tìm ảnh ứng viên; đối chiếu record và hash trước khi dùng làm nguồn |
| `FILE GEN JSON/` | Candidate cũ để kiểm; không dùng làm đáp án inventory |
| `File JSON chuẩn/` | Bộ đã đóng gói trước đây; tên thư mục không chứng nhận đúng toàn bộ |
| `Bản sửa đã đối chiếu/` | Các sửa đổi có phạm vi xác minh; vẫn kiểm trạng thái từng mạch |
| [README checker](tools/diagram_check/README.md) | Checker chuyên cho 10 ảnh AirBlade 2011–2012 đã khóa nguồn |
| [README starter](agent-web-kit/README.md) | Mẫu đối chiếu và kiểm bundle; cần adapter nếu schema khác |
| [Workflow bản tích hợp](review/diagram-studio-tools-integration/docs/diagram-tools-workflow.md) | Tham khảo thao tác Studio của bản sao tích hợp |
| `review/diagram-studio-tools-integration/` | Bản sao code và manifest lịch sử; xác minh upstream hiện tại trước khi sửa |
| `DiagramPreview.tsx`, `DiagramJsonEditor.tsx`, `export-diagram-image.ts` ở root | File rời để tham khảo; không tự suy đang được app dùng |

Workspace root hiện không có Git repository. Bản sao tích hợp có một số file
upstream nhưng không có `apps/api/src/diagram-projects/local-diagram-json.ts`
tại lúc kiểm. Đường dẫn trong master contract là điểm tìm kiếm ở repo thật.

Bốn tài nguyên master contract nhắc đến chưa có tại đường dẫn tương đối trong
workspace này: `symbol-migration-audit-2026-10-12.json`,
`server-source-evidence-2026-10-12.json`, `symbol-models-v1/index.html` và
`symbol-models-v1/index.json`. Agent cần lấy chúng từ gói APP/repo đúng revision
nếu nhiệm vụ cần audit hoặc gallery; không tạo file rỗng rồi coi là đã có bằng chứng.

## 4. Quy tắc bắt buộc trong mọi lần làm

1. Giữ bytes ảnh gốc. Crop/rotate/scale tạo artifact mới và lưu transform cùng
   phép nghịch đảo để trace về tọa độ nguồn. Không crop mất chữ hoặc đầu tải.
2. Lập inventory bằng cách đọc ảnh độc lập trước khi tạo candidate. OCR chỉ
   đề xuất; không tự lấy candidate làm reference của chính nó.
3. Mỗi component mới dùng `symbolRef.id/version` được cả Studio và APP hỗ trợ.
   Không dựng body SVG tùy ý cho model đã đăng ký hoặc ép unknown thành generic.
4. Map đủ port role tới terminal đã xác minh; không suy cực từ thứ tự mảng,
   vị trí trên trang hoặc màu dây đơn lẻ.
5. Kiểm graph và drawing cùng nhau. Thêm một nét vào preview không tự bổ sung
   wire semantic; sửa graph không được để drawing cũ lệch khỏi dữ liệu.
6. Giữ mọi continuation, danh sách tải, nhãn và annotation có nghĩa điện.
7. Sửa đúng lớp gốc; giữ warnings, reviewIssues, status, timestamps và provenance.
8. Review phải gắn với hash artifact cuối. Thay ảnh/schema hoặc renderer ảnh
   hưởng hình vẽ thì làm lại review liên quan.
9. Reviewer APP độc lập với tác giả GEN/PORT, kiểm read-only. Tự kiểm lần hai
   của cùng tác giả không được ghi thành review độc lập.
10. Chỉ báo hoàn thành phần có bằng chứng. Import, render, test, DB DONE, push
    và phát hành phải được báo thành các kết quả riêng.

## 5. Chuẩn bị môi trường và gói bằng chứng

Tạo thư mục riêng cho lần làm, ví dụ
`review/handoff-2026-10-12/<vehicle-id>/<circuit-key>/r01/`. Khi có sửa tiếp,
tạo revision mới hoặc lưu lịch sử đủ để truy lại candidate và verdict cũ.
Không ghi đè ảnh nguồn, reference đã khóa hoặc kết quả của lần trước.

Gói mỗi mạch nên có:

```text
r01/
  source.<original-extension>    # bytes nguồn đúng record
  source.json                   # identity, kích thước, hash, provenance
  transforms.json               # nếu có crop/rotate/scale
  inventory.json                # dữ kiện đọc độc lập từ nguồn
  candidate.json                # schema đúng contract thực tế
  findings.md                   # thiếu/thừa/chưa rõ, sửa ở đâu, bằng chứng
  gen-review.json                # verdict và checklist của GEN
  app-review.json                # verdict và checklist độc lập của APP
  evidence.json                  # hash, revisions, validation, delivery verdict
  previews/                      # Studio/APP, sáng/tối, toàn mạch và detail
  checks/                        # logs, exit code, round-trip diff, repeat sync
```

Tên file này là quy ước tổ chức bằng chứng, không phải API bắt buộc. Chỉ tạo
artifact thực tế đã có; file review chưa thực hiện phải giữ trạng thái PENDING.
Ghi thời điểm ISO 8601 có timezone; không lưu credential hoặc URL chứa token.
Hash tính trên bytes file thực được bàn giao, không chỉ trên object đã parse.

## 6. GEN: từ ảnh đến schema được review

| Bước | Thực hiện | Đầu ra và điều kiện qua bước |
|---|---|---|
| G0 — Chốt nguồn | Kiểm record/xe/đời/phiên bản; lấy ảnh gốc, tính hash; ghi crop/transform nếu dùng | Provenance và ảnh đúng nguồn; ảnh thiếu/mờ chỉ đủ làm draft |
| G1 — Inventory | Đọc từng vùng ảnh, chép mọi component, terminal, nhánh, tải, chữ, giắc và annotation | Mỗi item có ID nguồn, sourceBox/vị trí; ghi rõ vùng chưa đọc được |
| G2 — Sinh có ràng buộc | Chọn model/version từ manifest được hai consumer hỗ trợ; map ports, dựng graph và layout | Candidate đúng schema; unknown giữ finding/reviewIssues |
| G3 — Validate và round-trip | Chạy validators; đi qua API/editor/export/import; kiểm field và ý nghĩa sau vòng | Không mất field, không unsupported, không lệch topology hoặc metadata |
| G4 — GEN review | Đối chiếu inventory → candidate → Studio render và ảnh gốc | Ghi missing/extra/unresolved, kiểm điện học theo nguồn, chốt hash cuối |

Trong G1, lần lượt kiểm nguồn/mass, các linh kiện, nhánh dây, đầu tải, rồi chữ
và nét phụ; đọc lại toàn mạch để phát hiện các vùng chưa được inventory phủ.
Mỗi lần xuất hiện của một chữ là một item riêng, kể cả nội dung trùng nhau.
Phân biệt rõ junction với crossing không nối và khoang giắc với chân đang có dây.

Inventory tối thiểu cần loại item, nội dung quan sát, vùng nguồn, mapping sang
candidate và trạng thái xác minh. Ví dụ sau là **sidecar minh họa**, không phải
schema linh kiện; tọa độ và nội dung không đại diện cho một xe thực:

```json
{
  "sourceImageSha256": "<sha256-of-original-bytes>",
  "coordinateSpace": "original-image-pixels",
  "items": [
    {
      "sourceItemId": "src-load-list-01",
      "kind": "continuation",
      "sourceBox": {"x": 100, "y": 200, "width": 250, "height": 90},
      "observedText": ["Đến ECM", "Đến bơm xăng"],
      "candidateIds": ["load-out-01"],
      "verification": "PENDING"
    }
  ],
  "unreadableRegions": []
}
```

Trước G4, kiểm cả hai chiều: mỗi source item có representation phù hợp; mỗi
đối tượng điện và annotation trong candidate có bằng chứng nguồn. Mapping 1:1
không bắt buộc, nhưng quan hệ nhóm/tách phải rõ và không bỏ ý nghĩa điện.

## 7. PORT: từ gói bàn giao đến nghiệm thu trên APP

| Bước | Thực hiện | Đầu ra và điều kiện qua bước |
|---|---|---|
| P0 — Nhận gói | Kiểm IDs, ảnh/hash, schema/hash, library revision/digest, inventory và GEN verdict | Thiếu bằng chứng: stage draft với lý do |
| P1 — Dry-run | Dùng helper importer; kiểm source identity, registered/loaded, circuit keys, conflicts, duplicates và diff | Áp dụng đúng phạm vi được giao; giữ metadata, warnings và trạng thái |
| P2 — APP render | Render bằng componentRegistry/WireLayer thực tế; lưu revision và preview/hash | Xem toàn mạch và chi tiết, sáng/tối; không dùng SVG Studio thay APP render |
| P3 — Review độc lập | Reviewer tự đọc ảnh đúng hash và kiểm graph + drawing + APP render | Checklist theo nguồn; tác giả tích hợp sửa, reviewer kiểm lại artifact cuối |
| P4 — Chốt và hồi quy | Sync cùng snapshot lần hai, kiểm zero diff; chạy gate và regression liên quan | Lưu cả GEN/APP verdict, logs, hash cuối và verdict riêng cho phạm vi |

Dry-run là căn cứ xác định tác động trước apply. Chỉ apply khi nhiệm vụ hiện
tại đã giao phạm vi đó; không dùng tài liệu này để tự mở rộng quyền sửa DB,
đổi progress/status hàng loạt, xóa xe hoặc phát hành.

Nếu chưa có reviewer độc lập, chuẩn bị gói đủ để người/agent khác review và giữ
`appReview=PENDING`, `deliveryVerdict=REVIEW_REQUIRED`. Không tạo danh tính giả
hoặc đổi tên cùng một người để đủ hai verdict.

## 8. Quy tắc chọn symbol và dựng hình

Tra manifest/schema/validator hiện hành để dùng field và bounds chính xác;
bảng dưới là các điểm dễ sai từ feedback, không thay thế toàn bộ registry.

| Trường hợp | Quy tắc thực hiện |
|---|---|
| Ports cố định | Đủ role bắt buộc, không trùng terminal, không thêm chân không được model thể hiện |
| `portMode: instance` | Mỗi terminal map chính nó; các chân vẫn độc lập, không tự nối chung trong hộp |
| Nhánh chỉ có chữ tải | `continuation.loads` có terminal nguồn, `targets` không rỗng và dây đến đúng anchor; giữ mọi dòng |
| Mô-bin/bugi đúng topology mẫu | `ignition.module3`: hai chân sơ cấp độc lập + `hv`; edge đến `spark-plug.chassis1.hv`; không nối kín khe hở |
| Máy phát | Chỉ dùng `generator.star3` khi nguồn chứng minh ba cuộn nối sao; không alias ACG chưa rõ |
| Ắc quy, diode, tụ phân cực | Giữ đúng cực khi xoay/đặt lại; tên role vị trí cũ không được diễn giải lại theo trang |
| Đèn | Phân biệt LED/sợi đốt đơn/kép/module; không cho chân hội tụ ở tâm như chập |
| `lamp.dual-filament3` | Tôn trọng layout hiện có: vào trái, Y common/high/low; ngoài khả năng phải bổ sung geometry được review |
| Relay/công tắc | Phân biệt coil/contact và từng pole; không suy nối trong từ hình hoặc số chân |
| Giắc và pinout | Phân biệt `connector.paired*` với `assembly.pinout`; giữ vỏ B/C, ô, shape, bounds, contactBounds và nhãn độc lập |
| Khoang không có dây | Giữ hình khoang theo nguồn; không bịa terminal/dây/nhãn để đủ số lỗ |
| Presentation alias | Có owner thật, không mang chân hoặc owned drawing; không dùng để che model thiếu |
| Model `requiresReview` | Giữ `reviewIssues`; DetailedLamp thuộc diện yêu cầu phải giữ `symbolChannels` theo validator |

Hình học thuộc thư viện, tên/chân/khoang giắc/tư thế thuộc instance. SVG gallery
chỉ là instance mẫu; không dùng 65 SVG cố định rồi kéo giãn thay shared geometry.

Nguồn schema giữ geometry gốc. Tại mốc APP, render fit về cạnh dài 1440 với
inverse transform cho tương tác; không scale hai lần. WireLayer tại mốc này
dùng outline 5, màu 3.5, stripe 1.5, dash 7/5, nhãn 13 bold nền trắng. Kiểm
implementation hiện tại trước khi đồng bộ; không tạo engine nét riêng từng xe.

Giữ mã màu dây, nhãn, rotation/anchor theo nguồn; không suy mã từ RGB gần nhất.
Graphics có role/owner rõ; không mặc định path chưa tag là annotation. Sáu
template tại mốc contract là frame, note-frame, DTC, no-start, radio-link và
terminal-bridge; chiều mũi tên là dữ liệu cần giữ. Compatibility binder APP
không chứng minh annotation API upstream đã được triển khai.

## 9. Triển khai nền tảng trước khi mở rộng GEN

Áp dụng mục này khi nhiệm vụ là nâng cấp Auto2Tech để đáp ứng feedback.

| Thứ tự | Công việc | Bằng chứng acceptance |
|---|---|---|
| A | Chốt registry + geometry + validators theo revision; tạo shared package hoặc vendor nguyên bộ có digest | Hai consumer dispatch đúng models, ports/geometry fixtures và parity |
| B | Cập nhật API output, local import, web contract, serializer và importer cùng tuyến | Round-trip giữ field; unsupported ID/version bị báo lỗi |
| C | Đưa preview/editor về shared models và wire style | Cùng model có hình/ports thống nhất; bỏ body inline cũ của model đã biết |
| D | GEN inventory trước JSON; cung cấp manifest và constraints vào pipeline | Nhánh chữ/off-page còn đủ; unknown không bị generic hóa |
| E | Lưu provenance, findings, checklist và hai verdict theo hash | Không DONE chỉ vì có JSON hoặc test xanh |
| F | Pilot một xe mới, review mọi mạch theo ảnh gốc | Sửa ở GEN/library, đủ inventory và preview hai consumer |
| G | Sync lại cùng snapshot và regression xe cũ | Zero diff, topology cũ giữ nguyên, occurrence ảnh hưởng được review |

Với vendor copy, lưu commit/digest và CI kiểm parity. Không sửa hai bản độc lập
cùng version. Sửa presentation cần changelog/digest/visual regression; sửa
ý nghĩa chân hoặc topology cần version mới và migration được review.

Điểm tìm code Auto2Tech: `apps/api/src/diagram-ai/diagram-ai.service.ts`,
`apps/api/src/diagram-projects/local-diagram-json.ts`,
`apps/api/src/diagram-projects/diagram-projects.service.ts` và các file
`contract.ts`, `validate-diagram.ts`, `DiagramPreview.tsx`,
`deterministic-json.ts`, `kit-image.ts` trong `apps/web/src/diagram-studio/`.
Các tên này phải được kiểm lại tại repo upstream hiện hành.

## 10. Xử lý feedback và sửa đúng lớp

Mỗi finding ghi: ID, circuit/component/source item, sourceBox hoặc mô tả vị trí,
hiện tượng, expected theo ảnh, actual, artifact/hash liên quan, lớp cần sửa,
trạng thái và bằng chứng kiểm lại. Đóng finding khi artifact cuối đã được kiểm;
không đóng chỉ vì đã viết patch.

| Finding | Lớp sửa | Kiểm lại bắt buộc |
|---|---|---|
| Sai hình/nét dùng chung | Shared geometry/renderer | Hai consumer và mọi occurrence bị ảnh hưởng |
| Chọn sai model/port role | GEN/schema upstream | Export mới, graph và ảnh nguồn |
| Thiếu nhánh/tải/nhãn/chân | Inventory + GEN/schema | Coverage và endpoints, sau đó render |
| Field biến mất sau export | Contract/serializer/importer | Round-trip field đó cùng metadata liên quan |
| Chồng chữ, mất đầu tải, sai aspect | Layout GEN/source | Toàn mạch, zoom và preview hai consumer |
| Thiếu ảnh/không rõ điện học | Nguồn + review | Giữ draft/reviewIssues đến khi có chứng cứ |

Ví dụ: danh sách “Đến ECM/Đến bơm” bị mất thì bổ sung continuation và targets
trong schema từ inventory; vẽ thêm chữ ở APP không đủ. Giắc 10 khoang có 9
chân nối dây thì giữ bảng khoang và 9 terminal có chứng cứ, không bịa chân thứ 10.

Adapter APP cho legacy phải có guard snapshot/source fingerprint, trace và
điều kiện gỡ. Khi upstream xuất payload đã đúng, kiểm trước khi bỏ adapter;
không để patch cũ áp lần hai. Tránh thêm nhánh `if vehicleId` trong renderer.

## 11. Kiểm chứng và diễn giải kết quả

### 11.1. Những phép kiểm phải phân biệt

| Phép kiểm | Chứng minh | Chưa tự chứng minh |
|---|---|---|
| JSON/schema/ports | Cấu trúc, tham chiếu và bounds hợp lệ trong phạm vi validator | Đúng xe, đúng ảnh, đủ nhánh hoặc đúng điện học |
| Round-trip | Fields và ý nghĩa đã so sánh được giữ qua tuyến | Nguồn ban đầu được đọc đúng |
| Render thật | Consumer hiển thị artifact tại revision ghi nhận | Đúng topology hoặc đủ inventory |
| So bitmap/OCR | Các vùng cần nhìn lại | PASS điện học hoặc chữ đã chính xác |
| Double review | Hai kiểm tra theo nguồn, checklist và hash đã ghi | Native build/device/store release |
| Sync lần hai zero diff | Cùng snapshot không làm thay đổi file lần nữa | Phạm vi chưa được review đã đúng |

Round-trip so sánh IDs, terminals/roles, endpoints/points, mã màu, target list,
symbol channels, reviewIssues, grouped pinout, drawing roles/owners,
annotation và provenance. Nếu serializer chuẩn hóa định dạng, ghi quy tắc
chuẩn hóa; so cấu trúc và ý nghĩa, đồng thời hash đúng bytes artifact cuối.

Checklist người duyệt phải có: nguồn/mass, từng chân và cực, relay coil/contact,
diode/tụ, junction/crossing, off-page/targets, mã màu/chữ/số/đơn vị, khoang
giắc và pinout, nhánh bị che/cắt, nội bộ module còn bất định, toàn mạch và zoom.
Ghi item/checklist thực đã xem; không chỉ đổi PENDING thành PASS.

### 11.2. Công cụ chạy từ workspace hiện tại

Đọc README của tool và kiểm dependencies trước khi chạy. Dùng thư mục output
mới để giữ kết quả cũ. Các lệnh dưới dành cho dữ liệu legacy đúng phạm vi,
không thay validator symbolRef của APP hiện hành.

```powershell
# Checker chuyên cho 10 ảnh AirBlade đã khóa hash/reference.
python tools/diagram_check/check.py --input "Bản sửa đã đối chiếu/01.AirBlade-2011-2012" --out "review/check-<session-id>"

# Khi sửa checker hoặc reference: kiểm khả năng bắt các lỗi cố ý.
python tools/diagram_check/test_checker.py

# Dựng cục bộ để quan sát; đây chưa phải render APP thật.
python tools/render_schematic.py "<candidate.json>" --out "review/render-<session-id>" --scale 2

# Hash bytes artifact; điền đường dẫn thực trước khi chạy.
Get-FileHash -LiteralPath "<source-file>" -Algorithm SHA256
Get-FileHash -LiteralPath "<candidate.json>" -Algorithm SHA256
```

Checker và starter hiện không cấp PASS: exit 1 có lỗi; exit 2 còn phần chưa
xác minh. Không đổi exit 2 thành thành công. Không tái dùng reference/hash
AirBlade cho xe mới; phải đọc nguồn mới và mở rộng adapter/checker phù hợp.
`repair_verified.py` và các script repair/build có ghi file, chỉ chạy khi
nhiệm vụ thực sự yêu cầu tạo/sửa dữ liệu và đã kiểm phạm vi ghi.

### 11.3. Kiểm Auto2Tech và APP trong repo tương ứng

Tại root Auto2Tech thật, kiểm `package.json` và scripts hiện hành. Bản sao
tích hợp có các lệnh dưới; agent xác minh lại trước khi dùng cho upstream:

```powershell
npm test --workspace=@auto2tech/web
npm run build --workspace=@auto2tech/web
npm test --workspace=@auto2tech/api -- diagram-ai diagram-projects
```

Tại root APP thật, các lệnh master contract dùng cho import/audit là:

```powershell
node --test scripts/diagrams/sync-studio.test.cjs
node scripts/diagrams/audit-symbol-models.cjs --strict
node scripts/diagrams/sync-studio.cjs --vehicle <vehicle-id>
git diff --check
```

Lệnh regression Jest và lệnh `--apply` xem mục 8 master contract; chuyển đúng
cú pháp theo shell thực tế. Không chạy apply trong nhiệm vụ chỉ đọc/viết tài
liệu. Mỗi lần kiểm lưu cwd/revision, câu lệnh, exit code, phạm vi, log và nhận
định. Dùng `NOT_RUN` nếu thiếu môi trường; không chép kết quả test lịch sử.

Fixtures cần giữ khi thay thư viện/pipeline: battery xoay vẫn đúng cực; fuse
dùng chung; generator đúng topology; lamp2/dual3 đúng role; relay4/5 và diode;
coil–plug dọc/ngang với semantic edge; B/C pinout tách vỏ; continuation đủ tải;
wire style nhất quán; round-trip và unsupported version; adapter không áp
trên fingerprint mới. Regression renderer bao phủ occurrence xe cũ bị ảnh hưởng.

## 12. Trạng thái và tiêu chí hoàn thành

Các tên dưới là trạng thái biên bản/sidecar, không tự ánh xạ thành enum hoặc
progress DB của server nếu contract hiện hành chưa có.

| Trạng thái | Điều kiện ghi nhận |
|---|---|
| `DRAFT` | Candidate đang tạo/sửa hoặc thiếu dữ liệu cần xác minh |
| `FAIL` | Có lỗi cụ thể trong structural check hoặc đối chiếu nguồn |
| `REVIEW_REQUIRED` | Chưa đủ nguồn, coverage, gate hoặc review độc lập |
| `PORT_COMPLETE` | Từng mạch trong phạm vi đạt toàn bộ checklist dưới đây |
| Release/build/device | Chỉ ghi kết quả riêng khi có bằng chứng tương ứng |

Checklist cho **mỗi mạch** trước khi ghi `PORT_COMPLETE`:

- [ ] Đúng source identity, đời/phiên bản; ảnh gốc và candidate cuối có hash.
- [ ] Inventory độc lập phủ mọi component/chân/nhánh/tải/chữ/annotation có nghĩa.
- [ ] Không thiếu/thừa hoặc bất định chưa xử lý; findings được kiểm lại trên bản cuối.
- [ ] Model/version được Studio và APP hỗ trợ; mọi terminal map đúng role.
- [ ] Structural check và round-trip đạt, giữ topology cùng metadata.
- [ ] Studio và APP thật có preview toàn mạch/detail, sáng/tối đọc được.
- [ ] GEN review đạt theo hash cuối.
- [ ] Reviewer APP độc lập đạt theo ảnh/schema/render revisions cuối.
- [ ] Sync lần hai cùng snapshot zero diff; regression liên quan đạt.
- [ ] Gói evidence đầy đủ, trạng thái DB/push/release được báo riêng.

Một xe chỉ hoàn tất khi mọi mạch trong phạm vi đạt. Findings ngoài phạm vi được
ghi baseline riêng; finding mới không được giấu vào baseline cũ. Khi audit
tổng catalog còn fail, báo cả exit code tổng và verdict phạm vi cùng lý do.

## 13. Mẫu evidence để bàn giao từng mạch

Đây là **sidecar đề xuất**. Không thêm các field này vào strict schema trước
khi cả hai consumer hỗ trợ. Placeholder phải được thay bằng dữ liệu thật;
giữ PENDING nếu chưa thực hiện bước tương ứng.

```json
{
  "vehicleId": "<stable-id>",
  "circuitKey": "<circuit-key>",
  "source": {
    "recordId": "<source-record-id>",
    "updatedAt": "<source-timestamp-with-timezone>",
    "imageSha256": "<sha256-of-original-bytes>"
  },
  "schemaSha256": "<sha256-of-final-candidate-bytes>",
  "library": {
    "revision": "<verified-commit-or-release>",
    "manifestSha256": "<verified-manifest-digest>"
  },
  "inventoryArtifact": "inventory.json",
  "coverage": {"missing": [], "extra": [], "unresolved": []},
  "genReview": {
    "reviewer": "<actual-gen-reviewer>",
    "date": "<ISO-8601-with-timezone>",
    "verdict": "PENDING",
    "checklistArtifact": "gen-review.json"
  },
  "appReview": {
    "reviewer": "<actual-independent-reviewer>",
    "date": "<ISO-8601-with-timezone>",
    "verdict": "PENDING",
    "rendererRevision": "<verified-app-commit>",
    "previewSha256": "<sha256-of-app-preview-bytes>",
    "checklistArtifact": "app-review.json"
  },
  "validation": {
    "structural": "PENDING",
    "roundTrip": "PENDING",
    "repeatSyncNoDiff": "PENDING",
    "logsArtifact": "checks/"
  },
  "deliveryVerdict": "REVIEW_REQUIRED"
}
```

Coverage arrays rỗng trong mẫu không có nghĩa đã phủ nguồn. Biên bản phải ghi
mapping từng item và vùng đã đọc. Các field bổ sung so với mẫu master contract
chỉ tổ chức checklist/log; không tuyên bố là API server có sẵn.

Bàn giao cả `session.md`: mục tiêu, việc đã làm, files/artifacts thay đổi,
kiểm chứng thực đã chạy, findings còn mở và bước tiếp theo cụ thể. Agent sau
phải biết việc nào đã chứng minh, việc nào đang chờ và đọc artifact nào để tiếp tục.

## 14. Baseline feedback phải giữ nguyên ý nghĩa

Các số sau lấy từ master contract tại APP commit
`ad079ec2c0502cefb0634a783fe02a4f018e95fb`; chưa được audit lại trong workspace này.

- Catalog 5 xe/57 mạch; registry 65 model; 1.252 đối tượng có symbolRef.
- 106 presentation aliases không được tính thành linh kiện điện mới.
- 13 review components còn mở: 11 cụm đèn và 2 cụm chống nghiêng.
- 21 ảnh gốc đã lấy; 36 record thiếu ảnh tại thời điểm kiểm.
- Strict audit còn exit 1 vì 13 reviewIssues; test pass không đóng findings này.
- GPS AirBlade cũ có bảng khoang 10P chưa được managed schema thể hiện đầy đủ;
  9 terminal có dây không cho phép bịa terminal thứ 10.
- Compatibility corrections/binders APP còn cần backport theo record và re-export.
- Shared package, GEN/validators/preview/serializer/CI upstream chưa được chứng
  minh hoàn tất bởi commit APP; không có bằng chứng release mới.

Manifest digest tại mốc trên:
`5ae13408872198c4fca89b7682c2f36766a27ce7255b5fbf346d8edc8f528f24`.
Không dùng digest/số lượng này làm mục tiêu cố định cho revision mới; kiểm
manifest và audit thật, ghi changelog nếu baseline thay đổi.

## 15. Prompt ngắn để giao agent tiếp theo

```text
Đọc AGENTS.md, AUTO2TECH_GEN_PORT_MASTER_CONTRACT_2026-10-12.md và
AUTO2TECH_AGENT_WORK_METHOD.md trong workspace. Kiểm repo, commit, schema,
registry, renderer thực tế trước khi sửa; review/ chỉ là bản sao/tham khảo.

Phạm vi nhiệm vụ: <GEN / sửa upstream / PORT>, xe <ID + đời + phiên bản>,
mạch <circuit keys>, nguồn <record IDs hoặc đường dẫn>, đầu ra <gói cần giao>.

Giữ ảnh gốc và IDs; ghi provenance/hash. Lập inventory độc lập từ ảnh trước
candidate. Chọn symbolRef ID/version được cả Studio và APP hỗ trợ, map đủ
ports; không bịa topology/chân/cực hoặc ép unknown thành generic. Giữ mọi
nhánh tải, continuation targets, pinout, chữ và annotation có nghĩa điện.

Sửa tại lớp gốc, kiểm structural + round-trip + render thật hai consumer.
Ghi missing/extra/unresolved với sourceBox. Chốt GEN verdict theo hash cuối;
chuẩn bị gói cho reviewer APP độc lập, tích hợp sửa và kiểm lại artifact cuối.
Sync lần hai cùng snapshot phải zero diff; thay library kiểm xe cũ bị ảnh hưởng.

Thiếu nguồn/quyền/consumer/reviewer thì ghi rõ phần chưa kiểm, giữ draft hoặc
REVIEW_REQUIRED và hoàn thành phần độc lập có đủ bằng chứng. Báo files đã đổi,
checks thực chạy, findings còn mở và bước tiếp theo. Chỉ ghi PORT_COMPLETE khi
mọi mạch trong phạm vi đạt checklist; DB DONE/push/release là kết quả riêng.
```

## 16. Bảo trì tài liệu

Khi contract hoặc implementation thay đổi, cập nhật mục bị ảnh hưởng, tăng
version tài liệu và ghi revision/bằng chứng. Giữ liên kết và lịch sử baseline;
không âm thầm đổi verdict cũ. Không sao chép toàn bộ bảng 65 model vào đây:
registry hiện hành và phụ lục master contract là điểm tra cứu tránh lệch bản.

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 1.0 | 12/10/2026 | Quy trình GEN/PORT theo feedback; nguồn cục bộ, gói evidence, gates, tiêu chí hoàn thành và prompt tiếp nối |


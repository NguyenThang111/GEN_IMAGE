# Auto2Tech → EasyScan: quy chuẩn GEN, Symbol và PORT

Ngày chốt: 12/10/2026. Phạm vi: Diagram Studio/GEN Auto2Tech và catalog sơ đồ offline EasyScan.

**Bản triển khai APP làm mốc: `ad079ec2`.** Tài liệu là yêu cầu bàn giao upstream; không chứng minh Auto2Tech đã sửa code, cập nhật DB hoặc deploy. Khi triển khai phải kiểm lại Git/code Auto2Tech hiện tại; các đường dẫn upstream dưới đây là điểm tìm kiếm, không phải cam kết về số dòng hay API đang chạy.

## 1. Mục tiêu và tiêu chí hoàn thành

Một model symbol có một định nghĩa hình học và quy tắc chân theo phiên bản. GEN chọn model, điền dữ liệu của linh kiện; Studio và APP dùng cùng định nghĩa. PORT kiểm tra và nhập dữ liệu, không thường xuyên vẽ lại hình hoặc bù nhánh tải bị GEN bỏ sót.

Xe tiếp theo **vẫn phải review từng mạch theo ảnh gốc**. Thư viện đúng không chứng minh GEN chọn đúng biến thể, nhận đúng chân hoặc chép đủ dây. Thay đổi thư viện không được làm biến đổi topology của các xe đã có.

Một xe được bàn giao hoàn tất khi:

- Từng mạch có nguồn đúng xe/đời/phiên bản, hash ảnh và hash schema được chốt.
- GEN review ảnh → schema đạt; reviewer độc lập review ảnh → schema → render APP đạt.
- Không thiếu/thừa symbol, chân, nhánh, đích tải hoặc ghi chú có ý nghĩa điện; không còn bất định chưa xử lý.
- Mỗi symbolRef được cả Studio và APP hỗ trợ đúng phiên bản và ánh xạ đủ chân.
- Studio/export/import/APP giữ nguyên topology và metadata; preview toàn mạch và chi tiết đọc được.
- Sync lại cùng nguồn không đổi file; kết quả kiểm chứng được ghi theo đúng revision.

“Import được”, “render được”, “test pass”, “DONE trên DB”, “đã push” và “đã phát hành” là các trạng thái khác nhau.

## 2. Hiện trạng đã xác minh ở APP

| Hạng mục | Bằng chứng tại mốc APP |
|---|---|
| Catalog | 5 xe,57 mạch |
| Thư viện | 65 model,1.252 đối tượng có symbolRef |
| Metadata phụ | 106 presentation aliases; không tính là linh kiện điện mới |
| Ánh xạ chưa có / orphan / nét chưa phân loại | 0 / 0 / 0 |
| Chờ xác minh nội bộ | 13 đối tượng:11 cụm đèn,2 cụm chống nghiêng |
| Schema nguồn | 57/57 managed schema khớp cấu trúc với snapshot đọc từ DB ngày12/10 |
| Ảnh gốc đã lấy | 21;36 record không có ảnh gốc tại thời điểm kiểm |
| Regression APP | 205 test/22 suite pass;17 test import pass |
| Gate strict | Vẫn exit1 vì13 reviewIssues; không coi là duyệt điện học |
| Sơ đồ FI cơ bản trong Live Data | Đã gỡ; không phải một phần catalog57 mạch |

Các số này là snapshot của mốc trên. Audit mới và code mới thắng số liệu trong tài liệu. Chi tiết từng đối tượng cần review nằm ở [audit JSON](symbol-migration-audit-2026-10-12.json); ảnh/schema provenance ở [source evidence](server-source-evidence-2026-10-12.json).

## 3. Nguồn chuẩn và cách đồng bộ thư viện

Các đường dẫn dưới tính từ root repo APP:

| Nguồn | Vai trò |
|---|---|
| `src/v4/components/ElectricalDiagram/symbolModels.json` | Registry duy nhất: ID/version/type/acceptedTypes/renderer/ports/portMode/requiresReview |
| `schema.ts` cùng thư mục | Contract dữ liệu APP hiện có |
| `componentRegistry.tsx` | Dispatch model → renderer cho cả semantic và Studio |
| `ActuatorSymbols.tsx`, `PowerSymbols.tsx`, `LampSymbol.tsx`, `SwitchingSymbols.tsx`, `SensorSymbols.tsx`, `AssemblySymbols.tsx`, `StructuralSymbols.tsx` và renderer cơ bản | Hình học có tham số; không phải SVG tùy ý do GEN viết |
| `symbolModelBindings.ts`, `pinoutValidation.js` | Gate runtime model/port/layout và pinout |
| `renderPresentation.ts`, `WireLayer.tsx` | Chuẩn tỷ lệ, nét dây và nhãn |
| `scripts/diagrams/sync-studio.cjs` | Validation/import offline; không phải bằng chứng duyệt ảnh |
| [Gallery SVG](symbol-models-v1/index.html), [index/hash](symbol-models-v1/index.json) | Mẫu render thật từ APP để so sánh; mỗi file là một instance minh họa |

**Không lấy65 SVG mẫu làm65 ảnh cố định rồi kéo giãn tùy ý.** Model phải tính hình học theo bounds và port roles, giữ vị trí chân thực. Tên linh kiện, số chân, số khoang giắc, tư thế và nhãn thuộc instance. Hai battery trên hai xe không phải hai model battery khác nhau.

### Kiến trúc đích cần triển khai ở Auto2Tech

1. Đóng gói registry, geometry primitives và validators thành tài nguyên có version dùng được ở web và React Native; hai adapter chỉ chuyển primitives sang SVG của nền tảng.
2. Nếu giai đoạn đầu cần vendor copy: chép nguyên bộ đã chốt, lưu commit/digest; CI so sánh parity. Không sửa hai bản độc lập rồi cùng giữ một version.
3. API GEN, editor preview, validator, export, importer và APP công bố cùng revision thư viện trước khi cho GEN phát model đó.
4. Thêm model mới bằng review nguồn + ports + fixtures + hỗ trợ cả hai consumer. Không tự tạo alias để ép linh kiện khác nghĩa về model có sẵn.
5. Thay đổi hình học thuần trình bày phải có changelog, digest và visual regression. Thay đổi ý nghĩa chân/topology phải có migration và version mới; không diễn giải lại dữ liệu cũ âm thầm.

APP hiện chưa có package geometry dùng chung với Auto2Tech. Đó là việc upstream cần làm; tài liệu và gallery không tự tạo ra đồng bộ runtime.

## 4. Contract instance và ý nghĩa điện

Ví dụ component hợp lệ về hình thức, tọa độ chỉ minh họa, không phải pinout xe cụ thể:

```json
{
  "id": "headlamp",
  "type": "lamp",
  "label": "Đèn pha/cos",
  "x": 100, "y": 100, "width": 100, "height": 80,
  "terminals": [
    {"id": "c", "x": 100, "y": 110},
    {"id": "h", "x": 100, "y": 140},
    {"id": "l", "x": 100, "y": 170}
  ],
  "symbolRef": {
    "id": "lamp.dual-filament3", "version": 1,
    "ports": {"common": "c", "high": "h", "low": "l"},
    "portLabels": {"high": "PHA", "low": "COS"}
  }
}
```

- `type` là phân loại; `symbolRef.id/version` mới quyết định model. Không chọn symbol chỉ từ tên xe hoặc type `device`/`lamp`/`sensor`.
- `ports`: đủ role bắt buộc, không trùng terminal, không thiếu/thừa chân. Mọi terminal phải được model thể hiện. Thứ tự mảng không phải bằng chứng role.
- `portMode: instance`: terminal ID ánh xạ chính nó, giữ độc lập các chân; không tự nối chung trong hộp chức năng.
- ID kỹ thuật như `ht`, `a`, `left` không tự trở thành số chân hãng. Chỉ gắn nhãn nguồn đã xác minh.
- Dây phải có endpoint tồn tại và points khớp tọa độ terminal. Đường nhìn thấy trong drawing không thay cho wire graph.
- Tiếp điểm/coil, diode polarity, tụ cực tính, chân chung đèn, cuộn máy phát phải dựa trên ảnh. Không suy từ số chân hay màu dây đơn lẻ.
- Các role tên vị trí cũ của `capacitor.polarized` và `regulator.three-phase5` có nghĩa đã chốt trong APP; quay hình không được đổi điện cực. Không suy “top” luôn là phía trên trang.
- `lamp.dual-filament3` hiện có ràng buộc layout chân vào trái, thứ tự Y common/high/low. Biến thể ngoài khả năng phải bổ sung geometry có review, không đảo role để qua validator.

### Nhánh ra tải / continuation

Danh sách “đến ECM/kim phun/bơm…” là một phần mạch, không phải chữ trang trí. Dùng `continuation.loads` với một terminal nguồn và `targets` không rỗng; dây cấp phải nối đúng anchor. Giữ tất cả dòng đích. Không bịa chân vật lý ECM để thỏa yêu cầu “wire phải có hai đầu”. GEN phải inventory nhánh chữ/off-page trước khi sinh graph.

### Mô-bin và bugi

Dùng `ignition.module3` với hai chân sơ cấp độc lập và `hv`, nối `hv` tới `spark-plug.chassis1.hv`. Giữ hai component và một quan hệ cao áp rõ; endpoints có thể trùng tọa độ theo nguồn nhưng vẫn phải có edge semantic. Mô-bin có thân/cổ đầu cao áp; bugi có hai điện cực đối diện, khe hở và mass. Không nối kín qua khe, không coi mass minh họa là một terminal vật lý mới. Nhãn không đè lên cổ/dây cao áp. 10 cặp hiện có là fixture hồi quy, không phải lý do tự áp topology này cho mọi hệ đánh lửa mới.

### Máy phát, ắc quy, đèn

- Máy phát cùng topology dùng lại model; mạch cấp nguồn và đèn đêm không tự có hai style. `generator.star3` chỉ dùng khi có bằng chứng ba cuộn nối sao.
- Ắc quy dùng `battery`, giữ cực dương/âm theo nguồn; xoay/đặt lại không tạo ID mới.
- Phân biệt LED, sợi đốt đơn, sợi đốt kép và module chức năng. Không ép tất cả vào bóng tròn dấu X; không cho các đường chân gặp nhau ở tâm khiến nhìn như chập.
- Đèn/cụm chức năng có kênh rõ nhưng liên kết nội bộ chưa rõ: giữ kênh/pin và cảnh báo review, không vẽ liên kết đoán.

### Giắc, bảng pinout và cụm đồng hồ

Giắc điện `connector.paired*` khác bảng khoang `assembly.pinout`. Số khoang trong ảnh không nhất thiết bằng số dây đang sử dụng. `assemblyData.pinoutGroups` phải giữ từng vỏ B/C, cell row/column, bounds, shape, contactBounds và nhãn độc lập theo schema.ts. Không dồn B/C thành một lưới đều hay tự gán nhãn gần nhất vào lỗ. Không đổi hình khoang thành wire/terminal.

Bảng số chân, chú thích, rotor, LED trong đồng hồ có model/presentation riêng; không mặc định chúng là linh kiện điện nối chung. Presentation alias cần có owner thật và không mang chân/owned drawing; không dùng alias để che một symbol chưa hỗ trợ.

## 5. Hình vẽ, annotation và phong cách chung

- Source schema lưu geometry gốc; APP chuẩn hóa bản render theo1440 đơn vị cạnh dài của vùng fit, rồi dùng inverse transform giữ tọa độ tương tác. Không scale hai lần.
- WireLayer là nguồn style: outline5, màu3.5, stripe1.5, dash7/5, nhãn13 bold có nền trắng. Không copy strokeWidth mỏng từ từng ảnh để tạo một engine riêng cho mạch còi.
- Nhãn dây giữ code/màu, vị trí/rotation/anchor nguồn; không suy code mới từ RGB gần giống.
- Cả semantic và owner-based Studio phải dispatch cùng component registry; không dùng embedded body cũ khi đã có symbolRef.
- Graphics cần role/owner rõ. Untagged path không mặc nhiên là annotation. Nét nội bộ đèn/cảm biến phải thuộc model phù hợp.
- Sáu template annotation hiện có: frame, note-frame, DTC, no-start, radio-link, terminal-bridge. Chiều mũi tên radio là dữ liệu; không quay ngược chỉ vì mẫu thuận tay.
- Contract annotation dùng chung upstream còn cần triển khai; APP hiện có compatibility binder theo source signature. Không quảng bá đó là API đã sẵn sàng ở server.
- GEN chịu trách nhiệm bố cục/aspect ratio theo nguồn, khoảng trắng, nhãn không chồng và pin không che. Dùng chung nét không tự giải quyết bố cục quá dày.
- Kiểm toàn mạch và zoom chi tiết ở cả sáng/tối; pinout phải đọc được. Không cắt mất đầu tải để vừa canvas.

## 6. Pipeline GEN bắt buộc

### G0 — Chốt nguồn và phạm vi

Chọn đúng project/vehicle/circuit IDs; xác minh đời xe và nguồn. Lấy ảnh gốc record trên server, hash bytes, lưu provenance không chứa credential/signed URL. Không thay bằng screenshot APP hoặc thumbnail. Ảnh thiếu/mờ phải ghi rõ vùng chưa đọc được; có thể lưu draft nhưng không duyệt complete.

### G1 — Inventory độc lập trước khi sinh JSON

Từ ảnh lập danh sách linh kiện/biến thể, chân/cực/nhãn, toàn bộ nhánh nguồn/mass/tải, continuation, junction/crossing, trị số, khoang giắc, annotation và vùng chưa rõ. Mỗi item có source box hoặc mô tả vị trí và ID để trace. Không lấy candidate JSON làm inventory của chính nó.

### G2 — GEN có ràng buộc registry

Model chỉ chọn trong manifest được consumer hỗ trợ; cung cấp ports và geometry thật. Giữ toàn bộ nhánh tải. Không phát SVG body tùy ý cho model đã đăng ký. Unknown variant → finding và draft; không gán model chức năng chung để làm số unresolved về0.

### G3 — Kiểm cấu trúc và round-trip

Validate API → editor → deterministic export → import bằng cùng fixtures. So sánh ID, role, terminal, wire endpoint/points, mã màu, target list, symbol channels, reviewIssues, grouped pinout, drawing role/owner, annotation và provenance. Field mới phải đi qua toàn tuyến, không chỉ được TypeScript khai báo. Reject mất field, loại unsupported và drift; không tự downgrade về `device`.

### G4 — GEN review ảnh → schema/render Studio

Reviewer kiểm inventory vs candidate, ghi missing/extra/unresolved từng item. Thực hiện kiểm điện học tại lớp nguồn: nguồn/mass, tiếp điểm, cuộn, polarity, tải. Sửa từ nguồn và chốt hash candidate sau cùng; thay schema thì verdict cũ hết hiệu lực với phần thay đổi.

## 7. Pipeline PORT và review độc lập

### P0 — Nhận gói bàn giao

Bắt buộc có ID nguồn, ảnh/hash, schema/hash, registry revision/digest, GEN review, inventory/coverage, danh sách unresolved và phiên bản export. Thiếu bằng chứng được stage draft có ghi lý do, không gọi là port hoàn tất.

### P1 — Dry-run và structural import

Dùng helper có sẵn; không copy ZIP thủ công để bỏ qua validation. Kiểm source identity, loaded/registered, circuit keys thiếu, file thay đổi, conflict và duplicate xe. Chỉ apply phạm vi được giao. Không làm mất warnings/status/timestamps; không đổi DB review status để khớp mong muốn.

### P2 — Render bằng APP thật

Render candidate qua componentRegistry/WireLayer hiện tại, không chỉ mở SVG export từ Studio. Lưu preview/hash và renderer commit; kiểm toàn mạch và detail chân/nhánh. Generated gallery là reference instance, không thay cho preview mạch mới.

### P3 — Double review

Reviewer APP độc lập với tác giả GEN/port, làm read-only. Tự đọc ảnh gốc đúng hash rồi đối chiếu graph + drawing + render APP. Không lấy lời GEN “đã đủ” làm review thứ hai. Checklist phải bao gồm đầu ra đến tải, label, pinout, polarity, junction/crossing, coil/contact và vùng bị che/cắt. Parent tích hợp sửa; reviewer xem lại artifact cuối và chốt hash.

### P4 — Chốt và regression

Nguồn không đổi phải sync lần2 ra zero diff. Chạy gate model/import/render; lưu cả GEN và APP verdict. Thay renderer thì re-review các occurrence bị ảnh hưởng trên xe cũ; không chỉ xe mới. Không tự xóa/ẩn xe đang có vì thiếu ảnh, cũng không mới quảng bá draft thành delivery approved.

### Quy tắc sửa đúng nơi

| Phát hiện khi PORT | Nơi sửa gốc | Cách kết thúc |
|---|---|---|
| Sai hình/nét cùng một model | Thư viện shared geometry | Update hai consumer, regression mọi occurrence |
| Chọn nhầm model/role | GEN/schema trên Auto2Tech | Export mới, review lại ảnh |
| Thiếu nhánh/tải/nhãn/chân | Inventory/GEN/schema | Bổ sung theo nguồn; không chỉ vẽ thêm nét ở APP |
| Thiếu field sau export | Serializer/contract | Round-trip test chống mất field |
| Quá dày/chồng chữ/sai aspect | Layout nguồn/GEN | Preview hai consumer, không tạo style riêng từng xe |
| Không có ảnh/điện học chưa rõ | Nguồn và reviewer | Draft/REVIEW_REQUIRED, không bịa để qua gate |

Compatibility adapter trong APP chỉ là cầu nối cho dữ liệu cũ: phải có guard snapshot, trace nguồn và điều kiện gỡ. Khi upstream sửa, kiểm payload mới đã tự đúng rồi mới bỏ adapter; không áp patch cũ lần hai. Tránh tích lũy `if vehicleId` trong renderer.

## 8. Gate tự động và gate người duyệt

| Gate | Điều kiện | Hiện trạng |
|---|---|---|
| Registry/ports | ID/version/type/roles/bounds hợp lệ; pin đủ/không trùng | APP và importer đã có nhiều guard; đối chiếu implementation trước khi mirror |
| Shared pinout | Nhóm/ô/nhãn có cấu trúc; không rỗng/trùng/NaN | pinoutValidation.js dùng chung runtime/import |
| Migration audit | Không unresolved/orphan/unclassified/reviewIssues | Có lệnh APP; hiện fail13 review components |
| GEN export policy | Mọi component mới có ref; đủ inventory, ảnh và metadata | Yêu cầu upstream; importer legacy hiện không tự bắt mọi nguồn cũ có ref |
| Library parity | Digest/revision và kết quả geometry hai nền tảng khớp | Cần triển khai upstream/package/CI |
| Source completeness | Inventory và cả hai reviewer đạt | Workflow thủ công; không tự suy từ test |
| Native/device/release | Bằng chứng build/device/store riêng | Không nằm trong kết quả bàn giao này |

Đặc biệt: `requiresReview` hiện bắt buộc giữ `reviewIssues`; riêng DetailedLamp cần `symbolChannels`. Không xóa flag để strict pass. Khi tìm đủ nguồn, cập nhật model/schema được review theo quyết định version, thay vì xóa cảnh báo trên dữ liệu vẫn mơ hồ.

Lệnh kiểm tại APP root:

```sh
node --test scripts/diagrams/sync-studio.test.cjs
node scripts/diagrams/audit-symbol-models.cjs --strict
NODE_PATH="$PWD/node_modules" node node_modules/jest/bin/jest.js --runInBand --watchman=false --env="$PWD/node_modules/jest-config/node_modules/jest-environment-node/build/index.js" __tests__/fi-diagram-*.test.ts*
node scripts/diagrams/sync-studio.cjs --vehicle <vehicle-id>
# Chỉ sau dry-run được review và phạm vi apply được giao:
node scripts/diagrams/sync-studio.cjs --vehicle <vehicle-id> --apply
git diff --check
```

Không dùng exit1 của audit hiện tại làm lý do bỏ gate. Với xe mới, verdict phạm vi phải ghi riêng; tổng catalog vẫn còn13 finding cũ. Không được che finding mới vào baseline.

## 9. Fixtures tối thiểu upstream phải giữ

1. Battery đổi hướng vẫn đúng cực; fuse dùng một model trên mọi mạch.
2. Generator cùng model ở nguồn/đèn đêm; không alias ACG chưa rõ topology thành star3.
3. Lamp2pin trái/phải, dual3pin đúng common/high/low; module chưa rõ vẫn cảnh báo.
4. Relay4/5pin không chập cuộn với tiếp điểm; diode không đảo cực khi xoay.
5. Coil–plug dọc/ngang có graph edge, chân cao áp chính xác, khe hở bugi không nối kín.
6. B/C pinout không gộp vỏ; số khoang khác số nhãn/dây không bị tự điền.
7. Mạch nguồn/đèn đêm giữ đủ continuation đến tải; kiểm cả nhánh có chữ mà không có linh kiện vẽ đầy đủ.
8. Cùng engine nét dây trên còi, nguồn và PGM-FI; scale toàn sơ đồ không thay tỷ lệ nhìn.
9. Round-trip giữ tất cả fields mới và source metadata; unsupported model/version phải báo lỗi.
10. Source fingerprint đổi thì adapter cũ không được âm thầm áp dụng; ảnh/hash đổi invalidates review.

## 10. Kế hoạch triển khai cho Auto2Tech

| Thứ tự | Công việc | Acceptance |
|---|---|---|
| A | Chốt registry/geometry revision từ APP và package/vendor parity |65 model dispatch; port fixtures/render khớp |
| B | Cập nhật API strict output, local import, web contract và serializer cùng lúc |Round-trip không mất fields; reject unsupported |
| C | Đổi Preview/editor sang shared models và shared wire style |Không còn inline body cũ cho model đã biết |
| D | GEN inventory trước JSON; prompt/schema-aware theo registry |Nguồn có nhánh chữ vẫn ra continuation đúng |
| E | Lưu provenance, review findings và hai verdict độc lập |Không tự DONE khi chỉ có JSON |
| F | Pilot một xe mới, review toàn bộ mạch từ ảnh thật |Không cần tune glyph ở APP; findings được sửa ở nguồn |
| G | Port lại cùng snapshot và kiểm hồi quy xe cũ |Zero diff; model changes không đổi topology cũ |

Điểm tìm code upstream: `apps/api/src/diagram-ai/diagram-ai.service.ts`, `apps/api/src/diagram-projects/local-diagram-json.ts`, `apps/api/src/diagram-projects/diagram-projects.service.ts`, `apps/web/src/diagram-studio/contract.ts`, `validate-diagram.ts`, `DiagramPreview.tsx`, `deterministic-json.ts`, `kit-image.ts`. Kiểm lại implementation hiện hành trước khi sửa. Không sửa DB/progress hàng loạt theo tài liệu này.

## 11. Prompt bàn giao cho agent GEN

```text
Đọc master contract và registry/geometry revision đã chốt; kiểm code thực tế
của API/editor/export trước khi thay đổi. Làm inventory từ ảnh gốc đúng record
và hash trước khi GEN. Từng linh kiện chọn symbolRef có version được cả Studio
và APP hỗ trợ, map đủ role tới terminal nguồn. Không phát biến thể inline SVG
cho model đã có. Không bịa topology, số chân hoặc cực tính.

Giữ mọi nhánh ra tải, off-page, danh sách đích, nhãn và annotation có nghĩa;
nhánh tới chữ dùng continuation, không bị bỏ vì thiếu chân vật lý. Phân biệt
khoang giắc với chân đang có dây. Kiểm graph và drawing cùng nhau.

Báo missing/extra/unresolved có sourceBox. Không rõ thì draft và reviewIssues;
không gán generic model để che bất định. Chạy validators và round-trip. Ghi
GEN review theo hash candidate cuối. Bàn giao để reviewer APP độc lập so ảnh
với render thật; chỉ cả hai pass mới gọi port-complete. Sửa lỗi tại lớp gốc,
không yêu cầu APP vá từng xe để thay cho sửa GEN/library.
```

## 12. Mẫu biên bản mỗi mạch

Đây là **sidecar đề xuất**, không phải field API đã triển khai. Không nhét vào strict schema trước khi contract hai bên nhận được.

```json
{
  "vehicleId": "<stable-id>", "circuitKey": "<key>",
  "source": {"recordId": "<id>", "updatedAt": "<timestamp>", "imageSha256": "<digest>"},
  "schemaSha256": "<exact-candidate-bytes>",
  "library": {"revision": "<commit-or-release>", "manifestSha256": "<digest>"},
  "inventoryArtifact": "<path-or-artifact-id>",
  "coverage": {"missing": [], "extra": [], "unresolved": []},
  "genReview": {"reviewer": "<name>", "date": "<ISO-date>", "verdict": "PENDING"},
  "appReview": {
    "reviewer": "<independent-name>", "date": "<ISO-date>", "verdict": "PENDING",
    "rendererRevision": "<commit>", "previewSha256": "<digest>"
  },
  "validation": {"structural": "PENDING", "roundTrip": "PENDING", "repeatSyncNoDiff": "PENDING"},
  "deliveryVerdict": "REVIEW_REQUIRED"
}
```

Reviewer phải ghi checklist/source coverage thật, không chỉ đổi PENDING thành PASS. Không lưu URL có token/credential. Khi ảnh/schema đổi, hoặc renderer ảnh hưởng hình vẽ đổi, review liên quan phải được làm lại.

## 13. Những phần chưa được phép kết luận đã xong

- 13 review components hiện có cần nguồn điện học rõ; tài liệu không đóng findings đó.
- 36 record thiếu ảnh server không có bằng chứng double review đầy đủ.
- Ảnh GPS AB cũ có bảng khoang10P chưa được managed schema thể hiện;9 terminal có dây không có nghĩa được phép bịa terminal thứ10.
- Các APP compatibility corrections/binders chưa được backport thành schema upstream. Việc này cần theo dõi theo source record và re-export.
- Auto2Tech package, GEN prompt, validators, preview, serializer và CI chưa được triển khai bởi commit APP này.
- Không có bằng chứng native/device/production release mới trong bàn giao này.

## 14. Phụ lục model registry tại mốc APP

Bảng sau trích từ registry thực tế. `instance` nghĩa là mọi terminal ánh xạ chính nó; `—` là không có port role cố định, không được hiểu là tự do thêm chân. Manifest và validators là nguồn quyết định chi tiết.

| Model ID @ version | Renderer | Type / acceptedTypes | Port roles | Review bắt buộc |
|---|---|---|---|---|
| `battery@1` | BatteryGlyph | battery | positive, negative | — |
| `fuse@1` | FuseGlyph | fuse | a, b | — |
| `generator.star3@1` | PowerSymbol | acg3Phase, acg | left, top, right | — |
| `relay.contact-coil4@1` | SwitchingSymbol | relay4Pin, relay | contact-left, contact-right, coil-left, coil-right | — |
| `capacitor.polarized@1` | PowerSymbol | capacitor, device | top, bottom | — |
| `regulator.three-phase5@1` | PowerSymbol | regulator, device | top, left-top, left-middle, left-bottom, bottom | — |
| `continuation.loads@1` | PowerSymbol | continuation, device | in | — |
| `lamp.led2@1` | DetailedLamp | lamp | feed, return | — |
| `lamp.filament2@1` | DetailedLamp | lamp | feed, return | — |
| `lamp.dual-filament3@1` | DetailedLamp | lamp | common, high, low | — |
| `horn.two-terminal@1` | BasicSymbol | horn | a, b | — |
| `switch.spst2@1` | BasicSymbol | switch | a, b | — |
| `ground@1` | BasicSymbol | ground | in | — |
| `junction@1` | BasicSymbol | junction | node | — |
| `control.ecm@1` | ControlUnitSymbol | ecm | instance | — |
| `control.scu@1` | ControlUnitSymbol | scu | instance | — |
| `switch.dpst4@1` | SwitchingSymbol | switch | pole1-in, pole1-out, pole2-in, pole2-out | — |
| `switch.selector3@1` | SwitchingSymbol | selectorSwitch | common, throw1, throw2 | — |
| `relay.changeover-coil5@1` | SwitchingSymbol | relay | common, throw1, throw2, coil-left, coil-right | — |
| `motor.dc2@1` | ActuatorSymbol | motor, pump | a, b | — |
| `valve.solenoid2@1` | ActuatorSymbol | valve | a, b | — |
| `injector.solenoid2@1` | ActuatorSymbol | injector | a, b | — |
| `flasher.two-terminal@1` | ActuatorSymbol | flasher | input, output | — |
| `flasher.three-terminal@1` | ActuatorSymbol | flasher | input, output, ground | — |
| `buzzer.polarized2@1` | ActuatorSymbol | horn | positive, negative | — |
| `spark-plug.chassis1@1` | ActuatorSymbol | sparkPlug | hv | — |
| `diode.rectifier2@1` | ActuatorSymbol | diode | anode, cathode | — |
| `connector.paired1@1` | StructuralSymbol | connector | pair1-a, pair1-b | — |
| `connector.paired2@1` | StructuralSymbol | connector | pair1-a, pair1-b, pair2-a, pair2-b | — |
| `connector.paired6@1` | StructuralSymbol | connector | pair1-a, pair1-b, pair2-a, pair2-b, pair3-a, pair3-b, pair4-a, pair4-b, pair5-a, pair5-b, pair6-a, pair6-b | — |
| `junction.bus2@1` | StructuralSymbol | junction | node1, node2 | — |
| `junction.bus3@1` | StructuralSymbol | junction | node1, node2, node3 | — |
| `sensor.fuel-rheostat2@1` | SensorSymbol | sensor | resistor-end, wiper | — |
| `sensor.potentiometer3@1` | SensorSymbol | sensor | supply, wiper, return | — |
| `sensor.thermistor2@1` | SensorSymbol | sensor | a, b | — |
| `sensor.pickup-coil2@1` | SensorSymbol | sensor | a, b | — |
| `sensor.ckp-module6@1` | SensorSymbol | sensor | instance | — |
| `sensor.speed-probe2@1` | SensorSymbol | sensor | instance | — |
| `sensor.oxygen-signal1@1` | SensorSymbol | sensor | signal | — |
| `sensor.oxygen-probe2@1` | SensorSymbol | sensor | signal, return | — |
| `sensor.oxygen-resistive2@1` | SensorSymbol | sensor | signal, heater | — |
| `gauge.fuel3@1` | SensorSymbol | gauge | instance | — |
| `gauge.speed5@1` | SensorSymbol | gauge | instance | — |
| `gauge.idle-indicator6@1` | SensorSymbol | gauge | instance | — |
| `assembly.functional-module@1` | AssemblySymbol | device | instance | — |
| `assembly.rotor@1` | AssemblySymbol | device | instance | — |
| `assembly.service-connector@1` | AssemblySymbol | connector | instance | — |
| `assembly.cluster-fuel@1` | AssemblySymbol | device | instance | — |
| `assembly.pinout@1` | AssemblySymbol | connector | instance | — |
| `assembly.note@1` | AssemblySymbol | device | instance | — |
| `assembly.cluster-speed-display@1` | AssemblySymbol | device | instance | — |
| `assembly.key-lock6@1` | AssemblySymbol | device | sol-pos, sol-neg, face-pos, face-neg, knob-in, knob-out | — |
| `assembly.remote@1` | AssemblySymbol | device | instance | — |
| `assembly.cluster-speed-dial@1` | AssemblySymbol | device | instance | — |
| `assembly.cluster-indicators@1` | AssemblySymbol | connector, device | instance | — |
| `assembly.enclosure@1` | AssemblySymbol | device | instance | — |
| `ignition.module3@1` | ActuatorSymbol | ignitionCoil | primary-a, primary-b, hv | — |
| `solenoid.coil2@1` | ActuatorSymbol | device | a, b | — |
| `motor.chassis4@1` | ActuatorSymbol | motor | power, case-left, case-right, case-bottom | — |
| `buzzer.two-terminal@1` | ActuatorSymbol | horn | a, b | — |
| `passive.resistor2@1` | ActuatorSymbol | device | a, b | — |
| `lamp.led-panel2@1` | DetailedLamp | lamp | feed, return | Có |
| `lamp.dual-filament-module2@1` | DetailedLamp | lamp | feed, return | Có |
| `lamp.led-assembly5@1` | DetailedLamp | connector | instance | Có |
| `switch.tilt-module3@1` | SwitchingSymbol | selectorSwitch | instance | Có |

Manifest SHA-256: `5ae13408872198c4fca89b7682c2f36766a27ce7255b5fbf346d8edc8f528f24`.

APP commit đầy đủ: `ad079ec2c0502cefb0634a783fe02a4f018e95fb`.

### Các component vẫn cần đối chiếu

| Circuit | Component |
|---|---|
| 38770-kvg-v42-brake-light | brake-tail-lamp |
| airblade-160-2026-brake-light | brake-lamp |
| airblade-160-2026-night-lighting | headlamp |
| airblade-160-2026-night-lighting | tail-lamp |
| airblade-160-2026-ignition | bank |
| sh-mode-2023-2025-brake-light | brake-lamp |
| sh-mode-2023-2025-night-lighting | head-led |
| sh-mode-2023-2025-night-lighting | tail |
| sh-mode-2023-2025-ignition | stand |
| vario-2023-2025-brake-light | brake-lamp |
| vario-2023-2025-night-lighting | headlamp |
| vario-2023-2025-night-lighting | tail-lamp |
| vision-2023-2024-brake-light | brake-lamp |

### Kiểm tra tài liệu trước bàn giao

Component JSON minh họa đã chạy qua validateSchema của importer APP; hai JSON block parse được.65 model ID/version và digest trong phụ lục khớp manifest, liên kết tài liệu/gallery cục bộ tồn tại. git diff --check đạt. Kiểm tra này xác minh tính nhất quán tài liệu với APP, không thay cho triển khai hoặc thử nghiệm Auto2Tech.

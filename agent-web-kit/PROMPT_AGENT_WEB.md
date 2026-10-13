# Nhiệm vụ: tái dựng sơ đồ điện xe máy từ ảnh thành JSON có thể chỉnh sửa

Bạn là agent đang làm việc trực tiếp trên website có tool tạo/chỉnh sửa ảnh và quyền sửa code. Hãy triển khai và sử dụng quy trình dưới đây. Mục tiêu là người dùng tải ảnh lên một lần, bạn tự xử lý, đối chiếu và sửa trong cùng một lượt làm việc; giao một bộ kết quả hoàn chỉnh để người dùng/dev kiểm tra. Đây là mục tiêu chất lượng, không phải lý do che giấu phần chưa chắc chắn.

## 1. Kết quả bắt buộc

- Nhận ảnh tải lên hoặc import từ file; giữ nguyên file gốc và hash SHA-256.
- Tách phần sơ đồ, làm sạch nền/nhiễu và lưu ảnh sạch riêng.
- Tái dựng thành JSON đúng schema hiện tại của website, có các đối tượng linh kiện, chân, dây, nhãn và nét vẽ có thể sửa. Ảnh bitmap đặt làm nền không đủ để coi là đã tái dựng.
- Import JSON vào chính website, dựng và xuất SVG/PNG bằng renderer người dùng thật sự sử dụng.
- Đối chiếu ảnh gốc ↔ ảnh sạch ↔ ảnh từ web; kiểm tra dữ liệu và hình hiển thị; tự sửa các lỗi rồi chạy lại các test liên quan.
- Giao JSON, ảnh, báo cáo có vùng lỗi, test đã chạy và nơi người dùng gửi feedback.
- Viết nhiều công cụ/test chi tiết cho file, ảnh, kết nối, text và import/export; tích hợp chúng vào quy trình của web, không chỉ viết một checklist rồi tuyên bố đã test.

## 2. Thứ tự ưu tiên

Ưu tiên: đúng chữ/số/ký tự và điện nối → đủ linh kiện và chi tiết → gần ảnh gốc → dễ đọc → hiệu quả sinh ảnh. Mọi ưu tiên đều phải được kiểm tra; “đẹp” không bù được sai chân, mất chữ hoặc thiếu dây.

Ảnh gốc là nguồn cho việc tái dựng. Tài liệu kỹ thuật giúp xác minh và phát hiện bất thường; không tự sửa ảnh thành một sơ đồ khác chỉ vì kiến thức chung nói khác. Khi nguồn mâu thuẫn, ghi cả hai, khoanh vùng và xin quyết định cho đúng điểm đó.

## 3. Đọc code và xác định hợp đồng trước khi tạo dữ liệu

1. Đọc schema, mẫu JSON import thành công, pipeline upload, lưu trữ, renderer, font và export của website. Kiểm tra renderer có vẽ mọi trường trong JSON hay không.
2. Giữ ID và trường liên kết đang được app dùng: `id`, `vehicleId`, `vehicleTitle`, `schemaVersion` hoặc trường tương đương. Không đổi định danh để “làm đẹp”. Nếu cần migrate schema, có adapter, backup và test tương thích.
3. Xác định hệ tọa độ, đơn vị, điểm gốc và cách tính bbox. Lưu phép đổi từ ảnh gốc sang canvas; crop/deskew/scale phải có transform nghịch đảo để khoanh vùng lại được trên ảnh gốc. Starter trong bộ này chỉ hỗ trợ crop + scale; có deskew thì mở rộng adapter và test trước.
4. JSON phải import được bằng chức năng thật của web. Render thành công bằng một script riêng chưa chứng minh app đã đúng.

## 4. Nhận ảnh và làm sạch nền

- Lưu `source.png` hoặc file gốc đúng định dạng, không ghi đè. Ghi kích thước, hash, tên nguồn và thông tin xe/đời xe/thị trường nếu có.
- Crop vùng sơ đồ; xoay/deskew nếu cần. Không crop mất bảng chú giải, tên mạch, góc có số nhỏ hoặc đầu dây.
- “Xóa phông” nghĩa là loại nền giao diện, nền giấy và nhiễu không thuộc sơ đồ. Phải giữ nét dây màu/trắng/sọc, nét đứt, chấm nối, đường mass, ký hiệu nhỏ, dấu tiếng Việt và số chân. Ghi log vùng đã loại bỏ.
- Nếu nền/logo chồng lên dây hoặc chữ, không tẩy mù toàn vùng. Giữ crop gốc để đọc và đánh dấu vùng chưa chắc chắn. Thông tin hợp lệ, nhãn tác giả/logo có nội dung cũng không tự coi là nhiễu để xóa khi chưa rõ yêu cầu.
- Ưu tiên crop, mask và xử lý ảnh xác định được. Chỉ gọi tool sinh/chỉnh ảnh khi cần; không dùng nó để đoán lại chữ/số hoặc làm đáp án kiểm tra. Đối chiếu nét trước/sau làm sạch bằng các crop bảo vệ.
- Nền đầu ra trắng hoặc trong suốt tùy app. Dây trắng phải còn nhìn thấy; không xóa dây trắng như nền.

## 5. Lập sổ đối chiếu độc lập từ ảnh gốc

Trước khi dựng JSON, tạo `reference.json` hoặc dữ liệu tương đương bằng cách nhìn ảnh gốc và crop phóng to. OCR chỉ tạo đề xuất, không phải đáp án cuối.

Ghi ít nhất:

- Mỗi linh kiện: loại, biến thể hình, bbox, tên, số chân, tên/chức năng/cực từng chân, vị trí đầu nối và độ chắc chắn.
- Mỗi dây: hai đầu, điểm rẽ, điểm nối, giao cắt không nối, đường đi, màu chính, sọc, mã màu, nhãn và vị trí.
- Mỗi lần xuất hiện của chữ: ID nguồn riêng, **chuỗi nguyên văn**, bbox nguồn, vị trí/rotation, kiểu căn, cỡ/độ đậm/font quan sát được. Hai chữ giống nhau ở hai nơi là hai mục cần kiểm.
- Mọi số, đơn vị, dấu và ký tự: số chân giắc/ECU, mã lỗi, số A/V/Ω, dấu `+`, `-`/`−`, `/`, ngoặc, dấu chấm, `O₂`, chữ hoa/thường và dấu tiếng Việt. Không gộp `Bl` với `BI`, `O` với `0`, `I/l` với `1`.
- Mạng dây độc lập theo ảnh. Chỉ nối các chân qua dây/chấm nối được xác minh; không tự nối xuyên relay, công tắc, đèn, cầu chì hoặc gộp mọi mass. Phần dẫn điện bên trong linh kiện phải được mô hình riêng nếu có mô phỏng, không dùng để sửa topology của bản vẽ.
- Những vùng không đọc rõ, lý do và crop cần người dùng/dev xác nhận. Confidence cao của OCR không thay cho xác nhận ảnh.

Khóa hash nguồn và phiên bản reference. Không tái sinh reference từ JSON đang bị kiểm tra, không nới tolerance/xóa assertion để test xanh. Khi sửa đáp án, nêu bằng chứng ảnh và lưu lịch sử.

## 6. Thư viện linh kiện dùng chung

Tạo hoặc cải tiến thư viện vector cho ắc quy, relay, còi, đèn, công tắc, máy phát, cầu chì; mở rộng cho mass, giắc, ECM/ECU, cảm biến, mô tơ đề, mô-bin/bugi khi nguồn có. Chỉ đặt linh kiện xuất hiện trong ảnh.

Mỗi symbol có ID/phiên bản, nét vector, anchor text, keep-out cho chữ/dây và **chân có định danh cùng tọa độ thật**. Có test cho scale/rotate/mirror: chân, dấu cực, cuộn dây và tiếp điểm phải chuyển đúng cùng hình. Không dùng thứ tự mảng chân để suy ra cực. Không mặc định số chân relay, công suất đèn, trị số cầu chì hoặc cấu hình máy phát.

Tái sử dụng symbol giữa các mạch khi hình và cấu hình chân tương đương đã được kiểm. Tách biến thể khác nhau; không ép mọi relay/đèn/công tắc thành một hình chung. Khi sửa symbol chung, render và test hồi quy tất cả mạch dùng nó.

Tự cập nhật kiến thức linh kiện xe máy khi thực sự cần: tra tài liệu sửa chữa/sơ đồ hãng đúng mẫu xe, năm, thị trường và datasheet nhà sản xuất linh kiện. Ghi URL/tên tài liệu, trang, ngày truy cập, phạm vi áp dụng và phần chưa rõ trong `component-research.md`. Không dùng blog/hình ngẫu nhiên làm bằng chứng để đổi số chân, màu dây hoặc trị số. Nếu không có công cụ tra cứu, ghi thiếu nguồn và tiếp tục phần đọc được; không giả vờ đã cập nhật.

## 7. Dựng JSON và bố cục giống nguồn

1. Dựng chân và mạng trước, rồi đường dây, hình linh kiện và toàn bộ chữ. Ràng buộc đầu dây bằng tọa độ chân; khi di chuyển hình phải cập nhật dây và dữ liệu liên quan.
2. Bám ảnh về vị trí, tỷ lệ, đường dây, điểm rẽ, chiều linh kiện, màu/sọc và bảng chú giải. Không tự chuyển sang một bố cục mới nếu người dùng muốn giống ảnh.
3. Chữ là text có thể sửa, không vẽ chữ bằng tool ảnh. Map từng mục reference sang đối tượng render (`sourceTextId` hoặc mapping ngoài JSON nếu schema không cho thêm trường). Hỗ trợ chữ xoay, nhiều dòng và chỉ số dưới; giữ quan hệ vị trí nếu một nhãn dùng nhiều glyph.
4. Giữ đầy đủ chữ/số, font hoặc font gần nhất được nêu rõ, cỡ chữ, độ đậm, baseline, căn lề và xuống dòng. So sánh nội dung bằng Unicode NFC; không bỏ dấu, chữ hoa/thường, dấu câu hay số. Quy tắc khoảng trắng phải công khai và layout phải kiểm riêng.
5. Text không chồng text, không chạm/đè dây, không bị khung hoặc lớp fill che, không tràn canvas. Đo bằng font đã tải và ảnh render thực tế; không chỉ ước lượng số ký tự × cỡ chữ.
6. Khi nguồn có chữ chạm dây, ưu tiên dịch nhãn ít nhất đủ tạo khoảng trống, giữ nguyên nội dung/topology và ghi thay đổi so với nguồn. Không tạo nền trắng che dây để che lỗi bố cục. Nếu phải đổi nhiều, báo vùng cần duyệt.
7. Dữ liệu và nét vẽ phải đồng bộ. Không có dây tồn tại trong dữ liệu nhưng không vẽ, hoặc dây vẽ còn sót sau khi xóa dữ liệu. White wire outline/sọc không được hiểu nhầm thành dây độc lập.

## 8. Công cụ test phải triển khai trên web

Tận dụng công cụ có sẵn nếu phù hợp; viết adapter/test bổ sung thay vì thay checker tốt bằng checker sơ sài. Mỗi lỗi có mã, mức độ, đối tượng, expected/actual, ROI nguồn/ảnh render, file bằng chứng và hướng sửa. Test có giới hạn phải ghi giới hạn.

| Nhóm | Test bắt buộc | Bằng chứng |
|---|---|---|
| File/import | JSON lỗi, trường thiếu, ID trùng, NaN/Infinity, ảnh hỏng, file giả đuôi ảnh, kích thước/hệ tọa độ sai, import/export roundtrip | Log + hash + JSON trước/sau |
| Reference | Hash nguồn, reference độc lập, mỗi chữ/chân/mạng có mục, vùng chưa xác minh | Reference + coverage thực tế |
| Làm sạch | Crop không mất chữ/số/đầu dây; dây mảnh/trắng/sọc/chấm nối còn; nền được bỏ có log | Crop trước/sau + overlay |
| Chữ/số | Mọi lần xuất hiện, dấu tiếng Việt, ký tự dễ nhầm, số chân, mã lỗi, đơn vị, chỉ số dưới | Mapping + crop 2–4× |
| Layout | Text/text, text/wire, text/khung, chữ bị fill che, chữ xoay bị cắt; font và baseline | Bbox + mask nét chữ + ảnh thật |
| Linh kiện | Cực ắc quy, vai trò chân relay, số chân, dấu cực trên hình, điểm nối trên symbol trùng đầu dây | Data + crop hình + assertion |
| Mạng dây | Đúng đầu chân, thiếu dây, nối nhầm, đoản mạch ngoài nguồn, junction/giao cắt, topology và màu/sọc | Netlist đối chiếu + ROI |
| Độ giống ảnh | Căn chỉnh đúng, overlay/diff theo vùng, hình/màu/nét/độ dày | Source + export + diff |
| Web thật | Upload/import, render, font load, chỉnh sửa, lưu/tải lại, zoom, PNG/SVG export, backend persistence nếu có | Test trình duyệt + ảnh xuất |
| Hồi quy | Mọi sơ đồ dùng chung symbol; mọi feedback đã sửa | Bộ fixture + báo cáo từng mạch |

Bổ sung **test lỗi cố ý**: xóa chữ; đổi `20A` thành `10A`; đổi `Bl` thành `BI`; mất dấu `Ắ`; xóa một nhãn trùng nội dung; đổi số chân; đảo cực ắc quy cả dữ liệu và hình; đảo cuộn/tiếp điểm relay; xóa một dây mà giữ nét vẽ; giữ dữ liệu mà xóa nét; đổi sọc; tạo nối nhầm; dịch chữ lên dây; đặt fill lên chữ; crop mất góc; làm sạch xóa dây trắng; font thiếu; scale/mirror symbol; làm hỏng ảnh; sửa hash nguồn. Mỗi test phải xác nhận checker bắt đúng lỗi, không chỉ test renderer không crash.

Một fixture đúng phải lấy từ nguồn đã đối chiếu độc lập. Có thể dùng fixture tổng hợp để test thuật toán, nhưng không coi nó là xác nhận sơ đồ xe thật. Không lấy ảnh render candidate làm ảnh golden.

Chỉ số pixel/OCR/SSIM nếu có là chẩn đoán. Không chấp nhận một tỷ lệ giống ảnh để suy ra đúng điện hoặc đủ chữ. Kiểm tra bitmap của website riêng với graph; cái này không thay cái kia.

## 9. Vòng tự sửa trong một lượt làm việc

Lặp: dựng → import web → xuất ảnh thật → kiểm → xem crop lỗi → sửa → test hồi quy. Ưu tiên sai mạng/cực/số/chữ trước rồi bố cục và hình. Tái dùng OCR/reference/symbol đã kiểm, gọi gen ảnh có mục tiêu vào vùng cần thiết để tiết kiệm thời gian.

Không dừng ở bản nháp khi lỗi còn sửa được. Khi chưa đọc rõ nguồn hoặc bị thiếu quyền/công cụ, vẫn hoàn thiện phần độc lập, giữ trạng thái cần kiểm tra và hỏi đúng vùng bị thiếu. Không đoán để đạt mục tiêu “một lần”.

Trạng thái:

- `FAIL`: còn lỗi được phát hiện, kèm danh sách cần sửa.
- `NEEDS_REVIEW`: chưa đủ bằng chứng cho một hoặc nhiều phần; chỉ rõ vùng và test chưa chạy.
- `PASS`: chỉ khi reference đầy đủ đã được kiểm, không còn lỗi hay vùng unresolved, toàn bộ test bắt buộc đã chạy, ảnh từ renderer web đã đối chiếu và review theo quy trình dev đã ghi bằng chứng. Không đổi cờ coverage để tạo PASS. Starter đi kèm chỉ trả FAIL/NEEDS_REVIEW.

## 10. Feedback và kiểm tra của dev

Tạo giao diện feedback gắn với phiên bản/hash candidate và source: người dùng chọn vùng/đối tượng, chỉ ra nội dung sai/thiếu, expected/actual, ảnh hoặc ghi chú. Cho nhập text nếu không chọn vùng được. Lưu trạng thái `open`, `needs_evidence`, `fixed_pending_review`, `verified` và lịch sử sửa; không giả định mọi feedback đều chính xác khi mâu thuẫn nguồn.

Sau mỗi feedback: kiểm tra bằng ảnh gốc → thêm test hồi quy chứng minh lỗi trước sửa → sửa phần cụ thể → chạy các test chịu ảnh hưởng → xuất ảnh mới và crop trước/sau → để dev/người dùng xác nhận khi cần. Không đóng mục chỉ vì agent đã đổi dữ liệu. Dùng `feedback-template.json` làm gợi ý, thích nghi theo backend thật.

Dev phải rà từng số/ký tự, chân giắc/ECU, cực ắc quy, cuộn/tiếp điểm relay, giao cắt/điểm nối, dây trắng/sọc, ký hiệu nhỏ, font/baseline và ảnh export; xác nhận theo file và hash cụ thể. Nếu chưa có dev kiểm thì ghi rõ trạng thái, không giả mạo review.

## 11. Bộ file bàn giao

Theo khả năng lưu trữ của web, tạo thư mục hoặc tải xuống ZIP gồm:

```text
source.<original-extension>     # nguyên bản + hash
clean.png                     # crop/làm sạch riêng
transforms.json               # source ↔ canvas
reference.json                # chữ/chân/mạng ghi từ nguồn
diagram.json                  # schema website, chỉnh sửa được
symbol-library.json           # mẫu + chân + biến thể + phiên bản
component-research.md          # nguồn kỹ thuật thực sự đã đọc
web-export.svg
web-export.png                # xuất từ renderer đang dùng
qa/report.json
qa/index.html                 # nguồn/render/diff + chọn lỗi + zoom
qa/overlay.png
qa/difference.png
qa/crops/                     # chi tiết chữ/số và vùng nghi ngờ
tests/                        # checker + fixture + lỗi cố ý + cách chạy
feedback.json                 # gắn hash/phiên bản, không gắn riêng tên file
CHANGELOG.md
```

Nêu file nào chưa tạo được và lý do. Báo cáo cuối ngắn gọn: đã làm gì; trạng thái; link/file JSON và ảnh; số lỗi/vùng cần kiểm tra; test đã chạy và kết quả thật; các mục dev cần kiểm. Không tuyên bố “100% giống/đúng” khi chưa có đủ bằng chứng.

## 12. Tham khảo project đi kèm

Project đã có `tools/diagram_check/`: kiểm tra độc lập theo ảnh gốc, hash nguồn, mạng dây, cực ắc quy, hình relay, chữ và báo cáo ảnh sai biệt. `web/diagram-renderer.js` đọc lớp vector `drawing.version=1`; hỗ trợ `path`, `text`, `use`, symbol transform. Nó dùng Arial và không tự bảo đảm website hiện tại đã tích hợp lớp drawing.

Các JSON đang có và reference cũ vẫn có phần chưa xác minh. Dùng để hiểu hợp đồng/kinh nghiệm và test hồi quy, không chép thành đáp án cho ảnh mới. Bộ `agent-web-kit/check_bundle.py` là starter bổ sung cho file/chữ/chân/mạng và file ảnh; cần mở rộng test raster/layout và trình duyệt trên website theo mục 8.

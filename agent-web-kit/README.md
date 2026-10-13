# Bộ giao việc cho agent trên web

Đọc hoặc tải lên **PROMPT_AGENT_WEB.md** để giao việc cho agent có quyền sửa website và có tool tạo ảnh. Prompt yêu cầu xử lý ảnh → JSON có thể sửa → dựng lại bằng renderer của website → đối chiếu → tự sửa → báo cáo và tiếp nhận feedback.

## Gửi gì cho agent?

1. `PROMPT_AGENT_WEB.md` và ảnh sơ đồ gốc, ưu tiên ảnh có độ phân giải cao nhất.
2. Một JSON website đang import được và quyền đọc code/schema/renderer của website. Nếu có nhiều renderer, chỉ rõ renderer đang dùng.
3. Nếu web cho đính kèm code, gửi cả thư mục này. `reference-template.json` và `feedback-template.json` là mẫu, **chưa phải dữ liệu đã xác minh**.
4. Khi cần tham khảo cách project hiện tại kiểm tra, gửi `tools/diagram_check/`, `web/diagram-renderer.js` và một JSON từ `Bản sửa đã đối chiếu/01.AirBlade-2011-2012/`. Không coi bộ JSON cũ là đáp án đúng toàn bộ.

Tin nhắn có thể dán kèm:

> Hãy đọc PROMPT_AGENT_WEB.md và thực hiện các yêu cầu trong đó trên website hiện tại. Dùng ảnh tôi gửi làm nguồn đối chiếu. Tự đọc schema/renderer trước khi sửa; triển khai pipeline và công cụ test; tự kiểm tra, sửa lỗi rồi giao JSON, ảnh xuất từ website và báo cáo. Chữ, số chân, ký tự đặc biệt, cực và mạng dây phải được đối chiếu từng mục. Chỉ hỏi lại về vùng ảnh thực sự không đọc rõ hoặc thiếu quyền/công cụ cần thiết.

## Chạy bộ kiểm tra cơ bản

Python 3.9 trở lên. Kiểm tra JSON và hash dùng thư viện chuẩn. Đọc/kiểm tra ảnh đầy đủ cần Pillow; nếu thiếu, báo cáo giữ trạng thái cần kiểm tra.

```powershell
python -m pip install -r agent-web-kit/requirements-test.txt
python -m unittest discover -s agent-web-kit -p "test_*.py" -v
python agent-web-kit/check_bundle.py --diagram path/to/diagram.json --reference path/to/reference.json --source path/to/source.png --clean path/to/clean.png --web-export path/to/web-export.png --out path/to/qa-report.json
```

Điền `reference.json` bằng cách đọc **ảnh gốc**, gồm hash nguồn, phép đổi tọa độ, từng lần xuất hiện của chữ, chân và mạng dây. Không tự lấy nội dung JSON đang kiểm tra làm bảng đáp án. Mẫu chưa điền sẽ bị báo lỗi hoặc thiếu bằng chứng; đó là hành vi dự kiến.

Mã thoát: `1` nếu có lỗi; `2` nếu chưa thấy lỗi trong phạm vi test nhưng còn phần chưa xác minh. Bộ starter **không cấp PASS**, kể cả khi ai đó đổi mọi cờ coverage thành true. Nó kiểm tra JSON, text vector, chân, mạng và file ảnh; chưa chứng minh nét chữ không đè dây hoặc toàn bộ hình giống ảnh.

Tool dùng lớp `drawing.version=1`, `components`, `terminals`, `wires` đang có trong project. Nếu schema web khác, agent cần viết adapter và test adapter. Không ép đổi schema của website theo tool này.

Hợp đồng starter: ảnh sạch và PNG từ web có kích thước canvas ở 1×; tọa độ reference là pixel ảnh nguồn, chuyển bằng crop + scale; tolerance tính bằng pixel canvas. ID linh kiện/chân/dây không chứa dấu chấm vì key chân dùng `component.terminal`. Text so sánh chính xác sau Unicode NFC, kể cả khoảng trắng; nhãn được chia thành nhiều glyph cần adapter riêng. Màu được kiểm đồng bộ giữa data và drawing, **chưa kiểm độc lập với màu nguồn**. Ảnh hợp lệ/hash khớp chưa chứng minh làm sạch bảo toàn chi tiết hay file thực sự được xuất từ website.

## Bộ kiểm tra sâu đã có trong project

```powershell
python tools/diagram_check/test_checker.py
python tools/diagram_check/check.py --input "Bản sửa đã đối chiếu/01.AirBlade-2011-2012" --out review/agent-web-check
```

Công cụ trên dành riêng cho 10 ảnh AirBlade của project. Nó có kiểm tra nét chữ bằng ảnh raster, dây/sọc màu, cực ắc quy, hình relay, ảnh sai biệt và báo cáo HTML. Xem `tools/diagram_check/README.md` trước khi dùng `--exports` để đối chiếu PNG từ web. Các tọa độ/hash/reference hiện tại không áp dụng cho ảnh hoặc đời xe mới.

## Phạm vi đã triển khai ở đây

Đây là prompt, mẫu dữ liệu và công cụ test để mang sang agent trên web. Bộ này không tự kết nối hay sửa website; chưa có URL, code hoặc quyền truy cập website trong yêu cầu này. Prompt yêu cầu agent bên web hoàn thiện các test tích hợp và test hình ảnh thật trước khi xác nhận giao bản cuối.

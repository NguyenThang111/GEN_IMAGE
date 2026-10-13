# Hướng dẫn cho agent trong workspace sơ đồ điện

Khi làm việc liên quan đến ảnh sơ đồ, GEN JSON, symbol, Diagram Studio, PORT
hoặc bàn giao sang EasyScan, đọc theo thứ tự:

1. [Quy chuẩn gốc](AUTO2TECH_GEN_PORT_MASTER_CONTRACT_2026-10-12.md).
2. [Phương pháp làm và bàn giao](AUTO2TECH_AGENT_WORK_METHOD.md).
3. [Phòng lỗi component/import](AUTO2TECH_COMPONENT_IMPORT_COMPATIBILITY.md).
4. Schema, registry, renderer và công cụ thực tế của repo đang được giao sửa.

Áp dụng hướng dẫn vào đúng phạm vi nhiệm vụ của người dùng. Tài liệu phương
pháp diễn giải quy chuẩn gốc; nếu có khác biệt, dùng quy chuẩn gốc và ghi nhận
điểm cần cập nhật tài liệu. Chỉ dẫn mới của người dùng được ưu tiên.

- Lập inventory độc lập từ ảnh gốc trước khi tạo hoặc sửa candidate JSON.
- Giữ nguồn và định danh; ghi hash cho ảnh, schema và thư viện được dùng.
- Kiểm cả graph kết nối và hình render bằng consumer thật.
- Sửa lỗi ở GEN/schema, serializer hoặc thư viện tương ứng; tránh vá renderer
  riêng từng xe để che lỗi nguồn.
- Giữ draft và findings khi thiếu nguồn, chưa rõ điện học hoặc thiếu review
  độc lập. Test pass không tự chứng minh đúng ảnh hoặc port hoàn tất.
- `review/` chứa bản sao và kết quả của các lần làm trước. Xác minh repo,
  revision và phạm vi trước khi sử dụng; không coi đó là code đang deploy.
- Không chạy script repair/build dữ liệu chỉ để đọc hoặc viết tài liệu.
- Trước khi giao GEN, kiểm type và validator đầy đủ của consumer thực tế.
  Không suy web production hỗ trợ type chỉ vì contract/validator local đã PASS.


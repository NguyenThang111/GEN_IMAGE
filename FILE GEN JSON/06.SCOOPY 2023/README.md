# GEN 06.SCOOPY 2023 — 12 mạch

Đầu ra là **draft tương thích Studio cục bộ**, chưa phải PORT_COMPLETE.
Mở index.html để chọn mạch, so ảnh nguồn/GEN, chồng ảnh và zoom. Nạp từng
file *.schema.json vào editor hỗ trợ drawing.version=1; không nạp manifest
hoặc evidence như schema. ID scoopy-2023 là ID local, chưa phải identity server.

## Kết quả đã kiểm

- 12/12 JSON qua validator và vector validator của mã Studio thực tế.
- Export editor giữ toàn bộ trường; export deterministic và parse lại đạt.
- Render SVG/PNG bằng DiagramPreview.tsx của Auto2Tech local.
- Graph khớp phần inventory đã chép, các case CKP/đèn/coil/shared return đạt.
- Chạy lại generator: 12 file JSON có hash bytes không đổi.
- Ảnh trong source/ là bản sao nguyên bytes của 12 ảnh FILE ANH.
- Bản sửa component r02: 17 type không được production hỗ trợ đã sửa; nhánh
  tải giữ device envelope + targets/anchor/textLayout, pinout giữ connector
  presentation. 12/12 đạt validator đầy đủ lấy mới từ production bundle.
- Points dây đã thêm góc ngang/dọc; giữ nguyên terminal, endpoints, mã màu,
  targets và pinoutData. Xem checks/before-after-invariants.json.
- Quy tắc phòng lỗi lần sau ở COMPONENT_IMPORT_COMPATIBILITY.md.

Code renderer: C:/Users/thang/Desktop/auto2techos, HEAD
165a4b0ba9207c39a846cf91376d02aecd932b39, working tree đã có sửa đổi.
Dependency dùng từ bản sao tích hợp; renderer lấy từ repo thật, không coi
bản sao là deploy. Hash code và bằng chứng ở checks/studio-validation-render.json.
Không sửa code consumer, DB hoặc dữ liệu xe khác.

## Findings đang mở

1. Chưa xác minh project/record IDs trên server; nguồn mới được khóa ở local.
2. Studio hiện chưa dispatch shared symbolRef. model-proposals/ chỉ ghi
   ánh xạ theo ID snapshot của master contract; chưa lấy registry/geometry
   APP thực tế, chưa chứng minh model version/layout/parity. JSON dùng
   vector compatibility, không phải output strict shared-symbol đã duyệt.
3. Chưa chạy API → production editor → APP import/render; round-trip đã
   kiểm là serializer editor cục bộ. Chưa có reviewer APP độc lập.
4. Chữ/số/nhãn đã chép ở các vùng quan sát, nhưng chưa khóa đủ mọi lần xuất
   hiện của chữ. Vị trí code được dời trong schema để dễ đọc. Cần review
   chi tiết mọi pin, label, crossing và contour theo ảnh cuối.
5. Khung pinout 7P/39P/16P/10P giữ số khoang, thứ tự số và nhãn biên; contour
   có giản lược. pinoutData là extension legacy, chưa migrate thành
   assemblyData.pinoutGroups của APP.
6. Mạch 04/06: cụm đèn phanh/hậu vẽ hai filament nhưng chỉ hai đường ngoài;
   liên kết nội bộ vẫn cần review, không suy thêm chân.
7. Mạch 06: giữ HI/LO/PO và năm anchor ngoài của cụm LED ghi 6P.
   symbolChannels là dữ liệu draft, chưa xác minh contract DetailedLamp APP.
8. Mạch 12: O₂ ghi 2P nhưng chỉ một dây tín hiệu được vẽ; giữ sự bất định,
   không thêm return. Cầu SCS là annotation có điều kiện, không nối thường
   trực Br với G/P trong wire graph.
9. Hình tiếp điểm chân chống/CKP và một số chi tiết symbol dùng geometry
   legacy; phải đối chiếu model thật và source detail trước nghiệm thu.
10. Chế độ tối ở trang review đổi nền trang; canvas giữ màu Studio. Chưa
    kiểm khả năng render theme sáng/tối của APP.

Mỗi mạch có inventory, model proposal, evidence, hash ảnh/schema và logs.
genReview=REVIEW_REQUIRED, appReview=PENDING. Test pass xác minh phần kỹ thuật
đã chạy, không tự chứng minh đúng ảnh hay điện học. Không áp dụng file này
để đổi DB DONE hoặc phát hành.

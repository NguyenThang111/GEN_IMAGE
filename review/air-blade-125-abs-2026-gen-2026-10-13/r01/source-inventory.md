# Inventory ảnh gốc Air Blade 125 ABS 2026

Đọc trực tiếp 13 JPG trong `source/air-blade-2026-125-abs/` trước khi tạo candidate. Tọa độ mô tả theo ảnh hiển thị nguyên bản. Đây là inventory nguồn, không phải chứng nhận điện học. Hình Smartkey/ABS/PGM-FI có nhiều nhãn xoay; giữ tất cả nhóm chân và chú thích.

## Các phần nguồn lặp lại đã nhìn thấy

Ở horn, turn-signals, brake-light, fuel-indicator, night-lighting, vehicle-speed: ắc quy (+ R, - G mass); MAIN 20A R→R/W; relay chính 4 chân gồm contact R/W→Bl/R và coil G→Bl/Bu; khóa điện 2 tiếp điểm riêng Bl/R→R/Bl và Bl/Bu→R/Br; ECU 15A R→R/Br. Nhánh R từ cực dương tách tới MAIN và ECU. Mass relay độc lập với contact. SUB1 10A R/Bl→Bl, trừ nhánh HEAD LIGHT 5A của đèn pha. Vị trí tương đối nguồn bên trái, tải bên phải. Không nối coil với contact.

## power-distribution

- Góc trái dưới: ắc quy, mass G. Trục R bên trái cấp BACKUP 10A, ABS MOTOR 15A, MAIN 20A, ECU 15A và nhánh trực tiếp tiếp điểm rơ-le đề/sạc.
- BACKUP: P/Bl tới SCU, LED thùng yên, cụm đồng hồ; nhánh LED mặt khóa ghi Bl tại đầu ra. Giữ bốn dòng tải và mã riêng.
- ABS MOTOR: R tới bộ điều khiển ABS.
- MAIN: R/W vào contact relay chính; ra Bl/R tới khóa điện, tiếp điểm rơ-le đề/sạc, SUB3 5A. SUB3 ra Bu tới bộ sạc USB.
- Coil relay: G mass và Bl/Bu. Khóa điện hai tiếp điểm như trên; ECU 15A cấp R/Br.
- HEAD LIGHT 5A: R/Bl→W/G tới cụm đèn pha LED.
- SUB1 10A: R/Bl→Bl, 8 tải: SCU; công tắc phanh trước/sau; đèn pha LED định vị; đèn soi biển số; công tắc còi; rơ-le xi nhan; cụm đồng hồ; đèn hậu.
- Bl/Bu sau khóa tới cuộn hút rơ-le đề/sạc, ECM, ABS MAIN 5A và SUB2 10A. ABS MAIN ra Bl/Y tới ABS.
- SUB2 ra Bl/W, 5 tải: van cầm chừng nhanh; DLC; mô tơ bơm xăng; mô bin sườn; kim phun.
- Giữ mọi mũi tên continuation; các danh sách tải không phải chân vật lý ECM tự suy ra.

## horn

- Nguồn chung; SUB1 Bl vào công tắc còi, ra Lg vào còi. Còi ra G mass bên phải.
- Diode dưới còi mắc song song: Lg bên trái, G bên phải, vạch cathode về trái/Lg theo hình. Không mắc nối tiếp diode với còi.
- 3 mass hiển thị: ắc quy, coil relay, còi/diode.

## turn-signals

- Nguồn chung; SUB1 Bl tới chớp xi nhan; ra Gr tới diode (anode trái, cathode phải), G/Bl từ diode tới chân W/common công tắc xi nhan.
- Công tắc 3 chân W, L, R: nhánh O cấp 2 bóng trước/sau trái; Lb cấp 2 bóng trước/sau phải. Bốn bóng sợi đốt độc lập, mỗi bóng có G mass.
- Không nối O và Lb với nhau. Nhãn thứ tự trên xuống: sau trái, trước trái, trước phải, sau phải.

## brake-light

- Nguồn chung; Bl tách hai công tắc phanh trước/sau song song. Hai đầu G/Y nhập chung cấp đèn phanh; G của đèn xuống mass.
- Hình đèn chứa 2 ký hiệu LED. Chỉ hai dây ngoài được thể hiện; nội bộ cụm đèn cần giữ hình/kênh và review, không tự suy chân phụ.

## fuel-indicator

- Nguồn chung; cụm đồng hồ bên phải: 16 IGN=Bl, 13 FUEL=Y/W, 6 GND=G.
- Y/W và G qua giắc 5P đổi màu tương ứng sang R và Bl tại phao xăng 2 dây. Chỉ hai đường đang dùng, không tạo 5 chân có dây.
- Phao là biến trở với cần phao; đầy 7–11 Ω, cạn 384–396 Ω. Dung tích bình xăng 4,4 lít.
- Bảng giắc 16P phía đồng hồ: hàng trên 8,7,6,5,4,3,2,1; hàng dưới 16,15,14,13,12,11,10,9. Giữ lệch khoang/hình vỏ; bảng không có graph dây.

## night-lighting

- Nguồn chung; HEAD LIGHT 5A ra W/G→VCC H/L của cụm pha; SUB1 10A Bl→VCC PO và song song tới đèn biển số/đèn hậu.
- Cụm pha 6P có 5 đường dùng: HI BEAM=Bu, DIMMER SW=W, VCC H/L=W/G, VCC PO=Bl, GND=G/Bl. Giữ 3 kênh HI/LO/PO và nhánh nội bộ theo ảnh, cần review mô hình cụm LED.
- Bu từ HI BEAM tới đồng hồ 3 HIGH BEAM (16P).
- Công tắc pha/cốt 3P: W tới DIMMER, G/Bl common xuống mass; một vị trí không thể hiện dây ngoài. Không bịa chân thứ ba có dây.
- Đèn biển số qua giắc 2P, Bl/G. Đèn phanh/đèn hậu qua giắc 9P, Bl/G trong mạch này; không nhầm dây phanh G/Y ở mạch riêng.

## vehicle-speed

- Nguồn chung; đồng hồ 16 IGN Bl, 9 SP ABS P/G, 6 GND G.
- P/G là mạng chung đồng hồ 9 ↔ ECM A7 SP-SE ↔ ABS 6 RPO.
- ABS 3 RVWS ↔ cảm biến VS P/W; ABS 12 RVWB ↔ cảm biến VS P. Cảm biến VS có rotor minh họa, không phải junction.
- Vỏ giắc: đồng hồ 16P, ECM 39P, ABS 16P.

## ignition

- Nguồn trái trên: ắc quy, ECU15A R→R/Br, một tiếp điểm khóa R/Br→Bl/Bu; Bl/Bu cấp ECM A8 và SUB2 10A. SUB2 Bl/W tới coil.
- ECM: A39 G/W và A11 G/Bl tới công tắc chống nghiêng 2P; B2 G về ắc quy; A8 Bl/Bu nguồn; A27 Y/Bu tới coil điều khiển.
- CKP 6 dây qua giắc 6P: ECM A23 W/R→U; A24 W/Bu→V; A26 W/Bl→W; A10 G→GND; A9 Br/Bl→OUT; A25 Bu/Y→PUL.
- Mô bin hai đầu sơ cấp Bl/W và Y/Bu, cao áp tới bugi, bugi mass. Không nối kín khe đánh lửa.
- Bảng chân B/C riêng 5P/3P, có B1 B2 B3 B4 B5 / C1 C2 C3. Bảng 39P phía cực đực ECM: 3 hàng, hàng 1 13→1, hàng 2 26→14, hàng 3 39→27.
- Công tắc chống nghiêng hình UP/DOWN với 2 đường thực; nội bộ/biến thể cần review.

## starting

- Nguồn: MAIN20A, ECU15A, relay chính, khóa kép, SUB1 10A. Relay đề/sạc 5 chân: contact chọn Bl/R hoặc R, common R/Y→ECM B1; coil Bl/Bu và Y→ECM A32.
- ECM B2 G; A8 Bl/Bu; A35 Lg nối SCU19; SCU15 Lg từ công tắc khởi động. Hai công tắc phanh song song cấp G/Y vào công tắc khởi động.
- Máy phát/khởi động nối sao 3 cuộn: C1 R/Bu→W; C2 R/W→V; C3 R/Y→U.
- CKP 6 dây qua 6P: A23/U W/R; A24/V W/Bu; A26/W W/Bl; A25/PUL Bu/Y; A9/OUT Br/Bl; A10/GND G.
- Chống nghiêng 2P: A11 G/Bl, A39 G/W, UP/DOWN.

## idling-stop

- Cụm nguồn/relay đề-sạc/máy phát/CKP như starting; ECM B2,A8,A32,B1,C1,C2,C3,A23,A24,A26,A25,A9,A10.
- Đồng hồ 16 IGN Bl, 9 SP ABS P/G, 12 M-TXD Gr, 6 GND G. Gr→ECM A3; P/G↔ECM A7↔ABS6.
- Chống nghiêng A39 G/W và A11 G/Bl; công tắc dừng cầm chừng 3P có 2 đường: G/Bl chung A11, Bl/G→A20; vị trí còn lại không dây.
- ABS có các chân 6,10,2,3,12: cảm biến bánh trước Bu→10, W→2 qua giắc 2P; cảm biến VS P/W→3, P→12.
- TP 3P: A13 Y/W, A36 Y/Bu, A12 G/O (chân nguồn, wiper và return theo hình biến trở). ECT 2P: A37 P/W, A12 G/O chung với TP.

## smartkey-system

- Toàn ảnh nhãn xoay nhưng không được bỏ nhánh. SCU 21P có 19 chân dùng: 1 B+ P/Bl;20 U-BOX LED Gr;7 SMART IND R/W;16 ALARM IND P/Y;8 WINKER L O;9 WINKER R Lb;12 BUZZER+ Bu;13 BUZZER- G;19 ENG START Lg;10 IMOID R;11 IMOAU Bu;15 START SW Lg;14 ENTRY MODE Bl/G;3 GND G/Bl;2 MAIN SW Bl;4 SOL+ Bl;5 SOL- Bl;21 FACE LED Bl;6 KNOB SW Bl.
- Nguồn BACKUP10A, ECU15A, MAIN20A, relay chính, khóa điện kép, SUB1 10A. BACKUP P/Bl có nhánh SCU1, LED hộp đồ, đồng hồ8. LED hộp đồ Gr→SCU20.
- Đồng hồ 16P: 8 P/Bl,15 R/W,10 P/Y,14 Lb,4 O,6 G. Bốn bóng xi nhan nối hai mạng O/Lb với SCU8/9 và đồng hồ4/14, G mass từng bóng.
- Buzzer 2 dây từ SCU12/13. ECM39P A35 ST-SW Lg↔SCU19; A34 IMOID R↔SCU10; A6 IMOAU Bu↔SCU11.
- Khóa điện 7P gồm cuộn điện từ 2/5, LED mặt 6/7, công tắc núm 3/4. SCU4→2; SCU5→5; SCU21→6; SCU6→3; chân7 và4 về mass/nguồn chung theo ảnh. Giữ độc lập các phần.
- SCU2 MAIN SW nhận Bl sau SUB1; phanh trước/sau song song Bl→G/Y; nút khởi động G/Y→Lg SCU15.
- SCU14 tới bộ tiếp hợp kiểm tra; SCU3 mass. FOB và 2 mũi tên radio khác hướng tới LF ANTENNA/RF UNIT, annotation không dây điện.
- Bảng 21P: ba cột/7 hàng với thứ tự 7,14,21 ở trên đến1,8,15 dưới. Bảng7P khóa có hai cột lệch, số1..7; giữ hình vỏ.

## abs

- ABS block 16P: 7 IG Bl/Y;15 BLS G/Y;8 IND R/Bl;16 BAT R;6 RPO P/G;3 RVWS P/W;12 RVWB P;2 FVWS W;10 FVWB Bu;5 SCS Br;13 DIAG O/W;11 GND G/Bl.
- Nguồn hộp cầu chì: SUB2 10A Bl/Bu→Bl/W DLC; MAIN ABS5A Bl/Bu→Bl/Y ABS7; SUB1 10A R/Bl→Bl đồng hồ/phanh; MAIN20A R→R/W relay; ECU15A R→R/Br khóa; MOTOR ABS15A R→ABS16.
- Khóa kép và relay chính như nguồn. Công tắc phanh trước/sau song song Bl→G/Y, G/Y tới đèn phanh và ABS15; đèn G mass.
- Đồng hồ:16 Bl,7 R/Bl từ ABS8,9 P/G mạng ABS6 và ECM A7,6 G. ECM A11 G/Bl chung DLC/mass theo ảnh.
- DLC4 đường: Bl/W, G/Bl, Br, O/W; đầu nối SCS minh họa ngắn mạch chỉ ở annotation chẩn đoán, không tự áp thành đường nối thường trực.
- Cảm biến VS sau 2P: P/W/P→ABS3/12. Cảm biến trước 2P: W/Bu→ABS2/10; vòng phát xung riêng.
- DTC phải giữ: ECU ABS 8-1; IG/BAT 6-1,6-2; motor5-1,5-2,5-3; relay5-4; solenoid3-3,3-4; RVWS1-3,1-4; FVWS1-1,1-2; front sensor1-2,4-1,4-2; rotor2-1; tyre7-1.
- Bảng giắc16P hai hàng dọc:1..8 /9..16, phía bộ điều khiển. Hộp cầu chì/relay là khung nhóm, không nối chung các phần bên trong.

## pgm-fi

- ECM chân trên: A32 S/RELAY Y;B1 P(+) R/Y;A8 BATT Bl/Bu;A1 SOLV O/Bl;A4 F-PUMP Br;A27 IGN Y/Bu;A5 INJ P/Bu;A3 M-TXD Gr;C3 U-PHASE R/Y;C2 V-PHASE R/W;C1 W-PHASE R/Bu.
- ECM chân dưới: B2 N(-) G;A23 IHU W/R;A24 IHV W/Bu;A26 IHW W/Bl;A25 PCB Bu/Y;A9 VOUT Br/Bl;A10 P-GND G;A13 VCC Y/W;A36 THR Y/Bu;A37 TW P/W;A12 SG G/O;A33 O2 Bl/O;A22 K-LINE O/W;A21 SCS Br;A11 LG G/Bl;A39 SS-SW G/W;A20 ID-SW Bl/G;A7 SP-SE P/G;A35 ST-SW Lg;A34 IMOID R;A6 IMOAU Bu.
- MAIN20A, ECU15A, SUB1/2 10A, relay chính và relay đề/sạc5 chân. Bl/W cấp van cầm chừng, bơm, mô bin, kim phun và DLC; Bl cấp đồng hồ IGN và hai phanh.
- CKP6P, máy phát sao U/V/W, TP3P, ECT2P, OXY2P (Bl/O đổi Bl qua giắc), DLC/SCS, chống nghiêng2P, dừng cầm chừng3P.
- Van cầm chừng nhanh 26–30Ω, kim phun11–13Ω, ECT80°C 1,1–1,3kΩ;100°C 0,1–0,2kΩ (giữ đúng chữ nguồn, cần reviewer xác nhận trị số bất thường).
- Đồng hồ16P:16 IGN Bl,12 M-TXR Gr (nhãn ảnh này khác M-TXD ở mạch idling),6 GND G. Giữ khác biệt nhãn, không tự chuẩn hóa.
- ABS6 P/G↔A7; ABS2/10 cảm biến trước W/Bu; ABS3/12 cảm biếnVS P/W/P. SCU21P19 Lg↔A35;10 R↔A34;11 Bu↔A6;15 Lg từ nút khởi động G/Y sau phanh.
- DTC nguồn: CKP52-1,52-2; TP8-1,8-2;ECT7-1,7-2;OXY21-1,21-2;ABS66-1;ECM33-2;van82-1;coil91-1;injector12-1. Giữ biểu tượng MIL/no-start và chú giải.
- Bảng chân ECM39P (A) và giắc3P/5P B/C là presentation độc lập với graph chân có dây.

## Findings trước GEN

1. Cụm LED pha/phanh/hậu, chống nghiêng và hình vỏ giắc cần review model; không xem type validator là chứng minh hình đúng.
2. Production index-DRbWTSmc.js không chứa symbolRef/textLayout/drawing.version. Cần kiểm khả năng giữ extension khi import; không tuyên bố shared registry được triển khai.
3. Chưa có review APP độc lập; mọi candidate giữ draft. Các trị số/nhãn mâu thuẫn giữa các mạch giữ theo từng ảnh và ghi finding.

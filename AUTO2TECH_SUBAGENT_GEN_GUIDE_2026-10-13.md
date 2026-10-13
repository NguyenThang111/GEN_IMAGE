# AUTO2TECH Sub-Agent — Tài liệu bắt buộc khi GEN schema JSON

Ngày viết: 2026-10-13. Dựa trên lỗi thực tế của session air-blade-125-abs-2026-gen-2026-10-13.

---

## 1. Nguyên tắc cốt lõi

**Trước khi GEN bất kỳ component nào, đối chiếu với bảng registry ở Mục 3.**  
`type` và `symbolRef.id` phải khớp với registry. Không được tự suy, không được dùng tên có vẻ đúng.

---

## 2. Các lỗi đã gặp và cách fix

### 2.1 `unsupported type: "load"` — component tải/continuation

**Sai:**
```json
{
  "type": "load",
  "symbolRef": { "id": "load.group@1", ... }
}
```

**Đúng:**
```json
{
  "type": "continuation",
  "symbolRef": { "id": "continuation.loads@1", "version": 1, "ports": { "in": "in" } }
}
```

**Áp dụng cho:** Mọi nhánh tải/off-page continuation (BACKUP loads, SUB1 loads, Bl/Bu loads, v.v.)  
**Lý do:** `"load"` và `"load.group@1"` không tồn tại trong registry. Model đúng là `continuation.loads@1`.

---

### 2.2 `unsupported type: relay.spst` — relay chính 4 chân

**Sai:**
```json
{
  "type": "relay",
  "symbolRef": {
    "id": "relay.spst@1",
    "ports": { "coil_neg": "col", "coil_pos": "cor", "contact_in": "cl", "contact_out": "cr" }
  }
}
```

**Đúng:**
```json
{
  "type": "relay4Pin",
  "symbolRef": {
    "id": "relay.contact-coil4@1", "version": 1,
    "ports": {
      "coil-left": "col",
      "coil-right": "cor",
      "contact-left": "cl",
      "contact-right": "cr"
    }
  }
}
```

**Áp dụng cho:** Relay chính (RƠ LE CHÍNH) 4 chân — contact và coil riêng biệt.  
**Lý do:** `relay.spst@1` không tồn tại. Model đúng là `relay.contact-coil4@1`.  
**Lưu ý port names:** Dùng dấu gạch ngang (`coil-left`, `contact-left`), KHÔNG dùng gạch dưới (`coil_neg`).

---

### 2.3 `unsupported type: switch.2pole` — khóa điện 2 cực

**Sai:**
```json
{
  "type": "switch",
  "symbolRef": {
    "id": "switch.2pole@1",
    "ports": { "p1_in": "p1-in", "p1_out": "p1-out", "p2_in": "p2-in", "p2_out": "p2-out" }
  }
}
```

**Đúng:**
```json
{
  "type": "switch",
  "symbolRef": {
    "id": "switch.dpst4@1", "version": 1,
    "ports": {
      "pole1-in": "p1-in",
      "pole1-out": "p1-out",
      "pole2-in": "p2-in",
      "pole2-out": "p2-out"
    }
  }
}
```

**Áp dụng cho:** Khóa điện 2 tiếp điểm (DPST — Double Pole Single Throw).  
**Lý do:** `switch.2pole@1` không tồn tại. Model đúng là `switch.dpst4@1`.  
**Lưu ý port names:** Dùng `pole1-in/pole1-out/pole2-in/pole2-out`, KHÔNG `p1_in/p1_out`.

---

### 2.4 `unsupported type: relay.dpst` — relay đề/sạc 5 chân

**Sai:**
```json
{
  "type": "relay",
  "symbolRef": { "id": "relay.dpst@1", ... }
}
```

**Đúng:**
```json
{
  "type": "relay",
  "symbolRef": {
    "id": "relay.changeover-coil5@1", "version": 1,
    "ports": {
      "common": "com",
      "throw1": "throw1",
      "throw2": "throw2",
      "coil-left": "cl",
      "coil-right": "cr"
    }
  }
}
```

**Áp dụng cho:** Relay đề/sạc 5 chân (changeover: NC, NO, common + coil).  
**Lý do:** `relay.dpst@1` không tồn tại. Model đúng là `relay.changeover-coil5@1`.

---

### 2.5 Cascade: `invalid wires` sau lỗi component

Khi component có type unsupported, validator APP không load terminal coordinates → mọi wire nối vào component đó đều fail validate.  
**Fix:** Sửa component trước, wires không cần sửa nếu `from`/`to` format đúng (`"componentId.terminalId"`).

---

## 2b. CRITICAL: Production 23-type profile

**APP production chỉ accept đúng 23 type sau. Bất kỳ type nào khác → `unsupported type`.**

```
battery, fuse, relay, switch, selectorSwitch, scu, ecm, acg,
connector, ground, junction, horn, flasher, diode, lamp, gauge,
sensor, ignitionCoil, sparkPlug, motor, injector, pump, valve, device
```

Nguồn xác minh: `AUTO2TECH_COMPONENT_IMPORT_COMPATIBILITY.md`, bằng chứng từ sự cố SCOOPY 2023.

**`relay4Pin` KHÔNG có trong danh sách → dùng `type: "relay"` cho mọi relay.**

**Nhánh tải/continuation → `type: "device"` + `symbolType: "loadGroup"` + `semanticKind: "continuation.loads"`**  
Không dùng `type: "continuation"` — không tồn tại trong production.

---

## 3. Bảng tra cứu nhanh — Model Registry

Tra theo chức năng linh kiện, lấy đúng `type` và `symbolRef.id`:

| Linh kiện | type | symbolRef.id | Port roles bắt buộc |
|---|---|---|---|
| Ắc quy | `battery` | `battery@1` | `negative`, `positive` |
| Cầu chì | `fuse` | `fuse@1` | `a`, `b` |
| Mass/Ground | `ground` | `ground@1` | `in` |
| Junction | `junction` | `junction@1` | `node` |
| Junction bus 2 | `junction` | `junction.bus2@1` | `node1`, `node2` |
| Junction bus 3 | `junction` | `junction.bus3@1` | `node1`, `node2`, `node3` |
| **Relay chính 4 chân** | `relay4Pin` | `relay.contact-coil4@1` | `contact-left`, `contact-right`, `coil-left`, `coil-right` |
| **Relay đề/sạc 5 chân** | `relay` | `relay.changeover-coil5@1` | `common`, `throw1`, `throw2`, `coil-left`, `coil-right` |
| **Khóa điện DPST** | `switch` | `switch.dpst4@1` | `pole1-in`, `pole1-out`, `pole2-in`, `pole2-out` |
| Công tắc SPST | `switch` | `switch.spst2@1` | `a`, `b` |
| Công tắc xoay 3 vị | `selectorSwitch` | `switch.selector3@1` | `common`, `throw1`, `throw2` |
| **Continuation/tải** | `continuation` | `continuation.loads@1` | `in` |
| Còi 2 dây | `horn` | `horn.two-terminal@1` | `a`, `b` |
| Còi buzzer 2 dây | `horn` | `buzzer.two-terminal@1` | `a`, `b` |
| Còi buzzer có cực | `horn` | `buzzer.polarized2@1` | `positive`, `negative` |
| Đèn LED 2 dây | `lamp` | `lamp.led2@1` | `feed`, `return` |
| Đèn sợi đốt 2 dây | `lamp` | `lamp.filament2@1` | `feed`, `return` |
| Đèn sợi đốt kép 3 dây | `lamp` | `lamp.dual-filament3@1` | `common`, `high`, `low` |
| Module đèn LED (cụm pha) | `lamp` | `lamp.led-assembly5@1` | instance | `requiresReview` |
| Diode | `diode` | `diode.rectifier2@1` | `anode`, `cathode` |
| Rơ le chớp xi nhan 2 dây | `flasher` | `flasher.two-terminal@1` | `input`, `output` |
| Rơ le chớp xi nhan 3 dây | `flasher` | `flasher.three-terminal@1` | `input`, `output`, `ground` |
| ECM/ECU | `ecm` | `control.ecm@1` | instance |
| SCU | `scu` | `control.scu@1` | instance |
| Máy phát 3 pha | `acg3Phase` | `generator.star3@1` | `left`, `top`, `right` |
| Tụ điện có cực | `capacitor` | `capacitor.polarized@1` | `top`, `bottom` |
| Bộ nạp/điều áp | `regulator` | `regulator.three-phase5@1` | `top`, `left-top`, `left-middle`, `left-bottom`, `bottom` |
| Bugi | `sparkPlug` | `spark-plug.chassis1@1` | `hv` |
| Mô bin đánh lửa | `ignitionCoil` | `ignition.module3@1` | `primary-a`, `primary-b`, `hv` |
| Kim phun | `injector` | `injector.solenoid2@1` | `a`, `b` |
| Van điện từ | `valve` | `valve.solenoid2@1` | `a`, `b` |
| Mô tơ DC | `motor` | `motor.dc2@1` | `a`, `b` |
| Mô tơ + vỏ 4 dây | `motor` | `motor.chassis4@1` | `power`, `case-left`, `case-right`, `case-bottom` |
| Cảm biến tốc độ | `sensor` | `sensor.speed-probe2@1` | instance |
| Cảm biến CKP 6 dây | `sensor` | `sensor.ckp-module6@1` | instance |
| Cảm biến oxy 1 dây | `sensor` | `sensor.oxygen-signal1@1` | `signal` |
| Cảm biến oxy 2 dây | `sensor` | `sensor.oxygen-probe2@1` | `signal`, `return` |
| Nhiệt điện trở | `sensor` | `sensor.thermistor2@1` | `a`, `b` |
| Biến trở xăng | `sensor` | `sensor.fuel-rheostat2@1` | `resistor-end`, `wiper` |
| Cảm biến bướm ga 3 dây | `sensor` | `sensor.potentiometer3@1` | `supply`, `wiper`, `return` |
| Cụm đồng hồ tốc độ | `device` | `gauge.speed5@1` | instance |
| Cụm đồng hồ xăng | `device` | `assembly.cluster-fuel@1` | instance |
| Khóa điện 7P | `device` | `assembly.key-lock6@1` | `sol-pos`, `sol-neg`, `face-pos`, `face-neg`, `knob-in`, `knob-out` |
| Giắc đôi 1 cặp | `connector` | `connector.paired1@1` | `pair1-a`, `pair1-b` |
| Giắc đôi 2 cặp | `connector` | `connector.paired2@1` | `pair1-a`..`pair2-b` |
| Giắc đôi 6 cặp | `connector` | `connector.paired6@1` | `pair1-a`..`pair6-b` |
| Bảng khoang giắc | `connector` | `assembly.pinout@1` | instance |
| Module chức năng | `device` | `assembly.functional-module@1` | instance |
| Điện trở | `device` | `passive.resistor2@1` | `a`, `b` |
| Cuộn dây 2 dây | `device` | `solenoid.coil2@1` | `a`, `b` |
| Chống nghiêng module | `selectorSwitch` | `switch.tilt-module3@1` | instance | `requiresReview` |
| FOB/remote | `device` | `assembly.remote@1` | instance |

---

## 4. Wire format — PRODUCTION (AB160 reference)

**KHÔNG dùng format cũ.** Production validator từ chối cả 24 wire nếu format sai.

### Format đúng:

```json
{
  "id": "main-to-relay-cl",
  "from": { "componentId": "fuse-main", "terminalId": "b" },
  "to": { "componentId": "relay-main", "terminalId": "cl" },
  "points": [ {"x": 280, "y": 350}, {"x": 380, "y": 350} ],
  "code": "R/W",
  "primaryColor": "#dd2222",
  "state": "controlled",
  "labels": [
    {
      "kind": "text", "text": "R/W",
      "x": 328, "y": 340,
      "size": 13, "anchor": "middle", "rotate": 0,
      "bold": true, "fill": "#343434",
      "owner": "main-to-relay-cl", "role": "wire-label"
    }
  ]
}
```

### Format SAI (validator từ chối):

```json
{
  "from": "fuse-main.b",          ← SAI: phải là object
  "to": "relay-main.cl",          ← SAI: phải là object
  "points": [[280,350],[380,350]], ← SAI: phải là [{x,y}]
  "color": "#dd2222",              ← SAI: phải là primaryColor
  "colorCode": "R/W"               ← SAI: phải là code
}
```

### Bảng đổi tên field:

| Cũ (sai) | Mới (đúng) |
|---|---|
| `"from": "comp.terminal"` | `"from": {"componentId":"comp","terminalId":"terminal"}` |
| `"to": "comp.terminal"` | `"to": {"componentId":"comp","terminalId":"terminal"}` |
| `"points": [[x,y],...]` | `"points": [{"x":n,"y":n},...]` |
| `"color": "#hex"` | `"primaryColor": "#hex"` |
| `"colorCode": "R"` | `"code": "R"` |
| _(thiếu)_ | `"state": "controlled"` |
| `"labels": [{"text":"R"}]` | `"labels": [{"kind":"text","text":"R","x":...,"y":...,"size":13,"anchor":"middle","rotate":0,"bold":true,"fill":"#343434","owner":"wire-id","role":"wire-label"}]` |

---

## 5. Checklist GEN mỗi mạch

Trước khi lưu file JSON, chạy checklist:

- [ ] Mọi `symbolRef.id` đều có trong bảng registry Mục 3
- [ ] Mọi `type` khớp với acceptedTypes của symbolRef tương ứng
- [ ] Port role names dùng dấu `-` không phải `_` (ví dụ: `coil-left`, không phải `coil_neg`)
- [ ] Không có `type: "load"` — phải là `type: "continuation"`
- [ ] Không có `relay.spst@1`, `relay.dpst@1`, `switch.2pole@1`, `load.group@1`
- [ ] Mọi wire `from`/`to` trỏ đến component+terminal tồn tại
- [ ] Wire `points[0]` khớp tọa độ terminal `from`, `points[-1]` khớp terminal `to`
- [ ] Nhánh tải dùng `continuation.loads@1` với `targets` không rỗng (trong label)
- [ ] Không tự suy terminal vật lý ECM — dùng continuation cho danh sách chân

---

## 6. Lỗi đã fix trong session này

| File | Lỗi | Fix |
|---|---|---|
| `01. power-distribution.schema.json` | `relay.spst@1`, `switch.2pole@1`, `relay.dpst@1`, 6× `load.group@1` | Đổi sang đúng registry IDs + type |
| `04. brake-light.schema.json` | `relay.spst@1`, `switch.2pole@1` | Fix tự động |
| `05. fuel-indicator.schema.json` | `relay.spst@1`, `switch.2pole@1` | Fix tự động |
| `06. night-lighting.schema.json` | `relay.spst@1`, `switch.2pole@1` | Fix tự động |
| `07. vehicle-speed.schema.json` | `relay.spst@1`, `switch.2pole@1` | Fix tự động |
| `09. starting.schema.json` | `relay.spst@1`, `switch.2pole@1`, `relay.dpst@1` | Fix tự động |
| `10. idling-stop.schema.json` | `relay.spst@1`, `switch.2pole@1`, `relay.dpst@1` | Fix tự động |
| `11. smartkey-system.schema.json` | `relay.spst@1`, `switch.2pole@1` | Fix tự động |
| `12. abs.schema.json` | `relay.spst@1`, `switch.2pole@1` | Fix tự động |
| `13. pgm-fi.schema.json` | `relay.spst@1`, `switch.2pole@1`, `relay.dpst@1` | Fix tự động |

Files không bị lỗi type (đã đúng từ đầu): `02. horn`, `03. turn-signals`, `08. ignition`.

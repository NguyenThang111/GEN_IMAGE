import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../users/user.entity';
import { TaskDraft, TaskDraftPointFactors } from './task-draft.entity';

type PoolDraft = {
  key: string;
  owner: 'phu' | 'vinh' | 'thang';
  topic: string;
  output: string;
  criteria: string[];
  factors: TaskDraftPointFactors;
  priority?: string;
};

const pool: PoolDraft[] = [
  {
    key: 'P1-keyscan-20-kit', owner: 'phu', topic: 'KEYSCAN 1.3', priority: 'ƯU TIÊN',
    output: 'Soạn vật tư cho 20 mạch KeyScan 1.3 và 20 bộ cáp KeyScan vào một khay sẵn sàng sản xuất.',
    criteria: ['Có danh sách vật tư cho một mạch và một bộ cáp KeyScan.', 'Số lượng đã được nhân thành 20 bộ và kiểm với tồn thực tế.', 'Vật tư hiện có được xếp chung vào khay KEYSCAN 1.3 ×20.', 'Ghi rõ trạng thái đã đủ bao nhiêu trên 20 bộ.', 'Mọi vật tư thiếu có tên, số lượng thiếu và Purchase Request tương ứng.', 'Người nhận khay có thể bắt đầu hàn mà không phải tìm lại vật tư.'],
    factors: { outputScope: 1, complexity: 0, uncertainty: 1, risk: 1, verification: 1 },
  },
  {
    key: 'P2-rh850-investigation', owner: 'phu', topic: 'KEYSCAN 1.3 · RH850',
    output: 'Kiểm tra mạch KeyScan 1.3 mới hàn có giao tiếp ổn định với RH850 hay không; trả về PASS hoặc chẩn đoán FAIL có bằng chứng.',
    criteria: ['Ghi rõ phiên bản board, firmware và thiết bị test.', 'Mạch lên nguồn, không chập và không nóng bất thường.', 'Xác nhận chân nguồn và chân giao tiếp RH850.', 'Thử ít nhất một request/response thực tế.', 'Tái hiện tối thiểu ba lần và ghi số lần PASS/FAIL.', 'Có log lệnh, phản hồi và thời điểm giao tiếp.', 'Kết luận rõ phần mềm, phần cứng, không tái hiện được hoặc chưa đủ dữ liệu.', 'Nếu nghiêng về phần cứng, ghi bằng chứng và tạo follow-up cần thiết.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 2, risk: 1, verification: 1 },
  },
  {
    key: 'P3-keyscan-prototype-zip', owner: 'phu', topic: 'KEYSCAN 1.3 · PROTOTYPE',
    output: 'Hàn một mạch KeyScan 1.3, đổi tên Device BLE và đóng gói ZIP firmware chuẩn.',
    criteria: ['Tên Device BLE và quy tắc tên ZIP được Admin xác nhận trước khi bắt đầu.', 'Mạch hàn đủ, ngoại quan đạt và không chập nguồn.', 'Flash firmware thành công.', 'Thiết bị quảng bá đúng tên BLE đã duyệt.', 'App tìm thấy và kết nối được thiết bị.', 'ZIP đúng tên, đúng firmware và giải nén được.', 'Flash thử lại từ chính ZIP thành công.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 1, risk: 1, verification: 2 },
  },
  {
    key: 'V1-keybox-hardware', owner: 'vinh', topic: 'KEYBOX · HARDWARE',
    output: 'Hàn một mạch KeyScan 1.3 và đóng bộ cáp hoàn chỉnh thành KeyBOX dùng với ScanBox.',
    criteria: ['Mạch hàn đủ và ngoại quan đạt.', 'Bộ cáp đúng pin map KeyBOX đã duyệt.', 'Đo thông mạch, không chạm chập và không đảo nguồn.', 'Đóng thành một bộ KeyBOX có nhận diện rõ.', 'Cắm ScanBox lên nguồn ổn định và nhận được thiết bị.', 'Ghi revision board và revision cáp của bộ mẫu.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 1, risk: 1, verification: 2 },
  },
  {
    key: 'V2-keybox-expander', owner: 'vinh', topic: 'KEYBOX · IC MỞ RỘNG',
    output: 'Chạy được luồng giao tiếp hai chiều giữa ScanBox và IC mở rộng trên KeyBOX.',
    criteria: ['ScanBox nhận được IC mở rộng/KeyBOX.', 'Gửi lệnh và nhận phản hồi hai chiều thành công.', 'Xử lý được mất kết nối hoặc phản hồi lỗi.', 'Chạy lặp lại ba lần không cần reset thủ công.', 'Không làm hỏng luồng ScanBox hiện có.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 2, risk: 1, verification: 1 },
  },
  {
    key: 'V3-keybox-full-feature', owner: 'vinh', topic: 'KEYBOX · FULL FEATURE',
    output: 'Chạy và báo cáo toàn bộ tính năng máy Key qua luồng ScanBox → KeyBOX.',
    criteria: ['Danh sách feature cần chạy được Admin duyệt trước khi bắt đầu.', 'Mỗi feature có trạng thái PASS/FAIL.', 'Feature PASS chạy end-to-end qua ScanBox → KeyBOX → ECU/SCU.', 'Lỗi không làm treo ScanBox hoặc KeyBOX.', 'Regression lại các feature chính sau khi sửa.', 'Có kết luận phần sẵn sàng dùng và phần cần follow-up.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 1, risk: 2, verification: 2 },
  },
  {
    key: 'V4-pump-cable-sourcing', owner: 'vinh', topic: 'CÁP BƠM · VẬT TƯ',
    output: 'Lập cấu thành cho một sản phẩm cáp bơm và tìm nguồn mua tối ưu để Admin xem và mua dần.',
    criteria: ['Có danh sách đầy đủ vật tư cho một cáp bơm.', 'Mỗi vật tư có quantity dùng cho một cáp.', 'Vật tư đã có trong Kho được map đúng mã.', 'Vật tư chưa có được đánh dấu để tạo mới.', 'Mỗi vật tư quan trọng có một đến hai link mua.', 'Link ghi giá tham khảo, MOQ và quy cách bán.', 'Chọn một link đề xuất dựa trên giá và khả năng mua lại.', 'Có chi phí vật tư ước tính cho một cáp, chưa tính công.', 'Admin có thể quyết định mua mà không phải tìm lại dữ liệu.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 2, risk: 1, verification: 1 },
  },
  {
    key: 'T1-easyscan-bin', owner: 'thang', topic: 'EASYSCAN 10.15 · BIN',
    output: 'Build và xác minh file BIN EasyScan 10.15 sẵn sàng để đóng gói.',
    criteria: ['Build BIN thành công từ đúng source/revision.', 'Ghi rõ version và thời điểm build.', 'Tên file BIN đúng quy ước.', 'Kiểm tra kích thước và checksum file.', 'Thiết bị test flash được BIN và khởi động bình thường.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 0, risk: 1, verification: 1 },
  },
  {
    key: 'T2-easyscan-zip', owner: 'thang', topic: 'EASYSCAN 10.15 · ZIP',
    output: 'Đóng ZIP EasyScan 10.15 chuẩn và smoke cài đặt từ chính gói đã bàn giao.',
    criteria: ['ZIP chứa đúng BIN và tài liệu cần thiết.', 'Tên ZIP và version đúng quy ước.', 'ZIP giải nén không lỗi.', 'Cài/flash thử từ chính ZIP thành công.', 'Thiết bị khởi động và chạy smoke chức năng chính.'],
    factors: { outputScope: 1, complexity: 0, uncertainty: 1, risk: 1, verification: 1 },
  },
  {
    key: 'T3-scanbox-15800', owner: 'thang', topic: 'SCANBOX · BAUDRATE 15800',
    output: 'Điều tra lỗi chuyển baudrate 15800 và kết luận có bằng chứng; không bắt buộc phải tìm ra bản fix.',
    criteria: ['Ghi rõ hardware, firmware và kịch bản test.', 'Tái hiện tối thiểu ba lần và ghi tỷ lệ lỗi.', 'Có log trước, trong và sau khi chuyển baudrate.', 'Đối chiếu ít nhất một cấu hình hoạt động và một cấu hình lỗi.', 'Khoanh vùng phần mềm, phần cứng, không tái hiện được hoặc chưa đủ dữ liệu.', 'Nếu nghiêng về phần cứng, ghi phép đo/bằng chứng tương ứng.', 'Tạo follow-up riêng chỉ khi đã xác định được hướng xử lý.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 2, risk: 1, verification: 1 },
  },
  {
    key: 'T4-scanbox-popup-matrix', owner: 'thang', topic: 'SCANBOX REPORT · RULE',
    output: 'Chốt ma trận điều kiện khi nào popup báo cáo chuyên sâu phải hiện hoặc không được hiện.',
    criteria: ['Liệt kê đầy đủ input/trạng thái liên quan.', 'Mỗi trường hợp có expected hiện hoặc không hiện.', 'Admin xác nhận ma trận trước khi code.', 'Có ít nhất một case biên và một case dữ liệu thiếu.', 'Ma trận đủ để QA test không cần hỏi lại.'],
    factors: { outputScope: 1, complexity: 0, uncertainty: 1, risk: 1, verification: 1 },
  },
  {
    key: 'T5-scanbox-popup-implement', owner: 'thang', topic: 'SCANBOX REPORT · POPUP',
    output: 'Implement popup báo cáo chuyên sâu đúng theo ma trận điều kiện đã duyệt.',
    criteria: ['Popup hiện đúng các case được duyệt.', 'Popup không hiện ở các case bị loại.', 'Nội dung và CTA đúng thiết kế hiện có.', 'Không tạo popup lặp ngoài ý muốn.', 'Luồng đóng/mở lại hoạt động ổn định.', 'Build và test chính pass.'],
    factors: { outputScope: 1, complexity: 1, uncertainty: 1, risk: 1, verification: 2 },
  },
  {
    key: 'T6-scanbox-popup-regression', owner: 'thang', topic: 'SCANBOX REPORT · REGRESSION',
    output: 'Regression popup báo cáo và xác nhận không có false-positive trong các luồng ScanBox chính.',
    criteria: ['Chạy toàn bộ case trong ma trận đã duyệt.', 'Ghi PASS/FAIL cho từng case.', 'Kiểm tra tối thiểu ba luồng ScanBox chính không liên quan.', 'Không có popup false-positive.', 'Có log lỗi và follow-up cho case chưa pass.', 'Kết luận rõ mức sẵn sàng bàn giao.'],
    factors: { outputScope: 1, complexity: 0, uncertainty: 1, risk: 1, verification: 1 },
  },
];

const replacedImportKeys = [
  'clickup-screen-2026-07-30:02-easyscan-bin-zip',
  'clickup-screen-2026-07-30:03-scanbox-baudrate',
  'clickup-screen-2026-07-30:09-scanbox-popup-report',
];

const developerEmails: Record<'phu' | 'vinh' | 'thang', string> = {
  phu: 'phusisiphu1@gmail.com',
  vinh: 'vinhdq2005@gmail.com',
  thang: 'thang310504@gmail.com',
};

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const drafts = app.get<Repository<TaskDraft>>(getRepositoryToken(TaskDraft));
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const people = await users.findBy({ username: In(['admin', 'phu', 'vinh', 'thang']) });
    const byUsername = new Map(people.map((user) => [user.username, user]));
    const admin = byUsername.get('admin');
    if (!admin) throw new Error('Admin account is required');
    for (const username of ['phu', 'vinh', 'thang'] as const) {
      const user = byUsername.get(username);
      if (!user) throw new Error(`Missing user ${username}`);
      if (user.email !== developerEmails[username]) {
        user.email = developerEmails[username];
        await users.save(user);
      }
    }

    let created = 0;
    for (const row of pool) {
      const importKey = `workplace-week1-2026-08:${row.key}`;
      if (await drafts.findOneBy({ importKey })) continue;
      const owner = byUsername.get(row.owner);
      if (!owner) throw new Error(`Missing user ${row.owner}`);
      await drafts.save(drafts.create({
        topic: row.topic,
        description: row.output,
        assigneeIds: [owner.id],
        criteria: row.criteria,
        pointFactors: row.factors,
        dueDate: null,
        sourceStatus: 'WEEK 1 · AUG',
        sourcePriority: row.priority ?? null,
        importKey,
        createdById: admin.id,
        deletedById: null,
        deletedAt: null,
      }));
      created += 1;
    }

    const replaced = await drafts.findBy({ importKey: In(replacedImportKeys) });
    let replacedCount = 0;
    for (const draft of replaced) {
      if (draft.deletedAt) continue;
      draft.deletedAt = new Date();
      draft.deletedById = admin.id;
      await drafts.save(draft);
      replacedCount += 1;
    }
    const visible = await drafts.countBy({ importKey: In(pool.map((row) => `workplace-week1-2026-08:${row.key}`)), deletedAt: IsNull() });
    process.stdout.write(`Week 1 pool: ${created} created, ${visible} visible, ${replacedCount} old drafts replaced\n`);
  } finally {
    await app.close();
  }
}

void seed();

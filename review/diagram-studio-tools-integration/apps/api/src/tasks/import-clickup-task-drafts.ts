import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, IsNull, Like, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../users/user.entity';
import { TaskDraft } from './task-draft.entity';
import { Task, TaskStatus } from './task.entity';

type SeedDraft = {
  key: string;
  status: string;
  topic: string;
  description: string;
  assignees: string[];
  dueDate?: string;
  priority?: string;
};

const rows: SeedDraft[] = [
  { key: '01-app-bom', status: 'BACKLOG', topic: 'R&D', description: 'NGHIÊN CỨU & SẢN XUẤT APP BƠM', assignees: ['vinh', 'thang'] },
  { key: '02-easyscan-bin-zip', status: 'BACKLOG', topic: 'EASYSCAN', description: 'Build File Bin & ZIP 10.15 cho Easyscan.', assignees: ['thang'] },
  { key: '03-scanbox-baudrate', status: 'BACKLOG', topic: 'EASYSCAN', description: 'Double Review Lỗi Chuyển Baurate15800 máy SCANBOX', assignees: ['thang'] },
  { key: '04-output-expander-layer', status: 'BACKLOG', topic: 'KEYBLE / KEYBOX', description: 'add layer IC mở rộng điều khiển OUPUT lên Keyscan,keyBox', assignees: ['phu'] },
  { key: '05-vespa-immo-id', status: 'BACKLOG', topic: 'KEYBLE / KEYBOX', description: 'Bổ sung đọc vespa IMMO ID vào keyscan, keyBox', assignees: ['thang', 'vinh'] },
  { key: '06-device-test-code', status: 'BACKLOG', topic: 'SẢN XUẤT', description: 'Code Test các Device', assignees: ['vinh', 'phu'] },
  { key: '07-finish-keybox', status: 'INIT', topic: 'KEYBOX', description: 'Hoàn thiện keyBOX', assignees: ['phu', 'vinh'] },
  { key: '08-winner-ecm-id', status: 'INIT', topic: 'R&D', description: 'Kiểm tra đọc ECM ID winner V4 với FI2 và Easyscan/Scanbox', assignees: ['thang'] },
  { key: '09-scanbox-popup-report', status: 'INIT', topic: 'SCANBOX V1.7', description: 'tính năng báo cáo chuyên sâu scanbox cần auto nổ Popup khi đủ điều kiện !!!', assignees: ['thang'] },
  { key: '10-starter-switch-watch', status: 'INIT', topic: 'KEYBLE', description: 'Fix lỗi Watch thêm Pin starterSwitch', assignees: ['phu'] },
  { key: '11-scu-33pin-kor', status: 'HAS PROBLEM', topic: 'KEYBLE', description: 'bổ sung file GỐC SCU 33pin KOR', assignees: ['phu'], dueDate: '2026-07-19' },
  { key: '12-buy-scanbox-parts', status: 'HAS PROBLEM', topic: 'SẢN XUẤT', description: 'Đặt Mua nốt linh kiện hoàn thiện SCANBOX', assignees: ['thang'], dueDate: '2026-07-20' },
  { key: '13-rh850-read', status: 'HAS PROBLEM', topic: 'KEYBLE', description: 'Kiểm tra lại tính năng đọc RH850', assignees: ['phu'], dueDate: '2026-07-25', priority: 'URGENT' },
  { key: '14-9s12-fix', status: 'HAS PROBLEM', topic: 'KEYBLE', description: 'Fix lỗi 9s12', assignees: ['phu', 'thang'] },
  { key: '15-io-expander-control', status: 'REVIEW', topic: 'KEYBOX', description: 'Giao Tiếp Điều Khiển IC mở rộng chân', assignees: ['vinh'], dueDate: '2026-07-20' },
  { key: '16-easkey-board-13', status: 'REVIEW', topic: 'KEYBLE', description: 'Thiết kế lại mạch Easkey ( update 1.3 )', assignees: ['phu', 'thang'], dueDate: '2026-07-25', priority: 'HIGH' },
  { key: '17-cable-test-demo', status: 'REVIEW', topic: 'TEST DÂY', description: 'Code + Thiết kế DEMO mạch Test dây cáp', assignees: ['vinh', 'phu'], dueDate: '2026-08-01' },
  { key: '18-cat-wire-board', status: 'DOING', topic: 'SẢN XUẤT', description: 'Lắp ráp mạch CAT Dây và Tước dây', assignees: ['thang'], dueDate: '2026-08-01' },
  { key: '19-final-cable-device-test', status: 'DOING', topic: 'SẢN XUẤT', description: 'Thiết kế mạch FINAL Test dây + Test device', assignees: ['thang'], dueDate: '2026-08-01' },
  { key: '20-finish-10-scanbox', status: 'DOING', topic: 'SẢN XUẤT', description: 'Hoàn thiện 10 mạch tay SCANBOX', assignees: ['thang'], dueDate: '2026-07-28', priority: 'HIGH' },
];

async function importDrafts() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const drafts = app.get<Repository<TaskDraft>>(getRepositoryToken(TaskDraft));
  const tasks = app.get<Repository<Task>>(getRepositoryToken(Task));
  const users = app.get<Repository<User>>(getRepositoryToken(User));
  const people = await users.find();
  const byUsername = new Map(people.map((user) => [user.username, user]));
  const admin = byUsername.get('admin');
  if (!admin) throw new Error('Admin account is required');

  for (const row of rows) {
    const assigneeIds = row.assignees.map((username) => {
      const user = byUsername.get(username);
      if (!user) throw new Error(`Missing user ${username}`);
      return user.id;
    });
    const importKey = `clickup-screen-2026-07-30:${row.key}`;
    const existing = await drafts.findOneBy({ importKey });
    if (existing) continue;
    await drafts.save(drafts.create({
      topic: row.topic,
      description: row.description,
      assigneeIds,
      dueDate: row.dueDate ?? null,
      sourceStatus: row.status,
      sourcePriority: row.priority ?? null,
      importKey,
      createdById: admin.id,
      deletedById: null,
      deletedAt: null,
    }));
  }

  const [visibleDrafts, trashTasks] = await Promise.all([
    drafts.countBy({ importKey: Like('clickup-screen-2026-07-30:%'), deletedAt: IsNull() }),
    tasks.countBy({ status: In([TaskStatus.ACTIVE, TaskStatus.DONE]), deletedAt: IsNull() }),
  ]);
  await app.close();
  process.stdout.write(`Imported ${rows.length}; visible ClickUp drafts ${visibleDrafts}; Trash tasks ${trashTasks}\n`);
}

void importDrafts();

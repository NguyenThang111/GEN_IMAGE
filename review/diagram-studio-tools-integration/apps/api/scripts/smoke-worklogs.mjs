import 'dotenv/config';
import pg from 'pg';
import { io } from 'socket.io-client';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const commonPassword = process.env.SEED_PASSWORD ?? 'auto2tech123';
const passwords = {
  admin: commonPassword,
  phu: process.env.SEED_PASSWORD_PHU ?? commonPassword,
  thang: process.env.SEED_PASSWORD_THANG ?? commonPassword,
  giang: process.env.SEED_PASSWORD_GIANG ?? commonPassword,
};
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const createdIds = [];

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function login(username) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: passwords[username] }) });
  const body = await response.json().catch(() => null);
  assert(response.ok, `Login failed for ${username}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function request(path, token, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
  const body = await response.json().catch(() => null);
  assert(response.ok, `${init.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Missing realtime ${name}`)), 3000);
    socket.once(name, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

try {
  const [admin, phu, thang, giang] = await Promise.all([login('admin'), login('phu'), login('thang'), login('giang')]);
  const before = await request('/api/worklogs?month=2026-08', admin.accessToken);
  const beforePhu = before.summary.find((row) => row.username === 'phu');
  const beforeThang = before.summary.find((row) => row.username === 'thang');
  assert(beforePhu && beforeThang, 'Missing Dev pilot users in Worklog dashboard');
  const sourceTasks = await request('/api/tasks/trash', admin.accessToken);
  const sourceTask = sourceTasks.find((task) => task.status !== 'COMPLETE');
  assert(sourceTask, 'Need one unfinished Task source for Worklog smoke');
  const worklogPayload = (input) => ({ workType: 'NORMAL', ...input, taskIds: [sourceTask.id] });

  const adminLog = await request('/api/worklogs', admin.accessToken, { method: 'POST', body: JSON.stringify(worklogPayload({ input: 'Admin review kế hoạch', output: 'Đang rà soát', startedAt: '2026-08-12T00:00:00+07:00', hoursWorked: 0.5, valueLevel: 'BASIC', status: 'OPEN' })) });
  createdIds.push(adminLog.id);
  assert(adminLog.output === 'Đang rà soát' && Number(adminLog.hoursWorked) === 0.5, 'OPEN must accept free Output and working H');
  const adminDone = await request(`/api/worklogs/${adminLog.id}`, admin.accessToken, { method: 'PATCH', body: JSON.stringify(worklogPayload({ input: adminLog.input, startedAt: adminLog.startedAt, output: 'Đã chốt thứ tự ưu tiên', hoursWorked: 1, valueLevel: 'BASIC', status: 'DONE' })) });
  assert(adminDone.status === 'DONE' && adminDone.userId === admin.user.id, 'Admin must create and finish their own Worklog');

  const forGiang = await request('/api/worklogs', admin.accessToken, { method: 'POST', body: JSON.stringify(worklogPayload({ userId: giang.user.id, input: 'Đóng bộ máy', startedAt: '2026-08-12T00:00:00+07:00', valueLevel: 'BASIC', status: 'OPEN' })) });
  createdIds.push(forGiang.id);
  assert(forGiang.userId === giang.user.id && forGiang.createdById === admin.user.id, 'Admin must create Worklog for any active member');
  const strangerUpdate = await fetch(`${base}/api/worklogs/${forGiang.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${phu.accessToken}` }, body: JSON.stringify(worklogPayload({ input: forGiang.input, startedAt: forGiang.startedAt, valueLevel: 'BASIC', status: 'OPEN' })) });
  assert(strangerUpdate.status === 403, `Unrelated member update must be 403, got ${strangerUpdate.status}`);
  const giangEnded = await request(`/api/worklogs/${forGiang.id}`, giang.accessToken, { method: 'PATCH', body: JSON.stringify(worklogPayload({ input: forGiang.input, startedAt: forGiang.startedAt, output: 'Đã đóng xong 2 bộ', hoursWorked: 2, valueLevel: 'BASIC', status: 'DONE' })) });
  assert(giangEnded.status === 'DONE', 'Assigned owner must finish Admin-created Worklog');

  const socket = io(base, { auth: { token: admin.accessToken }, transports: ['websocket'] });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const realtime = event(socket, 'worklog.updated');
  const ended = await request('/api/worklogs', phu.accessToken, { method: 'POST', body: JSON.stringify(worklogPayload({ input: 'Hàn mạch KeyScan khó', startedAt: '2026-08-12T00:00:00+07:00', valueLevel: 'DEV', status: 'OPEN' })) });
  createdIds.push(ended.id);
  assert((await realtime).id === ended.id, 'Realtime worklog.updated does not match created Worklog');
  const strangerFinish = await fetch(`${base}/api/worklogs/${ended.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${thang.accessToken}` }, body: JSON.stringify(worklogPayload({ input: ended.input, startedAt: ended.startedAt, output: 'Người khác không được kết thúc hộ', hoursWorked: 8, valueLevel: 'DEV', status: 'ENDED' })) });
  assert(strangerFinish.status === 403, `Unrelated member finish must be 403, got ${strangerFinish.status}`);
  const endedResult = await request(`/api/worklogs/${ended.id}`, phu.accessToken, { method: 'PATCH', body: JSON.stringify(worklogPayload({ input: ended.input, startedAt: ended.startedAt, output: 'Mạch chưa giao tiếp ổn định', hoursWorked: 8, valueLevel: 'DEV', status: 'ENDED' })) });
  assert(endedResult.status === 'ENDED' && Number(endedResult.hoursWorked) === 8 && endedResult.point === 0, 'PHÚ ENDED must record 8h and 0 Point');

  const done = await request('/api/worklogs', thang.accessToken, { method: 'POST', body: JSON.stringify(worklogPayload({ input: 'Hàn board ScanBox', startedAt: '2026-08-12T00:00:00+07:00', valueLevel: 'BASIC', status: 'OPEN' })) });
  createdIds.push(done.id);
  const doneResult = await request(`/api/worklogs/${done.id}`, thang.accessToken, { method: 'PATCH', body: JSON.stringify(worklogPayload({ input: done.input, startedAt: done.startedAt, output: '2 board hoàn thiện, 2/2 lên nguồn', hoursWorked: 3.5, valueLevel: 'BASIC', status: 'DONE' })) });
  assert(doneResult.status === 'DONE' && doneResult.point === null, 'THẮNG DONE must wait for Admin Point');
  const correctedDone = await request(`/api/worklogs/${done.id}`, thang.accessToken, { method: 'PATCH', body: JSON.stringify(worklogPayload({ input: done.input, startedAt: done.startedAt, output: '2 board hoàn thiện, 2/2 lên nguồn ổn định', hoursWorked: 3.5, valueLevel: 'BASIC', status: 'DONE' })) });
  assert(correctedDone.output.endsWith('ổn định'), 'Owner must edit an unscored DONE Worklog');
  const scoreInput = { valueLevel: 'BASIC', standardHours: 3, completionRate: 1, stabilityConfirmed: false };
  const memberScore = await fetch(`${base}/api/worklogs/${done.id}/point`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${phu.accessToken}` }, body: JSON.stringify(scoreInput) });
  assert(memberScore.status === 403, `Member score must be 403, got ${memberScore.status}`);
  const scored = await request(`/api/worklogs/${done.id}/point`, admin.accessToken, { method: 'PATCH', body: JSON.stringify(scoreInput) });
  assert(scored.point === 120 && scored.stabilityStatus === 'PENDING', 'Admin must assign THẮNG provisional 120 Point');
  const stable = await request(`/api/worklogs/${done.id}/stability`, admin.accessToken, { method: 'PATCH' });
  assert(stable.point === 150 && stable.stabilityStatus === 'CONFIRMED', 'Admin must release retained 20 percent');
  const editAfterScore = await fetch(`${base}/api/worklogs/${done.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.accessToken}` }, body: JSON.stringify(worklogPayload({ input: done.input, startedAt: done.startedAt, output: 'Không được sửa sau chấm', hoursWorked: 3.5, valueLevel: 'BASIC', status: 'DONE' })) });
  assert(editAfterScore.status === 400, `Scored DONE edit must be 400, got ${editAfterScore.status}`);

  const reopened = await request('/api/worklogs', phu.accessToken, { method: 'POST', body: JSON.stringify(worklogPayload({ workType: 'REOPEN', reopenedWorklogId: done.id, input: 'Sửa lại board ScanBox', output: 'Đã sửa lỗi từ output cũ', startedAt: '2026-08-13T00:00:00+07:00', hoursWorked: 1, valueLevel: 'BASIC', status: 'DONE' })) });
  createdIds.push(reopened.id);
  assert(reopened.point === 0 && reopened.workType === 'REOPEN', 'RE-OPEN must log H with zero Point');
  const afterReopen = await request('/api/worklogs?month=2026-08', admin.accessToken);
  const originalAfterReopen = afterReopen.logs.find((row) => row.id === done.id);
  assert(originalAfterReopen.point === 120 && originalAfterReopen.reopenCount === 1, 'RE-OPEN must recalculate original Worklog to 80 percent');

  const memberDelete = await fetch(`${base}/api/worklogs/${forGiang.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${giang.accessToken}` } });
  assert(memberDelete.status === 403, `Member delete must be 403, got ${memberDelete.status}`);
  const deleted = await request(`/api/worklogs/${forGiang.id}`, admin.accessToken, { method: 'DELETE' });
  assert(deleted.id === forGiang.id, 'Admin soft delete must return the Worklog id');

  const after = await request('/api/worklogs?month=2026-08', admin.accessToken);
  assert(!after.logs.some((row) => row.id === forGiang.id), 'Soft-deleted Worklog must be hidden from dashboard');
  const afterPhu = after.summary.find((row) => row.username === 'phu');
  const afterThang = after.summary.find((row) => row.username === 'thang');
  assert(afterPhu.hours === beforePhu.hours + 9 && afterPhu.point === beforePhu.point && afterPhu.ended === beforePhu.ended + 1 && afterPhu.done === beforePhu.done + 1, 'PHÚ month summary delta is incorrect');
  assert(afterThang.hours === beforeThang.hours + 3.5 && afterThang.point === beforeThang.point + 120 && afterThang.done === beforeThang.done + 1, 'THẮNG month summary delta is incorrect');
  socket.disconnect();
  process.stdout.write('Worklog quality smoke passed: provisional 80%, Admin stability release, RE-OPEN zero Point and original recalculation\n');
} finally {
  if (createdIds.length) {
    await client.connect();
    try { await client.query('DELETE FROM worklogs WHERE id = ANY($1::uuid[])', [createdIds]); }
    finally { await client.end(); }
  }
}

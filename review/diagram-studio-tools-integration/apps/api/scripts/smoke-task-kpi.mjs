const base = process.env.API_URL ?? 'http://127.0.0.1:3000';
const password = process.env.TEST_PASSWORD;
if (!password) throw new Error('TEST_PASSWORD is required');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function request(token, path, init = {}) {
  const response = await fetch(`${base}/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}
async function login() {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) });
  assert(response.ok, 'Admin login failed');
  return response.json();
}
const post = (token, path, body = {}) => request(token, path, { method: 'POST', body: JSON.stringify(body) });
const remove = (token, id) => request(token, `/tasks/${id}`, { method: 'DELETE' });
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const month = today.slice(0, 7);

const admin = await login();
const users = await request(admin.accessToken, '/users');
const byUsername = Object.fromEntries(users.map((user) => [user.username, user]));
for (const username of ['thang', 'vinh', 'phu']) assert(byUsername[username], `Missing ${username}`);
const before = await request(admin.accessToken, `/tasks/scoreboard?month=${month}`);
let task;
let threePersonTask;
try {
  task = await post(admin.accessToken, '/tasks', {
    title: 'KPI-SMOKE',
    note: 'Kiểm tra checklist và Point thực nhận',
    dueDate: today,
    assigneeIds: [byUsername.thang.id, byUsername.vinh.id],
    criteria: ['API đúng', 'UI nhận đủ dữ liệu'],
    pointFactors: { outputScope: 1, complexity: 1, uncertainty: 1, risk: 1, verification: 1 },
  });
  assert(Number(task.point) === 200, 'Expected automatic 200 base Point');
  assert(task.assignees.map((item) => Number(item.sharePercent)).join(',') === '75,25', 'Expected 75/25 shares');
  await post(admin.accessToken, `/tasks/${task.id}/done`);
  const reopened = await post(admin.accessToken, `/tasks/${task.id}/review`, { passedCriterionIds: [task.criteria[0].id] });
  assert(reopened.status === 'ACTIVE', 'Incomplete checklist must Reopen');
  assert(reopened.criteria.filter((item) => item.firstReviewPassed).length === 1, 'First review snapshot was not stored');
  await post(admin.accessToken, `/tasks/${task.id}/done`);
  const completed = await post(admin.accessToken, `/tasks/${task.id}/review`, { passedCriterionIds: task.criteria.map((item) => item.id) });
  assert(completed.status === 'COMPLETE', 'Full second review must Complete');
  assert(Number(completed.qualityRate) === 0.5, 'Quality must remain at first-review 50%');
  assert(Number(completed.earnedPoint) === 160, 'Expected 160 earned Point');
  const after = await request(admin.accessToken, `/tasks/scoreboard?month=${month}`);
  const delta = (username) => after.members.find((member) => member.username === username).earnedPoint - before.members.find((member) => member.username === username).earnedPoint;
  assert(delta('thang') === 120 && delta('vinh') === 40, 'Scoreboard did not split earned Point 75/25');

  threePersonTask = await post(admin.accessToken, '/tasks', {
    title: 'KPI-SHARE-SMOKE', note: 'Kiểm tra thứ tự ba Assignee', dueDate: today,
    assigneeIds: [byUsername.thang.id, byUsername.vinh.id, byUsername.phu.id], criteria: ['Tỷ lệ đúng'],
    pointFactors: { outputScope: 0, complexity: 0, uncertainty: 0, risk: 0, verification: 0 },
  });
  assert(threePersonTask.assignees.map((item) => Number(item.sharePercent)).join(',') === '50,30,20', 'Expected 50/30/20 shares');
  process.stdout.write(JSON.stringify({ basePoint: 200, firstReviewQuality: 0.5, earnedPoint: 160, twoAssignees: [75, 25], threeAssignees: [50, 30, 20], scoreboard: true }) + '\n');
} finally {
  if (task?.id) await remove(admin.accessToken, task.id).catch(() => undefined);
  if (threePersonTask?.id) await remove(admin.accessToken, threePersonTask.id).catch(() => undefined);
}

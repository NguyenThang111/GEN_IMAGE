import 'dotenv/config';
import pg from 'pg';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const adminPassword = process.env.SEED_PASSWORD ?? 'auto2tech123';
const memberPassword = process.env.SEED_PASSWORD_THANG ?? adminPassword;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let taskId = null;
let commentId = null;

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function login(username, password) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
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

try {
  const [admin, member] = await Promise.all([login('admin', adminPassword), login('thang', memberPassword)]);
  const title = `Notification V2 smoke ${Date.now()}`;
  const task = await request('/api/tasks', admin.accessToken, {
    method: 'POST',
    body: JSON.stringify({ title, note: 'Task tạm để kiểm notification', dueDate: '2026-08-20', assigneeIds: [member.user.id], criteria: ['Có kết quả smoke'], basePoint: 100 }),
  });
  taskId = task.id;

  let memberNotifications = await request('/api/tasks/notifications', member.accessToken);
  const assigned = memberNotifications.find((item) => item.taskId === taskId && item.eventType === 'CREATED');
  assert(assigned?.kind === 'TASK_EVENT', 'Assignee must receive one CREATED event notification');

  await request(`/api/tasks/${taskId}`, admin.accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ basePoint: 200, dueDate: '2026-08-21' }),
  });
  memberNotifications = await request('/api/tasks/notifications', member.accessToken);
  const edited = memberNotifications.filter((item) => item.taskId === taskId && item.eventType === 'EDITED');
  assert(edited.length === 1, `Point + Due date must create one notification, got ${edited.length}`);
  assert(edited[0].bodyPreview.includes('Point 100.00 → 200'), `Point change is missing: ${edited[0].bodyPreview}`);
  assert(edited[0].bodyPreview.includes('Due date 2026-08-20 → 2026-08-21'), `Due date change is missing: ${edited[0].bodyPreview}`);

  const comment = await request(`/api/tasks/${taskId}/comments`, member.accessToken, {
    method: 'POST',
    body: JSON.stringify({ body: 'Comment không tag Admin', mentionedUserIds: [] }),
  });
  commentId = comment.id;
  const adminNotifications = await request('/api/tasks/notifications', admin.accessToken);
  const adminComment = adminNotifications.find((item) => item.commentId === commentId);
  assert(adminComment?.kind === 'TASK_COMMENT', 'Admin must receive an untagged member comment');
  const selfNotifications = await request('/api/tasks/notifications', member.accessToken);
  assert(!selfNotifications.some((item) => item.commentId === commentId), 'Comment actor must not notify themself');

  await request(`/api/tasks/${taskId}/done`, member.accessToken, { method: 'POST' });
  const adminAfterDone = await request('/api/tasks/notifications', admin.accessToken);
  assert(adminAfterDone.some((item) => item.taskId === taskId && item.eventType === 'DONE'), 'Admin must receive member Done');

  const detail = await request(`/api/tasks/${taskId}/detail`, admin.accessToken);
  await request(`/api/tasks/${taskId}/review`, admin.accessToken, { method: 'POST', body: JSON.stringify({ passedCriterionIds: detail.task.criteria.map((criterion) => criterion.id) }) });
  memberNotifications = await request('/api/tasks/notifications', member.accessToken);
  const completed = memberNotifications.find((item) => item.taskId === taskId && item.eventType === 'COMPLETED');
  assert(completed?.bodyPreview.includes('Point thực nhận:'), 'Assignee must receive earned Point after Complete');

  const read = await request(`/api/tasks/notifications/${adminComment.id}/read`, admin.accessToken, { method: 'PATCH' });
  assert(read.readAt, 'Notification must be markable as read');
  const forbidden = await fetch(`${base}/api/tasks/notifications/${adminComment.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${member.accessToken}` } });
  assert(forbidden.status === 404, `Another user must not read notification: ${forbidden.status}`);

  await Promise.all([
    request('/api/tasks/notifications/read-all', member.accessToken, { method: 'PATCH' }),
    request('/api/production/notifications/read-all', member.accessToken, { method: 'PATCH' }),
  ]);
  const afterReadAll = await request('/api/tasks/notifications', member.accessToken);
  assert(!afterReadAll.some((item) => item.taskId === taskId && !item.readAt), 'Read all must clear every task notification for member');

  process.stdout.write('Workplace Notification V2 smoke passed: assign, combined edit, untagged comment, Done, Complete, read all and permissions\n');
} finally {
  if (taskId) {
    await client.connect();
    try {
      await client.query('DELETE FROM email_outbox WHERE "dedupeKey" LIKE $1 OR "dedupeKey" LIKE $2', [`task-assigned:${taskId}:%`, `task-comment:${commentId}:%`]);
      await client.query('DELETE FROM task_notifications WHERE "taskId" = $1', [taskId]);
      await client.query('DELETE FROM task_comments WHERE "taskId" = $1', [taskId]);
      await client.query('DELETE FROM task_criteria WHERE "taskId" = $1', [taskId]);
      await client.query('DELETE FROM task_assignees WHERE "taskId" = $1', [taskId]);
      await client.query('DELETE FROM task_events WHERE "taskId" = $1', [taskId]);
      await client.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    } finally {
      await client.end();
    }
  }
}

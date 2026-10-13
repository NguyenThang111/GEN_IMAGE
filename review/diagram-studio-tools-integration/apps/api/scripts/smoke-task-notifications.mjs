import 'dotenv/config';
import pg from 'pg';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const adminPassword = process.env.SEED_PASSWORD ?? 'auto2tech123';
const actorPassword = process.env.SEED_PASSWORD_THANG ?? adminPassword;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let commentId = null;

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function login(username, password) {
  const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert(response.ok, `Login failed for ${username}: ${response.status}`);
  return response.json();
}

async function request(path, token, init = {}) {
  const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
  const body = await response.json().catch(() => null);
  assert(response.ok, `${init.method ?? 'GET'} ${path} failed: ${response.status}`);
  return body;
}

try {
  const [admin, actor] = await Promise.all([login('admin', adminPassword), login('thang', actorPassword)]);
  const [users, tasksBefore] = await Promise.all([
    request('/api/users', actor.accessToken),
    request('/api/tasks/trash', actor.accessToken),
  ]);
  const adminUser = users.find((user) => user.username === 'admin');
  const task = tasksBefore[0];
  assert(adminUser, 'Admin user not found');
  assert(task, 'Need one ACTIVE/DONE task for notification smoke');
  const beforeCount = task.commentCount ?? 0;

  const comment = await request(`/api/tasks/${task.id}/comments`, actor.accessToken, {
    method: 'POST',
    body: JSON.stringify({ body: `Notification smoke @Admin ${Date.now()}`, mentionedUserIds: [adminUser.id, actor.user.id] }),
  });
  commentId = comment.id;

  const [notifications, tasksAfter] = await Promise.all([
    request('/api/tasks/notifications', admin.accessToken),
    request('/api/tasks/trash', actor.accessToken),
  ]);
  const notification = notifications.find((item) => item.commentId === commentId);
  assert(notification, 'Mention notification was not created');
  assert(notification.readAt === null, 'New notification must be unread');
  assert((tasksAfter.find((item) => item.id === task.id)?.commentCount ?? 0) === beforeCount + 1, 'Task commentCount did not increase');
  const actorNotifications = await request('/api/tasks/notifications', actor.accessToken);
  assert(!actorNotifications.some((item) => item.commentId === commentId), 'Actor must not receive a self-mention notification');

  const forbiddenRead = await fetch(`${base}/api/tasks/notifications/${notification.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${actor.accessToken}` } });
  assert(forbiddenRead.status === 404, `Another user must not read this notification: ${forbiddenRead.status}`);

  const read = await request(`/api/tasks/notifications/${notification.id}/read`, admin.accessToken, { method: 'PATCH' });
  assert(read.readAt, 'Notification was not marked read');
  process.stdout.write('Notification smoke passed: mention, unread, read and commentCount\n');
} finally {
  if (commentId) {
    await client.connect();
    try {
      await client.query('DELETE FROM email_outbox WHERE "dedupeKey" LIKE $1', [`task-comment:${commentId}:%`]);
      await client.query('DELETE FROM task_comments WHERE id = $1', [commentId]);
    } finally {
      await client.end();
    }
  }
}

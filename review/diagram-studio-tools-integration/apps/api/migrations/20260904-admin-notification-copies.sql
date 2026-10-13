-- Each administrator receives an independent copy; existing read states are preserved.
INSERT INTO task_notifications ("recipientId", "taskId", type, "commentId", "eventId", "readAt", "createdAt")
SELECT a.id, n."taskId", n.type, n."commentId", n."eventId", NULL, n."createdAt"
FROM users a CROSS JOIN (
  SELECT DISTINCT ON (COALESCE("commentId", "eventId")) * FROM task_notifications
  ORDER BY COALESCE("commentId", "eventId"), "createdAt", id
) n WHERE a.role = 'ADMIN' AND a."isActive" = true
ON CONFLICT DO NOTHING;

INSERT INTO system_notifications ("recipientId", "actorId", module, "eventType", "entityType", "entityId", "entityLabel", message, "bodyPreview", "dedupeKey", "readAt", "createdAt")
SELECT a.id, n."actorId", n.module, n."eventType", n."entityType", n."entityId", n."entityLabel", n.message, n."bodyPreview", n."dedupeKey", NULL, n."createdAt"
FROM users a CROSS JOIN (
  SELECT DISTINCT ON ("dedupeKey") * FROM system_notifications ORDER BY "dedupeKey", "createdAt", id
) n WHERE a.role = 'ADMIN' AND a."isActive" = true
ON CONFLICT DO NOTHING;

INSERT INTO production_notifications ("recipientId", "paymentRequestId", "readAt", "createdAt")
SELECT a.id, n."paymentRequestId", NULL, n."createdAt"
FROM users a CROSS JOIN (
  SELECT DISTINCT ON ("paymentRequestId") * FROM production_notifications ORDER BY "paymentRequestId", "createdAt", id
) n WHERE a.role = 'ADMIN' AND a."isActive" = true
ON CONFLICT DO NOTHING;

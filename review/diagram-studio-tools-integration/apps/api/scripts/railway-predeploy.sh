#!/bin/sh
set -eu

node apps/api/dist/users/migrate-user-avatar.js
node apps/api/dist/users/migrate-user-session-version.js

node apps/api/dist/email/migrate-backlog-email.js
node apps/api/dist/inventory/migrate-kho-upgrade.js
node apps/api/dist/inventory/migrate-inventory-count-assignment.js
node apps/api/dist/inventory/migrate-inventory-canonical-unit.js
node apps/api/dist/inventory/migrate-purchase-order-reference.js
node apps/api/dist/inventory/migrate-purchase-payment-logs.js
node apps/api/dist/inventory/migrate-purchase-assigned-buyer.js
node apps/api/dist/inventory/migrate-purchase-received-backfill.js
node apps/api/dist/inventory/migrate-stock-count-sheets.js
node apps/api/dist/tasks/migrate-task-kpi.js
node apps/api/dist/tasks/migrate-task-drafts.js
node apps/api/dist/tasks/migrate-task-draft-suggestion.js
node apps/api/dist/tasks/migrate-task-priority.js
node apps/api/dist/tasks/migrate-task-notifications.js
node apps/api/dist/tasks/migrate-workplace-system-notifications.js
node apps/api/dist/notifications/migrate-system-notifications.js
node apps/api/dist/production/migrate-production.js
node apps/api/dist/production/migrate-production-notifications.js
node apps/api/dist/notifications/migrate-admin-notifications.js
node apps/api/dist/production/migrate-production-lots.js
node apps/api/dist/device-test/migrate-device-test.js
node apps/api/dist/device-test/migrate-retire-device-test.js
node apps/api/dist/pcb-layouts/migrate-pcb-layouts.js
node apps/api/dist/worklogs/migrate-worklogs.js
node apps/api/dist/worklogs/migrate-worklog-soft-delete.js
# Schema đã được áp dụng; không chạy lại migration legacy này vì dữ liệu Worklog
# hiện tại hỗ trợ completionRate mới ngoài constraint pilot ban đầu.
node apps/api/dist/worklogs/migrate-dev-task-worklog.js
node apps/api/dist/worklogs/migrate-worklog-quality.js
node apps/api/dist/worklogs/migrate-task-admin-worklog-point.js
node apps/api/dist/worklogs/migrate-worklog-comments.js
node apps/api/dist/worklogs/migrate-worklog-report-comments.js
node apps/api/dist/worklogs/migrate-worklog-thread-output-criteria.js
node apps/api/dist/performance/migrate-performance.js
node apps/api/dist/tasks/migrate-task-default-backlog.js
node apps/api/dist/tasks/migrate-task-review-result.js
node apps/api/dist/tasks/migrate-task-comment-images.js
node apps/api/dist/tasks/migrate-week1-task-pool.js
node apps/api/dist/tasks/seed-week1-task-pool.js
node apps/api/dist/tasks/promote-week1-task-pool.js
node apps/api/dist/warranty/migrate-warranty.js
node apps/api/dist/warranty/migrate-warranty-customer-contact.js
node apps/api/dist/warranty/migrate-warranty-shipping-carrier.js
node apps/api/dist/activation/migrate-activation.js

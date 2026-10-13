CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('MEMBER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status AS ENUM ('ACTIVE', 'DONE', 'COMPLETE', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_event_type AS ENUM ('CREATED', 'EDITED', 'ASSIGNED', 'DONE', 'REOPENED', 'COMPLETED', 'DELETED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE inventory_transaction_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE inventory_transaction_type ADD VALUE IF NOT EXISTS 'STOCK_COUNT';

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text UNIQUE NOT NULL,
  "displayName" text NOT NULL, "passwordHash" text NOT NULL,
  role user_role NOT NULL DEFAULT 'MEMBER', "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, note text,
  status task_status NOT NULL DEFAULT 'ACTIVE', "dueDate" date NOT NULL,
  point numeric(12,2), "createdById" uuid NOT NULL REFERENCES users(id),
  "doneById" uuid REFERENCES users(id), "doneAt" timestamptz,
  "completedById" uuid REFERENCES users(id), "completedAt" timestamptz,
  "basePoint" numeric(12,2), "earnedPoint" numeric(12,2), "completionRate" numeric(3,2),
  "wasLate" boolean, "evaluatedDueDate" date, "evaluatedDoneAt" timestamptz,
  "archivedById" uuid REFERENCES users(id), "archivedAt" timestamptz,
  "deletedById" uuid REFERENCES users(id), "deletedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_assignees (
  "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id), "assignedAt" timestamptz NOT NULL DEFAULT now(),
  "assignedById" uuid NOT NULL REFERENCES users(id), PRIMARY KEY ("taskId", "userId")
);

CREATE TABLE IF NOT EXISTS task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "taskId" uuid NOT NULL REFERENCES tasks(id),
  "actorId" uuid NOT NULL REFERENCES users(id), type task_event_type NOT NULL,
  payload jsonb, "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_trash_order_idx ON tasks (status, "deletedAt", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS task_assignees_user_idx ON task_assignees ("userId", "taskId");
CREATE INDEX IF NOT EXISTS task_events_task_idx ON task_events ("taskId", "createdAt");

CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "authorId" uuid NOT NULL REFERENCES users(id), body text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS task_comment_mentions (
  "commentId" uuid NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES users(id), PRIMARY KEY ("commentId", "userId")
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments ("taskId", "createdAt");

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "groupName" text NOT NULL, name text NOT NULL,
  sku text UNIQUE, unit text NOT NULL DEFAULT 'unit', "onHandQty" numeric(16,3),
  "easycanQtyPerBoard" numeric(12,3), "scanboxQtyPerBoard" numeric(12,3), "easyscuQtyPerBoard" numeric(12,3),
  "purchaseUrl" text, price numeric(16,2), "sourceSpreadsheetId" text, "sourceSheetName" text,
  "sourceRow" integer, "sourceStockText" text, "sourceSnapshot" jsonb,
  "isActive" boolean NOT NULL DEFAULT true, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("sourceSpreadsheetId", "sourceSheetName", "sourceRow")
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  type inventory_transaction_type NOT NULL, quantity numeric(16,3) NOT NULL,
  "balanceBefore" numeric(16,3), "balanceAfter" numeric(16,3) NOT NULL, unit text NOT NULL,
  note text, reference text, "actorId" uuid NOT NULL REFERENCES users(id), "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_items_active_group_idx ON inventory_items ("isActive", "groupName", name);

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "purchaseLinks" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "minimumStock" numeric(16,3) NOT NULL DEFAULT 100;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "lastCountedAt" timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "lastCountedById" uuid;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "checkRequestedAt" timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "checkRequestedById" uuid;

CREATE TABLE IF NOT EXISTS inventory_item_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  "actorId" uuid NOT NULL, changes jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE TYPE purchase_request_status AS ENUM ('REQUESTED','ORDERED','RECEIVED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE purchase_payment_status AS ENUM ('UNPAID','PARTIAL','PAID'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  "requestedQty" numeric(16,3) NOT NULL, "receivedQty" numeric(16,3), status purchase_request_status NOT NULL DEFAULT 'REQUESTED',
  "paymentStatus" purchase_payment_status NOT NULL DEFAULT 'UNPAID',
  note text, "requesterId" uuid NOT NULL, "updatedById" uuid NOT NULL, "orderedAt" timestamptz, "receivedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "paymentStatus" purchase_payment_status NOT NULL DEFAULT 'UNPAID';
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "orderedAt" timestamptz;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS "receivedAt" timestamptz;

CREATE TABLE IF NOT EXISTS purchase_payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "requestId" uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  "fromStatus" purchase_payment_status NOT NULL, "toStatus" purchase_payment_status NOT NULL,
  "actorId" uuid NOT NULL REFERENCES users(id), "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_payment_logs_request_created_idx ON purchase_payment_logs ("requestId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS finished_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text UNIQUE, name text NOT NULL,
  category text NOT NULL DEFAULT 'OTHER' CHECK (category IN ('PCB','CABLE','DEVICE','OTHER')),
  "onHandQty" numeric(16,3) NOT NULL DEFAULT 0, "minimumStock" numeric(16,3) NOT NULL DEFAULT 0,
  location text, note text, "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE finished_products ALTER COLUMN sku DROP NOT NULL;
DO $$ BEGIN CREATE TYPE finished_product_transaction_type AS ENUM ('PRODUCED','OUT','ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS finished_product_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "productId" uuid NOT NULL REFERENCES finished_products(id),
  type finished_product_transaction_type NOT NULL, quantity numeric(16,3) NOT NULL,
  "balanceBefore" numeric(16,3) NOT NULL, "balanceAfter" numeric(16,3) NOT NULL,
  note text, "actorId" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "productId" uuid NOT NULL REFERENCES finished_products(id),
  "itemId" uuid NOT NULL REFERENCES inventory_items(id), "quantityPerProduct" numeric(16,3) NOT NULL,
  UNIQUE("productId","itemId")
);
CREATE TABLE IF NOT EXISTS sellable_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  "onHandQty" numeric(16,3) NOT NULL DEFAULT 0, "minimumStock" numeric(16,3) NOT NULL DEFAULT 0,
  note text, "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sellable_product_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "productId" uuid NOT NULL REFERENCES sellable_products(id) ON DELETE CASCADE,
  "finishedProductId" uuid NOT NULL REFERENCES finished_products(id), "quantityPerProduct" numeric(16,3) NOT NULL,
  UNIQUE("productId","finishedProductId")
);
CREATE TABLE IF NOT EXISTS sellable_product_material_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "productId" uuid NOT NULL REFERENCES sellable_products(id) ON DELETE CASCADE,
  "itemId" uuid NOT NULL REFERENCES inventory_items(id), "quantityPerProduct" numeric(16,3) NOT NULL CHECK ("quantityPerProduct" > 0),
  UNIQUE("productId","itemId")
);
CREATE TABLE IF NOT EXISTS sellable_product_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "productId" uuid NOT NULL REFERENCES sellable_products(id),
  type finished_product_transaction_type NOT NULL, quantity numeric(16,3) NOT NULL,
  "balanceBefore" numeric(16,3) NOT NULL, "balanceAfter" numeric(16,3) NOT NULL,
  note text, "actorId" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_transactions_item_idx ON inventory_transactions ("itemId", "createdAt" DESC);
-- Production reporting MVP 1 is applied by migrations/20260728-production-reporting-mvp.sql.

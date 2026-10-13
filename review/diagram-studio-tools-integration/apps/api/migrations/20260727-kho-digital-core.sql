BEGIN;

ALTER TYPE inventory_transaction_type ADD VALUE IF NOT EXISTS 'STOCK_COUNT';

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "purchaseLinks" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "minimumStock" numeric(16,3) NOT NULL DEFAULT 100;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "lastCountedAt" timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "lastCountedById" uuid;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "checkRequestedAt" timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS "checkRequestedById" uuid;

CREATE TABLE IF NOT EXISTS inventory_item_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  "actorId" uuid NOT NULL,
  changes jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE purchase_request_status AS ENUM ('REQUESTED', 'ORDERED', 'RECEIVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  "requestedQty" numeric(16,3) NOT NULL,
  "receivedQty" numeric(16,3),
  status purchase_request_status NOT NULL DEFAULT 'REQUESTED',
  note text,
  "requesterId" uuid NOT NULL,
  "updatedById" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finished_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar NOT NULL UNIQUE,
  name varchar NOT NULL,
  "onHandQty" numeric(16,3) NOT NULL DEFAULT 0,
  "minimumStock" numeric(16,3) NOT NULL DEFAULT 0,
  location text,
  note text,
  "bomStatus" varchar NOT NULL DEFAULT 'DRAFT',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE finished_product_transaction_type AS ENUM ('PRODUCED', 'OUT', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS finished_product_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES finished_products(id),
  type finished_product_transaction_type NOT NULL,
  quantity numeric(16,3) NOT NULL,
  "balanceBefore" numeric(16,3) NOT NULL,
  "balanceAfter" numeric(16,3) NOT NULL,
  note text,
  "actorId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES finished_products(id),
  "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  "quantityPerProduct" numeric(16,3) NOT NULL,
  CONSTRAINT product_bom_items_product_item_unique UNIQUE ("productId", "itemId")
);

CREATE INDEX IF NOT EXISTS inventory_item_audits_item_idx ON inventory_item_audits ("itemId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS purchase_requests_item_status_idx ON purchase_requests ("itemId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS finished_product_transactions_product_idx ON finished_product_transactions ("productId", "createdAt" DESC);

COMMIT;

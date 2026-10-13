CREATE TABLE IF NOT EXISTS sellable_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "onHandQty" numeric(16,3) NOT NULL DEFAULT 0,
  "minimumStock" numeric(16,3) NOT NULL DEFAULT 0,
  note text,
  "bomStatus" varchar NOT NULL DEFAULT 'DRAFT',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sellable_product_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES sellable_products(id) ON DELETE CASCADE,
  "finishedProductId" uuid NOT NULL REFERENCES finished_products(id),
  "quantityPerProduct" numeric(16,3) NOT NULL,
  UNIQUE("productId","finishedProductId")
);

CREATE TABLE IF NOT EXISTS sellable_product_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES sellable_products(id),
  type finished_product_transaction_type NOT NULL,
  quantity numeric(16,3) NOT NULL,
  "balanceBefore" numeric(16,3) NOT NULL,
  "balanceAfter" numeric(16,3) NOT NULL,
  note text,
  "actorId" uuid NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerType" varchar(30) NOT NULL,
  "ownerId" uuid NOT NULL,
  "mimeType" varchar(40) NOT NULL,
  "byteSize" integer NOT NULL,
  data bytea NOT NULL,
  "uploadedById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_images_owner_unique UNIQUE ("ownerType", "ownerId")
);

CREATE TABLE IF NOT EXISTS shared_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(120) NOT NULL,
  url text NOT NULL,
  description text,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "updatedById" uuid NOT NULL REFERENCES users(id),
  "deletedById" uuid REFERENCES users(id),
  "deletedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_documents_active_updated_idx ON shared_documents ("deletedAt", "updatedAt" DESC);

UPDATE inventory_items
SET "easyscuQtyPerBoard" = 13.000
WHERE "isActive" = true AND lower(trim(name)) = lower('Trở 330R');

UPDATE product_bom_items line
SET "quantityPerProduct" = 13.000
FROM finished_products product, inventory_items item
WHERE line."productId" = product.id
  AND line."itemId" = item.id
  AND product.sku = 'BOARD-KEYSCAN'
  AND item."isActive" = true
  AND lower(trim(item.name)) = lower('Trở 330R');

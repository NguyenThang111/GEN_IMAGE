DO $$ BEGIN CREATE TYPE production_lot_status AS ENUM ('NEW','IN_PROGRESS','DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE production_lot_event_type AS ENUM ('CREATED','REPORT_LINKED','NOTE_UPDATED','DONE','UNDONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdById" uuid NOT NULL REFERENCES users(id),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" uuid NOT NULL REFERENCES production_runs(id),
  code text NOT NULL UNIQUE,
  "outputType" production_output_type NOT NULL,
  "outputId" uuid NOT NULL,
  "outputLabel" text NOT NULL,
  "targetQuantity" integer NOT NULL CHECK ("targetQuantity" > 0),
  status production_lot_status NOT NULL DEFAULT 'NEW',
  "completedQuantity" integer CHECK ("completedQuantity" IS NULL OR "completedQuantity" > 0),
  note text,
  "createdById" uuid NOT NULL REFERENCES users(id),
  "completedById" uuid REFERENCES users(id),
  "completedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("outputType" IN ('FINISHED_PRODUCT','SELLABLE_PRODUCT'))
);

CREATE TABLE IF NOT EXISTS production_entry_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entryId" uuid NOT NULL REFERENCES production_entries(id) ON DELETE CASCADE,
  "lotId" uuid NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("entryId","lotId")
);

CREATE TABLE IF NOT EXISTS production_lot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lotId" uuid NOT NULL REFERENCES production_lots(id) ON DELETE CASCADE,
  type production_lot_event_type NOT NULL,
  "actorId" uuid NOT NULL REFERENCES users(id),
  payload jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finished_product_transactions ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE sellable_product_transactions ADD COLUMN IF NOT EXISTS reference text;

CREATE INDEX IF NOT EXISTS production_lots_status_created_idx ON production_lots (status,"createdAt" DESC);
CREATE INDEX IF NOT EXISTS production_entry_lots_lot_idx ON production_entry_lots ("lotId");
CREATE INDEX IF NOT EXISTS production_lot_events_lot_created_idx ON production_lot_events ("lotId","createdAt" DESC);
CREATE INDEX IF NOT EXISTS finished_product_transactions_reference_idx ON finished_product_transactions (reference);
CREATE INDEX IF NOT EXISTS sellable_product_transactions_reference_idx ON sellable_product_transactions (reference);

ALTER TYPE production_lot_event_type ADD VALUE IF NOT EXISTS 'DELETED';
ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS "deletedAt" timestamptz;
ALTER TABLE production_lots ADD COLUMN IF NOT EXISTS "deletedById" uuid;
CREATE INDEX IF NOT EXISTS production_lots_active_created_idx ON production_lots ("createdAt" DESC) WHERE "deletedAt" IS NULL;

ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS "isProductionOutput" boolean NOT NULL DEFAULT true;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS "productionReady" boolean NOT NULL DEFAULT true;
ALTER TABLE finished_products ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'OTHER';
DO $$ BEGIN
  ALTER TABLE finished_products ADD CONSTRAINT finished_products_category_check
    CHECK (category IN ('PCB','CABLE','DEVICE','OTHER'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS finished_product_component_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES finished_products(id) ON DELETE CASCADE,
  "componentProductId" uuid NOT NULL REFERENCES finished_products(id),
  "quantityPerProduct" numeric(16,3) NOT NULL CHECK ("quantityPerProduct" > 0),
  CONSTRAINT finished_product_component_unique UNIQUE ("productId","componentProductId"),
  CONSTRAINT finished_product_component_not_self CHECK ("productId" <> "componentProductId")
);

CREATE TABLE IF NOT EXISTS sellable_product_material_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" uuid NOT NULL REFERENCES sellable_products(id) ON DELETE CASCADE,
  "itemId" uuid NOT NULL REFERENCES inventory_items(id),
  "quantityPerProduct" numeric(16,3) NOT NULL CHECK ("quantityPerProduct" > 0),
  CONSTRAINT sellable_product_material_unique UNIQUE ("productId","itemId")
);

CREATE TABLE IF NOT EXISTS app_data_migrations (
  key text PRIMARY KEY,
  "appliedAt" timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  easy_board uuid; scan_board uuid; key_board uuid;
  easy_device uuid; scan_device uuid; key_device uuid;
  easy_product uuid; scan_product uuid; key_product uuid;
  easy_mica uuid; scan_mica uuid; key_mica uuid;
  item_id uuid; obsolete_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM app_data_migrations WHERE key='20260815-device-assembly-v1') THEN RETURN; END IF;

  INSERT INTO inventory_items ("groupName",name,sku,unit,"onHandQty","bomKind","purchaseLinks","minimumStock",note,"isActive")
  VALUES
    ('Máy EASYSCAN','Mica EasyScan','MICA-EASYSCAN','unit',NULL,'OTHER','[]'::jsonb,100,'Số lượng chưa kiểm',true),
    ('SCANBOX / BAO BÌ','Mica ScanBox','MICA-SCANBOX','unit',NULL,'OTHER','[]'::jsonb,100,'Số lượng chưa kiểm',true),
    ('KEYSCAN','Mica KeyScan','MICA-KEYSCAN','unit',NULL,'OTHER','[]'::jsonb,100,'Số lượng chưa kiểm',true)
  ON CONFLICT (sku) DO UPDATE SET "isActive"=true;

  SELECT id INTO easy_mica FROM inventory_items WHERE sku='MICA-EASYSCAN';
  SELECT id INTO scan_mica FROM inventory_items WHERE sku='MICA-SCANBOX';
  SELECT id INTO key_mica FROM inventory_items WHERE sku='MICA-KEYSCAN';
  SELECT id INTO easy_board FROM finished_products WHERE sku='BOARD-EASYSCAN';
  SELECT id INTO scan_board FROM finished_products WHERE sku='BOARD-SCANBOX';
  SELECT id INTO key_board FROM finished_products WHERE sku='BOARD-KEYSCAN';

  UPDATE finished_products SET "isProductionOutput"=false,"productionReady"=true WHERE id IN (easy_board,scan_board,key_board);

  UPDATE finished_products SET name='Device EasyScan hoàn thiện',sku=COALESCE(sku,'DEVICE-EASYSCAN'),
    note='Device đã lắp vỏ, mica, decal và test.',"isProductionOutput"=true,"productionReady"=true
  WHERE name='Hộp device Easyscan';
  UPDATE finished_products SET name='Device ScanBox hoàn thiện',sku=COALESCE(sku,'DEVICE-SCANBOX'),
    note='Device đã lắp vỏ, mica, decal và test.',"isProductionOutput"=true,"productionReady"=true
  WHERE name='Hộp device ScanBox';

  SELECT id INTO easy_device FROM finished_products WHERE sku='DEVICE-EASYSCAN' OR name='Device EasyScan hoàn thiện' LIMIT 1;
  SELECT id INTO scan_device FROM finished_products WHERE sku='DEVICE-SCANBOX' OR name='Device ScanBox hoàn thiện' LIMIT 1;
  INSERT INTO finished_products (sku,name,"onHandQty","minimumStock",location,note,"isProductionOutput","productionReady","isActive")
  VALUES ('DEVICE-KEYSCAN','Device KeyScan hoàn thiện',0,0,NULL,'Chưa đủ cấu hình vỏ và decal KeyScan.',true,false,true)
  ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name,"isProductionOutput"=true,"productionReady"=false,"isActive"=true;
  SELECT id INTO key_device FROM finished_products WHERE sku='DEVICE-KEYSCAN';

  IF easy_device IS NOT NULL THEN
    DELETE FROM product_bom_items WHERE "productId"=easy_device;
    FOREACH item_id IN ARRAY ARRAY[
      (SELECT id FROM inventory_items WHERE name='Hộp đen nhỏ' AND "isActive"=true LIMIT 1),
      easy_mica,
      (SELECT id FROM inventory_items WHERE name='Decal hộp Easyscan' AND "isActive"=true LIMIT 1)
    ] LOOP
      IF item_id IS NOT NULL THEN INSERT INTO product_bom_items ("productId","itemId","quantityPerProduct") VALUES (easy_device,item_id,1) ON CONFLICT DO NOTHING; END IF;
    END LOOP;
    IF easy_board IS NOT NULL THEN INSERT INTO finished_product_component_items ("productId","componentProductId","quantityPerProduct") VALUES (easy_device,easy_board,1) ON CONFLICT DO NOTHING; END IF;
  END IF;

  IF scan_device IS NOT NULL THEN
    DELETE FROM product_bom_items WHERE "productId"=scan_device;
    FOREACH item_id IN ARRAY ARRAY[
      (SELECT id FROM inventory_items WHERE name='Hộp đen' AND "isActive"=true LIMIT 1),
      scan_mica,
      (SELECT id FROM inventory_items WHERE name='Decal hộp ScanBox' AND "isActive"=true LIMIT 1)
    ] LOOP
      IF item_id IS NOT NULL THEN INSERT INTO product_bom_items ("productId","itemId","quantityPerProduct") VALUES (scan_device,item_id,1) ON CONFLICT DO NOTHING; END IF;
    END LOOP;
    IF scan_board IS NOT NULL THEN INSERT INTO finished_product_component_items ("productId","componentProductId","quantityPerProduct") VALUES (scan_device,scan_board,1) ON CONFLICT DO NOTHING; END IF;
  END IF;

  IF key_device IS NOT NULL THEN
    INSERT INTO product_bom_items ("productId","itemId","quantityPerProduct") VALUES (key_device,key_mica,1) ON CONFLICT DO NOTHING;
    IF key_board IS NOT NULL THEN INSERT INTO finished_product_component_items ("productId","componentProductId","quantityPerProduct") VALUES (key_device,key_board,1) ON CONFLICT DO NOTHING; END IF;
  END IF;

  SELECT id INTO easy_product FROM sellable_products WHERE lower(name)=lower('Máy đọc lỗi Easyscan') LIMIT 1;
  SELECT id INTO scan_product FROM sellable_products WHERE lower(name)=lower('Máy đọc lỗi ScanBox') LIMIT 1;
  SELECT id INTO key_product FROM sellable_products WHERE lower(name)=lower('Máy KeyScan') LIMIT 1;

  IF easy_product IS NOT NULL AND easy_device IS NOT NULL THEN
    DELETE FROM sellable_product_bom_items WHERE "productId"=easy_product AND "finishedProductId"=easy_board;
    SELECT id INTO obsolete_id FROM finished_products WHERE name='Decal hộp Easyscan' LIMIT 1;
    IF obsolete_id IS NOT NULL THEN DELETE FROM sellable_product_bom_items WHERE "productId"=easy_product AND "finishedProductId"=obsolete_id; END IF;
    INSERT INTO sellable_product_bom_items ("productId","finishedProductId","quantityPerProduct") VALUES (easy_product,easy_device,1) ON CONFLICT DO NOTHING;
  END IF;
  IF scan_product IS NOT NULL AND scan_device IS NOT NULL THEN
    DELETE FROM sellable_product_bom_items WHERE "productId"=scan_product AND "finishedProductId"=scan_board;
    SELECT id INTO obsolete_id FROM finished_products WHERE name='Decal hộp ScanBox' LIMIT 1;
    IF obsolete_id IS NOT NULL THEN DELETE FROM sellable_product_bom_items WHERE "productId"=scan_product AND "finishedProductId"=obsolete_id; END IF;
    INSERT INTO sellable_product_bom_items ("productId","finishedProductId","quantityPerProduct") VALUES (scan_product,scan_device,1) ON CONFLICT DO NOTHING;
  END IF;
  IF key_product IS NOT NULL AND key_device IS NOT NULL THEN
    DELETE FROM sellable_product_bom_items WHERE "productId"=key_product AND "finishedProductId"=key_board;
    INSERT INTO sellable_product_bom_items ("productId","finishedProductId","quantityPerProduct") VALUES (key_product,key_device,1) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE production_lots SET "outputId"=easy_device,"outputLabel"='Device EasyScan hoàn thiện'
  WHERE status='NEW' AND "outputId"=easy_board AND NOT EXISTS (SELECT 1 FROM production_entry_lots link WHERE link."lotId"=production_lots.id);
  UPDATE production_lots SET "outputId"=scan_device,"outputLabel"='Device ScanBox hoàn thiện'
  WHERE status='NEW' AND "outputId"=scan_board AND NOT EXISTS (SELECT 1 FROM production_entry_lots link WHERE link."lotId"=production_lots.id);

  INSERT INTO app_data_migrations(key) VALUES ('20260815-device-assembly-v1');
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app_data_migrations WHERE key='20260815-finished-product-category-v3') THEN RETURN; END IF;

  UPDATE finished_products SET category='PCB' WHERE sku LIKE 'BOARD-%';
  UPDATE finished_products SET category='DEVICE'
  WHERE sku LIKE 'DEVICE-%' OR lower(trim(name)) LIKE 'device %';
  UPDATE finished_products SET category='CABLE'
  WHERE category='OTHER' AND lower(name) LIKE '%cáp%';

  INSERT INTO app_data_migrations(key) VALUES ('20260815-finished-product-category-v3');
END $$;

DO $$
DECLARE
  easy_device uuid; easy_product uuid; scan_product uuid;
  warranty_label uuid; material_id uuid; obsolete_id uuid;
  material_name text; obsolete_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM app_data_migrations WHERE key='20260815-real-product-bom-v2') THEN RETURN; END IF;

  INSERT INTO inventory_items ("groupName",name,sku,unit,"onHandQty","bomKind","purchaseLinks","minimumStock",note,"isActive")
  SELECT 'Máy EASYSCAN','Tem bảo hành EasyScan','TEM-BH-EASYSCAN','unit',NULL,'OTHER','[]'::jsonb,100,'Số lượng chưa kiểm',true
  WHERE NOT EXISTS (
    SELECT 1 FROM inventory_items
    WHERE "isActive"=true AND lower(trim(name))=lower('Tem bảo hành EasyScan')
  );
  SELECT id INTO warranty_label FROM inventory_items WHERE "isActive"=true AND lower(trim(name))=lower('Tem bảo hành EasyScan') LIMIT 1;
  SELECT id INTO easy_device FROM finished_products WHERE "isActive"=true AND (sku='DEVICE-EASYSCAN' OR lower(trim(name))=lower('Device EasyScan hoàn thiện')) LIMIT 1;
  IF easy_device IS NOT NULL AND warranty_label IS NOT NULL THEN
    INSERT INTO product_bom_items ("productId","itemId","quantityPerProduct")
    VALUES (easy_device,warranty_label,1) ON CONFLICT ("productId","itemId") DO NOTHING;
  END IF;

  FOREACH obsolete_name IN ARRAY ARRAY[
    'Decal hộp Easyscan','Decal vali Easyscan','Đế kẹp máy Easyscan','Kẹp cáp Easyscan','Vali đựng Easyscan',
    'Decal hộp ScanBox','Decal vali ScanBox','Vali đựng ScanBox'
  ] LOOP
    FOR obsolete_id IN SELECT id FROM finished_products WHERE lower(trim(name))=lower(obsolete_name) LOOP
      DELETE FROM sellable_product_bom_items WHERE "finishedProductId"=obsolete_id;
      UPDATE finished_products SET "isActive"=false,"isProductionOutput"=false WHERE id=obsolete_id;
    END LOOP;
  END LOOP;

  SELECT id INTO easy_product FROM sellable_products WHERE "isActive"=true AND lower(trim(name))=lower('Máy đọc lỗi Easyscan') LIMIT 1;
  IF easy_product IS NOT NULL THEN
    FOREACH material_name IN ARRAY ARRAY['Vali nhỏ','Decal vali Easyscan','Kẹp dây','Kẹp máy'] LOOP
      SELECT id INTO material_id FROM inventory_items WHERE "isActive"=true AND lower(trim(name))=lower(material_name) LIMIT 1;
      IF material_id IS NOT NULL THEN
        INSERT INTO sellable_product_material_items ("productId","itemId","quantityPerProduct")
        VALUES (easy_product,material_id,1) ON CONFLICT ("productId","itemId") DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  SELECT id INTO scan_product FROM sellable_products WHERE "isActive"=true AND lower(trim(name))=lower('Máy đọc lỗi ScanBox') LIMIT 1;
  IF scan_product IS NOT NULL THEN
    FOREACH material_name IN ARRAY ARRAY['Vali to','Decal vali ScanBox'] LOOP
      SELECT id INTO material_id FROM inventory_items WHERE "isActive"=true AND lower(trim(name))=lower(material_name) LIMIT 1;
      IF material_id IS NOT NULL THEN
        INSERT INTO sellable_product_material_items ("productId","itemId","quantityPerProduct")
        VALUES (scan_product,material_id,1) ON CONFLICT ("productId","itemId") DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO app_data_migrations(key) VALUES ('20260815-real-product-bom-v2');
END $$;

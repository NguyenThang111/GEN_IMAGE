DO $$ BEGIN
  CREATE TYPE inventory_items_bomkind_enum AS ENUM ('BOARD_COMPONENT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS "bomKind" inventory_items_bomkind_enum;

UPDATE inventory_items
SET "bomKind" = CASE
  WHEN COALESCE("easycanQtyPerBoard", 0) > 0
    OR COALESCE("scanboxQtyPerBoard", 0) > 0
    OR COALESCE("easyscuQtyPerBoard", 0) > 0
    OR upper(trim("groupName")) IN (
      'TỤ', 'TRỞ', 'IC', 'DIODE / TVS / ZENER', 'CUỘN CẢM',
      'THẠCH ANH / DAO ĐỘNG', 'CONNECTOR / JACK / SOCKET',
      'LED / BUZZER / BUTTON', 'RELAY', 'TRANSISTOR', 'PCB'
    )
  THEN 'BOARD_COMPONENT'::inventory_items_bomkind_enum
  ELSE 'OTHER'::inventory_items_bomkind_enum
END
WHERE "bomKind" IS NULL;

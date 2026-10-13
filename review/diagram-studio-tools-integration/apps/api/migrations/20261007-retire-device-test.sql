BEGIN;

-- Stop old stations during deployment; keep keys, profiles and all result history.
UPDATE device_test_stations SET "isActive"=false,"updatedAt"=now() WHERE "isActive";
UPDATE device_test_profiles SET "isActive"=false,"updatedAt"=now() WHERE "isActive";

WITH candidates AS MATERIALIZED (
  SELECT * FROM production_lots
  WHERE "deletedAt" IS NULL AND status <> 'DONE'
    AND ("testProfileKey" IS NOT NULL OR "testProfileVersion" IS NOT NULL OR "testStationId" IS NOT NULL OR "deviceTestStartedAt" IS NOT NULL OR "deviceTestTargetPassCount" IS NOT NULL)
  FOR UPDATE
), converted AS (
  UPDATE production_lots AS lot SET
    status=CASE WHEN old.status='TESTING' THEN 'WAITING_TEST'::production_lot_status ELSE old.status END,
    "testProfileKey"=NULL,"testProfileVersion"=NULL,"testStationId"=NULL,
    "deviceTestStartedAt"=NULL,"deviceTestTargetPassCount"=NULL,
    "testClaimedById"=NULL,"testClaimedAt"=NULL,"updatedAt"=now()
  FROM candidates AS old WHERE lot.id=old.id
  RETURNING lot.id
)
INSERT INTO production_lot_events ("lotId",type,"actorId",payload)
SELECT old.id,'NOTE_UPDATED',old."createdById",jsonb_build_object(
  'action','DEVICE_TEST_RETIRED','source','SYSTEM',
  'message','Ngừng ESP32; nhận Test và nhập kết quả thủ công. Kết quả thiết bị cũ vẫn được giữ.',
  'before',jsonb_build_object('status',old.status,'testProfileKey',old."testProfileKey",'testProfileVersion',old."testProfileVersion",
    'testStationId',old."testStationId",'deviceTestStartedAt',old."deviceTestStartedAt",'deviceTestTargetPassCount',old."deviceTestTargetPassCount",
    'testClaimedById',old."testClaimedById",'testClaimedAt',old."testClaimedAt"),
  'statusAfter',CASE WHEN old.status='TESTING' THEN 'WAITING_TEST' ELSE old.status::text END
)
FROM candidates AS old JOIN converted ON converted.id=old.id;

COMMIT;

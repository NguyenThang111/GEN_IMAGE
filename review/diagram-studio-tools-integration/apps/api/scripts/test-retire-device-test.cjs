// Isolated PostgreSQL/WASM test; never reads DATABASE_URL or connects to production.
// Run: PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite node apps/api/scripts/test-retire-device-test.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const sql = readFileSync(join(__dirname,'../migrations/20261007-retire-device-test.sql'),'utf8');

async function main(){
  const db = new PGlite();
  try{
    await db.exec(`
      CREATE TYPE production_lot_status AS ENUM ('NEW','IN_PROGRESS','WAITING_TEST','TESTING','DONE');
      CREATE TABLE device_test_stations(id text PRIMARY KEY,"isActive" boolean,"updatedAt" timestamptz);
      CREATE TABLE device_test_profiles(id text PRIMARY KEY,"isActive" boolean,"updatedAt" timestamptz);
      CREATE TABLE production_lots(id text PRIMARY KEY,status production_lot_status,"createdById" text,
        "deletedAt" timestamptz,"updatedAt" timestamptz,"testProfileKey" text,"testProfileVersion" integer,
        "testStationId" text REFERENCES device_test_stations(id),"deviceTestStartedAt" timestamptz,"deviceTestTargetPassCount" integer,
        "testClaimedById" text,"testClaimedAt" timestamptz,"producedQuantity" integer,"completedQuantity" integer,"accumulatedMinutes" integer);
      CREATE TABLE production_lot_events(id uuid DEFAULT gen_random_uuid(),"lotId" text REFERENCES production_lots(id),type text,"actorId" text,payload jsonb);
      CREATE TABLE production_lot_device_tests(id text PRIMARY KEY,"lotId" text REFERENCES production_lots(id),result text);
      CREATE TABLE inventory_and_hours(id text PRIMARY KEY,stock integer,hours integer);
      INSERT INTO device_test_stations VALUES ('station',true,now());
      INSERT INTO device_test_profiles VALUES ('profile',true,now());
      INSERT INTO inventory_and_hours VALUES ('unchanged',200,4);
    `);
    for(const [id,status,cloud,deleted] of [
      ['waiting','WAITING_TEST',true,false],['testing','TESTING',true,false],['working','IN_PROGRESS',true,false],
      ['new','NEW',true,false],['done','DONE',true,false],['deleted','TESTING',true,true],['manual','TESTING',false,false],
    ]){
      await db.query(`INSERT INTO production_lots VALUES ($1,$2,'creator',$3,'2026-10-01',$4,$5,$6,$7,$8,$9,$10,20,$11,120)`,
        [id,status,deleted?'2026-10-01':null,cloud?'PROFILE':null,cloud?1:null,cloud?'station':null,cloud?'2026-10-01':null,cloud?20:null,status==='TESTING'?'tester':null,status==='TESTING'?'2026-10-01':null,status==='DONE'?20:null]);
    }
    await db.exec(`INSERT INTO production_lot_device_tests VALUES ('r1','testing','PASS'),('r2','testing','FAIL'),('r3','done','PASS');
      INSERT INTO production_lot_events ("lotId",type,"actorId",payload) VALUES ('testing','TEST_CLAIMED','creator','{"source":"DEVICE_TEST"}');`);
    const rows = async table => (await db.query('SELECT * FROM '+table+' ORDER BY id')).rows;
    const before = await rows('production_lots'), results = await rows('production_lot_device_tests'), untouched = await rows('inventory_and_hours');
    // A failed audit write must roll back conversion and station/profile disabling together.
    await db.exec(`ALTER TABLE production_lot_events ADD CONSTRAINT reject_retirement CHECK (payload->>'action' IS DISTINCT FROM 'DEVICE_TEST_RETIRED')`);
    await assert.rejects(()=>db.exec(sql)); await db.exec('ROLLBACK');
    assert.deepEqual(await rows('production_lots'),before);
    assert.equal((await rows('device_test_stations'))[0].isActive,true);
    await db.exec('ALTER TABLE production_lot_events DROP CONSTRAINT reject_retirement');
    await db.exec(sql);
    const after = await rows('production_lots');
    for(const id of ['waiting','testing','working','new']){
      const row=after.find(r=>r.id===id), old=before.find(r=>r.id===id);
      assert.equal(row.status,id==='testing'?'WAITING_TEST':old.status);
      for(const key of ['testProfileKey','testProfileVersion','testStationId','deviceTestStartedAt','deviceTestTargetPassCount','testClaimedById','testClaimedAt'])assert.equal(row[key],null);
      for(const key of ['producedQuantity','completedQuantity','accumulatedMinutes'])assert.equal(row[key],old[key]);
    }
    for(const id of ['done','deleted','manual'])assert.deepEqual(after.find(r=>r.id===id),before.find(r=>r.id===id));
    assert.deepEqual(await rows('production_lot_device_tests'),results);
    assert.deepEqual(await rows('inventory_and_hours'),untouched);
    const events=await rows('production_lot_events');
    const retired=events.filter(e=>e.payload.action==='DEVICE_TEST_RETIRED');
    assert.equal(retired.length,4);assert.equal(events.length,5);
    assert.equal(retired.find(e=>e.lotId==='testing').payload.before.testClaimedById,'tester');
    assert.equal(retired.find(e=>e.lotId==='testing').payload.before.testStationId,'station');
    assert.ok(retired.every(e=>e.payload.source==='SYSTEM'));
    assert.equal((await rows('device_test_stations'))[0].isActive,false);
    assert.equal((await rows('device_test_profiles'))[0].isActive,false);
    await db.exec(sql);
    assert.deepEqual(await rows('production_lots'),after);
    assert.deepEqual(await rows('production_lot_events'),events);
    console.log('PASS: migration conversion, history, rollback, unchanged stock/hours and idempotency');
  }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

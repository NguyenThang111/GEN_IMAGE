import 'dotenv/config';
import { randomUUID } from 'node:crypto';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string,params?:unknown[]):Promise<{rows:any[]}>;end():Promise<void>} };

const PREFIX='SMOKE-WL-20260823-';
const statuses=['IN_PROGRESS','IN_PROGRESS','WAITING_TEST','TESTING','DONE'] as const;

async function seed(){
  const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
  try{
    await client.query('BEGIN');
    const existing=await client.query('SELECT id,"runId" FROM production_lots WHERE code LIKE $1',[`${PREFIX}%`]);
    if(existing.rows.length){const ids=existing.rows.map(row=>row.id);await client.query('DELETE FROM production_lot_events WHERE "lotId"=ANY($1)',[ids]);await client.query('DELETE FROM production_lot_assignees WHERE "lotId"=ANY($1)',[ids]);await client.query('DELETE FROM production_entry_lots WHERE "lotId"=ANY($1)',[ids]);await client.query('DELETE FROM production_lots WHERE id=ANY($1)',[ids]);await client.query('DELETE FROM production_runs WHERE id=ANY($1)',[[...new Set(existing.rows.map(row=>row.runId))]]);}
    const users=(await client.query(`SELECT id,username FROM users WHERE lower(username)=ANY($1) ORDER BY username`,[['giang','my','nam']])).rows;
    const outputs=(await client.query(`SELECT id,name,'FINISHED_PRODUCT'::text AS kind FROM finished_products WHERE "isActive"=true AND "isProductionOutput"=true UNION ALL SELECT id,name,'SELLABLE_PRODUCT'::text AS kind FROM sellable_products WHERE "isActive"=true ORDER BY name`)).rows;
    if(users.length<3||!outputs.length)throw new Error('Thiếu user Sản xuất hoặc đầu ra Kho để seed');
    const runId=randomUUID();await client.query('INSERT INTO production_runs(id,"createdById") VALUES($1,$2)',[runId,users[0].id]);
    for(let index=0;index<25;index+=1){
      const user=users[index%users.length];const output=outputs[index%outputs.length];const status=statuses[index%statuses.length];const target=10+(index%6)*10;const produced=status==='IN_PROGRESS'?null:target;const failed=status==='DONE'?index%3:null;const passed=status==='DONE'?target-Number(failed):null;const minutes=35+(index%8)*25;const active=status==='IN_PROGRESS'&&index%2===0;const lotId=randomUUID();const now=new Date(Date.now()-(24-index)*3600000);
      await client.query(`INSERT INTO production_lots(id,"runId",code,"actionType","outputType","outputId","outputLabel","targetQuantity",status,"completedQuantity","producedQuantity","failedQuantity","accumulatedMinutes","activeById","activeStartedAt",note,"createdById","completedById","completedAt","testedById","testedAt","testClaimedById","testClaimedAt","createdAt","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24)`,[lotId,runId,`${PREFIX}${String(index+1).padStart(2,'0')}`,output.kind==='SELLABLE_PRODUCT'?'PACK':'ASSEMBLE',output.kind,output.id,output.name,target,status,passed,produced,failed,minutes,active?user.id:null,active?new Date(Date.now()-12*60000):null,index%4===0?'Smoke UX row dài để kiểm tra ellipsis và độ thẳng cột':null,user.id,status==='DONE'?user.id:null,status==='DONE'?now:null,status==='DONE'?users[(index+1)%users.length].id:null,status==='DONE'?now:null,status==='TESTING'?users[(index+1)%users.length].id:null,status==='TESTING'?now:null,now]);
      if(status!=='IN_PROGRESS')await client.query('UPDATE production_lots SET "workStartedAt"=$2,"workEndedAt"=$3 WHERE id=$1',[lotId,now,new Date(now.getTime()+minutes*60000)]);
      await client.query('INSERT INTO production_lot_assignees("lotId","userId") VALUES($1,$2)',[lotId,user.id]);
      await client.query(`INSERT INTO production_lot_events("lotId",type,"actorId",payload,"createdAt") VALUES($1,'CREATED',$2,$3,$4),($1,'CLAIMED',$2,$5,$4),($1,'STARTED',$2,$6,$4)`,[lotId,user.id,JSON.stringify({targetQuantity:target,outputLabel:output.name}),now,JSON.stringify({userId:user.id}),JSON.stringify({startedAt:now.toISOString()})]);
      if(status==='WAITING_TEST'||status==='TESTING'||status==='DONE')await client.query(`INSERT INTO production_lot_events("lotId",type,"actorId",payload,"createdAt") VALUES($1,'PRODUCTION_FINISHED',$2,$3,$4)`,[lotId,user.id,JSON.stringify({quantity:target,minutes}),new Date(now.getTime()+minutes*60000)]);
      if(status==='TESTING'||status==='DONE'){const tester=users[(index+1)%users.length];await client.query(`INSERT INTO production_lot_events("lotId",type,"actorId",payload,"createdAt") VALUES($1,'TEST_CLAIMED',$2,$3,$4)`,[lotId,tester.id,JSON.stringify({claimedAt:now.toISOString()}),new Date(now.getTime()+(minutes+5)*60000)]);}
      if(status==='DONE'){const tester=users[(index+1)%users.length];await client.query(`INSERT INTO production_lot_events("lotId",type,"actorId",payload,"createdAt") VALUES($1,'TESTED',$2,$3,$4),($1,'DONE',$2,$5,$4)`,[lotId,tester.id,JSON.stringify({testedQuantity:target,passedQuantity:passed,failedQuantity:failed}),new Date(now.getTime()+(minutes+20)*60000),JSON.stringify({quantity:passed})]);}
    }
    await client.query('COMMIT');process.stdout.write('Seeded 25 SMOKE-WL production worklogs\n');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
}

void seed();

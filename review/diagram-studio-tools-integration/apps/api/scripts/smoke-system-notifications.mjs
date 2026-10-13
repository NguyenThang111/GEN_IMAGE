import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';

const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3000';
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
const suffix=Date.now();
const password=`Smoke-${suffix}`;
const ids={admin:null,member:null,request:null,entry:null,payment:null,run:null,lot:null};

function assert(value,message){if(!value)throw new Error(message);}
async function login(username){const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert(response.ok,`Login failed for ${username}: ${response.status}`);return response.json();}
async function ok(path,token,init={}){const response=await fetch(`${base}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init.headers}});const body=await response.json().catch(()=>null);assert(response.ok,`${init.method??'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);return body;}

await client.connect();
try{
  const passwordHash=await bcrypt.hash(password,4);
  const adminUsername=`notification_admin_${suffix}`;
  const memberUsername=`notification_member_${suffix}`;
  const admin=await client.query('INSERT INTO users (username,"displayName",email,"passwordHash",role,"isActive") VALUES ($1,$2,NULL,$3,\'ADMIN\',true) RETURNING id',[adminUsername,'SMOKE ADMIN',passwordHash]);
  const member=await client.query('INSERT INTO users (username,"displayName",email,"passwordHash",role,"isActive") VALUES ($1,$2,NULL,$3,\'MEMBER\',true) RETURNING id',[memberUsername,'SMOKE MEMBER',passwordHash]);
  ids.admin=admin.rows[0].id;ids.member=member.rows[0].id;
  const [adminSession,memberSession]=await Promise.all([login(adminUsername),login(memberUsername)]);

  const items=await ok('/api/inventory/items',memberSession.accessToken);
  const item=items.find(row=>row.unit==='unit');
  assert(item,'Need one normalized inventory item');
  const request=await ok(`/api/inventory/items/${item.id}/purchase-requests`,memberSession.accessToken,{method:'POST',body:JSON.stringify({quantity:1,note:'Smoke notification'})});
  ids.request=request.id;
  let adminNotifications=await ok('/api/notifications',adminSession.accessToken);
  const created=adminNotifications.find(row=>row.entityId===request.id&&row.eventType==='PURCHASE_REQUEST_CREATED');
  assert(created,'Admin did not receive Purchase Request created notification');
  await ok(`/api/inventory/purchase-requests/${request.id}`,adminSession.accessToken,{method:'PATCH',body:JSON.stringify({quantity:2,note:'Smoke updated'})});
  let memberNotifications=await ok('/api/notifications',memberSession.accessToken);
  const edited=memberNotifications.find(row=>row.entityId===request.id&&row.eventType==='PURCHASE_REQUEST_EDITED');
  assert(edited,'Requester did not receive Purchase Request edited notification');
  const read=await ok(`/api/notifications/${edited.id}/read`,memberSession.accessToken,{method:'PATCH'});
  assert(read.readAt,'System notification was not marked read');

  const workDate='2099-02-01';
  const finished=await client.query('SELECT id FROM finished_products WHERE "isActive"=true LIMIT 1');
  assert(finished.rows[0]?.id,'Need one active finished product for production report source');
  const run=await ok('/api/production/runs',adminSession.accessToken,{method:'POST',body:JSON.stringify({lots:[{outputType:'FINISHED_PRODUCT',outputId:finished.rows[0].id,targetQuantity:999}]})});
  ids.run=run.run.id;ids.lot=run.lots[0].id;
  await ok('/api/production/sessions',memberSession.accessToken,{method:'POST',body:JSON.stringify({userId:ids.member,workDate,isRegistered:true,hoursWorked:2})});
  const entry=await ok('/api/production/entries',memberSession.accessToken,{method:'POST',body:JSON.stringify({userId:ids.member,workDate,module:'SUPPORT',workType:'Smoke',outputType:'LABEL',outputLabel:'Smoke report',rawText:'Đã hoàn thành smoke notification',lotIds:[ids.lot]})});
  ids.entry=entry.id;
  adminNotifications=await ok('/api/notifications',adminSession.accessToken);
  assert(adminNotifications.some(row=>row.entityId===entry.id&&row.eventType==='PRODUCTION_REPORT_CREATED'),'Admin did not receive Production report notification');

  const payment=await client.query('INSERT INTO production_payment_requests ("batchKey","userId","sessionIds","totalHours","workSummary",status,"paidById","paidAt") VALUES ($1,$2,$3,2,$4::jsonb,\'REQUESTED\',NULL,NULL) RETURNING id',[`notification-smoke-${suffix}`,ids.member,[],JSON.stringify([{date:workDate,outputs:[{label:'Smoke report',quantity:null}]}])]);
  ids.payment=payment.rows[0].id;
  await ok(`/api/production/payment-requests/${ids.payment}/paid`,adminSession.accessToken,{method:'PATCH'});
  memberNotifications=await ok('/api/notifications',memberSession.accessToken);
  assert(memberNotifications.some(row=>row.entityId===ids.payment&&row.eventType==='PRODUCTION_PAYMENT_PAID'),'Member did not receive Production payment notification');
  await ok('/api/notifications/read-all',memberSession.accessToken,{method:'PATCH'});
  memberNotifications=await ok('/api/notifications',memberSession.accessToken);
  assert(memberNotifications.every(row=>row.readAt),'Read all did not mark every System notification');

  process.stdout.write('System activity notification smoke passed\n');
}finally{
  if(ids.request)await client.query('DELETE FROM email_outbox WHERE "dedupeKey"=$1',[`purchase-request:${ids.request}:created`]);
  if(ids.request)await client.query('DELETE FROM purchase_requests WHERE id=$1',[ids.request]);
  if(ids.payment)await client.query('DELETE FROM production_payment_requests WHERE id=$1',[ids.payment]);
  if(ids.entry)await client.query('DELETE FROM production_entry_lots WHERE "entryId"=$1',[ids.entry]);
  if(ids.entry)await client.query('DELETE FROM production_entries WHERE id=$1',[ids.entry]);
  if(ids.lot)await client.query('DELETE FROM production_lot_events WHERE "lotId"=$1',[ids.lot]);
  if(ids.lot)await client.query('DELETE FROM production_lots WHERE id=$1',[ids.lot]);
  if(ids.run)await client.query('DELETE FROM production_runs WHERE id=$1',[ids.run]);
  if(ids.member)await client.query('DELETE FROM production_work_sessions WHERE "userId"=$1',[ids.member]);
  if(ids.admin||ids.member)await client.query('DELETE FROM system_notifications WHERE "actorId"=ANY($1::uuid[]) OR "recipientId"=ANY($1::uuid[])',[[ids.admin,ids.member].filter(Boolean)]);
  if(ids.admin)await client.query('DELETE FROM users WHERE id=$1',[ids.admin]);
  if(ids.member)await client.query('DELETE FROM users WHERE id=$1',[ids.member]);
  await client.end();
}

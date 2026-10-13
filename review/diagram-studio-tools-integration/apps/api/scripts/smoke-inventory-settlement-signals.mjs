import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';

const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3000';
const adminPassword=process.env.SEED_PASSWORD??'auto2tech123';
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
const suffix=Date.now();
const username=`settlement_smoke_${suffix}`;
const password=`Smoke-${suffix}`;
let memberId=null;
let runId=null;
let lotId=null;
const itemIds=[];

function assert(value,message){if(!value)throw new Error(message);}
async function login(name,secret){const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,password:secret})});assert(response.ok,`Login failed for ${name}: ${response.status}`);return response.json();}
async function call(path,token,init={}){const response=await fetch(`${base}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init.headers}});const body=await response.json().catch(()=>null);return {response,body};}
async function ok(path,token,init={}){const result=await call(path,token,init);assert(result.response.ok,`${init.method??'GET'} ${path} failed: ${result.response.status} ${JSON.stringify(result.body)}`);return result.body;}
async function createItem(token,name){const item=await ok('/api/inventory/items',token,{method:'POST',body:JSON.stringify({name,groupName:'SMOKE TEST',minimumStock:0})});itemIds.push(item.id);return item;}

await client.connect();
try{
  const passwordHash=await bcrypt.hash(password,4);
  const inserted=await client.query('INSERT INTO users (username,"displayName",email,"passwordHash",role,"isActive") VALUES ($1,$2,NULL,$3,\'MEMBER\',true) RETURNING id',[username,'SMOKE KẾT CÔNG',passwordHash]);
  memberId=inserted.rows[0].id;
  const [admin,member]=await Promise.all([login('admin',adminPassword),login(username,password)]);
  const finished=await client.query('SELECT id FROM finished_products WHERE "isActive"=true LIMIT 1');
  assert(finished.rows[0]?.id,'Need one active finished product for production report source');
  const run=await ok('/api/production/runs',admin.accessToken,{method:'POST',body:JSON.stringify({lots:[{outputType:'FINISHED_PRODUCT',outputId:finished.rows[0].id,targetQuantity:999}]})});
  runId=run.run.id;lotId=run.lots[0].id;

  const standalone=await createItem(admin.accessToken,`Smoke soft delete ${suffix}`);
  assert((await call(`/api/inventory/items/${standalone.id}`,member.accessToken,{method:'DELETE'})).response.status===403,'Member soft delete must be forbidden');
  assert((await call(`/api/inventory/items/${standalone.id}`,member.accessToken,{method:'PATCH',body:JSON.stringify({isActive:false})})).response.status===403,'Member must not bypass soft delete through update');
  const deleted=await ok(`/api/inventory/items/${standalone.id}`,admin.accessToken,{method:'DELETE'});
  assert(deleted.isActive===false,'Admin delete must set isActive=false');
  const items=await ok('/api/inventory/items',admin.accessToken);
  assert(!items.some(item=>item.id===standalone.id),'Soft-deleted item remained in default inventory list');
  const audits=await ok(`/api/inventory/items/${standalone.id}/audits`,admin.accessToken);
  assert(audits.some(audit=>audit.changes?.isActive?.after===false),'Soft delete audit was not preserved');

  const bomItem=await createItem(admin.accessToken,`Smoke BOM blocker ${suffix}`);
  const product=await client.query('SELECT id FROM finished_products LIMIT 1');
  assert(product.rows[0]?.id,'Need one finished product for BOM blocker smoke');
  await client.query('INSERT INTO product_bom_items ("productId","itemId","quantityPerProduct") VALUES ($1,$2,1)',[product.rows[0].id,bomItem.id]);
  assert((await call(`/api/inventory/items/${bomItem.id}`,admin.accessToken,{method:'DELETE'})).response.status===400,'BOM item delete must be blocked');
  await client.query('DELETE FROM product_bom_items WHERE "itemId"=$1',[bomItem.id]);
  await ok(`/api/inventory/items/${bomItem.id}`,admin.accessToken,{method:'DELETE'});

  const requestItem=await createItem(admin.accessToken,`Smoke request blocker ${suffix}`);
  const purchase=await ok(`/api/inventory/items/${requestItem.id}/purchase-requests`,member.accessToken,{method:'POST',body:JSON.stringify({quantity:1,note:'Smoke active request'})});
  assert((await call(`/api/inventory/items/${requestItem.id}`,admin.accessToken,{method:'DELETE'})).response.status===400,'Active purchase request item delete must be blocked');
  await client.query('DELETE FROM email_outbox WHERE "dedupeKey"=$1',[`purchase-request:${purchase.id}:created`]);
  await client.query('DELETE FROM purchase_requests WHERE id=$1',[purchase.id]);
  await ok(`/api/inventory/items/${requestItem.id}`,admin.accessToken,{method:'DELETE'});

  for(let day=1;day<=4;day+=1){
    const workDate=`2099-01-${String(day).padStart(2,'0')}`;
    await ok('/api/production/sessions',member.accessToken,{method:'POST',body:JSON.stringify({userId:memberId,workDate,isRegistered:true,hoursWorked:4})});
    await ok('/api/production/entries',member.accessToken,{method:'POST',body:JSON.stringify({userId:memberId,workDate,module:'SUPPORT',workType:'Smoke',outputType:'LABEL',outputLabel:`Smoke ${day}`,rawText:`Smoke ${day}`,lotIds:[lotId]})});
  }
  const overview=await ok('/api/production/overview?from=2099-01-01&to=2099-01-07',admin.accessToken);
  const payment=overview.paymentRequests.find(row=>row.userId===memberId);
  assert(payment&&payment.sessionIds.length===3,'Fourth valid session must create payment request for first three sessions');
  const fourth=overview.sessions.find(row=>row.userId===memberId&&row.workDate==='2099-01-04');
  assert(fourth&&!payment.sessionIds.includes(fourth.id),'Fourth session must remain outside the settlement batch');
  const [adminNotifications,memberNotifications]=await Promise.all([ok('/api/production/notifications',admin.accessToken),ok('/api/production/notifications',member.accessToken)]);
  assert(adminNotifications.filter(row=>row.paymentRequestId===payment.id).length===1,'Admin must receive exactly one settlement notification');
  assert(memberNotifications.filter(row=>row.paymentRequestId===payment.id).length===1,'Eligible member must receive exactly one settlement notification');
  await ok('/api/production/entries',member.accessToken,{method:'POST',body:JSON.stringify({userId:memberId,workDate:'2099-01-04',module:'SUPPORT',workType:'Smoke extra',outputType:'LABEL',outputLabel:'Smoke extra',rawText:'Smoke extra',lotIds:[lotId]})});
  const afterRepeat=await ok('/api/production/notifications',member.accessToken);
  assert(afterRepeat.filter(row=>row.paymentRequestId===payment.id).length===1,'Repeated ensure must not duplicate settlement notification');
  const notice=memberNotifications.find(row=>row.paymentRequestId===payment.id);
  const read=await ok(`/api/production/notifications/${notice.id}/read`,member.accessToken,{method:'PATCH'});
  assert(read.readAt,'Settlement notification must be markable as read');

  process.stdout.write('Inventory soft delete and production settlement signal smoke passed\n');
}finally{
  if(lotId)await client.query('DELETE FROM production_lot_events WHERE "lotId"=$1',[lotId]);
  if(lotId)await client.query('DELETE FROM production_lots WHERE id=$1',[lotId]);
  if(runId)await client.query('DELETE FROM production_runs WHERE id=$1',[runId]);
  if(memberId){
    await client.query('DELETE FROM production_notifications WHERE "recipientId"=$1 OR "paymentRequestId" IN (SELECT id FROM production_payment_requests WHERE "userId"=$1)',[memberId]);
    await client.query('DELETE FROM production_payment_requests WHERE "userId"=$1',[memberId]);
    await client.query('DELETE FROM production_entries WHERE "userId"=$1',[memberId]);
    await client.query('DELETE FROM production_work_sessions WHERE "userId"=$1',[memberId]);
    await client.query('DELETE FROM users WHERE id=$1',[memberId]);
  }
  for(const id of itemIds){
    await client.query('DELETE FROM product_bom_items WHERE "itemId"=$1',[id]);
    await client.query('DELETE FROM purchase_requests WHERE "itemId"=$1',[id]);
    await client.query('DELETE FROM inventory_item_audits WHERE "itemId"=$1',[id]);
    await client.query('DELETE FROM inventory_items WHERE id=$1',[id]);
  }
  await client.end();
}

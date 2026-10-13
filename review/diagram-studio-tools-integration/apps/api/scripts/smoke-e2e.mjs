import { io } from 'socket.io-client';

const base=process.env.API_URL??'http://127.0.0.1:3000';
const password=process.env.SEED_PASSWORD??'auto2tech123';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function login(username){const response=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert(response.ok,`Login failed for ${username}`);return response.json();}
async function call(token,path,init={}){return fetch(`${base}/api${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...init.headers}});}
async function json(token,path,init={}){const response=await call(token,path,init);const body=await response.json().catch(()=>null);assert(response.ok,`${path} failed: ${JSON.stringify(body)}`);return body;}
const post=(token,path,body)=>json(token,path,{method:'POST',body:JSON.stringify(body??{})});
const event=(socket,name)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`Missing realtime ${name}`)),3000);socket.once(name,payload=>{clearTimeout(timer);resolve(payload);});});

const [admin,thang,vinh,phu]=await Promise.all(['admin','thang','vinh','phu'].map(login));
const users=await json(admin.accessToken,'/users');
const thangUser=users.find(user=>user.username==='thang');assert(thangUser,'Missing THẮNG account');
const vinhUser=users.find(user=>user.username==='vinh');assert(vinhUser,'Missing VINH account');
const socket=io(base,{auth:{token:admin.accessToken},transports:['websocket']});
await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});

const createdEvent=event(socket,'task.created');
const task=await post(admin.accessToken,'/tasks',{title:'E2E',note:`Task ${Date.now()}`,dueDate:'2026-07-31',assigneeIds:[thangUser.id,vinhUser.id],criteria:['API trả kết quả đúng','Realtime cập nhật'],pointFactors:{outputScope:1,complexity:1,uncertainty:1,risk:1,verification:1}});
assert(Number(task.point)===200,'Base Point was not calculated from factors');
assert(Number(task.assignees[0].sharePercent)===75&&Number(task.assignees[1].sharePercent)===25,'Assignee shares are incorrect');
assert((await createdEvent).id===task.id,'Realtime task.created did not match');
assert((await call(phu.accessToken,`/tasks/${task.id}/done`,{method:'POST'})).status===403,'Non-assignee Done must be 403');
await post(thang.accessToken,`/tasks/${task.id}/done`);
assert((await call(vinh.accessToken,`/tasks/${task.id}/complete`,{method:'POST'})).status===403,'Member Complete must be 403');
await post(admin.accessToken,`/tasks/${task.id}/reopen`);
await post(thang.accessToken,`/tasks/${task.id}/done`);
const reviewed=await post(admin.accessToken,`/tasks/${task.id}/review`,{passedCriterionIds:task.criteria.map(criterion=>criterion.id)});
assert(reviewed.status==='COMPLETE'&&Number(reviewed.qualityRate)===1,'Checklist review did not Complete at full quality');
await post(admin.accessToken,`/tasks/${task.id}/archive`);

const deleteTask=await post(admin.accessToken,'/tasks',{title:'E2E',note:`Delete ${Date.now()}`,dueDate:'2026-07-31',assigneeIds:[thangUser.id],criteria:['Có thể xóa']});
assert((await call(thang.accessToken,`/tasks/${deleteTask.id}`,{method:'DELETE'})).status===403,'Member Delete must be 403');
await json(admin.accessToken,`/tasks/${deleteTask.id}`,{method:'DELETE'});
const trash=await json(admin.accessToken,'/tasks/trash');assert(!trash.some(item=>item.id===deleteTask.id),'Soft-deleted task remained in Trash');

const inventory=await json(admin.accessToken,'/inventory/items');
const unnormalized=inventory.find(item=>item.onHandQty===null);assert(unnormalized,'Missing unnormalized inventory item');
const normalized=inventory.find(item=>item.onHandQty!==null);assert(normalized,'Missing normalized demo inventory item');
const numericSource=inventory.find(item=>item.onHandQty===null&&/^\d+(?:[.,]\d+)?$/.test(item.sourceStockText??''));
assert(numericSource?.normalizationSuggestion?.quantity===Number(numericSource.sourceStockText.replace(',','.')),'Numeric source suggestion is incorrect');
const bagSource=inventory.find(item=>/^1\s*túi$/i.test(item.sourceStockText??''));
assert(bagSource?.name==='LED đỏ','Expected LED đỏ bag source');
assert(bagSource.normalizationSuggestion?.quantity===1000&&bagSource.normalizationSuggestion?.unit==='unit','One bag must suggest 1,000 unit');
assert((await call(thang.accessToken,`/inventory/items/${unnormalized.id}/request-count`,{method:'POST'})).ok,'Member inventory action must be shared');
const normalizeBody={items:[{itemId:unnormalized.id,quantity:1,unit:'unit'}]};
const beforeTransactions=await json(admin.accessToken,`/inventory/items/${unnormalized.id}/transactions`);
const rejectedBatch={items:[...normalizeBody.items,{itemId:normalized.id,quantity:1,unit:'unit'}]};
assert((await call(admin.accessToken,'/inventory/normalize',{method:'POST',body:JSON.stringify(rejectedBatch)})).status===400,'Batch containing normalized item must be rejected');
const inventoryAfter=await json(admin.accessToken,'/inventory/items');
assert(inventoryAfter.find(item=>item.id===unnormalized.id)?.onHandQty===null,'Rejected batch partially changed balance');
const afterTransactions=await json(admin.accessToken,`/inventory/items/${unnormalized.id}/transactions`);
assert(afterTransactions.length===beforeTransactions.length,'Rejected batch partially created ledger');

socket.disconnect();
process.stdout.write(JSON.stringify({taskLifecycle:true,realtime:true,taskPermissions:true,softDelete:true,inventorySharedAccess:true,normalizationSuggestion:true,normalizationAtomicity:true})+'\n');

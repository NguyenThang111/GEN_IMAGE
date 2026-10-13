import 'dotenv/config';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{
  connect():Promise<void>;
  query(sql:string,values?:unknown[]):Promise<{rows:any[];rowCount:number|null}>;
  end():Promise<void>;
} };

const namWork={
  '2026-07-23':'Làm cùng Mỹ: 30 cáp chính, 9 dây 3 đầu, 11 dây đỏ, 5 dây Yamaha',
  '2026-07-24':'Cắt 350 dây vàng, 50 xanh lá, 50 xanh lam; bấm cos 50 Yamaha (80%)',
  '2026-07-25':'50 cáp Yamaha',
  '2026-07-28':'Làm cùng Giang: 50 Yamaha, 50 đỏ (70%), 8 dây 3 đầu',
  '2026-07-29':'Hoàn thiện 50 cáp đỏ, bấm cos dây 3 đầu',
  '2026-07-30':'Hoàn thiện 33 dây 3 đầu, cắt dây',
};

async function run(){
  const client=new Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  try{
    await client.query('BEGIN');
    const users=(await client.query(`SELECT id,username FROM users WHERE username=ANY($1)`,[['admin','giang','my','nam']])).rows;
    const id=(username:string)=>{const user=users.find(row=>row.username===username);if(!user)throw new Error(`Missing ${username}`);return user.id as string;};

    const sessionId=async(username:string,date:string)=>{
      const row=(await client.query(`SELECT id FROM production_work_sessions WHERE "userId"=$1 AND "workDate"=$2`,[id(username),date])).rows[0];
      if(!row)throw new Error(`Missing session ${username} ${date}`);
      return row.id as string;
    };

    const namPaidIds=[await sessionId('nam','2026-07-23'),await sessionId('nam','2026-07-24')];
    const namPaidSummary=['2026-07-23','2026-07-24'].map(date=>({date,outputs:[{label:namWork[date as keyof typeof namWork],quantity:null}]}));
    await client.query(`
      INSERT INTO production_payment_requests ("batchKey","userId","sessionIds","totalHours","workSummary",status,"paidById","paidAt")
      VALUES ($1,$2,$3,9.5,$4::jsonb,'PAID',$5,now())
      ON CONFLICT ("batchKey") DO UPDATE SET
        "sessionIds"=EXCLUDED."sessionIds","totalHours"=EXCLUDED."totalHours","workSummary"=EXCLUDED."workSummary",
        status='PAID',"paidById"=EXCLUDED."paidById","paidAt"=COALESCE(production_payment_requests."paidAt",now()),"updatedAt"=now()
    `,['manual:production:settlement:nam:2026-07-23:2026-07-24',id('nam'),namPaidIds,JSON.stringify(namPaidSummary),id('admin')]);

    const namPendingDates=['2026-07-25','2026-07-28','2026-07-29'];
    const namPendingIds=[] as string[];
    for(const date of namPendingDates)namPendingIds.push(await sessionId('nam',date));
    const namPendingSummary=namPendingDates.map(date=>({date,outputs:[{label:namWork[date as keyof typeof namWork],quantity:null}]}));
    const pending=(await client.query(`SELECT id FROM production_payment_requests WHERE "userId"=$1 AND status='REQUESTED' ORDER BY "createdAt" DESC LIMIT 1`,[id('nam')])).rows[0];
    if(!pending)throw new Error('Missing NAM pending settlement');
    await client.query(`UPDATE production_payment_requests SET "batchKey"=$1,"sessionIds"=$2,"totalHours"=17,"workSummary"=$3::jsonb,"updatedAt"=now() WHERE id=$4`,[
      `${id('nam')}:${namPendingIds.join(':')}`,namPendingIds,JSON.stringify(namPendingSummary),pending.id,
    ]);

    for(const date of ['2026-07-28','2026-07-29','2026-07-30']){
      const entries=(await client.query(`SELECT id FROM production_entries WHERE "userId"=$1 AND "workDate"=$2 ORDER BY "createdAt",id`,[id('nam'),date])).rows;
      if(!entries.length)throw new Error(`Missing NAM report ${date}`);
      const [keep,...duplicates]=entries;
      await client.query(`UPDATE production_entries SET module='SUPPORT',"workType"='Báo cáo tự do',"outputType"='LABEL',"outputLabel"='Việc đã làm',quantity=NULL,"progressPercent"=NULL,note=NULL,"rawText"=$1,"needsReview"=true,"updatedAt"=now() WHERE id=$2`,[namWork[date as keyof typeof namWork],keep.id]);
      if(duplicates.length)await client.query(`DELETE FROM production_entries WHERE id=ANY($1)`,[duplicates.map(row=>row.id)]);
    }

    await client.query(`UPDATE production_work_sessions SET "isRegistered"=true,"hoursWorked"=13.5,"updatedById"=$1,"updatedAt"=now() WHERE "userId"=$2 AND "workDate"='2026-07-28'`,[id('admin'),id('giang')]);
    await client.query(`
      INSERT INTO production_entries ("userId","workDate",module,"workType","outputType","outputLabel",quantity,"progressPercent",note,"rawText","needsReview","sourceKey","createdById")
      VALUES ($1,'2026-07-28','SUPPORT','Import Sheet','LABEL','Việc đã làm',NULL,NULL,NULL,$2,true,$3,$4)
      ON CONFLICT ("sourceKey") DO UPDATE SET "rawText"=EXCLUDED."rawText","updatedAt"=now()
    `,[id('giang'),'bấm cos (50 yamaha, 50 dây đỏ) đóng 9 máy escan,đóng 3 máy scanbox','sheet:production:week5:giang:2026-07-28',id('admin')]);

    await client.query(`UPDATE production_work_sessions SET "isRegistered"=true,"hoursWorked"=NULL,"updatedById"=$1,"updatedAt"=now() WHERE "userId"=$2 AND "workDate"=ANY($3)`,[id('admin'),id('my'),['2026-07-29','2026-07-30']]);
    await client.query(`DELETE FROM production_entries WHERE "userId"=$1 AND "workDate"=ANY($2)`,[id('my'),['2026-07-29','2026-07-30']]);

    await client.query('COMMIT');
    process.stdout.write('Reconciled NAM settlement and Week 5 data for NAM, MỸ, GIANG\n');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
}

void run();

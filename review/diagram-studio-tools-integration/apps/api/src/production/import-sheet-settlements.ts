import 'dotenv/config';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{
  connect():Promise<void>;query(sql:string,values?:unknown[]):Promise<{rows:any[];rowCount:number|null}>;end():Promise<void>;
} };

type SessionInput={date:string;hours:number;work:string};
type Settlement={username:'giang'|'nam'|'my';batch:number;totalHours:number;status:'REQUESTED'|'PAID';sessions:[SessionInput,SessionInput,SessionInput]};

const settlements:Settlement[]=[
  {username:'my',batch:1,totalHours:12,status:'PAID',sessions:[
    {date:'2026-06-30',hours:4,work:'Làm nốt 21 dây Yamaha; đóng hộp 5 máy; 5 cáp chính'},
    {date:'2026-07-02',hours:4,work:'Làm nốt 21 dây Yamaha; đóng hộp 5 máy; 5 cáp chính'},
    {date:'2026-07-03',hours:4,work:'Làm nốt 21 dây Yamaha; đóng hộp 5 máy; 5 cáp chính'},
  ]},
  {username:'nam',batch:1,totalHours:12,status:'PAID',sessions:[
    {date:'2026-07-02',hours:4,work:'13 dây 3 đầu 50%; cáp chính'},
    {date:'2026-07-04',hours:4,work:'13 dây 3 đầu 50%; cáp chính'},
    {date:'2026-07-06',hours:4,work:'13 dây 3 đầu 50%; cáp chính'},
  ]},
  {username:'my',batch:2,totalHours:14,status:'PAID',sessions:[
    {date:'2026-07-07',hours:4,work:'Làm nốt 21 dây Yamaha; đóng hộp 5 máy; 5 cáp chính'},
    {date:'2026-07-09',hours:5,work:'Làm cáp chính ngắn; cáp phụ Honda, Yamaha, ba đầu và dây đỏ'},
    {date:'2026-07-10',hours:5,work:'6 cáp Yamaha; nâng cấp và đóng 25 máy'},
  ]},
  {username:'nam',batch:2,totalHours:12,status:'PAID',sessions:[
    {date:'2026-07-07',hours:4,work:'13 dây 3 đầu; đóng vali; hàn cáp chính'},
    {date:'2026-07-08',hours:4,work:'9 cáp chính ngắn; 15 cáp chính ngắn đạt 70%'},
    {date:'2026-07-14',hours:4,work:'3 dây 3 đầu; 3 dây đỏ; 3 dây Yamaha; bấm cos dây đỏ'},
  ]},
  {username:'giang',batch:1,totalHours:15,status:'PAID',sessions:[
    {date:'2026-07-06',hours:8,work:'10 cáp chính; 21 cáp Yamaha đạt 50%'},
    {date:'2026-07-07',hours:3,work:'1 máy box; 5 cáp chính dài; training Nam làm cáp chính'},
    {date:'2026-07-15',hours:4,work:'10 cáp chính; 10 dây đỏ; 10 cáp Yamaha'},
  ]},
  {username:'nam',batch:3,totalHours:16,status:'PAID',sessions:[
    {date:'2026-07-15',hours:4,work:'10 dây 3 đầu; 10 dây Yamaha; đóng vali'},
    {date:'2026-07-16',hours:4,work:'10 dây đỏ; 10 dây 3 đầu; 15 cáp chích'},
    {date:'2026-07-17',hours:8,work:'20 dây 3 đầu; 20 dây đỏ; 25 dây Yamaha đạt 30%'},
  ]},
  {username:'my',batch:3,totalHours:13,status:'PAID',sessions:[
    {date:'2026-07-15',hours:4,work:'11 Honda; 10 máy; 10 cáp chích; hoàn thiện cáp chính và dây đỏ'},
    {date:'2026-07-16',hours:4,work:'Hoàn thiện 20 cáp chính; cắt 60 dây làm cáp 3 đầu; 5 dây đỏ'},
    {date:'2026-07-17',hours:5,work:'25 cáp Yamaha; 15 Honda đạt 70%; 10 máy trắng'},
  ]},
  {username:'giang',batch:2,totalHours:25,status:'PAID',sessions:[
    {date:'2026-07-16',hours:9,work:'20 cáp chính; 10 Yamaha; 11 dây đỏ; 10 Honda'},
    {date:'2026-07-17',hours:9,work:'Bấm cos cáp 3 đầu, dây đỏ, Yamaha; cáp SCU 33 chân, 21 chân, Yamaha và 2 đầu'},
    {date:'2026-07-20',hours:7,work:'5 cáp SCU Yamaha; 5 cáp SCU 21 chân; cáp SCU 2 đầu đạt 50%'},
  ]},
  {username:'giang',batch:3,totalHours:22,status:'REQUESTED',sessions:[
    {date:'2026-07-21',hours:6.5,work:'5 cáp SCU 2 đầu; 1 cáp SCU 33 chân; 5 máy Easyscan; 3 máy KeyScan'},
    {date:'2026-07-22',hours:5.5,work:'5 bộ máy ScanBox'},
    {date:'2026-07-23',hours:10,work:'Hàn 20 cáp chính; làm 3 bộ cáp KeyScan'},
  ]},
];

async function run(){
  const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
  try{
    await client.query('BEGIN');
    const admin=(await client.query(`SELECT id FROM users WHERE username='admin'`)).rows[0];
    if(!admin)throw new Error('Missing admin account');
    for(const settlement of settlements){
      const member=(await client.query('SELECT id FROM users WHERE username=$1',[settlement.username])).rows[0];
      if(!member)throw new Error(`Missing member ${settlement.username}`);
      const sessionIds:string[]=[];
      for(const session of settlement.sessions){
        const sourceKey=`sheet:production:settlement:${settlement.username}:${session.date}`;
        const sessionRow=(await client.query(`
          INSERT INTO production_work_sessions ("userId","workDate","isRegistered","hoursWorked","sourceKey","updatedById")
          VALUES ($1,$2,true,$3,$4,$5)
          ON CONFLICT ("userId","workDate") DO UPDATE SET "isRegistered"=true,"hoursWorked"=EXCLUDED."hoursWorked","sourceKey"=EXCLUDED."sourceKey","updatedById"=EXCLUDED."updatedById","updatedAt"=now()
          RETURNING id
        `,[member.id,session.date,session.hours,sourceKey,admin.id])).rows[0];
        sessionIds.push(sessionRow.id);
        await client.query(`
          INSERT INTO production_entries ("userId","workDate",module,"workType","outputType","outputLabel",quantity,"progressPercent",note,"rawText","needsReview","sourceKey","createdById")
          VALUES ($1,$2,'SUPPORT','Import Sheet','LABEL','Công việc từ Sheet',NULL,100,NULL,$3,false,$4,$5)
          ON CONFLICT ("sourceKey") DO UPDATE SET "rawText"=EXCLUDED."rawText","updatedAt"=now()
        `,[member.id,session.date,session.work,sourceKey,admin.id]);
      }
      const workSummary=settlement.sessions.map(session=>({date:session.date,outputs:[{label:session.work,quantity:null}]}));
      const batchKey=`sheet:production:settlement:${settlement.username}:${settlement.batch}`;
      await client.query(`
        INSERT INTO production_payment_requests ("batchKey","userId","sessionIds","totalHours","workSummary",status,"paidById","paidAt")
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::production_payment_status,$7,CASE WHEN $6::text='PAID' THEN now() ELSE NULL END)
        ON CONFLICT ("batchKey") DO UPDATE SET "sessionIds"=EXCLUDED."sessionIds","totalHours"=EXCLUDED."totalHours","workSummary"=EXCLUDED."workSummary",status=EXCLUDED.status,"paidById"=EXCLUDED."paidById","paidAt"=EXCLUDED."paidAt","updatedAt"=now()
      `,[batchKey,member.id,sessionIds,settlement.totalHours,JSON.stringify(workSummary),settlement.status,settlement.status==='PAID'?admin.id:null]);
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
  process.stdout.write(`Imported ${settlements.length} Sheet settlements\n`);
}

void run();

import 'dotenv/config';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{
  connect():Promise<void>;
  query(sql:string,values?:unknown[]):Promise<{rows:any[];rowCount:number|null}>;
  end():Promise<void>;
} };

type WorkDay={date:string;hours:number;work?:string};

const week4:Record<'giang'|'nam'|'my',WorkDay[]>={
  giang:[
    {date:'2026-07-20',hours:7,work:'5 dây scu yamaha, 5 dây scu 21 chân; 50% dây scu 2 đầu'},
    {date:'2026-07-21',hours:6.5,work:'5 dây scu 2 đầu;1 dây scu 33 chân; 5 máy easyscan; 3 máy key'},
    {date:'2026-07-22',hours:5.5,work:'5 bộ máy scanbox'},
    {date:'2026-07-23',hours:10,work:'hàn 20 cáp chính, làm 3 bộ cáp key'},
    {date:'2026-07-24',hours:6,work:'3 bộ cáp key'},
  ],
  nam:[
    {date:'2026-07-23',hours:5.5,work:'Làm cx chị Mỹ : 30 cáp chính , 9 dây 3 đầu,11 dây đỏ , 5 dây yamaha'},
    {date:'2026-07-24',hours:4,work:'Cắt 350 dây vàng , 50 xanh lá , 50 xanh lam , bấm cos 50 yamaha (80%)'},
    {date:'2026-07-25',hours:4},
  ],
  my:[
    {date:'2026-07-22',hours:4,work:'cắt dây làm 20 cáp chính, 7 cáp chính, 30 honda'},
    {date:'2026-07-23',hours:5.5,work:'30 cáp chính , 9 dây 3 đầu,11 dây đỏ , 5 dây yamaha, đóng 10 máy'},
    {date:'2026-07-24',hours:4,work:'cắt 120 dây trắng, 150 dây đỏ, 300 dây đen\nđóng 3 máy, làm 50 yamaha( 40%)'},
  ],
};

async function run(){
  const client=new Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  let sessions=0;let entries=0;let preserved=0;
  try{
    await client.query('BEGIN');
    const admin=(await client.query(`SELECT id FROM users WHERE username='admin'`)).rows[0];
    if(!admin)throw new Error('Missing admin account');
    for(const [username,days] of Object.entries(week4)){
      const member=(await client.query('SELECT id FROM users WHERE username=$1',[username])).rows[0];
      if(!member)throw new Error(`Missing member ${username}`);
      for(const day of days){
        const sourceKey=`sheet:production:week4:${username}:${day.date}`;
        const session=await client.query(`
          INSERT INTO production_work_sessions ("userId","workDate","isRegistered","hoursWorked","sourceKey","updatedById")
          VALUES ($1,$2,true,$3,$4,$5)
          ON CONFLICT ("userId","workDate") DO UPDATE SET
            "isRegistered"=true,
            "hoursWorked"=EXCLUDED."hoursWorked",
            "sourceKey"=COALESCE(production_work_sessions."sourceKey",EXCLUDED."sourceKey"),
            "updatedById"=EXCLUDED."updatedById",
            "updatedAt"=now()
        `,[member.id,day.date,day.hours,sourceKey,admin.id]);
        sessions+=session.rowCount??0;
        if(!day.work)continue;
        const entry=await client.query(`
          INSERT INTO production_entries ("userId","workDate",module,"workType","outputType","outputLabel",quantity,"progressPercent",note,"rawText","needsReview","sourceKey","createdById")
          SELECT $1,$2,'SUPPORT','Import Sheet','LABEL','Công việc từ Sheet',NULL,NULL,NULL,$3,true,$4,$5
          WHERE NOT EXISTS (
            SELECT 1 FROM production_entries existing
            WHERE existing."userId"=$1 AND existing."workDate"=$2::date
              AND existing."sourceKey" IS DISTINCT FROM $4
          )
          ON CONFLICT ("sourceKey") DO UPDATE SET
            "rawText"=EXCLUDED."rawText",
            "needsReview"=true,
            "updatedAt"=now()
        `,[member.id,day.date,day.work,sourceKey,admin.id]);
        if(entry.rowCount)entries+=entry.rowCount;else preserved+=1;
      }
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
  process.stdout.write(`Synced ${sessions} Week 4 sessions, ${entries} source entries, preserved ${preserved} existing dates\n`);
}

void run();

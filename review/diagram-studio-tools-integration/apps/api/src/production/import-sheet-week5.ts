import 'dotenv/config';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{
  connect():Promise<void>;
  query(sql:string,values?:unknown[]):Promise<{rowCount:number|null}>;
  end():Promise<void>;
} };

const registrations:Record<string,string[]>={
  giang:['2026-07-28','2026-07-30','2026-07-31'],
  nam:['2026-07-28','2026-07-29','2026-07-30','2026-07-31'],
  my:['2026-07-29','2026-07-30','2026-07-31'],
};

async function run(){
  const client=new Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  let imported=0;
  try{
    for(const [username,dates] of Object.entries(registrations)){
      for(const workDate of dates){
        const result=await client.query(`
          INSERT INTO production_work_sessions ("userId","workDate","isRegistered","hoursWorked","sourceKey","updatedById")
          SELECT member.id,$2::date,true,NULL,$3,admin.id
          FROM users member CROSS JOIN users admin
          WHERE member.username=$1 AND admin.username='admin'
          ON CONFLICT ("userId","workDate") DO UPDATE SET
            "isRegistered"=true,
            "sourceKey"=EXCLUDED."sourceKey",
            "updatedById"=EXCLUDED."updatedById",
            "updatedAt"=now()
        `,[username,workDate,`sheet:production:week5:${username}:${workDate}`]);
        imported+=result.rowCount??0;
      }
    }
  }finally{await client.end();}
  process.stdout.write(`Imported ${imported} Week 5 registrations\n`);
}

void run();

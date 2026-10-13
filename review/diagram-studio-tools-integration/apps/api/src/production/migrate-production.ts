import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function migrate(){
  const client=new Client({connectionString:process.env.DATABASE_URL});
  const files=['20260728-production-reporting-mvp.sql','20260728-production-payment-requests.sql','20260830-production-structured-report.sql','20260914-production-registration-start-time.sql'];
  const sql=(await Promise.all(files.map(file=>readFile(join(__dirname,'..','..','migrations',file),'utf8')))).join('\n');
  await client.connect();
  try{await client.query(sql);}finally{await client.end();}
  process.stdout.write('Production reporting migration applied\n');
}

void migrate();

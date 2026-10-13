import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function migrate(){
  const client=new Client({connectionString:process.env.DATABASE_URL});
  const files=['20260815-production-lot-inventory-sync.sql','20260815-production-lot-test-action.sql','20260822-production-lot-assignee-test.sql','20260823-production-worklog-flow.sql','20260830-production-structured-report.sql','20260920-production-solder-worklogs.sql'];
  const sql=(await Promise.all(files.map(file=>readFile(join(__dirname,'..','..','migrations',file),'utf8')))).join('\n');
  await client.connect();
  try{await client.query(sql);}finally{await client.end();}
  process.stdout.write('Production Lot migrations applied\n');
}

void migrate();

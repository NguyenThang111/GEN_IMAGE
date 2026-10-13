import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function migrate(){
  const client=new Client({connectionString:process.env.DATABASE_URL});
  const sql=await readFile(join(__dirname,'..','..','migrations','20261007-retire-device-test.sql'),'utf8');
  await client.connect();
  try{await client.query(sql);}finally{await client.end();}
  process.stdout.write('Device Test retired; legacy results retained\n');
}

void migrate();

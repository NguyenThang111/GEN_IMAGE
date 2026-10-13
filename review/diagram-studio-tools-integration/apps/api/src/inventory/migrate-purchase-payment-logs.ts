import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const sql = await readFile(join(__dirname, '..', '..', 'migrations', '20260807-purchase-payment-logs.sql'), 'utf8');
    await client.query(sql);
    process.stdout.write('Purchase payment logs migration applied\n');
  } finally {
    await client.end();
  }
}

void migrate();

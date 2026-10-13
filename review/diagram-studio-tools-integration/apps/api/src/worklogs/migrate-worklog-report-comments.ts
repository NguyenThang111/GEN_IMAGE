import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = await readFile(join(__dirname, '..', '..', 'migrations', '20260821-worklog-report-comments-links.sql'), 'utf8');
  try { await client.query(sql); }
  finally { await client.end(); }
  process.stdout.write('Worklog report comments and links migration applied\n');
}

void main();

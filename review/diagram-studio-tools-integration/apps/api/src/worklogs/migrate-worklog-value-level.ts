import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sql = await readFile(join(__dirname, '..', '..', 'migrations', '20260813-worklog-value-level.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query(sql); }
  finally { await client.end(); }
  process.stdout.write('Worklog Value Level migration applied\n');
}

void main();

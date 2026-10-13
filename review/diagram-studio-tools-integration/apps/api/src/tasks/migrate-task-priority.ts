import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Client } = require('pg');
async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const sql = await readFile(join(__dirname, '..', '..', 'migrations', '20260926-task-priority.sql'), 'utf8');
  await client.connect();
  try { await client.query(sql); } finally { await client.end(); }
  process.stdout.write('Task priority migration applied\n');
}
void migrate();

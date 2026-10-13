import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query(await readFile(join(__dirname, '../../migrations/20261003-dev-performance.sql'), 'utf8')); }
  finally { await client.end(); }
  process.stdout.write('Dev performance trial schema applied\n');
}
void main().catch(error => { console.error(error.message); process.exitCode = 1; });

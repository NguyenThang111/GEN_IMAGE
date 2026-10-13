import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const { Client } = require('pg');
async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { await client.query(await readFile(join(__dirname, '..', '..', 'migrations', '20261001-user-session-version.sql'), 'utf8')); }
  finally { await client.end(); }
  process.stdout.write('User session version migration applied\n');
}
void migrate();

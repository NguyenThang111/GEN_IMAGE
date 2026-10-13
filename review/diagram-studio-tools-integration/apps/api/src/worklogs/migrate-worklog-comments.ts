import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<unknown>;end():Promise<void>} };

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const migrationFiles = ['20260819-worklog-comments-mentions.sql', '20260907-worklog-comment-images.sql'];
  try {
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(join(__dirname, '..', '..', 'migrations', migrationFile), 'utf8');
      await client.query(sql);
    }
  }
  finally { await client.end(); }
  process.stdout.write('Worklog comments, mentions and images migrations applied\n');
}

void main();

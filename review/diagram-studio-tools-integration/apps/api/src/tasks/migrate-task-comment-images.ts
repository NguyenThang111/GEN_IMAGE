import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

async function main() {
  const dataSource = new DataSource({ type: 'postgres', url: process.env.DATABASE_URL });
  await dataSource.initialize();
  const sql = await readFile(join(__dirname, '..', '..', 'migrations', '20260905-task-comment-images.sql'), 'utf8');
  await dataSource.query(sql);
  await dataSource.destroy();
  process.stdout.write('Task comment images migration applied\n');
}

void main();

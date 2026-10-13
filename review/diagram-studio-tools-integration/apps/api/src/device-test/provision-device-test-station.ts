import 'dotenv/config';
import * as bcrypt from 'bcrypt';
const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string,params:unknown[]):Promise<unknown>;end():Promise<void>} };

async function provision(){
  const stationCode=process.env.STATION_CODE?.trim();
  const displayName=process.env.STATION_DISPLAY_NAME?.trim();
  const apiKey=process.env.STATION_API_KEY?.trim();
  if(!stationCode||!displayName||!apiKey)throw new Error('Set STATION_CODE, STATION_DISPLAY_NAME and STATION_API_KEY');
  if(!/^[A-Z0-9_-]{3,50}$/.test(stationCode))throw new Error('STATION_CODE must match ^[A-Z0-9_-]{3,50}$');
  if(apiKey.length<24)throw new Error('STATION_API_KEY must have at least 24 characters');
  const apiKeyHash=await bcrypt.hash(apiKey,12);
  const client=new Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  try{
    await client.query(`INSERT INTO device_test_stations ("stationCode","displayName","apiKeyHash","isActive") VALUES ($1,$2,$3,true)
      ON CONFLICT ("stationCode") DO UPDATE SET "displayName"=EXCLUDED."displayName","apiKeyHash"=EXCLUDED."apiKeyHash","isActive"=true,"updatedAt"=now()`,[stationCode,displayName,apiKeyHash]);
  }finally{await client.end();}
  process.stdout.write(`Station ${stationCode} provisioned; keep the API key in a secure channel\n`);
}

void provision();

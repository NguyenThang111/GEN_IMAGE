import 'dotenv/config';
const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string,params:unknown[]):Promise<unknown>;end():Promise<void>} };

async function configure(){
  const outputType=process.env.OUTPUT_TYPE?.trim();
  const outputId=process.env.OUTPUT_ID?.trim();
  const testProfileKey=process.env.TEST_PROFILE_KEY?.trim();
  const testProfileVersion=Number(process.env.TEST_PROFILE_VERSION);
  if(!['FINISHED_PRODUCT','SELLABLE_PRODUCT'].includes(outputType??''))throw new Error('OUTPUT_TYPE must be FINISHED_PRODUCT or SELLABLE_PRODUCT');
  if(!outputId||!testProfileKey||!/^[A-Z0-9_]+$/.test(testProfileKey)||!Number.isInteger(testProfileVersion)||testProfileVersion<1)throw new Error('Set valid OUTPUT_ID, TEST_PROFILE_KEY and TEST_PROFILE_VERSION');
  const client=new Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  try{
    await client.query(`INSERT INTO device_test_profiles ("outputType","outputId","testProfileKey","testProfileVersion","isActive") VALUES ($1,$2,$3,$4,true)
      ON CONFLICT ("outputType","outputId") DO UPDATE SET "testProfileKey"=EXCLUDED."testProfileKey","testProfileVersion"=EXCLUDED."testProfileVersion","isActive"=true,"updatedAt"=now()`,[outputType,outputId,testProfileKey,testProfileVersion]);
  }finally{await client.end();}
  process.stdout.write(`Device test profile ${testProfileKey}/${testProfileVersion} configured for ${outputType}:${outputId}\n`);
}

void configure();

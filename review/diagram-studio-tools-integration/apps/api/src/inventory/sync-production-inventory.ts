import 'dotenv/config';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{
  connect():Promise<void>;query(sql:string,values?:unknown[]):Promise<{rows:any[];rowCount:number|null}>;end():Promise<void>;
} };

const newMaterialNames=['Decal hộp Easyscan','Decal vali Easyscan','Dây đồng hồ vạn năng'];

async function run(){
  const source=new Client({connectionString:process.env.SOURCE_DATABASE_URL});
  const target=new Client({connectionString:process.env.DATABASE_URL});
  await source.connect();await target.connect();
  let renamed=0;let created=0;
  try{
    const sourceRows=(await source.query(`SELECT * FROM inventory_items WHERE "sourceRow" IS NOT NULL`)).rows;
    const targetRows=(await target.query(`SELECT "sourceRow",name FROM inventory_items WHERE "sourceRow" IS NOT NULL`)).rows;
    const targetNames=new Map(targetRows.map(row=>[row.sourceRow,row.name]));
    await target.query('BEGIN');
    for(const row of sourceRows){
      if(targetNames.get(row.sourceRow)===row.name)continue;
      const result=await target.query(`UPDATE inventory_items SET name=$1,"updatedAt"=now() WHERE "sourceRow"=$2`,[row.name,row.sourceRow]);
      renamed+=result.rowCount??0;
    }
    const newRows=(await source.query(`SELECT * FROM inventory_items WHERE "sourceRow" IS NULL AND name=ANY($1::text[])`,[newMaterialNames])).rows;
    for(const row of newRows){
      const result=await target.query(`
        INSERT INTO inventory_items ("groupName",name,sku,unit,"onHandQty","easycanQtyPerBoard","scanboxQtyPerBoard","easyscuQtyPerBoard","purchaseUrl","purchaseLinks",price,location,"minimumStock",note,"sourceSpreadsheetId","sourceSheetName","sourceRow","sourceStockText","sourceSnapshot","isActive")
        SELECT $1::varchar,$2::varchar,$3::text,$4::text,$5,$6,$7,$8,$9::text,$10::jsonb,$11,$12::text,$13,$14::text,$15::text,$16::text,$17,$18::text,$19::jsonb,$20
        WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE lower(name)=lower($2::text))
      `,[row.groupName,row.name,row.sku,row.unit,row.onHandQty,row.easycanQtyPerBoard,row.scanboxQtyPerBoard,row.easyscuQtyPerBoard,row.purchaseUrl,JSON.stringify(row.purchaseLinks??[]),row.price,row.location,row.minimumStock,row.note,row.sourceSpreadsheetId,row.sourceSheetName,row.sourceRow,row.sourceStockText,JSON.stringify(row.sourceSnapshot),row.isActive]);
      created+=result.rowCount??0;
    }
    await target.query('COMMIT');
  }catch(error){await target.query('ROLLBACK');throw error;}
  finally{await source.end();await target.end();}
  process.stdout.write(`Synced ${renamed} titles and created ${created} materials\n`);
}

void run();

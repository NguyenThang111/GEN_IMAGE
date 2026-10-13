import 'dotenv/config';

const { Client } = require('pg') as { Client:new(input:{connectionString:string|undefined})=>{connect():Promise<void>;query(sql:string):Promise<{rows:Array<Record<string,unknown>>}>;end():Promise<void>} };

async function smoke() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tables = await client.query("SELECT to_regclass('inventory_images') AS images, to_regclass('shared_documents') AS documents");
    const material = await client.query("SELECT id, name, \"easyscuQtyPerBoard\" FROM inventory_items WHERE \"isActive\" = true AND lower(trim(name)) = lower('Trở 330R')");
    const bom = await client.query("SELECT line.\"quantityPerProduct\" FROM product_bom_items line JOIN finished_products product ON product.id = line.\"productId\" JOIN inventory_items item ON item.id = line.\"itemId\" WHERE product.sku = 'BOARD-KEYSCAN' AND item.\"isActive\" = true AND lower(trim(item.name)) = lower('Trở 330R')");
    if (!tables.rows[0]?.images || !tables.rows[0]?.documents) throw new Error('Kho upgrade tables are missing');
    if (!material.rows.length || material.rows.some((row) => Number(row.easyscuQtyPerBoard) !== 13)) throw new Error('Inventory 330R quantity is not 13');
    if (!bom.rows.length || bom.rows.some((row) => Number(row.quantityPerProduct) !== 13)) throw new Error('KeyScan BOM 330R quantity is not 13');
    process.stdout.write(JSON.stringify({ tables: tables.rows[0], material330R: material.rows.length, keyscanBom330R: bom.rows.length, quantity: 13 }) + '\n');
  } finally {
    await client.end();
  }
}

void smoke();

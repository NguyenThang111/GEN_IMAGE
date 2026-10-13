import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { InventoryItem } from './inventory-item.entity';
import { InventoryTransaction } from './inventory-transaction.entity';

async function run(){
  const app=await NestFactory.createApplicationContext(AppModule,{logger:['error','warn']});
  const items=app.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem));
  const transactions=app.get<Repository<InventoryTransaction>>(getRepositoryToken(InventoryTransaction));
  const itemResult=await items.createQueryBuilder().update().set({unit:'unit'}).where('unit IS NOT NULL AND unit <> :unit',{unit:'unit'}).execute();
  const transactionResult=await transactions.createQueryBuilder().update().set({unit:'unit'}).where('unit <> :unit',{unit:'unit'}).execute();
  process.stdout.write(`${JSON.stringify({itemsUpdated:itemResult.affected??0,transactionsUpdated:transactionResult.affected??0})}\n`);
  await app.close();
}
void run();

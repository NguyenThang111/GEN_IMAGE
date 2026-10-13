import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../users/user.entity';
import catalog = require('./catalog.kho.json');
import { CatalogImportRecord, InventoryService } from './inventory.service';

async function run(){
  const app=await NestFactory.createApplicationContext(AppModule,{logger:['error','warn']});
  const users=app.get<Repository<User>>(getRepositoryToken(User));
  const admin=await users.findOneByOrFail({username:'admin'});
  const inventory=app.get(InventoryService);
  const result=await inventory.importCatalog(catalog as CatalogImportRecord[],{id:admin.id,username:admin.username,displayName:admin.displayName,role:admin.role});
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await app.close();
}
void run();

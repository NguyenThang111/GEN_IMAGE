import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './inventory-item.entity';
import { InventoryService } from './inventory.service';
import { InventoryTransaction } from './inventory-transaction.entity';
import { InventoryItemAudit } from './inventory-item-audit.entity';
import { PurchaseRequest } from './purchase-request.entity';
import { FinishedProduct } from './finished-product.entity';
import { FinishedProductTransaction } from './finished-product-transaction.entity';
import { ProductBomItem } from './product-bom-item.entity';
import { FinishedProductComponentItem } from './finished-product-component-item.entity';
import { SellableProduct } from './sellable-product.entity';
import { SellableProductBomItem } from './sellable-product-bom-item.entity';
import { SellableProductTransaction } from './sellable-product-transaction.entity';
import { SellableProductMaterialItem } from './sellable-product-material-item.entity';
import { InventoryBomBootstrapService } from './inventory-bom-bootstrap.service';
import { InventoryImage } from './inventory-image.entity';
import { EmailModule } from '../email/email.module';
import { PurchasePaymentLog } from './purchase-payment-log.entity';
import { SystemNotificationsModule } from '../notifications/system-notifications.module';
import { StockCountSheet } from './stock-count-sheet.entity';

@Module({imports:[TypeOrmModule.forFeature([InventoryItem,InventoryTransaction,InventoryItemAudit,PurchaseRequest,PurchasePaymentLog,FinishedProduct,FinishedProductTransaction,ProductBomItem,FinishedProductComponentItem,SellableProduct,SellableProductBomItem,SellableProductMaterialItem,SellableProductTransaction,InventoryImage,StockCountSheet]),TasksModule,EmailModule,SystemNotificationsModule],controllers:[InventoryController],providers:[InventoryService,InventoryBomBootstrapService],exports:[InventoryService]})
export class InventoryModule{}

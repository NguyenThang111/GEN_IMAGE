import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinishedProduct } from '../inventory/finished-product.entity';
import { FinishedProductTransaction } from '../inventory/finished-product-transaction.entity';
import { InventoryItem } from '../inventory/inventory-item.entity';
import { InventoryTransaction } from '../inventory/inventory-transaction.entity';
import { ProductBomItem } from '../inventory/product-bom-item.entity';
import { FinishedProductComponentItem } from '../inventory/finished-product-component-item.entity';
import { SellableProduct } from '../inventory/sellable-product.entity';
import { SellableProductBomItem } from '../inventory/sellable-product-bom-item.entity';
import { SellableProductTransaction } from '../inventory/sellable-product-transaction.entity';
import { SellableProductMaterialItem } from '../inventory/sellable-product-material-item.entity';
import { TasksModule } from '../tasks/tasks.module';
import { User } from '../users/user.entity';
import { ProductionController } from './production.controller';
import { ProductionEntry } from './production-entry.entity';
import { ProductionService } from './production.service';
import { ProductionWorkSession } from './production-work-session.entity';
import { ProductionPaymentRequest } from './production-payment-request.entity';
import { ProductionNotification } from './production-notification.entity';
import { SystemNotificationsModule } from '../notifications/system-notifications.module';
import { ProductionRun } from './production-run.entity';
import { ProductionLot } from './production-lot.entity';
import { ProductionEntryLot } from './production-entry-lot.entity';
import { ProductionLotEvent } from './production-lot-event.entity';
import { ProductionLotAssignee } from './production-lot-assignee.entity';
import { DeviceTestProfile } from '../device-test/device-test-profile.entity';
import { ProductionLotDeviceTest } from '../device-test/production-lot-device-test.entity';

@Module({imports:[TypeOrmModule.forFeature([ProductionWorkSession,ProductionEntry,ProductionPaymentRequest,ProductionNotification,ProductionRun,ProductionLot,ProductionLotAssignee,ProductionEntryLot,ProductionLotEvent,DeviceTestProfile,ProductionLotDeviceTest,User,InventoryItem,InventoryTransaction,FinishedProduct,FinishedProductTransaction,ProductBomItem,FinishedProductComponentItem,SellableProduct,SellableProductBomItem,SellableProductMaterialItem,SellableProductTransaction]),TasksModule,SystemNotificationsModule],controllers:[ProductionController],providers:[ProductionService],exports:[ProductionService]})
export class ProductionModule{}

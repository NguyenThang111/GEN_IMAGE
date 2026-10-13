import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { Task } from './tasks/task.entity';
import { TaskAssignee } from './tasks/task-assignee.entity';
import { TaskEvent } from './tasks/task-event.entity';
import { TaskComment } from './tasks/task-comment.entity';
import { TaskCommentMention } from './tasks/task-comment-mention.entity';
import { TaskCriterion } from './tasks/task-criterion.entity';
import { TaskDraft } from './tasks/task-draft.entity';
import { TaskNotification } from './tasks/task-notification.entity';
import { TasksModule } from './tasks/tasks.module';
import { InventoryItem } from './inventory/inventory-item.entity';
import { InventoryTransaction } from './inventory/inventory-transaction.entity';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryItemAudit } from './inventory/inventory-item-audit.entity';
import { PurchaseRequest } from './inventory/purchase-request.entity';
import { PurchasePaymentLog } from './inventory/purchase-payment-log.entity';
import { FinishedProduct } from './inventory/finished-product.entity';
import { FinishedProductTransaction } from './inventory/finished-product-transaction.entity';
import { ProductBomItem } from './inventory/product-bom-item.entity';
import { FinishedProductComponentItem } from './inventory/finished-product-component-item.entity';
import { SellableProduct } from './inventory/sellable-product.entity';
import { SellableProductBomItem } from './inventory/sellable-product-bom-item.entity';
import { SellableProductTransaction } from './inventory/sellable-product-transaction.entity';
import { SellableProductMaterialItem } from './inventory/sellable-product-material-item.entity';
import { ProductionModule } from './production/production.module';
import { ProductionEntry } from './production/production-entry.entity';
import { ProductionRun } from './production/production-run.entity';
import { ProductionLot } from './production/production-lot.entity';
import { ProductionEntryLot } from './production/production-entry-lot.entity';
import { ProductionLotEvent } from './production/production-lot-event.entity';
import { ProductionLotAssignee } from './production/production-lot-assignee.entity';
import { ProductionWorkSession } from './production/production-work-session.entity';
import { ProductionPaymentRequest } from './production/production-payment-request.entity';
import { ProductionNotification } from './production/production-notification.entity';
import { EmailModule } from './email/email.module';
import { EmailOutbox } from './email/email-outbox.entity';
import { InventoryImage } from './inventory/inventory-image.entity';
import { SharedDocument } from './documents/shared-document.entity';
import { SharedDocumentsModule } from './documents/shared-documents.module';
import { SystemNotification } from './notifications/system-notification.entity';
import { SystemNotificationsModule } from './notifications/system-notifications.module';
import { Worklog } from './worklogs/worklog.entity';
import { WorklogComment } from './worklogs/worklog-comment.entity';
import { WorklogCommentMention } from './worklogs/worklog-comment-mention.entity';
import { WorklogWeek } from './worklogs/worklog-week.entity';
import { WorklogsModule } from './worklogs/worklogs.module';
import { WarrantyCase } from './warranty/warranty-case.entity';
import { WarrantyModule } from './warranty/warranty.module';
import { ActivationCode } from './activation/activation.entity';
import { ActivationModule } from './activation/activation.module';
import { StockCountSheet } from './inventory/stock-count-sheet.entity';
import { DiagramAiModule } from './diagram-ai/diagram-ai.module';
import { DiagramProjectsModule } from './diagram-projects/diagram-projects.module';
import { DiagramProject } from './diagram-projects/diagram-project.entity';
import { DiagramCircuit } from './diagram-projects/diagram-circuit.entity';
import { DeviceTestModule } from './device-test/device-test.module';
import { DeviceTestStation } from './device-test/device-test-station.entity';
import { ProductionLotDeviceTest } from './device-test/production-lot-device-test.entity';
import { DeviceTestProfile } from './device-test/device-test-profile.entity';
import { DeviceTestLotRelease } from './device-test/device-test-lot-release.entity';
import { PcbLayout } from './pcb-layouts/pcb-layout.entity';
import { PcbLayoutsModule } from './pcb-layouts/pcb-layouts.module';
import { PerformanceModule } from './performance/performance.module';
import { PerformancePeriod, PerformancePlan, PerformanceAttestation } from './performance/performance.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api*'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [PerformancePeriod, PerformancePlan, PerformanceAttestation, ActivationCode, User, Task, TaskAssignee, TaskCriterion, TaskDraft, TaskEvent, TaskComment, TaskCommentMention, TaskNotification, SystemNotification, EmailOutbox, InventoryItem, InventoryTransaction, InventoryItemAudit, PurchaseRequest, PurchasePaymentLog, InventoryImage, FinishedProduct, FinishedProductTransaction, ProductBomItem, FinishedProductComponentItem, SellableProduct, SellableProductBomItem, SellableProductMaterialItem, SellableProductTransaction, StockCountSheet, SharedDocument, ProductionEntry, ProductionRun, ProductionLot, ProductionLotAssignee, ProductionEntryLot, ProductionLotEvent, ProductionWorkSession, ProductionPaymentRequest, ProductionNotification, Worklog, WorklogWeek, WorklogComment, WorklogCommentMention, WarrantyCase, DiagramProject, DiagramCircuit, DeviceTestStation, DeviceTestProfile, ProductionLotDeviceTest, DeviceTestLotRelease, PcbLayout],
        synchronize: config.get('DATABASE_SYNCHRONIZE') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    TasksModule,
    SystemNotificationsModule,
    EmailModule,
    InventoryModule,
    SharedDocumentsModule,
    ProductionModule,
    WorklogsModule,
    PerformanceModule,
    WarrantyModule,
    ActivationModule,
    DiagramAiModule,
    DiagramProjectsModule,
    DeviceTestModule,
    PcbLayoutsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

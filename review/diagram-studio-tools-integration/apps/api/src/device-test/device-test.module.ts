import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionModule } from '../production/production.module';
import { ProductionLot } from '../production/production-lot.entity';
import { DeviceTestController } from './device-test.controller';
import { DeviceTestService } from './device-test.service';
import { DeviceTestStation } from './device-test-station.entity';
import { ProductionLotDeviceTest } from './production-lot-device-test.entity';
import { StationAuthGuard } from './station-auth.guard';
import { DeviceTestProfile } from './device-test-profile.entity';
import { TasksModule } from '../tasks/tasks.module';
import { DeviceTestLotRelease } from './device-test-lot-release.entity';

@Module({
  imports:[TypeOrmModule.forFeature([DeviceTestStation,DeviceTestProfile,ProductionLotDeviceTest,DeviceTestLotRelease,ProductionLot]),ProductionModule,TasksModule],
  controllers:[DeviceTestController],
  providers:[DeviceTestService,StationAuthGuard],
})
export class DeviceTestModule{}

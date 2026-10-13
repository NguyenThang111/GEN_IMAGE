import 'reflect-metadata';
import { DynamicModule, FactoryProvider } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TYPEORM_MODULE_OPTIONS } from '@nestjs/typeorm/dist/typeorm.constants';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AppModule } from './app.module';
import { DeviceTestLotRelease } from './device-test/device-test-lot-release.entity';

class MetadataDataSource extends DataSource {
  buildMetadataForTest() { return this.buildMetadatas(); }
}

describe('application database registration', () => {
  it('builds release repository metadata from the actual root configuration without connecting', async () => {
    const imports: DynamicModule[] = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
    const root = imports.find(entry => entry.module === TypeOrmModule)!;
    const core = root.imports![0] as DynamicModule;
    const options = core.providers!.find(provider =>
      typeof provider === 'object' && 'provide' in provider && provider.provide === TYPEORM_MODULE_OPTIONS,
    ) as FactoryProvider<DataSourceOptions>;
    const source = new MetadataDataSource(await options.useFactory(new ConfigService({})));
    await source.buildMetadataForTest();

    expect(source.isInitialized).toBe(false);
    const metadata = source.getMetadata(DeviceTestLotRelease);
    expect(metadata.tableName).toBe('device_test_lot_releases');
    expect(metadata.indices.some(index => index.isUnique &&
      index.columns.map(column => column.propertyName).join(',') === 'stationId,releaseRequestId',
    )).toBe(true);
  });
});

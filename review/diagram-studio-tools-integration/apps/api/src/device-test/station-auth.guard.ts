import { CanActivate, GoneException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DeviceTestStation } from './device-test-station.entity';

export type StationRequest=Request&{station:DeviceTestStation};

@Injectable()
export class StationAuthGuard implements CanActivate {
  canActivate():boolean{
    throw new GoneException({code:'DEVICE_TEST_RETIRED',message:'Test Cloud/ESP32 đã ngừng. Nhận Test và nhập kết quả trên Auto2Tech.'});
  }
}

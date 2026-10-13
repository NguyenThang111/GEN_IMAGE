import { GoneException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DeviceTestController } from './device-test.controller';
import { StationAuthGuard } from './station-auth.guard';

describe('retired Device Test API',()=>{
  it('blocks all controller routes before service calls or station writes',()=>{
    expect(Reflect.getMetadata(GUARDS_METADATA,DeviceTestController)).toContain(StationAuthGuard);
    const guard=new StationAuthGuard();
    try { guard.canActivate(); throw new Error('Expected rejection'); }
    catch(error){
      expect(error).toBeInstanceOf(GoneException);
      expect((error as GoneException).getStatus()).toBe(410);
      expect((error as GoneException).getResponse()).toMatchObject({code:'DEVICE_TEST_RETIRED'});
    }
  });
});

import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { DeviceTestService } from './device-test.service';
import { ListDeviceTestLotsDto, ReleaseDeviceTestLotDto, SubmitDeviceTestResultDto } from './device-test.dto';
import { StationAuthGuard, StationRequest } from './station-auth.guard';

@UseGuards(StationAuthGuard)
@Controller('device-test')
export class DeviceTestController {
  constructor(private readonly deviceTests:DeviceTestService){}
  @Get('lots') lots(@Query(new ValidationPipe({transform:true,whitelist:true}))query:ListDeviceTestLotsDto,@Req()req:StationRequest){return this.deviceTests.findLots(req.station,query);}
  @Get('active-lot') activeLot(@Req()req:StationRequest){return this.deviceTests.findActiveLot(req.station);}
  @Post('lots/:lotId/claim') claim(@Param('lotId')lotId:string,@Req()req:StationRequest){return this.deviceTests.claim(lotId,req.station);}
  @Post('lots/:lotId/results') result(@Param('lotId')lotId:string,@Body(new ValidationPipe({whitelist:true,transform:true,exceptionFactory:errors=>new BadRequestException({code:errors.some(error=>error.property==='result')?'INVALID_TEST_RESULT':'INVALID_REQUEST',message:'Device test result payload is invalid'})}))dto:SubmitDeviceTestResultDto,@Req()req:StationRequest){return this.deviceTests.submitResult(lotId,dto,req.station);}
  @Post('lots/:lotId/release') release(@Param('lotId')lotId:string,@Body(new ValidationPipe({whitelist:true,transform:true,exceptionFactory:()=>new BadRequestException({code:'INVALID_REQUEST',message:'Device test release payload is invalid'})}))dto:ReleaseDeviceTestLotDto,@Req()req:StationRequest){return this.deviceTests.release(lotId,dto,req.station);}
}

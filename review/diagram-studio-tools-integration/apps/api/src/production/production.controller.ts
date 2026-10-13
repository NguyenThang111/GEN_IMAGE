import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateProductionEntryDto, CreateProductionRunDto, FinishProductionDto, ProductionLotQuantityDto, ProductionTestResultDto, UpdateProductionLotDto, UpdateProductionLotNoteDto, UpsertWorkSessionDto } from './production.dto';
import { ProductionService } from './production.service';

type AuthRequest=Request&{user:AuthUser};
@UseGuards(JwtAuthGuard)
@Controller('production')
export class ProductionController{
  constructor(private readonly production:ProductionService){}
  @Get('notifications') notifications(@Req()req:AuthRequest){return this.production.findNotifications(req.user);}
  @Patch('notifications/read-all') readAllNotifications(@Req()req:AuthRequest){return this.production.readAllNotifications(req.user);}
  @Patch('notifications/:id/read') readNotification(@Param('id')id:string,@Req()req:AuthRequest){return this.production.readNotification(id,req.user);}
  @Get('overview') overview(@Req()req:AuthRequest,@Query('from')from?:string,@Query('to')to?:string){return this.production.overview(from,to,req.user);}
  @Get('lots') lots(@Query('includeDone')includeDone?:string){return this.production.findLots(includeDone==='true');}
  @Post('runs') run(@Body()dto:CreateProductionRunDto,@Req()req:AuthRequest){return this.production.createRun(dto,req.user);}
  @Post('lots/:id/claim') claim(@Param('id')id:string,@Req()req:AuthRequest){return this.production.claimLot(id,req.user);}
  @Post('lots/:id/pause') pause(@Param('id')id:string,@Req()req:AuthRequest){return this.production.pauseLot(id,req.user);}
  @Post('lots/:id/finish-production') finishProduction(@Param('id')id:string,@Body()dto:FinishProductionDto,@Req()req:AuthRequest){return this.production.finishProduction(id,dto,req.user);}
  @Post('lots/:id/claim-test') claimTest(@Param('id')id:string,@Req()req:AuthRequest){return this.production.claimTest(id,req.user);}
  @Post('lots/:id/publish-device-test') publishDeviceTest(@Param('id')id:string,@Req()req:AuthRequest){return this.production.publishDeviceTest(id,req.user);}
  @Post('lots/:id/test-result') testResult(@Param('id')id:string,@Body()dto:ProductionTestResultDto,@Req()req:AuthRequest){return this.production.completeTest(id,dto,req.user);}
  @Post('lots/:id/test') test(@Param('id')id:string,@Req()req:AuthRequest){return this.production.testLot(id,req.user);}
  @Patch('lots/:id/note') note(@Param('id')id:string,@Body()dto:UpdateProductionLotNoteDto,@Req()req:AuthRequest){return this.production.updateLotNote(id,dto,req.user);}
  @Patch('lots/:id') updateLot(@Param('id')id:string,@Body()dto:UpdateProductionLotDto,@Req()req:AuthRequest){return this.production.updateLot(id,dto,req.user);}
  @Post('lots/:id/preview') preview(@Param('id')id:string,@Body()dto:ProductionLotQuantityDto){return this.production.previewLot(id,dto);}
  @Post('lots/:id/done') done(@Param('id')id:string,@Body()dto:ProductionLotQuantityDto,@Req()req:AuthRequest){return this.production.completeLot(id,dto,req.user);}
  @Post('lots/:id/undo') undo(@Param('id')id:string,@Req()req:AuthRequest){return this.production.undoLot(id,req.user);}
  @Post('lots/:id/delete-preview') deletePreview(@Param('id')id:string,@Req()req:AuthRequest){return this.production.previewDeleteLot(id,req.user);}
  @Delete('lots/:id') deleteLot(@Param('id')id:string,@Req()req:AuthRequest){return this.production.deleteLot(id,req.user);}
  @Post('sessions') session(@Body()dto:UpsertWorkSessionDto,@Req()req:AuthRequest){return this.production.upsertSession(dto,req.user);}
  @Post('entries') entry(@Body()dto:CreateProductionEntryDto,@Req()req:AuthRequest){return this.production.createEntry(dto,req.user);}
  @Patch('entries/:id') updateEntry(@Param('id')id:string,@Body()dto:CreateProductionEntryDto,@Req()req:AuthRequest){return this.production.updateEntry(id,dto,req.user);}
  @Patch('payment-requests/:id/paid') paid(@Param('id')id:string,@Req()req:AuthRequest){return this.production.markPaid(id,req.user);}
}

import { Body, Controller, Get, Param, Patch, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { UpdatePcbLayoutProgressDto } from './pcb-layout.dto';
import { PcbLayoutsService } from './pcb-layouts.service';

type AuthRequest=Request&{user:AuthUser};
@UseGuards(JwtAuthGuard) @Controller('pcb-layouts')
export class PcbLayoutsController{
  constructor(private readonly layouts:PcbLayoutsService){}
  @Get() list(){return this.layouts.list();}
  @Get(':product/html') async html(@Param('product') product:string,@Res() response:Response){response.type('text/html').setHeader('Cache-Control','private, no-store').send(await this.layouts.html(product));}
  @Put(':product') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:5*1024*1024}})) upload(@Param('product') product:string,@UploadedFile() file:Express.Multer.File|undefined,@Req() req:AuthRequest){return this.layouts.upload(product,file,req.user);}
  @Patch(':product/progress') progress(@Param('product') product:string,@Body() dto:UpdatePcbLayoutProgressDto,@Req() req:AuthRequest){return this.layouts.updateProgress(product,dto,req.user);}
}

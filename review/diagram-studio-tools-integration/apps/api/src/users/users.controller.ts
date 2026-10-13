import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { UpdateUserEmailDto } from './user.dto';
import { UsersService } from './users.service';

type AuthRequest = Request & { user: AuthUser };
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() findActive() { return this.users.findActive(); }
  @Put(':id/avatar') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:3*1024*1024,files:1}}))
  uploadAvatar(@Param('id',ParseUUIDPipe) id:string,@UploadedFile() file:{buffer:Buffer;mimetype:string;size:number}|undefined,@Req() req:AuthRequest){return this.users.uploadAvatar(id,file,req.user);}
  @Patch(':id/email') updateEmail(@Param('id') id: string, @Body() dto: UpdateUserEmailDto, @Req() req: AuthRequest) { return this.users.updateEmail(id, dto.email ?? null, req.user); }
}

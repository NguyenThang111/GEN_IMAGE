import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateWorklogCommentDto, SaveWorklogDto, SaveWorklogWeekDto, ScoreWorklogDto } from './worklog.dto';
import { WorklogsService } from './worklogs.service';

type AuthRequest = Request & { user: AuthUser };

@UseGuards(JwtAuthGuard)
@Controller('worklogs')
export class WorklogsController {
  constructor(private readonly worklogs: WorklogsService) {}
  @Get() dashboard(@Query('month') month?: string, @Query('sprintStart') sprintStart?: string) { return this.worklogs.dashboard(month, sprintStart); }
  @Patch('weeks/:weekStart') updateWeek(@Param('weekStart') weekStart: string, @Body() dto: SaveWorklogWeekDto, @Req() req: AuthRequest) { return this.worklogs.updateWeek(weekStart, dto, req.user); }
  @Post('weeks/:weekStart/close') closeWeek(@Param('weekStart') weekStart: string, @Req() req: AuthRequest) { return this.worklogs.closeWeek(weekStart, req.user); }
  @Post('weeks/:weekStart/reopen') reopenWeek(@Param('weekStart') weekStart: string, @Req() req: AuthRequest) { return this.worklogs.reopenWeek(weekStart, req.user); }
  @Get(':id') detail(@Param('id') id: string) { return this.worklogs.detail(id); }
  @Get('comments/:commentId/image') async commentImage(@Param('commentId') commentId: string, @Res() response: Response) {
    const image = await this.worklogs.commentImage(commentId);
    response.type(image.mimeType).setHeader('Cache-Control', 'private, max-age=3600').send(image.data);
  }
  @Post() create(@Body() dto: SaveWorklogDto, @Req() req: AuthRequest) { return this.worklogs.create(dto, req.user); }
  @Post(':id/comments') @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  comment(@Param('id') id: string, @Body() dto: CreateWorklogCommentDto, @UploadedFile() image: Express.Multer.File | undefined, @Req() req: AuthRequest) {
    if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.mimetype)) throw new BadRequestException('Ảnh phải là JPEG, PNG hoặc WebP');
    return this.worklogs.comment(id, dto, req.user, image);
  }
  @Post(':id/tasks/:taskId/review') requestTaskReview(@Param('id') id: string, @Param('taskId') taskId: string, @Req() req: AuthRequest) { return this.worklogs.requestTaskReview(id, taskId, req.user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: SaveWorklogDto, @Req() req: AuthRequest) { return this.worklogs.update(id, dto, req.user); }
  @Patch(':id/point') score(@Param('id') id: string, @Body() dto: ScoreWorklogDto, @Req() req: AuthRequest) { return this.worklogs.score(id, dto, req.user); }
  @Patch(':id/stability') confirmStability(@Param('id') id: string, @Req() req: AuthRequest) { return this.worklogs.confirmStability(id, req.user); }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: AuthRequest) { return this.worklogs.remove(id, req.user); }
}

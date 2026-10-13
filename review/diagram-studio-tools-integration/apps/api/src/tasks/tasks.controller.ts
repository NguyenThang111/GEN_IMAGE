import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { CreateTaskCommentDto, CreateTaskDraftDto, CreateTaskDto, FailTaskReviewDto, ReviewTaskDto, TaskScoreboardQueryDto, UpdateTaskDraftDto, UpdateTaskDto, UpdateTaskPriorityDto, UpdateTaskStatusDto } from './task.dto';
import { TasksService } from './tasks.service';

type AuthRequest = Request & { user: AuthUser };
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get('trash') trash() { return this.tasks.findTrash(); }
  @Get('truck') truck() { return this.tasks.findTruck(); }
  @Get('notifications') notifications(@Req() req: AuthRequest) { return this.tasks.findNotifications(req.user); }
  @Patch('notifications/read-all') readAllNotifications(@Req() req: AuthRequest) { return this.tasks.readAllNotifications(req.user); }
  @Patch('notifications/:id/read') readNotification(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.readNotification(id, req.user); }
  @Get('drafts') drafts() { return this.tasks.findDrafts(); }
  @Post('drafts') createDraft(@Body() dto: CreateTaskDraftDto, @Req() req: AuthRequest) { return this.tasks.createDraft(dto, req.user); }
  @Patch('drafts/:id') updateDraft(@Param('id') id: string, @Body() dto: UpdateTaskDraftDto, @Req() req: AuthRequest) { return this.tasks.updateDraft(id, dto, req.user); }
  @Patch('drafts/:id/priority') setDraftPriority(@Param('id') id: string, @Body() dto: UpdateTaskPriorityDto, @Req() req: AuthRequest) { return this.tasks.setDraftPriority(id, dto.priority, req.user); }
  @Post('drafts/:id/promote') promoteDraft(@Param('id') id: string, @Body() dto: CreateTaskDto, @Req() req: AuthRequest) { return this.tasks.promoteDraft(id, dto, req.user); }
  @Post('drafts/:id/claim') claimDraft(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.claimDraft(id, req.user); }
  @Delete('drafts/:id') removeDraft(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.removeDraft(id, req.user); }
  @Get('scoreboard') scoreboard(@Query() query: TaskScoreboardQueryDto) { return this.tasks.scoreboard(query.month); }
  @Get(':id/detail') detail(@Param('id') id: string) { return this.tasks.detail(id); }
  @Get('comments/:commentId/image') async commentImage(@Param('commentId') commentId: string, @Res() response: Response) {
    const image = await this.tasks.commentImage(commentId);
    response.type(image.mimeType).setHeader('Cache-Control', 'private, max-age=3600').send(image.data);
  }
  @Post(':id/comments') @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  comment(@Param('id') id: string, @Body() dto: CreateTaskCommentDto, @UploadedFile() image: Express.Multer.File | undefined, @Req() req: AuthRequest) {
    if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.mimetype)) throw new BadRequestException('Ảnh phải là JPEG, PNG hoặc WebP');
    return this.tasks.comment(id, dto, req.user, image);
  }
  @Post() create(@Body() dto: CreateTaskDto, @Req() req: AuthRequest) { return this.tasks.create(dto, req.user); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: AuthRequest) { return this.tasks.update(id, dto, req.user); }
  @Patch(':id/status') setStatus(@Param('id') id: string, @Body() dto: UpdateTaskStatusDto, @Req() req: AuthRequest) { return this.tasks.setStatus(id, dto.status, req.user); }
  @Patch(':id/priority') setPriority(@Param('id') id: string, @Body() dto: UpdateTaskPriorityDto, @Req() req: AuthRequest) { return this.tasks.setPriority(id, dto.priority, req.user); }
  @Post(':id/done') done(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.done(id, req.user); }
  @Post(':id/backlog') backlog(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.moveToBacklog(id, req.user); }
  @Post(':id/start') start(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.start(id, req.user); }
  @Post(':id/request-review') requestReview(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.requestReview(id, req.user); }
  @Post(':id/reopen') reopen(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.reopen(id, req.user); }
  @Post(':id/risk') risk(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.reportRisk(id, req.user); }
  @Post(':id/review') review(@Param('id') id: string, @Body() dto: ReviewTaskDto, @Req() req: AuthRequest) { return this.tasks.review(id, dto, req.user); }
  @Post(':id/review-failed') failReview(@Param('id') id: string, @Body() dto: FailTaskReviewDto, @Req() req: AuthRequest) { return this.tasks.failReview(id, dto, req.user); }
  @Post(':id/review-pending') resetReview(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.resetReview(id, req.user); }
  @Post(':id/complete') complete(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.complete(id, req.user); }
  @Post(':id/undo-complete') undoComplete(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.undoComplete(id, req.user); }
  @Delete(':id') remove(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.remove(id, req.user); }
  @Post(':id/archive') archive(@Param('id') id: string, @Req() req: AuthRequest) { return this.tasks.archive(id, req.user); }
}

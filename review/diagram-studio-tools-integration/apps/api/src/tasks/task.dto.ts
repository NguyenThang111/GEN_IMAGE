import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { TaskStatus } from './task.entity';
import { TaskPriority } from './task-priority';

export class UpdateTaskPriorityDto {
  @IsIn(Object.values(TaskPriority)) priority!: TaskPriority;
}

export const ADMIN_TASK_STATUSES = [TaskStatus.BACKLOG, TaskStatus.ACTIVE, TaskStatus.DONE, TaskStatus.COMPLETE];
export class UpdateTaskStatusDto {
  @IsIn(ADMIN_TASK_STATUSES) status!: TaskStatus;
}

export class TaskPointFactorsDto {
  @IsInt() @Min(0) @Max(2) outputScope!: number;
  @IsInt() @Min(0) @Max(2) complexity!: number;
  @IsInt() @Min(0) @Max(2) uncertainty!: number;
  @IsInt() @Min(0) @Max(2) risk!: number;
  @IsInt() @Min(0) @Max(2) verification!: number;
}

export class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(240) title!: string;
  @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID('4', { each: true }) assigneeIds!: string[];
  @IsString() @MinLength(1) @MaxLength(2000) note!: string;
  @IsOptional() @IsString() @MaxLength(2000) suggestion?: string | null;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) @MaxLength(500, { each: true }) criteria!: string[];
}

export class CreateTaskDraftDto {
  @IsString() @MinLength(1) @MaxLength(80) topic!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) assigneeIds: string[] = [];
  @IsOptional() @IsDateString({ strict: true }) dueDate?: string;
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsString({ each: true }) @MaxLength(500, { each: true }) criteria?: string[];
  @IsOptional() @ValidateNested() @Type(() => TaskPointFactorsDto) pointFactors?: TaskPointFactorsDto;
}

export class ClaimTaskDraftDto {}

export class UpdateTaskDraftDto {
  @IsString() @MinLength(1) @MaxLength(80) topic!: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsString() @MaxLength(2000) suggestion!: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) assigneeIds!: string[];
  @IsArray() @IsString({ each: true }) @MaxLength(500, { each: true }) criteria!: string[];
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(240) title?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) note?: string;
  @IsOptional() @IsString() @MaxLength(2000) suggestion?: string | null;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsString({ each: true }) @MaxLength(500, { each: true }) criteria?: string[];
}

export class ReviewTaskDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) passedCriterionIds!: string[];
}

export class FailTaskReviewDto {
  @IsOptional() @IsString() @MaxLength(4000) reason?: string;
}

export class TaskScoreboardQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
}

export class CreateTaskCommentDto {
  @IsOptional() @IsString() @MaxLength(4000) body = '';
  @Transform(({value})=>typeof value==='string'?JSON.parse(value):value)
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) mentionedUserIds: string[] = [];
}

import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { WorklogStatus, WorklogType, WorklogValueLevel } from './worklog.entity';

export class WorklogOutputCriterionDto {
  @IsString() @MinLength(1) @MaxLength(80) id!: string;
  @IsString() @MinLength(1) @MaxLength(500) expected!: string;
  @IsOptional() @IsString() @MaxLength(1000) actual?: string;
  @IsOptional() @IsBoolean() achieved?: boolean;
}

export class SaveWorklogDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() primaryTaskId?: string;
  @IsArray() @ArrayUnique() @ArrayMaxSize(10) @IsUUID('4', { each: true }) taskIds!: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => WorklogOutputCriterionDto) outputCriteria?: WorklogOutputCriterionDto[];
  @IsString() @MinLength(1) @MaxLength(500) input!: string;
  @IsDateString() startedAt!: string;
  @IsOptional() @IsString() @MaxLength(1000) output?: string;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(50) @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true }) links?: string[];
  @IsOptional() @IsDateString() endedAt?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(24) hoursWorked?: number;
  @IsIn(Object.values(WorklogValueLevel)) valueLevel!: WorklogValueLevel;
  @IsOptional() @IsIn(Object.values(WorklogType)) workType?: WorklogType;
  @IsOptional() @IsUUID() reopenedWorklogId?: string;
  @IsIn(Object.values(WorklogStatus)) status!: WorklogStatus;
}

export class ScoreWorklogDto {
  @IsIn(Object.values(WorklogValueLevel)) valueLevel!: WorklogValueLevel;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.25) @Max(24) standardHours!: number;
  @IsIn([0, 0.6, 1]) completionRate!: number;
  @IsOptional() @IsBoolean() stabilityConfirmed?: boolean;
}

export class CreateWorklogCommentDto {
  @IsOptional() @IsString() @MaxLength(4000) body = '';
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? JSON.parse(value) : value) @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) mentionedUserIds: string[] = [];
}

export class SaveWorklogWeekDto {
  @IsString() @MaxLength(2000) goal!: string;
}

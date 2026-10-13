import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { DeviceTestResult } from './production-lot-device-test.entity';

export class SubmitDeviceTestResultDto {
  @IsString() @MaxLength(100) @Matches(/^[A-Za-z0-9._:-]+$/) testRunId!: string;
  @IsString() @MaxLength(80) @Matches(/^[A-Z0-9_]+$/) testProfileKey!: string;
  @IsInt() @Min(1) testProfileVersion!: number;
  @IsEnum(DeviceTestResult) result!: DeviceTestResult;
  @IsDateString() testedAt!: string;
  @IsOptional() @IsObject() measurements?: Record<string, unknown> | null;
}

export class ListDeviceTestLotsDto {
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(20) limit?: number;
}

export class ReleaseDeviceTestLotDto {
  @IsString() @MaxLength(100) @Matches(/^[A-Za-z0-9._:-]+$/) releaseRequestId!: string;
}

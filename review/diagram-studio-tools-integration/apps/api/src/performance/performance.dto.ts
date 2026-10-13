import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsNumber, IsString, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';

export class CreatePerformancePeriodDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) effectiveDate!: string;
  @IsInt() @Min(1) @Max(1000000) targetPoint!: number;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2) @ArrayUnique() @IsUUID('4', { each: true }) memberIds!: string[];
}
class PerformanceShareDto {
  @IsUUID('4') userId!: string;
  @IsInt() @Min(1) @Max(100) percent!: number;
}
export class CreatePerformancePlanDto {
  @IsUUID('4') taskId!: string;
  @IsInt() @Min(1) @Max(1000000) point!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(10000) standardHours!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2) @ValidateNested({ each: true }) @Type(() => PerformanceShareDto) shares!: PerformanceShareDto[];
}
export class AttestPerformanceDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) fingerprint!: string;
}

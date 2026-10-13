import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { ProductionModule, ProductionOutputType } from './production-entry.entity';
import { ProductionLotActionType, ProductionLotStatus } from './production-lot.entity';

export class UpsertWorkSessionDto {
  @IsUUID() userId!: string;
  @IsDateString() workDate!: string;
  @IsBoolean() isRegistered!: boolean;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ bắt đầu phải có dạng HH:mm (00:00–23:59)' }) plannedStartTime?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(24) hoursWorked?: number | null;
}

export class ProductionReportItemDto {
  @IsUUID() lotId!: string;
  @IsIn(['ASSEMBLE','SOLDER','PACK','TEST','OTHER']) stage!: 'ASSEMBLE'|'SOLDER'|'PACK'|'TEST'|'OTHER';
  @IsInt() @Min(1) quantity!: number;
  @IsIn(['PASSED','FAILED','IN_PROGRESS']) result!: 'PASSED'|'FAILED'|'IN_PROGRESS';
  @IsOptional() @IsString() note?: string;
}

export class CreateProductionEntryDto {
  @IsUUID() userId!: string;
  @IsDateString() workDate!: string;
  @IsEnum(ProductionModule) module!: ProductionModule;
  @IsString() @MinLength(1) workType!: string;
  @IsEnum(ProductionOutputType) outputType!: ProductionOutputType;
  @IsOptional() @IsUUID() outputId?: string | null;
  @IsString() @MinLength(1) outputLabel!: string;
  @IsOptional() @IsInt() @Min(0) quantity?: number | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) progressPercent?: number | null;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() rawText?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({each:true}) @Type(()=>ProductionReportItemDto) reportItems?: ProductionReportItemDto[];
  @IsOptional() @IsBoolean() needsReview?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('4',{each:true}) lotIds?: string[];
}

export class CreateProductionLotDto {
  @IsEnum(ProductionLotActionType) actionType!: ProductionLotActionType;
  @IsEnum(ProductionOutputType) outputType!: ProductionOutputType;
  @IsUUID() outputId!: string;
  @IsInt() @Min(1) targetQuantity!: number;
}

export class CreateProductionRunDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({each:true}) @Type(()=>CreateProductionLotDto) lots!: CreateProductionLotDto[];
}

export class ProductionLotQuantityDto {
  @IsInt() @Min(1) quantity!: number;
}

export class FinishProductionDto extends ProductionLotQuantityDto {
  @IsOptional() @IsDateString() workStartedAt?: string;
  @IsOptional() @IsDateString() workEndedAt?: string;
}

export class UpdateProductionLotDto {
  @IsOptional() @IsInt() @Min(1) targetQuantity?: number;
  @IsOptional() @IsInt() @Min(0) producedQuantity?: number;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsEnum(ProductionLotStatus) status?: ProductionLotStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsUUID('4',{each:true}) participantIds?: string[];
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() @MaxLength(80) @Matches(/^[A-Z0-9_]+$/) testProfileKey?: string;
  @IsOptional() @IsInt() @Min(1) testProfileVersion?: number;
}

export class ProductionTestResultDto {
  @IsInt() @Min(1) testedQuantity!: number;
  @IsInt() @Min(0) passedQuantity!: number;
  @IsInt() @Min(0) failedQuantity!: number;
  @IsOptional() @IsString() note?: string;
}

export class UpdateProductionLotNoteDto {
  @IsString() note!: string;
}

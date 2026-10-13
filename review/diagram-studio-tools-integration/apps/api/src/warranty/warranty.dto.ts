import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { WarrantyStatus } from './warranty-case.entity';

export class CreateWarrantyCaseDto {
  @IsString() @MinLength(1) @MaxLength(160) customerReference!: string;
  @IsOptional() @IsString() @MaxLength(160) customerName?: string;
  @IsOptional() @IsString() @MaxLength(320) customerAddress?: string;
  @IsOptional() @IsString() @MaxLength(120) shippingCarrier?: string;
  @IsString() @MinLength(1) @MaxLength(120) productName!: string;
  @IsString() @MinLength(1) @MaxLength(240) receivedItems!: string;
  @IsString() @MinLength(1) @MaxLength(2000) issue!: string;
  @IsOptional() @IsString() @MaxLength(3000) repairResult?: string;
  @IsOptional() @IsEnum(WarrantyStatus) status?: WarrantyStatus;
  @IsOptional() @IsBoolean() isChargeable?: boolean;
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

export class UpdateWarrantyCaseDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) customerReference?: string;
  @IsOptional() @IsString() @MaxLength(160) customerName?: string;
  @IsOptional() @IsString() @MaxLength(320) customerAddress?: string;
  @IsOptional() @IsString() @MaxLength(120) shippingCarrier?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) productName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(240) receivedItems?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) issue?: string;
  @IsOptional() @IsString() @MaxLength(3000) repairResult?: string;
  @IsOptional() @IsEnum(WarrantyStatus) status?: WarrantyStatus;
  @IsOptional() @IsBoolean() isChargeable?: boolean;
  @IsOptional() @IsUUID() assigneeId?: string | null;
}

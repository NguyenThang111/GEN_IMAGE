import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { DiagramCircuitStatus } from './diagram-circuit.entity';

export class DiagramCircuitInputDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 100) circuitKey!: string;
  @IsString() @Length(1, 180) circuitTitle!: string;
  @IsOptional() @IsBoolean() required?: boolean;
}
export class CreateDiagramProjectDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 120) vehicleId!: string;
  @IsString() @Length(1, 180) vehicleTitle!: string;
  @IsOptional() @IsString() @Length(1, 100) manufacturer?: string;
  @IsOptional() @IsString() @Length(1, 40) modelYear?: string;
  @IsOptional() @IsString() @Length(1, 120) ecmId?: string;
  @IsOptional() @IsString() @Length(1, 120) scuId?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => DiagramCircuitInputDto) circuits!: DiagramCircuitInputDto[];
}
export class UpdateDiagramCircuitStatusDto { @IsEnum(DiagramCircuitStatus) status!: DiagramCircuitStatus; }

export class EditDiagramCircuitDto extends DiagramCircuitInputDto {
  @IsOptional() @IsUUID() id?: string;
}
export class UpdateDiagramProjectDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 120) vehicleId!: string;
  @IsString() @Length(1, 180) vehicleTitle!: string;
  @IsString() @Length(0, 100) manufacturer!: string;
  @IsString() @Length(0, 40) modelYear!: string;
  @IsString() @Length(0, 120) ecmId!: string;
  @IsString() @Length(0, 120) scuId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => EditDiagramCircuitDto) circuits!: EditDiagramCircuitDto[];
}
export class ArchiveDiagramProjectDto { @IsString() @Length(1, 180) confirmationTitle!: string; }

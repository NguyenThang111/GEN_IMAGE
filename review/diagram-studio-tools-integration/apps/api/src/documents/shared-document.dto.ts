import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateSharedDocumentDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class UpdateSharedDocumentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) url?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}

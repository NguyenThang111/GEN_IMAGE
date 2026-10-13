import { IsEmail, IsOptional } from 'class-validator';

export class UpdateUserEmailDto {
  @IsOptional() @IsEmail() email!: string | null;
}

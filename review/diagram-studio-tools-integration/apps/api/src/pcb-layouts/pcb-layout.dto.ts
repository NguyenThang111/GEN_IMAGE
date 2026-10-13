import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class UpdatePcbLayoutProgressDto {
  @IsIn(['Sourced','Placed']) checkbox!: 'Sourced'|'Placed';
  @IsString() @MaxLength(100000) @Matches(/^$|^\d+(,\d+)*$/) refs!: string;
}

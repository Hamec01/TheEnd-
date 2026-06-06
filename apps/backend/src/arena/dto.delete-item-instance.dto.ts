import { IsOptional, IsString, Length } from 'class-validator';

export class DeleteItemInstanceDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  itemInstanceId?: string;
}

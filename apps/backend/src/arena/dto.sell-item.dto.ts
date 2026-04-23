import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class SellItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
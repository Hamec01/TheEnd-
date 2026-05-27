import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class BuyItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;

  @IsString()
  @Length(1, 100)
  merchantId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

import { IsString, Length } from 'class-validator';

export class BuyItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;
}

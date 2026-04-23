import { IsString, Length } from 'class-validator';

export class EquipItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;
}

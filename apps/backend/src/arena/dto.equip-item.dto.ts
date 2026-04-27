import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const HAND_SLOTS = ['weapon', 'shield'] as const;

export class EquipItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;

  @IsOptional()
  @IsString()
  @IsIn(HAND_SLOTS)
  slot?: (typeof HAND_SLOTS)[number];
}

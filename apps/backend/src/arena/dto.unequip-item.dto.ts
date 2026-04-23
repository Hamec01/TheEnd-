import { IsIn, IsString, Length } from 'class-validator';

const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'gloves', 'shield'] as const;

export class UnequipItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @IsIn(EQUIPMENT_SLOTS)
  slot!: (typeof EQUIPMENT_SLOTS)[number];
}

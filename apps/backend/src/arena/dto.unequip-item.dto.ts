import { IsIn, IsString, Length } from 'class-validator';

const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'necklace', 'armor', 'outerwear', 'belt', 'gloves', 'shield', 'ring1', 'ring2', 'ring3', 'legs', 'boots'] as const;

export class UnequipItemDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @IsIn(EQUIPMENT_SLOTS)
  slot!: (typeof EQUIPMENT_SLOTS)[number];
}

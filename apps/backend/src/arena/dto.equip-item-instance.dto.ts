import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'necklace', 'armor', 'outerwear', 'belt', 'gloves', 'shield', 'ring1', 'ring2', 'ring3', 'legs', 'boots'] as const;

export class EquipItemInstanceDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsString()
  @Length(1, 100)
  itemInstanceId!: string;

  @IsOptional()
  @IsString()
  @IsIn(EQUIPMENT_SLOTS)
  slot?: (typeof EQUIPMENT_SLOTS)[number];
}

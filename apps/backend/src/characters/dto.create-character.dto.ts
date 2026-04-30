import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsString, Length, Min, ValidateNested } from 'class-validator';
import { PRIMARY_STATS, type PrimaryStat, Race } from '@theend/rpg-domain';

class AllocationDto {
  @IsInt() @Min(0) hp = 0;
  @IsInt() @Min(0) mp = 0;
  @IsInt() @Min(0) stamina = 0;
  @IsInt() @Min(0) strength = 0;
  @IsInt() @Min(0) dexterity = 0;
  @IsInt() @Min(0) constitution = 0;
  @IsInt() @Min(0) luck = 0;
  @IsInt() @Min(0) intelligence = 0;
  @IsInt() @Min(0) perception = 0;
  @IsInt() @Min(0) willpower = 0;
}

export class CreateCharacterDto {
  @IsString()
  @Length(3, 20)
  name!: string;

  @IsEnum(Race)
  race!: Race;

  @IsObject()
  @ValidateNested()
  @Type(() => AllocationDto)
  allocation!: Partial<Record<PrimaryStat, number>>;
}

export function normalizeAllocation(input: Partial<Record<PrimaryStat, number>>): Partial<Record<PrimaryStat, number>> {
  const normalized: Partial<Record<PrimaryStat, number>> = {};
  for (const stat of PRIMARY_STATS) {
    normalized[stat] = Number(input[stat] ?? 0);
  }
  return normalized;
}

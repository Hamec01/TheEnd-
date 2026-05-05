import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateCharacterResourcesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  currentHp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentMp?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStamina?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  hpRegenPerTurn?: number;
}
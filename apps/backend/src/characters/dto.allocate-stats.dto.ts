import { Type } from 'class-transformer';
import { IsObject, IsOptional, Min, ValidateNested } from 'class-validator';
import type { StatAllocation } from '@theend/rpg-domain';

export class AllocateStatsDto implements StatAllocation {
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  hp?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  mp?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  stamina?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  strength?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  dexterity?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  constitution?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  intelligence?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  luck?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  perception?: number;

  @IsOptional()
  @Min(0)
  @Type(() => Number)
  willpower?: number;
}

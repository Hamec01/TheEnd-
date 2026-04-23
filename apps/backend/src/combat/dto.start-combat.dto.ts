import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Race } from '@theend/rpg-domain';

class EquipmentPayloadDto {
  @IsOptional()
  @IsString()
  weapon?: string | null;

  @IsOptional()
  @IsString()
  helmet?: string | null;

  @IsOptional()
  @IsString()
  armor?: string | null;

  @IsOptional()
  @IsString()
  boots?: string | null;

  @IsOptional()
  @IsString()
  gloves?: string | null;

  @IsOptional()
  @IsString()
  shield?: string | null;
}

class CombatStatBlockDto {
  @IsInt()
  @Min(10)
  hp!: number;

  @IsInt()
  @Min(0)
  mp!: number;

  @IsInt()
  @Min(10)
  stamina!: number;

  @IsInt()
  @Min(1)
  strength!: number;

  @IsInt()
  @Min(1)
  constitution!: number;

  @IsInt()
  @Min(1)
  dexterity!: number;

  @IsInt()
  @Min(1)
  intelligence!: number;

  @IsInt()
  @Min(1)
  luck!: number;

  @IsInt()
  @Min(1)
  perception!: number;

  @IsInt()
  @Min(1)
  willpower!: number;
}

export class CustomCombatNpcDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsEnum(Race)
  race!: Race;

  @ValidateNested()
  @Type(() => CombatStatBlockDto)
  stats!: CombatStatBlockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EquipmentPayloadDto)
  equipment?: EquipmentPayloadDto;
}

export class StartCombatDto {
  @IsString()
  @Length(1, 100)
  characterId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  enemyCount?: number;

  @IsOptional()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CustomCombatNpcDto)
  customEnemies?: CustomCombatNpcDto[];
}

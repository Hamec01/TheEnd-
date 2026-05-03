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
  necklace?: string | null;

  @IsOptional()
  @IsString()
  armor?: string | null;

  @IsOptional()
  @IsString()
  outerwear?: string | null;

  @IsOptional()
  @IsString()
  belt?: string | null;

  @IsOptional()
  @IsString()
  ring1?: string | null;

  @IsOptional()
  @IsString()
  ring2?: string | null;

  @IsOptional()
  @IsString()
  ring3?: string | null;

  @IsOptional()
  @IsString()
  legs?: string | null;

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

class BlockedTileDto {
  @IsInt()
  @Min(0)
  @Max(11)
  x!: number;

  @IsInt()
  @Min(0)
  @Max(11)
  y!: number;
}

class RuntimeBattleMapCellDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  trapId?: string;

  @IsOptional()
  @IsInt()
  movementCost?: number;

  @IsOptional()
  blocksMovement?: boolean;

  @IsOptional()
  blocksLineOfSight?: boolean;
}

class RuntimeBattleMapPointDto {
  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;
}

class RuntimeBattleMapSpawnZoneDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsString()
  name!: string;

  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapPointDto)
  cells!: RuntimeBattleMapPointDto[];
}

class RuntimeBattleMapObjectDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  blocksMovement?: boolean;

  @IsOptional()
  blocksLineOfSight?: boolean;
}

class RuntimeBattleMapTrapDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsOptional()
  @IsInt()
  damage?: number;

  @IsOptional()
  @IsInt()
  staminaCost?: number;

  @IsOptional()
  triggerOnce?: boolean;
}

class RuntimeBattleMapPlacedNpcDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  npcId?: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  role!: string;

  @IsInt()
  @Min(0)
  x!: number;

  @IsInt()
  @Min(0)
  y!: number;

  @IsOptional()
  @IsString()
  factionId?: string;

  @IsOptional()
  @IsString()
  dialogueId?: string;

  @IsOptional()
  @IsString()
  questId?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  startsCombat?: boolean;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

class RuntimeBattleMapTriggerDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapPointDto)
  cells!: RuntimeBattleMapPointDto[];

  @IsOptional()
  @IsString()
  questId?: string;

  @IsOptional()
  @IsString()
  dialogueId?: string;

  @IsOptional()
  @IsString()
  targetBattleMapId?: string;

  @IsOptional()
  @IsString()
  targetWorldZoneId?: string;

  @IsOptional()
  startsCombat?: boolean;

  @IsOptional()
  once?: boolean;

  @IsOptional()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class RuntimeBattleMapDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt()
  @Min(12)
  width!: number;

  @IsInt()
  @Min(12)
  height!: number;

  @IsInt()
  @Min(6)
  viewportWidth!: number;

  @IsInt()
  @Min(6)
  viewportHeight!: number;

  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapCellDto)
  cells!: RuntimeBattleMapCellDto[];

  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapSpawnZoneDto)
  spawnZones!: RuntimeBattleMapSpawnZoneDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapObjectDto)
  objects?: RuntimeBattleMapObjectDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapTrapDto)
  traps?: RuntimeBattleMapTrapDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapPlacedNpcDto)
  npcs?: RuntimeBattleMapPlacedNpcDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RuntimeBattleMapTriggerDto)
  triggers?: RuntimeBattleMapTriggerDto[];
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

  @IsOptional()
  @IsString()
  @Length(0, 500)
  avatarUrl?: string;
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

  @IsOptional()
  @ArrayMaxSize(144)
  @ValidateNested({ each: true })
  @Type(() => BlockedTileDto)
  blockedTiles?: BlockedTileDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => RuntimeBattleMapDto)
  battleMap?: RuntimeBattleMapDto;
}

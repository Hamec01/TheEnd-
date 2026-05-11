import { ActionType, DistanceBand, MovementType, TargetZone } from '@theend/rpg-domain';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CombatActionDto {
  @IsString()
  @Length(1, 100)
  combatId!: string;

  @IsString()
  @Length(1, 100)
  actorId!: string;

  @IsString()
  @Length(1, 100)
  targetId!: string;

  @IsOptional()
  @IsEnum(TargetZone)
  attackZone?: TargetZone;

  @IsOptional()
  @IsArray()
  @IsEnum(TargetZone, { each: true })
  defenseZones?: TargetZone[];

  @IsOptional()
  @IsInt()
  @Min(0)
  attackPointsSpent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defensePointsSpent?: number;

  @IsEnum(ActionType)
  actionType!: ActionType;

  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @IsOptional()
  @IsEnum(DistanceBand)
  preferredDistance?: DistanceBand;

  @IsOptional()
  @IsInt()
  @Min(0)
  destinationX?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  destinationY?: number;

  /** New skill system: AdminSkillDefinition.id */
  @IsOptional()
  @IsString()
  skillId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  skillLevel?: number;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  guardMode?: 'guard' | 'strong_guard';
}

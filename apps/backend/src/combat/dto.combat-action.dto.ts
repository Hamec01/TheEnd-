import { ActionType, CombatSkillType, DistanceBand, TargetZone } from '@theend/rpg-domain';
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

  @IsEnum(TargetZone)
  attackZone!: TargetZone;

  @IsArray()
  @IsEnum(TargetZone, { each: true })
  defenseZones!: TargetZone[];

  @IsInt()
  @Min(0)
  attackPointsSpent!: number;

  @IsInt()
  @Min(0)
  defensePointsSpent!: number;

  @IsEnum(ActionType)
  actionType!: ActionType;

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

  @IsOptional()
  @IsEnum(CombatSkillType)
  skillType?: CombatSkillType;
}

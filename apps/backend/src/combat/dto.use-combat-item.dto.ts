import { IsOptional, IsString, Length } from 'class-validator';

export class UseCombatItemDto {
  @IsString()
  @Length(1, 100)
  combatId!: string;

  @IsString()
  @Length(1, 100)
  actorId!: string;

  @IsString()
  @Length(1, 100)
  itemId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  targetId?: string;
}

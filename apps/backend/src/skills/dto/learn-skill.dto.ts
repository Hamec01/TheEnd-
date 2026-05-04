import { IsOptional, IsString, Length } from 'class-validator';
import type { CharacterSkillSourceType } from '../character-skill.types';

export class LearnSkillDto {
  @IsString()
  @Length(1, 100)
  skillId!: string;

  @IsString()
  sourceType!: CharacterSkillSourceType;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  sourceId?: string;
}

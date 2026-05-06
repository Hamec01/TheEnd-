import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SkillLearningService } from './skill-learning.service';
import { LearnSkillDto } from './dto/learn-skill.dto';
import { UpdateLoadoutDto } from './dto/update-loadout.dto';

@Controller(['characters/:characterId', 'api/characters/:characterId'])
export class CharacterSkillsController {
  constructor(private readonly skillLearning: SkillLearningService) {}

  @Get('skills')
  async getSkills(@Param('characterId') characterId: string) {
    return this.skillLearning.getCharacterSkills(characterId);
  }

  @Post('skills/learn')
  async learnSkill(
    @Param('characterId') characterId: string,
    @Body() dto: LearnSkillDto,
  ) {
    return this.skillLearning.learnSkillFromTraining(characterId, dto.skillId, dto.sourceId);
  }

  @Post('skills/grant')
  async grantSkill(
    @Param('characterId') characterId: string,
    @Body() dto: LearnSkillDto,
  ) {
    return this.skillLearning.grantSkillToCharacter(
      characterId,
      dto.skillId,
      dto.sourceType ?? 'admin',
      dto.sourceId,
    );
  }

  @Get('skill-loadout')
  async getLoadout(@Param('characterId') characterId: string) {
    return this.skillLearning.getOrCreateLoadout(characterId);
  }

  @Patch('skill-loadout')
  async updateLoadout(
    @Param('characterId') characterId: string,
    @Body() dto: UpdateLoadoutDto,
  ) {
    return this.skillLearning.updateLoadout(characterId, dto.slots);
  }
}

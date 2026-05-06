import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module';
import { ContentModule } from '../content/content.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { SkillLearningService } from './skill-learning.service';
import { SkillRuntimeService } from './skill-runtime.service';
import { CharacterSkillsController } from './character-skills.controller';

@Module({
  imports: [ArenaModule, ContentModule, PrismaModule],
  controllers: [SkillsController, CharacterSkillsController],
  providers: [SkillsService, SkillLearningService, SkillRuntimeService, RuntimeCharacterStore],
  exports: [SkillLearningService, SkillRuntimeService],
})
export class SkillsModule {}

import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { SkillLearningService } from './skill-learning.service';
import { SkillRuntimeService } from './skill-runtime.service';
import { CharacterSkillsController } from './character-skills.controller';

@Module({
  imports: [ContentModule, PrismaModule],
  controllers: [SkillsController, CharacterSkillsController],
  providers: [SkillsService, SkillLearningService, SkillRuntimeService],
  exports: [SkillLearningService, SkillRuntimeService],
})
export class SkillsModule {}

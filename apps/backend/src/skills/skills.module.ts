import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [ContentModule],
  controllers: [SkillsController],
  providers: [SkillsService],
})
export class SkillsModule {}

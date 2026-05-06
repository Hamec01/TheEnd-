import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module';
import { CharactersModule } from '../characters/characters.module';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { ContentModule } from '../content/content.module';
import { SkillsModule } from '../skills/skills.module';
import { CombatController } from './combat.controller';
import { CombatService } from './combat.service';

@Module({
  imports: [CharactersModule, ContentModule, ArenaModule, SkillsModule],
  controllers: [CombatController],
  providers: [CombatService, RuntimeCharacterStore],
  exports: [CombatService],
})
export class CombatModule {}

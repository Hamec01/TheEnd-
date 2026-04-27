import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module';
import { ContentModule } from '../content/content.module';
import { CombatController } from './combat.controller';
import { CombatService } from './combat.service';

@Module({
  imports: [CharactersModule, ContentModule],
  controllers: [CombatController],
  providers: [CombatService],
  exports: [CombatService],
})
export class CombatModule {}

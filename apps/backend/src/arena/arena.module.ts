import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { ArenaController } from './arena.controller';
import { CharacterRuntimeController } from './character-runtime.controller';
import { ArenaService } from './arena.service';

@Module({
  imports: [ContentModule],
  controllers: [ArenaController, CharacterRuntimeController],
  providers: [ArenaService, RuntimeCharacterStore],
  exports: [ArenaService],
})
export class ArenaModule {}

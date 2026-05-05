import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { ArenaController } from './arena.controller';
import { CharacterRuntimeController } from './character-runtime.controller';
import { ArenaService } from './arena.service';

@Module({
  imports: [ContentModule],
  controllers: [ArenaController, CharacterRuntimeController],
  providers: [ArenaService],
  exports: [ArenaService],
})
export class ArenaModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ArenaModule } from './arena/arena.module';
import { CharactersModule } from './characters/characters.module';
import { CombatModule } from './combat/combat.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, CharactersModule, ArenaModule, CombatModule],
})
export class AppModule {}

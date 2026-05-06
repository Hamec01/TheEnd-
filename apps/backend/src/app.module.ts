import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ArenaModule } from './arena/arena.module';
import { CharactersModule } from './characters/characters.module';
import { CombatModule } from './combat/combat.module';
import { ContentModule } from './content/content.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SkillsModule } from './skills/skills.module';
import { PvpModule } from './pvp/pvp.module';

@Module({
  imports: [PrismaModule, AuthModule, CharactersModule, ContentModule, ArenaModule, CombatModule, SkillsModule, PvpModule],
  controllers: [HealthController],
})
export class AppModule {}

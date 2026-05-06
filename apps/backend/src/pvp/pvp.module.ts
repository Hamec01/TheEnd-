import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RuntimeCharacterStore } from '../characters/runtime-character-store';
import { PvpController } from './pvp.controller';
import { PvpService } from './pvp.service';

@Module({
  imports: [PrismaModule],
  controllers: [PvpController],
  providers: [PvpService, RuntimeCharacterStore],
})
export class PvpModule {}


import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BlacksmithController } from './blacksmith.controller';
import { BlacksmithService } from './blacksmith.service';

@Module({
  imports: [PrismaModule, ContentModule],
  controllers: [BlacksmithController],
  providers: [BlacksmithService],
  exports: [BlacksmithService],
})
export class BlacksmithModule {}

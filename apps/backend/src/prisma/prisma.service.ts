import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseConfiguration, isDatabaseEnabled, isFileStorageMode } from '../config/storage-mode';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    if (!isDatabaseEnabled()) {
      if (isFileStorageMode()) {
        this.logger.log('Local file mode active: skipping Prisma database initialization.');
      }
      return;
    }

    assertDatabaseConfiguration();
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!isDatabaseEnabled()) {
      return;
    }
    await this.$disconnect();
  }

  assertDatabaseEnabled(): void {
    if (!isDatabaseEnabled()) {
      throw new ServiceUnavailableException('Database is disabled in local file content storage mode.');
    }
  }
}

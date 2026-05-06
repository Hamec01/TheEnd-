import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { isDatabaseEnabled } from '../config/storage-mode';

@Catch(Prisma.PrismaClientInitializationError)
export class DatabaseUnavailableFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientInitializationError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const message = exception.message || '';
    const isMissingDatabaseUrl = message.includes('DATABASE_URL');

    if (isDatabaseEnabled() && !isMissingDatabaseUrl) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        ok: false,
        database: 'unavailable',
        error: 'Database is unavailable.',
      });
      return;
    }

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      ok: false,
      database: 'disabled',
      error: 'Database is disabled in local file content storage mode.',
    });
  }
}

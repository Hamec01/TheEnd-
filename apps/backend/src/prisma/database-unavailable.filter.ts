import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { isDatabaseEnabled } from '../config/storage-mode';

@Catch()
export class DatabaseUnavailableFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!this.isPrismaDatabaseUnavailableError(exception)) {
      throw exception;
    }

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

  private isPrismaDatabaseUnavailableError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return error.name === 'PrismaClientInitializationError'
      || message.includes('database')
      || message.includes('quota')
      || message.includes('connect');
  }
}

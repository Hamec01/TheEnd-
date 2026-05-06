import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { ContentService } from './content/content.service';
import { getDatabaseStatus } from './config/storage-mode';
import { CharactersService } from './characters/characters.service';

@Controller(['health', 'api/health'])
export class HealthController {
  constructor(
    private readonly contentService: ContentService,
    private readonly charactersService: CharactersService,
  ) {}

  @Get()
  @HttpCode(200)
  getHealth() {
    const storageHealth = this.contentService.getStorageHealth();
    const storageMode = this.contentService.getStorageMode();
    const base = {
      backend: 'online',
      appEnv: process.env.APP_ENV || process.env.NODE_ENV || 'local',
      storageMode,
      database: getDatabaseStatus(),
      contentFile: this.contentService.getContentFileName(),
    };

    if (!storageHealth.ok) {
      throw new HttpException({
        ok: false,
        ...base,
        error: storageHealth.error,
      }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const response = {
      ok: true,
      ...base,
      contentStorage: storageHealth.contentStorage,
    } as {
      ok: true;
      backend: string;
      appEnv: string;
      storageMode: string;
      database: 'disabled' | 'online';
      contentFile: string | undefined;
      contentStorage: 'readable-writable';
      runtimeStorage?: 'readable-writable' | 'unavailable';
      runtimeFile?: string;
    };

    if (storageMode === 'file') {
      const runtimeHealth = this.charactersService.getRuntimeStorageHealth();
      response.runtimeStorage = runtimeHealth.runtimeStorage;
      response.runtimeFile = runtimeHealth.runtimeFile;
    }

    return response;
  }
}

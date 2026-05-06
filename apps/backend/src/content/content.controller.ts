import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import type { ContentBackupEnvelope, ContentDatabase, ContentImportMode, ContentImportResult, WorldMapContent } from './content.types';
import { ContentService } from './content.service';

@Controller(['content', 'api/content'])
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('snapshot')
  async getSnapshot(): Promise<ContentDatabase> {
    await this.contentService.ensureInitialized();
    return this.contentService.getSnapshot();
  }

  @Get('export')
  async exportContent(): Promise<ContentBackupEnvelope> {
    await this.contentService.ensureInitialized();
    return this.contentService.exportFullContent();
  }

  @Post('import')
  async importContent(@Body() payload?: unknown): Promise<ContentImportResult> {
    await this.contentService.ensureInitialized();
    const rawMode = payload && typeof payload === 'object' && !Array.isArray(payload) && 'mode' in payload
      ? ((payload as { mode?: ContentImportMode }).mode ?? 'replace')
      : 'replace';
    const mode: ContentImportMode = rawMode === 'merge' || rawMode === 'dryRun' ? rawMode : 'replace';
    return this.contentService.importFullContent(payload ?? {}, mode);
  }

  @Post('import-local')
  async importLocal(@Body() payload?: Partial<ContentDatabase>): Promise<ContentDatabase> {
    this.contentService.assertContentImportAllowed();
    await this.contentService.ensureInitialized();
    if (!payload || Object.keys(payload).length === 0) {
      return this.contentService.reloadFromDisk();
    }

    return this.contentService.importLegacy(payload);
  }

  @Post('reload-local')
  async reloadLocal(): Promise<ContentDatabase> {
    this.contentService.assertContentImportAllowed();
    await this.contentService.ensureInitialized();
    return this.contentService.reloadFromDisk();
  }

  @Get('validate')
  validateContent() {
    return this.contentService.validateIntegrity();
  }

  @Post('seed-defaults')
  async seedDefaults() {
    this.contentService.assertContentImportAllowed();
    await this.contentService.ensureInitialized();
    return this.contentService.seedDefaultsIfEmpty();
  }

  @Get('world-map')
  async getWorldMap(): Promise<WorldMapContent> {
    await this.contentService.ensureInitialized();
    return this.contentService.getWorldMap();
  }

  @Put('world-map')
  async saveWorldMap(@Body() payload: WorldMapContent): Promise<WorldMapContent> {
    await this.contentService.ensureInitialized();
    return this.contentService.saveWorldMap(payload);
  }

  @Get(':collection')
  async listCollection(@Param('collection') collection: string) {
    await this.contentService.ensureInitialized();
    return this.contentService.listCollection(collection as any);
  }

  @Get(':collection/:id')
  async getEntry(@Param('collection') collection: string, @Param('id') id: string) {
    await this.contentService.ensureInitialized();
    return this.contentService.getCollectionEntry(collection as any, id);
  }

  @Post(':collection')
  async createEntry(@Param('collection') collection: string, @Body() payload: any) {
    await this.contentService.ensureInitialized();
    return this.contentService.createCollectionEntry(collection as any, payload);
  }

  @Put(':collection/:id')
  async updateEntry(@Param('collection') collection: string, @Param('id') id: string, @Body() payload: any) {
    await this.contentService.ensureInitialized();
    return this.contentService.updateCollectionEntry(collection as any, id, payload);
  }

  @Delete(':collection/:id')
  async deleteEntry(@Param('collection') collection: string, @Param('id') id: string) {
    await this.contentService.ensureInitialized();
    await this.contentService.deleteCollectionEntry(collection as any, id);
    return { ok: true };
  }
}

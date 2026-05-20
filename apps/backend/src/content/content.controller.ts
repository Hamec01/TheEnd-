import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import type { ContentBackupEnvelope, ContentDatabase, ContentImportMode, ContentImportResult, StoredImage, WorldMapContent } from './content.types';
import { ContentService } from './content.service';
import { buildItemPreview, buildItemSetPreview, buildRuneComplexPreview } from './admin-preview.builder';
import type { ItemPreviewQueryBody, ItemPreviewResponse, ItemSetPreviewResponse, RuneComplexPreviewResponse } from './admin-preview.types';

type StoredImageUploadBody = Partial<StoredImage> & { dataUrl?: string };

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
    const mode: ContentImportMode = rawMode === 'merge' || rawMode === 'dryRun' || rawMode === 'add_missing_only' ? rawMode : 'replace';
    const dryRun = payload && typeof payload === 'object' && !Array.isArray(payload) && 'dryRun' in payload
      ? Boolean((payload as { dryRun?: unknown }).dryRun)
      : undefined;
    return this.contentService.importFullContent(payload ?? {}, mode, dryRun);
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

  @Post('images/upload')
  async uploadImage(@Body() payload: StoredImageUploadBody): Promise<StoredImage> {
    await this.contentService.ensureInitialized();
    return this.contentService.createStoredImageAsset(payload);
  }

  @Put('images/:id/upload')
  async replaceImage(@Param('id') id: string, @Body() payload: StoredImageUploadBody): Promise<StoredImage> {
    await this.contentService.ensureInitialized();
    return this.contentService.replaceStoredImageAsset(id, payload);
  }

  // ---------------------------------------------------------------------------
  // Admin preview endpoints (must be declared before generic :collection routes)
  // ---------------------------------------------------------------------------

  /**
   * POST /content/preview/item/:id
   *
   * Возвращает полный превью предмета: человекочитаемые эффекты, состояние сокетов,
   * неактивные аугменты и информацию о сете.
   *
   * Опционально в body можно передать:
   * - activationContexts: string[]   — контексты для проверки активации аугментов
   * - instanceSocketState: {...}[]   — состояние сокетов персонажного инстанса
   */
  @Post('preview/item/:id')
  async previewItem(
    @Param('id') id: string,
    @Body() body?: ItemPreviewQueryBody,
  ): Promise<ItemPreviewResponse> {
    await this.contentService.ensureInitialized();
    const db = this.contentService.getSnapshot();
    const item = db.items.find((i) => i.id === id);
    if (!item) {
      throw new NotFoundException(`Item '${id}' not found`);
    }
    return buildItemPreview(item, db.items, db.itemSets ?? [], {
      activationContexts: body?.activationContexts,
      instanceSocketState: body?.instanceSocketState,
    });
  }

  /**
   * GET /content/preview/item-set/:id
   *
   * Возвращает превью сета: список предметов с именами и бонусы с человекочитаемыми эффектами.
   */
  @Get('preview/item-set/:id')
  async previewItemSet(@Param('id') id: string): Promise<ItemSetPreviewResponse> {
    await this.contentService.ensureInitialized();
    const db = this.contentService.getSnapshot();
    const set = (db.itemSets ?? []).find((s) => s.id === id);
    if (!set) {
      throw new NotFoundException(`ItemSet '${id}' not found`);
    }
    return buildItemSetPreview(set, db.items);
  }

  /**
   * GET /content/preview/rune-complex/:id
   *
   * Возвращает превью рунного комплекса: список рун с именами и эффектами.
   */
  @Get('preview/rune-complex/:id')
  async previewRuneComplex(@Param('id') id: string): Promise<RuneComplexPreviewResponse> {
    await this.contentService.ensureInitialized();
    const db = this.contentService.getSnapshot();
    const complex = (db.runeComplexes ?? []).find((c) => c.id === id);
    if (!complex) {
      throw new NotFoundException(`RuneComplex '${id}' not found`);
    }
    return buildRuneComplexPreview(complex, db.items);
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

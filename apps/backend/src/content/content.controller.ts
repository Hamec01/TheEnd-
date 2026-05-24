import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, extname, join } from 'path';
import type { ContentBackupEnvelope, ContentDatabase, ContentImportMode, ContentImportResult, StoredImage, WorldMapContent } from './content.types';
import { ContentService } from './content.service';
import { resolveContentAssetsDir } from './content-assets';
import { buildItemPreview, buildItemSetPreview, buildRuneComplexPreview } from './admin-preview.builder';
import type { ItemPreviewQueryBody, ItemPreviewResponse, ItemSetPreviewResponse, RuneComplexPreviewResponse } from './admin-preview.types';

type StoredImageUploadBody = Partial<StoredImage> & { folder?: string; dataUrl?: string };
type StoredAudioUploadBody = {
  id?: string;
  name?: string;
  mimeType?: string;
  folder?: string;
  dataUrl?: string;
};

@Controller(['content', 'api/content'])
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  private readonly imageMimeByExt: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  private readonly audioMimeByExt: Record<string, string> = {
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm',
  };

  private sanitizeAssetId(value: string): string {
    const normalized = String(value ?? '')
      .replace(/\.[a-z0-9]+$/i, '')
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80);
    return normalized;
  }

  private decodeImageDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } | null {
    const normalized = String(dataUrl ?? '').trim();
    const match = normalized.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return null;
    }
    const mimeType = match[1] || 'image/png';
    const encoded = match[2] || '';
    try {
      return {
        mimeType,
        bytes: Buffer.from(encoded, 'base64'),
      };
    } catch {
      return null;
    }
  }

  private resolveImageFromPublicAssetPath(value: string): { mimeType: string; bytes: Buffer } | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return null;
    }

    const pathLike = normalized.startsWith('/') ? normalized : `/${normalized}`;
    if (!pathLike.startsWith('/assets/upload/')) {
      return null;
    }

    const prefix = '/assets/upload/';
    const relativePath = pathLike.startsWith(prefix) ? pathLike.slice(prefix.length) : '';
    if (!relativePath || relativePath.includes('..')) {
      return null;
    }

    const absolutePath = join(resolveContentAssetsDir(), ...relativePath.split('/'));
    if (!existsSync(absolutePath)) {
      return null;
    }

    const ext = extname(relativePath).toLowerCase();
    const mimeType = this.imageMimeByExt[ext] ?? 'application/octet-stream';
    return {
      mimeType,
      bytes: readFileSync(absolutePath),
    };
  }

  private collectAssetFiles(dir: string, relativePrefix = ''): string[] {
    if (!existsSync(dir)) {
      return [];
    }
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const entryRelative = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.collectAssetFiles(absolute, entryRelative));
      } else if (entry.isFile()) {
        files.push(entryRelative);
      }
    }
    return files;
  }

  private resolveAudioAssetById(assetId: string): { mimeType: string; bytes: Buffer } | null {
    const normalizedId = this.sanitizeAssetId(assetId);
    if (!normalizedId) {
      return null;
    }

    const assetsDir = resolveContentAssetsDir();
    if (!existsSync(assetsDir)) {
      return null;
    }

    const files = this.collectAssetFiles(assetsDir);

    const exact = files.find((file) => {
      const fileName = basename(file);
      const ext = extname(fileName).toLowerCase();
      if (!this.audioMimeByExt[ext]) {
        return false;
      }
      return fileName === `${normalizedId}${ext}`;
    });

    const prefixed = files.find((file) => {
      const fileName = basename(file);
      const ext = extname(fileName).toLowerCase();
      if (!this.audioMimeByExt[ext]) {
        return false;
      }
      return fileName.startsWith(`${normalizedId}-`);
    });

    const fileName = exact ?? prefixed;
    if (!fileName) {
      return null;
    }

    const absolutePath = join(assetsDir, ...fileName.split('/'));
    const ext = extname(fileName).toLowerCase();
    return {
      mimeType: this.audioMimeByExt[ext] ?? 'application/octet-stream',
      bytes: readFileSync(absolutePath),
    };
  }

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

  @Get('images/:id/raw')
  async getImageRaw(@Param('id') id: string, @Res() response: Response): Promise<void> {
    await this.contentService.ensureInitialized();
    const image = await this.contentService.getCollectionEntry('images', id) as StoredImage | null;
    if (!image) {
      throw new NotFoundException(`Image '${id}' not found`);
    }

    const decoded = this.decodeImageDataUrl(image.dataUrl) ?? this.resolveImageFromPublicAssetPath(image.dataUrl);
    if (!decoded) {
      throw new NotFoundException(`Image '${id}' has invalid data URL`);
    }

    response.setHeader('Content-Type', decoded.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.send(decoded.bytes);
  }

  @Post('assets/audio/upload')
  async uploadAudio(@Body() payload: StoredAudioUploadBody): Promise<{ assetId: string; publicUrl: string; mimeType: string }> {
    await this.contentService.ensureInitialized();
    return this.contentService.uploadAudioAsset(payload);
  }

  @Get('assets/audio/:id/raw')
  async getAudioRaw(@Param('id') id: string, @Res() response: Response): Promise<void> {
    await this.contentService.ensureInitialized();
    const resolved = this.resolveAudioAssetById(id);
    if (!resolved) {
      throw new NotFoundException(`Audio asset '${id}' not found`);
    }

    response.setHeader('Content-Type', resolved.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=300');
    response.send(resolved.bytes);
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

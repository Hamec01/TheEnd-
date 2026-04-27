import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import type { ContentDatabase, WorldMapContent } from './content.types';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('snapshot')
  getSnapshot(): ContentDatabase {
    return this.contentService.getSnapshot();
  }

  @Post('import-local')
  importLocal(@Body() payload: Partial<ContentDatabase>): ContentDatabase {
    return this.contentService.importLegacy(payload);
  }

  @Post('seed-defaults')
  seedDefaults() {
    return this.contentService.seedDefaultsIfEmpty();
  }

  @Get('world-map')
  getWorldMap(): WorldMapContent {
    return this.contentService.getWorldMap();
  }

  @Put('world-map')
  saveWorldMap(@Body() payload: WorldMapContent): WorldMapContent {
    return this.contentService.saveWorldMap(payload);
  }

  @Get(':collection')
  listCollection(@Param('collection') collection: string) {
    return this.contentService.listCollection(collection as any);
  }

  @Get(':collection/:id')
  getEntry(@Param('collection') collection: string, @Param('id') id: string) {
    return this.contentService.getCollectionEntry(collection as any, id);
  }

  @Post(':collection')
  createEntry(@Param('collection') collection: string, @Body() payload: any) {
    return this.contentService.createCollectionEntry(collection as any, payload);
  }

  @Put(':collection/:id')
  updateEntry(@Param('collection') collection: string, @Param('id') id: string, @Body() payload: any) {
    return this.contentService.updateCollectionEntry(collection as any, id, payload);
  }

  @Delete(':collection/:id')
  deleteEntry(@Param('collection') collection: string, @Param('id') id: string) {
    this.contentService.deleteCollectionEntry(collection as any, id);
    return { ok: true };
  }
}

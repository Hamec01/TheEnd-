import type { ImageSheetDefinition } from './models';
import { createContentEntry, getContentCollection, updateContentEntry } from './contentApi';

export const imageSheetsService = {
  async getAll(): Promise<ImageSheetDefinition[]> {
    try {
      return await getContentCollection<ImageSheetDefinition>('imageSheets');
    } catch {
      return [];
    }
  },

  async upsert(sheet: ImageSheetDefinition): Promise<ImageSheetDefinition> {
    const existing = (await this.getAll()).find((entry) => entry.id === sheet.id);
    if (existing) {
      return updateContentEntry<ImageSheetDefinition>('imageSheets', sheet.id, sheet);
    }
    return createContentEntry<ImageSheetDefinition>('imageSheets', sheet);
  },
};

import type { Material } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportResult } from './adminJsonImportExport';
import { nowIso, uid } from './storage';

export function validateMaterial(material: Material): string[] {
  const errors: string[] = [];
  if (!material.id.trim()) {
    errors.push('id is required');
  }
  if (!material.name.trim()) {
    errors.push('name is required');
  }
  if (!material.region.trim()) {
    errors.push('region is required');
  }
  return errors;
}

export function extractRawMaterialsFromImportJson(payload: unknown): unknown[] {
  return extractRawCollectionFromImportJson(payload, 'materials');
}

export async function importMaterialsFromJsonEntries(entries: unknown[]): Promise<JsonImportResult> {
  const defaults = (): Material => ({
    id: '',
    name: '',
    category: 'other',
    region: '',
    rarity: 'common',
    averageMarketPrice: 0,
    properties: [],
    gameplayDescription: '',
    loreDescription: '',
    imagePath: '',
    isEnabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return importCollectionFromJsonEntries<Material>({
    entries,
    defaults,
    normalize: (value) => ({ ...defaults(), ...value, id: value.id.trim() || uid('material'), updatedAt: nowIso() }),
    validate: validateMaterial,
    getAll: () => materialsService.getAll(),
    create: (value) => materialsService.create(value),
    update: (id, value) => materialsService.update(id, value),
  });
}

export const materialsService = {
  async getAll(): Promise<Material[]> {
    return getContentCollection<Material>('materials');
  },

  async getById(id: string): Promise<Material | null> {
    return getContentEntry<Material>('materials', id);
  },

  async create(payload: Omit<Material, 'createdAt' | 'updatedAt'>): Promise<Material> {
    const next: Material = {
      ...payload,
      id: payload.id?.trim() || uid('material'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return createContentEntry<Material>('materials', next);
  },

  async update(id: string, patch: Partial<Material>): Promise<Material> {
    const found = await this.getById(id);
    if (!found) {
      throw new Error(`Material not found: ${id}`);
    }
    const merged: Material = {
      ...found,
      ...patch,
      id: found.id,
      updatedAt: nowIso(),
    };
    return updateContentEntry<Material>('materials', id, merged);
  },

  async rename(oldId: string, nextId: string, payload: Material): Promise<Material> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Material id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }

    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate material id: ${toId}`);
    }

    const normalized: Material = { ...payload, id: toId, updatedAt: nowIso() };
    const errors = validateMaterial(normalized);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    const created = await this.create(normalized);
    await this.delete(fromId);
    return created;
  },

  async disable(id: string): Promise<Material> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('materials', id);
  },
};

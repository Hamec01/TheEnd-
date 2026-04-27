import type { Material } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
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

  async disable(id: string): Promise<Material> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('materials', id);
  },
};

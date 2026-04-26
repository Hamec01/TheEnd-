import type { Material } from './models';
import { nowIso, readCollection, uid, writeCollection } from './storage';

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
    return readCollection<Material>('materials');
  },

  async getById(id: string): Promise<Material | null> {
    const all = await this.getAll();
    return all.find((entry) => entry.id === id) ?? null;
  },

  async create(payload: Omit<Material, 'createdAt' | 'updatedAt'>): Promise<Material> {
    const all = await this.getAll();
    const next: Material = {
      ...payload,
      id: payload.id?.trim() || uid('material'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    writeCollection('materials', [...all, next]);
    return next;
  },

  async update(id: string, patch: Partial<Material>): Promise<Material> {
    const all = await this.getAll();
    const found = all.find((entry) => entry.id === id);
    if (!found) {
      throw new Error(`Material not found: ${id}`);
    }
    const merged: Material = {
      ...found,
      ...patch,
      id: found.id,
      updatedAt: nowIso(),
    };
    writeCollection('materials', all.map((entry) => (entry.id === id ? merged : entry)));
    return merged;
  },

  async disable(id: string): Promise<Material> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    writeCollection('materials', all.filter((entry) => entry.id !== id));
  },
};

import type { AdminMerchant } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { nowIso, uid } from './storage';

export function validateMerchant(merchant: AdminMerchant): string[] {
  const errors: string[] = [];
  if (!merchant.id.trim()) {
    errors.push('id required');
  }
  if (!merchant.name.trim()) {
    errors.push('name required');
  }
  if (!merchant.city.trim()) {
    errors.push('city required');
  }
  if (!(merchant.priceMultiplier > 0)) {
    errors.push('priceMultiplier must be > 0');
  }
  return errors;
}

export const merchantsService = {
  async getAll(): Promise<AdminMerchant[]> {
    return getContentCollection<AdminMerchant>('merchants');
  },

  async getById(id: string): Promise<AdminMerchant | null> {
    return getContentEntry<AdminMerchant>('merchants', id);
  },

  async create(payload: Omit<AdminMerchant, 'createdAt' | 'updatedAt'>): Promise<AdminMerchant> {
    const nextEntry: AdminMerchant = {
      ...payload,
      id: payload.id?.trim() || uid('merchant'),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const errors = validateMerchant(nextEntry);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return createContentEntry<AdminMerchant>('merchants', nextEntry);
  },

  async update(id: string, patch: Partial<AdminMerchant>): Promise<AdminMerchant> {
    const found = await this.getById(id);
    if (!found) {
      throw new Error(`Merchant not found: ${id}`);
    }
    const merged: AdminMerchant = {
      ...found,
      ...patch,
      id: found.id,
      updatedAt: nowIso(),
    };
    const errors = validateMerchant(merged);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return updateContentEntry<AdminMerchant>('merchants', id, merged);
  },

  async disable(id: string): Promise<AdminMerchant> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('merchants', id);
  },
};

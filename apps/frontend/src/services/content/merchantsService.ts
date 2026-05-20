import type { AdminMerchant } from './models';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './contentApi';
import { extractRawCollectionFromImportJson, importCollectionFromJsonEntries, type JsonImportResult } from './adminJsonImportExport';
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

export function extractRawMerchantsFromImportJson(payload: unknown): unknown[] {
  return extractRawCollectionFromImportJson(payload, 'merchants');
}

export async function importMerchantsFromJsonEntries(entries: unknown[]): Promise<JsonImportResult> {
  const defaults = (): AdminMerchant => ({
    id: '',
    name: '',
    city: '',
    location: '',
    type: 'general',
    description: '',
    portraitPath: '',
    priceMultiplier: 1,
    worldSimTrader: false,
    materialTradingEnabled: false,
    materialTrades: [],
    isEnabled: true,
    items: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return importCollectionFromJsonEntries<AdminMerchant>({
    entries,
    defaults,
    normalize: (value) => ({ ...defaults(), ...value, id: value.id.trim() || uid('merchant'), updatedAt: nowIso() }),
    validate: validateMerchant,
    getAll: () => merchantsService.getAll(),
    create: (value) => merchantsService.create(value),
    update: (id, value) => merchantsService.update(id, value),
  });
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

  async rename(oldId: string, nextId: string, payload: AdminMerchant): Promise<AdminMerchant> {
    const fromId = oldId.trim();
    const toId = nextId.trim();
    if (!fromId || !toId) {
      throw new Error('Merchant id is required.');
    }
    if (fromId === toId) {
      return this.update(fromId, payload);
    }

    const existing = await this.getById(toId);
    if (existing) {
      throw new Error(`Duplicate merchant id: ${toId}`);
    }

    const normalized: AdminMerchant = { ...payload, id: toId, updatedAt: nowIso() };
    const errors = validateMerchant(normalized);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }

    const created = await this.create(normalized);
    await this.delete(fromId);
    return created;
  },

  async disable(id: string): Promise<AdminMerchant> {
    return this.update(id, { isEnabled: false });
  },

  async delete(id: string): Promise<void> {
    await deleteContentEntry('merchants', id);
  },
};

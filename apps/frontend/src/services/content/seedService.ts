import {
  ITEMS,
  MERCHANTS,
  getItemById,
  type ItemDefinition,
  type Merchant,
} from '@theend/rpg-domain';
import type { AdminItem, AdminMerchant } from './models';
import { seedDefaultContent } from './contentApi';

const USE_SEED_FALLBACK = String(import.meta.env.VITE_USE_SEED_FALLBACK ?? 'true').trim().toLowerCase() !== 'false';

const RARITY_MAP: Record<ItemDefinition['rarity'], AdminItem['rarity']> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
};

function toAdminType(item: ItemDefinition): AdminItem['type'] {
  if (item.itemType === 'consumable') {
    return 'potion';
  }
  if (item.itemType === 'weapon') {
    return 'weapon';
  }
  if (['helmet', 'necklace', 'armor', 'outerwear', 'belt', 'gloves', 'shield', 'ring', 'legs', 'boots'].includes(item.itemType)) {
    return 'armor';
  }
  return 'misc';
}

function normalizeAdminSlot(slot: AdminItem['slot'] | string | undefined): AdminItem['slot'] {
  switch (slot) {
    case 'cloak':
      return 'outerwear';
    case 'knees':
      return 'legs';
    case 'charm':
      return 'necklace';
    case 'trinket':
      return 'ring';
    default:
      return (slot as AdminItem['slot']) ?? 'none';
  }
}

function toAdminSlot(item: ItemDefinition): AdminItem['slot'] {
  if (item.itemType === 'weapon') {
    return 'rightHand';
  }
  if (item.itemType === 'consumable') {
    return 'quick';
  }
  if (item.itemType === 'helmet') {
    return 'head';
  }
  if (item.itemType === 'necklace') {
    return 'necklace';
  }
  if (item.itemType === 'armor') {
    return 'chest';
  }
  if (item.itemType === 'outerwear') {
    return 'outerwear';
  }
  if (item.itemType === 'belt') {
    return 'belt';
  }
  if (item.itemType === 'ring') {
    return 'ring';
  }
  if (item.itemType === 'legs') {
    return 'legs';
  }
  if (item.itemType === 'boots') {
    return 'boots';
  }
  if (item.itemType === 'gloves') {
    return 'gloves';
  }
  if (item.itemType === 'shield') {
    return 'leftHand';
  }
  return 'none';
}

function seedItemFromDomain(item: ItemDefinition): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  return {
    id: item.id,
    name: item.name,
    type: toAdminType(item),
    subtype: item.itemSubType,
    slot: toAdminSlot(item),
    handsRequired: item.handsRequired ?? 1,
    rarity: RARITY_MAP[item.rarity] ?? 'common',
    price: item.price,
    stackable: item.stackable,
    maxStack: item.stackable ? 99 : 1,
    requiredStats: item.requiredStats,
    bonuses: item.bonuses,
    gameplayDescription: item.description,
    loreDescription: item.description,
    imagePath: item.icon,
    isEnabled: true,
  };
}

function toDomainItemType(adminItem: AdminItem): ItemDefinition['itemType'] {
  const slot = normalizeAdminSlot(adminItem.slot);

  if (adminItem.type === 'weapon') {
    return 'weapon';
  }

  if (adminItem.type === 'armor') {
    switch (slot) {
      case 'head':
        return 'helmet';
      case 'necklace':
        return 'necklace';
      case 'outerwear':
        return 'outerwear';
      case 'belt':
        return 'belt';
      case 'ring':
        return 'ring';
      case 'legs':
        return 'legs';
      case 'boots':
        return 'boots';
      case 'gloves':
        return 'gloves';
      case 'leftHand':
        return 'shield';
      default:
        return 'armor';
    }
  }

  return 'consumable';
}

function merchantTypeToAdmin(merchant: Merchant): AdminMerchant['type'] {
  if (merchant.merchantType === 'weaponsmith') {
    return 'blacksmith';
  }
  if (merchant.merchantType === 'armorer') {
    return 'general';
  }
  return 'alchemist';
}

function seedMerchantFromDomain(merchant: Merchant): Omit<AdminMerchant, 'createdAt' | 'updatedAt'> {
  return {
    id: merchant.id,
    name: merchant.name,
    city: 'Arklein',
    cityId: 'city_arklein',
    location: 'Main District',
    type: merchantTypeToAdmin(merchant),
    description: `${merchant.name} (seeded)`,
    priceMultiplier: 1,
    isEnabled: true,
    items: merchant.itemIds.map((itemId) => ({
      itemId,
      infiniteStock: true,
      isEnabled: true,
    })),
  };
}

export async function seedDefaultContentIfEmpty(): Promise<{ seeded: boolean; message: string }> {
  return seedDefaultContent();
}

export function toDomainItemDefinition(adminItem: AdminItem): ItemDefinition {
  const rarity: ItemDefinition['rarity'] = adminItem.rarity === 'common' || adminItem.rarity === 'uncommon' || adminItem.rarity === 'rare'
    ? adminItem.rarity
    : 'rare';

  const itemType = toDomainItemType(adminItem);

  return {
    id: adminItem.id,
    name: adminItem.name,
    itemType,
    itemSubType: adminItem.subtype || adminItem.type,
    handsRequired: itemType === 'weapon' && adminItem.handsRequired === 2 ? 2 : 1,
    price: Math.max(0, adminItem.price),
    requiredStats: adminItem.requiredStats ?? {},
    bonuses: adminItem.bonuses ?? {},
    stackable: adminItem.stackable,
    description: adminItem.gameplayDescription || adminItem.loreDescription || adminItem.name,
    icon: adminItem.imagePath || 'unknown',
    rarity,
  };
}

export function getDomainItemWithFallback(itemId: string, adminItems: AdminItem[]): ItemDefinition | null {
  const normalized = String(itemId ?? '').trim();
  const normalizedLower = normalized.toLowerCase();
  const fromAdmin = adminItems.find((item) => String(item.id ?? '').trim().toLowerCase() === normalizedLower && item.isEnabled);
  if (fromAdmin) {
    return toDomainItemDefinition(fromAdmin);
  }

  if (!USE_SEED_FALLBACK) {
    return null;
  }

  try {
    return getItemById(normalized);
  } catch {
    return null;
  }
}

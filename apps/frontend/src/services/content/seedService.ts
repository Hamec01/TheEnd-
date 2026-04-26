import {
  ITEMS,
  MERCHANTS,
  getItemById,
  type ItemDefinition,
  type Merchant,
} from '@theend/rpg-domain';
import type { AdminItem, AdminMerchant } from './models';
import { itemsService } from './itemsService';
import { merchantsService } from './merchantsService';
import { nowIso } from './storage';

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
  if (['helmet', 'armor', 'boots', 'gloves', 'shield'].includes(item.itemType)) {
    return 'armor';
  }
  return 'misc';
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
  if (item.itemType === 'armor') {
    return 'chest';
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
  if (adminItem.type === 'weapon') {
    return 'weapon';
  }

  if (adminItem.type === 'armor') {
    switch (adminItem.slot) {
      case 'head':
        return 'helmet';
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
  const currentItems = await itemsService.getAll();
  const currentMerchants = await merchantsService.getAll();
  if (currentItems.length > 0 || currentMerchants.length > 0) {
    return { seeded: false, message: 'Content already exists, seed skipped.' };
  }

  const itemSeeds = Object.values(ITEMS).map(seedItemFromDomain);
  for (const item of itemSeeds) {
    await itemsService.create(item);
  }

  const merchantSeeds = MERCHANTS.map(seedMerchantFromDomain);
  for (const merchant of merchantSeeds) {
    await merchantsService.create(merchant);
  }

  return {
    seeded: true,
    message: `Seeded ${itemSeeds.length} items and ${merchantSeeds.length} merchants at ${nowIso()}`,
  };
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
  const fromAdmin = adminItems.find((item) => item.id === itemId && item.isEnabled);
  if (fromAdmin) {
    return toDomainItemDefinition(fromAdmin);
  }

  try {
    return getItemById(itemId);
  } catch {
    return null;
  }
}

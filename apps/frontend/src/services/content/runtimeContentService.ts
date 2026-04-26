import { getMerchantItems, MERCHANTS, type ItemDefinition, type Merchant } from '@theend/rpg-domain';
import type { AdminItem, AdminMerchant } from './models';
import { itemsService } from './itemsService';
import { merchantsService } from './merchantsService';
import { getDomainItemWithFallback } from './seedService';

function mapMerchantType(type: AdminMerchant['type']): Merchant['merchantType'] {
  if (type === 'blacksmith') {
    return 'weaponsmith';
  }
  if (type === 'general') {
    return 'armorer';
  }
  return 'supplier';
}

export async function loadRuntimeAdminContent(): Promise<{ items: AdminItem[]; merchants: AdminMerchant[] }> {
  const [items, merchants] = await Promise.all([itemsService.getAll(), merchantsService.getAll()]);
  return {
    items: items.filter((item) => item.isEnabled),
    merchants: merchants.filter((merchant) => merchant.isEnabled),
  };
}

export function getRuntimeMerchants(adminMerchants: AdminMerchant[]): Merchant[] {
  if (adminMerchants.length === 0) {
    return MERCHANTS;
  }

  return adminMerchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    merchantType: mapMerchantType(merchant.type),
    itemIds: merchant.items.filter((entry) => entry.isEnabled).map((entry) => entry.itemId),
  }));
}

export function getRuntimeMerchantItems(merchantId: string, adminMerchants: AdminMerchant[], adminItems: AdminItem[]): ItemDefinition[] {
  const adminMerchant = adminMerchants.find((entry) => entry.id === merchantId);
  if (!adminMerchant) {
    return getMerchantItems(merchantId);
  }

  return adminMerchant.items
    .filter((entry) => entry.isEnabled)
    .map((entry) => getDomainItemWithFallback(entry.itemId, adminItems))
    .filter((item): item is ItemDefinition => Boolean(item));
}

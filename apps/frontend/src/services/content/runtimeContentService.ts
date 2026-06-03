import { getMerchantItems, MERCHANTS, type ItemDefinition, type Merchant } from '@theend/rpg-domain';
import type {
  AdminItem,
  AdminMerchant,
  AdminSkill,
  BlacksmithBalance,
  BlacksmithForgeTier,
  BlacksmithModule,
  BlacksmithQualityTier,
  BlacksmithTool,
  BlacksmithVisualPreset,
  RecipeVisualProfile,
} from './models';
import { getContentSnapshot } from './contentApi';
import { itemsService } from './itemsService';
import { merchantsService } from './merchantsService';
import { skillsService } from './skillsService';
import { getDomainItemWithFallback } from './seedService';

const USE_SEED_FALLBACK = String(import.meta.env.VITE_USE_SEED_FALLBACK ?? 'true').trim().toLowerCase() !== 'false';

function mapMerchantType(type: AdminMerchant['type']): Merchant['merchantType'] {
  if (type === 'blacksmith') {
    return 'weaponsmith';
  }
  if (type === 'general') {
    return 'armorer';
  }
  return 'supplier';
}

export async function loadRuntimeAdminContent(): Promise<{ items: AdminItem[]; merchants: AdminMerchant[]; skills: AdminSkill[] }> {
  const [items, merchants, skills] = await Promise.all([itemsService.getAll(), merchantsService.getAll(), skillsService.getAll()]);
  return {
    items: items.filter((item) => item.isEnabled),
    merchants: merchants.filter((merchant) => merchant.isEnabled),
    skills: skills.filter((skill) => skill.isPublished && !skill.isHidden),
  };
}

export interface RuntimeBlacksmithContent {
  forgeTiers: BlacksmithForgeTier[];
  modules: BlacksmithModule[];
  tools: BlacksmithTool[];
  qualityTiers: BlacksmithQualityTier[];
  visualPresets: BlacksmithVisualPreset[];
  recipeVisualProfiles: RecipeVisualProfile[];
  balance: BlacksmithBalance | null;
}

export async function loadRuntimeBlacksmithContent(): Promise<RuntimeBlacksmithContent> {
  const snapshot = await getContentSnapshot();
  const forgeTiers = (snapshot.blacksmithForgeTiers ?? []).filter((entry) => entry.isEnabled);
  const modules = (snapshot.blacksmithModules ?? []).filter((entry) => entry.isEnabled);
  const tools = (snapshot.blacksmithTools ?? []).filter((entry) => entry.isEnabled);
  const qualityTiers = snapshot.blacksmithQualityTiers ?? [];
  const visualPresets = snapshot.blacksmithVisualPresets ?? [];
  const recipeVisualProfiles = (snapshot.recipeVisualProfiles ?? []).filter((entry) => entry.isEnabled !== false);
  const balance = (snapshot.blacksmithBalance ?? [])[0] ?? null;
  return {
    forgeTiers,
    modules,
    tools,
    qualityTiers,
    visualPresets,
    recipeVisualProfiles,
    balance,
  };
}

export function getRuntimeMerchants(adminMerchants: AdminMerchant[]): Merchant[] {
  if (adminMerchants.length === 0) {
    return USE_SEED_FALLBACK ? MERCHANTS : [];
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
    return USE_SEED_FALLBACK ? getMerchantItems(merchantId) : [];
  }

  return adminMerchant.items
    .filter((entry) => entry.isEnabled)
    .map((entry) => {
      const item = getDomainItemWithFallback(entry.itemId, adminItems);
      if (!item) {
        return null;
      }

      const basePrice = entry.priceOverride ?? item.price;
      const merchantMultiplier = adminMerchant.priceMultiplier > 0 ? adminMerchant.priceMultiplier : 1;
      const entryMultiplier = entry.priceMultiplier && entry.priceMultiplier > 0 ? entry.priceMultiplier : 1;
      return {
        ...item,
        price: Math.max(0, Math.round(basePrice * merchantMultiplier * entryMultiplier)),
      };
    })
    .filter((item): item is ItemDefinition => Boolean(item));
}

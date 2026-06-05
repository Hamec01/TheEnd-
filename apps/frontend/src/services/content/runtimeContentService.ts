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
  BlacksmithItemTemplate,
  BlacksmithItemWorkAction,
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
  itemTemplates: BlacksmithItemTemplate[];
  itemWorkActions: BlacksmithItemWorkAction[];
}

export function getFallbackBlacksmithItemTemplates(): BlacksmithItemTemplate[] {
  return [
    {
      id: 'blacksmith_template_one_hand_sword',
      name: 'Одноручный меч',
      description: 'Базовый шаблон одноручного меча для свободной ковки.',
      itemType: 'weapon',
      subtype: 'sword',
      slot: 'rightHand',
      handsRequired: 1,
      baseDamageMin: 4,
      baseDamageMax: 8,
      damageCategory: 'physical',
      physicalType: 'slash',
      requiredRoles: [
        { id: 'main_metal', label: 'Основной металл', role: 'main_metal', required: true, quantity: 3 },
        { id: 'handle', label: 'Рукоять', role: 'handle', required: true, quantity: 1 },
        { id: 'binding', label: 'Обмотка', role: 'leather', required: true, quantity: 1 },
      ],
      optionalRoles: [
        { id: 'quench', label: 'Закалочная жидкость', role: 'quench_liquid', required: false, quantity: 1 },
        { id: 'catalyst', label: 'Катализатор', role: 'flux', required: false, quantity: 1 },
      ],
      allowedMainMaterialRoles: ['main_metal', 'ingot'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
      baseMaxAugmentSlots: 2,
      canAddAugmentSlots: true,
      canHaveRuneComplex: true,
      requiredBlacksmithLevel: 1,
      requiredSkillIds: [],
      tags: ['blacksmith_template', 'weapon', 'sword'],
      imageRef: { type: 'tileset', sheetId: 'blacksmith_forge_objects_384', frame: 7 },
      isEnabled: true,
    },
    {
      id: 'blacksmith_template_spear',
      name: 'Копьё',
      description: 'Длинное оружие с упором на древко и наконечник.',
      itemType: 'weapon',
      subtype: 'spear',
      slot: 'rightHand',
      handsRequired: 2,
      baseDamageMin: 5,
      baseDamageMax: 9,
      damageCategory: 'physical',
      physicalType: 'pierce',
      attackRange: 2,
      requiredRoles: [
        { id: 'main_metal', label: 'Наконечник', role: 'main_metal', required: true, quantity: 2 },
        { id: 'handle', label: 'Древко', role: 'wood', required: true, quantity: 2 },
        { id: 'binding', label: 'Крепление', role: 'leather', required: true, quantity: 1 },
      ],
      optionalRoles: [
        { id: 'quench', label: 'Закалочная жидкость', role: 'quench_liquid', required: false, quantity: 1 },
      ],
      allowedMainMaterialRoles: ['main_metal', 'ingot'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
      baseMaxAugmentSlots: 2,
      canAddAugmentSlots: true,
      canHaveRuneComplex: true,
      requiredBlacksmithLevel: 1,
      requiredSkillIds: [],
      tags: ['blacksmith_template', 'weapon', 'spear'],
      imageRef: { type: 'tileset', sheetId: 'blacksmith_forge_objects_384', frame: 9 },
      isEnabled: true,
    },
    {
      id: 'blacksmith_template_chestplate',
      name: 'Нагрудник',
      description: 'Защитный доспех из металлических пластин.',
      itemType: 'armor',
      subtype: 'chestplate',
      slot: 'chest',
      baseArmorValue: 6,
      requiredRoles: [
        { id: 'main_metal', label: 'Основной металл', role: 'main_metal', required: true, quantity: 4 },
        { id: 'binding', label: 'Подкладка', role: 'cloth', required: true, quantity: 1 },
      ],
      optionalRoles: [
        { id: 'quench', label: 'Закалочная жидкость', role: 'quench_liquid', required: false, quantity: 1 },
        { id: 'catalyst', label: 'Катализатор', role: 'flux', required: false, quantity: 1 },
      ],
      allowedMainMaterialRoles: ['main_metal', 'ingot'],
      allowedMaterialTiers: ['common', 'uncommon', 'rare', 'epic'],
      baseMaxAugmentSlots: 2,
      canAddAugmentSlots: true,
      canHaveRuneComplex: true,
      requiredBlacksmithLevel: 2,
      requiredSkillIds: [],
      tags: ['blacksmith_template', 'armor', 'chestplate'],
      imageRef: { type: 'tileset', sheetId: 'blacksmith_forge_objects_384', frame: 11 },
      isEnabled: true,
    },
  ];
}

export function getFallbackBlacksmithItemWorkActions(): BlacksmithItemWorkAction[] {
  return [
    {
      id: 'blacksmith_itemwork_improve',
      name: 'Улучшить предмет',
      description: 'Повышает урон или броню по итогам мини-игры.',
      actionType: 'improve_stats',
      allowedItemTypes: ['weapon', 'armor'],
      materialCosts: [{ materialId: 'item_iron_ore', quantity: 1 }],
      goldCost: 15,
      baseDifficulty: 38,
      risk: 18,
      statMultiplierDelta: 0.05,
      isEnabled: true,
    },
    {
      id: 'blacksmith_itemwork_add_socket',
      name: 'Добавить слот',
      description: 'Пытается добавить новый слот усиления.',
      actionType: 'add_socket',
      allowedItemTypes: ['weapon', 'armor'],
      materialCosts: [{ materialId: 'item_iron_ore', quantity: 2 }],
      goldCost: 35,
      baseDifficulty: 48,
      risk: 26,
      addSocketRules: {
        allowedAugmentTypes: ['rune', 'magic_stone', 'enchantment'],
        source: 'blacksmith_added',
      },
      isEnabled: true,
    },
    {
      id: 'blacksmith_itemwork_temper_buff',
      name: 'Временная закалка',
      description: 'Даёт временный боевой бафф предмету.',
      actionType: 'temporary_buff',
      allowedItemTypes: ['weapon', 'armor'],
      materialCosts: [{ materialId: 'item_coal_chunk', quantity: 1 }],
      goldCost: 12,
      baseDifficulty: 24,
      risk: 10,
      isEnabled: true,
    },
    {
      id: 'blacksmith_itemwork_dismantle',
      name: 'Разобрать предмет',
      description: 'Разобрать предмет на часть материалов.',
      actionType: 'dismantle',
      allowedItemTypes: ['weapon', 'armor'],
      goldCost: 0,
      baseDifficulty: 12,
      risk: 4,
      isEnabled: true,
    },
  ];
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
  const itemTemplates = (snapshot.blacksmithItemTemplates ?? []).filter((entry) => entry.isEnabled !== false);
  const itemWorkActions = (snapshot.blacksmithItemWorkActions ?? []).filter((entry) => entry.isEnabled !== false);
  return {
    forgeTiers,
    modules,
    tools,
    qualityTiers,
    visualPresets,
    recipeVisualProfiles,
    balance,
    itemTemplates: itemTemplates.length > 0 ? itemTemplates : getFallbackBlacksmithItemTemplates(),
    itemWorkActions: itemWorkActions.length > 0 ? itemWorkActions : getFallbackBlacksmithItemWorkActions(),
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

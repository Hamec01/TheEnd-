import { getItemById, } from '@theend/rpg-domain';
import { seedDefaultContent } from './contentApi';
const RARITY_MAP = {
    common: 'common',
    uncommon: 'uncommon',
    rare: 'rare',
};
function toAdminType(item) {
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
function toAdminSlot(item) {
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
function seedItemFromDomain(item) {
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
function toDomainItemType(adminItem) {
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
function merchantTypeToAdmin(merchant) {
    if (merchant.merchantType === 'weaponsmith') {
        return 'blacksmith';
    }
    if (merchant.merchantType === 'armorer') {
        return 'general';
    }
    return 'alchemist';
}
function seedMerchantFromDomain(merchant) {
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
export async function seedDefaultContentIfEmpty() {
    return seedDefaultContent();
}
export function toDomainItemDefinition(adminItem) {
    const rarity = adminItem.rarity === 'common' || adminItem.rarity === 'uncommon' || adminItem.rarity === 'rare'
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
export function getDomainItemWithFallback(itemId, adminItems) {
    const fromAdmin = adminItems.find((item) => item.id === itemId && item.isEnabled);
    if (fromAdmin) {
        return toDomainItemDefinition(fromAdmin);
    }
    try {
        return getItemById(itemId);
    }
    catch {
        return null;
    }
}

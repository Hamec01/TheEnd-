import { getMerchantItems, MERCHANTS } from '@theend/rpg-domain';
import { itemsService } from './itemsService';
import { merchantsService } from './merchantsService';
import { getDomainItemWithFallback } from './seedService';
function mapMerchantType(type) {
    if (type === 'blacksmith') {
        return 'weaponsmith';
    }
    if (type === 'general') {
        return 'armorer';
    }
    return 'supplier';
}
export async function loadRuntimeAdminContent() {
    const [items, merchants] = await Promise.all([itemsService.getAll(), merchantsService.getAll()]);
    return {
        items: items.filter((item) => item.isEnabled),
        merchants: merchants.filter((merchant) => merchant.isEnabled),
    };
}
export function getRuntimeMerchants(adminMerchants) {
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
export function getRuntimeMerchantItems(merchantId, adminMerchants, adminItems) {
    const adminMerchant = adminMerchants.find((entry) => entry.id === merchantId);
    if (!adminMerchant) {
        return getMerchantItems(merchantId);
    }
    return adminMerchant.items
        .filter((entry) => entry.isEnabled)
        .map((entry) => getDomainItemWithFallback(entry.itemId, adminItems))
        .filter((item) => Boolean(item));
}

import { getItemById } from './items';
import { addItemToInventory, hasEnoughGold } from './inventory';
export function buyItem(inventory, itemId) {
    const item = getItemById(itemId);
    if (!hasEnoughGold(inventory, item.price)) {
        return {
            ok: false,
            inventory,
            reason: 'Недостаточно золота.',
        };
    }
    const next = addItemToInventory({
        ...inventory,
        gold: inventory.gold - item.price,
    }, itemId, 1);
    return {
        ok: true,
        inventory: next,
    };
}

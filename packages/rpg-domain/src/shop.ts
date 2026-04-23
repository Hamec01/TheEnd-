import { getItemById } from './items';
import { addItemToInventory, hasEnoughGold, type InventoryState } from './inventory';

export interface ShopPurchaseResult {
  ok: boolean;
  inventory: InventoryState;
  reason?: string;
}

export function buyItem(inventory: InventoryState, itemId: string): ShopPurchaseResult {
  const item = getItemById(itemId);

  if (!hasEnoughGold(inventory, item.price)) {
    return {
      ok: false,
      inventory,
      reason: 'Недостаточно золота.',
    };
  }

  const next = addItemToInventory(
    {
      ...inventory,
      gold: inventory.gold - item.price,
    },
    itemId,
    1,
  );

  return {
    ok: true,
    inventory: next,
  };
}

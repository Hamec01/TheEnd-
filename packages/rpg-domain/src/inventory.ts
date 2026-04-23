export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface InventoryState {
  gold: number;
  items: InventoryItem[];
}

export function hasEnoughGold(inventory: InventoryState, price: number): boolean {
  return inventory.gold >= price;
}

export function addItemToInventory(inventory: InventoryState, itemId: string, quantity = 1): InventoryState {
  const existing = inventory.items.find((item) => item.itemId === itemId);
  if (existing) {
    return {
      ...inventory,
      items: inventory.items.map((item) =>
        item.itemId === itemId ? { ...item, quantity: item.quantity + quantity } : item,
      ),
    };
  }

  return {
    ...inventory,
    items: [...inventory.items, { itemId, quantity }],
  };
}

export function removeItemFromInventory(
  inventory: InventoryState,
  itemId: string,
  quantity = 1,
): InventoryState {
  const existing = inventory.items.find((item) => item.itemId === itemId);
  if (!existing || existing.quantity < quantity) {
    throw new Error('Not enough item quantity in inventory.');
  }

  const nextItems = inventory.items
    .map((item) =>
      item.itemId === itemId ? { ...item, quantity: item.quantity - quantity } : item,
    )
    .filter((item) => item.quantity > 0);

  return {
    ...inventory,
    items: nextItems,
  };
}

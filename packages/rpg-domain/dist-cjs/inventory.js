"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasEnoughGold = hasEnoughGold;
exports.addItemToInventory = addItemToInventory;
exports.removeItemFromInventory = removeItemFromInventory;
function hasEnoughGold(inventory, price) {
    return inventory.gold >= price;
}
function addItemToInventory(inventory, itemId, quantity = 1) {
    const existing = inventory.items.find((item) => item.itemId === itemId);
    if (existing) {
        return {
            ...inventory,
            items: inventory.items.map((item) => item.itemId === itemId ? { ...item, quantity: item.quantity + quantity } : item),
        };
    }
    return {
        ...inventory,
        items: [...inventory.items, { itemId, quantity }],
    };
}
function removeItemFromInventory(inventory, itemId, quantity = 1) {
    const existing = inventory.items.find((item) => item.itemId === itemId);
    if (!existing || existing.quantity < quantity) {
        throw new Error('Not enough item quantity in inventory.');
    }
    const nextItems = inventory.items
        .map((item) => item.itemId === itemId ? { ...item, quantity: item.quantity - quantity } : item)
        .filter((item) => item.quantity > 0);
    return {
        ...inventory,
        items: nextItems,
    };
}

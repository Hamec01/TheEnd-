"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyItem = buyItem;
const items_1 = require("./items");
const inventory_1 = require("./inventory");
function buyItem(inventory, itemId) {
    const item = (0, items_1.getItemById)(itemId);
    if (!(0, inventory_1.hasEnoughGold)(inventory, item.price)) {
        return {
            ok: false,
            inventory,
            reason: 'Недостаточно золота.',
        };
    }
    const next = (0, inventory_1.addItemToInventory)({
        ...inventory,
        gold: inventory.gold - item.price,
    }, itemId, 1);
    return {
        ok: true,
        inventory: next,
    };
}

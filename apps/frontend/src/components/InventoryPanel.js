import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { InventoryGrid } from './InventoryGrid';
import { TradeModal } from './TradeModal';
import { getItemById } from '@theend/rpg-domain';
export const InventoryPanel = ({ character, inventory, onClose, onSellItem, }) => {
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const inventoryItems = inventory.items.map(entry => getItemById(entry.itemId)).filter(Boolean);
    const handleSell = async () => {
        if (selectedItem) {
            try {
                await onSellItem(selectedItem.id);
                setTradeModalOpen(false);
                setSelectedItem(null);
            }
            catch (err) {
                console.error('Failed to sell item:', err);
            }
        }
    };
    return (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsxs("h2", { children: ["Inventory - ", character.name] }), _jsx("button", { onClick: onClose, children: "\u2715" })] }), _jsxs("p", { className: "gold", style: { display: 'inline-flex', marginBottom: '10px' }, children: ["\uD83E\uDE99 ", inventory.gold] }), _jsx(InventoryGrid, { title: "Your Items", items: inventoryItems, columns: 5, onItemClick: (item) => {
                        setSelectedItem(item);
                        setTradeModalOpen(true);
                    } }), _jsx(TradeModal, { isOpen: tradeModalOpen, action: "sell", item: selectedItem, playerGold: inventory.gold, onConfirm: handleSell, onCancel: () => {
                        setTradeModalOpen(false);
                        setSelectedItem(null);
                    } })] }) }));
};

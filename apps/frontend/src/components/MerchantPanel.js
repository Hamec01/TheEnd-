import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { InventoryGrid } from './InventoryGrid';
import { TradeModal } from './TradeModal';
import { getMerchantItems, getItemById } from '@theend/rpg-domain';
export const MerchantPanel = ({ merchant, inventory, onClose, onBuyItem, onSellItem, }) => {
    const [mode, setMode] = useState('buy');
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const merchantItems = useMemo(() => getMerchantItems(merchant.id), [merchant.id]);
    const inventoryItems = useMemo(() => inventory.items.map(entry => getItemById(entry.itemId)).filter(Boolean), [inventory.items]);
    const handleBuy = async () => {
        if (selectedItem) {
            try {
                await onBuyItem(selectedItem.id);
                setTradeModalOpen(false);
                setSelectedItem(null);
            }
            catch (err) {
                console.error('Failed to buy item:', err);
            }
        }
    };
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
    return (_jsx("div", { className: "battle-overlay", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal", children: [_jsxs("div", { className: "battle-window-head", children: [_jsx("h2", { children: merchant.name }), _jsx("button", { onClick: onClose, children: "\u2715" })] }), _jsxs("p", { className: "gold", style: { display: 'inline-flex', marginBottom: '10px' }, children: ["\uD83E\uDE99 Your Gold: ", inventory.gold] }), _jsxs("div", { style: { marginBottom: '12px', display: 'flex', gap: '8px' }, children: [_jsx("button", { className: `btn ${mode === 'buy' ? 'is-active' : ''}`, onClick: () => setMode('buy'), style: {
                                padding: '6px 12px',
                                border: mode === 'buy' ? '2px solid #d2aa66' : '2px solid #666',
                                background: mode === 'buy' ? 'rgba(210, 170, 102, 0.2)' : 'transparent',
                                color: '#efe5d1',
                                cursor: 'pointer',
                                borderRadius: '4px',
                            }, children: "Buy" }), _jsx("button", { className: `btn ${mode === 'sell' ? 'is-active' : ''}`, onClick: () => setMode('sell'), style: {
                                padding: '6px 12px',
                                border: mode === 'sell' ? '2px solid #d2aa66' : '2px solid #666',
                                background: mode === 'sell' ? 'rgba(210, 170, 102, 0.2)' : 'transparent',
                                color: '#efe5d1',
                                cursor: 'pointer',
                                borderRadius: '4px',
                            }, children: "Sell" })] }), mode === 'buy' ? (_jsx(InventoryGrid, { title: `${merchant.name}'s Wares`, items: merchantItems, columns: 5, onItemClick: (item) => {
                        setSelectedItem(item);
                        setTradeModalOpen(true);
                    } })) : (_jsx(InventoryGrid, { title: "Your Items to Sell", items: inventoryItems, columns: 5, onItemClick: (item) => {
                        setSelectedItem(item);
                        setTradeModalOpen(true);
                    } })), _jsx(TradeModal, { isOpen: tradeModalOpen, action: mode, item: selectedItem, playerGold: inventory.gold, onConfirm: mode === 'buy' ? handleBuy : handleSell, onCancel: () => {
                        setTradeModalOpen(false);
                        setSelectedItem(null);
                    } })] }) }));
};

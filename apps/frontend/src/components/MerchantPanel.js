import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { getItemById, getMerchantItems } from '@theend/rpg-domain';
import { InventoryGrid } from './InventoryGrid';
import { TradeModal } from './TradeModal';
export const MerchantPanel = ({ merchant, inventory, merchantItems: merchantItemsOverride, resolveItemById, resolveItemImage, merchantDescription, merchantLocation, merchantPortrait, onClose, onBuyItem, onSellItem, }) => {
    const [mode, setMode] = useState('buy');
    const [tradeModalOpen, setTradeModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const merchantInitial = merchant.name.trim().charAt(0).toUpperCase() || 'Т';
    const merchantItems = useMemo(() => merchantItemsOverride ?? getMerchantItems(merchant.id), [merchant.id, merchantItemsOverride]);
    const inventoryItems = useMemo(() => inventory.items
        .map((entry) => (resolveItemById ? resolveItemById(entry.itemId) : getItemById(entry.itemId)))
        .filter(Boolean), [inventory.items, resolveItemById]);
    const handleBuy = async () => {
        if (selectedItem) {
            try {
                await onBuyItem(selectedItem.id, merchant.id);
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
    return (_jsx("div", { className: "merchant-page", role: "dialog", "aria-modal": "true", children: _jsxs("section", { className: "card battle-window wm-modal merchant-page-window", children: [_jsxs("div", { className: "battle-window-head merchant-page-head", children: [_jsx("h2", { children: merchant.name }), _jsx("button", { onClick: onClose, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C" })] }), _jsxs("section", { className: "merchant-page-hero card", children: [merchantPortrait ? (_jsx("img", { className: "merchant-page-portrait", src: merchantPortrait, alt: merchant.name })) : (_jsx("div", { className: "merchant-page-portrait merchant-page-portrait-fallback", "aria-hidden": "true", children: merchantInitial })), _jsxs("div", { className: "merchant-page-hero-copy", children: [_jsx("span", { className: "merchant-page-location", children: merchantLocation?.trim() || 'Торговая лавка' }), _jsx("h3", { children: merchant.name }), _jsx("p", { className: "muted", children: merchantDescription?.trim() || 'Этот торговец уже доступен в городе и продаёт предметы, которые вы задали в админке.' })] })] }), _jsxs("p", { className: "gold", style: { display: 'inline-flex', marginBottom: '10px' }, children: ["\u0412\u0430\u0448\u0435 \u0437\u043E\u043B\u043E\u0442\u043E: ", inventory.gold] }), _jsxs("div", { style: { marginBottom: '12px', display: 'flex', gap: '8px' }, children: [_jsx("button", { className: `btn ${mode === 'buy' ? 'is-active' : ''}`, onClick: () => setMode('buy'), style: {
                                padding: '6px 12px',
                                border: mode === 'buy' ? '2px solid #d2aa66' : '2px solid #666',
                                background: mode === 'buy' ? 'rgba(210, 170, 102, 0.2)' : 'transparent',
                                color: '#efe5d1',
                                cursor: 'pointer',
                                borderRadius: '4px',
                            }, children: "\u041A\u0443\u043F\u0438\u0442\u044C" }), _jsx("button", { className: `btn ${mode === 'sell' ? 'is-active' : ''}`, onClick: () => setMode('sell'), style: {
                                padding: '6px 12px',
                                border: mode === 'sell' ? '2px solid #d2aa66' : '2px solid #666',
                                background: mode === 'sell' ? 'rgba(210, 170, 102, 0.2)' : 'transparent',
                                color: '#efe5d1',
                                cursor: 'pointer',
                                borderRadius: '4px',
                            }, children: "\u041F\u0440\u043E\u0434\u0430\u0442\u044C" })] }), mode === 'buy' ? (_jsx(InventoryGrid, { title: `Товары: ${merchant.name}`, items: merchantItems, columns: 5, resolveItemImage: resolveItemImage, onItemClick: (item) => {
                        setSelectedItem(item);
                        setTradeModalOpen(true);
                    } })) : (_jsx(InventoryGrid, { title: "\u0412\u0430\u0448\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u043D\u0430 \u043F\u0440\u043E\u0434\u0430\u0436\u0443", items: inventoryItems, columns: 5, resolveItemImage: resolveItemImage, onItemClick: (item) => {
                        setSelectedItem(item);
                        setTradeModalOpen(true);
                    } })), _jsx(TradeModal, { isOpen: tradeModalOpen, action: mode, item: selectedItem, playerGold: inventory.gold, price: mode === 'buy' ? selectedItem?.price : selectedItem ? Math.max(1, Math.floor(selectedItem.price * 0.6)) : undefined, onConfirm: mode === 'buy' ? handleBuy : handleSell, onCancel: () => {
                        setTradeModalOpen(false);
                        setSelectedItem(null);
                    } })] }) }));
};

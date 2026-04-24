import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const TradeModal = ({ isOpen, action, item, playerGold, merchantGold, onConfirm, onCancel, }) => {
    if (!isOpen || !item)
        return null;
    const basePrice = 100; // Default price, can be customized per item
    const price = action === 'buy' ? basePrice : Math.floor(basePrice * 0.5);
    const canAfford = playerGold >= price;
    const title = action === 'buy' ? `Buy ${item.name}?` : `Sell ${item.name}?`;
    return (_jsx("div", { className: "trade-modal", onClick: onCancel, children: _jsxs("div", { className: "trade-modal-content", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "trade-modal-title", children: title }), _jsx("div", { className: "trade-modal-item", children: _jsx("span", { className: "trade-modal-item-name", children: item.name }) }), _jsxs("div", { className: "trade-modal-item", children: [_jsx("span", { className: "trade-modal-item-name", children: "Price:" }), _jsxs("span", { className: "trade-modal-item-price", children: [price, " \uD83D\uDCB0"] })] }), action === 'buy' ? (_jsxs("div", { className: "trade-modal-gold", children: ["Your Gold: ", playerGold, " \uD83D\uDCB0 ", !canAfford && _jsx("span", { style: { color: '#d06d68' }, children: "Not enough!" })] })) : (_jsxs("div", { className: "trade-modal-gold", children: ["You will receive: ", price, " \uD83D\uDCB0"] })), _jsxs("div", { className: "trade-modal-buttons", children: [_jsx("button", { className: "trade-modal-btn confirm", onClick: onConfirm, disabled: !canAfford && action === 'buy', children: "Confirm" }), _jsx("button", { className: "trade-modal-btn cancel", onClick: onCancel, children: "Cancel" })] })] }) }));
};

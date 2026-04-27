import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const TradeModal = ({ isOpen, action, item, playerGold, price, merchantGold, onConfirm, onCancel, }) => {
    if (!isOpen || !item)
        return null;
    const resolvedPrice = typeof price === 'number'
        ? price
        : action === 'buy'
            ? item.price
            : Math.max(1, Math.floor(item.price * 0.6));
    const canAfford = playerGold >= resolvedPrice;
    const title = action === 'buy' ? `Buy ${item.name}?` : `Sell ${item.name}?`;
    return (_jsx("div", { className: "trade-modal", onClick: onCancel, children: _jsxs("div", { className: "trade-modal-content", onClick: (e) => e.stopPropagation(), children: [_jsx("h2", { className: "trade-modal-title", children: title }), _jsx("div", { className: "trade-modal-item", children: _jsx("span", { className: "trade-modal-item-name", children: item.name }) }), _jsxs("div", { className: "trade-modal-item", children: [_jsx("span", { className: "trade-modal-item-name", children: "Price:" }), _jsxs("span", { className: "trade-modal-item-price", children: [resolvedPrice, " gold"] })] }), action === 'buy' ? (_jsxs("div", { className: "trade-modal-gold", children: ["Your Gold: ", playerGold, " ", !canAfford && _jsx("span", { style: { color: '#d06d68' }, children: "Not enough!" })] })) : (_jsxs("div", { className: "trade-modal-gold", children: ["You will receive: ", resolvedPrice, " gold"] })), _jsxs("div", { className: "trade-modal-buttons", children: [_jsx("button", { className: "trade-modal-btn confirm", onClick: onConfirm, disabled: !canAfford && action === 'buy', children: "Confirm" }), _jsx("button", { className: "trade-modal-btn cancel", onClick: onCancel, children: "Cancel" })] })] }) }));
};

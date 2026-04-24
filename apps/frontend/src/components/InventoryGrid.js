import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ItemSlot } from './ItemSlot';
export const InventoryGrid = ({ title, items, onItemClick, onDragStart, onDrop, columns = 4, isDraggingFrom, }) => {
    return (_jsxs("div", { className: "inventory-grid-container", children: [_jsx("h3", { className: "inventory-title", children: title }), _jsx("div", { className: "inventory-grid", style: { gridTemplateColumns: `repeat(${columns}, 1fr)` }, children: items.map((item, index) => (_jsx(ItemSlot, { item: item, iconEmoji: ['⚔️', '🛡️', '🧪', '💎'][index % 4], onClick: () => item && onItemClick?.(item, index), onDragStart: onDragStart, onDrop: onDrop, isDragging: isDraggingFrom === String(index) }, index))) })] }));
};

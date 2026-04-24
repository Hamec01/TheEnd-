import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
export const ItemSlot = ({ item, iconEmoji, iconImage, onClick, showPrice = false, price, onDragStart, onDrop, isDragging, }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    if (!item) {
        return (_jsxs("div", { className: "item-slot empty", onClick: onClick, children: [_jsx("div", { className: "item-slot-icon", children: "\u2B1C" }), _jsx("div", { className: "item-slot-name", children: "Empty" })] }));
    }
    const getDamage = (item) => {
        let damage = 0;
        if (item.bonuses) {
            if (item.bonuses.strength)
                damage += item.bonuses.strength * 1.5;
            if (item.bonuses.dexterity)
                damage += item.bonuses.dexterity * 1.2;
        }
        return Math.round(damage);
    };
    const getDefense = (item) => {
        let defense = 0;
        if (item.bonuses) {
            if (item.bonuses.constitution)
                defense += item.bonuses.constitution * 0.8;
        }
        return Math.round(defense);
    };
    const damage = getDamage(item);
    const defense = getDefense(item);
    const handleDragStart = (e) => {
        if (item && onDragStart) {
            onDragStart(item);
            e.dataTransfer.effectAllowed = 'move';
        }
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const handleDrop = (e) => {
        e.preventDefault();
        if (item && onDrop) {
            onDrop(item);
        }
    };
    return (_jsxs("div", { className: `item-slot ${isDragging ? 'dragging' : ''}`, onClick: onClick, onMouseEnter: () => setShowTooltip(true), onMouseLeave: () => setShowTooltip(false), draggable: !!item, onDragStart: handleDragStart, onDragOver: handleDragOver, onDrop: handleDrop, children: [_jsx("div", { className: "item-slot-icon", style: iconImage ? { backgroundImage: `url('${iconImage}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } : {}, children: !iconImage && (iconEmoji || '📦') }), _jsx("div", { className: "item-slot-name", children: item.name.substring(0, 10) }), showTooltip && (_jsxs("div", { className: "item-tooltip", children: [_jsx("div", { className: "tooltip-title", children: item.name }), damage > 0 && (_jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "Damage:" }), _jsxs("span", { className: "tooltip-value", children: ["+", damage] })] })), defense > 0 && (_jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "Defense:" }), _jsxs("span", { className: "tooltip-value", children: ["+", defense] })] })), item.bonuses && (_jsxs(_Fragment, { children: [item.bonuses.strength && (_jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "STR:" }), _jsxs("span", { className: "tooltip-value", children: ["+", item.bonuses.strength] })] })), item.bonuses.constitution && (_jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "CON:" }), _jsxs("span", { className: "tooltip-value", children: ["+", item.bonuses.constitution] })] })), item.bonuses.dexterity && (_jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "DEX:" }), _jsxs("span", { className: "tooltip-value", children: ["+", item.bonuses.dexterity] })] })), item.bonuses.intelligence && (_jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "INT:" }), _jsxs("span", { className: "tooltip-value", children: ["+", item.bonuses.intelligence] })] }))] })), showPrice && price !== undefined && (_jsx("div", { className: "tooltip-rarity", children: _jsxs("div", { className: "tooltip-stat", children: [_jsx("span", { className: "tooltip-label", children: "Price:" }), _jsxs("span", { className: "tooltip-value", children: [price, " \uD83D\uDCB0"] })] }) })), item.rarity && (_jsx("div", { className: `tooltip-rarity rarity-${item.rarity}`, children: item.rarity.toUpperCase() }))] }))] }));
};

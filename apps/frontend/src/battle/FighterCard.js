import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function stateLabel(state) {
    if (state === 'attack') {
        return 'Attacking';
    }
    if (state === 'hit') {
        return 'Hit';
    }
    if (state === 'block') {
        return 'Blocking';
    }
    if (state === 'dodge') {
        return 'Dodge';
    }
    return 'Idle';
}
export function FighterCard({ fighter, highlighted = false, side = 'player', visualState = 'idle', floatingText, subtitle, }) {
    const hpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentHp / fighter.maxHp) * 100)));
    const mpPercent = Math.max(0, Math.min(100, Math.round((fighter.currentMp / Math.max(1, fighter.maxMp)) * 100)));
    const staminaPercent = Math.max(0, Math.min(100, Math.round((fighter.currentStamina / fighter.maxStamina) * 100)));
    return (_jsxs("div", { className: [
            'fighter-card',
            'fighter-card-compact',
            'fighter-card-column',
            highlighted ? 'is-highlighted' : '',
            fighter.isAlive ? '' : 'is-dead',
            `fighter-side-${side}`,
            `fighter-state-${visualState}`,
        ]
            .filter(Boolean)
            .join(' '), children: [_jsxs("div", { className: "fighter-header", children: [_jsxs("div", { className: "fighter-name-title", children: [_jsx("strong", { children: fighter.name }), subtitle && _jsx("span", { className: "fighter-subtitle", children: subtitle })] }), _jsx("span", { className: `fighter-state-badge ${fighter.isAlive ? 'alive' : 'dead'}`, children: fighter.isAlive ? stateLabel(visualState) : 'Down' })] }), _jsxs("div", { className: "fighter-avatar-section", children: [_jsx("div", { className: "fighter-avatar", children: fighter.name.slice(0, 2).toUpperCase() }), _jsxs("div", { className: "fighter-silhouette-grid", "aria-label": "Combat silhouette", children: [_jsx("span", { className: "slot-head", title: "Helmet", children: "H" }), _jsx("span", { className: "slot-weapon", title: "Weapon", children: "W" }), _jsx("span", { className: "slot-chest", title: "Armor", children: "C" }), _jsx("span", { className: "slot-shield", title: "Shield", children: "S" }), _jsx("span", { className: "slot-gloves", title: "Gloves", children: "G" }), _jsx("span", { className: "slot-boots", title: "Boots", children: "B" })] }), floatingText && _jsx("div", { className: "fighter-floating-text", children: floatingText })] }), _jsxs("div", { className: "fighter-bars", children: [_jsxs("div", { className: "bar-row", children: [_jsxs("div", { className: "bar-label", children: [_jsx("span", { children: "HP" }), _jsxs("span", { className: "bar-value", children: [fighter.currentHp, "/", fighter.maxHp] })] }), _jsx("div", { className: "meter hp-meter", children: _jsx("span", { style: { width: `${hpPercent}%` } }) })] }), _jsxs("div", { className: "bar-row", children: [_jsxs("div", { className: "bar-label", children: [_jsx("span", { children: "MP" }), _jsxs("span", { className: "bar-value", children: [fighter.currentMp, "/", fighter.maxMp] })] }), _jsx("div", { className: "meter mana-meter", children: _jsx("span", { style: { width: `${mpPercent}%` } }) })] }), _jsxs("div", { className: "bar-row", children: [_jsxs("div", { className: "bar-label", children: [_jsx("span", { children: "STA" }), _jsxs("span", { className: "bar-value", children: [fighter.currentStamina, "/", fighter.maxStamina] })] }), _jsx("div", { className: "meter stamina-meter", children: _jsx("span", { style: { width: `${staminaPercent}%` } }) })] })] }), _jsxs("div", { className: "fighter-weapon-row", children: [_jsx("span", { children: "Weapon:" }), _jsx("strong", { children: fighter.dexterity >= fighter.strength ? 'Light / Ranged' : 'Melee' })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { TopStatusBar } from './TopStatusBar';
import { PlayerQuickPanel } from './PlayerQuickPanel';
import { WorldMapCanvas } from './WorldMapCanvas';
import { ContextActionPanel } from './ContextActionPanel';
export function WorldMapScreen(props) {
    const { character, inventory, equipment, battleStats, chatLines, onOpenStats, onOpenInventory, onOpenClan, onExit, onOpenArena, onStartCombat, onOpenMerchant, onOpenArenaNpc, onOpenSkills, onStatus, } = props;
    const [contextMode, setContextMode] = useState('empty');
    const [locationView, setLocationView] = useState('map');
    const selectedNode = null;
    const selectedLocationName = 'Арклейн';
    const avatarLetter = character.name.trim().charAt(0).toUpperCase() || 'H';
    const quickButtons = useMemo(() => [
        {
            id: 'combat',
            tone: 'red',
            icon: '⚔',
            title: 'Combat status',
            onClick: () => setContextMode('combat'),
        },
        {
            id: 'messages',
            tone: 'blue',
            icon: '✉',
            title: 'Messages / quests / notifications',
            badge: 3,
            onClick: () => setContextMode('npc'),
        },
        {
            id: 'inventory',
            tone: 'yellow',
            icon: '🎒',
            title: 'Инвентарь и экипировка',
            onClick: () => onOpenInventory(),
        },
    ], [onOpenInventory]);
    async function handleAction(actionId, kind) {
        if (kind === 'combat' || actionId === 'enter-battle') {
            await onStartCombat();
            setContextMode('combat');
            return;
        }
        if (kind === 'trade') {
            onOpenInventory();
            onStatus(`Trade panel opened for ${selectedLocationName}.`);
            return;
        }
        if (kind === 'talk' || kind === 'quest') {
            setContextMode('npc');
            onStatus(`Interaction started in ${selectedLocationName}.`);
            return;
        }
        if (actionId === 'retreat') {
            setContextMode('location');
            onStatus('Retreat selected.');
            return;
        }
        onStatus(`Action: ${actionId}`);
    }
    function handleOpenLocation(locationId) {
        if (locationId !== 'arklein') {
            return;
        }
        setLocationView('arklein');
        setContextMode('location');
        onStatus('Вы вошли в Арклейн. Заглушка города открыта.');
    }
    function handleReturnToMap() {
        setLocationView('map');
        setContextMode('empty');
        onStatus('Вы вернулись на карту региона.');
    }
    function handleOpenArkleinMerchant() {
        onOpenMerchant();
        onStatus('Открыт торговец Арклейна.');
    }
    function handleOpenSkillsTeacher() {
        onOpenSkills();
        onStatus('Учитель навыков Арклейна готов к обучению.');
    }
    async function handleEnterArena() {
        onOpenArena();
        onStatus('Открыт зал арены Арклейна.');
    }
    return (_jsxs("section", { className: "wm-shell", children: [_jsx(TopStatusBar, { name: character.name, gold: inventory.gold, level: character.level, exp: character.exp, statusValue: character.activeStats.strength, oreValue: Math.max(0, character.activeStats.constitution + 80), crystalValue: Math.max(0, character.activeStats.intelligence + 40), woodValue: Math.max(0, character.activeStats.stamina - 10), meatValue: Math.max(0, character.activeStats.hp - 160), herbValue: Math.max(0, character.activeStats.perception + 2), onStats: onOpenStats, onSkills: onOpenSkills, onInventory: onOpenInventory, onMap: () => {
                    setLocationView('map');
                    setContextMode('empty');
                }, onClan: onOpenClan, onExit: onExit }), _jsxs("section", { className: "wm-grid", children: [_jsx(PlayerQuickPanel, { name: character.name, avatarLetter: avatarLetter, hpText: `${battleStats.hp}/${character.activeStats.hp}`, mpText: `${battleStats.mp}/${character.activeStats.mp}`, staminaText: `${battleStats.stamina}/${character.activeStats.stamina}`, activeStats: character.activeStats, equipment: equipment, inventory: inventory, quickActions: quickButtons }), locationView === 'map' ? (_jsx(WorldMapCanvas, { onOpenLocation: handleOpenLocation })) : (_jsxs("section", { className: "wm-map card", children: [_jsxs("div", { className: "wm-map-surface wm-city-surface", children: [_jsx("div", { className: "wm-map-title", children: "\u0410\u0440\u043A\u043B\u0435\u0439\u043D" }), _jsxs("div", { className: "wm-city-panel", children: [_jsxs("div", { className: "wm-city-copy", children: [_jsx("h2", { children: "\u0413\u043E\u0440\u043E\u0434\u0441\u043A\u0430\u044F \u0437\u0430\u0433\u043B\u0443\u0448\u043A\u0430" }), _jsx("p", { className: "muted", children: "\u0421\u0435\u0439\u0447\u0430\u0441 \u0437\u0434\u0435\u0441\u044C \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0433\u043E\u0440\u043E\u0434\u0441\u043A\u043E\u0439 \u0442\u043E\u0440\u0433\u043E\u0432\u0435\u0446, \u0443\u0447\u0438\u0442\u0435\u043B\u044C \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u0438 \u0432\u0445\u043E\u0434 \u043D\u0430 \u0430\u0440\u0435\u043D\u0443. \u041E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0442\u043E\u0447\u043A\u0438 \u043F\u043E\u043A\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u044B." })] }), _jsxs("div", { className: "wm-city-actions", children: [_jsx("button", { onClick: handleOpenArkleinMerchant, children: "\u0422\u043E\u0440\u0433\u043E\u0432\u0435\u0446" }), _jsx("button", { onClick: handleOpenSkillsTeacher, children: "\u0423\u0447\u0438\u0442\u0435\u043B\u044C \u043D\u0430\u0432\u044B\u043A\u043E\u0432" }), _jsx("button", { onClick: () => { void handleEnterArena(); }, children: "\u0410\u0440\u0435\u043D\u0430" }), _jsx("button", { disabled: true, children: "\u0422\u0430\u0432\u0435\u0440\u043D\u0430" }), _jsx("button", { disabled: true, children: "\u041A\u0443\u0437\u043D\u0438\u0446\u0430" }), _jsx("button", { disabled: true, children: "\u0413\u0438\u043B\u044C\u0434\u0438\u044F" })] })] })] }), _jsxs("footer", { className: "wm-map-legend", children: [_jsx("span", { children: "\u0410\u0440\u043A\u043B\u0435\u0439\u043D | \u0420\u0430\u0431\u043E\u0442\u0430\u044E\u0442: \u0442\u043E\u0440\u0433\u043E\u0432\u0435\u0446, \u0443\u0447\u0438\u0442\u0435\u043B\u044C \u043D\u0430\u0432\u044B\u043A\u043E\u0432 \u0438 \u0430\u0440\u0435\u043D\u0430 | \u041E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0442\u043E\u0447\u043A\u0438 \u0437\u0430\u043A\u0440\u044B\u0442\u044B" }), _jsx("button", { className: "wm-city-back", onClick: handleReturnToMap, children: "\u041D\u0430\u0437\u0430\u0434 \u043A \u043A\u0430\u0440\u0442\u0435" })] })] })), _jsxs("div", { className: "wm-right-stack", children: [_jsx(ContextActionPanel, { mode: contextMode, selectedNode: selectedNode, onAction: handleAction }), _jsxs("section", { className: "wm-chat card", children: [_jsx("h3", { children: "\u0427\u0430\u0442 \u043E\u0431\u0449\u0438\u0439" }), _jsx("div", { className: "wm-chat-log", children: chatLines.map((line, index) => (_jsx("p", { children: line }, `${line}-${index}`))) }), _jsxs("div", { className: "wm-chat-input", children: [_jsx("input", { placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435..." }), _jsx("button", { children: "\u25B6" })] })] })] })] }), _jsxs("footer", { className: "wm-footer card", children: [_jsxs("span", { children: ["\u041B\u043E\u043A\u0430\u0446\u0438\u044F: ", selectedLocationName, " (52, 38)"] }), _jsx("span", { children: "\u041E\u043D\u043B\u0430\u0439\u043D: 124" }), _jsx("span", { children: "\u041F\u043E\u0447\u0442\u0430 (2)" }), _jsx("span", { children: "22:41" })] })] }));
}

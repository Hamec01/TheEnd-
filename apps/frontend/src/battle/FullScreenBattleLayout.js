import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import { BattleFieldTactical } from './BattleFieldTactical';
import { FighterListColumn } from './FighterListColumn';
import { ActionPanel } from './ActionPanel';
import { CombatFeedbackArea } from './CombatFeedbackArea';
export const FullScreenBattleLayout = ({ combatState, feedbackMessages, onCombatAction, onRoundEnd, }) => {
    const [selectedFighterId, setSelectedFighterId] = useState(combatState.entities.find(e => e.team === 'LEFT')?.id || null);
    const [selectedTile, setSelectedTile] = useState(null);
    const [selectedAction, setSelectedAction] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    // Get available actions for the selected fighter
    const getAvailableActions = () => {
        // This should be populated from the API based on the selected fighter
        return [
            { id: 'basic_attack', name: 'Basic Attack', cost: 1, costType: 'action', icon: '⚔️' },
            { id: 'power_attack', name: 'Power Attack', cost: 2, costType: 'action', icon: '💥' },
            { id: 'defend', name: 'Defend', cost: 1, costType: 'action', icon: '🛡️' },
            { id: 'special_move', name: 'Special Move', cost: 10, costType: 'mana', icon: '✨' },
        ];
    };
    const handleTileClick = useCallback((row, col) => {
        setSelectedTile([row, col]);
        if (selectedAction) {
            // Execute action on tile
            const selectedFighter = combatState.entities.find((f) => f.id === selectedFighterId);
            if (selectedFighter) {
                // Find target at tile if any
                const targetFighter = combatState.entities.find((f) => f.battlefieldX === row && f.battlefieldY === col);
                onCombatAction(selectedAction.id, targetFighter?.id || '', [row, col]);
                setSelectedAction(null);
            }
        }
    }, [selectedAction, selectedFighterId, combatState, onCombatAction]);
    const handleTileRightClick = (row, col, e) => {
        e.preventDefault();
        const fighter = combatState.entities.find((f) => f.battlefieldX === row && f.battlefieldY === col);
        if (fighter) {
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };
    const handleActionSelect = useCallback((action) => {
        setSelectedAction(action);
    }, []);
    const getAvailableResources = () => {
        const selectedFighter = combatState.entities.find((f) => f.id === selectedFighterId);
        return {
            mana: selectedFighter?.currentMp || 0,
            stamina: selectedFighter?.currentStamina || 0,
            actions: 3, // Placeholder
        };
    };
    return (_jsxs("div", { className: "battle-layout fullscreen-battle", children: [_jsx(FighterListColumn, { fighters: combatState.entities.filter((f) => f.team === 'LEFT'), selectedFighterId: selectedFighterId, onFighterSelect: setSelectedFighterId, isEnemySide: false }), _jsxs("div", { className: "battle-center-column", children: [_jsx(BattleFieldTactical, { combatState: combatState, selectedTile: selectedTile, onTileClick: handleTileClick, onTileRightClick: handleTileRightClick }), _jsx(CombatFeedbackArea, { messages: feedbackMessages }), _jsx("button", { onClick: onRoundEnd, style: {
                            padding: '10px 20px',
                            fontSize: '1rem',
                            minHeight: '42px',
                            alignSelf: 'center',
                        }, children: "End Turn" })] }), _jsx(FighterListColumn, { fighters: combatState.entities.filter((f) => f.team === 'RIGHT'), selectedFighterId: null, onFighterSelect: () => { }, isEnemySide: true }), _jsx("div", { style: { position: 'absolute', bottom: '12px', right: '12px', width: '280px' }, children: _jsx(ActionPanel, { actions: getAvailableActions(), onActionSelect: handleActionSelect, availableResources: getAvailableResources() }) }), contextMenu && (_jsx(ContextMenu, { x: contextMenu.x, y: contextMenu.y, onClose: () => setContextMenu(null) }))] }));
};
const ContextMenu = ({ x, y, onClose, }) => {
    return (_jsx("div", { className: "context-menu", style: { left: `${x}px`, top: `${y}px` }, onMouseLeave: onClose, children: _jsxs("div", { className: "context-menu-item", children: [_jsx("span", { className: "context-menu-icon", children: "\u274C" }), "Cancel"] }) }));
};

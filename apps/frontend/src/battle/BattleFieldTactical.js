import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const BattleFieldTactical = ({ combatState, selectedTile, onTileClick, onTileRightClick, }) => {
    const GRID_SIZE = 8;
    // Helper to get fighter at position
    const getFighterAt = (row, col) => {
        const allFighters = [...combatState.entities];
        return allFighters.find((f) => f.battlefieldX === row && f.battlefieldY === col) || null;
    };
    // Helper to determine tile class
    const getTileClass = (row, col) => {
        const classes = ['tactical-tile'];
        const fighter = getFighterAt(row, col);
        if (!fighter) {
            classes.push('tactical-tile.empty');
            return classes.join(' ');
        }
        if (combatState.entities.some((a) => a.id === fighter.id && a.team === 'LEFT')) {
            classes.push('ally');
        }
        else {
            classes.push('enemy');
        }
        if (selectedTile && selectedTile[0] === row && selectedTile[1] === col) {
            classes.push('selected');
        }
        return classes.join(' ');
    };
    const getTileContent = (row, col) => {
        const fighter = getFighterAt(row, col);
        return fighter ? fighter.name.charAt(0).toUpperCase() : '';
    };
    return (_jsxs("div", { className: "tactical-field", children: [_jsxs("div", { className: "tactical-header", children: [_jsx("h4", { children: "Tactical Battlefield" }), _jsx("div", { className: "distance-info" })] }), _jsx("div", { className: "tactical-grid", children: Array.from({ length: GRID_SIZE }).map((_, row) => Array.from({ length: GRID_SIZE }).map((_, col) => (_jsx("button", { className: getTileClass(row, col), onClick: () => onTileClick(row, col), onContextMenu: (e) => onTileRightClick(row, col, e), children: getTileContent(row, col) }, `${row}-${col}`)))) })] }));
};

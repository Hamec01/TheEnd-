import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { BATTLEFIELD_GRID_SIZE, DistanceBand, TeamSide, getBattlefieldTilePlacements, getDistanceBandForGap, } from '@theend/rpg-domain';
export function BattleField({ entities, distance, selectedTargetId, moveSelectionEnabled = false, selectedMoveTile, onMoveTileSelect }) {
    const placements = getBattlefieldTilePlacements(entities, distance);
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const placementByTile = new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement]));
    const targetPlacement = placements.find((placement) => placement.entityId === selectedTargetId) ?? null;
    const tiles = Array.from({ length: BATTLEFIELD_GRID_SIZE * BATTLEFIELD_GRID_SIZE }, (_, index) => {
        const x = index % BATTLEFIELD_GRID_SIZE;
        const y = Math.floor(index / BATTLEFIELD_GRID_SIZE);
        return { x, y, placement: placementByTile.get(`${x}:${y}`) };
    });
    return (_jsxs("div", { className: "battle-field", children: [_jsxs("div", { className: "battle-field-head", children: [_jsxs("div", { className: "distance-pill", children: ["\u0414\u0438\u0441\u0442\u0430\u043D\u0446\u0438\u044F: ", distance] }), _jsxs("div", { className: "distance-grid", children: [_jsx("span", { className: distance === DistanceBand.Melee ? 'active' : '', children: "\u0411\u041B\u0418\u0416\u041D\u042F\u042F" }), _jsx("span", { className: distance === DistanceBand.Near ? 'active' : '', children: "\u0421\u0420\u0415\u0414\u041D\u042F\u042F" }), _jsx("span", { className: distance === DistanceBand.Far ? 'active' : '', children: "\u0414\u0410\u041B\u042C\u041D\u042F\u042F" })] })] }), _jsxs("div", { className: "battle-grid-shell", children: [_jsx("div", { className: "battle-grid-legend battle-grid-legend-top", children: Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, index) => (_jsx("span", { children: index + 1 }, `col-${index}`))) }), _jsxs("div", { className: "battle-grid-body", children: [_jsx("div", { className: "battle-grid-legend battle-grid-legend-side", children: Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, index) => (_jsx("span", { children: index + 1 }, `row-${index}`))) }), _jsx("div", { className: "battle-grid-map", children: tiles.map((tile) => {
                                    const fighter = tile.placement ? entityById.get(tile.placement.entityId) : undefined;
                                    const occupied = Boolean(fighter);
                                    const tileClassName = [
                                        'battle-grid-tile',
                                        occupied ? 'occupied' : '',
                                        tile.placement?.team === TeamSide.Left ? 'ally' : '',
                                        tile.placement?.team === TeamSide.Right ? 'enemy' : '',
                                        fighter?.id === selectedTargetId ? 'targeted' : '',
                                        selectedMoveTile && selectedMoveTile.x === tile.x && selectedMoveTile.y === tile.y ? 'selected-move' : '',
                                        moveSelectionEnabled && !occupied ? 'is-clickable' : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ');
                                    return (_jsx("div", { className: tileClassName, onClick: () => {
                                            if (!moveSelectionEnabled || occupied || !targetPlacement || !onMoveTileSelect) {
                                                return;
                                            }
                                            onMoveTileSelect({
                                                x: tile.x,
                                                y: tile.y,
                                                distanceBand: getDistanceBandForGap(Math.abs(tile.x - targetPlacement.x)),
                                            });
                                        }, children: fighter ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "battle-grid-unit-badge", children: tile.placement?.team === TeamSide.Left ? 'P' : 'E' }), _jsx("strong", { children: fighter.name }), _jsxs("span", { children: [fighter.currentHp, "/", fighter.maxHp, " HP"] })] })) : null }, `${tile.x}-${tile.y}`));
                                }) })] })] }), _jsx("div", { className: "battle-grid-footnote muted", children: "\u041A\u0430\u0440\u0442\u0430 12x12: Move \u043F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043A\u043B\u0435\u0442\u043A\u0443, \u0430 \u0434\u0438\u0441\u0442\u0430\u043D\u0446\u0438\u044F \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u043C \u043F\u043E\u0437\u0438\u0446\u0438\u044F\u043C \u0431\u043E\u0439\u0446\u043E\u0432." })] }));
}
export function splitTeams(entities) {
    return {
        leftTeam: entities.filter((item) => item.team === TeamSide.Left),
        rightTeam: entities.filter((item) => item.team === TeamSide.Right),
    };
}

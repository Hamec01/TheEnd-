import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { BATTLEFIELD_GRID_SIZE, TeamSide, getBattlefieldTilePlacements, getDistanceBandForGap, } from '@theend/rpg-domain';
import { useEffect, useMemo, useRef, useState } from 'react';
export function BattleField({ entities, distance, selectedTargetId, playerId, moveSelectionEnabled = false, selectedMoveTile, onMoveTileSelect, onTargetSelect, onQuickAttack, onQuickMove, onCancelSelection, onStatusMessage, playerVisualState = 'idle', enemyVisualState = 'idle', floatingText, animationTick = 0, }) {
    const boardRef = useRef(null);
    const menuRef = useRef(null);
    const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, type: 'cell', show: false });
    const placements = useMemo(() => getBattlefieldTilePlacements(entities, distance), [distance, entities]);
    const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
    const placementByTile = useMemo(() => new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement])), [placements]);
    const player = entities.find((entity) => entity.id === playerId);
    const selectedEnemy = entities.find((entity) => entity.id === selectedTargetId) ?? entities.find((entity) => entity.team === TeamSide.Right && entity.isAlive);
    const playerPlacement = placements.find((p) => p.entityId === playerId);
    const movementRange = 3;
    const meleeRange = 1;
    const movablePositions = useMemo(() => {
        if (!playerPlacement || !moveSelectionEnabled) {
            return new Set();
        }
        const positions = new Set();
        const visited = new Set();
        const queue = [[playerPlacement.x, playerPlacement.y, 0]];
        while (queue.length > 0) {
            const [x, y, dist] = queue.shift();
            const key = `${x}:${y}`;
            if (visited.has(key) || dist > movementRange) {
                continue;
            }
            visited.add(key);
            if (dist > 0 && !placementByTile.has(key)) {
                positions.add(key);
            }
            if (dist < movementRange) {
                for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < BATTLEFIELD_GRID_SIZE && ny >= 0 && ny < BATTLEFIELD_GRID_SIZE) {
                        queue.push([nx, ny, dist + 1]);
                    }
                }
            }
        }
        return positions;
    }, [moveSelectionEnabled, placementByTile, playerPlacement]);
    const attackablePositions = useMemo(() => {
        if (!selectedEnemy || selectedTargetId === playerId) {
            return new Set();
        }
        const enemyPlacement = placements.find((p) => p.entityId === selectedTargetId);
        if (!enemyPlacement) {
            return new Set();
        }
        const positions = new Set();
        for (let x = 0; x < BATTLEFIELD_GRID_SIZE; x++) {
            for (let y = 0; y < BATTLEFIELD_GRID_SIZE; y++) {
                const dist = Math.abs(x - enemyPlacement.x) + Math.abs(y - enemyPlacement.y);
                if (dist <= meleeRange) {
                    positions.add(`${x}:${y}`);
                }
            }
        }
        return positions;
    }, [playerId, placements, selectedEnemy, selectedTargetId]);
    const threatPositions = useMemo(() => {
        const set = new Set();
        for (const placement of placements) {
            const entity = entityById.get(placement.entityId);
            if (!entity || !entity.isAlive || entity.team !== TeamSide.Right) {
                continue;
            }
            for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
                const nx = placement.x + dx;
                const ny = placement.y + dy;
                if (nx >= 0 && nx < BATTLEFIELD_GRID_SIZE && ny >= 0 && ny < BATTLEFIELD_GRID_SIZE) {
                    set.add(`${nx}:${ny}`);
                }
            }
        }
        return set;
    }, [entityById, placements]);
    const getTileState = (x, y) => {
        const key = `${x}:${y}`;
        const placement = placementByTile.get(key);
        return {
            isMovable: movablePositions.has(key),
            isAttackable: attackablePositions.has(key),
            isThreat: threatPositions.has(key),
            isOccupied: Boolean(placement),
            isSelected: selectedMoveTile?.x === x && selectedMoveTile?.y === y,
        };
    };
    const closeContextMenu = () => {
        setContextMenu((prev) => ({ ...prev, show: false }));
    };
    const mapDistanceBand = (x) => {
        const gap = Math.abs((playerPlacement?.x ?? 0) - x);
        return getDistanceBandForGap(gap);
    };
    const isEnemyInRange = (x, y) => {
        const px = playerPlacement?.x ?? 0;
        const py = playerPlacement?.y ?? 0;
        return Math.abs(px - x) + Math.abs(py - y) <= meleeRange;
    };
    const planMoveTo = (x, y, immediate = false) => {
        const tile = { x, y, distanceBand: mapDistanceBand(x) };
        if (immediate && onQuickMove) {
            onQuickMove(tile);
            return;
        }
        onMoveTileSelect?.(tile);
    };
    const getMoveCloserTile = (enemyX, enemyY) => {
        const candidates = [...movablePositions]
            .map((key) => {
            const [x, y] = key.split(':').map(Number);
            const dist = Math.abs(enemyX - x) + Math.abs(enemyY - y);
            return { x, y, dist };
        })
            .sort((a, b) => a.dist - b.dist);
        return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
    };
    const openContextMenu = (clientX, clientY, type, tileX, tileY, targetId) => {
        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect) {
            return;
        }
        const menuWidth = 176;
        const menuHeight = type === 'enemy' ? 126 : 84;
        const relativeX = clientX - rect.left;
        const relativeY = clientY - rect.top;
        const x = Math.max(8, Math.min(relativeX, rect.width - menuWidth - 8));
        const y = Math.max(8, Math.min(relativeY, rect.height - menuHeight - 8));
        setContextMenu({ x, y, type, tileX, tileY, targetId, show: true });
    };
    const handleTileClick = (x, y, e) => {
        e.preventDefault();
        const placement = placementByTile.get(`${x}:${y}`);
        if (placement) {
            const entity = entityById.get(placement.entityId);
            if (entity && entity.team === TeamSide.Right && entity.isAlive) {
                onTargetSelect?.(entity.id);
            }
            return;
        }
        if (moveSelectionEnabled && movablePositions.has(`${x}:${y}`)) {
            planMoveTo(x, y, false);
        }
    };
    const handleTileDoubleClick = (x, y, e) => {
        e.preventDefault();
        const placement = placementByTile.get(`${x}:${y}`);
        if (placement) {
            const entity = entityById.get(placement.entityId);
            if (entity && entity.team === TeamSide.Right && entity.isAlive) {
                onTargetSelect?.(entity.id);
                if (isEnemyInRange(x, y)) {
                    onQuickAttack?.(entity.id);
                }
                else {
                    onStatusMessage?.('Target out of range');
                }
            }
            return;
        }
        if (moveSelectionEnabled && movablePositions.has(`${x}:${y}`)) {
            planMoveTo(x, y, true);
        }
    };
    const handleContextMenuAction = (action) => {
        if (action === 'attack' && contextMenu.targetId) {
            onTargetSelect?.(contextMenu.targetId);
            onQuickAttack?.(contextMenu.targetId);
            closeContextMenu();
            return;
        }
        if (action === 'move' && contextMenu.tileX !== undefined && contextMenu.tileY !== undefined) {
            onMoveTileSelect?.({
                x: contextMenu.tileX,
                y: contextMenu.tileY,
                distanceBand: mapDistanceBand(contextMenu.tileX),
            });
            closeContextMenu();
            return;
        }
        if (action === 'move-closer' && contextMenu.tileX !== undefined && contextMenu.tileY !== undefined) {
            const closer = getMoveCloserTile(contextMenu.tileX, contextMenu.tileY);
            if (!closer) {
                onStatusMessage?.('No reachable tile to move closer');
            }
            else {
                const tile = { x: closer.x, y: closer.y, distanceBand: mapDistanceBand(closer.x) };
                if (onQuickMove) {
                    onQuickMove(tile);
                }
                else {
                    onMoveTileSelect?.(tile);
                }
            }
        }
        closeContextMenu();
    };
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onCancelSelection?.();
                closeContextMenu();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancelSelection]);
    useEffect(() => {
        if (!contextMenu.show) {
            return;
        }
        const handlePointerDown = (event) => {
            const target = event.target;
            if (menuRef.current && target && menuRef.current.contains(target)) {
                return;
            }
            closeContextMenu();
        };
        window.addEventListener('pointerdown', handlePointerDown);
        return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [contextMenu.show]);
    if (!player || !selectedEnemy) {
        return _jsx("div", { className: "battle-field tactical-field", children: "Battlefield not ready" });
    }
    return (_jsxs("div", { className: "battle-field tactical-field", children: [_jsxs("div", { className: "tactical-header", children: [_jsx("h3", { children: "Tactical Battlefield" }), _jsxs("div", { className: "tactical-distance-indicator", children: ["Distance: ", distance] })] }), _jsxs("div", { className: "tactical-board-container", ref: boardRef, children: [_jsx("div", { className: "tactical-board", children: Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, row) => Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, col) => {
                            const x = col;
                            const y = row;
                            const placement = placementByTile.get(`${x}:${y}`);
                            const entity = placement ? entityById.get(placement.entityId) : null;
                            const tileState = getTileState(x, y);
                            return (_jsx("div", { className: `tactical-tile ${placement ? `tile-occupied tile-${placement.entityId === playerId ? 'player' : 'enemy'}` : ''} ${tileState.isMovable ? 'tile-movable' : ''} ${tileState.isAttackable ? 'tile-attackable' : ''} ${tileState.isThreat ? 'tile-threat' : ''} ${tileState.isOccupied && moveSelectionEnabled ? 'tile-blocked' : ''} ${tileState.isSelected ? 'tile-selected' : ''}`, onClick: (e) => handleTileClick(x, y, e), onDoubleClick: (e) => handleTileDoubleClick(x, y, e), onContextMenu: (e) => {
                                    e.preventDefault();
                                    const placementInfo = placementByTile.get(`${x}:${y}`);
                                    const entityInfo = placementInfo ? entityById.get(placementInfo.entityId) : null;
                                    if (entityInfo && entityInfo.team === TeamSide.Right && entityInfo.isAlive) {
                                        onTargetSelect?.(entityInfo.id);
                                        openContextMenu(e.clientX, e.clientY, 'enemy', x, y, entityInfo.id);
                                    }
                                    else if (moveSelectionEnabled && movablePositions.has(`${x}:${y}`)) {
                                        openContextMenu(e.clientX, e.clientY, 'cell', x, y);
                                    }
                                    else {
                                        onCancelSelection?.();
                                    }
                                }, "data-x": x, "data-y": y, role: "button", tabIndex: -1, children: entity ? (_jsxs("div", { className: "tactical-token", title: entity.name, children: [_jsx("div", { className: "token-avatar", children: entity.name.slice(0, 2).toUpperCase() }), _jsx("div", { className: "token-hp", style: { width: `${(entity.currentHp / entity.maxHp) * 100}%` } })] })) : null }, `tile-${x}-${y}`));
                        })) }), contextMenu.show && (_jsxs("div", { ref: menuRef, className: "tactical-context-menu", style: { left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }, children: [contextMenu.type === 'enemy' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => handleContextMenuAction('attack'), children: "\u2694 Attack" }), _jsx("button", { type: "button", onClick: closeContextMenu, children: "\uD83D\uDD0D Inspect" }), _jsx("button", { type: "button", onClick: () => handleContextMenuAction('move-closer'), children: "\u21E2 Move closer" }), _jsx("button", { type: "button", onClick: closeContextMenu, children: "\u2715 Cancel" })] })), contextMenu.type === 'cell' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => handleContextMenuAction('move'), children: "\uD83D\uDC63 Move Here" }), _jsx("button", { type: "button", onClick: closeContextMenu, children: "\u2715 Cancel" })] }))] }))] }), _jsxs("div", { className: "tactical-info", children: [_jsxs("div", { className: "tactical-info-item", children: [_jsx("span", { children: "Player:" }), " ", _jsx("strong", { children: player.name })] }), _jsxs("div", { className: "tactical-info-item", children: [_jsx("span", { children: "Target:" }), " ", _jsx("strong", { children: selectedEnemy.name })] }), floatingText && _jsx("div", { className: "tactical-floating-text", children: floatingText })] })] }));
}
export function splitTeams(entities) {
    return {
        leftTeam: entities.filter((item) => item.team === TeamSide.Left),
        rightTeam: entities.filter((item) => item.team === TeamSide.Right),
    };
}

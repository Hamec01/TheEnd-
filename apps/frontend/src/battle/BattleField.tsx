import {
  BATTLEFIELD_GRID_SIZE,
  DistanceBand,
  TeamSide,
  getBattlefieldTilePlacements,
  getDistanceBandForGap,
  type ArenaCombatEntity,
} from '@theend/rpg-domain';
import { useEffect, useMemo, useRef, useState } from 'react';

interface BattleFieldProps {
  entities: ArenaCombatEntity[];
  distance: DistanceBand;
  selectedTargetId: string | null;
  playerId: string;
  moveSelectionEnabled?: boolean;
  selectedMoveTile?: { x: number; y: number } | null;
  onMoveTileSelect?: (tile: { x: number; y: number; distanceBand: DistanceBand }) => void;
  onTargetSelect?: (targetId: string) => void;
  onQuickAttack?: (targetId: string) => void;
  onQuickMove?: (tile: { x: number; y: number; distanceBand: DistanceBand }) => void;
  onCancelSelection?: () => void;
  onStatusMessage?: (text: string) => void;
  playerVisualState?: 'idle' | 'attack' | 'hit' | 'block' | 'dodge';
  enemyVisualState?: 'idle' | 'attack' | 'hit' | 'block' | 'dodge';
  floatingText?: string | null;
  animationTick?: number;
}

interface ContextMenu {
  x: number;
  y: number;
  type: 'enemy' | 'cell';
  targetId?: string;
  tileX?: number;
  tileY?: number;
  show: boolean;
}

interface TileState {
  isMovable: boolean;
  isAttackable: boolean;
  isThreat: boolean;
  isOccupied: boolean;
  isSelected: boolean;
}

export function BattleField({
  entities,
  distance,
  selectedTargetId,
  playerId,
  moveSelectionEnabled = false,
  selectedMoveTile,
  onMoveTileSelect,
  onTargetSelect,
  onQuickAttack,
  onQuickMove,
  onCancelSelection,
  onStatusMessage,
  playerVisualState = 'idle',
  enemyVisualState = 'idle',
  floatingText,
  animationTick = 0,
}: BattleFieldProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, type: 'cell', show: false });

  const placements = useMemo(() => getBattlefieldTilePlacements(entities, distance), [distance, entities]);
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const placementByTile = useMemo(
    () => new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement])),
    [placements],
  );

  const player = entities.find((entity) => entity.id === playerId);
  const selectedEnemy = entities.find((entity) => entity.id === selectedTargetId) ?? entities.find((entity) => entity.team === TeamSide.Right && entity.isAlive);
  const playerPlacement = placements.find((p) => p.entityId === playerId);

  const movementRange = 3;
  const meleeRange = 1;

  const movablePositions = useMemo(() => {
    if (!playerPlacement || !moveSelectionEnabled) {
      return new Set<string>();
    }

    const positions = new Set<string>();
    const visited = new Set<string>();
    const queue = [[playerPlacement.x, playerPlacement.y, 0]];

    while (queue.length > 0) {
      const [x, y, dist] = queue.shift() as [number, number, number];
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
      return new Set<string>();
    }

    const enemyPlacement = placements.find((p) => p.entityId === selectedTargetId);
    if (!enemyPlacement) {
      return new Set<string>();
    }

    const positions = new Set<string>();
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
    const set = new Set<string>();
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

  const getTileState = (x: number, y: number): TileState => {
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

  const mapDistanceBand = (x: number): DistanceBand => {
    const gap = Math.abs((playerPlacement?.x ?? 0) - x);
    return getDistanceBandForGap(gap);
  };

  const isEnemyInRange = (x: number, y: number): boolean => {
    const px = playerPlacement?.x ?? 0;
    const py = playerPlacement?.y ?? 0;
    return Math.abs(px - x) + Math.abs(py - y) <= meleeRange;
  };

  const planMoveTo = (x: number, y: number, immediate = false) => {
    const tile = { x, y, distanceBand: mapDistanceBand(x) };
    if (immediate && onQuickMove) {
      onQuickMove(tile);
      return;
    }
    onMoveTileSelect?.(tile);
  };

  const getMoveCloserTile = (enemyX: number, enemyY: number): { x: number; y: number } | null => {
    const candidates = [...movablePositions]
      .map((key) => {
        const [x, y] = key.split(':').map(Number);
        const dist = Math.abs(enemyX - x) + Math.abs(enemyY - y);
        return { x, y, dist };
      })
      .sort((a, b) => a.dist - b.dist);
    return candidates[0] ? { x: candidates[0].x, y: candidates[0].y } : null;
  };

  const openContextMenu = (
    clientX: number,
    clientY: number,
    type: 'enemy' | 'cell',
    tileX?: number,
    tileY?: number,
    targetId?: string,
  ) => {
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

  const handleTileClick = (x: number, y: number, e: React.MouseEvent) => {
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

  const handleTileDoubleClick = (x: number, y: number, e: React.MouseEvent) => {
    e.preventDefault();
    const placement = placementByTile.get(`${x}:${y}`);
    if (placement) {
      const entity = entityById.get(placement.entityId);
      if (entity && entity.team === TeamSide.Right && entity.isAlive) {
        onTargetSelect?.(entity.id);
        if (isEnemyInRange(x, y)) {
          onQuickAttack?.(entity.id);
        } else {
          onStatusMessage?.('Target out of range');
        }
      }
      return;
    }

    if (moveSelectionEnabled && movablePositions.has(`${x}:${y}`)) {
      planMoveTo(x, y, true);
    }
  };

  const handleContextMenuAction = (action: 'move' | 'attack' | 'move-closer') => {
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
      } else {
        const tile = { x: closer.x, y: closer.y, distanceBand: mapDistanceBand(closer.x) };
        if (onQuickMove) {
          onQuickMove(tile);
        } else {
          onMoveTileSelect?.(tile);
        }
      }
    }

    closeContextMenu();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) {
        return;
      }
      closeContextMenu();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [contextMenu.show]);

  if (!player || !selectedEnemy) {
    return <div className="battle-field tactical-field">Battlefield not ready</div>;
  }

  return (
    <div className="battle-field tactical-field">
      <div className="tactical-header">
        <h3>Tactical Battlefield</h3>
        <div className="tactical-distance-indicator">Distance: {distance}</div>
      </div>

      <div className="tactical-board-container" ref={boardRef}>
        <div className="tactical-board">
          {Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, row) =>
            Array.from({ length: BATTLEFIELD_GRID_SIZE }, (_, col) => {
              const x = col;
              const y = row;
              const placement = placementByTile.get(`${x}:${y}`);
              const entity = placement ? entityById.get(placement.entityId) : null;
              const tileState = getTileState(x, y);

              return (
                <div
                  key={`tile-${x}-${y}`}
                  className={`tactical-tile ${
                    placement ? `tile-occupied tile-${placement.entityId === playerId ? 'player' : 'enemy'}` : ''
                  } ${tileState.isMovable ? 'tile-movable' : ''} ${tileState.isAttackable ? 'tile-attackable' : ''} ${
                    tileState.isThreat ? 'tile-threat' : ''
                  } ${tileState.isOccupied && moveSelectionEnabled ? 'tile-blocked' : ''} ${
                    tileState.isSelected ? 'tile-selected' : ''
                  }`}
                  onClick={(e) => handleTileClick(x, y, e)}
                  onDoubleClick={(e) => handleTileDoubleClick(x, y, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const placementInfo = placementByTile.get(`${x}:${y}`);
                    const entityInfo = placementInfo ? entityById.get(placementInfo.entityId) : null;
                    if (entityInfo && entityInfo.team === TeamSide.Right && entityInfo.isAlive) {
                      onTargetSelect?.(entityInfo.id);
                      openContextMenu(e.clientX, e.clientY, 'enemy', x, y, entityInfo.id);
                    } else if (moveSelectionEnabled && movablePositions.has(`${x}:${y}`)) {
                      openContextMenu(e.clientX, e.clientY, 'cell', x, y);
                    } else {
                      onCancelSelection?.();
                    }
                  }}
                  data-x={x}
                  data-y={y}
                  role="button"
                  tabIndex={-1}
                >
                  {entity ? (
                    <div className="tactical-token" title={entity.name}>
                      <div className="token-avatar">{entity.name.slice(0, 2).toUpperCase()}</div>
                      <div className="token-hp" style={{ width: `${(entity.currentHp / entity.maxHp) * 100}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {contextMenu.show && (
          <div ref={menuRef} className="tactical-context-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}>
            {contextMenu.type === 'enemy' && (
              <>
                <button type="button" onClick={() => handleContextMenuAction('attack')}>⚔ Attack</button>
                <button type="button" onClick={closeContextMenu}>🔍 Inspect</button>
                <button type="button" onClick={() => handleContextMenuAction('move-closer')}>⇢ Move closer</button>
                <button type="button" onClick={closeContextMenu}>✕ Cancel</button>
              </>
            )}
            {contextMenu.type === 'cell' && (
              <>
                <button type="button" onClick={() => handleContextMenuAction('move')}>👣 Move Here</button>
                <button type="button" onClick={closeContextMenu}>✕ Cancel</button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="tactical-info">
        <div className="tactical-info-item">
          <span>Player:</span> <strong>{player.name}</strong>
        </div>
        <div className="tactical-info-item">
          <span>Target:</span> <strong>{selectedEnemy.name}</strong>
        </div>
        {floatingText && <div className="tactical-floating-text">{floatingText}</div>}
      </div>
    </div>
  );
}

export function splitTeams(entities: ArenaCombatEntity[]) {
  return {
    leftTeam: entities.filter((item) => item.team === TeamSide.Left),
    rightTeam: entities.filter((item) => item.team === TeamSide.Right),
  };
}

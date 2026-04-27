import {
  BATTLEFIELD_GRID_SIZE,
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TeamSide,
  getBattlefieldTilePlacements,
  type ArenaCombatEntity,
  type BattlefieldTile,
} from '@theend/rpg-domain';
import { useEffect, useMemo, useRef, useState } from 'react';

interface BattleFieldProps {
  entities: ArenaCombatEntity[];
  battlefieldTiles: BattlefieldTile[];
  mapImageUrl?: string;
  distance: DistanceBand;
  selectedTargetId: string | null;
  playerId: string;
  movementType?: MovementType | null;
  selectedMoveTile?: { x: number; y: number } | null;
  onMoveTileSelect?: (tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => void;
  onTargetSelect?: (targetId: string) => void;
  onQuickAttack?: (targetId: string) => void;
  onQuickMove?: (tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => void;
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
  moveType: 'step' | 'dash' | null;
  isAttackable: boolean;
  isThreat: boolean;
  isBlocked: boolean;
  isOccupied: boolean;
  isSelected: boolean;
  triggersOpportunity: boolean;
}

function classifyCombatStyle(entity: ArenaCombatEntity): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (entity.intelligence >= entity.strength && entity.intelligence >= entity.dexterity) {
    return 'MAGIC';
  }
  if (entity.dexterity > entity.strength) {
    return 'RANGED';
  }
  return 'MELEE';
}

function isBlockingTile(type: BattlefieldTileType): boolean {
  return type === BattlefieldTileType.Blocked || type === BattlefieldTileType.HighCover || type === BattlefieldTileType.Summon;
}

function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;
  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) {
      break;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

function hasLineOfSightOnTiles(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tileTypeByKey: Map<string, BattlefieldTileType>,
): boolean {
  const points = bresenhamLine(fromX, fromY, toX, toY);
  for (let i = 1; i < points.length - 1; i += 1) {
    const point = points[i];
    const tileType = tileTypeByKey.get(`${point.x}:${point.y}`) ?? BattlefieldTileType.Empty;
    if (isBlockingTile(tileType)) {
      return false;
    }
  }
  return true;
}

export function BattleField({
  entities,
  battlefieldTiles,
  mapImageUrl,
  distance,
  selectedTargetId,
  playerId,
  movementType = null,
  selectedMoveTile,
  onMoveTileSelect,
  onTargetSelect,
  onQuickAttack,
  onQuickMove,
  onCancelSelection,
  onStatusMessage,
}: BattleFieldProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, type: 'cell', show: false });

  const placements = useMemo(() => getBattlefieldTilePlacements(entities, distance), [distance, entities]);
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const placementByTile = useMemo(() => new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement])), [placements]);
  const tileTypeByKey = useMemo(() => new Map(battlefieldTiles.map((tile) => [`${tile.x}:${tile.y}`, tile.type])), [battlefieldTiles]);

  const player = entities.find((entity) => entity.id === playerId);
  const selectedEnemy = entities.find((entity) => entity.id === selectedTargetId) ?? entities.find((entity) => entity.team === TeamSide.Right && entity.isAlive);
  const playerPlacement = placements.find((p) => p.entityId === playerId);
  const playerStyle = player ? classifyCombatStyle(player) : 'MELEE';
  const adjacentMeleeEnemies = useMemo(() => {
    if (!playerPlacement) {
      return [] as ArenaCombatEntity[];
    }

    return entities.filter((entity) =>
      entity.isAlive
      && entity.team === TeamSide.Right
      && classifyCombatStyle(entity) === 'MELEE'
      && Math.abs((entity.battlefieldX ?? 0) - playerPlacement.x) + Math.abs((entity.battlefieldY ?? 0) - playerPlacement.y) <= 1,
    );
  }, [entities, playerPlacement]);

  const MAX_MOVE_RANGE = 3; // Dash can reach up to 3 cells

  const movablePositions = useMemo(() => {
    if (!playerPlacement) {
      return new Map<string, { triggersOpportunity: boolean; dist: number }>();
    }

    const result = new Map<string, { triggersOpportunity: boolean; dist: number }>();
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; dist: number }> = [{ x: playerPlacement.x, y: playerPlacement.y, dist: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.x}:${current.y}`;
      if (visited.has(key) || current.dist > MAX_MOVE_RANGE) {
        continue;
      }

      visited.add(key);
      if (current.dist > 0 && !placementByTile.has(key) && !isBlockingTile(tileTypeByKey.get(key) ?? BattlefieldTileType.Empty)) {
        const triggersOpportunity = movementType !== MovementType.Disengage
          && adjacentMeleeEnemies.some((enemy) => Math.abs((enemy.battlefieldX ?? 0) - current.x) + Math.abs((enemy.battlefieldY ?? 0) - current.y) > 1);
        result.set(key, { triggersOpportunity, dist: current.dist });
      }

      if (current.dist < MAX_MOVE_RANGE) {
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
          const nx = current.x + dx;
          const ny = current.y + dy;
          const nextKey = `${nx}:${ny}`;
          if (nx < 0 || nx >= BATTLEFIELD_GRID_SIZE || ny < 0 || ny >= BATTLEFIELD_GRID_SIZE) {
            continue;
          }
          if (placementByTile.has(nextKey) || isBlockingTile(tileTypeByKey.get(nextKey) ?? BattlefieldTileType.Empty)) {
            continue;
          }
          queue.push({ x: nx, y: ny, dist: current.dist + 1 });
        }
      }
    }

    return result;
  }, [adjacentMeleeEnemies, movementType, placementByTile, playerPlacement, tileTypeByKey]);

  const attackablePositions = useMemo(() => {
    if (!selectedEnemy || selectedTargetId === playerId) {
      return new Set<string>();
    }

    const playerPlacement = placements.find((p) => p.entityId === playerId);
    const enemyPlacement = placements.find((p) => p.entityId === selectedEnemy.id);
    if (!enemyPlacement || !playerPlacement) {
      return new Set<string>();
    }

    const positions = new Set<string>();
    for (let x = 0; x < BATTLEFIELD_GRID_SIZE; x += 1) {
      for (let y = 0; y < BATTLEFIELD_GRID_SIZE; y += 1) {
        const dist = Math.abs(x - enemyPlacement.x) + Math.abs(y - enemyPlacement.y);
        if (playerStyle === 'MELEE' && dist <= 1) {
          positions.add(`${x}:${y}`);
        }
        if (playerStyle === 'RANGED' && dist >= 2 && dist <= 6) {
          // For ranged attacks, also check line of sight
          if (hasLineOfSightOnTiles(x, y, enemyPlacement.x, enemyPlacement.y, tileTypeByKey)) {
            positions.add(`${x}:${y}`);
          }
        }
        if (playerStyle === 'MAGIC' && dist <= 5) {
          positions.add(`${x}:${y}`);
        }
      }
    }
    return positions;
  }, [playerId, playerStyle, placements, selectedEnemy, selectedTargetId, tileTypeByKey]);

  const threatPositions = useMemo(() => {
    const set = new Set<string>();
    for (const placement of placements) {
      const entity = entityById.get(placement.entityId);
      if (!entity || !entity.isAlive || entity.team !== TeamSide.Right || classifyCombatStyle(entity) !== 'MELEE') {
        continue;
      }
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
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
    const tileType = tileTypeByKey.get(key) ?? BattlefieldTileType.Empty;
    const moveInfo = movablePositions.get(key);
    return {
      isMovable: Boolean(moveInfo),
      moveType: moveInfo ? (moveInfo.dist <= 1 ? 'step' : 'dash') : null,
      isAttackable: attackablePositions.has(key),
      isThreat: threatPositions.has(key),
      isBlocked: isBlockingTile(tileType),
      isOccupied: Boolean(placement),
      isSelected: selectedMoveTile?.x === x && selectedMoveTile?.y === y,
      triggersOpportunity: moveInfo?.triggersOpportunity ?? false,
    };
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, show: false }));
  };

  const isEnemyInRange = (x: number, y: number): boolean => {
    if (!playerPlacement || !player) {
      return false;
    }

    const dist = Math.abs(playerPlacement.x - x) + Math.abs(playerPlacement.y - y);
    if (playerStyle === 'MELEE') {
      return dist <= 1;
    }
    if (playerStyle === 'RANGED') {
      return dist >= 2 && hasLineOfSightOnTiles(playerPlacement.x, playerPlacement.y, x, y, tileTypeByKey);
    }
    return dist <= 5;
  };

  const planMoveTo = (x: number, y: number, immediate = false) => {
    const moveInfo = movablePositions.get(`${x}:${y}`);
    const inferredType: MovementType = (moveInfo?.dist ?? 1) <= 1 ? MovementType.Step : MovementType.Dash;
    const tile = { x, y, movementType: inferredType, willTriggerOpportunity: moveInfo?.triggersOpportunity ?? false };
    if (tile.willTriggerOpportunity) {
      onStatusMessage?.('This movement will trigger a free strike. Right-click to Disengage instead.');
    }
    if (immediate && onQuickMove) {
      onQuickMove(tile);
      return;
    }
    onMoveTileSelect?.(tile);
  };

  const getMoveCloserTile = (enemyX: number, enemyY: number): { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean } | null => {
    const candidates = [...movablePositions.entries()]
      .map(([key, info]) => {
        const [x, y] = key.split(':').map(Number);
        const enemyDist = Math.abs(enemyX - x) + Math.abs(enemyY - y);
        return { x, y, enemyDist, ...info };
      })
      .sort((a, b) => a.enemyDist - b.enemyDist);

    const best = candidates[0];
    return best
      ? { x: best.x, y: best.y, movementType: best.dist <= 1 ? MovementType.Step : MovementType.Dash, willTriggerOpportunity: best.triggersOpportunity }
      : null;
  };

  const openContextMenu = (clientX: number, clientY: number, type: 'enemy' | 'cell', tileX?: number, tileY?: number, targetId?: string) => {
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

    if (movablePositions.has(`${x}:${y}`)) {
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
          onStatusMessage?.('Target is out of range for the current build.');
        }
      }
      return;
    }

    if (movablePositions.has(`${x}:${y}`)) {
      planMoveTo(x, y, true);
    }
  };

  const handleContextMenuAction = (action: 'move' | 'attack' | 'move-closer' | 'disengage') => {
    if (action === 'attack' && contextMenu.targetId) {
      onTargetSelect?.(contextMenu.targetId);
      onQuickAttack?.(contextMenu.targetId);
      closeContextMenu();
      return;
    }

    if ((action === 'move' || action === 'disengage') && contextMenu.tileX !== undefined && contextMenu.tileY !== undefined) {
      const moveInfo = movablePositions.get(`${contextMenu.tileX}:${contextMenu.tileY}`);
      const inferredType: MovementType = action === 'disengage'
        ? MovementType.Disengage
        : (moveInfo?.dist ?? 1) <= 1 ? MovementType.Step : MovementType.Dash;
      onMoveTileSelect?.({
        x: contextMenu.tileX,
        y: contextMenu.tileY,
        movementType: inferredType,
        willTriggerOpportunity: action !== 'disengage' && (moveInfo?.triggersOpportunity ?? false),
      });
      closeContextMenu();
      return;
    }

    if (action === 'move-closer' && contextMenu.tileX !== undefined && contextMenu.tileY !== undefined) {
      const closer = getMoveCloserTile(contextMenu.tileX, contextMenu.tileY);
      if (!closer) {
        onStatusMessage?.('No reachable tile to move closer.');
      } else if (onQuickMove) {
        onQuickMove(closer);
      } else {
        onMoveTileSelect?.(closer);
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

      <div
        className="tactical-board-container"
        ref={boardRef}
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(12, 10, 8, 0.38), rgba(8, 6, 5, 0.5)), url('${mapImageUrl || '/map/battle-map_arena.png'}')`,
        }}
      >
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
                  className={`tactical-tile ${placement ? `tile-occupied tile-${placement.entityId === playerId ? 'player' : 'enemy'}` : ''} ${tileState.moveType === 'step' ? 'tile-movable' : ''} ${tileState.moveType === 'dash' ? 'tile-movable tile-dash' : ''} ${tileState.isAttackable ? 'tile-attackable' : ''} ${tileState.isThreat ? 'tile-threat' : ''} ${tileState.isBlocked ? 'tile-blocked' : ''} ${tileState.isSelected ? 'tile-selected' : ''} ${tileState.triggersOpportunity ? 'tile-danger' : ''}`}
                  onClick={(e) => handleTileClick(x, y, e)}
                  onDoubleClick={(e) => handleTileDoubleClick(x, y, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const placementInfo = placementByTile.get(`${x}:${y}`);
                    const entityInfo = placementInfo ? entityById.get(placementInfo.entityId) : null;
                    if (entityInfo && entityInfo.team === TeamSide.Right && entityInfo.isAlive) {
                      onTargetSelect?.(entityInfo.id);
                      openContextMenu(e.clientX, e.clientY, 'enemy', x, y, entityInfo.id);
                    } else if (movablePositions.has(`${x}:${y}`)) {
                      openContextMenu(e.clientX, e.clientY, 'cell', x, y);
                    } else {
                      onCancelSelection?.();
                    }
                  }}
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
            {contextMenu.type === 'cell' && (() => {
              const cellInfo = contextMenu.tileX !== undefined && contextMenu.tileY !== undefined
                ? movablePositions.get(`${contextMenu.tileX}:${contextMenu.tileY}`)
                : undefined;
              const isDash = (cellInfo?.dist ?? 1) > 1;
              const canDisengage = adjacentMeleeEnemies.length > 0 && !isDash;
              return (
                <>
                  <button type="button" onClick={() => handleContextMenuAction('move')}>
                    {isDash ? '💨 Dash here (14 STA, no atk)' : '👣 Step here (6 STA)'}
                  </button>
                  {canDisengage && (
                    <button type="button" onClick={() => handleContextMenuAction('disengage')}>🛡 Disengage (10 STA, safe)</button>
                  )}
                  <button type="button" onClick={closeContextMenu}>✕ Cancel</button>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="tactical-info">
        <div className="tactical-info-item"><span>Player:</span> <strong>{player.name}</strong></div>
        <div className="tactical-info-item"><span>Target:</span> <strong>{selectedEnemy.name}</strong></div>
        {movementType ? <div className="tactical-info-item"><span>Move:</span> <strong>{movementType}</strong></div> : null}
      </div>
    </div>
  );
}

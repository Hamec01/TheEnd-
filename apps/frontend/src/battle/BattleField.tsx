import {
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TeamSide,
  getBattlefieldTilePlacements,
  type ArenaCombatEntity,
  type BattlefieldTile,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface BattleFieldProps {
  entities: ArenaCombatEntity[];
  battlefieldTiles: BattlefieldTile[];
  battleMapWidth: number;
  battleMapHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  mapImageUrl?: string;
  mapCalibration?: {
    cellSizePx?: number;
    gridOffsetX?: number;
    gridOffsetY?: number;
    showEditorGrid?: boolean;
    gridOpacity?: number;
  };
  distance: DistanceBand;
  selectedTargetId: string | null;
  playerId: string;
  playerAvatarUrl?: string;
  movementType?: MovementType | null;
  selectedMoveTile?: { x: number; y: number } | null;
  onMoveTileSelect?: (tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => void;
  onTargetSelect?: (targetId: string) => void;
  onQuickAttack?: (targetId: string) => void;
  onQuickMove?: (tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => void;
  onInspectEntity?: (entityId: string) => void;
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

const CAMERA_TILE_BUDGET = 12;

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
  battleMapWidth,
  battleMapHeight,
  viewportWidth,
  viewportHeight,
  mapImageUrl,
  mapCalibration,
  distance,
  selectedTargetId,
  playerId,
  playerAvatarUrl,
  movementType = null,
  selectedMoveTile,
  onMoveTileSelect,
  onTargetSelect,
  onQuickAttack,
  onQuickMove,
  onInspectEntity,
  onCancelSelection,
  onStatusMessage,
}: BattleFieldProps) {
    function getRacePortrait(entity: ArenaCombatEntity): string {
      if (entity.avatarUrl) {
        return entity.avatarUrl;
      }

      if (entity.id === playerId && playerAvatarUrl) {
        return playerAvatarUrl;
      }

      const raceKey = String(entity.race).toLowerCase();
      if (raceKey.includes('dwarf')) {
        return '/art/races/dwarf.png';
      }
      if (raceKey.includes('elf')) {
        return '/art/races/elf.png';
      }
      return '/art/races/human.png';
    }

  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
    const gridOffsetX = mapCalibration?.gridOffsetX ?? 0;
    const gridOffsetY = mapCalibration?.gridOffsetY ?? 0;
    const showVisualGrid = Boolean(mapCalibration?.showEditorGrid);
    const visualGridOpacity = mapCalibration?.gridOpacity ?? 0.12;
    const viewportCellCount = CAMERA_TILE_BUDGET;

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, type: 'cell', show: false });

  const placements = useMemo(
    () => getBattlefieldTilePlacements(entities, distance, battleMapWidth, battleMapHeight),
    [battleMapHeight, battleMapWidth, distance, entities],
  );
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const placementByTile = useMemo(() => new Map(placements.map((placement) => [`${placement.x}:${placement.y}`, placement])), [placements]);
  const tileTypeByKey = useMemo(() => new Map(battlefieldTiles.map((tile) => [`${tile.x}:${tile.y}`, tile.type])), [battlefieldTiles]);

  const player = entities.find((entity) => entity.id === playerId);
  const selectedEnemy = entities.find((entity) => entity.id === selectedTargetId) ?? entities.find((entity) => entity.team === TeamSide.Right && entity.isAlive);
  const playerPlacement = placements.find((p) => p.entityId === playerId);
  const playerStyle = player ? classifyCombatStyle(player) : 'MELEE';
  const viewport = useMemo(() => {
    const width = Math.min(viewportCellCount, battleMapWidth);
    const height = Math.min(viewportCellCount, battleMapHeight);
    const playerX = playerPlacement?.x ?? 0;
    const playerY = playerPlacement?.y ?? 0;
    const maxOffsetX = Math.max(0, battleMapWidth - width);
    const maxOffsetY = Math.max(0, battleMapHeight - height);
    return {
      width,
      height,
      offsetX: Math.max(0, Math.min(maxOffsetX, playerX - Math.floor(width / 2))),
      offsetY: Math.max(0, Math.min(maxOffsetY, playerY - Math.floor(height / 2))),
    };
  }, [battleMapHeight, battleMapWidth, playerPlacement?.x, playerPlacement?.y, viewportCellCount]);

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
          if (nx < 0 || nx >= battleMapWidth || ny < 0 || ny >= battleMapHeight) {
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
    for (let x = 0; x < battleMapWidth; x += 1) {
      for (let y = 0; y < battleMapHeight; y += 1) {
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
        if (nx >= 0 && nx < battleMapWidth && ny >= 0 && ny < battleMapHeight) {
          set.add(`${nx}:${ny}`);
        }
      }
    }
    return set;
  }, [battleMapHeight, battleMapWidth, entityById, placements]);

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

  const planMoveTo = useCallback((x: number, y: number, immediate = false) => {
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
  }, [movablePositions, onMoveTileSelect, onQuickMove, onStatusMessage]);

  const planDirectionalMove = useCallback((dx: number, dy: number) => {
    if (!playerPlacement) {
      return;
    }

    const originX = selectedMoveTile?.x ?? playerPlacement.x;
    const originY = selectedMoveTile?.y ?? playerPlacement.y;

    const candidates = [...movablePositions.entries()]
      .map(([key]) => {
        const [x, y] = key.split(':').map(Number);
        return { x, y };
      })
      .filter((tile) => {
        if (dx !== 0) {
          return tile.y === originY && Math.sign(tile.x - originX) === Math.sign(dx);
        }
        return tile.x === originX && Math.sign(tile.y - originY) === Math.sign(dy);
      })
      .sort((a, b) => (Math.abs(a.x - originX) + Math.abs(a.y - originY)) - (Math.abs(b.x - originX) + Math.abs(b.y - originY)));

    const nextTile = candidates[0];
    if (nextTile) {
      planMoveTo(nextTile.x, nextTile.y, false);
    }
  }, [movablePositions, planMoveTo, playerPlacement, selectedMoveTile?.x, selectedMoveTile?.y]);

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
    const node = boardRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect;
      setBoardSize({
        width: next.width,
        height: next.height,
      });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancelSelection?.();
        closeContextMenu();
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') {
        e.preventDefault();
        planDirectionalMove(0, -1);
      } else if (key === 's' || key === 'arrowdown') {
        e.preventDefault();
        planDirectionalMove(0, 1);
      } else if (key === 'a' || key === 'arrowleft') {
        e.preventDefault();
        planDirectionalMove(-1, 0);
      } else if (key === 'd' || key === 'arrowright') {
        e.preventDefault();
        planDirectionalMove(1, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancelSelection, planDirectionalMove]);

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

  const contextEntity = contextMenu.targetId ? entityById.get(contextMenu.targetId) : null;

  const availableBoardHeight = Math.max(1, boardSize.height);
  const availableBoardWidth = Math.max(1, boardSize.width);

  const cellByWidth = Math.floor(availableBoardWidth / viewport.width);
  const cellByHeight = Math.floor(availableBoardHeight / viewport.height);

  const sceneCellSize = Math.max(
    22,
    Math.min(cellByWidth, cellByHeight)
  );
  const tokenSizePx = Math.max(24, Math.floor(sceneCellSize * 0.72));

  const visibleMapPixelWidth = viewport.width * sceneCellSize;
  const visibleMapPixelHeight = viewport.height * sceneCellSize;
  const fullMapPixelWidth = gridOffsetX * 2 + battleMapWidth * sceneCellSize;
  const fullMapPixelHeight = gridOffsetY * 2 + battleMapHeight * sceneCellSize;
  const backgroundOffsetX = gridOffsetX - viewport.offsetX * sceneCellSize;
  const backgroundOffsetY = gridOffsetY - viewport.offsetY * sceneCellSize;

  return (
    <div className="battle-field tactical-field">
      <div className="tactical-header">
        <h3>Tactical Battlefield</h3>
        <div className="tactical-distance-indicator">Distance: {distance} | Camera locked on player</div>
      </div>

      <div
        className="tactical-board-container"
        ref={boardRef}
      >
        <div
          className="tactical-scene"
          style={{
            width: `${visibleMapPixelWidth}px`,
            height: `${visibleMapPixelHeight}px`,
          }}
        >
          <div
            className="tactical-scene-image"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(12, 10, 8, 0.28), rgba(8, 6, 5, 0.36)), url('${mapImageUrl || '/map/battle-map_arena.png'}')`,
              backgroundSize: `${fullMapPixelWidth}px ${fullMapPixelHeight}px`,
              backgroundPosition: `${backgroundOffsetX}px ${backgroundOffsetY}px`,
            }}
          />
          {showVisualGrid ? (
            <div
              className="tactical-scene-grid"
              style={{
                left: '0px',
                top: '0px',
                width: `${viewport.width * sceneCellSize}px`,
                height: `${viewport.height * sceneCellSize}px`,
                backgroundSize: `${sceneCellSize}px ${sceneCellSize}px`,
                opacity: visualGridOpacity,
              }}
            />
          ) : null}

          <div className="tactical-board">
          {Array.from({ length: viewport.height }, (_, row) =>
            Array.from({ length: viewport.width }, (_, col) => {
              const x = viewport.offsetX + col;
              const y = viewport.offsetY + row;
              const placement = placementByTile.get(`${x}:${y}`);
              const entity = placement ? entityById.get(placement.entityId) : null;
              const tileState = getTileState(x, y);

              return (
                <div
                  key={`tile-${x}-${y}`}
                  className={`tactical-tile ${placement ? `tile-occupied tile-${placement.entityId === playerId ? 'player' : 'enemy'}` : ''} ${tileState.moveType === 'step' ? 'tile-movable' : ''} ${tileState.moveType === 'dash' ? 'tile-movable tile-dash' : ''} ${tileState.isAttackable ? 'tile-attackable' : ''} ${tileState.isThreat ? 'tile-threat' : ''} ${tileState.isBlocked ? 'tile-blocked' : ''} ${tileState.isSelected ? 'tile-selected' : ''} ${tileState.triggersOpportunity ? 'tile-danger' : ''}`}
                  style={{
                    left: `${col * sceneCellSize}px`,
                    top: `${row * sceneCellSize}px`,
                    width: `${sceneCellSize}px`,
                    height: `${sceneCellSize}px`,
                  }}
                  onClick={(e) => handleTileClick(x, y, e)}
                  onDoubleClick={(e) => handleTileDoubleClick(x, y, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const placementInfo = placementByTile.get(`${x}:${y}`);
                    const entityInfo = placementInfo ? entityById.get(placementInfo.entityId) : null;
                    if (entityInfo && entityInfo.isAlive) {
                      if (entityInfo.team === TeamSide.Right) {
                        onTargetSelect?.(entityInfo.id);
                      }
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
                      <div
                        className={`token-avatar-shell ${entity.isAlive ? '' : 'is-dead'}`}
                        style={{ width: `${tokenSizePx}px`, height: `${tokenSizePx}px` }}
                      >
                        <img src={getRacePortrait(entity)} alt={entity.name} className="token-avatar-img" />
                        <div className="token-avatar-base" />
                        <div className="token-avatar-hp-fill" style={{ height: `${Math.max(0, Math.min(100, Math.round((entity.currentHp / Math.max(1, entity.maxHp)) * 100)))}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            }),
          )}
          </div>
        </div>

        {contextMenu.show && (
          <div ref={menuRef} className="tactical-context-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}>
            {contextMenu.type === 'enemy' && (
              <>
                {contextEntity?.team === TeamSide.Right ? <button type="button" onClick={() => handleContextMenuAction('attack')}>⚔ Атаковать</button> : null}
                <button type="button" onClick={() => { if (contextMenu.targetId) { onInspectEntity?.(contextMenu.targetId); } closeContextMenu(); }}>🔍 Осмотреть</button>
                {contextEntity?.team === TeamSide.Right ? <button type="button" onClick={() => handleContextMenuAction('move-closer')}>⇢ Подойти ближе</button> : null}
                <button type="button" onClick={closeContextMenu}>✕ Отмена</button>
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
                    {isDash ? '💨 Рывок сюда (14 STA)' : '👣 Шаг сюда (6 STA)'}
                  </button>
                  {canDisengage && (
                    <button type="button" onClick={() => handleContextMenuAction('disengage')}>🛡 Отход (10 STA)</button>
                  )}
                  <button type="button" onClick={closeContextMenu}>✕ Отмена</button>
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

import {
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TeamSide,
  getBattlefieldTilePlacements,
  type AdminSkillDefinition,
  type ArenaCombatEntity,
  type CombatLogEntry,
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
  onQuickSkill?: (skillId: string, targetId?: string) => void;
  onQuickItem?: (itemId: string, targetId?: string) => void;
  onQuickMove?: (tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => void;
  onQuickWait?: () => void;
  onResetDefense?: () => void;
  onInspectEntity?: (entityId: string) => void;
  onCancelSelection?: () => void;
  onStatusMessage?: (text: string) => void;
  availableSkills?: Array<{ slotId: string; slotIndex: number; skillId: string; level: number; label: string; definition: AdminSkillDefinition }>;
  selfTargetSkills?: Array<{ slotId: string; slotIndex: number; skillId: string; level: number; label: string; definition: AdminSkillDefinition }>;
  inventoryItems?: Array<{ id: string; name: string; description: string; icon: string; itemType: string; quantity: number; disabled?: boolean; disabledReason?: string | null; effectSummary?: string | null; costSummary?: string | null }>;
  selectedSkillId?: string | null;
  playerVisualState?: 'idle' | 'attack' | 'hit' | 'block' | 'dodge';
  enemyVisualState?: 'idle' | 'attack' | 'hit' | 'block' | 'dodge';
  floatingText?: string | null;
  animationTick?: number;
  lastLog?: CombatLogEntry | null;
  recentLogs?: CombatLogEntry[];
}

interface ContextMenu {
  x: number;
  y: number;
  type: 'enemy' | 'cell' | 'self';
  targetId?: string;
  tileX?: number;
  tileY?: number;
  show: boolean;
}

interface FloatingDamage {
  id: string;
  entityId: string;
  text: string;
  createdAt: number;
  offsetX: number;
  offsetY: number;
  kind: 'damage' | 'block' | 'miss';
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
  if (entity.combatStyleHint) {
    return entity.combatStyleHint;
  }
  if (typeof entity.attackRange === 'number' && entity.attackRange > 1) {
    return 'RANGED';
  }
  if (entity.intelligence >= entity.strength && entity.intelligence >= entity.dexterity) {
    return 'MAGIC';
  }
  if (entity.dexterity > entity.strength) {
    return 'RANGED';
  }
  return 'MELEE';
}

function getMaxAttackRange(entity: ArenaCombatEntity, style: 'MELEE' | 'RANGED' | 'MAGIC'): number {
  if (style === 'MELEE') {
    return 1;
  }
  const raw = typeof entity.attackRange === 'number' && Number.isFinite(entity.attackRange)
    ? Math.floor(entity.attackRange)
    : undefined;
  if (style === 'MAGIC') {
    return Math.max(2, raw ?? 5);
  }
  return Math.max(2, raw ?? 6);
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
  lastLog = null,
  recentLogs = [],
  selectedMoveTile,
  onMoveTileSelect,
  onTargetSelect,
  onQuickAttack,
  onQuickSkill,
  onQuickItem,
  onQuickMove,
  onQuickWait,
  onResetDefense,
  onInspectEntity,
  onCancelSelection,
  onStatusMessage,
  availableSkills = [],
  selfTargetSkills = [],
  inventoryItems = [],
  selectedSkillId = null,
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
  const processedLogKeysRef = useRef<Set<string>>(new Set());
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
    const gridOffsetX = mapCalibration?.gridOffsetX ?? 0;
    const gridOffsetY = mapCalibration?.gridOffsetY ?? 0;
    const showVisualGrid = Boolean(mapCalibration?.showEditorGrid);
    const visualGridOpacity = mapCalibration?.gridOpacity ?? 0.12;
    const viewportCellCount = CAMERA_TILE_BUDGET;

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ x: 0, y: 0, type: 'cell', show: false });
  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);

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

  useEffect(() => {
    const logsToProcess = recentLogs.length > 0 ? recentLogs : lastLog ? [lastLog] : [];
    if (logsToProcess.length === 0) {
      return;
    }

    const now = Date.now();
    const processed = processedLogKeysRef.current;

    const pending: Array<{ targetId: string; kind: FloatingDamage['kind']; text: string }> = [];

    for (const log of logsToProcess) {
      if (!log.targetId) {
        continue;
      }
      if (log.type !== 'HIT' && log.type !== 'BLOCK' && log.type !== 'MISS') {
        continue;
      }

      const key = `${log.round}:${log.type}:${log.actorId}:${log.targetId}:${log.amount ?? ''}:${log.text}`;
      if (processed.has(key)) {
        continue;
      }
      processed.add(key);

      if (log.type === 'HIT') {
        pending.push({ targetId: log.targetId, kind: 'damage', text: `-${log.amount ?? 0}` });
      } else if (log.type === 'BLOCK') {
        pending.push({ targetId: log.targetId, kind: 'block', text: 'BLOCK' });
      } else if (log.type === 'MISS') {
        pending.push({ targetId: log.targetId, kind: 'miss', text: 'MISS' });
      }
    }

    if (processed.size > 120) {
      processedLogKeysRef.current = new Set(
        logsToProcess.map((log) => `${log.round}:${log.type}:${log.actorId}:${log.targetId ?? ''}:${log.amount ?? ''}:${log.text}`),
      );
    }

    if (pending.length === 0) {
      return;
    }

    setFloatingDamages((prev) => {
      const active = prev.filter((entry) => now - entry.createdAt < 1300);
      const next = [...active];
      for (const item of pending) {
        const stackIndex = next.filter((entry) => entry.entityId === item.targetId).length;
        const offsetX = (stackIndex % 3 - 1) * 10;
        const offsetY = -stackIndex * 7;
        next.push({
          id: `fd_${now}_${Math.random().toString(16).slice(2)}`,
          entityId: item.targetId,
          text: item.text,
          createdAt: now,
          offsetX,
          offsetY,
          kind: item.kind,
        });
      }
      return next;
    });
  }, [lastLog, recentLogs]);

  useEffect(() => {
    if (floatingDamages.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setFloatingDamages((prev) => prev.filter((entry) => now - entry.createdAt < 1300));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [floatingDamages.length]);
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
    if (!player || !selectedEnemy || selectedTargetId === playerId) {
      return new Set<string>();
    }

    const playerPlacement = placements.find((p) => p.entityId === playerId);
    const enemyPlacement = placements.find((p) => p.entityId === selectedEnemy.id);
    if (!enemyPlacement || !playerPlacement) {
      return new Set<string>();
    }

    const maxRange = getMaxAttackRange(player, playerStyle);
    const positions = new Set<string>();
    for (let x = 0; x < battleMapWidth; x += 1) {
      for (let y = 0; y < battleMapHeight; y += 1) {
        const dist = Math.abs(x - enemyPlacement.x) + Math.abs(y - enemyPlacement.y);
        if (playerStyle === 'MELEE' && dist <= 1) {
          positions.add(`${x}:${y}`);
        }
        if (playerStyle === 'RANGED' && dist <= maxRange) {
          if (hasLineOfSightOnTiles(x, y, enemyPlacement.x, enemyPlacement.y, tileTypeByKey)) {
            positions.add(`${x}:${y}`);
          }
        }
        if (playerStyle === 'MAGIC' && dist <= maxRange) {
          if (hasLineOfSightOnTiles(x, y, enemyPlacement.x, enemyPlacement.y, tileTypeByKey)) {
            positions.add(`${x}:${y}`);
          }
        }
      }
    }
    return positions;
  }, [battleMapHeight, battleMapWidth, player, playerId, playerStyle, placements, selectedEnemy, selectedTargetId, tileTypeByKey]);

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
      const maxRange = getMaxAttackRange(player, playerStyle);
      return dist <= maxRange && hasLineOfSightOnTiles(playerPlacement.x, playerPlacement.y, x, y, tileTypeByKey);
    }
    const maxRange = getMaxAttackRange(player, playerStyle);
    return dist <= maxRange && hasLineOfSightOnTiles(playerPlacement.x, playerPlacement.y, x, y, tileTypeByKey);
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

  const openContextMenu = (clientX: number, clientY: number, type: 'enemy' | 'cell' | 'self', tileX?: number, tileY?: number, targetId?: string) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const menuWidth = type === 'enemy' ? 260 : type === 'self' ? 248 : 186;
    const menuHeight = type === 'enemy' ? 280 : type === 'self' ? 240 : 104;
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

  const handleContextMenuAction = (action: 'move' | 'attack' | 'move-closer' | 'disengage' | 'wait' | 'reset-defense') => {
    if (action === 'attack' && contextMenu.targetId) {
      onTargetSelect?.(contextMenu.targetId);
      onQuickAttack?.(contextMenu.targetId);
      closeContextMenu();
      return;
    }

    if (action === 'wait') {
      onQuickWait?.();
      closeContextMenu();
      return;
    }

    if (action === 'reset-defense') {
      onResetDefense?.();
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
        <div className="tactical-distance-indicator">Distance: {distance} | RMB: action menu | Space: confirm | Esc: cancel</div>
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
                        openContextMenu(e.clientX, e.clientY, 'enemy', x, y, entityInfo.id);
                      } else if (entityInfo.id === playerId) {
                        openContextMenu(e.clientX, e.clientY, 'self', x, y, entityInfo.id);
                      } else {
                        openContextMenu(e.clientX, e.clientY, 'enemy', x, y, entityInfo.id);
                      }
                    } else if (movablePositions.has(`${x}:${y}`)) {
                      openContextMenu(e.clientX, e.clientY, 'cell', x, y);
                    } else {
                      onCancelSelection?.();
                    }
                  }}
                  role="button"
                  tabIndex={-1}
                >
                   {entity ? (() => {
                     const hpPercent = Math.max(
                       0,
                       Math.min(100, Math.round((entity.currentHp / Math.max(1, entity.maxHp)) * 100)),
                     );
                     const teamClass =
                       entity.team === TeamSide.Right
                         ? 'team-enemy'
                         : entity.team === TeamSide.Left
                           ? 'team-player'
                           : 'team-neutral';
                     const isFocus = entity.id === playerId || entity.id === selectedTargetId;
                     const isSelected = entity.id === selectedTargetId;
                     const floats = floatingDamages.filter((entry) => entry.entityId === entity.id);

                     return (
                       <div className="tactical-token" title={entity.name}>
                         <div
                           className={`token-avatar-shell ${teamClass} ${entity.isAlive ? '' : 'is-dead'} ${isFocus ? 'is-focus' : ''} ${isSelected ? 'is-selected' : ''}`}
                           style={{ width: `${tokenSizePx}px`, height: `${tokenSizePx}px` }}
                         >
                           <img src={getRacePortrait(entity)} alt={entity.name} className="token-avatar-img" />
                           <div className="token-avatar-base" />
                           <div className="token-hp-bar" aria-hidden="true">
                             <div className="token-hp-bar-fill" style={{ width: `${hpPercent}%` }} />
                           </div>
                         </div>

                         {floats.map((entry) => (
                           <div
                             key={entry.id}
                             className={`tactical-float tactical-float-${entry.kind}`}
                             style={{
                               transform: `translate(calc(-50% + ${entry.offsetX}px), ${entry.offsetY}px)`,
                             }}
                           >
                             {entry.text}
                           </div>
                         ))}
                       </div>
                     );
                   })() : null}
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
                {contextEntity?.team === TeamSide.Right ? <button type="button" onClick={() => handleContextMenuAction('attack')}>⚔ Базовая атака</button> : null}
                {contextEntity?.team === TeamSide.Right && availableSkills.length > 0 ? (
                  <div className="tactical-context-group">
                    <span className="tactical-context-group-title">Навыки</span>
                    {availableSkills.slice(0, 6).map((skill) => (
                      <button
                        key={skill.slotId}
                        type="button"
                        className={selectedSkillId === skill.skillId ? 'is-active' : ''}
                        onClick={() => {
                          if (contextMenu.targetId) {
                            onTargetSelect?.(contextMenu.targetId);
                          }
                          onQuickSkill?.(skill.skillId, contextMenu.targetId);
                          closeContextMenu();
                        }}
                      >
                        {skill.slotId.toUpperCase()} · {skill.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {contextEntity?.team === TeamSide.Right && inventoryItems.filter((item) => !item.disabled).length > 0 ? (
                  <div className="tactical-context-group">
                    <span className="tactical-context-group-title">Предметы</span>
                    {inventoryItems.filter((item) => !item.disabled).slice(0, 4).map((item) => (
                      <button key={item.id} type="button" onClick={() => { onQuickItem?.(item.id, contextMenu.targetId); closeContextMenu(); }}>
                        {item.name} x{item.quantity}
                      </button>
                    ))}
                  </div>
                ) : null}
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
            {contextMenu.type === 'self' && (
              <>
                {selfTargetSkills.length > 0 ? (
                  <div className="tactical-context-group">
                    <span className="tactical-context-group-title">Self skills</span>
                    {selfTargetSkills.slice(0, 5).map((skill) => (
                      <button key={skill.slotId} type="button" onClick={() => { onQuickSkill?.(skill.skillId, playerId); closeContextMenu(); }}>
                        {skill.slotId.toUpperCase()} · {skill.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {inventoryItems.filter((item) => !item.disabled).length > 0 ? (
                  <div className="tactical-context-group">
                    <span className="tactical-context-group-title">Self items</span>
                    {inventoryItems.filter((item) => !item.disabled).slice(0, 4).map((item) => (
                      <button key={item.id} type="button" onClick={() => { onQuickItem?.(item.id, playerId); closeContextMenu(); }}>
                        {item.name} x{item.quantity}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button type="button" onClick={() => handleContextMenuAction('reset-defense')}>🗙 Сбросить защиту</button>
                <button type="button" onClick={() => handleContextMenuAction('wait')}>⌛ Ожидание</button>
                <button type="button" onClick={closeContextMenu}>✕ Отмена</button>
              </>
            )}
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

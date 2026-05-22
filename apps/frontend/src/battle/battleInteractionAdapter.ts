import {
  BattlefieldTileType,
  DistanceBand,
  MovementType,
  TeamSide,
  getBattlefieldTilePlacements,
  type AdminSkillDefinition,
  type ArenaCombatEntity,
  type BattlefieldTile,
} from '@theend/rpg-domain';
import type { ClickedCombatTarget, SelectedCombatSource } from './combatContextActions';
import { normalizeItemTargetConfig, normalizeSkillTargetConfig } from './combatContextActions';

export type CombatStyle = 'MELEE' | 'RANGED' | 'MAGIC';

export interface BattleInteractionSkillEntry {
  skillId: string;
  definition: AdminSkillDefinition;
}

export interface BattleInteractionAdapterInput {
  entities: ArenaCombatEntity[];
  battlefieldTiles: BattlefieldTile[];
  battleMapWidth: number;
  battleMapHeight: number;
  distance: DistanceBand;
  playerId: string;
  selectedTargetId?: string | null;
  selectedSource?: SelectedCombatSource;
  movementType?: MovementType | null;
  selectedMoveTile?: { x: number; y: number } | null;
  visualPositions?: Record<string, { x: number; y: number }>;
  availableSkills?: BattleInteractionSkillEntry[];
  resolveAdminItemById?: (itemId: string) => unknown | null;
}

export interface BattleMovementCellInfo {
  dist: number;
  movementType: MovementType.Step | MovementType.Dash;
  willTriggerOpportunity: boolean;
}

export type ResolvedBattleClickTarget =
  | ({ cell: { x: number; y: number } } & { kind: 'self'; actorId: string; entity: ArenaCombatEntity })
  | ({ cell: { x: number; y: number } } & { kind: 'entity'; entityId: string; entity: ArenaCombatEntity })
  | ({ cell: { x: number; y: number } } & { kind: 'cell'; move: BattleMovementCellInfo | null })
  | ({ cell: { x: number; y: number } } & { kind: 'blocked' });

function tileKey(x: number, y: number): string {
  return `${x}:${y}`;
}

export function getEntitiesForBattleRender(input: Pick<BattleInteractionAdapterInput, 'entities' | 'visualPositions'>): ArenaCombatEntity[] {
  if (!input.visualPositions || Object.keys(input.visualPositions).length === 0) {
    return input.entities;
  }

  return input.entities.map((entity) => {
    const position = input.visualPositions?.[entity.id];
    if (!position) {
      return entity;
    }
    return {
      ...entity,
      battlefieldX: position.x,
      battlefieldY: position.y,
    };
  });
}

export function classifyCombatStyle(entity: ArenaCombatEntity): CombatStyle {
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

export function getMaxAttackRange(entity: ArenaCombatEntity, style: CombatStyle): number {
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

export function isBlockingTile(type: BattlefieldTileType): boolean {
  return type === BattlefieldTileType.Blocked || type === BattlefieldTileType.HighCover || type === BattlefieldTileType.Summon;
}

export function isTileMovementBlocked(tile: BattlefieldTile | undefined): boolean {
  if (tile?.blocksMovement !== undefined) {
    return tile.blocksMovement;
  }
  return isBlockingTile(tile?.type ?? BattlefieldTileType.Empty);
}

export function isTileLineOfSightBlocked(tile: BattlefieldTile | undefined): boolean {
  if (tile?.blocksLineOfSight !== undefined) {
    return tile.blocksLineOfSight;
  }
  return isBlockingTile(tile?.type ?? BattlefieldTileType.Empty);
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
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

export function hasLineOfSightOnTiles(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  tileByKey: Map<string, BattlefieldTile>,
): boolean {
  const points = bresenhamLine(fromX, fromY, toX, toY);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (isTileLineOfSightBlocked(tileByKey.get(tileKey(point.x, point.y)))) {
      return false;
    }
  }
  return true;
}

export function createBattleInteractionAdapter(input: BattleInteractionAdapterInput) {
  const entitiesForRender = getEntitiesForBattleRender(input);
  const placements = getBattlefieldTilePlacements(entitiesForRender, input.distance, input.battleMapWidth, input.battleMapHeight);
  const entityById = new Map(entitiesForRender.map((entity) => [entity.id, entity]));
  const placementByTile = new Map(placements.map((placement) => [tileKey(placement.x, placement.y), placement]));
  const tileByKey = new Map(input.battlefieldTiles.map((tile) => [tileKey(tile.x, tile.y), tile]));
  const player = entitiesForRender.find((entity) => entity.id === input.playerId) ?? null;
  const selectedEnemy = entitiesForRender.find((entity) => entity.id === input.selectedTargetId)
    ?? entitiesForRender.find((entity) => entity.team === TeamSide.Right && entity.isAlive)
    ?? null;
  const playerPlacement = placements.find((placement) => placement.entityId === input.playerId) ?? null;
  const playerStyle = player ? classifyCombatStyle(player) : 'MELEE';
  const adjacentMeleeEnemies = playerPlacement
    ? entitiesForRender.filter((entity) =>
      entity.isAlive
      && entity.team === TeamSide.Right
      && classifyCombatStyle(entity) === 'MELEE'
      && Math.abs((entity.battlefieldX ?? 0) - playerPlacement.x) + Math.abs((entity.battlefieldY ?? 0) - playerPlacement.y) <= 1,
    )
    : [];

  const movableCells = new Map<string, BattleMovementCellInfo>();
  if (playerPlacement) {
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; dist: number }> = [{ x: playerPlacement.x, y: playerPlacement.y, dist: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = tileKey(current.x, current.y);
      if (visited.has(key) || current.dist > 3) {
        continue;
      }
      visited.add(key);

      const tile = tileByKey.get(key);
      if (current.dist > 0 && !placementByTile.has(key) && !isTileMovementBlocked(tile)) {
        movableCells.set(key, {
          dist: current.dist,
          movementType: current.dist > 1 ? MovementType.Dash : MovementType.Step,
          willTriggerOpportunity: input.movementType !== MovementType.Disengage && adjacentMeleeEnemies.some((enemy) =>
            Math.abs((enemy.battlefieldX ?? 0) - current.x) + Math.abs((enemy.battlefieldY ?? 0) - current.y) > 1,
          ),
        });
      }

      if (current.dist >= 3) {
        continue;
      }

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nextX = current.x + dx;
        const nextY = current.y + dy;
        const nextKey = tileKey(nextX, nextY);
        if (nextX < 0 || nextY < 0 || nextX >= input.battleMapWidth || nextY >= input.battleMapHeight) {
          continue;
        }
        if (placementByTile.has(nextKey) || isTileMovementBlocked(tileByKey.get(nextKey))) {
          continue;
        }
        queue.push({ x: nextX, y: nextY, dist: current.dist + 1 });
      }
    }
  }

  const threatenedCells = new Set<string>();
  for (const placement of placements) {
    const entity = entityById.get(placement.entityId);
    if (!entity || !entity.isAlive || entity.team !== TeamSide.Right || classifyCombatStyle(entity) !== 'MELEE') {
      continue;
    }
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const nextX = placement.x + dx;
      const nextY = placement.y + dy;
      if (nextX >= 0 && nextX < input.battleMapWidth && nextY >= 0 && nextY < input.battleMapHeight) {
        threatenedCells.add(tileKey(nextX, nextY));
      }
    }
  }

  function resolveBasicAttackTargetableCells(): Set<string> {
    if (!player || !selectedEnemy || input.selectedTargetId === input.playerId) {
      return new Set();
    }
    const enemyPlacement = placements.find((placement) => placement.entityId === selectedEnemy.id);
    if (!enemyPlacement) {
      return new Set();
    }

    const result = new Set<string>();
    const maxRange = getMaxAttackRange(player, playerStyle);
    for (let x = 0; x < input.battleMapWidth; x += 1) {
      for (let y = 0; y < input.battleMapHeight; y += 1) {
        const dist = Math.abs(enemyPlacement.x - x) + Math.abs(enemyPlacement.y - y);
        if (playerStyle === 'MELEE') {
          if (dist <= 1) {
            result.add(tileKey(x, y));
          }
          continue;
        }

        if (dist <= maxRange && hasLineOfSightOnTiles(x, y, enemyPlacement.x, enemyPlacement.y, tileByKey)) {
          result.add(tileKey(x, y));
        }
      }
    }
    return result;
  }

  function resolveSelectedSourceTargetableCells(): Set<string> {
    if (!playerPlacement || !player || !input.selectedSource || input.selectedSource.kind === 'none') {
      return resolveBasicAttackTargetableCells();
    }

    if (input.selectedSource.kind === 'skill') {
      const selectedSource = input.selectedSource;
      const skillEntry = input.availableSkills?.find((entry) => entry.skillId === selectedSource.skillId || entry.definition.id === selectedSource.skillId);
      if (!skillEntry) {
        return new Set();
      }
      const targetConfig = normalizeSkillTargetConfig(skillEntry.definition);
      const requiresLineOfSight = skillEntry.definition.cast?.requiresLineOfSight === true;
      const result = new Set<string>();

      if (targetConfig.targetType === 'self') {
        result.add(tileKey(playerPlacement.x, playerPlacement.y));
        return result;
      }

      if (targetConfig.targetType === 'cell') {
        for (let x = 0; x < input.battleMapWidth; x += 1) {
          for (let y = 0; y < input.battleMapHeight; y += 1) {
            const dist = Math.abs(playerPlacement.x - x) + Math.abs(playerPlacement.y - y);
            if ((targetConfig.range == null || dist <= targetConfig.range)
              && (!requiresLineOfSight || hasLineOfSightOnTiles(playerPlacement.x, playerPlacement.y, x, y, tileByKey))) {
              result.add(tileKey(x, y));
            }
          }
        }
        return result;
      }

      for (const placement of placements) {
        const entity = entityById.get(placement.entityId);
        if (!entity || !entity.isAlive) {
          continue;
        }
        const isSelf = entity.id === player.id;
        const isEnemy = entity.team === TeamSide.Right;
        const isAlly = entity.team === TeamSide.Left && !isSelf;
        if (isSelf && !targetConfig.canTargetSelf) {
          continue;
        }
        if (isEnemy && !targetConfig.canTargetEnemies) {
          continue;
        }
        if (isAlly && !targetConfig.canTargetAllies) {
          continue;
        }
        const dist = Math.abs(playerPlacement.x - placement.x) + Math.abs(playerPlacement.y - placement.y);
        if (targetConfig.range != null && dist > targetConfig.range) {
          continue;
        }
        if (requiresLineOfSight && !hasLineOfSightOnTiles(playerPlacement.x, playerPlacement.y, placement.x, placement.y, tileByKey)) {
          continue;
        }
        result.add(tileKey(placement.x, placement.y));
      }
      return result;
    }

    if (input.selectedSource.kind === 'item') {
      const selectedSource = input.selectedSource;
      const adminItem = input.resolveAdminItemById?.(selectedSource.itemId) ?? null;
      const itemTarget = normalizeItemTargetConfig(adminItem);
      const result = new Set<string>();
      if (itemTarget.targetType === 'cell') {
        for (let x = 0; x < input.battleMapWidth; x += 1) {
          for (let y = 0; y < input.battleMapHeight; y += 1) {
            result.add(tileKey(x, y));
          }
        }
        return result;
      }
      for (const placement of placements) {
        const entity = entityById.get(placement.entityId);
        if (entity?.isAlive) {
          result.add(tileKey(placement.x, placement.y));
        }
      }
      return result;
    }

    return resolveBasicAttackTargetableCells();
  }

  const targetableCells = resolveSelectedSourceTargetableCells();

  return {
    entitiesForRender,
    placements,
    entityById,
    placementByTile,
    tileByKey,
    player,
    selectedEnemy,
    playerPlacement,
    playerStyle,
    adjacentMeleeEnemies,
    movableCells,
    targetableCells,
    threatenedCells,
    getTileKey: tileKey,
    getTileMovementBlocked(x: number, y: number) {
      return isTileMovementBlocked(tileByKey.get(tileKey(x, y)));
    },
    hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number) {
      return hasLineOfSightOnTiles(fromX, fromY, toX, toY, tileByKey);
    },
    isEntityInAttackRange(x: number, y: number) {
      if (!playerPlacement || !player) {
        return false;
      }
      const dist = Math.abs(playerPlacement.x - x) + Math.abs(playerPlacement.y - y);
      if (playerStyle === 'MELEE') {
        return dist <= 1;
      }
      const maxRange = getMaxAttackRange(player, playerStyle);
      return dist <= maxRange && hasLineOfSightOnTiles(playerPlacement.x, playerPlacement.y, x, y, tileByKey);
    },
    getMoveCloserTile(enemyX: number, enemyY: number) {
      const candidates = [...movableCells.entries()]
        .map(([key, info]) => {
          const [x, y] = key.split(':').map(Number);
          return {
            x,
            y,
            enemyDist: Math.abs(enemyX - x) + Math.abs(enemyY - y),
            movementType: info.movementType,
            willTriggerOpportunity: info.willTriggerOpportunity,
          };
        })
        .sort((left, right) => left.enemyDist - right.enemyDist);
      return candidates[0] ?? null;
    },
    resolveClickedTarget(x: number, y: number): ResolvedBattleClickTarget {
      const cell = { x, y };
      const placement = placementByTile.get(tileKey(x, y));
      if (placement) {
        const entity = entityById.get(placement.entityId);
        if (entity && entity.id === input.playerId) {
          return { kind: 'self', actorId: entity.id, entity, cell };
        }
        if (entity) {
          return { kind: 'entity', entityId: entity.id, entity, cell };
        }
      }
      if (isTileMovementBlocked(tileByKey.get(tileKey(x, y)))) {
        return { kind: 'blocked', cell };
      }
      return { kind: 'cell', cell, move: movableCells.get(tileKey(x, y)) ?? null };
    },
    toClickedCombatTarget(target: ResolvedBattleClickTarget): ClickedCombatTarget | null {
      if (target.kind === 'self') {
        return { kind: 'self', actorId: target.actorId };
      }
      if (target.kind === 'entity') {
        return { kind: 'entity', entityId: target.entityId };
      }
      if (target.kind === 'cell') {
        return { kind: 'cell', x: target.cell.x, y: target.cell.y };
      }
      return null;
    },
  };
}
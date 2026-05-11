import type {
  BattleMapCell,
  BattleMapCellType,
  BattleMapDefinition,
  BattleMapPlacedNpc,
  BattleMapPlacedObject,
  BattleMapSpawnZone,
  BattleMapTrap,
  BattleMapTrigger,
  ExitZone,
} from '@theend/rpg-domain';
import { createContentEntry, deleteContentEntry, getContentCollection, updateContentEntry } from '../content/contentApi';

export const DEFAULT_BATTLE_MAP_ID = 'battlemap_arklein_arena_test';
let battleMapsCache: BattleMapDefinition[] | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueCells(cells: Array<{ x: number; y: number }>, width: number, height: number): Array<{ x: number; y: number }> {
  const keys = new Set<string>();
  const result: Array<{ x: number; y: number }> = [];
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
      continue;
    }
    if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) {
      continue;
    }
    const key = `${cell.x}:${cell.y}`;
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    result.push({ x: cell.x, y: cell.y });
  }
  return result;
}

function normalizeCellType(type: unknown): BattleMapCellType {
  switch (type) {
    case 'blocked':
    case 'trap':
    case 'difficult':
    case 'water':
    case 'lowCover':
    case 'highCover':
      return type;
    default:
      return 'walkable';
  }
}

function normalizeCells(cells: unknown, width: number, height: number): BattleMapCell[] {
  if (!Array.isArray(cells)) {
    return [];
  }

  const normalized: BattleMapCell[] = [];
  const keys = new Set<string>();
  for (const cell of cells) {
    if (!cell || typeof cell !== 'object') {
      continue;
    }
    const candidate = cell as Partial<BattleMapCell>;
    if (!Number.isInteger(candidate.x) || !Number.isInteger(candidate.y)) {
      continue;
    }
    if (candidate.x! < 0 || candidate.x! >= width || candidate.y! < 0 || candidate.y! >= height) {
      continue;
    }
    const key = `${candidate.x}:${candidate.y}`;
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    normalized.push({
      x: candidate.x!,
      y: candidate.y!,
      type: normalizeCellType(candidate.type),
      trapId: typeof candidate.trapId === 'string' ? candidate.trapId : undefined,
      movementCost: Number.isFinite(candidate.movementCost) ? Number(candidate.movementCost) : undefined,
      blocksMovement: typeof candidate.blocksMovement === 'boolean' ? candidate.blocksMovement : undefined,
      blocksLineOfSight: typeof candidate.blocksLineOfSight === 'boolean' ? candidate.blocksLineOfSight : undefined,
    });
  }
  return normalized;
}

function normalizeSpawnZones(spawnZones: unknown, width: number, height: number): BattleMapSpawnZone[] {
  if (!Array.isArray(spawnZones)) {
    return [];
  }
  return spawnZones
    .filter((zone) => zone && typeof zone === 'object')
    .map((zone, index) => {
      const candidate = zone as Partial<BattleMapSpawnZone>;
      const type = candidate.type === 'enemy'
        || candidate.type === 'neutralNpc'
        || candidate.type === 'reinforcement'
        ? candidate.type
        : 'player';
      return {
        id: typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id : `spawn-zone-${index + 1}`,
        type,
        name: typeof candidate.name === 'string' && candidate.name.trim().length > 0 ? candidate.name : `${type} spawn`,
        cells: uniqueCells(Array.isArray(candidate.cells) ? candidate.cells : [], width, height),
      };
    });
}

function normalizeObjects(objects: unknown, width: number, height: number): BattleMapPlacedObject[] {
  if (!Array.isArray(objects)) {
    return [];
  }

  return objects
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const object = entry as Partial<BattleMapPlacedObject>;
      return {
        id: typeof object.id === 'string' && object.id.trim().length > 0 ? object.id : `object-${index + 1}`,
        type: object.type ?? 'decoration',
        name: typeof object.name === 'string' && object.name.trim().length > 0 ? object.name : `Object ${index + 1}`,
        x: clamp(Number.isInteger(object.x) ? object.x! : 0, 0, width - 1),
        y: clamp(Number.isInteger(object.y) ? object.y! : 0, 0, height - 1),
        width: Number.isInteger(object.width) ? Math.max(1, object.width!) : 1,
        height: Number.isInteger(object.height) ? Math.max(1, object.height!) : 1,
        iconUrl: typeof object.iconUrl === 'string' ? object.iconUrl : undefined,
        imageUrl: typeof object.imageUrl === 'string' ? object.imageUrl : undefined,
        blocksMovement: typeof object.blocksMovement === 'boolean' ? object.blocksMovement : undefined,
        blocksLineOfSight: typeof object.blocksLineOfSight === 'boolean' ? object.blocksLineOfSight : undefined,
        interactable: typeof object.interactable === 'boolean' ? object.interactable : undefined,
        lootTableId: typeof object.lootTableId === 'string' ? object.lootTableId : undefined,
        questId: typeof object.questId === 'string' ? object.questId : undefined,
        triggerId: typeof object.triggerId === 'string' ? object.triggerId : undefined,
        description: typeof object.description === 'string' ? object.description : undefined,
      };
    });
}

function normalizeTraps(traps: unknown, width: number, height: number): BattleMapTrap[] {
  if (!Array.isArray(traps)) {
    return [];
  }
  return traps
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const trap = entry as Partial<BattleMapTrap>;
      return {
        id: typeof trap.id === 'string' && trap.id.trim().length > 0 ? trap.id : `trap-${index + 1}`,
        name: typeof trap.name === 'string' && trap.name.trim().length > 0 ? trap.name : `Trap ${index + 1}`,
        x: clamp(Number.isInteger(trap.x) ? trap.x! : 0, 0, width - 1),
        y: clamp(Number.isInteger(trap.y) ? trap.y! : 0, 0, height - 1),
        damage: Number.isFinite(trap.damage) ? Number(trap.damage) : undefined,
        staminaCost: Number.isFinite(trap.staminaCost) ? Number(trap.staminaCost) : undefined,
        triggerOnce: typeof trap.triggerOnce === 'boolean' ? trap.triggerOnce : undefined,
        revealedByDefault: typeof trap.revealedByDefault === 'boolean' ? trap.revealedByDefault : undefined,
        detectionDifficulty: Number.isFinite(trap.detectionDifficulty) ? Number(trap.detectionDifficulty) : undefined,
        description: typeof trap.description === 'string' ? trap.description : undefined,
      };
    });
}

function normalizeNpcs(npcs: unknown, width: number, height: number): BattleMapPlacedNpc[] {
  if (!Array.isArray(npcs)) {
    return [];
  }
  return npcs
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const npc = entry as Partial<BattleMapPlacedNpc>;
      return {
        id: typeof npc.id === 'string' && npc.id.trim().length > 0 ? npc.id : `npc-${index + 1}`,
        npcId: typeof npc.npcId === 'string' ? npc.npcId : undefined,
        name: typeof npc.name === 'string' && npc.name.trim().length > 0 ? npc.name : `NPC ${index + 1}`,
        role: npc.role ?? 'neutral',
        x: clamp(Number.isInteger(npc.x) ? npc.x! : 0, 0, width - 1),
        y: clamp(Number.isInteger(npc.y) ? npc.y! : 0, 0, height - 1),
        factionId: typeof npc.factionId === 'string' ? npc.factionId : undefined,
        dialogueId: typeof npc.dialogueId === 'string' ? npc.dialogueId : undefined,
        questId: typeof npc.questId === 'string' ? npc.questId : undefined,
        merchantId: typeof npc.merchantId === 'string' ? npc.merchantId : undefined,
        startsCombat: typeof npc.startsCombat === 'boolean' ? npc.startsCombat : undefined,
        avatarUrl: typeof npc.avatarUrl === 'string' ? npc.avatarUrl : undefined,
        description: typeof npc.description === 'string' ? npc.description : undefined,
      };
    });
}

function normalizeTriggers(triggers: unknown, width: number, height: number): BattleMapTrigger[] {
  if (!Array.isArray(triggers)) {
    return [];
  }
  return triggers
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const trigger = entry as Partial<BattleMapTrigger>;
      return {
        id: typeof trigger.id === 'string' && trigger.id.trim().length > 0 ? trigger.id : `trigger-${index + 1}`,
        type: trigger.type ?? 'custom',
        name: typeof trigger.name === 'string' && trigger.name.trim().length > 0 ? trigger.name : `Trigger ${index + 1}`,
        cells: uniqueCells(Array.isArray(trigger.cells) ? trigger.cells : [], width, height),
        questId: typeof trigger.questId === 'string' ? trigger.questId : undefined,
        dialogueId: typeof trigger.dialogueId === 'string' ? trigger.dialogueId : undefined,
        targetBattleMapId: typeof trigger.targetBattleMapId === 'string' ? trigger.targetBattleMapId : undefined,
        targetWorldZoneId: typeof trigger.targetWorldZoneId === 'string' ? trigger.targetWorldZoneId : undefined,
        startsCombat: typeof trigger.startsCombat === 'boolean' ? trigger.startsCombat : undefined,
        once: typeof trigger.once === 'boolean' ? trigger.once : undefined,
        enabled: typeof trigger.enabled === 'boolean' ? trigger.enabled : undefined,
        description: typeof trigger.description === 'string' ? trigger.description : undefined,
      };
    });
}

function normalizeExitZones(exitZones: unknown, width: number, height: number): ExitZone[] {
  if (!Array.isArray(exitZones)) {
    return [];
  }
  return exitZones
    .filter((zone) => zone && typeof zone === 'object')
    .map((zone, index) => {
      const candidate = zone as Partial<ExitZone>;
      const id = typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id.trim() : `exit_zone_${String(index + 1).padStart(3, '0')}`;
      const team = candidate.team === 'enemy' || candidate.team === 'any' ? candidate.team : 'player';
      return {
        id,
        cells: uniqueCells(Array.isArray(candidate.cells) ? candidate.cells : [], width, height),
        team,
        enabledForArena: false,
        label: typeof candidate.label === 'string' ? candidate.label : undefined,
        description: typeof candidate.description === 'string' ? candidate.description : undefined,
      };
    })
    .filter((zone) => zone.cells.length > 0);
}

function getCellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function createWalkableCells(width: number, height: number): BattleMapCell[] {
  return Array.from({ length: width * height }, (_, index) => ({
    x: index % width,
    y: Math.floor(index / width),
    type: 'walkable' as const,
  }));
}

export function createDefaultBattleMap(): BattleMapDefinition {
  const now = Date.now();
  return {
    id: DEFAULT_BATTLE_MAP_ID,
    name: 'Arklein Arena Test Map',
    description: 'Default tactical test arena for Arklein.',
    imageUrl: '/map/battle-map_arena.png',
    cellSizePx: 64,
    gridOffsetX: 0,
    gridOffsetY: 0,
    logicalColumns: 12,
    logicalRows: 12,
    showEditorGrid: false,
    gridOpacity: 0.12,
    width: 12,
    height: 12,
    viewportWidth: 12,
    viewportHeight: 12,
    cells: createWalkableCells(12, 12),
    spawnZones: [
      {
        id: 'spawn-player-default',
        type: 'player',
        name: 'Player Spawn',
        cells: Array.from({ length: 4 }, (_, index) => ({ x: 1, y: 3 + index })),
      },
      {
        id: 'spawn-enemy-default',
        type: 'enemy',
        name: 'Enemy Spawn',
        cells: Array.from({ length: 4 }, (_, index) => ({ x: 10, y: 3 + index })),
      },
    ],
    objects: [],
    traps: [],
    npcs: [],
    triggers: [],
    tags: ['arena', 'arklein', 'default'],
    linkedLocationId: 'arklein_arena',
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeBattleMap(map: Partial<BattleMapDefinition>): BattleMapDefinition {
  const fallback = createDefaultBattleMap();
  const width = Math.max(12, Number.isInteger(map.width) ? map.width! : fallback.width);
  const height = Math.max(12, Number.isInteger(map.height) ? map.height! : fallback.height);
  const viewportWidth = clamp(Number.isInteger(map.viewportWidth) ? map.viewportWidth! : fallback.viewportWidth, 6, width);
  const viewportHeight = clamp(Number.isInteger(map.viewportHeight) ? map.viewportHeight! : fallback.viewportHeight, 6, height);
  const cellSizePx = Number.isFinite(map.cellSizePx) ? clamp(Number(map.cellSizePx), 32, 160) : (fallback.cellSizePx ?? 64);
  const logicalColumns = Number.isInteger(map.logicalColumns) ? clamp(Number(map.logicalColumns), 6, 80) : width;
  const logicalRows = Number.isInteger(map.logicalRows) ? clamp(Number(map.logicalRows), 6, 80) : height;
  const gridOffsetX = Number.isFinite(map.gridOffsetX) ? Number(map.gridOffsetX) : (fallback.gridOffsetX ?? 0);
  const gridOffsetY = Number.isFinite(map.gridOffsetY) ? Number(map.gridOffsetY) : (fallback.gridOffsetY ?? 0);
  const showEditorGrid = typeof map.showEditorGrid === 'boolean' ? map.showEditorGrid : (fallback.showEditorGrid ?? false);
  const gridOpacity = Number.isFinite(map.gridOpacity) ? clamp(Number(map.gridOpacity), 0.03, 0.9) : (fallback.gridOpacity ?? 0.12);
  const now = Date.now();
  const normalizedCells = normalizeCells(map.cells, width, height);

  return {
    id: typeof map.id === 'string' && map.id.trim().length > 0 ? map.id.trim() : fallback.id,
    name: typeof map.name === 'string' && map.name.trim().length > 0 ? map.name.trim() : fallback.name,
    description: typeof map.description === 'string' ? map.description : fallback.description,
    imageUrl: typeof map.imageUrl === 'string' ? map.imageUrl : fallback.imageUrl,
    cellSizePx,
    gridOffsetX,
    gridOffsetY,
    logicalColumns,
    logicalRows,
    showEditorGrid,
    gridOpacity,
    width,
    height,
    viewportWidth,
    viewportHeight,
    cells: normalizedCells.length > 0 ? normalizedCells : createWalkableCells(width, height),
    spawnZones: normalizeSpawnZones(map.spawnZones, width, height),
    objects: normalizeObjects(map.objects, width, height),
    traps: normalizeTraps(map.traps, width, height),
    npcs: normalizeNpcs(map.npcs, width, height),
    triggers: normalizeTriggers(map.triggers, width, height),
    exitZones: normalizeExitZones((map as Partial<BattleMapDefinition>).exitZones, width, height),
    tags: Array.isArray(map.tags) ? map.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) : fallback.tags,
    linkedLocationId: typeof map.linkedLocationId === 'string' ? map.linkedLocationId : fallback.linkedLocationId,
    linkedQuestId: typeof map.linkedQuestId === 'string' ? map.linkedQuestId : undefined,
    linkedZoneId: typeof map.linkedZoneId === 'string' ? map.linkedZoneId : undefined,
    createdAt: Number.isFinite(map.createdAt) ? Number(map.createdAt) : now,
    updatedAt: Number.isFinite(map.updatedAt) ? Number(map.updatedAt) : now,
  };
}

export function validateBattleMap(map: BattleMapDefinition): string[] {
  const issues: string[] = [];
  if (!map.id.trim()) {
    issues.push('ID is required.');
  }
  if (!map.name.trim()) {
    issues.push('Name is required.');
  }
  if (map.width < 12) {
    issues.push('Width must be at least 12.');
  }
  if (map.height < 12) {
    issues.push('Height must be at least 12.');
  }
  if (map.viewportWidth < 6) {
    issues.push('Viewport width must be at least 6.');
  }
  if (map.viewportHeight < 6) {
    issues.push('Viewport height must be at least 6.');
  }
  if (map.viewportWidth > map.width) {
    issues.push('Viewport width cannot exceed map width.');
  }
  if (map.viewportHeight > map.height) {
    issues.push('Viewport height cannot exceed map height.');
  }

  const blockedCellKeys = new Set(
    map.cells
      .filter((cell) => cell.type === 'blocked' || cell.blocksMovement)
      .map((cell) => getCellKey(cell.x, cell.y)),
  );

  const playerSpawnCount = map.spawnZones
    .filter((zone) => zone.type === 'player')
    .reduce((sum, zone) => sum + zone.cells.length, 0);
  const enemySpawnCount = map.spawnZones
    .filter((zone) => zone.type === 'enemy')
    .reduce((sum, zone) => sum + zone.cells.length, 0);
  if (playerSpawnCount === 0) {
    issues.push('At least one player spawn cell is required.');
  }
  if (enemySpawnCount === 0) {
    issues.push('At least one enemy spawn cell is required.');
  }

  for (const zone of map.spawnZones) {
    for (const cell of zone.cells) {
      if (blockedCellKeys.has(getCellKey(cell.x, cell.y))) {
        issues.push(`Spawn zone ${zone.name} uses blocked cell ${cell.x}:${cell.y}.`);
      }
    }
  }

  for (const npc of map.npcs) {
    if (blockedCellKeys.has(getCellKey(npc.x, npc.y))) {
      issues.push(`NPC ${npc.name} is placed on a blocked cell.`);
    }
  }

  const blockingObjects = map.objects.filter((object) => object.blocksMovement);
  for (let index = 0; index < blockingObjects.length; index += 1) {
    const left = blockingObjects[index]!;
    for (let inner = index + 1; inner < blockingObjects.length; inner += 1) {
      const right = blockingObjects[inner]!;
      const leftWidth = left.width ?? 1;
      const leftHeight = left.height ?? 1;
      const rightWidth = right.width ?? 1;
      const rightHeight = right.height ?? 1;
      const overlaps = left.x < right.x + rightWidth
        && left.x + leftWidth > right.x
        && left.y < right.y + rightHeight
        && left.y + leftHeight > right.y;
      if (overlaps) {
        issues.push(`Blocking objects ${left.id} and ${right.id} overlap.`);
      }
    }
  }

  const allowedTrapCells = new Set(['walkable', 'difficult', 'water', 'trap']);
  for (const trap of map.traps) {
    const trapCell = map.cells.find((cell) => cell.x === trap.x && cell.y === trap.y);
    if (trapCell && !allowedTrapCells.has(trapCell.type)) {
      issues.push(`Trap ${trap.id} is placed on invalid cell type ${trapCell.type}.`);
    }
  }

  for (const trigger of map.triggers) {
    for (const cell of trigger.cells) {
      if (cell.x < 0 || cell.x >= map.width || cell.y < 0 || cell.y >= map.height) {
        issues.push(`Trigger ${trigger.id} has out-of-bounds cell ${cell.x}:${cell.y}.`);
      }
    }
  }

  const allIds = [
    ...map.objects.map((object) => object.id),
    ...map.npcs.map((npc) => npc.id),
    ...map.traps.map((trap) => trap.id),
    ...map.triggers.map((trigger) => trigger.id),
  ];
  const seenIds = new Set<string>();
  for (const id of allIds) {
    if (seenIds.has(id)) {
      issues.push(`Duplicate object/NPC/trap/trigger id: ${id}.`);
      continue;
    }
    seenIds.add(id);
  }

  if (!map.imageUrl?.trim()) {
    issues.push('Warning: map has no background image.');
  }
  if (map.traps.length === 0) {
    issues.push('Warning: map has no traps.');
  }
  if (map.objects.length === 0) {
    issues.push('Warning: map has no objects.');
  }
  if (map.triggers.length === 0) {
    issues.push('Warning: map has no triggers.');
  }
  if (map.npcs.length === 0) {
    issues.push('Warning: map has no NPCs.');
  }
  if ((map.width > 12 || map.height > 12) && (map.viewportWidth === 12 && map.viewportHeight === 12)) {
    issues.push('Warning: map is larger than 12x12 but viewport was not adjusted.');
  }
  return issues;
}

export function loadBattleMaps(): BattleMapDefinition[] {
  if (battleMapsCache) {
    return battleMapsCache;
  }

  battleMapsCache = [createDefaultBattleMap()];
  return battleMapsCache;
}

export function saveBattleMaps(maps: BattleMapDefinition[]): void {
  battleMapsCache = maps.map((map) => normalizeBattleMap(map));
}

export async function loadBattleMapsFromStore(): Promise<BattleMapDefinition[]> {
  const remote = (await getContentCollection<BattleMapDefinition>('battleMaps')).map((map) => normalizeBattleMap(map));
  const maps = remote.length > 0 ? remote : loadBattleMaps();
  battleMapsCache = maps;
  if (remote.length === 0) {
    await saveBattleMapsToStore(maps);
  }
  return maps;
}

export async function saveBattleMapsToStore(maps: BattleMapDefinition[]): Promise<void> {
  const normalized = maps.map((map) => normalizeBattleMap(map));
  battleMapsCache = normalized;
  const existing = await getContentCollection<BattleMapDefinition>('battleMaps');
  const existingIds = new Set(existing.map((map) => map.id));
  const nextIds = new Set(normalized.map((map) => map.id));

  await Promise.all(normalized.map((map) =>
    existingIds.has(map.id)
      ? updateContentEntry<BattleMapDefinition>('battleMaps', map.id, map)
      : createContentEntry<BattleMapDefinition>('battleMaps', map),
  ));

  await Promise.all(existing.filter((map) => !nextIds.has(map.id)).map((map) => deleteContentEntry('battleMaps', map.id)));
}

export function getBattleMapById(id: string): BattleMapDefinition | null {
  return loadBattleMaps().find((map) => map.id === id) ?? null;
}

export function upsertBattleMap(map: BattleMapDefinition): void {
  const normalized = normalizeBattleMap({ ...map, updatedAt: Date.now() });
  const maps = loadBattleMaps();
  const index = maps.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) {
    maps[index] = normalized;
  } else {
    maps.push(normalized);
  }
  saveBattleMaps(maps);
  void saveBattleMapsToStore(maps).catch(() => undefined);
}

export function deleteBattleMap(id: string): void {
  const maps = loadBattleMaps().filter((map) => map.id !== id);
  saveBattleMaps(maps.length > 0 ? maps : [createDefaultBattleMap()]);
  void deleteContentEntry('battleMaps', id).catch(() => undefined);
}

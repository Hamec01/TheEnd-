const WORLD_MAP_DISCOVERY_STORAGE_PREFIX = 'theend.worldMap.discoveredCells';
const WORLD_MAP_ENTITY_DISCOVERY_STORAGE_PREFIX = 'theend.worldMap.discoveryState';

export const WORLD_MAP_EXPLORATION_GRID_SIZE = 48;
export const WORLD_MAP_EXPLORATION_REVEAL_RADIUS = 2;

export type MapDiscoveryEntityType = 'city' | 'location' | 'zone';

export interface PlayerMapDiscoveryState {
  discoveredCityIds: string[];
  discoveredLocationIds: string[];
  discoveredZoneIds: string[];
}

export interface MapDiscoveryMarker {
  id: string;
  entityId: string;
  entityType: MapDiscoveryEntityType;
  title: string;
  x: number;
  y: number;
  icon?: string;
  discovered: boolean;
}

export const EMPTY_MAP_DISCOVERY_STATE: PlayerMapDiscoveryState = {
  discoveredCityIds: [],
  discoveredLocationIds: [],
  discoveredZoneIds: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeCellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function parseCellKey(key: string): { x: number; y: number } | null {
  const [xRaw, yRaw] = key.split(':');
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }
  return { x, y };
}

function getStorageKey(characterId: string): string {
  return `${WORLD_MAP_DISCOVERY_STORAGE_PREFIX}.${characterId}`;
}

function getEntityDiscoveryStorageKey(characterId: string): string {
  return `${WORLD_MAP_ENTITY_DISCOVERY_STORAGE_PREFIX}.${characterId}`;
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean),
  ));
}

export function getExplorationCellKeyFromPosition(
  x: number,
  y: number,
  gridSize: number = WORLD_MAP_EXPLORATION_GRID_SIZE,
): string {
  const clampedX = clamp(x, 0, 0.999999);
  const clampedY = clamp(y, 0, 0.999999);
  const cellX = clamp(Math.floor(clampedX * gridSize), 0, gridSize - 1);
  const cellY = clamp(Math.floor(clampedY * gridSize), 0, gridSize - 1);
  return makeCellKey(cellX, cellY);
}

export function normalizeDiscoveredCells(
  cells: string[],
  gridSize: number = WORLD_MAP_EXPLORATION_GRID_SIZE,
): string[] {
  const next = new Set<string>();
  for (const key of cells) {
    const parsed = parseCellKey(key);
    if (!parsed) {
      continue;
    }

    if (parsed.x < 0 || parsed.y < 0 || parsed.x >= gridSize || parsed.y >= gridSize) {
      continue;
    }

    next.add(makeCellKey(parsed.x, parsed.y));
  }

  return Array.from(next);
}

export function revealCellsAroundPosition(
  currentCells: string[],
  x: number,
  y: number,
  radius: number = WORLD_MAP_EXPLORATION_REVEAL_RADIUS,
  gridSize: number = WORLD_MAP_EXPLORATION_GRID_SIZE,
): string[] {
  const centerKey = getExplorationCellKeyFromPosition(x, y, gridSize);
  const parsedCenter = parseCellKey(centerKey);
  if (!parsedCenter) {
    return currentCells;
  }

  const next = new Set(normalizeDiscoveredCells(currentCells, gridSize));
  const beforeCount = next.size;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const cellX = parsedCenter.x + dx;
      const cellY = parsedCenter.y + dy;
      if (cellX < 0 || cellY < 0 || cellX >= gridSize || cellY >= gridSize) {
        continue;
      }

      next.add(makeCellKey(cellX, cellY));
    }
  }

  if (next.size === beforeCount) {
    return currentCells;
  }

  return Array.from(next);
}

export function isPositionDiscovered(
  discoveredCells: string[],
  x: number,
  y: number,
  gridSize: number = WORLD_MAP_EXPLORATION_GRID_SIZE,
): boolean {
  const discovered = new Set(normalizeDiscoveredCells(discoveredCells, gridSize));
  return discovered.has(getExplorationCellKeyFromPosition(x, y, gridSize));
}

export function loadDiscoveredCells(characterId: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(getStorageKey(characterId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeDiscoveredCells(parsed.map((entry) => String(entry)));
  } catch {
    return [];
  }
}

export function saveDiscoveredCells(characterId: string, cells: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeDiscoveredCells(cells);
  window.localStorage.setItem(getStorageKey(characterId), JSON.stringify(normalized));
}

export function normalizeMapDiscoveryState(value: unknown): PlayerMapDiscoveryState {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<PlayerMapDiscoveryState>
    : {};

  return {
    discoveredCityIds: normalizeIdList(record.discoveredCityIds),
    discoveredLocationIds: normalizeIdList(record.discoveredLocationIds),
    discoveredZoneIds: normalizeIdList(record.discoveredZoneIds),
  };
}

export function loadMapDiscoveryState(characterId: string): PlayerMapDiscoveryState {
  if (typeof window === 'undefined') {
    return EMPTY_MAP_DISCOVERY_STATE;
  }

  const raw = window.localStorage.getItem(getEntityDiscoveryStorageKey(characterId));
  if (!raw) {
    return EMPTY_MAP_DISCOVERY_STATE;
  }

  try {
    return normalizeMapDiscoveryState(JSON.parse(raw));
  } catch {
    return EMPTY_MAP_DISCOVERY_STATE;
  }
}

export function saveMapDiscoveryState(characterId: string, state: PlayerMapDiscoveryState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    getEntityDiscoveryStorageKey(characterId),
    JSON.stringify(normalizeMapDiscoveryState(state)),
  );
}

export function addDiscoveredMapEntity(
  state: PlayerMapDiscoveryState,
  entityType: MapDiscoveryEntityType,
  entityId: string,
): PlayerMapDiscoveryState {
  const normalizedId = String(entityId ?? '').trim();
  if (!normalizedId) {
    return normalizeMapDiscoveryState(state);
  }

  const next = normalizeMapDiscoveryState(state);
  const key = entityType === 'city'
    ? 'discoveredCityIds'
    : entityType === 'location'
      ? 'discoveredLocationIds'
      : 'discoveredZoneIds';

  if (next[key].includes(normalizedId)) {
    return next;
  }

  return {
    ...next,
    [key]: [...next[key], normalizedId],
  };
}

import type { PaintedRegion, RegionType, ZoneEditorSettings, ZoneType, ZoneValidationResult, WorldMapZone } from './zoneEditorTypes';
import { createDefaultEditorSettings } from './zoneEditorTypes';

export const DEV_ZONE_STORAGE_KEY = 'theend.worldMap.zones.dev';
export const EDITOR_SETTINGS_STORAGE_KEY = 'theend.worldMap.editor.settings';

const ZONE_TYPES: ZoneType[] = [
  'city', 'settlement', 'quest', 'story', 'landmark', 'danger', 'grind', 'resource', 'profession', 'dungeon', 'transition', 'safe', 'event', 'faction', 'locked', 'fast_travel', 'rest',
];

const REGION_TYPES: RegionType[] = ['walkable', 'blocked', 'water', 'road', 'danger', 'trigger'];

export interface EditorDataValidationResult extends ZoneValidationResult {
  regions: PaintedRegion[];
}

export interface EditorDataPayload {
  zones: WorldMapZone[];
  regions: PaintedRegion[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPoint(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && isFiniteNumber(value[0])
    && isFiniteNumber(value[1])
    && value[0] >= 0 && value[0] <= 1
    && value[1] >= 0 && value[1] <= 1;
}

function normalizeRegion(input: unknown): PaintedRegion | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const region = input as Record<string, unknown>;
  const type = region.type;
  if (!REGION_TYPES.includes(type as RegionType)) {
    return null;
  }

  if (!Array.isArray(region.cells)) {
    return null;
  }

  const seen = new Set<string>();
  const cells: PaintedRegion['cells'] = [];
  for (const entry of region.cells) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const cell = entry as Record<string, unknown>;
    if (!isFiniteNumber(cell.x) || !isFiniteNumber(cell.y)) {
      continue;
    }

    const x = Math.floor(cell.x);
    const y = Math.floor(cell.y);
    if (x < 0 || y < 0 || x > 4096 || y > 4096) {
      continue;
    }

    const key = `${x}:${y}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cells.push({ x, y });
  }

  return {
    id: String(region.id ?? '').trim(),
    name: String(region.name ?? '').trim() || String(type),
    type: type as RegionType,
    cells,
  };
}

export function normalizeZone(input: unknown): WorldMapZone | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const zone = input as Record<string, unknown>;
  const shape = zone.shape;
  const type = zone.type;
  if ((shape !== 'circle' && shape !== 'polygon' && shape !== 'rect') || !ZONE_TYPES.includes(type as ZoneType)) {
    return null;
  }

  const normalized: WorldMapZone = {
    id: String(zone.id ?? '').trim(),
    name: String(zone.name ?? '').trim(),
    type: type as ZoneType,
    shape,
    region: zone.region ? String(zone.region) : undefined,
    faction: zone.faction ? String(zone.faction) : undefined,
    description: String(zone.description ?? ''),
    tooltip: zone.tooltip ? String(zone.tooltip) : undefined,
    dangerLevel: isFiniteNumber(zone.dangerLevel) ? zone.dangerLevel : 0,
    recommendedLevel: isFiniteNumber(zone.recommendedLevel) ? zone.recommendedLevel : undefined,
    requiredLevel: isFiniteNumber(zone.requiredLevel) ? zone.requiredLevel : undefined,
    requiredQuestId: zone.requiredQuestId ? String(zone.requiredQuestId) : undefined,
    requiredItemId: zone.requiredItemId ? String(zone.requiredItemId) : undefined,
    requiredFaction: zone.requiredFaction ? String(zone.requiredFaction) : undefined,
    targetScene: zone.targetScene ? String(zone.targetScene) : undefined,
    isDiscovered: zone.isDiscovered !== false,
    isVisibleToPlayer: zone.isVisibleToPlayer !== false,
    isSafeZone: zone.isSafeZone === true,
    allowPvP: zone.allowPvP === true,
    enemyTableId: zone.enemyTableId ? String(zone.enemyTableId) : undefined,
    resourceTableId: zone.resourceTableId ? String(zone.resourceTableId) : undefined,
    professionId: zone.professionId ? String(zone.professionId) : undefined,
    respawnSeconds: isFiniteNumber(zone.respawnSeconds) ? zone.respawnSeconds : undefined,
    cooldownSeconds: isFiniteNumber(zone.cooldownSeconds) ? zone.cooldownSeconds : undefined,
    createdAt: isFiniteNumber(zone.createdAt) ? zone.createdAt : Date.now(),
    updatedAt: isFiniteNumber(zone.updatedAt) ? zone.updatedAt : Date.now(),
  };

  if (!normalized.id || !normalized.name || !normalized.description) {
    return null;
  }

  if (shape === 'circle') {
    if (!isFiniteNumber(zone.x) || !isFiniteNumber(zone.y) || !isFiniteNumber(zone.radius)) {
      return null;
    }
    if (zone.x < 0 || zone.x > 1 || zone.y < 0 || zone.y > 1 || zone.radius <= 0 || zone.radius > 1) {
      return null;
    }
    normalized.x = zone.x;
    normalized.y = zone.y;
    normalized.radius = zone.radius;
  } else {
    if (!Array.isArray(zone.points)) {
      return null;
    }
    const points = zone.points.filter(isValidPoint);
    if (points.length < 3) {
      return null;
    }
    normalized.points = points;
  }

  return normalized;
}

export function validateZonesJson(text: string): ZoneValidationResult {
  const result = validateEditorDataJson(text);
  return {
    valid: result.valid,
    errors: result.errors,
    zones: result.zones,
  };
}

export function validateEditorDataJson(text: string): EditorDataValidationResult {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, errors: ['Invalid JSON syntax'], zones: [], regions: [] };
  }

  const rawZones = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).zones)
      ? (parsed as Record<string, unknown>).zones as unknown[]
      : null;
  const rawRegions = parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).regions)
    ? (parsed as Record<string, unknown>).regions as unknown[]
    : [];

  if (!rawZones) {
    return { valid: false, errors: ['JSON must be an array of zones or an object { zones, regions }'], zones: [], regions: [] };
  }

  const zones: WorldMapZone[] = [];
  const regions: PaintedRegion[] = [];
  const seenIds = new Set<string>();

  rawZones.forEach((entry, index) => {
    const zone = normalizeZone(entry);
    if (!zone) {
      errors.push(`Entry ${index + 1} is invalid`);
      return;
    }
    if (seenIds.has(zone.id)) {
      errors.push(`Duplicate zone id: ${zone.id}`);
      return;
    }
    seenIds.add(zone.id);
    zones.push(zone);
  });

  const seenRegionIds = new Set<string>();
  rawRegions.forEach((entry, index) => {
    const region = normalizeRegion(entry);
    if (!region) {
      errors.push(`Region entry ${index + 1} is invalid`);
      return;
    }
    if (!region.id) {
      errors.push(`Region entry ${index + 1} has empty id`);
      return;
    }
    if (seenRegionIds.has(region.id)) {
      errors.push(`Duplicate region id: ${region.id}`);
      return;
    }
    seenRegionIds.add(region.id);
    regions.push(region);
  });

  return {
    valid: errors.length === 0,
    errors,
    zones,
    regions,
  };
}

export function exportZonesJson(zones: WorldMapZone[]): string {
  return JSON.stringify(zones, null, 2);
}

export function exportEditorDataJson(zones: WorldMapZone[], regions: PaintedRegion[]): string {
  return JSON.stringify({ zones, regions }, null, 2);
}

export function loadEditorDataFromStorage(initialZones: WorldMapZone[]): EditorDataPayload {
  const raw = window.localStorage.getItem(DEV_ZONE_STORAGE_KEY);
  if (!raw) {
    return {
      zones: initialZones,
      regions: [],
    };
  }

  const result = validateEditorDataJson(raw);
  if (!result.valid) {
    return {
      zones: initialZones,
      regions: [],
    };
  }

  return {
    zones: result.zones,
    regions: result.regions,
  };
}

export function saveEditorDataToStorage(zones: WorldMapZone[], regions: PaintedRegion[]): void {
  window.localStorage.setItem(DEV_ZONE_STORAGE_KEY, exportEditorDataJson(zones, regions));
}

export function loadZonesFromStorage(initialZones: WorldMapZone[]): WorldMapZone[] {
  return loadEditorDataFromStorage(initialZones).zones;
}

export function saveZonesToStorage(zones: WorldMapZone[]): void {
  saveEditorDataToStorage(zones, []);
}

export function clearZoneStorage(): void {
  window.localStorage.removeItem(DEV_ZONE_STORAGE_KEY);
}

export function loadEditorSettings(): ZoneEditorSettings {
  const raw = window.localStorage.getItem(EDITOR_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return createDefaultEditorSettings();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ZoneEditorSettings>;
    return {
      ...createDefaultEditorSettings(),
      ...parsed,
    };
  } catch {
    return createDefaultEditorSettings();
  }
}

export function saveEditorSettings(settings: ZoneEditorSettings): void {
  window.localStorage.setItem(EDITOR_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function clearEditorSettingsStorage(): void {
  window.localStorage.removeItem(EDITOR_SETTINGS_STORAGE_KEY);
}

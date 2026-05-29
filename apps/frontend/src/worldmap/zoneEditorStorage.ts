import { getWorldMapContent, saveWorldMapContent } from '../services/content/contentApi';
import type { QuestMarkerDefinition, QuestMarkerType } from '../types/quest';
import type { LocationSpriteConfig, LocationStateSprites, PaintedRegion, RegionType, ZoneEditorSettings, ZoneType, ZoneValidationResult, WorldMapZone } from './zoneEditorTypes';
import { LEGACY_REGION_GRID_SIZE, REGION_GRID_SIZE } from './regionPaintSystem';
import { createDefaultEditorSettings } from './zoneEditorTypes';
import { normalizeWorldMapZone } from './zoneTaxonomy';

export const DEV_ZONE_STORAGE_KEY = 'theend.worldMap.zones.dev';
export const EDITOR_SETTINGS_STORAGE_KEY = 'theend.worldMap.editor.settings';
let editorDataDraft: EditorDataPayload | null = null;

const ZONE_TYPES: ZoneType[] = [
  'city',
  'settlement',
  'location',
  'quest',
  'quest_area',
  'random_event_area',
  'danger_area',
  'faction_area',
  'kingdom_area',
  'city_area',
  'resource_area',
  'hidden_area',
  'story',
  'landmark',
  'danger',
  'grind',
  'resource',
  'profession',
  'dungeon',
  'transition',
  'safe',
  'event',
  'faction',
  'locked',
  'fast_travel',
  'rest',
];

const REGION_TYPES: RegionType[] = ['walkable', 'blocked', 'water', 'swamp', 'sand', 'road', 'danger', 'trigger'];
const QUEST_MARKER_TYPES: QuestMarkerType[] = [
  'quest_start',
  'quest_objective',
  'quest_finish',
  'npc_quest',
  'item_spawn',
  'enemy_spawn',
  'inspect_object',
  'hidden_location',
];

export interface EditorDataValidationResult extends ZoneValidationResult {
  regions: PaintedRegion[];
  questMarkers: QuestMarkerDefinition[];
}

export interface EditorDataPayload {
  zones: WorldMapZone[];
  regions: PaintedRegion[];
  questMarkers: QuestMarkerDefinition[];
}

interface QuestMarkerExportJson {
  id: string;
  title: string;
  questId?: string;
  objectiveId?: string;
  stepId?: string;
  markerType: QuestMarkerType;
  x: number;
  y: number;
  mapId?: string;
  npcId?: string;
  icon?: string;
  visibleToPlayer?: boolean;
  conditionIds?: string[];
  imageUrl?: string;
  isActive?: boolean;
  requirements?: QuestMarkerDefinition['requirements'];
  hideAfterQuestCompleted?: boolean;
  hideAfterObjectiveCompleted?: boolean;
  hideAfterStepCompleted?: boolean;
  showOnWorldMap?: boolean;
  showOnMiniMap?: boolean;
  worldMapVisibility?: QuestMarkerDefinition['worldMapVisibility'];
  miniMapVisibility?: QuestMarkerDefinition['miniMapVisibility'];
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
  const rawGridSize = Number(region.gridSize);
  const sourceGridSize = Number.isFinite(rawGridSize) && rawGridSize > 0
    ? Math.floor(rawGridSize)
    : LEGACY_REGION_GRID_SIZE;
  const migrationScale = sourceGridSize === REGION_GRID_SIZE
    ? 1
    : (REGION_GRID_SIZE / sourceGridSize);

  const cells: PaintedRegion['cells'] = [];
  for (const entry of region.cells) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const cell = entry as Record<string, unknown>;
    if (!isFiniteNumber(cell.x) || !isFiniteNumber(cell.y)) {
      continue;
    }

    if (migrationScale > 1) {
      const baseX = Math.floor(cell.x * migrationScale);
      const baseY = Math.floor(cell.y * migrationScale);
      const span = Math.max(1, Math.ceil(migrationScale));
      for (let oy = 0; oy < span; oy += 1) {
        for (let ox = 0; ox < span; ox += 1) {
          const x = baseX + ox;
          const y = baseY + oy;
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
      }
      continue;
    }

    const x = Math.floor(cell.x * migrationScale);
    const y = Math.floor(cell.y * migrationScale);
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
    color: typeof region.color === 'string' ? region.color.trim() || undefined : undefined,
    gridSize: REGION_GRID_SIZE,
    cells,
  };
}

function normalizeQuestMarker(input: unknown): QuestMarkerDefinition | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const marker = input as Record<string, unknown>;
  const id = String(marker.id ?? '').trim();
  const title = String(marker.title ?? '').trim();
  const typeValue = String(marker.type ?? marker.markerType ?? 'quest_objective').trim();
  const type = QUEST_MARKER_TYPES.includes(typeValue as QuestMarkerType) ? typeValue as QuestMarkerType : 'quest_objective';
  const worldMapVisibility = marker.worldMapVisibility;
  const miniMapVisibility = marker.miniMapVisibility;
  const normalizeVisibility = (value: unknown): QuestMarkerDefinition['miniMapVisibility'] => {
    return value === 'always'
      || value === 'nearby'
      || value === 'selectedQuestOnly'
      || value === 'discoveredOnly'
      || value === 'hidden'
      ? value
      : undefined;
  };
  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    mapId: String(marker.mapId ?? 'worldmap-main').trim() || 'worldmap-main',
    x: isFiniteNumber(marker.x) ? Math.max(0, Math.min(1, marker.x)) : 0.5,
    y: isFiniteNumber(marker.y) ? Math.max(0, Math.min(1, marker.y)) : 0.5,
    type,
    linkedQuestId: marker.linkedQuestId || marker.questId ? String(marker.linkedQuestId ?? marker.questId).trim() : undefined,
    linkedStepId: marker.linkedStepId || marker.stepId ? String(marker.linkedStepId ?? marker.stepId).trim() : undefined,
    linkedObjectiveId: marker.linkedObjectiveId || marker.objectiveId ? String(marker.linkedObjectiveId ?? marker.objectiveId).trim() : undefined,
    linkedNpcId: marker.linkedNpcId || marker.npcId ? String(marker.linkedNpcId ?? marker.npcId).trim() : undefined,
    icon: marker.icon ? String(marker.icon).trim() : undefined,
    visibleToPlayer: marker.visibleToPlayer !== false,
    conditionIds: Array.isArray(marker.conditionIds)
      ? marker.conditionIds.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    imageUrl: marker.imageUrl ? String(marker.imageUrl).trim() : undefined,
    isActive: marker.isActive === false ? false : undefined,
    requirements: Array.isArray(marker.requirements) ? marker.requirements as QuestMarkerDefinition['requirements'] : undefined,
    hideAfterQuestCompleted: marker.hideAfterQuestCompleted === true ? true : undefined,
    hideAfterObjectiveCompleted: marker.hideAfterObjectiveCompleted === true ? true : undefined,
    hideAfterStepCompleted: marker.hideAfterStepCompleted === true ? true : undefined,
    showOnWorldMap: marker.showOnWorldMap === false ? false : true,
    showOnMiniMap: marker.showOnMiniMap === false ? false : true,
    worldMapVisibility: normalizeVisibility(worldMapVisibility),
    miniMapVisibility: normalizeVisibility(miniMapVisibility),
  };
}

function serializeQuestMarker(marker: QuestMarkerDefinition): QuestMarkerExportJson {
  const output: QuestMarkerExportJson = {
    id: marker.id,
    title: marker.title,
    questId: marker.linkedQuestId,
    objectiveId: marker.linkedObjectiveId,
    stepId: marker.linkedStepId,
    markerType: marker.type,
    x: marker.x,
    y: marker.y,
  };

  if (marker.mapId && marker.mapId !== 'worldmap-main') {
    output.mapId = marker.mapId;
  }
  if (marker.linkedNpcId) {
    output.npcId = marker.linkedNpcId;
  }
  if (marker.icon) {
    output.icon = marker.icon;
  }
  if (marker.visibleToPlayer === false) {
    output.visibleToPlayer = false;
  }
  if (marker.conditionIds.length > 0) {
    output.conditionIds = marker.conditionIds;
  }
  if (marker.imageUrl) {
    output.imageUrl = marker.imageUrl;
  }

  if (marker.isActive === false) {
    output.isActive = false;
  }
  if (marker.requirements && marker.requirements.length > 0) {
    output.requirements = marker.requirements;
  }
  if (marker.hideAfterQuestCompleted) {
    output.hideAfterQuestCompleted = true;
  }
  if (marker.hideAfterObjectiveCompleted) {
    output.hideAfterObjectiveCompleted = true;
  }
  if (marker.hideAfterStepCompleted) {
    output.hideAfterStepCompleted = true;
  }
  if (marker.showOnWorldMap === false) {
    output.showOnWorldMap = false;
  }
  if (marker.showOnMiniMap === false) {
    output.showOnMiniMap = false;
  }
  if (marker.worldMapVisibility && marker.worldMapVisibility !== 'always') {
    output.worldMapVisibility = marker.worldMapVisibility;
  }
  if (marker.miniMapVisibility && marker.miniMapVisibility !== 'always') {
    output.miniMapVisibility = marker.miniMapVisibility;
  }

  return output;
}

function normalizeAudioCue(value: unknown): WorldMapZone['music'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const assetId = typeof input.assetId === 'string' ? input.assetId.trim() : '';
  const url = typeof input.url === 'string' ? input.url.trim() : '';
  const assetIds = Array.isArray(input.assetIds)
    ? input.assetIds
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
    : typeof input.assetIds === 'string'
      ? input.assetIds
        .split(/\r?\n|,|;/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const urls = Array.isArray(input.urls)
    ? input.urls
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean)
    : typeof input.urls === 'string'
      ? input.urls
        .split(/\r?\n|,|;/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  if (!assetId && !url && assetIds.length === 0 && urls.length === 0) {
    return undefined;
  }
  return {
    assetId: assetId || undefined,
    assetIds: assetIds.length > 0 ? assetIds : undefined,
    url: url || undefined,
    urls: urls.length > 0 ? urls : undefined,
    volume: isFiniteNumber(input.volume) ? Math.max(0, Math.min(1, input.volume)) : undefined,
    loop: typeof input.loop === 'boolean' ? input.loop : undefined,
    fadeInMs: isFiniteNumber(input.fadeInMs) ? Math.max(0, Math.round(input.fadeInMs)) : undefined,
    fadeOutMs: isFiniteNumber(input.fadeOutMs) ? Math.max(0, Math.round(input.fadeOutMs)) : undefined,
  };
}

function normalizeLocationSprite(value: unknown): LocationSpriteConfig | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
  const assetKey = typeof input.assetKey === 'string' ? input.assetKey.trim() : '';
  if (!imageUrl && !assetKey) {
    return undefined;
  }

  return {
    imageUrl,
    assetKey: assetKey || undefined,
    visibleOnWorldMap: input.visibleOnWorldMap === true,
    visibleInLocationView: input.visibleInLocationView !== false,
    anchor: input.anchor === 'center' ? 'center' : 'bottom',
    offsetX: isFiniteNumber(input.offsetX) ? input.offsetX : 0,
    offsetY: isFiniteNumber(input.offsetY) ? input.offsetY : 0,
    scale: isFiniteNumber(input.scale) && input.scale > 0 ? input.scale : 1,
    zIndex: isFiniteNumber(input.zIndex) ? input.zIndex : 10,
  };
}

function normalizeStateSprites(value: unknown): LocationStateSprites | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  const output: LocationStateSprites = {};
  for (const key of ['active', 'hidden', 'destroyed', 'restored', 'captured', 'locked'] as const) {
    if (typeof input[key] === 'string' && input[key].trim()) {
      output[key] = input[key].trim();
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
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
    requiredQuestItemId: zone.requiredQuestItemId ? String(zone.requiredQuestItemId) : undefined,
    requiredFaction: zone.requiredFaction ? String(zone.requiredFaction) : undefined,
    blockedEntryDialogueId: zone.blockedEntryDialogueId ? String(zone.blockedEntryDialogueId) : undefined,
    blockedEntryNpcId: zone.blockedEntryNpcId ? String(zone.blockedEntryNpcId) : undefined,
    blockedEntryMessage: zone.blockedEntryMessage ? String(zone.blockedEntryMessage) : undefined,
    targetScene: zone.targetScene ? String(zone.targetScene) : undefined,
    isDiscovered: zone.isDiscovered !== false,
    isVisibleToPlayer: zone.isVisibleToPlayer !== false,
    isSafeZone: zone.isSafeZone === true,
    allowPvP: zone.allowPvP === true,
    enemyTableId: zone.enemyTableId ? String(zone.enemyTableId) : undefined,
    resourceTableId: zone.resourceTableId ? String(zone.resourceTableId) : undefined,
    resourceKind:
      zone.resourceKind === 'mine'
      || zone.resourceKind === 'grove'
      || zone.resourceKind === 'herb_patch'
      || zone.resourceKind === 'fishing_spot'
      || zone.resourceKind === 'hunting_ground'
      || zone.resourceKind === 'other'
        ? zone.resourceKind
        : undefined,
    mineId: zone.mineId ? String(zone.mineId) : undefined,
    professionId: zone.professionId ? String(zone.professionId) : undefined,
    respawnSeconds: isFiniteNumber(zone.respawnSeconds) ? zone.respawnSeconds : undefined,
    cooldownSeconds: isFiniteNumber(zone.cooldownSeconds) ? zone.cooldownSeconds : undefined,
    editorLayer:
      zone.editorLayer === 'areas'
      || zone.editorLayer === 'locations'
      || zone.editorLayer === 'quests'
      || zone.editorLayer === 'resources'
      || zone.editorLayer === 'zones'
        ? zone.editorLayer
        : undefined,
    interactionMode:
      zone.interactionMode === 'none'
      || zone.interactionMode === 'inspect'
      || zone.interactionMode === 'enter'
      || zone.interactionMode === 'quest'
      || zone.interactionMode === 'resource'
      || zone.interactionMode === 'battle'
      || zone.interactionMode === 'random_event'
      || zone.interactionMode === 'danger'
      || zone.interactionMode === 'transition'
      || zone.interactionMode === 'fast_travel'
      || zone.interactionMode === 'rest'
      || zone.interactionMode === 'locked'
        ? zone.interactionMode
        : undefined,
    playerClickable: typeof zone.playerClickable === 'boolean' ? zone.playerClickable : undefined,
    blocksClick: typeof zone.blocksClick === 'boolean' ? zone.blocksClick : undefined,
    passiveEffects:
      typeof zone.passiveEffects === 'boolean'
        ? zone.passiveEffects
        : Array.isArray(zone.passiveEffects)
          ? zone.passiveEffects.filter((entry): entry is string => typeof entry === 'string')
          : undefined,
    color:
      typeof zone.color === 'string' ? zone.color
        : typeof zone.previewColor === 'string' ? zone.previewColor
          : typeof zone.colorPreview === 'string' ? zone.colorPreview
            : typeof zone.fillColor === 'string' ? zone.fillColor
              : undefined,
    layerPriority: isFiniteNumber(zone.layerPriority) ? zone.layerPriority : undefined,
    randomQuestPoolIds: Array.isArray(zone.randomQuestPoolIds)
      ? zone.randomQuestPoolIds.filter((entry): entry is string => typeof entry === 'string')
      : undefined,
    chancePercent: isFiniteNumber(zone.chancePercent) ? zone.chancePercent : undefined,
    biome: typeof zone.biome === 'string' ? zone.biome : undefined,
    kingdomId: typeof zone.kingdomId === 'string' ? zone.kingdomId : undefined,
    cityId: typeof zone.cityId === 'string' ? zone.cityId : undefined,
    linkedLocationId:
      typeof zone.linkedLocationId === 'string'
        ? zone.linkedLocationId
        : typeof zone.linkedLocation === 'string'
          ? zone.linkedLocation
          : undefined,
    subtype: typeof zone.subtype === 'string' ? zone.subtype : undefined,
    currentState: typeof zone.currentState === 'string' ? zone.currentState : undefined,
    hidden: zone.hidden === true,
    requiresDiscovery: zone.requiresDiscovery === true,
    locationSprite: normalizeLocationSprite(zone.locationSprite),
    stateSprites: normalizeStateSprites(zone.stateSprites),
    music: normalizeAudioCue(zone.music),
    ambientSound: normalizeAudioCue(zone.ambientSound),
    createdAt: isFiniteNumber(zone.createdAt) ? zone.createdAt : Date.now(),
    updatedAt: isFiniteNumber(zone.updatedAt) ? zone.updatedAt : Date.now(),
  };

  if (!normalized.id || !normalized.name) {
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
    return { valid: false, errors: ['Invalid JSON syntax'], zones: [], regions: [], questMarkers: [] };
  }

  const rawZones = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).zones)
      ? (parsed as Record<string, unknown>).zones as unknown[]
      : null;
  const rawRegions = parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).regions)
    ? (parsed as Record<string, unknown>).regions as unknown[]
    : [];
  const rawQuestMarkers = parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).questMarkers)
    ? (parsed as Record<string, unknown>).questMarkers as unknown[]
    : [];

  if (!rawZones) {
    return { valid: false, errors: ['JSON must be an array of zones or an object { zones, regions, questMarkers }'], zones: [], regions: [], questMarkers: [] };
  }

  const zones: WorldMapZone[] = [];
  const regions: PaintedRegion[] = [];
  const questMarkers: QuestMarkerDefinition[] = [];
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

  const seenQuestMarkerIds = new Set<string>();
  rawQuestMarkers.forEach((entry, index) => {
    const marker = normalizeQuestMarker(entry);
    if (!marker) {
      errors.push(`Quest marker entry ${index + 1} is invalid`);
      return;
    }
    if (seenQuestMarkerIds.has(marker.id)) {
      errors.push(`Duplicate quest marker id: ${marker.id}`);
      return;
    }
    seenQuestMarkerIds.add(marker.id);
    questMarkers.push(marker);
  });

  return {
    valid: errors.length === 0,
    errors,
    zones,
    regions,
    questMarkers,
  };
}

export function exportZonesJson(zones: WorldMapZone[]): string {
  return JSON.stringify(zones, null, 2);
}

export function exportEditorDataJson(zones: WorldMapZone[], regions: PaintedRegion[], questMarkers: QuestMarkerDefinition[] = []): string {
  return JSON.stringify({ zones, regions, questMarkers: questMarkers.map(serializeQuestMarker) }, null, 2);
}

export function loadEditorDataFromStorage(initialZones: WorldMapZone[]): EditorDataPayload {
  const normalizedInitial = initialZones.map((zone) => normalizeWorldMapZone(zone));
  return editorDataDraft ?? {
    zones: normalizedInitial,
    regions: [],
    questMarkers: [],
  };
}

export function saveEditorDataToStorage(zones: WorldMapZone[], regions: PaintedRegion[], questMarkers: QuestMarkerDefinition[] = []): void {
  editorDataDraft = { zones, regions, questMarkers };
}

export function loadZonesFromStorage(initialZones: WorldMapZone[]): WorldMapZone[] {
  return loadEditorDataFromStorage(initialZones).zones;
}

export function saveZonesToStorage(zones: WorldMapZone[]): void {
  saveEditorDataToStorage(zones, [], []);
}

export function clearZoneStorage(): void {
  editorDataDraft = null;
}

export async function loadEditorDataFromBackend(initialZones: WorldMapZone[]): Promise<EditorDataPayload> {
  const remote = await getWorldMapContent();
  const remoteQuestMarkers = Array.isArray(remote.questMarkers)
    ? remote.questMarkers.map((entry) => normalizeQuestMarker(entry)).filter((marker): marker is QuestMarkerDefinition => Boolean(marker))
    : [];
  if ((!remote.zones || remote.zones.length === 0) && (!remote.regions || remote.regions.length === 0) && remoteQuestMarkers.length === 0) {
    return {
      zones: initialZones.map((zone) => normalizeWorldMapZone(zone)),
      regions: [],
      questMarkers: [],
    };
  }

  return {
    zones: (remote.zones.length > 0 ? remote.zones : initialZones).map((zone) => normalizeWorldMapZone(zone)),
    regions: remote.regions ?? [],
    questMarkers: remoteQuestMarkers,
  };
}

export async function saveEditorDataToBackend(zones: WorldMapZone[], regions: PaintedRegion[], questMarkers: QuestMarkerDefinition[] = []): Promise<void> {
  await saveWorldMapContent({ zones, regions, questMarkers: questMarkers.map(serializeQuestMarker) });
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

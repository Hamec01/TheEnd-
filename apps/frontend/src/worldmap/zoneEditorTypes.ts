export type ZoneShape = 'circle' | 'polygon' | 'rect';

export type ZoneType =
  | 'city'
  | 'settlement'
  | 'location'
  | 'quest'
  | 'quest_area'
  | 'random_event_area'
  | 'danger_area'
  | 'faction_area'
  | 'kingdom_area'
  | 'city_area'
  | 'resource_area'
  | 'hidden_area'
  | 'story'
  | 'landmark'
  | 'danger'
  | 'grind'
  | 'resource'
  | 'profession'
  | 'dungeon'
  | 'transition'
  | 'safe'
  | 'event'
  | 'faction'
  | 'locked'
  | 'fast_travel'
  | 'rest';

export type ZoneEditorTool = 'select' | 'circle' | 'polygon' | 'rectangle' | 'pan' | 'measure';

export type RegionType = 'walkable' | 'blocked' | 'water' | 'swamp' | 'sand' | 'road' | 'danger' | 'trigger';

export type RegionToolMode = 'circle' | 'pencil' | 'eraser';

export type RegionBrushSize = 1 | 2 | 3 | 5;

export interface RegionCell {
  x: number;
  y: number;
}

export interface PaintedRegion {
  id: string;
  name: string;
  type: RegionType;
  cells: RegionCell[];
}

export interface PaintedRegionCell {
  x: number;
  y: number;
  regionId: string;
  regionType: RegionType;
}

export interface WorldMapZone {
  id: string;
  name: string;
  type: ZoneType;
  shape: ZoneShape;
  x?: number;
  y?: number;
  radius?: number;
  points?: [number, number][];
  region?: string;
  faction?: string;
  description: string;
  tooltip?: string;
  dangerLevel: number;
  recommendedLevel?: number;
  requiredLevel?: number;
  requiredQuestId?: string;
  requiredItemId?: string;
  requiredFaction?: string;
  targetScene?: string;
  isDiscovered: boolean;
  isVisibleToPlayer: boolean;
  isSafeZone?: boolean;
  allowPvP?: boolean;
  enemyTableId?: string;
  resourceTableId?: string;
  professionId?: string;
  respawnSeconds?: number;
  cooldownSeconds?: number;
  editorLayer?: 'areas' | 'locations' | 'quests' | 'resources' | 'zones' | 'passability';
  interactionMode?: 'none' | 'inspect' | 'enter' | 'quest' | 'resource' | 'battle' | 'random_event' | 'danger' | 'transition' | 'fast_travel' | 'rest' | 'locked';
  playerClickable?: boolean;
  blocksClick?: boolean;
  passiveEffects?: boolean | string[];
  color?: string;
  parentAreaId?: string;
  layerPriority?: number;
  randomQuestPoolIds?: string[];
  chancePercent?: number;
  biome?: string;
  kingdomId?: string;
  cityId?: string;
  linkedLocationId?: string;
  linkedLocation?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ZoneEditorDraft {
  id: string;
  name: string;
  type: ZoneType;
  shape: ZoneShape;
  x: number | null;
  y: number | null;
  radius: number | null;
  points: [number, number][];
  region: string;
  faction: string;
  description: string;
  tooltip: string;
  dangerLevel: number;
  recommendedLevel: number | null;
  requiredLevel: number | null;
  requiredQuestId: string;
  requiredItemId: string;
  requiredFaction: string;
  targetScene: string;
  isDiscovered: boolean;
  isVisibleToPlayer: boolean;
  isSafeZone: boolean;
  allowPvP: boolean;
  enemyTableId: string;
  resourceTableId: string;
  professionId: string;
  respawnSeconds: number | null;
  cooldownSeconds: number | null;
  editorLayer?: 'areas' | 'locations' | 'quests' | 'resources' | 'zones' | 'passability';
  interactionMode?: 'none' | 'inspect' | 'enter' | 'quest' | 'resource' | 'battle' | 'random_event' | 'danger' | 'transition' | 'fast_travel' | 'rest' | 'locked';
  playerClickable?: boolean;
  blocksClick?: boolean;
  passiveEffects?: boolean | string[];
  color?: string;
  parentAreaId?: string;
  layerPriority: number;
  randomQuestPoolIds: string;
  chancePercent: number | null;
  biome: string;
  kingdomId: string;
  cityId: string;
  linkedLocationId: string;
  createdAt: number;
  updatedAt: number;
  selectedPointIndex: number | null;
}

export interface ZoneEditorSettings {
  showZones: boolean;
  showLabels: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  selectedTool: ZoneEditorTool;
  zoom: number;
  panX: number;
  panY: number;
}

export interface ZoneEditorSnapshot {
  zones: WorldMapZone[];
  regions: PaintedRegion[];
  draft: ZoneEditorDraft | null;
  selectedZoneId: string | null;
}

export interface ZoneValidationResult {
  valid: boolean;
  errors: string[];
  zones: WorldMapZone[];
}

export interface EditorMouseStatus {
  x: number | null;
  y: number | null;
}

export function createEmptyZoneDraft(tool: ZoneEditorTool = 'circle'): ZoneEditorDraft {
  const now = Date.now();
  const shape = tool === 'rectangle' ? 'rect' : tool === 'polygon' ? 'polygon' : 'circle';

  return {
    id: '',
    name: '',
    type: 'city',
    shape,
    x: null,
    y: null,
    radius: shape === 'circle' ? 0.03 : null,
    points: [],
    region: '',
    faction: '',
    description: '',
    tooltip: '',
    dangerLevel: 1,
    recommendedLevel: null,
    requiredLevel: null,
    requiredQuestId: '',
    requiredItemId: '',
    requiredFaction: '',
    targetScene: '',
    isDiscovered: true,
    isVisibleToPlayer: true,
    isSafeZone: false,
    allowPvP: false,
    enemyTableId: '',
    resourceTableId: '',
    professionId: '',
    respawnSeconds: null,
    cooldownSeconds: null,
    editorLayer: 'locations',
    interactionMode: 'enter',
    playerClickable: true,
    blocksClick: true,
    passiveEffects: false,
    color: undefined,
    parentAreaId: '',
    layerPriority: 0,
    randomQuestPoolIds: '',
    chancePercent: null,
    biome: '',
    kingdomId: '',
    cityId: '',
    linkedLocationId: '',
    createdAt: now,
    updatedAt: now,
    selectedPointIndex: null,
  };
}

export function createDraftFromZone(zone: WorldMapZone): ZoneEditorDraft {
  return {
    id: zone.id,
    name: zone.name,
    type: zone.type,
    shape: zone.shape,
    x: zone.x ?? null,
    y: zone.y ?? null,
    radius: zone.radius ?? null,
    points: zone.points ? [...zone.points] : [],
    region: zone.region ?? '',
    faction: zone.faction ?? '',
    description: zone.description,
    tooltip: zone.tooltip ?? '',
    dangerLevel: zone.dangerLevel,
    recommendedLevel: zone.recommendedLevel ?? null,
    requiredLevel: zone.requiredLevel ?? null,
    requiredQuestId: zone.requiredQuestId ?? '',
    requiredItemId: zone.requiredItemId ?? '',
    requiredFaction: zone.requiredFaction ?? '',
    targetScene: zone.targetScene ?? '',
    isDiscovered: zone.isDiscovered,
    isVisibleToPlayer: zone.isVisibleToPlayer,
    isSafeZone: zone.isSafeZone ?? false,
    allowPvP: zone.allowPvP ?? false,
    enemyTableId: zone.enemyTableId ?? '',
    resourceTableId: zone.resourceTableId ?? '',
    professionId: zone.professionId ?? '',
    respawnSeconds: zone.respawnSeconds ?? null,
    cooldownSeconds: zone.cooldownSeconds ?? null,
    editorLayer: zone.editorLayer,
    interactionMode: zone.interactionMode,
    playerClickable: zone.playerClickable,
    blocksClick: zone.blocksClick,
    passiveEffects: Array.isArray(zone.passiveEffects)
      ? [...zone.passiveEffects]
      : typeof zone.passiveEffects === 'boolean'
        ? zone.passiveEffects
        : false,
    color: zone.color,
    parentAreaId: zone.parentAreaId ?? '',
    layerPriority: zone.layerPriority ?? 0,
    randomQuestPoolIds: (zone.randomQuestPoolIds ?? []).join(', '),
    chancePercent: zone.chancePercent ?? null,
    biome: zone.biome ?? '',
    kingdomId: zone.kingdomId ?? '',
    cityId: zone.cityId ?? '',
    linkedLocationId: zone.linkedLocationId ?? zone.linkedLocation ?? '',
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
    selectedPointIndex: null,
  };
}

export function createZoneFromDraft(draft: ZoneEditorDraft, existingCreatedAt?: number): WorldMapZone {
  const now = Date.now();
  const isKingdomArea = draft.type === 'kingdom_area';
  const resolvedEditorLayer = isKingdomArea ? 'areas' : draft.editorLayer;
  const resolvedInteractionMode = isKingdomArea ? 'none' : draft.interactionMode;
  const resolvedPlayerClickable = isKingdomArea
    ? false
    : typeof draft.playerClickable === 'boolean'
      ? draft.playerClickable
      : undefined;
  const resolvedBlocksClick = isKingdomArea
    ? false
    : typeof draft.blocksClick === 'boolean'
      ? draft.blocksClick
      : undefined;
  const resolvedPassiveEffects = isKingdomArea
    ? true
    : typeof draft.passiveEffects === 'boolean'
      ? draft.passiveEffects
      : Array.isArray(draft.passiveEffects)
        ? draft.passiveEffects
        : undefined;

  const base = {
    id: draft.id.trim(),
    name: draft.name.trim(),
    type: draft.type,
    shape: draft.shape,
    region: draft.region.trim() || undefined,
    faction: draft.faction.trim() || undefined,
    description: draft.description.trim(),
    tooltip: draft.tooltip.trim() || undefined,
    dangerLevel: draft.dangerLevel,
    recommendedLevel: draft.recommendedLevel ?? undefined,
    requiredLevel: draft.requiredLevel ?? undefined,
    requiredQuestId: draft.requiredQuestId.trim() || undefined,
    requiredItemId: draft.requiredItemId.trim() || undefined,
    requiredFaction: draft.requiredFaction.trim() || undefined,
    targetScene: draft.targetScene.trim() || undefined,
    isDiscovered: draft.isDiscovered,
    isVisibleToPlayer: draft.isVisibleToPlayer,
    isSafeZone: draft.isSafeZone || undefined,
    allowPvP: draft.allowPvP || undefined,
    enemyTableId: draft.enemyTableId.trim() || undefined,
    resourceTableId: draft.resourceTableId.trim() || undefined,
    professionId: draft.professionId.trim() || undefined,
    respawnSeconds: draft.respawnSeconds ?? undefined,
    cooldownSeconds: draft.cooldownSeconds ?? undefined,
    editorLayer: resolvedEditorLayer,
    interactionMode: resolvedInteractionMode,
    playerClickable: resolvedPlayerClickable,
    blocksClick: resolvedBlocksClick,
    passiveEffects: resolvedPassiveEffects,
    color: draft.color?.trim() || undefined,
    parentAreaId: draft.parentAreaId?.trim() || undefined,
    layerPriority: draft.layerPriority || undefined,
    randomQuestPoolIds: draft.randomQuestPoolIds
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    chancePercent: draft.chancePercent ?? undefined,
    biome: draft.biome.trim() || undefined,
    kingdomId: draft.kingdomId.trim() || undefined,
    cityId: draft.cityId.trim() || undefined,
    linkedLocationId: draft.linkedLocationId.trim() || undefined,
    createdAt: existingCreatedAt ?? draft.createdAt ?? now,
    updatedAt: now,
  };

  if (draft.shape === 'circle') {
    return {
      ...base,
      x: draft.x ?? undefined,
      y: draft.y ?? undefined,
      radius: draft.radius ?? undefined,
    };
  }

  return {
    ...base,
    points: draft.points.map((point) => [point[0], point[1]] as [number, number]),
  };
}

export function createDefaultEditorSettings(): ZoneEditorSettings {
  return {
    showZones: true,
    showLabels: true,
    showGrid: false,
    snapEnabled: false,
    selectedTool: 'select',
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

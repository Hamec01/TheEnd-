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

export type RegionToolMode = 'circle' | 'pencil' | 'brush' | 'eraser';

export type RegionBrushSize = 0.05 | 0.25 | 0.5 | 0.75 | 1 | 2 | 3 | 5 | 8 | 12;
export type LocationSpriteAnchor = 'center' | 'bottom';
export type LocationStateSpriteKey = 'active' | 'hidden' | 'destroyed' | 'restored' | 'captured' | 'locked';

export interface LocationSpriteConfig {
  imageUrl: string;
  assetKey?: string;
  visibleOnWorldMap: boolean;
  visibleInLocationView: boolean;
  anchor: LocationSpriteAnchor;
  offsetX: number;
  offsetY: number;
  scale: number;
  zIndex: number;
}

export type LocationStateSprites = Partial<Record<LocationStateSpriteKey, string>>;

export type ResourceKind =
  | 'mine'
  | 'grove'
  | 'herb_patch'
  | 'fishing_spot'
  | 'hunting_ground'
  | 'other';

export interface RegionCell {
  x: number;
  y: number;
}

export interface PaintedRegion {
  id: string;
  name: string;
  type: RegionType;
  color?: string;
  gridSize?: number;
  cells: RegionCell[];
}

export interface PaintedRegionCell {
  x: number;
  y: number;
  regionId: string;
  regionType: RegionType;
}

export interface WorldAudioCue {
  assetId?: string;
  assetIds?: string[];
  url?: string;
  urls?: string[];
  volume?: number;
  loop?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
}

function parseListField(value: string | undefined | null): string[] {
  return String(value ?? '')
    .split(/\r?\n|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinListField(values: string[] | undefined): string {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }
  return values.map((entry) => String(entry ?? '').trim()).filter(Boolean).join('\n');
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
  resourceKind?: ResourceKind;
  mineId?: string;
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
  subtype?: string;
  currentState?: LocationStateSpriteKey | string;
  hidden?: boolean;
  requiresDiscovery?: boolean;
  locationSprite?: LocationSpriteConfig;
  stateSprites?: LocationStateSprites;
  music?: WorldAudioCue;
  ambientSound?: WorldAudioCue;
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
  resourceKind: ResourceKind | '';
  mineId: string;
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
  subtype: string;
  currentState: string;
  hidden: boolean;
  requiresDiscovery: boolean;
  locationSprite: LocationSpriteConfig;
  stateSprites: Record<LocationStateSpriteKey, string>;
  musicAssetId: string;
  musicUrl: string;
  musicAssetIds: string;
  musicUrls: string;
  ambientSoundAssetId: string;
  ambientSoundUrl: string;
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
    resourceKind: '',
    mineId: '',
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
    subtype: '',
    currentState: 'active',
    hidden: false,
    requiresDiscovery: false,
    locationSprite: {
      imageUrl: '',
      assetKey: '',
      visibleOnWorldMap: false,
      visibleInLocationView: true,
      anchor: 'bottom',
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      zIndex: 10,
    },
    stateSprites: {
      active: '',
      hidden: '',
      destroyed: '',
      restored: '',
      captured: '',
      locked: '',
    },
    musicAssetId: '',
    musicUrl: '',
    musicAssetIds: '',
    musicUrls: '',
    ambientSoundAssetId: '',
    ambientSoundUrl: '',
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
    resourceKind: zone.resourceKind ?? '',
    mineId: zone.mineId ?? '',
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
    subtype: zone.subtype ?? '',
    currentState: zone.currentState ?? 'active',
    hidden: zone.hidden === true,
    requiresDiscovery: zone.requiresDiscovery === true,
    locationSprite: {
      imageUrl: zone.locationSprite?.imageUrl ?? '',
      assetKey: zone.locationSprite?.assetKey ?? '',
      visibleOnWorldMap: zone.locationSprite?.visibleOnWorldMap === true,
      visibleInLocationView: zone.locationSprite?.visibleInLocationView !== false,
      anchor: zone.locationSprite?.anchor === 'center' ? 'center' : 'bottom',
      offsetX: Number.isFinite(zone.locationSprite?.offsetX) ? zone.locationSprite!.offsetX : 0,
      offsetY: Number.isFinite(zone.locationSprite?.offsetY) ? zone.locationSprite!.offsetY : 0,
      scale: Number.isFinite(zone.locationSprite?.scale) && zone.locationSprite!.scale > 0 ? zone.locationSprite!.scale : 1,
      zIndex: Number.isFinite(zone.locationSprite?.zIndex) ? zone.locationSprite!.zIndex : 10,
    },
    stateSprites: {
      active: zone.stateSprites?.active ?? '',
      hidden: zone.stateSprites?.hidden ?? '',
      destroyed: zone.stateSprites?.destroyed ?? '',
      restored: zone.stateSprites?.restored ?? '',
      captured: zone.stateSprites?.captured ?? '',
      locked: zone.stateSprites?.locked ?? '',
    },
    musicAssetId: zone.music?.assetId ?? '',
    musicUrl: zone.music?.url ?? '',
    musicAssetIds: joinListField(zone.music?.assetIds),
    musicUrls: joinListField(zone.music?.urls),
    ambientSoundAssetId: zone.ambientSound?.assetId ?? '',
    ambientSoundUrl: zone.ambientSound?.url ?? '',
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
    selectedPointIndex: null,
  };
}

export function createZoneFromDraft(draft: ZoneEditorDraft, existingCreatedAt?: number): WorldMapZone {
  const now = Date.now();
  const musicAssetIds = parseListField(draft.musicAssetIds);
  const musicUrls = parseListField(draft.musicUrls);
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

  const locationSprite = draft.locationSprite.imageUrl.trim() || draft.locationSprite.assetKey?.trim()
    ? {
      imageUrl: draft.locationSprite.imageUrl.trim(),
      assetKey: draft.locationSprite.assetKey?.trim() || undefined,
      visibleOnWorldMap: draft.locationSprite.visibleOnWorldMap === true,
      visibleInLocationView: draft.locationSprite.visibleInLocationView !== false,
      anchor: (draft.locationSprite.anchor === 'center' ? 'center' : 'bottom') as LocationSpriteAnchor,
      offsetX: Number.isFinite(draft.locationSprite.offsetX) ? draft.locationSprite.offsetX : 0,
      offsetY: Number.isFinite(draft.locationSprite.offsetY) ? draft.locationSprite.offsetY : 0,
      scale: Number.isFinite(draft.locationSprite.scale) && draft.locationSprite.scale > 0 ? draft.locationSprite.scale : 1,
      zIndex: Number.isFinite(draft.locationSprite.zIndex) ? draft.locationSprite.zIndex : 10,
    }
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
    resourceKind: draft.resourceKind || undefined,
    mineId: draft.mineId.trim() || undefined,
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
    subtype: draft.subtype.trim() || undefined,
    currentState: draft.currentState.trim() || undefined,
    hidden: draft.hidden || undefined,
    requiresDiscovery: draft.requiresDiscovery || undefined,
    locationSprite,
    stateSprites: Object.fromEntries(
      Object.entries(draft.stateSprites).filter(([, value]) => value.trim().length > 0),
    ) as LocationStateSprites,
    music: draft.musicAssetId.trim() || draft.musicUrl.trim() || draft.musicAssetIds.trim() || draft.musicUrls.trim()
      ? {
        assetId: draft.musicAssetId.trim() || undefined,
        assetIds: musicAssetIds.length > 0 ? musicAssetIds : undefined,
        url: draft.musicUrl.trim() || undefined,
        urls: musicUrls.length > 0 ? musicUrls : undefined,
        loop: true,
      }
      : undefined,
    ambientSound: draft.ambientSoundAssetId.trim() || draft.ambientSoundUrl.trim()
      ? {
        assetId: draft.ambientSoundAssetId.trim() || undefined,
        url: draft.ambientSoundUrl.trim() || undefined,
        loop: true,
      }
      : undefined,
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

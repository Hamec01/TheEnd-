import { ZONE_COLORS } from './zoneColors';
import type { WorldMapZone, ZoneType, ZoneEditorDraft } from './zoneEditorTypes';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MapEditorLayer = 'areas' | 'locations' | 'quests' | 'resources' | 'zones' | 'passability';
export type ZoneInteractionMode = 'none' | 'inspect' | 'enter' | 'quest' | 'resource' | 'battle' | 'random_event' | 'danger' | 'transition' | 'fast_travel' | 'rest' | 'locked';
export type LayerVisibilityMode = 'hidden' | 'dimmed' | 'visible';

export interface LayerVisibilityState {
  areas: LayerVisibilityMode;
  locations: LayerVisibilityMode;
  quests: LayerVisibilityMode;
  resources: LayerVisibilityMode;
  zones: LayerVisibilityMode;
  passability: LayerVisibilityMode;
}

// ============================================================================
// LAYER DEFINITION
// ============================================================================

export const MAP_EDITOR_LAYER_OPTIONS: Array<{
  value: MapEditorLayer;
  label: string;
  description: string;
}> = [
  {
    value: 'areas',
    label: 'Территории',
    description: 'Королевства, регионы, владения, городские области, скрытые области.',
  },
  {
    value: 'locations',
    label: 'Локации',
    description: 'Города, поселения, подземелья, важные места.',
  },
  {
    value: 'quests',
    label: 'Квесты',
    description: 'Квестовые зоны, цели, предметы, триггеры и события.',
  },
  {
    value: 'resources',
    label: 'Ресурсы',
    description: 'Шахты, рощи, травы, места фарма, добыча материалов.',
  },
  {
    value: 'zones',
    label: 'Зоны',
    description: 'Опасность, отдых, быстрые переходы, random events, safe/danger/grind.',
  },
  {
    value: 'passability',
    label: 'Проходимость',
    description: 'Покраска поверхности: непроходимо, вода, болото, песок и обычная земля.',
  },
];

export const ZONE_TYPES_BY_LAYER: Record<MapEditorLayer, ZoneType[]> = {
  areas: ['kingdom_area', 'faction_area', 'city_area', 'danger_area', 'hidden_area', 'safe'],
  locations: ['city', 'settlement', 'location', 'landmark', 'dungeon', 'faction'],
  quests: ['quest', 'quest_area', 'story', 'event'],
  resources: ['resource', 'resource_area', 'profession'],
  zones: ['danger', 'grind', 'random_event_area', 'transition', 'fast_travel', 'rest', 'locked', 'safe'],
  passability: [],
};

// ============================================================================
// COLOR SYSTEM - SEMANTIC COLORS BY LAYER AND TYPE
// ============================================================================

const LAYER_TYPE_COLORS: Record<MapEditorLayer, Partial<Record<ZoneType, string>>> = {
  areas: {
    kingdom_area: '#4db6c6',
    faction_area: '#b883d9',
    city_area: '#d6b35f',
    danger_area: '#d65f45',
    hidden_area: '#7d7d7d',
    safe: '#6fd68a',
  },
  locations: {
    city: '#d6b35f',
    settlement: '#c9a35a',
    location: '#b99652',
    landmark: '#e0c76f',
    dungeon: '#8f6bd9',
    faction: '#b883d9',
  },
  quests: {
    quest: '#f2cf5b',
    quest_area: '#f2cf5b',
    story: '#f2a65b',
    event: '#d9954d',
  },
  resources: {
    resource: '#66b36b',
    resource_area: '#66b36b',
    profession: '#65b8d6',
  },
  zones: {
    danger: '#d65f45',
    grind: '#c77d4d',
    random_event_area: '#d9954d',
    transition: '#ffffff',
    fast_travel: '#65b8d6',
    rest: '#6fd68a',
    safe: '#6fd68a',
    locked: '#7d7d7d',
  },
  passability: {},
};

const LAYER_FALLBACK_COLORS: Record<MapEditorLayer, string> = {
  areas: '#4db6c6',
  locations: '#d6b35f',
  quests: '#f2cf5b',
  resources: '#66b36b',
  zones: '#d65f45',
  passability: '#8cc284',
};

// ============================================================================
// DEFAULT VALUES BY ZONE TYPE
// ============================================================================

export function getDefaultEditorLayer(type: ZoneType): MapEditorLayer {
  for (const [layer, types] of Object.entries(ZONE_TYPES_BY_LAYER)) {
    if (types.includes(type)) {
      return layer as MapEditorLayer;
    }
  }
  return 'zones';
}

export function getZoneTypesForLayer(layer: MapEditorLayer): ZoneType[] {
  return [...(ZONE_TYPES_BY_LAYER[layer] ?? [])];
}

export function getDefaultTypeForLayer(layer: MapEditorLayer): ZoneType {
  const defaults: Record<MapEditorLayer, ZoneType> = {
    areas: 'kingdom_area',
    locations: 'city',
    quests: 'quest_area',
    resources: 'resource_area',
    zones: 'danger',
    passability: 'danger',
  };
  return defaults[layer];
}

export function getDefaultLayerVisibilityState(): LayerVisibilityState {
  return {
    areas: 'visible',
    locations: 'visible',
    quests: 'visible',
    resources: 'visible',
    zones: 'visible',
    passability: 'visible',
  };
}

export function getDefaultInteractionMode(type: ZoneType): ZoneInteractionMode {
  if (type === 'city' || type === 'settlement' || type === 'location' || type === 'dungeon') {
    return 'enter';
  }
  if (type === 'landmark') {
    return 'inspect';
  }
  if (type === 'quest' || type === 'quest_area' || type === 'story' || type === 'event') {
    return 'quest';
  }
  if (type === 'resource' || type === 'profession') {
    return 'resource';
  }
  if (type === 'danger' || type === 'grind') {
    return 'battle';
  }
  if (type === 'random_event_area') {
    return 'random_event';
  }
  if (type === 'danger_area') {
    return 'danger';
  }
  if (type === 'transition') {
    return 'transition';
  }
  if (type === 'fast_travel') {
    return 'fast_travel';
  }
  if (type === 'rest' || type === 'safe') {
    return 'rest';
  }
  if (type === 'locked') {
    return 'locked';
  }
  return 'none';
}

export function getDefaultPlayerClickable(type: ZoneType): boolean {
  return ['city', 'settlement', 'location', 'landmark', 'dungeon', 'faction', 'quest', 'resource', 'profession'].includes(type);
}

export function getDefaultBlocksClick(type: ZoneType): boolean {
  return ['city', 'settlement', 'location', 'dungeon', 'danger_area', 'locked', 'hidden_area'].includes(type);
}

export function getDefaultPassiveEffects(type: ZoneType): boolean | string[] {
  if (type === 'city' || type === 'settlement' || type === 'location' || type === 'dungeon' || type === 'landmark') {
    return false;
  }
  if (type === 'kingdom_area') {
    return true;
  }
  if (type === 'city_area') {
    return true;
  }
  if (type === 'danger' || type === 'grind') {
    return ['cursed'];
  }
  return [];
}

export function getDefaultZoneColor(type: ZoneType, editorLayer?: MapEditorLayer): string {
  const layer = editorLayer ?? getDefaultEditorLayer(type);
  const layerColors = LAYER_TYPE_COLORS[layer];

  if (layerColors && layerColors[type]) {
    return layerColors[type]!;
  }

  const fromLegacyTypeMap = ZONE_COLORS[type];
  if (fromLegacyTypeMap) {
    return fromLegacyTypeMap;
  }

  return LAYER_FALLBACK_COLORS[layer];
}

// ============================================================================
// COLOR RESOLUTION
// ============================================================================

export function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  if (!isValidHexColor(trimmed)) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.length === 4) {
    const r = lower[1];
    const g = lower[2];
    const b = lower[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return lower;
}

export function isDefaultZoneColor(value: string | null | undefined, type: ZoneType, layer?: MapEditorLayer): boolean {
  if (!value) {
    return false;
  }

  const normalized = normalizeHexColor(value);
  const expected = normalizeHexColor(getDefaultZoneColor(type, layer));
  if (!normalized || !expected) {
    return false;
  }

  return normalized === expected;
}

export function getResolvedZoneColor(zone: WorldMapZone | ZoneEditorDraft): string {
  const color = (zone as { color?: unknown }).color;
  if (typeof color === 'string' && color.trim().length > 0) {
    const normalized = normalizeHexColor(color);
    return normalized ?? color.trim();
  }
  const layer = (zone as { editorLayer?: MapEditorLayer }).editorLayer ?? getDefaultEditorLayer(zone.type);
  return getDefaultZoneColor(zone.type, layer);
}

// ============================================================================
// NORMALIZATION
// ============================================================================

export function normalizeWorldMapZone(zone: WorldMapZone): WorldMapZone {
  const raw = zone as unknown as Record<string, unknown>;
  const isCity = zone.type === 'city';
  const isCityArea = zone.type === 'city_area';

  const rawEditorLayer =
    raw.editorLayer === 'areas'
    || raw.editorLayer === 'locations'
    || raw.editorLayer === 'quests'
    || raw.editorLayer === 'resources'
    || raw.editorLayer === 'zones'
      ? raw.editorLayer
      : undefined;
  const editorLayer = isCity
    ? 'locations'
    : isCityArea
      ? 'areas'
      : (rawEditorLayer ?? getDefaultEditorLayer(zone.type));

  const interactionModeValues: ZoneInteractionMode[] = ['none', 'inspect', 'enter', 'quest', 'resource', 'battle', 'random_event', 'danger', 'transition', 'fast_travel', 'rest', 'locked'];
  const interactionMode = interactionModeValues.includes(raw.interactionMode as ZoneInteractionMode)
    ? raw.interactionMode as ZoneInteractionMode
    : getDefaultInteractionMode(zone.type);

  const playerClickable =
    typeof raw.playerClickable === 'boolean'
      ? raw.playerClickable
      : getDefaultPlayerClickable(zone.type);

  const blocksClick =
    typeof raw.blocksClick === 'boolean'
      ? raw.blocksClick
      : getDefaultBlocksClick(zone.type);

  const passiveEffects =
    typeof raw.passiveEffects === 'boolean'
      ? raw.passiveEffects
      : Array.isArray(raw.passiveEffects)
        ? raw.passiveEffects.filter((entry): entry is string => typeof entry === 'string')
        : getDefaultPassiveEffects(zone.type);

  const legacyColor =
    typeof raw.color === 'string' ? raw.color
      : typeof raw.previewColor === 'string' ? raw.previewColor
        : typeof raw.colorPreview === 'string' ? raw.colorPreview
          : typeof raw.fillColor === 'string' ? raw.fillColor
            : undefined;

  const normalizedLegacyColor = typeof legacyColor === 'string' && legacyColor.trim().length > 0
    ? normalizeHexColor(legacyColor) ?? legacyColor.trim()
    : undefined;

  const color = normalizedLegacyColor ?? getDefaultZoneColor(zone.type, editorLayer);

  const repairedInteractionMode =
    isCity && (raw.interactionMode == null || raw.interactionMode === '')
      ? 'enter'
      : isCityArea && (raw.interactionMode == null || raw.interactionMode === '')
        ? 'none'
        : interactionMode;
  const repairedPlayerClickable =
    isCity && raw.playerClickable == null
      ? true
      : isCityArea && raw.playerClickable == null
        ? false
        : playerClickable;
  const repairedBlocksClick =
    isCity && raw.blocksClick == null
      ? true
      : isCityArea && raw.blocksClick == null
        ? false
        : blocksClick;
  const repairedPassiveEffects =
    isCity && raw.passiveEffects == null
      ? false
      : isCityArea && raw.passiveEffects == null
        ? true
        : passiveEffects;

  return {
    ...zone,
    editorLayer,
    interactionMode: repairedInteractionMode,
    playerClickable: repairedPlayerClickable,
    blocksClick: repairedBlocksClick,
    passiveEffects: repairedPassiveEffects,
    color,
    linkedLocationId:
      typeof raw.linkedLocationId === 'string'
        ? raw.linkedLocationId
        : typeof raw.linkedLocation === 'string'
          ? raw.linkedLocation
          : zone.linkedLocationId,
  };
}

// ============================================================================
// LAYER VISIBILITY
// ============================================================================

export function getEffectiveLayerVisibility(
  layer: MapEditorLayer,
  activeEditorLayer: MapEditorLayer,
  layerVisibility: LayerVisibilityState,
): LayerVisibilityMode {
  if (layer === activeEditorLayer) {
    return 'visible';
  }
  return layerVisibility[layer];
}

// ============================================================================
// FIELD VISIBILITY HELPERS
// ============================================================================

export function shouldShowAreaFields(layer: MapEditorLayer): boolean {
  return layer === 'areas';
}

export function shouldShowLocationFields(layer: MapEditorLayer): boolean {
  return layer === 'locations';
}

export function shouldShowQuestFields(layer: MapEditorLayer): boolean {
  return layer === 'quests';
}

export function shouldShowResourceFields(layer: MapEditorLayer): boolean {
  return layer === 'resources';
}

export function shouldShowZoneFields(layer: MapEditorLayer): boolean {
  return layer === 'zones';
}

export function getHiddenFieldsForLayer(layer: MapEditorLayer): string[] {
  const hidden: string[] = [];
  
  if (layer !== 'areas') {
    hidden.push('kingdomId', 'cityId', 'faction');
  }
  if (layer !== 'locations') {
    hidden.push('settlement');
  }
  if (layer !== 'quests') {
    hidden.push('requiredQuestId');
  }
  if (layer !== 'resources') {
    hidden.push(
      'resourceTableId',
      'resourceKind',
      'mineId',
      'professionId',
      'forestId',
      'biomeId',
      'treePool',
      'woodcuttingTier',
      'requiresProfession',
      'isProfessionZone'
    );
  }
  
  return hidden;
}

export function getPassiveZoneHint(draft: ZoneEditorDraft | null | undefined): string {
  if (!draft) {
    return '';
  }
  const effects = getDefaultPassiveEffects(draft.type);
  if (typeof effects === 'boolean') {
    return effects ? 'Пассивные эффекты включены' : 'Пассивные эффекты отключены';
  }
  if (effects.length === 0) {
    return 'Нет пассивных эффектов';
  }
  return `Пассивные эффекты: ${effects.join(', ')}`;
}

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { REGION_TYPE_COLORS, REGION_TYPE_HEX_COLORS } from './regionPaintSystem';
import type { RegionBrushSize, RegionToolMode, RegionType, ResourceKind, WorldMapZone, ZoneEditorDraft, ZoneEditorSettings, ZoneEditorTool, ZoneType } from './zoneEditorTypes';
import {
  MAP_EDITOR_LAYER_OPTIONS,
  getDefaultEditorLayer,
  getDefaultZoneColor,
  getZoneTypesForLayer,
  getResolvedZoneColor,
  isDefaultZoneColor,
  isValidHexColor,
  normalizeHexColor,
  type LayerVisibilityState,
  type MapEditorLayer,
} from './zoneTaxonomy';
import type {
  WorldMapRepairActionId,
  WorldMapValidationIssue,
  WorldMapValidationSeverity,
} from './worldMapValidation';
import type { QuestMarkerDefinition } from '../types/quest';
import type { NpcDefinition } from '../types/npc';
import type { WorldLocation } from '../types/location';
import type { StoredImage } from '../services/content/models';
import { AdminHelpTooltip } from '../admin/help/AdminHelpTooltip';
import { loadMinesFromStorage } from '../services/miningRepository';
import { AdminImageField } from '../admin/AdminImageField';
import { buildUploadFolder } from '../services/content/uploadFolders';
import { resolveStoredImageSource } from '../services/content/runtimeImageService';
import type { LocationStateSpriteKey } from './zoneEditorTypes';
import { resolveWorldImageSource } from './worldLocationSprites';

type LocationPreviewEntry = {
  id: string;
  name: string;
  subtype?: string;
  currentState?: string;
  regionId?: string;
  factionId?: string;
  isHidden?: boolean;
  published?: boolean;
  previewImage?: string | null;
};

const TOOL_OPTIONS: Array<{ value: ZoneEditorTool; label: string }> = [
  { value: 'select', label: 'Select Tool' },
  { value: 'circle', label: 'Circle Tool' },
  { value: 'polygon', label: 'Polygon Tool' },
  { value: 'rectangle', label: 'Rectangle Tool' },
  { value: 'pan', label: 'Move / Pan Tool' },
  { value: 'measure', label: 'Measure Tool' },
];

const REGION_TOOL_OPTIONS: Array<{ value: RegionToolMode; label: string }> = [
  { value: 'circle', label: 'Circle' },
  { value: 'pencil', label: 'Pencil' },
  { value: 'brush', label: 'Brush' },
  { value: 'eraser', label: 'Eraser' },
];

const REGION_TYPE_OPTIONS: Array<{ value: RegionType; label: string }> = [
  { value: 'blocked', label: 'Горы (проходимо, очень тяжело)' },
  { value: 'water', label: 'Вода (непроходимо)' },
  { value: 'swamp', label: 'Болото (медленнее)' },
  { value: 'sand', label: 'Песок (медленнее)' },
  { value: 'walkable', label: 'Обычная земля' },
  { value: 'road', label: 'Дорога' },
  { value: 'danger', label: 'Опасная зона' },
  { value: 'trigger', label: 'Триггер' },
];

const BRUSH_SIZE_OPTIONS: RegionBrushSize[] = [0.05, 0.25, 0.5, 0.75, 1, 2, 3, 5, 8, 12];

const EDITOR_LAYER_OPTIONS: Array<{ value: MapEditorLayer; label: string }> = [
  { value: 'areas', label: 'Территории' },
  { value: 'locations', label: 'Локации' },
  { value: 'quests', label: 'Квесты' },
  { value: 'resources', label: 'Ресурсы' },
  { value: 'zones', label: 'Зоны' },
];

const INTERACTION_MODE_OPTIONS: Array<{ value: NonNullable<ZoneEditorDraft['interactionMode']>; label: string }> = [
  { value: 'none', label: 'Нет' },
  { value: 'inspect', label: 'Осмотр' },
  { value: 'enter', label: 'Вход' },
  { value: 'quest', label: 'Квест' },
  { value: 'resource', label: 'Ресурс' },
  { value: 'battle', label: 'Бой' },
  { value: 'random_event', label: 'Случайное событие' },
  { value: 'danger', label: 'Опасность' },
  { value: 'transition', label: 'Переход' },
  { value: 'fast_travel', label: 'Быстрое перемещение' },
  { value: 'rest', label: 'Отдых' },
  { value: 'locked', label: 'Закрыто' },
];

const RESOURCE_KIND_OPTIONS: Array<{ value: ResourceKind | ''; label: string }> = [
  { value: '', label: 'None' },
  { value: 'mine', label: 'mine' },
  { value: 'grove', label: 'grove' },
  { value: 'herb_patch', label: 'herb_patch' },
  { value: 'fishing_spot', label: 'fishing_spot' },
  { value: 'hunting_ground', label: 'hunting_ground' },
  { value: 'other', label: 'other' },
];

const LOCATION_SUBTYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '-' },
  { value: 'village', label: 'Деревня' },
  { value: 'academy', label: 'Академия' },
  { value: 'magic_school', label: 'Магическая школа' },
  { value: 'mine_entrance', label: 'Вход в шахту' },
  { value: 'camp', label: 'Лагерь' },
  { value: 'cult_camp', label: 'Лагерь культистов' },
  { value: 'farmstead', label: 'Хутор' },
  { value: 'outpost', label: 'Застава' },
  { value: 'fort', label: 'Форт' },
  { value: 'ruins', label: 'Руины' },
  { value: 'destroyed_village', label: 'Разрушенная деревня' },
  { value: 'restored_village', label: 'Восстановленная деревня' },
  { value: 'grove', label: 'Роща' },
  { value: 'oasis', label: 'Оазис' },
  { value: 'sanctuary', label: 'Святилище' },
  { value: 'temple', label: 'Храм' },
  { value: 'cave', label: 'Пещера' },
  { value: 'forge', label: 'Кузница' },
  { value: 'market', label: 'Рынок' },
  { value: 'harbor', label: 'Гавань' },
  { value: 'settlement', label: 'settlement' },
  { value: 'mine', label: 'mine' },
  { value: 'hideout', label: 'hideout' },
  { value: 'tower', label: 'tower' },
  { value: 'forest', label: 'forest' },
  { value: 'graveyard', label: 'graveyard' },
  { value: 'battlefield', label: 'battlefield' },
  { value: 'ritual_place', label: 'ritual_place' },
  { value: 'shrine', label: 'shrine' },
  { value: 'farm', label: 'farm' },
  { value: 'crossroad', label: 'crossroad' },
  { value: 'custom', label: 'custom' },
];

const LOCATION_STATE_SPRITE_KEYS: LocationStateSpriteKey[] = ['active', 'destroyed'];

interface ZoneEditorPanelProps {
  activeEditorLayer: MapEditorLayer;
  layerVisibility: LayerVisibilityState;
  onSetActiveEditorLayer: (layer: MapEditorLayer) => void;
  onCycleLayerVisibility: (layer: MapEditorLayer) => void;
  draft: ZoneEditorDraft | null;
  zones: WorldMapZone[];
  selectedZoneId: string | null;
  selectedTool: ZoneEditorTool;
  settings: ZoneEditorSettings;
  jsonValue: string;
  validationErrors: string[];
  regionToolMode: RegionToolMode;
  regionType: RegionType;
  regionBrushSize: RegionBrushSize;
  regionColor: string;
  onRegionToolModeChange: (tool: RegionToolMode) => void;
  onRegionTypeChange: (type: RegionType) => void;
  onRegionBrushSizeChange: (size: RegionBrushSize) => void;
  onRegionColorChange: (color: string) => void;
  onToolChange: (tool: ZoneEditorTool) => void;
  onSettingsChange: (patch: Partial<ZoneEditorSettings>) => void;
  onDraftChange: (draft: ZoneEditorDraft | null) => void;
  onSaveNewZone: () => void;
  onUpdateSelected: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onClearDraft: () => void;
  onClearAll: () => void;
  onResetStorage: () => void;
  onExport: () => void;
  onExportFile: () => void;
  onCopyJson: () => void;
  onImportJson: () => void;
  onImportJsonFile: (text: string) => void;
  onValidateJson: () => void;
  onJsonChange: (value: string) => void;
  onDeleteSelectedPoint: () => void;
  onReversePoints: () => void;
  questMarkers: QuestMarkerDefinition[];
  selectedQuestMarkerId: string | null;
  questMarkerDraft: QuestMarkerDefinition | null;
  onSelectQuestMarker: (id: string | null) => void;
  onQuestMarkerDraftChange: (draft: QuestMarkerDefinition | null) => void;
  onSaveQuestMarker: () => void;
  onDeleteQuestMarker: () => void;
  onPlaceQuestMarkerAtCursor: () => void;
  npcOptions?: NpcDefinition[];
  locationOptions?: WorldLocation[];
  locationPreviewImages?: StoredImage[];
  selectedNpcIdForPlacement?: string;
  onSelectNpcForPlacement?: (id: string) => void;
  onPlaceNpcAtCursor?: () => void;
  validationIssues: WorldMapValidationIssue[];
  onSelectValidationIssue: (issue: WorldMapValidationIssue) => void;
  onRepairValidationIssue: (issue: WorldMapValidationIssue) => void;
  onRepairSelectedZoneContract: (action: WorldMapRepairActionId) => void;
}

function resolveLocationPreviewImage(location: WorldLocation, images: StoredImage[]): string | null {
  const activeState = location.stateVariants?.find((state) => state.stateKey === location.currentState);
  const imageId = activeState?.imageId ?? location.defaultImageId;
  const imagePath = activeState?.imagePath ?? location.defaultImagePath;

  if (imageId) {
    const stored = images.find((image) => image.id === imageId);
    if (stored?.dataUrl) {
      return stored.dataUrl;
    }
    return imageId.startsWith('img_') ? null : imageId;
  }

  return imagePath || null;
}

function parseNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveCityIdFromDraft(draft: ZoneEditorDraft): string {
  const existing = draft.cityId?.trim();
  if (existing) {
    return existing.toLowerCase();
  }

  const probe = `${draft.name} ${draft.id}`.toLowerCase();
  if (probe.includes('арклейн') || probe.includes('arklein')) {
    return 'arklein';
  }

  const fromId = draft.id
    .toLowerCase()
    .replace(/^(loc_|city_|area_|zone_)/, '')
    .replace(/_city$|_area$/, '')
    .trim();
  return fromId || 'arklein';
}

function hasPassiveEffectsEnabled(draft: ZoneEditorDraft | null): boolean {
  if (!draft) {
    return false;
  }
  if (typeof draft.passiveEffects === 'boolean') {
    return draft.passiveEffects;
  }
  if (Array.isArray(draft.passiveEffects)) {
    return draft.passiveEffects.length > 0;
  }
  return false;
}

export function ZoneEditorPanel(props: ZoneEditorPanelProps) {
  const {
    activeEditorLayer,
    layerVisibility,
    onSetActiveEditorLayer,
    onCycleLayerVisibility,
    draft,
    zones,
    selectedZoneId,
    selectedTool,
    settings,
    jsonValue,
    validationErrors,
    regionToolMode,
    regionType,
    regionBrushSize,
    regionColor,
    onRegionToolModeChange,
    onRegionTypeChange,
    onRegionBrushSizeChange,
    onRegionColorChange,
    onToolChange,
    onSettingsChange,
    onDraftChange,
    onSaveNewZone,
    onUpdateSelected,
    onDuplicateSelected,
    onDeleteSelected,
    onClearDraft,
    onClearAll,
    onResetStorage,
    onExport,
    onExportFile,
    onCopyJson,
    onImportJson,
    onImportJsonFile,
    onValidateJson,
    onJsonChange,
    onDeleteSelectedPoint,
    onReversePoints,
    questMarkers,
    selectedQuestMarkerId,
    questMarkerDraft,
    onSelectQuestMarker,
    onQuestMarkerDraftChange,
    onSaveQuestMarker,
    onDeleteQuestMarker,
    onPlaceQuestMarkerAtCursor,
    npcOptions = [],
    locationOptions = [],
    locationPreviewImages = [],
    selectedNpcIdForPlacement = '',
    onSelectNpcForPlacement,
    onPlaceNpcAtCursor,
    validationIssues,
    onSelectValidationIssue,
    onRepairValidationIssue,
    onRepairSelectedZoneContract,
  } = props;

  const hasDraft = Boolean(draft);
  const hasSelectedZone = Boolean(selectedZoneId);
  const [hexInputValue, setHexInputValue] = useState('');
  const [hexWarning, setHexWarning] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!draft) {
      setHexInputValue('');
      setHexWarning(null);
      return;
    }

    setHexInputValue(getResolvedZoneColor(draft));
    setHexWarning(null);
  }, [draft]);

  const availableMines = useMemo(
    () => loadMinesFromStorage().filter((entry) => entry.isEnabled !== false),
    [],
  );

  const resolvedDraftColor = draft ? getResolvedZoneColor(draft) : getDefaultZoneColor('city');
  const colorInputValue = normalizeHexColor(resolvedDraftColor) ?? '#d6b35f';
  const draftLayer = draft?.editorLayer ?? activeEditorLayer;
  const typeOptionsBase = getZoneTypesForLayer(draftLayer);
  const typeOptions = draft?.type && !typeOptionsBase.includes(draft.type)
    ? [...typeOptionsBase, draft.type]
    : typeOptionsBase;
  const selectedLinkedLocationId = draft?.linkedLocationId?.trim() ?? '';
  const selectedLinkedLocation = selectedLinkedLocationId
    ? locationOptions.find((location) => location.id === selectedLinkedLocationId) ?? null
    : null;
  const selectedLinkedLocationPreview: LocationPreviewEntry | null = selectedLinkedLocation
    ? {
      id: selectedLinkedLocation.id,
      name: selectedLinkedLocation.name,
      subtype: selectedLinkedLocation.subtype,
      currentState: selectedLinkedLocation.currentState,
      regionId: selectedLinkedLocation.regionId,
      factionId: selectedLinkedLocation.factionId,
      isHidden: selectedLinkedLocation.isHidden,
      published: selectedLinkedLocation.published,
      previewImage: resolveLocationPreviewImage(selectedLinkedLocation, locationPreviewImages),
    }
    : null;
  const spritePreviewSource = draft?.locationSprite.imageUrl
    ? resolveStoredImageSource(draft.locationSprite.imageUrl, locationPreviewImages) ?? resolveWorldImageSource(draft.locationSprite.imageUrl)
    : null;
  const spriteScaleWarning = draft && draft.locationSprite.scale <= 0
    ? 'Sprite scale must be greater than 0.'
    : null;
  const spriteUrlWarning = draft?.locationSprite.imageUrl
    && !resolveStoredImageSource(draft.locationSprite.imageUrl, locationPreviewImages)
    && !/^(\/|data:image\/|https?:\/\/)/i.test(draft.locationSprite.imageUrl.trim())
      ? 'Image id/URL is not found in loaded Images. It will be kept, but may not render until the asset exists.'
      : null;
  const looksLikeArklein = Boolean(draft && /арклейн|arklein/i.test(`${draft.name} ${draft.id}`));
  const draftLayerForChecks = draft ? (draft.editorLayer ?? getDefaultEditorLayer(draft.type)) : null;
  const showRepairAsCity = Boolean(draft && (
    looksLikeArklein
    || (draft.type === 'city_area' && draft.playerClickable === true)
    || (draft.type === 'city' && draftLayerForChecks !== 'locations')
    || (Boolean(draft.cityId?.trim()) && draftLayerForChecks !== 'locations' && draft.type !== 'city_area')
  ));
  const showRepairAsCityArea = Boolean(draft && (
    draft.type === 'city_area'
    || (Boolean(draft.cityId?.trim()) && draft.type !== 'city' && draftLayerForChecks !== 'areas')
  ));

  const zoneContractWarnings: string[] = (() => {
    const warnings: string[] = [];
    const selected = draft ?? zones.find((zone) => zone.id === selectedZoneId) ?? null;
    if (selected) {
      const selectedLayer = selected.editorLayer ?? getDefaultEditorLayer(selected.type);
      const selectedInteraction = selected.interactionMode;
      const selectedClickable = selected.playerClickable;
      const selectedCityId = selected.cityId?.trim() ?? '';

      if (selected.type === 'city' && selectedLayer !== 'locations') {
        warnings.push('Город должен быть в слое Локации и иметь type=city.');
      }

      if (selected.type === 'city' && (selectedInteraction !== 'enter' || selectedClickable !== true)) {
        warnings.push('Город должен иметь interactionMode=enter и playerClickable=true.');
      }

      if (selected.type === 'city' && selected.blocksClick !== true) {
        warnings.push('Город должен иметь blocksClick=true.');
      }

      if (selected.type === 'city_area' && selectedClickable === true) {
        warnings.push('city_area — это территория города, она не должна быть кликабельной. Для входа нужен отдельный объект type=city.');
      }

      if (selected.type === 'city_area' && selectedLayer !== 'areas') {
        warnings.push('city_area должна быть в слое Территории (areas).');
      }

      if (selected.type === 'city_area' && selectedInteraction !== 'none') {
        warnings.push('city_area должна иметь interactionMode=none.');
      }

      if (selected.type === 'city_area' && selected.passiveEffects !== true) {
        warnings.push('city_area должна иметь passiveEffects=true.');
      }

      if (selected.type === 'resource_area' && selectedLayer !== 'resources') {
        warnings.push('resource_area должна быть в слое Ресурсы (resources).');
      }

      if (selected.type === 'resource_area' && selectedInteraction !== 'resource') {
        warnings.push('resource_area должна иметь interactionMode=resource.');
      }

      if (selected.type === 'resource_area' && selectedClickable === true) {
        warnings.push('resource_area не должна быть кликабельной напрямую (playerClickable=false).');
      }

      if (selected.type === 'resource_area' && selected.passiveEffects !== true) {
        warnings.push('resource_area должна иметь passiveEffects=true.');
      }

      if ((selected.type === 'kingdom_area' || selected.type === 'faction_area') && selectedClickable === true) {
        warnings.push(`${selected.type} должна иметь playerClickable=false.`);
      }

      if ((selected.type === 'kingdom_area' || selected.type === 'faction_area') && selected.blocksClick === true) {
        warnings.push(`${selected.type} должна иметь blocksClick=false.`);
      }

      if ((selected.type === 'kingdom_area' || selected.type === 'faction_area') && selected.passiveEffects !== true) {
        warnings.push(`${selected.type} должна иметь passiveEffects=true.`);
      }

      if (selected.type === 'random_event_area' && selectedInteraction !== 'random_event') {
        warnings.push('random_event_area должна иметь interactionMode=random_event.');
      }

      if (selected.type === 'random_event_area' && selectedClickable === true) {
        warnings.push('random_event_area должна иметь playerClickable=false.');
      }

      if (selected.type === 'random_event_area' && selected.passiveEffects !== true) {
        warnings.push('random_event_area должна иметь passiveEffects=true.');
      }

      if (selected.type === 'danger_area' && selectedInteraction !== 'danger') {
        warnings.push('danger_area должна иметь interactionMode=danger.');
      }

      if (selected.type === 'danger_area' && selectedClickable === true) {
        warnings.push('danger_area должна иметь playerClickable=false.');
      }

      if (selected.type === 'danger_area' && selected.passiveEffects !== true) {
        warnings.push('danger_area должна иметь passiveEffects=true.');
      }

      if (selected.type === 'city' && !selectedCityId) {
        warnings.push('Локация города без cityId. Укажи cityId, чтобы связать её с городом.');
      }

      if (selected.type === 'city' && selectedCityId.toLowerCase().startsWith('city_')) {
        warnings.push('cityId должен быть каноническим (например arklein), а не city_arklein.');
      }
    }

    const cityMarkersByCityId = new Map<string, number>();
    for (const zone of zones) {
      if (zone.type !== 'city') {
        continue;
      }
      const cityId = zone.cityId?.trim();
      if (!cityId) {
        continue;
      }
      cityMarkersByCityId.set(cityId, (cityMarkersByCityId.get(cityId) ?? 0) + 1);
    }
    for (const [, count] of cityMarkersByCityId) {
      if (count > 1) {
        warnings.push('Найдено несколько city-объектов с одинаковым cityId.');
        break;
      }
    }

    return warnings;
  })();
  const cityContractWarnings = zoneContractWarnings.filter((warning) => (
    warning.includes('Город')
    || warning.includes('city_area')
    || warning.includes('cityId')
    || warning.includes('city-объектов')
  ));
  const selectedZoneEffectiveId = draft?.id ?? selectedZoneId ?? null;
  const selectedZoneValidationIssues = selectedZoneEffectiveId
    ? validationIssues.filter((issue) => issue.zoneId === selectedZoneEffectiveId)
    : [];
  const selectedZonePriorityIssues = selectedZoneValidationIssues.filter((issue) => issue.severity === 'error' || issue.severity === 'warning');

  const severityCounts = {
    error: validationIssues.filter((issue) => issue.severity === 'error').length,
    warning: validationIssues.filter((issue) => issue.severity === 'warning').length,
    info: validationIssues.filter((issue) => issue.severity === 'info').length,
  };

  const layerCounts = {
    areas: zones.filter((zone) => (zone.editorLayer ?? getDefaultEditorLayer(zone.type)) === 'areas').length,
    locations: zones.filter((zone) => (zone.editorLayer ?? getDefaultEditorLayer(zone.type)) === 'locations').length,
    quests: zones.filter((zone) => (zone.editorLayer ?? getDefaultEditorLayer(zone.type)) === 'quests').length,
    resources: zones.filter((zone) => (zone.editorLayer ?? getDefaultEditorLayer(zone.type)) === 'resources').length,
    zones: zones.filter((zone) => (zone.editorLayer ?? getDefaultEditorLayer(zone.type)) === 'zones').length,
    passability: REGION_TYPE_OPTIONS.length,
  };

  const isPassabilityLayer = activeEditorLayer === 'passability';

  const issuesBySeverity: Record<WorldMapValidationSeverity, WorldMapValidationIssue[]> = {
    error: validationIssues.filter((issue) => issue.severity === 'error'),
    warning: validationIssues.filter((issue) => issue.severity === 'warning'),
    info: validationIssues.filter((issue) => issue.severity === 'info'),
  };

  const baseMarkerDraft: QuestMarkerDefinition = questMarkerDraft ?? {
    id: '',
    title: '',
    mapId: 'worldmap-main',
    x: 0.5,
    y: 0.5,
    type: 'quest_start',
    visibleToPlayer: true,
    conditionIds: [],
  };

  function updateDraft(patch: Partial<ZoneEditorDraft>) {
    if (!draft) {
      return;
    }

    onDraftChange({
      ...draft,
      ...patch,
      updatedAt: Date.now(),
    });
  }

  function handleResourceKindChange(nextValue: ResourceKind | '') {
    if (!draft) {
      return;
    }

    updateDraft({
      resourceKind: nextValue,
      professionId: nextValue === 'mine' && !draft.professionId.trim() ? 'mining' : draft.professionId,
      mineId: nextValue === 'mine' ? draft.mineId : '',
    });
  }

  function updateLocationSprite(patch: Partial<ZoneEditorDraft['locationSprite']>) {
    if (!draft) {
      return;
    }
    updateDraft({
      locationSprite: {
        ...draft.locationSprite,
        ...patch,
        visibleOnWorldMap: patch.imageUrl && !draft.locationSprite.visibleOnWorldMap
          ? true
          : patch.visibleOnWorldMap ?? draft.locationSprite.visibleOnWorldMap,
      },
    });
  }

  function updateStateSprite(key: LocationStateSpriteKey, value: string) {
    if (!draft) {
      return;
    }
    updateDraft({
      stateSprites: {
        ...draft.stateSprites,
        [key]: value,
      },
    });
  }

  function applyHexColorValue(nextValue: string) {
    if (!draft) {
      return;
    }

    setHexInputValue(nextValue);
    const normalized = normalizeHexColor(nextValue);
    if (!normalized) {
      setHexWarning('Неверный HEX. Используйте #RGB или #RRGGBB.');
      return;
    }

    setHexWarning(null);
    updateDraft({ color: normalized });
  }

  function handleTypeChange(nextType: ZoneType) {
    if (!draft) {
      return;
    }

    const prevLayer = draft.editorLayer ?? getDefaultEditorLayer(draft.type);
    const nextLayer = getDefaultEditorLayer(nextType);
    const prevDefault = getDefaultZoneColor(draft.type, prevLayer);
    const nextDefault = getDefaultZoneColor(nextType, nextLayer);
    const currentResolved = getResolvedZoneColor(draft);
    const shouldUseNextDefault = !draft.color || isDefaultZoneColor(currentResolved, draft.type, prevLayer) || currentResolved === prevDefault;

    if (nextType === 'kingdom_area') {
      updateDraft({
        type: nextType,
        editorLayer: 'areas',
        interactionMode: 'none',
        playerClickable: false,
        blocksClick: false,
        passiveEffects: true,
        color: shouldUseNextDefault ? nextDefault : currentResolved,
      });
      return;
    }

    updateDraft({
      type: nextType,
      color: shouldUseNextDefault ? nextDefault : currentResolved,
    });
  }

  function handleResetColor() {
    if (!draft) {
      return;
    }

    const layer = draft.editorLayer ?? getDefaultEditorLayer(draft.type);
    const defaultColor = getDefaultZoneColor(draft.type, layer);
    setHexWarning(null);
    setHexInputValue(defaultColor);
    updateDraft({ color: defaultColor });
  }

  function handleRepairAsCity() {
    if (!draft) {
      return;
    }

    const cityId = deriveCityIdFromDraft(draft);
    updateDraft({
      editorLayer: 'locations',
      type: 'city',
      interactionMode: 'enter',
      playerClickable: true,
      blocksClick: true,
      passiveEffects: false,
      cityId,
      color: draft.color ?? getDefaultZoneColor('city', 'locations'),
      name: looksLikeArklein ? 'Арклейн' : draft.name,
    });
  }

  function handleRepairAsCityArea() {
    if (!draft) {
      return;
    }

    const cityId = deriveCityIdFromDraft(draft);
    updateDraft({
      editorLayer: 'areas',
      type: 'city_area',
      interactionMode: 'none',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
      cityId,
      color: draft.color ?? getDefaultZoneColor('city_area', 'areas'),
    });
  }

  function handleImportJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    void file.text()
      .then((text) => {
        onImportJsonFile(text);
      })
      .catch(() => {
        // Ignore local read errors; parent handler will report parse/validation issues.
      });
  }

  return (
    <aside className="wm-editor-sidebar card">
      <div className="zone-editor-section">
        <h3>Editor <AdminHelpTooltip section="zoneEditor" field="editor" /></h3>
        <div className="wm-inline-buttons zone-editor-layer-tabs">
          {MAP_EDITOR_LAYER_OPTIONS.map((layer) => (
            <button
              key={layer.value}
              type="button"
              className={`zone-editor-layer-tab ${activeEditorLayer === layer.value ? 'is-active' : ''}`}
              onClick={() => onSetActiveEditorLayer(layer.value)}
            >
              {layer.label}
            </button>
          ))}
        </div>
        <div className="zone-editor-layer-hint">
          {MAP_EDITOR_LAYER_OPTIONS.find((layer) => layer.value === activeEditorLayer)?.description}
        </div>

        <div className="zone-editor-layer-visibility-section">
          <h4>Показ слоёв</h4>
          <div className="zone-editor-layer-visibility-controls">
            {MAP_EDITOR_LAYER_OPTIONS.map((layer) => {
              const isActive = layer.value === activeEditorLayer;
              const currentMode = layerVisibility[layer.value];
              const modeLabel = isActive
                ? 'Редактируется'
                : currentMode === 'hidden'
                  ? 'Скрыт'
                  : currentMode === 'dimmed'
                    ? 'Фон'
                    : 'Видим';

              return (
                <button
                  key={layer.value}
                  type="button"
                  className={`layer-visibility-button ${isActive ? 'is-active' : ''}`}
                  onClick={() => onCycleLayerVisibility(layer.value)}
                  disabled={isActive}
                >
                  <span className="layer-visibility-label">{layer.label}</span>
                  <span className="layer-visibility-mode">{modeLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {isPassabilityLayer ? (
          <div className="wm-meta-row">
            <span>Активен слой проходимости: рисование идёт кистью по поверхности карты.</span>
          </div>
        ) : (
          <>
            <label>
              <span>Current Tool <AdminHelpTooltip section="zoneEditor" field="currentTool" /></span>
              <select value={selectedTool} onChange={(event) => onToolChange(event.target.value as ZoneEditorTool)}>
                {TOOL_OPTIONS.map((tool) => (
                  <option key={tool.value} value={tool.value}>{tool.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Shape <AdminHelpTooltip section="zoneEditor" field="shape" /></span>
              <select
                value={draft?.shape ?? 'circle'}
                disabled={!draft}
                onChange={(event) => updateDraft({ shape: event.target.value as ZoneEditorDraft['shape'] })}
              >
                <option value="circle">circle</option>
                <option value="polygon">polygon</option>
                <option value="rect">rect</option>
              </select>
            </label>
            <div className="wm-meta-row">
              <span>Selected zone: {selectedZoneId ?? '-'}</span>
            </div>
          </>
        )}
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.showZones} onChange={(event) => onSettingsChange({ showZones: event.target.checked })} />
          <span>Show zones <AdminHelpTooltip section="zoneEditor" field="showZones" /></span>
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.showLabels} onChange={(event) => onSettingsChange({ showLabels: event.target.checked })} />
          <span>Show labels <AdminHelpTooltip section="zoneEditor" field="showLabels" /></span>
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.showGrid} onChange={(event) => onSettingsChange({ showGrid: event.target.checked })} />
          <span>Show grid <AdminHelpTooltip section="zoneEditor" field="showGrid" /></span>
        </label>
        <label className="zone-editor-checkbox">
          <input type="checkbox" checked={settings.snapEnabled} onChange={(event) => onSettingsChange({ snapEnabled: event.target.checked })} />
          <span>Snap <AdminHelpTooltip section="zoneEditor" field="snap" /></span>
        </label>

        <h4>{isPassabilityLayer ? 'Инструменты слоя проходимости' : 'Покраска проходимости (кисть)'} <AdminHelpTooltip section="zoneEditor" field="regionPainter" /></h4>
        <div className="wm-inline-buttons">
          {REGION_TOOL_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={regionToolMode === option.value ? 'is-active' : ''}
              onClick={() => onRegionToolModeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label>
          <span>Категория поверхности <AdminHelpTooltip section="zoneEditor" field="regionType" /></span>
          <select value={regionType} onChange={(event) => onRegionTypeChange(event.target.value as RegionType)}>
            {REGION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Brush Size <AdminHelpTooltip section="zoneEditor" field="brushSize" /></span>
          <select value={String(regionBrushSize)} onChange={(event) => onRegionBrushSizeChange(Number(event.target.value) as RegionBrushSize)}>
            {BRUSH_SIZE_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>{option}</option>
            ))}
          </select>
        </label>

        <div className="zone-editor-color-row">
          <span>Region color preview</span>
          <div className="zone-editor-color-preview" style={{ background: regionColor || REGION_TYPE_COLORS[regionType] }} />
        </div>

        <label>
          <span>Custom region color</span>
          <div className="zone-editor-color-input-row">
            <input
              type="color"
              value={regionColor || REGION_TYPE_HEX_COLORS[regionType]}
              onChange={(event) => onRegionColorChange(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onRegionColorChange(REGION_TYPE_HEX_COLORS[regionType])}
            >
              Reset
            </button>
          </div>
        </label>
      </div>

      <div className="zone-editor-section">
        <h3>Quest Markers <AdminHelpTooltip section="zoneEditor" field="questMarkers" /></h3>
        <label>
          <span>Marker</span>
          <select
            value={selectedQuestMarkerId ?? ''}
            onChange={(event) => onSelectQuestMarker(event.target.value || null)}
          >
            <option value="">-</option>
            {questMarkers.map((marker) => (
              <option key={marker.id} value={marker.id}>{marker.title || marker.id}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Id</span>
          <input
            value={baseMarkerDraft.id}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, id: event.target.value })}
          />
        </label>
        <label>
          <span>Title</span>
          <input
            value={baseMarkerDraft.title}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, title: event.target.value })}
          />
        </label>
        <label>
          <span>Quest Id</span>
          <input
            value={baseMarkerDraft.linkedQuestId ?? ''}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, linkedQuestId: event.target.value })}
          />
        </label>
        <label>
          <span>Objective Id</span>
          <input
            value={baseMarkerDraft.linkedObjectiveId ?? ''}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, linkedObjectiveId: event.target.value })}
          />
        </label>
        <label>
          <span>Step Id</span>
          <input
            value={baseMarkerDraft.linkedStepId ?? ''}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, linkedStepId: event.target.value })}
          />
        </label>
        <label>
          <span>Marker Type <AdminHelpTooltip section="zoneEditor" field="markerType" /></span>
          <select
            value={baseMarkerDraft.type}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, type: event.target.value as QuestMarkerDefinition['type'] })}
          >
            <option value="quest_start">quest_start</option>
            <option value="quest_objective">quest_objective</option>
            <option value="quest_finish">quest_finish</option>
            <option value="npc_quest">npc_quest</option>
            <option value="item_spawn">item_spawn</option>
            <option value="enemy_spawn">enemy_spawn</option>
            <option value="inspect_object">inspect_object</option>
            <option value="hidden_location">hidden_location</option>
          </select>
        </label>
        <label className="zone-editor-checkbox">
          <input
            type="checkbox"
            checked={baseMarkerDraft.isActive !== false}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, isActive: event.target.checked })}
          />
          <span>isActive</span>
        </label>
        <label className="zone-editor-checkbox">
          <input
            type="checkbox"
            checked={baseMarkerDraft.hideAfterQuestCompleted === true}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, hideAfterQuestCompleted: event.target.checked })}
          />
          <span>hideAfterQuestCompleted</span>
        </label>
        <label className="zone-editor-checkbox">
          <input
            type="checkbox"
            checked={baseMarkerDraft.hideAfterObjectiveCompleted === true}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, hideAfterObjectiveCompleted: event.target.checked })}
          />
          <span>hideAfterObjectiveCompleted</span>
        </label>
        <label className="zone-editor-checkbox">
          <input
            type="checkbox"
            checked={baseMarkerDraft.hideAfterStepCompleted === true}
            onChange={(event) => onQuestMarkerDraftChange({ ...baseMarkerDraft, hideAfterStepCompleted: event.target.checked })}
          />
          <span>hideAfterStepCompleted</span>
        </label>
        <label>
          <span>Requirements JSON <AdminHelpTooltip section="zoneEditor" field="requirementsJson" /></span>
          <textarea
            rows={4}
            placeholder='[{"type":"quest_active","questId":"..."}]'
            value={baseMarkerDraft.requirements ? JSON.stringify(baseMarkerDraft.requirements, null, 2) : ''}
            onChange={(event) => {
              try {
                const parsed = event.target.value.trim() ? JSON.parse(event.target.value) as QuestMarkerDefinition['requirements'] : undefined;
                onQuestMarkerDraftChange({ ...baseMarkerDraft, requirements: parsed });
              } catch {
                // Keep draft as-is while JSON is invalid mid-edit
              }
            }}
          />
        </label>
        <div className="wm-meta-row">
          <span>Markers: {questMarkers.length}</span>
          <span>x: {baseMarkerDraft.x.toFixed(4)} y: {baseMarkerDraft.y.toFixed(4)}</span>
        </div>
        <div className="wm-meta-row">
          <span>{questMarkerDraft ? 'ready' : 'new marker'}</span>
          <span />
        </div>
        <div className="zone-editor-actions compact">
          <button onClick={onPlaceQuestMarkerAtCursor}>PLACE MARKER AT CURSOR</button>
          <button onClick={onSaveQuestMarker}>Save Marker</button>
          <button disabled={!selectedQuestMarkerId} onClick={onDeleteQuestMarker}>Delete Marker</button>
        </div>
      </div>

      <div className="zone-editor-section">
        <h3>NPC Placement</h3>
        <label>
          <span>NPC</span>
          <select value={selectedNpcIdForPlacement} onChange={(event) => onSelectNpcForPlacement?.(event.target.value)}>
            <option value="">-</option>
            {npcOptions.map((npc) => (
              <option key={npc.id} value={npc.id}>{npc.name || npc.id}</option>
            ))}
          </select>
        </label>
        <div className="zone-editor-actions compact">
          <button disabled={!selectedNpcIdForPlacement} onClick={onPlaceNpcAtCursor}>Place NPC At Cursor</button>
        </div>
      </div>

      <div className="zone-editor-section">
        <h3>Zone Identity</h3>
        <label>
          <span>Id</span>
          <input disabled={!draft} value={draft?.id ?? ''} onChange={(event) => updateDraft({ id: event.target.value })} />
        </label>
        <label>
          <span>Name</span>
          <input disabled={!draft} value={draft?.name ?? ''} onChange={(event) => updateDraft({ name: event.target.value })} />
        </label>
        <label>
          <span>Type</span>
          <select disabled={!draft} value={draft?.type ?? 'city'} onChange={(event) => handleTypeChange(event.target.value as ZoneType)}>
            {typeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Слой редактора</span>
          <select
            disabled={!draft || draft.type === 'kingdom_area'}
            value={draft?.editorLayer ?? getDefaultEditorLayer(draft?.type ?? 'city')}
            onChange={(event) => updateDraft({ editorLayer: event.target.value as ZoneEditorDraft['editorLayer'] })}
          >
            {EDITOR_LAYER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Режим взаимодействия</span>
          <select
            disabled={!draft || draft.type === 'kingdom_area'}
            value={draft?.interactionMode ?? 'none'}
            onChange={(event) => updateDraft({ interactionMode: event.target.value as ZoneEditorDraft['interactionMode'] })}
          >
            {INTERACTION_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="zone-editor-checkbox">
          <input
            disabled={!draft || draft.type === 'kingdom_area'}
            type="checkbox"
            checked={draft?.playerClickable === true}
            onChange={(event) => updateDraft({ playerClickable: event.target.checked })}
          />
          <span>Кликабельна игроком</span>
        </label>
        <label className="zone-editor-checkbox">
          <input
            disabled={!draft || draft.type === 'kingdom_area'}
            type="checkbox"
            checked={draft?.blocksClick === true}
            onChange={(event) => updateDraft({ blocksClick: event.target.checked })}
          />
          <span>Блокирует клики</span>
        </label>
        <label className="zone-editor-checkbox">
          <input
            disabled={!draft || draft.type === 'kingdom_area'}
            type="checkbox"
            checked={hasPassiveEffectsEnabled(draft)}
            onChange={(event) => updateDraft({ passiveEffects: event.target.checked })}
          />
          <span>Пассивные эффекты</span>
        </label>
        <label>
          <span>Region</span>
          <input disabled={!draft} value={draft?.region ?? ''} onChange={(event) => updateDraft({ region: event.target.value })} />
        </label>
        <label>
          <span>Faction</span>
          <input disabled={!draft} value={draft?.faction ?? ''} onChange={(event) => updateDraft({ faction: event.target.value })} />
        </label>
        <label>
          <span>Music asset ID</span>
          <input
            disabled={!draft}
            placeholder="music_kingdom_argos"
            value={draft?.musicAssetId ?? ''}
            onChange={(event) => updateDraft({ musicAssetId: event.target.value })}
          />
        </label>
        <label>
          <span>Music URL</span>
          <input
            disabled={!draft}
            placeholder="/audio/world/argos-theme.ogg"
            value={draft?.musicUrl ?? ''}
            onChange={(event) => updateDraft({ musicUrl: event.target.value })}
          />
        </label>
        <label>
          <span>Ambient asset ID</span>
          <input
            disabled={!draft}
            placeholder="amb_forest_wind"
            value={draft?.ambientSoundAssetId ?? ''}
            onChange={(event) => updateDraft({ ambientSoundAssetId: event.target.value })}
          />
        </label>
        <label>
          <span>Ambient URL</span>
          <input
            disabled={!draft}
            placeholder="/audio/ambience/forest.ogg"
            value={draft?.ambientSoundUrl ?? ''}
            onChange={(event) => updateDraft({ ambientSoundUrl: event.target.value })}
          />
        </label>
        {draft?.type === 'location' ? (
          <>
            <label>
              <span>Linked location</span>
              <select
                disabled={!draft}
                value={draft?.linkedLocationId ?? ''}
                onChange={(event) => updateDraft({ linkedLocationId: event.target.value })}
              >
                <option value="">-</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.id}{location.subtype ? ` | ${location.subtype}` : ''}{location.currentState ? ` | ${location.currentState}` : ''})
                  </option>
                ))}
              </select>
            </label>
            {selectedLinkedLocationPreview ? (
              <div className="zone-editor-linked-location-preview">
                <strong>{selectedLinkedLocationPreview.name}</strong>
                <div>ID: {selectedLinkedLocationPreview.id}</div>
                <div>Subtype: {selectedLinkedLocationPreview.subtype || '-'}</div>
                <div>Region: {selectedLinkedLocationPreview.regionId || '-'}</div>
                <div>Faction: {selectedLinkedLocationPreview.factionId || '-'}</div>
                <div>State: {selectedLinkedLocationPreview.currentState || '-'}</div>
                <div>Hidden: {selectedLinkedLocationPreview.isHidden ? 'yes' : 'no'}</div>
                <div>Published: {selectedLinkedLocationPreview.published ? 'yes' : 'no'}</div>
                {selectedLinkedLocationPreview.previewImage ? (
                  <img
                    src={selectedLinkedLocationPreview.previewImage}
                    alt={selectedLinkedLocationPreview.name}
                    style={{ maxWidth: 180, maxHeight: 120, objectFit: 'cover', border: '1px solid rgba(214,179,95,0.35)', marginTop: 8 }}
                  />
                ) : (
                  <div style={{ marginTop: 8, opacity: 0.7 }}>No preview</div>
                )}
              </div>
            ) : (
              <div className="zone-validation-errors">
                <p>Select an existing location from WORLD → ЛОКАЦИИ.</p>
              </div>
            )}
          </>
        ) : null}
        <label>
          <span>Location subtype</span>
          <select disabled={!draft} value={draft?.subtype ?? ''} onChange={(event) => updateDraft({ subtype: event.target.value })}>
            {LOCATION_SUBTYPE_OPTIONS.map((option) => (
              <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
            ))}
            {draft?.subtype && !LOCATION_SUBTYPE_OPTIONS.some((option) => option.value === draft.subtype) ? (
              <option value={draft.subtype}>{draft.subtype}</option>
            ) : null}
          </select>
        </label>
        <label>
          <span>Current state</span>
          <select disabled={!draft} value={draft?.currentState ?? 'active'} onChange={(event) => updateDraft({ currentState: event.target.value })}>
            <option value="active">active</option>
            <option value="hidden">hidden</option>
            <option value="destroyed">destroyed</option>
            <option value="restored">restored</option>
            <option value="captured">captured</option>
            <option value="locked">locked</option>
          </select>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.hidden === true} onChange={(event) => updateDraft({ hidden: event.target.checked })} />
          <span>hidden</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.requiresDiscovery === true} onChange={(event) => updateDraft({ requiresDiscovery: event.target.checked })} />
          <span>requiresDiscovery</span>
        </label>
        <div className="zone-editor-section" style={{ margin: '12px 0 0', padding: 12 }}>
          <h3>Sprite / World Image</h3>
          <label>
            <span>Sprite image URL</span>
            <input disabled={!draft} value={draft?.locationSprite.imageUrl ?? ''} onChange={(event) => updateLocationSprite({ imageUrl: event.target.value })} placeholder="/sprites/world/village.png or stored image id" />
          </label>
          <label>
            <span>Select sprite from Images</span>
            <select disabled={!draft} value={draft?.locationSprite.imageUrl ?? ''} onChange={(event) => updateLocationSprite({ imageUrl: event.target.value })}>
              <option value="">-</option>
              {locationPreviewImages.map((image) => (
                <option key={image.id} value={image.id}>{image.name || image.id}</option>
              ))}
            </select>
          </label>
          <AdminImageField
            value={draft?.locationSprite.imageUrl ?? ''}
            onChange={(next) => updateLocationSprite({ imageUrl: next })}
            onUploaded={(image) => updateLocationSprite({ imageUrl: image.id, assetKey: image.id, visibleOnWorldMap: true })}
            presetId="world-location-sprite"
            suggestedId={draft?.id ? `${draft.id}_world_sprite` : undefined}
            suggestedName={`${draft?.id || 'location'}-world-sprite`}
            uploadFolder={buildUploadFolder('images', 'locations', draft?.id || draft?.name || 'world-location', 'world-sprite')}
            label="Upload/select sprite from Images"
            hint="World map sprite for villages, academies, mines, camps, ruins and state variants."
          />
          <label className="zone-editor-checkbox">
            <input disabled={!draft} type="checkbox" checked={draft?.locationSprite.visibleOnWorldMap === true} onChange={(event) => updateLocationSprite({ visibleOnWorldMap: event.target.checked })} />
            <span>Show on world map</span>
          </label>
          <label className="zone-editor-checkbox">
            <input disabled={!draft} type="checkbox" checked={draft?.locationSprite.visibleInLocationView !== false} onChange={(event) => updateLocationSprite({ visibleInLocationView: event.target.checked })} />
            <span>Show inside location</span>
          </label>
          <label>
            <span>Anchor</span>
            <select disabled={!draft} value={draft?.locationSprite.anchor ?? 'bottom'} onChange={(event) => updateLocationSprite({ anchor: event.target.value as ZoneEditorDraft['locationSprite']['anchor'] })}>
              <option value="bottom">bottom</option>
              <option value="center">center</option>
            </select>
          </label>
          <label><span>Offset X</span><input disabled={!draft} type="number" value={draft?.locationSprite.offsetX ?? 0} onChange={(event) => updateLocationSprite({ offsetX: Number(event.target.value) || 0 })} /></label>
          <label><span>Offset Y</span><input disabled={!draft} type="number" value={draft?.locationSprite.offsetY ?? 0} onChange={(event) => updateLocationSprite({ offsetY: Number(event.target.value) || 0 })} /></label>
          <label><span>Scale</span><input disabled={!draft} type="number" step={0.05} min={0.01} value={draft?.locationSprite.scale ?? 1} onChange={(event) => updateLocationSprite({ scale: Number(event.target.value) || 1 })} /></label>
          <label><span>Z-index</span><input disabled={!draft} type="number" value={draft?.locationSprite.zIndex ?? 10} onChange={(event) => updateLocationSprite({ zIndex: Number(event.target.value) || 0 })} /></label>
          {spriteScaleWarning || spriteUrlWarning ? (
            <div className="zone-validation-errors">
              {spriteScaleWarning ? <p>{spriteScaleWarning}</p> : null}
              {spriteUrlWarning ? <p>{spriteUrlWarning}</p> : null}
            </div>
          ) : null}
          <div className="zone-editor-linked-location-preview">
            <strong>Preview</strong>
            {spritePreviewSource ? (
              <img
                src={spritePreviewSource}
                alt={draft?.name || 'sprite preview'}
                style={{ width: 72, height: 72, objectFit: 'contain', transform: `scale(${Math.max(0.01, draft?.locationSprite.scale ?? 1)})`, transformOrigin: 'center bottom' }}
              />
            ) : (
              <div style={{ opacity: 0.7 }}>No sprite selected</div>
            )}
          </div>
          {LOCATION_STATE_SPRITE_KEYS.map((key) => (
            <div key={key} className="zone-editor-section" style={{ margin: '10px 0 0', padding: 10 }}>
              <label>
                <span>{key[0].toUpperCase() + key.slice(1)} sprite</span>
                <input disabled={!draft} value={draft?.stateSprites[key] ?? ''} onChange={(event) => updateStateSprite(key, event.target.value)} />
              </label>
              <label>
                <span>Select {key} sprite from Images</span>
                <select disabled={!draft} value={draft?.stateSprites[key] ?? ''} onChange={(event) => updateStateSprite(key, event.target.value)}>
                  <option value="">-</option>
                  {locationPreviewImages.map((image) => (
                    <option key={`${key}-${image.id}`} value={image.id}>{image.name || image.id}</option>
                  ))}
                </select>
              </label>
              <AdminImageField
                value={draft?.stateSprites[key] ?? ''}
                onChange={(next) => updateStateSprite(key, next)}
                onUploaded={(image) => updateStateSprite(key, image.id)}
                presetId="world-location-sprite"
                suggestedId={draft?.id ? `${draft.id}_${key}_world_sprite` : undefined}
                suggestedName={`${draft?.id || 'location'}-${key}-world-sprite`}
                uploadFolder={buildUploadFolder('images', 'locations', draft?.id || draft?.name || 'world-location', 'states')}
                label={`Upload ${key} sprite`}
                hint={`Optional sprite override for state=${key}.`}
              />
            </div>
          ))}
        </div>
        <div className="zone-editor-color-row">
          <span>Цвет</span>
        </div>
        <div className="zone-editor-color-controls">
          <div className="zone-editor-color-row">
            <label className="zone-editor-color-label">
              <span>Цвет</span>
              <input
                className="zone-editor-color-input"
                type="color"
                disabled={!draft}
                value={colorInputValue}
                onChange={(event) => applyHexColorValue(event.target.value)}
              />
            </label>
            <label className="zone-editor-color-label">
              <span>HEX</span>
              <input
                className="zone-editor-color-hex-input"
                disabled={!draft}
                placeholder="#RRGGBB"
                value={hexInputValue}
                onChange={(event) => {
                  const value = event.target.value;
                  setHexInputValue(value);
                  if (value.trim() === '') {
                    setHexWarning('Неверный HEX. Используйте #RGB или #RRGGBB.');
                    return;
                  }
                  if (!isValidHexColor(value)) {
                    setHexWarning('Неверный HEX. Используйте #RGB или #RRGGBB.');
                    return;
                  }
                  applyHexColorValue(value);
                }}
              />
            </label>
          </div>
          <div className="zone-editor-color-row">
            <span>Превью</span>
            <div className="zone-editor-color-preview" style={{ background: resolvedDraftColor }} />
          </div>
          {hexWarning ? <div className="zone-editor-color-warning">{hexWarning}</div> : null}
          <button className="zone-editor-color-reset" type="button" disabled={!draft} onClick={handleResetColor}>Сбросить цвет</button>
        </div>
      </div>

      <div className="zone-editor-section">
        <h3>Description</h3>
        <label>
          <span>Description</span>
          <textarea disabled={!draft} rows={4} value={draft?.description ?? ''} onChange={(event) => updateDraft({ description: event.target.value })} />
        </label>
        <label>
          <span>Tooltip</span>
          <textarea disabled={!draft} rows={3} value={draft?.tooltip ?? ''} onChange={(event) => updateDraft({ tooltip: event.target.value })} />
        </label>
      </div>

      <div className="zone-editor-section">
        <h3>Gameplay</h3>
        <label>
          <span>Danger Level</span>
          <input disabled={!draft} type="number" value={draft?.dangerLevel ?? 0} onChange={(event) => updateDraft({ dangerLevel: Number(event.target.value) || 0 })} />
        </label>
        <label>
          <span>Recommended Level</span>
          <input disabled={!draft} type="number" value={draft?.recommendedLevel ?? ''} onChange={(event) => updateDraft({ recommendedLevel: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Required Level</span>
          <input disabled={!draft} type="number" value={draft?.requiredLevel ?? ''} onChange={(event) => updateDraft({ requiredLevel: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Target Scene</span>
          <input disabled={!draft} value={draft?.targetScene ?? ''} onChange={(event) => updateDraft({ targetScene: event.target.value })} />
        </label>
        <label>
          <span>Required Quest Id</span>
          <input disabled={!draft} value={draft?.requiredQuestId ?? ''} onChange={(event) => updateDraft({ requiredQuestId: event.target.value })} />
        </label>
        <label>
          <span>Required Item Id</span>
          <input disabled={!draft} value={draft?.requiredItemId ?? ''} onChange={(event) => updateDraft({ requiredItemId: event.target.value })} />
        </label>
        <label>
          <span>Required Faction</span>
          <input disabled={!draft} value={draft?.requiredFaction ?? ''} onChange={(event) => updateDraft({ requiredFaction: event.target.value })} />
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.allowPvP ?? false} onChange={(event) => updateDraft({ allowPvP: event.target.checked })} />
          <span>allowPvP</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.isSafeZone ?? false} onChange={(event) => updateDraft({ isSafeZone: event.target.checked })} />
          <span>isSafeZone</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.isDiscovered ?? true} onChange={(event) => updateDraft({ isDiscovered: event.target.checked })} />
          <span>isDiscovered</span>
        </label>
        <label className="zone-editor-checkbox">
          <input disabled={!draft} type="checkbox" checked={draft?.isVisibleToPlayer ?? true} onChange={(event) => updateDraft({ isVisibleToPlayer: event.target.checked })} />
          <span>isVisibleToPlayer</span>
        </label>
      </div>

      <div className="zone-editor-section">
        <h3>Spawn / Resources / Profession</h3>
        <label>
          <span>Enemy Table Id</span>
          <input disabled={!draft} value={draft?.enemyTableId ?? ''} onChange={(event) => updateDraft({ enemyTableId: event.target.value })} />
        </label>
        <label>
          <span>Resource Table Id</span>
          <input disabled={!draft} value={draft?.resourceTableId ?? ''} onChange={(event) => updateDraft({ resourceTableId: event.target.value })} />
        </label>
        <label>
          <span>Resource Kind</span>
          <select
            disabled={!draft}
            value={draft?.resourceKind ?? ''}
            onChange={(event) => handleResourceKindChange(event.target.value as ResourceKind | '')}
          >
            {RESOURCE_KIND_OPTIONS.map((option) => (
              <option key={option.value || 'empty'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {draft?.resourceKind === 'mine' ? (
          <label>
            <span>Mine Id</span>
            {availableMines.length > 0 ? (
              <select
                disabled={!draft}
                value={draft?.mineId ?? ''}
                onChange={(event) => updateDraft({ mineId: event.target.value })}
              >
                <option value="">Select mine...</option>
                {availableMines.map((mine) => (
                  <option key={mine.id} value={mine.id}>{mine.name} ({mine.id})</option>
                ))}
              </select>
            ) : (
              <input
                disabled={!draft}
                value={draft?.mineId ?? ''}
                onChange={(event) => updateDraft({ mineId: event.target.value })}
                placeholder="mine_teramor_old_iron"
              />
            )}
          </label>
        ) : null}
        <label>
          <span>Profession Id</span>
          <input disabled={!draft} value={draft?.professionId ?? ''} onChange={(event) => updateDraft({ professionId: event.target.value })} />
        </label>
        <p className="muted" style={{ marginTop: -4 }}>
          Resource Table Id is for generic resource tables. Mine Id is for mining mini-game entrances.
        </p>
        <label>
          <span>Respawn Seconds</span>
          <input disabled={!draft} type="number" value={draft?.respawnSeconds ?? ''} onChange={(event) => updateDraft({ respawnSeconds: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Cooldown Seconds</span>
          <input disabled={!draft} type="number" value={draft?.cooldownSeconds ?? ''} onChange={(event) => updateDraft({ cooldownSeconds: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Layer Priority</span>
          <input disabled={!draft} type="number" value={draft?.layerPriority ?? 0} onChange={(event) => updateDraft({ layerPriority: Number(event.target.value) || 0 })} />
        </label>
        <label>
          <span>Random Quest Pool IDs</span>
          <input disabled={!draft} value={draft?.randomQuestPoolIds ?? ''} onChange={(event) => updateDraft({ randomQuestPoolIds: event.target.value })} placeholder="q_whisper_mist, q_oath_border" />
        </label>
        <label>
          <span>Chance Percent</span>
          <input disabled={!draft} type="number" min={0} max={100} value={draft?.chancePercent ?? ''} onChange={(event) => updateDraft({ chancePercent: parseNumber(event.target.value) })} />
        </label>
        <label>
          <span>Biome</span>
          <input disabled={!draft} value={draft?.biome ?? ''} onChange={(event) => updateDraft({ biome: event.target.value })} />
        </label>
        <label>
          <span>Kingdom ID</span>
          <input disabled={!draft} value={draft?.kingdomId ?? ''} onChange={(event) => updateDraft({ kingdomId: event.target.value })} />
        </label>
        <label>
          <span>City ID</span>
          <input disabled={!draft} value={draft?.cityId ?? ''} onChange={(event) => updateDraft({ cityId: event.target.value })} />
        </label>
        {cityContractWarnings.length > 0 ? (
          <div className="zone-validation-errors">
            {cityContractWarnings.map((warning) => (
              <p key={`city-contract-${warning}`}>{warning}</p>
            ))}
          </div>
        ) : null}
        {selectedZonePriorityIssues.length > 0 ? (
          <div className="zone-validation-errors">
            {selectedZonePriorityIssues.map((issue) => (
              <p key={`selected-zone-issue-${issue.id}`}>{issue.message}</p>
            ))}
          </div>
        ) : null}
        {(showRepairAsCity || showRepairAsCityArea) ? (
          <div className="zone-editor-actions compact">
            {showRepairAsCity ? <button type="button" onClick={handleRepairAsCity}>Исправить как город</button> : null}
            {showRepairAsCityArea ? <button type="button" onClick={handleRepairAsCityArea}>Исправить как территорию города</button> : null}
          </div>
        ) : null}
        {selectedZoneEffectiveId ? (
          <div className="zone-editor-actions compact">
            <button className="zone-editor-repair-button" type="button" onClick={() => onRepairSelectedZoneContract('assign_default_layer_contract')}>
              Исправить контракт слоя/типа
            </button>
            <button className="zone-editor-repair-button" type="button" onClick={() => onRepairSelectedZoneContract('assign_default_color')}>
              Назначить цвет по умолчанию
            </button>
          </div>
        ) : null}
      </div>

      <details className="zone-editor-section zone-editor-collapsible zone-editor-validation-panel" open>
        <summary>Проверка карты</summary>
        <div className="zone-editor-validation-summary">
          <div className="zone-editor-validation-count is-error">Ошибки: {severityCounts.error}</div>
          <div className="zone-editor-validation-count is-warning">Предупреждения: {severityCounts.warning}</div>
          <div className="zone-editor-validation-count is-info">Информация: {severityCounts.info}</div>
          <div className="zone-editor-validation-count">Всего зон: {zones.length}</div>
          <div className="zone-editor-validation-count">Территории: {layerCounts.areas}</div>
          <div className="zone-editor-validation-count">Локации: {layerCounts.locations}</div>
          <div className="zone-editor-validation-count">Квесты: {layerCounts.quests}</div>
          <div className="zone-editor-validation-count">Ресурсы: {layerCounts.resources}</div>
          <div className="zone-editor-validation-count">Зоны: {layerCounts.zones}</div>
          <div className="zone-editor-validation-count">Типы проходимости: {layerCounts.passability}</div>
        </div>

        <div className="zone-editor-validation-group">
          <h4>Ошибки ({issuesBySeverity.error.length})</h4>
          {issuesBySeverity.error.length === 0 ? <p className="muted">Ошибок не найдено.</p> : null}
          {issuesBySeverity.error.map((issue) => (
            <article key={issue.id} className="zone-editor-validation-issue is-error">
              <p>{issue.message}</p>
              <p className="muted">
                {issue.zoneName || issue.zoneId ? `${issue.zoneName ?? issue.zoneId} (${issue.zoneId ?? '-'})` : 'Глобальная проверка'}
                {issue.editorLayer ? ` • слой: ${issue.editorLayer}` : ''}
                {issue.field ? ` • поле: ${issue.field}` : ''}
              </p>
              <div className="zone-editor-validation-actions">
                {issue.zoneId ? <button type="button" onClick={() => onSelectValidationIssue(issue)}>Выбрать</button> : null}
                {issue.repairAction ? <button className="zone-editor-repair-button" type="button" onClick={() => onRepairValidationIssue(issue)}>Исправить</button> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="zone-editor-validation-group">
          <h4>Предупреждения ({issuesBySeverity.warning.length})</h4>
          {issuesBySeverity.warning.length === 0 ? <p className="muted">Предупреждений не найдено.</p> : null}
          {issuesBySeverity.warning.map((issue) => (
            <article key={issue.id} className="zone-editor-validation-issue is-warning">
              <p>{issue.message}</p>
              <p className="muted">
                {issue.zoneName || issue.zoneId ? `${issue.zoneName ?? issue.zoneId} (${issue.zoneId ?? '-'})` : 'Глобальная проверка'}
                {issue.editorLayer ? ` • слой: ${issue.editorLayer}` : ''}
                {issue.field ? ` • поле: ${issue.field}` : ''}
              </p>
              <div className="zone-editor-validation-actions">
                {issue.zoneId ? <button type="button" onClick={() => onSelectValidationIssue(issue)}>Выбрать</button> : null}
                {issue.repairAction ? <button className="zone-editor-repair-button" type="button" onClick={() => onRepairValidationIssue(issue)}>Исправить</button> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="zone-editor-validation-group">
          <h4>Информация ({issuesBySeverity.info.length})</h4>
          {issuesBySeverity.info.length === 0 ? <p className="muted">Информационных сообщений нет.</p> : null}
          {issuesBySeverity.info.map((issue) => (
            <article key={issue.id} className="zone-editor-validation-issue is-info">
              <p>{issue.message}</p>
              <p className="muted">
                {issue.zoneName || issue.zoneId ? `${issue.zoneName ?? issue.zoneId} (${issue.zoneId ?? '-'})` : 'Глобальная проверка'}
                {issue.editorLayer ? ` • слой: ${issue.editorLayer}` : ''}
                {issue.field ? ` • поле: ${issue.field}` : ''}
              </p>
              <div className="zone-editor-validation-actions">
                {issue.zoneId ? <button type="button" onClick={() => onSelectValidationIssue(issue)}>Выбрать</button> : null}
                {issue.repairAction ? <button className="zone-editor-repair-button" type="button" onClick={() => onRepairValidationIssue(issue)}>Исправить</button> : null}
              </div>
            </article>
          ))}
        </div>
      </details>

      <div className="zone-editor-section">
        <h3>Shape</h3>
        {draft?.shape === 'circle' ? (
          <>
            <div className="wm-meta-row">
              <span>X: {draft.x?.toFixed(4) ?? '-'}</span>
              <span>Y: {draft.y?.toFixed(4) ?? '-'}</span>
            </div>
            <label>
              <span>Radius</span>
              <div className="zone-editor-radius-row">
                <input
                  disabled={!draft}
                  type="range"
                  min={0.0025}
                  max={0.5}
                  step={0.001}
                  value={draft?.radius ?? 0.03}
                  onChange={(event) => updateDraft({ radius: Number(event.target.value) })}
                />
                <input
                  disabled={!draft}
                  type="number"
                  min={0.0025}
                  max={0.5}
                  step={0.001}
                  value={draft?.radius ?? ''}
                  onChange={(event) => updateDraft({ radius: parseNumber(event.target.value) })}
                />
              </div>
            </label>
          </>
        ) : (
          <>
            <div className="wm-meta-row">
              <span>Point count: {draft?.points.length ?? 0}</span>
              <span>Selected point: {draft?.selectedPointIndex ?? '-'}</span>
            </div>
            <div className="zone-editor-actions compact">
              <button disabled={!draft || draft.points.length === 0 || draft.selectedPointIndex === null} onClick={onDeleteSelectedPoint}>Delete Selected Point</button>
              <button disabled={!draft || draft.points.length < 3} onClick={onReversePoints}>Reverse Point Order</button>
            </div>
          </>
        )}
      </div>

      <div className="zone-editor-section">
        <h3>Actions</h3>
        <div className="zone-editor-actions">
          <button disabled={!hasDraft} onClick={onSaveNewZone}>Save New Zone</button>
          <button disabled={!hasDraft || !hasSelectedZone} onClick={onUpdateSelected}>Update Selected Zone</button>
          <button disabled={!hasSelectedZone} onClick={onDuplicateSelected}>Duplicate Selected</button>
          <button disabled={!hasSelectedZone} onClick={onDeleteSelected}>Delete Selected</button>
          <button disabled={!hasDraft} onClick={onClearDraft}>Clear Draft</button>
          <button onClick={onClearAll}>Clear All Zones</button>
          <button onClick={onResetStorage}>Reset Editor Storage</button>
        </div>
        <div className="wm-meta-row">
          <span>Saved zones: {zones.length}</span>
          <span>Draft: {draft ? `${draft.shape}` : '-'}</span>
        </div>
      </div>

      <details className="zone-editor-section zone-editor-collapsible">
        <summary>Import / Export JSON</summary>
        <div className="zone-editor-actions">
          <button type="button" onClick={onExportFile}>Export JSON File</button>
          <button type="button" onClick={() => importFileRef.current?.click()}>Import JSON File</button>
          <button type="button" onClick={onExport}>Export JSON</button>
          <button type="button" onClick={onCopyJson}>Copy JSON</button>
          <button type="button" onClick={onImportJson}>Import JSON</button>
          <button type="button" onClick={onValidateJson}>Validate JSON</button>
        </div>
        <input
          ref={importFileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleImportJsonFile}
        />
        <div className="zone-json-area">
          <textarea value={jsonValue} rows={12} onChange={(event) => onJsonChange(event.target.value)} />
        </div>
      </details>

      <details className="zone-editor-section zone-editor-collapsible">
        <summary>Debug</summary>
        <div className="wm-meta-row">
          <span>Validation messages: {validationErrors.length + zoneContractWarnings.length}</span>
          <span>Saved zones: {zones.length}</span>
        </div>
        {validationErrors.length + zoneContractWarnings.length > 0 ? (
          <div className="zone-validation-errors">
            {validationErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
            {zoneContractWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : (
          <div className="muted">No validation errors.</div>
        )}
      </details>
    </aside>
  );
}

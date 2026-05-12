import { useEffect, useState } from 'react';
import { REGION_TYPE_COLORS } from './regionPaintSystem';
import type { RegionBrushSize, RegionToolMode, RegionType, WorldMapZone, ZoneEditorDraft, ZoneEditorSettings, ZoneEditorTool, ZoneType } from './zoneEditorTypes';
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
import { AdminHelpTooltip } from '../admin/help/AdminHelpTooltip';

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
  { value: 'eraser', label: 'Eraser' },
];

const REGION_TYPE_OPTIONS: Array<{ value: RegionType; label: string }> = [
  { value: 'blocked', label: 'Непроходимо (скалы/горы)' },
  { value: 'water', label: 'Вода (непроходимо)' },
  { value: 'swamp', label: 'Болото (медленнее)' },
  { value: 'sand', label: 'Песок (медленнее)' },
  { value: 'walkable', label: 'Обычная земля' },
  { value: 'road', label: 'Дорога' },
  { value: 'danger', label: 'Опасная зона' },
  { value: 'trigger', label: 'Триггер' },
];

const BRUSH_SIZE_OPTIONS: RegionBrushSize[] = [1, 2, 3, 5];

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
  onRegionToolModeChange: (tool: RegionToolMode) => void;
  onRegionTypeChange: (type: RegionType) => void;
  onRegionBrushSizeChange: (size: RegionBrushSize) => void;
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
  onCopyJson: () => void;
  onImportJson: () => void;
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
  selectedNpcIdForPlacement?: string;
  onSelectNpcForPlacement?: (id: string) => void;
  onPlaceNpcAtCursor?: () => void;
  validationIssues: WorldMapValidationIssue[];
  onSelectValidationIssue: (issue: WorldMapValidationIssue) => void;
  onRepairValidationIssue: (issue: WorldMapValidationIssue) => void;
  onRepairSelectedZoneContract: (action: WorldMapRepairActionId) => void;
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
    onRegionToolModeChange,
    onRegionTypeChange,
    onRegionBrushSizeChange,
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
    onCopyJson,
    onImportJson,
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

  useEffect(() => {
    if (!draft) {
      setHexInputValue('');
      setHexWarning(null);
      return;
    }

    setHexInputValue(getResolvedZoneColor(draft));
    setHexWarning(null);
  }, [draft]);

  const resolvedDraftColor = draft ? getResolvedZoneColor(draft) : getDefaultZoneColor('city');
  const colorInputValue = normalizeHexColor(resolvedDraftColor) ?? '#d6b35f';
  const draftLayer = draft?.editorLayer ?? activeEditorLayer;
  const typeOptionsBase = getZoneTypesForLayer(draftLayer);
  const typeOptions = draft?.type && !typeOptionsBase.includes(draft.type)
    ? [...typeOptionsBase, draft.type]
    : typeOptionsBase;
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
    const nextLayer = draft.editorLayer ?? getDefaultEditorLayer(nextType);
    const prevDefault = getDefaultZoneColor(draft.type, prevLayer);
    const nextDefault = getDefaultZoneColor(nextType, nextLayer);
    const currentResolved = getResolvedZoneColor(draft);
    const shouldUseNextDefault = !draft.color || isDefaultZoneColor(currentResolved, draft.type, prevLayer) || currentResolved === prevDefault;

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
          <div className="zone-editor-color-preview" style={{ background: REGION_TYPE_COLORS[regionType] }} />
        </div>
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
          <span>Region</span>
          <input disabled={!draft} value={draft?.region ?? ''} onChange={(event) => updateDraft({ region: event.target.value })} />
        </label>
        <label>
          <span>Faction</span>
          <input disabled={!draft} value={draft?.faction ?? ''} onChange={(event) => updateDraft({ faction: event.target.value })} />
        </label>
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
          <span>Profession Id</span>
          <input disabled={!draft} value={draft?.professionId ?? ''} onChange={(event) => updateDraft({ professionId: event.target.value })} />
        </label>
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
          <button onClick={onExport}>Export JSON</button>
          <button onClick={onCopyJson}>Copy JSON</button>
          <button onClick={onImportJson}>Import JSON</button>
          <button onClick={onValidateJson}>Validate JSON</button>
        </div>
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

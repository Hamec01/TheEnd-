import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import '../styles.css';
import { detectHoverZone, pickRuntimeClickTarget } from './zoneSystem';
import { WORLD_MAP_ZONES, type Zone } from './worldMapNodes';
import type { PlayerWorldState } from './types';
import type { WorldSimulationSnapshot } from '../types/world-simulation.types';
import ActiveWorldEntitiesLayer from './components/ActiveWorldEntitiesLayer';
import { EDITOR_DRAFT_ALPHA, EDITOR_FILL_ALPHA, EDITOR_STROKE_ALPHA, INVALID_DRAFT_COLOR, withAlpha } from './zoneColors';
import {
  getDefaultBlocksClick,
  getDefaultInteractionMode,
  getDefaultPassiveEffects,
  getDefaultPlayerClickable,
  getDefaultTypeForLayer,
  getDefaultZoneColor,
  getEffectiveLayerVisibility,
  getResolvedZoneColor,
  type LayerVisibilityState,
  type MapEditorLayer,
} from './zoneTaxonomy';
import { clamp, getZoneCenter, hitTestHandle, hitTestZones, mapNormalizedToScreen, movePolygonPoint, moveZone, resizeCircle, screenToMapNormalized, type EditorViewport, type ZoneHandleHit } from './zoneGeometry';
import { createDraftFromZone, createEmptyZoneDraft, type PaintedRegion, type WorldMapZone, type ZoneEditorDraft, type ZoneEditorSettings, type ZoneEditorTool } from './zoneEditorTypes';
import { REGION_GRID_SIZE, REGION_TYPE_COLORS, applyBrushAlongLine, applyRegionPaint, getPaintedRegionCellMap, getRegionMoveSpeedMultiplier, isBlockedRegionType, mapPointToRegionCell, type RegionPaintSettings } from './regionPaintSystem';
import type { QuestMarkerDefinition } from '../types/quest';
import type { MovementControlScheme } from './playerMovementSettings';
import type { WorldSceneCommand, WorldSceneSnapshot } from './worldSceneTypes';
import { resolveWorldClickInteraction } from './worldInteractionCommands';
import { resolveVisibleWorldOverlayZones } from './worldOverlayVisibility';
import { findClickedLocationSprite, resolveCapturedBannerSource, resolveLocationSpritesForViewport, resolveWorldImageSource, resolveZoneSpriteImageRef } from './worldLocationSprites';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const OVERSCROLL = 120;
const PLAY_WORLD_MAP_IMAGE_PATH = '/map/main_world_map.webp';
const EDITOR_WORLD_MAP_IMAGE_PATH = '/map/world-map.png';

interface TooltipState {
  x: number;
  y: number;
  zone: WorldMapZone;
}

interface DragStatePan {
  kind: 'pan';
  startX: number;
  startY: number;
  originPanX: number;
  originPanY: number;
}

interface DragStateMoveZone {
  kind: 'move-zone';
  zoneId: string;
  startPoint: [number, number];
  originZone: WorldMapZone;
}

interface DragStateResizeCircle {
  kind: 'resize-circle';
  zoneId: string;
  originZone: WorldMapZone;
}

interface DragStateMovePoint {
  kind: 'move-point';
  zoneId: string;
  pointIndex: number;
  originZone: WorldMapZone;
}

interface DragStateCircleDraft {
  kind: 'circle-draft';
  center: [number, number];
}

interface DragStateMoveCircleDraft {
  kind: 'move-circle-draft';
  startPoint: [number, number];
  originX: number;
  originY: number;
}

interface DragStateRectDraft {
  kind: 'rect-draft';
  start: [number, number];
}

interface DragStateMeasure {
  kind: 'measure';
  start: [number, number];
  current: [number, number];
}

interface DragStateRegionPaint {
  kind: 'region-paint';
  lastCell: { x: number; y: number };
}

interface DragStateMoveSprite {
  kind: 'move-sprite';
  zoneId: string;
  startX: number;
  startY: number;
  originOffsetX: number;
  originOffsetY: number;
}

type DragState =
  | DragStatePan
  | DragStateMoveZone
  | DragStateResizeCircle
  | DragStateMovePoint
  | DragStateCircleDraft
  | DragStateMoveCircleDraft
  | DragStateRectDraft
  | DragStateMeasure
  | DragStateRegionPaint
  | DragStateMoveSprite;

interface ContextMenuState {
  x: number;
  y: number;
  zone: WorldMapZone | null;
  mapPoint: [number, number];
}

export interface WorldMapCanvasHandle {
  resetView: () => void;
  fitToScreen: () => void;
  focusZone: (zoneId: string | null) => void;
  focusPoint: (point: [number, number] | null) => void;
}

export interface WorldMapCanvasProps {
  mode: 'play' | 'editor';
  gameplayPaused?: boolean;
  playerStartPosition?: { x: number; y: number };
  playerAvatarUrl?: string | null;
  zones?: WorldMapZone[];
  selectedZoneId?: string | null;
  selectedTool?: ZoneEditorTool;
  settings?: ZoneEditorSettings;
  draft?: ZoneEditorDraft | null;
  onSettingsChange?: (patch: Partial<ZoneEditorSettings>) => void;
  onDraftChange?: (draft: ZoneEditorDraft | null) => void;
  onZonesChange?: (zones: WorldMapZone[]) => void;
  onSelectZone?: (zone: WorldMapZone | null) => void;
  onCheckpoint?: () => void;
  onDeleteZone?: (zoneId: string) => void;
  onDuplicateZone?: (zone: WorldMapZone) => void;
  onToggleZoneVisibility?: (zoneId: string) => void;
  onCopyJson?: (zone: WorldMapZone | null) => void;
  onPasteZoneAt?: (point: [number, number]) => Promise<void> | void;
  onConfirmDraft?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSaveShortcut?: () => void;
  onToolChange?: (tool: ZoneEditorTool) => void;
  onStatusMessage?: (message: string) => void;
  onMouseCoordinatesChange?: (coords: { x: number | null; y: number | null }) => void;
  regions?: PaintedRegion[];
  regionPaintSettings?: RegionPaintSettings;
  onRegionsChange?: (regions: PaintedRegion[]) => void;
  onRegionCheckpoint?: () => void;
  onOpenLocation?: (locationId: string) => void;
  onEnterZone?: (zone: Zone | null) => void;
  onHoverZone?: (zone: Zone | null) => void;
  markerPickMode?: boolean;
  onPickMarkerPoint?: (point: [number, number]) => void;
  onPlayerPosition?: (x: number, y: number) => void;
  onPlayerState?: (state: PlayerWorldState) => void;
  onRuntimeZoneInteract?: (zone: WorldMapZone, point: { x: number; y: number }) => void;
  playerTargetPosition?: { x: number; y: number } | null;
  playerTargetLocationId?: string | null;
  movementLocked?: boolean;
  controlScheme?: MovementControlScheme;
  playerSpeed?: number;
  sprintActive?: boolean;
  playQuestMarkers?: QuestMarkerDefinition[];
  playNpcMarkers?: Array<{
    id: string;
    name: string;
    kind: string;
    x: number;
    y: number;
    isHostile?: boolean;
    hasQuest?: boolean;
  }>;
  sceneSnapshot?: WorldSceneSnapshot | null;
  onSceneCommand?: (command: WorldSceneCommand) => void;
  activeEditorLayer?: MapEditorLayer;
  layerVisibility?: LayerVisibilityState;
  onWorldEntityClick?: (entity: WorldSimulationSnapshot['activeEntities'][number]) => void;
  lockedWorldEntityId?: string | null;
  lockedWorldEntityCoordinates?: { x: number; y: number } | null;
  discoveredLocationIds?: Set<string>;
  discoveredZoneIds?: Set<string>;
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input'
    || tag === 'textarea'
    || tag === 'select'
    || target.isContentEditable
    || target.closest('[contenteditable="true"]') !== null
  );
}

function hasPassiveEffects(zone: WorldMapZone): boolean {
  if (typeof zone.passiveEffects === 'boolean') {
    return zone.passiveEffects;
  }

  if (Array.isArray(zone.passiveEffects)) {
    return zone.passiveEffects.length > 0;
  }

  const defaults = getDefaultPassiveEffects(zone.type);
  if (typeof defaults === 'boolean') {
    return defaults;
  }

  return defaults.length > 0;
}

function shouldShowPlayModeHoverTooltip(zone: WorldMapZone): boolean {
  const playerClickable = typeof zone.playerClickable === 'boolean'
    ? zone.playerClickable
    : getDefaultPlayerClickable(zone.type);

  return playerClickable && !hasPassiveEffects(zone);
}

function cloneDraftWithGeometry(draft: ZoneEditorDraft | null, zone: WorldMapZone): ZoneEditorDraft {
  if (!draft) {
    return createDraftFromZone(zone);
  }

  return {
    ...draft,
    shape: zone.shape,
    x: zone.x ?? null,
    y: zone.y ?? null,
    radius: zone.radius ?? null,
    points: zone.points ? zone.points.map((point) => [point[0], point[1]] as [number, number]) : [],
    selectedPointIndex: draft.selectedPointIndex ?? null,
    updatedAt: Date.now(),
  };
}

function polygonFromRect(start: [number, number], end: [number, number]): [number, number][] {
  return [
    [Math.min(start[0], end[0]), Math.min(start[1], end[1])],
    [Math.max(start[0], end[0]), Math.min(start[1], end[1])],
    [Math.max(start[0], end[0]), Math.max(start[1], end[1])],
    [Math.min(start[0], end[0]), Math.max(start[1], end[1])],
  ];
}

function getClampedPan(zoom: number, panX: number, panY: number, canvasWidth: number, canvasHeight: number, imageWidth: number, imageHeight: number): { panX: number; panY: number } {
  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;
  const minPanX = canvasWidth - scaledWidth - OVERSCROLL;
  const maxPanX = OVERSCROLL;
  const minPanY = canvasHeight - scaledHeight - OVERSCROLL;
  const maxPanY = OVERSCROLL;

  return {
    panX: clamp(panX, minPanX, maxPanX),
    panY: clamp(panY, minPanY, maxPanY),
  };
}

function getFitView(canvasWidth: number, canvasHeight: number, imageWidth: number, imageHeight: number): { zoom: number; panX: number; panY: number } {
  const zoom = clamp(Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight), MIN_ZOOM, MAX_ZOOM);
  const panX = (canvasWidth - imageWidth * zoom) / 2;
  const panY = (canvasHeight - imageHeight * zoom) / 2;
  return { zoom, panX, panY };
}

function drawZoneShape(ctx: CanvasRenderingContext2D, zone: WorldMapZone, viewport: EditorViewport) {
  if (zone.shape === 'circle') {
    const [x, y] = mapNormalizedToScreen(zone.x ?? 0, zone.y ?? 0, viewport);
    const radius = (zone.radius ?? 0.03) * viewport.imageWidth * viewport.zoom;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    return;
  }

  const points = zone.points ?? [];
  if (points.length === 0) {
    return;
  }

  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const [screenX, screenY] = mapNormalizedToScreen(x, y, viewport);
    if (index === 0) {
      ctx.moveTo(screenX, screenY);
    } else {
      ctx.lineTo(screenX, screenY);
    }
  });
  ctx.closePath();
}

function drawZoneHandles(ctx: CanvasRenderingContext2D, zone: WorldMapZone, viewport: EditorViewport) {
  ctx.save();
  ctx.fillStyle = '#fff4d4';
  if (zone.shape === 'circle') {
    const [centerX, centerY] = mapNormalizedToScreen(zone.x ?? 0, zone.y ?? 0, viewport);
    const [radiusX, radiusY] = mapNormalizedToScreen((zone.x ?? 0) + (zone.radius ?? 0), zone.y ?? 0, viewport);
    for (const [x, y] of [[centerX, centerY], [radiusX, radiusY]]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    (zone.points ?? []).forEach(([x, y]) => {
      const [screenX, screenY] = mapNormalizedToScreen(x, y, viewport);
      ctx.beginPath();
      ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

export const WorldMapCanvas = forwardRef<WorldMapCanvasHandle, WorldMapCanvasProps>(function WorldMapCanvas(props, ref) {
  const {
    mode,
    gameplayPaused = false,
    playerStartPosition,
    playerAvatarUrl = null,
    zones = WORLD_MAP_ZONES,
    selectedZoneId = null,
    selectedTool = 'select',
    settings,
    draft = null,
    onSettingsChange,
    onDraftChange,
    onZonesChange,
    onSelectZone,
    onCheckpoint,
    onDeleteZone,
    onDuplicateZone,
    onToggleZoneVisibility,
    onCopyJson,
    onPasteZoneAt,
    onConfirmDraft,
    onUndo,
    onRedo,
    onSaveShortcut,
    onToolChange,
    onStatusMessage,
    onMouseCoordinatesChange,
    regions = [],
    regionPaintSettings,
    onRegionsChange,
    onRegionCheckpoint,
    onOpenLocation,
    onEnterZone,
    onHoverZone,
    markerPickMode = false,
    onPickMarkerPoint,
    onPlayerPosition,
    onPlayerState,
    onRuntimeZoneInteract,
    playerTargetPosition = null,
    playerTargetLocationId = null,
    movementLocked = false,
    controlScheme = 'arrows',
    playerSpeed,
    sprintActive = false,
    playQuestMarkers = [],
    playNpcMarkers = [],
    sceneSnapshot = null,
    onSceneCommand,
    activeEditorLayer = 'zones',
    onWorldEntityClick,
    layerVisibility = {
      areas: 'visible',
      locations: 'visible',
      quests: 'visible',
      resources: 'visible',
      zones: 'visible',
      passability: 'visible',
    },
    lockedWorldEntityId = null,
    lockedWorldEntityCoordinates = null,
    discoveredLocationIds,
    discoveredZoneIds,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [worldImage, setWorldImage] = useState<HTMLImageElement | null>(null);
  const [locationSpriteImages, setLocationSpriteImages] = useState<Map<string, HTMLImageElement>>(() => new Map());
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 780 });
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [cursorPoint, setCursorPoint] = useState<[number, number] | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [didInitialFit, setDidInitialFit] = useState(false);

  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [selectedZoneId, zones]);
  const editorSettings = settings ?? {
    showZones: true,
    showLabels: true,
    showGrid: false,
    snapEnabled: false,
    selectedTool,
    zoom: 1,
    panX: 0,
    panY: 0,
  };

  const effectiveRegionPaintSettings: RegionPaintSettings = regionPaintSettings ?? {
    toolMode: 'circle',
    regionType: 'blocked',
    brushSize: 1,
    regionColor: undefined,
  };

  const paintedCellMap = useMemo(() => getPaintedRegionCellMap(regions), [regions]);
  const locationSpriteImageSizes = useMemo(() => {
    const out = new Map<string, { width: number; height: number }>();
    for (const [src, image] of locationSpriteImages.entries()) {
      out.set(src, {
        width: image.naturalWidth || image.width || 48,
        height: image.naturalHeight || image.height || 48,
      });
    }
    return out;
  }, [locationSpriteImages]);

  const resolveCanMoveTo = useCallback((x: number, y: number) => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    if (!cell) {
      return true;
    }

    return !isBlockedRegionType(cell.regionType);
  }, [paintedCellMap]);

  const resolveSpeedMultiplier = useCallback((x: number, y: number) => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    if (!cell) {
      return 1;
    }

    return getRegionMoveSpeedMultiplier(cell.regionType);
  }, [paintedCellMap]);
  const snapshotPlayerPosition = sceneSnapshot?.player.position ?? playerStartPosition ?? { x: 0.53, y: 0.83 };
  const currentZone = sceneSnapshot?.currentZoneId
    ? zones.find((zone) => zone.id === sceneSnapshot.currentZoneId) ?? null
    : null;
  const createLayerDraftBase = (tool: ZoneEditorTool): ZoneEditorDraft => {
    const type = getDefaultTypeForLayer(activeEditorLayer);
    const layerDefault = createEmptyZoneDraft(tool);
    return {
      ...layerDefault,
      editorLayer: activeEditorLayer,
      type,
      interactionMode: getDefaultInteractionMode(type),
      playerClickable: getDefaultPlayerClickable(type),
      blocksClick: getDefaultBlocksClick(type),
      passiveEffects: getDefaultPassiveEffects(type),
      color: getDefaultZoneColor(type, activeEditorLayer),
    };
  };
  const visibleEditorZones = useMemo(() => {
    return zones.filter((zone) => {
      const zoneLayer = zone.editorLayer ?? 'zones';
      const visibility = getEffectiveLayerVisibility(zoneLayer, activeEditorLayer, layerVisibility);
      return visibility !== 'hidden';
    });
  }, [activeEditorLayer, layerVisibility, zones]);
  const selectableEditorZones = useMemo(() => {
    return visibleEditorZones.filter((zone) => (zone.editorLayer ?? 'zones') === activeEditorLayer);
  }, [activeEditorLayer, visibleEditorZones]);

  const editorViewport = useMemo<EditorViewport | null>(() => {
    if (!worldImage) {
      return null;
    }

    const clamped = getClampedPan(editorSettings.zoom, editorSettings.panX, editorSettings.panY, canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
    return {
      zoom: editorSettings.zoom,
      panX: clamped.panX,
      panY: clamped.panY,
      width: canvasSize.width,
      height: canvasSize.height,
      imageWidth: worldImage.naturalWidth,
      imageHeight: worldImage.naturalHeight,
    };
  }, [canvasSize.height, canvasSize.width, editorSettings.panX, editorSettings.panY, editorSettings.zoom, worldImage]);

  const cancelCurrentDrawingState = useCallback(() => {
    setDragState(null);
    setContextMenu(null);

    if (draft) {
      const isSelectedZoneDraft = Boolean(selectedZoneId && draft.id === selectedZoneId);
      if (isSelectedZoneDraft) {
        if (draft.selectedPointIndex !== null) {
          onDraftChange?.({ ...draft, selectedPointIndex: null });
        }
      } else {
        onDraftChange?.(null);
      }
    }

    onToolChange?.('select');
  }, [draft, onDraftChange, onToolChange, selectedZoneId]);

  function focusZoneInView(zoneId: string | null) {
    if (!zoneId || !editorViewport) {
      return;
    }
    const zone = zones.find((entry) => entry.id === zoneId);
    if (!zone) {
      return;
    }
    const [centerX, centerY] = getZoneCenter(zone);
    const panX = canvasSize.width / 2 - centerX * editorViewport.imageWidth * editorSettings.zoom;
    const panY = canvasSize.height / 2 - centerY * editorViewport.imageHeight * editorSettings.zoom;
    const clamped = getClampedPan(editorSettings.zoom, panX, panY, canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
    onSettingsChange?.(clamped);
    onStatusMessage?.(`Editor: focus ${zone.name}.`);
  }

  function focusPointInView(point: [number, number] | null) {
    if (!point || !editorViewport) {
      return;
    }
    const [x, y] = point;
    const panX = canvasSize.width / 2 - x * editorViewport.imageWidth * editorSettings.zoom;
    const panY = canvasSize.height / 2 - y * editorViewport.imageHeight * editorSettings.zoom;
    const clamped = getClampedPan(editorSettings.zoom, panX, panY, canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
    onSettingsChange?.(clamped);
    onStatusMessage?.(`Editor: focus point x:${x.toFixed(4)} y:${y.toFixed(4)}.`);
  }

  useImperativeHandle(ref, () => ({
    resetView() {
      if (mode === 'play') {
        onSceneCommand?.({ type: 'focus_point', point: null });
        return;
      }
      if (!worldImage) {
        return;
      }
      const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
      onSettingsChange?.(fit);
    },
    fitToScreen() {
      if (mode === 'play') {
        onSceneCommand?.({ type: 'focus_point', point: null });
        return;
      }
      if (!worldImage) {
        return;
      }
      const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
      onSettingsChange?.(fit);
      onStatusMessage?.('Editor: fit map to screen.');
    },
    focusZone(zoneId) {
      if (mode === 'play') {
        onSceneCommand?.({ type: 'focus_zone', zoneId: zoneId ?? null });
        return;
      }
      focusZoneInView(zoneId);
    },
    focusPoint(point) {
      if (mode === 'play') {
        onSceneCommand?.({
          type: 'focus_point',
          point: point ? { x: point[0], y: point[1] } : null,
        });
        return;
      }
      focusPointInView(point);
    },
  }), [canvasSize.height, canvasSize.width, editorSettings.zoom, editorViewport, focusPointInView, focusZoneInView, mode, onSceneCommand, onSettingsChange, onStatusMessage, worldImage, zones]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return undefined;
    }

    const resize = () => {
      const nextWidth = Math.max(320, Math.floor(surface.clientWidth));
      const nextHeight = Math.max(mode === 'editor' ? 520 : 380, Math.floor(surface.clientHeight));
      setCanvasSize({ width: nextWidth, height: nextHeight });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    const image = new Image();
    image.src = mode === 'editor' ? EDITOR_WORLD_MAP_IMAGE_PATH : PLAY_WORLD_MAP_IMAGE_PATH;
    image.onload = () => setWorldImage(image);
    image.onerror = () => {
      const fallback = new Image();
      fallback.src = PLAY_WORLD_MAP_IMAGE_PATH;
      fallback.onload = () => setWorldImage(fallback);
    };
  }, [mode]);

  useEffect(() => {
    const spriteSources = Array.from(new Set(
      [
        ...zones.flatMap((zone) => [resolveZoneSpriteImageRef(zone), resolveCapturedBannerSource(zone) ?? '']),
        draft?.locationSprite.imageUrl ?? '',
      ]
        .filter(Boolean)
        .map(resolveWorldImageSource),
    ));
    for (const source of spriteSources) {
      if (locationSpriteImages.has(source)) {
        continue;
      }
      const image = new Image();
      image.onload = () => {
        setLocationSpriteImages((current) => {
          if (current.has(source)) {
            return current;
          }
          const next = new Map(current);
          next.set(source, image);
          return next;
        });
      };
      image.onerror = () => {
        setLocationSpriteImages((current) => {
          if (current.has(source)) {
            return current;
          }
          const next = new Map(current);
          next.set(source, image);
          return next;
        });
      };
      image.src = source;
    }
  }, [draft?.locationSprite.imageUrl, locationSpriteImages, zones]);

  useEffect(() => {
    if (mode !== 'editor' || !worldImage || didInitialFit) {
      return;
    }

    const isDefaultView = settings ? settings.zoom === 1 && settings.panX === 0 && settings.panY === 0 : true;
    if (isDefaultView) {
      const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
      onSettingsChange?.(fit);
    }
    setDidInitialFit(true);
  }, [canvasSize.height, canvasSize.width, didInitialFit, mode, onSettingsChange, settings, worldImage]);

  useEffect(() => {
    if (mode !== 'editor') {
      return undefined;
    }

    const handleKeyDown = async (event: KeyboardEvent) => {
      const isTyping = isTextEditingTarget(event.target);
      if (isTyping && !(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key === '0') {
        event.preventDefault();
        if (!worldImage) {
          return;
        }
        const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
        onSettingsChange?.(fit);
        return;
      }

      if (event.key.toLowerCase() === 'h') {
        event.preventDefault();
        if (!worldImage) {
          return;
        }
        const fit = getFitView(canvasSize.width, canvasSize.height, worldImage.naturalWidth, worldImage.naturalHeight);
        onSettingsChange?.(fit);
        return;
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (selectedZoneId) {
          focusZoneInView(selectedZoneId);
        }
        return;
      }

      if (event.key === 'Delete' && !isTyping && selectedZoneId && document.activeElement === canvasRef.current) {
        event.preventDefault();
        onDeleteZone?.(selectedZoneId);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelCurrentDrawingState();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        onConfirmDraft?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSaveShortcut?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        onCopyJson?.(selectedZone);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        await onPasteZoneAt?.(cursorPoint ?? [0.5, 0.5]);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        onRedo?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        onRedo?.();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onUndo?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    cancelCurrentDrawingState,
    canvasSize.height,
    canvasSize.width,
    cursorPoint,
    focusZoneInView,
    mode,
    onConfirmDraft,
    onCopyJson,
    onDeleteZone,
    onPasteZoneAt,
    onRedo,
    onSaveShortcut,
    onSettingsChange,
    onUndo,
    selectedZone,
    selectedZoneId,
    worldImage,
  ]);

  function updateZones(nextZones: WorldMapZone[], nextSelectedZoneId: string | null = selectedZoneId) {
    onZonesChange?.(nextZones);
    if (nextSelectedZoneId) {
      const nextZone = nextZones.find((zone) => zone.id === nextSelectedZoneId) ?? null;
      if (nextZone) {
        onDraftChange?.(cloneDraftWithGeometry(draft, nextZone));
      }
    }
  }

  function paintRegionAlongLine(fromCell: { x: number; y: number }, toCell: { x: number; y: number }) {
    if (!onRegionsChange) {
      return;
    }

    const paintedCells = applyBrushAlongLine(fromCell, toCell, effectiveRegionPaintSettings.brushSize, effectiveRegionPaintSettings.toolMode);
    const nextRegions = applyRegionPaint(regions, paintedCells, effectiveRegionPaintSettings);
    onRegionsChange(nextRegions);
  }

  function getPlayCamera() {
    const fallback = { left: 0, top: 0, width: 1, height: 1 };
    const camera = sceneSnapshot?.camera ?? fallback;
    const width = clamp(camera.width, 0.001, 1);
    const height = clamp(camera.height, 0.001, 1);
    const left = clamp(camera.left, 0, 1 - width);
    const top = clamp(camera.top, 0, 1 - height);
    return { left, top, width, height };
  }

  function getEditorSpriteCamera() {
    if (!editorViewport) {
      return null;
    }
    const scaledWidth = editorViewport.imageWidth * editorViewport.zoom;
    const scaledHeight = editorViewport.imageHeight * editorViewport.zoom;
    return {
      left: -editorViewport.panX / Math.max(1, scaledWidth),
      top: -editorViewport.panY / Math.max(1, scaledHeight),
      width: canvasSize.width / Math.max(1, scaledWidth),
      height: canvasSize.height / Math.max(1, scaledHeight),
    };
  }

  function patchZoneSprite(zoneId: string, patch: Partial<NonNullable<WorldMapZone['locationSprite']>>) {
    const sourceZone = zones.find((zone) => zone.id === zoneId);
    if (!sourceZone?.locationSprite) {
      return;
    }

    const nextSprite = {
      ...sourceZone.locationSprite,
      ...patch,
      scale: patch.scale !== undefined ? Math.max(0.01, patch.scale) : sourceZone.locationSprite.scale,
    };
    const nextZone = { ...sourceZone, locationSprite: nextSprite, updatedAt: Date.now() };
    updateZones(zones.map((zone) => (zone.id === zoneId ? nextZone : zone)), zoneId);
    if (draft?.id === zoneId) {
      onDraftChange?.({
        ...draft,
        locationSprite: nextSprite,
        updatedAt: nextZone.updatedAt,
      });
    }
  }

  function findEditorSpriteAt(canvasX: number, canvasY: number): WorldMapZone | null {
    const camera = getEditorSpriteCamera();
    if (!camera) {
      return null;
    }
    const candidates = selectedZone
      ? [selectedZone]
      : visibleEditorZones.filter((zone) => (zone.editorLayer ?? 'zones') === activeEditorLayer);
    return findClickedLocationSprite(
      candidates,
      { x: canvasX, y: canvasY },
      camera,
      { width: canvasSize.width, height: canvasSize.height },
      locationSpriteImageSizes,
      new Set(candidates.map((zone) => zone.linkedLocationId ?? zone.linkedLocation ?? zone.id)),
      new Set(candidates.map((zone) => zone.id)),
    );
  }

  function getCanvasPoint(event: ReactMouseEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current;
    if (!canvas) {
      return [0, 0];
    }
    const rect = canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function getNormalizedPoint(event: ReactMouseEvent<HTMLCanvasElement>): [number, number] {
    const [canvasX, canvasY] = getCanvasPoint(event);
    if (mode === 'editor' && editorViewport) {
      return screenToMapNormalized(canvasX, canvasY, editorViewport);
    }

    const camera = getPlayCamera();
    return [
      clamp(camera.left + (canvasX / canvasSize.width) * camera.width, 0, 1),
      clamp(camera.top + (canvasY / canvasSize.height) * camera.height, 0, 1),
    ];
  }

  function zoomAt(canvasX: number, canvasY: number, nextZoom: number) {
    if (!editorViewport) {
      return;
    }

    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const [mapX, mapY] = screenToMapNormalized(canvasX, canvasY, editorViewport);
    const panX = canvasX - mapX * editorViewport.imageWidth * clampedZoom;
    const panY = canvasY - mapY * editorViewport.imageHeight * clampedZoom;
    const nextPan = getClampedPan(clampedZoom, panX, panY, canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
    onSettingsChange?.({ zoom: clampedZoom, panX: nextPan.panX, panY: nextPan.panY });
  }

  function handleEditorMouseDown(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (!editorViewport) {
      return;
    }

    setContextMenu(null);
    canvasRef.current?.focus();
    const [canvasX, canvasY] = getCanvasPoint(event);
    const mapPoint = getNormalizedPoint(event);
    const hitZone = hitTestZones(selectableEditorZones, mapPoint);
    const wantsPan = event.button === 1 || (event.button === 0 && selectedTool === 'pan');

    if (wantsPan) {
      event.preventDefault();
      setDragState({ kind: 'pan', startX: canvasX, startY: canvasY, originPanX: editorSettings.panX, originPanY: editorSettings.panY });
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (markerPickMode) {
      onPickMarkerPoint?.(mapPoint);
      return;
    }

    if (activeEditorLayer === 'passability') {
      onCheckpoint?.();
      onSelectZone?.(null);
      onDraftChange?.(null);
      const cell = mapPointToRegionCell(mapPoint);
      paintRegionAlongLine(cell, cell);
      setDragState({ kind: 'region-paint', lastCell: cell });
      return;
    }

    if (event.shiftKey) {
      const spriteZone = findEditorSpriteAt(canvasX, canvasY);
      if (spriteZone?.locationSprite) {
        event.preventDefault();
        onCheckpoint?.();
        onSelectZone?.(spriteZone);
        setDragState({
          kind: 'move-sprite',
          zoneId: spriteZone.id,
          startX: canvasX,
          startY: canvasY,
          originOffsetX: spriteZone.locationSprite.offsetX,
          originOffsetY: spriteZone.locationSprite.offsetY,
        });
        onStatusMessage?.('Sprite move: drag with Shift to adjust offset.');
        return;
      }
    }

    if (selectedTool === 'select') {
      const handleHit = selectedZone ? hitTestHandle(selectedZone, mapPoint, editorViewport) : null;
      if (selectedZone && handleHit) {
        onCheckpoint?.();
        if (handleHit.type === 'center') {
          setDragState({ kind: 'move-zone', zoneId: selectedZone.id, startPoint: mapPoint, originZone: selectedZone });
        } else if (handleHit.type === 'radius') {
          setDragState({ kind: 'resize-circle', zoneId: selectedZone.id, originZone: selectedZone });
        } else if (handleHit.type === 'point' && handleHit.pointIndex !== undefined) {
          onDraftChange?.({ ...(draft ?? createDraftFromZone(selectedZone)), selectedPointIndex: handleHit.pointIndex });
          setDragState({ kind: 'move-point', zoneId: selectedZone.id, pointIndex: handleHit.pointIndex, originZone: selectedZone });
        }
        return;
      }

      if (hitZone) {
        if (selectedZoneId === hitZone.id) {
          onCheckpoint?.();
          setDragState({ kind: 'move-zone', zoneId: hitZone.id, startPoint: mapPoint, originZone: hitZone });
        } else {
          onSelectZone?.(hitZone);
        }
        return;
      }

      if (draft && draft.selectedPointIndex !== null) {
        onDraftChange?.({ ...draft, selectedPointIndex: null });
      }
      onSelectZone?.(null);
      return;
    }

    if (selectedTool === 'measure') {
      setDragState({ kind: 'measure', start: mapPoint, current: mapPoint });
      return;
    }

    if (selectedTool === 'circle') {
      if (event.shiftKey && draft?.shape === 'circle' && draft.x !== null && draft.y !== null) {
        setDragState({
          kind: 'move-circle-draft',
          startPoint: mapPoint,
          originX: draft.x,
          originY: draft.y,
        });
        return;
      }

      onSelectZone?.(null);
      const baseDraft = draft
        ? { ...draft, shape: 'circle', points: [], radius: draft.radius ?? 0.0025, editorLayer: activeEditorLayer }
        : createLayerDraftBase('circle');
      const nextDraft = {
        ...baseDraft,
        shape: 'circle' as const,
        x: mapPoint[0],
        y: mapPoint[1],
        radius: 0.0025,
        points: [],
      };
      onDraftChange?.(nextDraft);
      setDragState({ kind: 'circle-draft', center: mapPoint });
      return;
    }

    if (selectedTool === 'rectangle') {
      onSelectZone?.(null);
      const baseDraft = draft
        ? { ...draft, shape: 'rect', x: null, y: null, radius: null, editorLayer: activeEditorLayer }
        : createLayerDraftBase('rectangle');
      onDraftChange?.({ ...baseDraft, shape: 'rect', points: polygonFromRect(mapPoint, mapPoint) });
      setDragState({ kind: 'rect-draft', start: mapPoint });
      return;
    }

    if (selectedTool === 'polygon') {
      onCheckpoint?.();
      const currentDraft = draft?.shape === 'polygon' ? { ...draft, editorLayer: activeEditorLayer } : createLayerDraftBase('polygon');
      onSelectZone?.(null);
      onDraftChange?.({
        ...currentDraft,
        shape: 'polygon',
        points: [...currentDraft.points, mapPoint],
        selectedPointIndex: currentDraft.points.length,
      });
      return;
    }

    const handleHit = selectedZone ? hitTestHandle(selectedZone, mapPoint, editorViewport) : null;
    if (selectedZone && handleHit) {
      onCheckpoint?.();
      if (handleHit.type === 'center') {
        setDragState({ kind: 'move-zone', zoneId: selectedZone.id, startPoint: mapPoint, originZone: selectedZone });
      } else if (handleHit.type === 'radius') {
        setDragState({ kind: 'resize-circle', zoneId: selectedZone.id, originZone: selectedZone });
      } else if (handleHit.type === 'point' && handleHit.pointIndex !== undefined) {
        onDraftChange?.({ ...(draft ?? createDraftFromZone(selectedZone)), selectedPointIndex: handleHit.pointIndex });
        setDragState({ kind: 'move-point', zoneId: selectedZone.id, pointIndex: handleHit.pointIndex, originZone: selectedZone });
      }
      return;
    }

    if (hitZone) {
      if (selectedZoneId === hitZone.id) {
        onCheckpoint?.();
        setDragState({ kind: 'move-zone', zoneId: hitZone.id, startPoint: mapPoint, originZone: hitZone });
      } else {
        onSelectZone?.(hitZone);
      }
      return;
    }

    onSelectZone?.(null);
    onDraftChange?.(null);
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (mode === 'editor') {
      handleEditorMouseDown(event);
      return;
    }

    if (gameplayPaused || movementLocked) {
      return;
    }

    canvasRef.current?.focus();

    if (event.button !== 0) {
      return;
    }

    const [x, y] = getNormalizedPoint(event);
    const [canvasX, canvasY] = getCanvasPoint(event);
    const camera = getPlayCamera();
    const resolution = resolveWorldClickInteraction({
      point: { x, y },
      screenPointPx: { x: canvasX, y: canvasY },
      viewportPx: { width: canvasSize.width, height: canvasSize.height },
      camera,
      zones,
      activeEntities: sceneSnapshot?.activeEntities ?? [],
      renderedEntities: sceneSnapshot?.renderedActiveEntities ?? [],
      lockedWorldEntityId,
      lockedWorldEntityCoordinates,
      spriteImageSizes: locationSpriteImageSizes,
      discoveredLocationIds,
      discoveredZoneIds,
    });

    if (resolution.clickedEntity) {
      if (onSceneCommand) {
        onSceneCommand({ type: 'interact_world_entity', entityId: resolution.clickedEntity.id });
      } else {
        onWorldEntityClick?.(resolution.clickedEntity);
      }
      return;
    }

    if (resolution.clickedZone) {
      if (onSceneCommand) {
        onSceneCommand({ type: 'interact_zone', zoneId: resolution.clickedZone.id, point: { x, y } });
      } else {
        onRuntimeZoneInteract?.(resolution.clickedZone, { x, y });
      }
    }

    const moveCommand = resolution.commands.find((command) => command.type === 'move_to_point');
    if (moveCommand) {
      onSceneCommand?.(moveCommand);
    }

  }

  function handleMouseMove(event: ReactMouseEvent<HTMLCanvasElement>) {
    const [canvasX, canvasY] = getCanvasPoint(event);
    const point = getNormalizedPoint(event);
    setCursorPoint(point);
    onMouseCoordinatesChange?.({ x: point[0], y: point[1] });

    if (mode === 'editor' && editorViewport && !dragState && (event.buttons & 4) === 4) {
      setDragState({ kind: 'pan', startX: canvasX, startY: canvasY, originPanX: editorSettings.panX, originPanY: editorSettings.panY });
      return;
    }

    if (mode === 'play') {
      const hovered = detectHoverZone(zones as Zone[], point[0], point[1]) as WorldMapZone | null;
      setHoverZone(hovered);
      if (onSceneCommand) {
        onSceneCommand({ type: 'hover_point', point: { x: point[0], y: point[1] } });
      } else {
        onHoverZone?.(hovered as Zone | null);
      }
      if (!hovered || !shouldShowPlayModeHoverTooltip(hovered)) {
        setTooltip(null);
        return;
      }
      setTooltip({ x: canvasX, y: canvasY, zone: hovered });
      return;
    }

    const hovered = hitTestZones(visibleEditorZones, point);
    setHoverZone(hovered);
    onHoverZone?.(hovered as Zone | null);
    if (hovered) {
      setTooltip({ x: canvasX, y: canvasY, zone: hovered });
    } else {
      setTooltip(null);
    }

    if (!dragState || !editorViewport) {
      return;
    }

    if (dragState.kind === 'pan') {
      const clamped = getClampedPan(editorSettings.zoom, dragState.originPanX + (canvasX - dragState.startX), dragState.originPanY + (canvasY - dragState.startY), canvasSize.width, canvasSize.height, editorViewport.imageWidth, editorViewport.imageHeight);
      onSettingsChange?.(clamped);
      return;
    }

    if (dragState.kind === 'region-paint') {
      const nextCell = mapPointToRegionCell(point);
      if (nextCell.x === dragState.lastCell.x && nextCell.y === dragState.lastCell.y) {
        return;
      }

      paintRegionAlongLine(dragState.lastCell, nextCell);
      setDragState({ kind: 'region-paint', lastCell: nextCell });
      return;
    }

    if (dragState.kind === 'move-sprite') {
      patchZoneSprite(dragState.zoneId, {
        offsetX: Math.round((dragState.originOffsetX + (canvasX - dragState.startX)) * 10) / 10,
        offsetY: Math.round((dragState.originOffsetY + (canvasY - dragState.startY)) * 10) / 10,
      });
      return;
    }

    if (dragState.kind === 'move-zone') {
      const deltaX = point[0] - dragState.startPoint[0];
      const deltaY = point[1] - dragState.startPoint[1];
      const nextZone = moveZone(dragState.originZone, deltaX, deltaY);
      updateZones(zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone)), nextZone.id);
      return;
    }

    if (dragState.kind === 'resize-circle') {
      const nextZone = resizeCircle(dragState.originZone, point);
      updateZones(zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone)), nextZone.id);
      return;
    }

    if (dragState.kind === 'move-point') {
      const nextZone = movePolygonPoint(dragState.originZone, dragState.pointIndex, point);
      updateZones(zones.map((zone) => (zone.id === nextZone.id ? nextZone : zone)), nextZone.id);
      onDraftChange?.({ ...(draft ?? createDraftFromZone(nextZone)), selectedPointIndex: dragState.pointIndex, points: nextZone.points ? nextZone.points.map((entry) => [entry[0], entry[1]] as [number, number]) : [] });
      return;
    }

    if (dragState.kind === 'circle-draft') {
      const radius = Math.max(0.0025, Math.hypot(point[0] - dragState.center[0], point[1] - dragState.center[1]));
      const baseDraft = draft ?? createLayerDraftBase('circle');
      onDraftChange?.({ ...baseDraft, shape: 'circle', x: dragState.center[0], y: dragState.center[1], radius });
      return;
    }

    if (dragState.kind === 'move-circle-draft') {
      if (draft?.shape !== 'circle') {
        return;
      }

      const deltaX = point[0] - dragState.startPoint[0];
      const deltaY = point[1] - dragState.startPoint[1];
      onDraftChange?.({
        ...draft,
        shape: 'circle',
        x: clamp(dragState.originX + deltaX, 0, 1),
        y: clamp(dragState.originY + deltaY, 0, 1),
      });
      return;
    }

    if (dragState.kind === 'rect-draft') {
      const baseDraft = draft ?? createLayerDraftBase('rectangle');
      onDraftChange?.({ ...baseDraft, shape: 'rect', points: polygonFromRect(dragState.start, point) });
      return;
    }

    if (dragState.kind === 'measure') {
      setDragState({ ...dragState, current: point });
    }
  }

  function handleMouseUp() {
    setDragState((current) => {
      if (current?.kind === 'circle-draft') {
        onStatusMessage?.('Draft circle created. Press Enter or Save New Zone.');
      }
      if (current?.kind === 'move-circle-draft') {
        onStatusMessage?.('Circle draft moved.');
      }
      if (current?.kind === 'move-sprite') {
        onStatusMessage?.('Sprite offset updated.');
      }
      if (current?.kind === 'rect-draft') {
        onStatusMessage?.('Draft rectangle created. Press Enter or Save New Zone.');
      }
      return null;
    });
  }

  function handleDoubleClick() {
    if (mode !== 'editor') {
      return;
    }
    if (selectedTool === 'polygon' && draft?.shape === 'polygon' && draft.points.length >= 3) {
      onStatusMessage?.('Polygon draft finished. Press Enter or Save New Zone.');
    }
  }

  function handleMouseLeave() {
    setHoverZone(null);
    setTooltip(null);
    setContextMenu(null);
    setCursorPoint(null);
    if (onSceneCommand) {
      onSceneCommand({ type: 'hover_point', point: null });
    } else {
      onHoverZone?.(null);
    }
    onMouseCoordinatesChange?.({ x: null, y: null });
  }

  async function handleContextMenu(event: ReactMouseEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (mode !== 'editor') {
      return;
    }

    cancelCurrentDrawingState();
    onStatusMessage?.('Editor: drawing canceled.');
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handleNativeWheel = (event: WheelEvent) => {
      if (mode !== 'editor' || !editorViewport) {
        return;
      }

      if (event.shiftKey && selectedZone?.locationSprite) {
        event.preventDefault();
        event.stopPropagation();
        const factor = event.deltaY < 0 ? 1.08 : 0.92;
        const nextScale = Math.round(Math.max(0.01, selectedZone.locationSprite.scale * factor) * 100) / 100;
        patchZoneSprite(selectedZone.id, { scale: nextScale });
        return;
      }

      const isZoomIntent = event.altKey || event.ctrlKey || event.metaKey;
      if (!isZoomIntent) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 0.9;
      zoomAt(canvasX, canvasY, editorSettings.zoom * factor);
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, [editorSettings.zoom, editorViewport, mode, selectedZone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldImage) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#120e09';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mode === 'play') {
      const camera = getPlayCamera();
      ctx.drawImage(
        worldImage,
        camera.left * worldImage.naturalWidth,
        camera.top * worldImage.naturalHeight,
        camera.width * worldImage.naturalWidth,
        camera.height * worldImage.naturalHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const kingdomBorders = resolveVisibleWorldOverlayZones(zones, 'kingdom_area');
      if (kingdomBorders.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(210, 170, 102, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);

        for (const zone of kingdomBorders) {
          if (zone.shape === 'circle') {
            const x = ((zone.x ?? 0) - camera.left) / camera.width * canvas.width;
            const y = ((zone.y ?? 0) - camera.top) / camera.height * canvas.height;
            const radius = (zone.radius ?? 0.03) * canvas.width / camera.width;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();
            continue;
          }

          const points = zone.points ?? [];
          if (points.length === 0) {
            continue;
          }
          ctx.beginPath();
          points.forEach(([px, py], index) => {
            const screenX = ((px - camera.left) / camera.width) * canvas.width;
            const screenY = ((py - camera.top) / camera.height) * canvas.height;
            if (index === 0) {
              ctx.moveTo(screenX, screenY);
            } else {
              ctx.lineTo(screenX, screenY);
            }
          });
          ctx.closePath();
          ctx.stroke();
        }

        ctx.restore();
      }

      const locationSprites = resolveLocationSpritesForViewport(
        zones,
        camera,
        { width: canvas.width, height: canvas.height },
        locationSpriteImageSizes,
        discoveredLocationIds,
        discoveredZoneIds,
      );
      for (const sprite of locationSprites) {
        const image = locationSpriteImages.get(sprite.imageSrc);
        if (!image || !image.complete || image.naturalWidth === 0) {
          continue;
        }
        ctx.drawImage(
          image,
          sprite.screenX - sprite.displayWidth * sprite.originX,
          sprite.screenY - sprite.displayHeight * sprite.originY,
          sprite.displayWidth,
          sprite.displayHeight,
        );
        if (sprite.capturedBannerSrc) {
          const banner = locationSpriteImages.get(resolveWorldImageSource(sprite.capturedBannerSrc));
          if (banner && banner.complete && banner.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.42;
            ctx.drawImage(
              banner,
              sprite.screenX - sprite.displayWidth * sprite.originX,
              sprite.screenY - sprite.displayHeight * sprite.originY,
              sprite.displayWidth,
              sprite.displayHeight,
            );
            ctx.restore();
          }
        }
      }

      for (const zone of zones) {
        const isHovered = hoverZone?.id === zone.id;
        if (!isHovered) {
          continue;
        }

        if (zone.shape === 'circle') {
          const x = ((zone.x ?? 0) - camera.left) / camera.width * canvas.width;
          const y = ((zone.y ?? 0) - camera.top) / camera.height * canvas.height;
          const radius = (zone.radius ?? 0.03) * canvas.width / camera.width;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(getResolvedZoneColor(zone), 0.16);
          ctx.fill();
          ctx.lineWidth = isHovered ? 2 : 1;
          ctx.strokeStyle = isHovered ? '#f2d28f' : '#efe5d1';
          ctx.stroke();
        }
      }

      for (const marker of playQuestMarkers) {
        if (marker.mapId !== 'worldmap-main') {
          continue;
        }
        const markerX = ((marker.x - camera.left) / camera.width) * canvas.width;
        const markerY = ((marker.y - camera.top) / camera.height) * canvas.height;
        if (markerX < -20 || markerY < -20 || markerX > canvas.width + 20 || markerY > canvas.height + 20) {
          continue;
        }

        ctx.beginPath();
        ctx.fillStyle = marker.type === 'quest_finish' ? '#7de59b' : '#f0d68a';
        ctx.moveTo(markerX, markerY - 9);
        ctx.lineTo(markerX + 8, markerY + 8);
        ctx.lineTo(markerX - 8, markerY + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#2b2016';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#f8edd8';
        ctx.font = '600 10px Georgia';
        ctx.fillText(marker.title || marker.id, markerX + 10, markerY - 6);
      }

      for (const npc of playNpcMarkers) {
        const npcX = ((npc.x - camera.left) / camera.width) * canvas.width;
        const npcY = ((npc.y - camera.top) / camera.height) * canvas.height;
        if (npcX < -20 || npcY < -20 || npcX > canvas.width + 20 || npcY > canvas.height + 20) {
          continue;
        }

        ctx.beginPath();
        ctx.fillStyle = npc.isHostile ? '#cf6760' : '#8fb9de';
        ctx.arc(npcX, npcY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#1f1712';
        ctx.stroke();

        if (npc.hasQuest) {
          ctx.beginPath();
          ctx.fillStyle = '#f1d28a';
          ctx.arc(npcX + 7, npcY - 6, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2b2016';
          ctx.stroke();
        }

        ctx.fillStyle = '#f8edd8';
        ctx.font = '600 10px Georgia';
        ctx.fillText(npc.name || npc.id, npcX + 10, npcY + 3);
      }

      if (!playerAvatarUrl) {
        const playerRadius = Math.max(5, canvas.width * 0.0075);
        const playerX = ((snapshotPlayerPosition.x - camera.left) / camera.width) * canvas.width;
        const playerY = ((snapshotPlayerPosition.y - camera.top) / camera.height) * canvas.height;
        ctx.beginPath();
        ctx.fillStyle = '#f8e8b0';
        ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd55a';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      return;
    }

    if (!editorViewport) {
      return;
    }

    ctx.drawImage(
      worldImage,
      editorViewport.panX,
      editorViewport.panY,
      worldImage.naturalWidth * editorViewport.zoom,
      worldImage.naturalHeight * editorViewport.zoom,
    );

    if (regions.length > 0) {
      for (const region of regions) {
        const regionGridSize = region.gridSize && Number.isFinite(region.gridSize)
          ? Math.max(1, Math.floor(region.gridSize))
          : REGION_GRID_SIZE;
        const cellWidth = (worldImage.naturalWidth * editorViewport.zoom) / regionGridSize;
        const cellHeight = (worldImage.naturalHeight * editorViewport.zoom) / regionGridSize;
        ctx.fillStyle = region.color ?? REGION_TYPE_COLORS[region.type] ?? 'rgba(255, 0, 0, 0.35)';
        for (const cell of region.cells) {
          const x = editorViewport.panX + cell.x * cellWidth;
          const y = editorViewport.panY + cell.y * cellHeight;
          ctx.fillRect(x, y, cellWidth, cellHeight);
        }
      }
    }

    if (editorSettings.showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,240,200,0.15)';
      ctx.lineWidth = 1;
      for (let line = 0; line <= 10; line += 1) {
        const x = (worldImage.naturalWidth * editorViewport.zoom / 10) * line + editorViewport.panX;
        const y = (worldImage.naturalHeight * editorViewport.zoom / 10) * line + editorViewport.panY;
        ctx.beginPath();
        ctx.moveTo(x, editorViewport.panY);
        ctx.lineTo(x, editorViewport.panY + worldImage.naturalHeight * editorViewport.zoom);
        ctx.moveTo(editorViewport.panX, y);
        ctx.lineTo(editorViewport.panX + worldImage.naturalWidth * editorViewport.zoom, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (editorSettings.showZones) {
      for (const zone of visibleEditorZones) {
        const zoneLayer = zone.editorLayer ?? 'zones';
        const visibility = getEffectiveLayerVisibility(zoneLayer, activeEditorLayer, layerVisibility);
        const isActiveLayer = zoneLayer === activeEditorLayer;
        const fillOpacityMultiplier = visibility === 'dimmed' ? 0.28 : isActiveLayer ? 1 : 0.58;
        const strokeOpacityMultiplier = visibility === 'dimmed' ? 0.35 : isActiveLayer ? 1 : 0.68;
        const resolvedColor = getResolvedZoneColor(zone);
        drawZoneShape(ctx, zone, editorViewport);
        ctx.fillStyle = withAlpha(resolvedColor, EDITOR_FILL_ALPHA * fillOpacityMultiplier);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = withAlpha(resolvedColor, EDITOR_STROKE_ALPHA * strokeOpacityMultiplier);
        if (visibility === 'dimmed') {
          ctx.setLineDash([4, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const editorSpriteCamera = getEditorSpriteCamera();
    if (editorSpriteCamera) {
      const draftSpriteZone: WorldMapZone | null = draft && (
        draft.shape === 'circle'
          ? draft.x !== null && draft.y !== null
          : draft.points.length >= 3
      )
        ? {
          id: draft.id || '__draft_sprite__',
          name: draft.name || 'Draft',
          type: draft.type,
          shape: draft.shape,
          x: draft.x ?? undefined,
          y: draft.y ?? undefined,
          radius: draft.radius ?? undefined,
          points: draft.points,
          description: draft.description || 'Draft zone',
          tooltip: draft.tooltip || undefined,
          dangerLevel: draft.dangerLevel,
          recommendedLevel: draft.recommendedLevel ?? undefined,
          requiredLevel: draft.requiredLevel ?? undefined,
          isDiscovered: true,
          isVisibleToPlayer: true,
          hidden: false,
          requiresDiscovery: false,
          locationSprite: draft.locationSprite,
          stateSprites: draft.stateSprites,
          currentState: draft.currentState,
          linkedLocationId: draft.linkedLocationId || undefined,
          kingdomId: draft.kingdomId || undefined,
          faction: draft.faction || undefined,
          editorLayer: draft.editorLayer,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        }
        : null;
      const editorSpriteZones = draftSpriteZone
        ? [...visibleEditorZones.filter((zone) => zone.id !== draftSpriteZone.id), draftSpriteZone]
        : visibleEditorZones;
      const editorLocationSprites = resolveLocationSpritesForViewport(
        editorSpriteZones,
        editorSpriteCamera,
        { width: canvas.width, height: canvas.height },
        locationSpriteImageSizes,
        new Set(editorSpriteZones.map((zone) => zone.linkedLocationId ?? zone.linkedLocation ?? zone.id)),
        new Set(editorSpriteZones.map((zone) => zone.id)),
      );
      for (const sprite of editorLocationSprites) {
        const image = locationSpriteImages.get(sprite.imageSrc);
        if (!image || !image.complete || image.naturalWidth === 0) {
          continue;
        }
        ctx.save();
        ctx.globalAlpha = (sprite.zone.editorLayer ?? 'zones') === activeEditorLayer ? 1 : 0.55;
        ctx.drawImage(
          image,
          sprite.screenX - sprite.displayWidth * sprite.originX,
          sprite.screenY - sprite.displayHeight * sprite.originY,
          sprite.displayWidth,
          sprite.displayHeight,
        );
        if (sprite.capturedBannerSrc) {
          const banner = locationSpriteImages.get(resolveWorldImageSource(sprite.capturedBannerSrc));
          if (banner && banner.complete && banner.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = 0.42;
            ctx.drawImage(
              banner,
              sprite.screenX - sprite.displayWidth * sprite.originX,
              sprite.screenY - sprite.displayHeight * sprite.originY,
              sprite.displayWidth,
              sprite.displayHeight,
            );
            ctx.restore();
          }
        }
        if (sprite.zone.id === selectedZoneId) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(
            sprite.screenX - sprite.displayWidth * sprite.originX,
            sprite.screenY - sprite.displayHeight * sprite.originY,
            sprite.displayWidth,
            sprite.displayHeight,
          );
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    if (hoverZone && (hoverZone.editorLayer ?? 'zones') === activeEditorLayer) {
      drawZoneShape(ctx, hoverZone, editorViewport);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f2d28f';
      ctx.stroke();
    }

    if (selectedZone && (selectedZone.editorLayer ?? 'zones') === activeEditorLayer) {
      drawZoneShape(ctx, selectedZone, editorViewport);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      drawZoneHandles(ctx, selectedZone, editorViewport);
    }

    if (draft) {
      const geometryValid = draft.shape === 'circle'
        ? draft.x !== null && draft.y !== null && (draft.radius ?? 0) > 0
        : draft.points.length >= 3;
      const color = geometryValid ? getResolvedZoneColor(draft) : INVALID_DRAFT_COLOR;
      const draftZone: WorldMapZone = {
        id: draft.id || '__draft__',
        name: draft.name || 'Draft',
        type: draft.type,
        shape: draft.shape,
        x: draft.x ?? undefined,
        y: draft.y ?? undefined,
        radius: draft.radius ?? undefined,
        points: draft.points,
        description: draft.description || 'Draft zone',
        tooltip: draft.tooltip || undefined,
        dangerLevel: draft.dangerLevel,
        recommendedLevel: draft.recommendedLevel ?? undefined,
        requiredLevel: draft.requiredLevel ?? undefined,
        isDiscovered: draft.isDiscovered,
        isVisibleToPlayer: draft.isVisibleToPlayer,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      };
      drawZoneShape(ctx, draftZone, editorViewport);
      ctx.fillStyle = withAlpha(color, EDITOR_DRAFT_ALPHA);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
      drawZoneHandles(ctx, draftZone, editorViewport);

      if (draft.shape === 'polygon' && draft.points.length > 0 && cursorPoint) {
        const last = draft.points[draft.points.length - 1];
        const lastScreen = mapNormalizedToScreen(last[0], last[1], editorViewport);
        const cursorScreen = mapNormalizedToScreen(cursorPoint[0], cursorPoint[1], editorViewport);
        ctx.beginPath();
        ctx.moveTo(lastScreen[0], lastScreen[1]);
        ctx.lineTo(cursorScreen[0], cursorScreen[1]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#fff4d4';
        ctx.stroke();
      }
    }

    if (editorSettings.showLabels) {
      ctx.fillStyle = '#fff4d4';
      ctx.font = '600 11px Georgia';
      zones.forEach((zone) => {
        const [centerX, centerY] = getZoneCenter(zone);
        const [screenX, screenY] = mapNormalizedToScreen(centerX, centerY, editorViewport);
        ctx.fillText(zone.name, screenX + 10, screenY - 10);
      });
    }

    if (dragState?.kind === 'measure') {
      const start = mapNormalizedToScreen(dragState.start[0], dragState.start[1], editorViewport);
      const current = mapNormalizedToScreen(dragState.current[0], dragState.current[1], editorViewport);
      ctx.beginPath();
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(current[0], current[1]);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 11px Georgia';
      ctx.fillText(distanceLabel(dragState.start, dragState.current), current[0] + 12, current[1] - 8);
    }

    if (cursorPoint) {
      ctx.fillStyle = '#fff4d4';
      ctx.font = '10px Consolas';
      ctx.fillText(`x:${cursorPoint[0].toFixed(4)} y:${cursorPoint[1].toFixed(4)}`, 10, canvas.height - 12);
    }
  }, [
    canvasSize.height,
    canvasSize.width,
    currentZone,
    cursorPoint,
    draft,
    dragState,
    editorSettings,
    editorViewport,
    hoverZone,
    locationSpriteImages,
    locationSpriteImageSizes,
    mode,
    playNpcMarkers,
    playQuestMarkers,
    playerAvatarUrl,
    snapshotPlayerPosition.x,
    snapshotPlayerPosition.y,
    regions,
    selectedZone,
    worldImage,
    zones,
    activeEditorLayer,
    layerVisibility,
    visibleEditorZones,
    selectableEditorZones,
    discoveredLocationIds,
    discoveredZoneIds,
  ]);

  function distanceLabel(a: [number, number], b: [number, number]): string {
    return `d=${Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(4)}`;
  }

  const playPlayerAvatarStyle = mode === 'play' && playerAvatarUrl
    ? (() => {
      const camera = getPlayCamera();
      return {
        left: `${((snapshotPlayerPosition.x - camera.left) / camera.width) * 100}%`,
        top: `${((snapshotPlayerPosition.y - camera.top) / camera.height) * 100}%`,
        backgroundImage: `url("${playerAvatarUrl}")`,
      };
    })()
    : null;

  const playCamera = mode === 'play' ? getPlayCamera() : null;

  return (
    <section className={`wm-map card ${mode === 'editor' ? 'is-editor' : ''}`}>
      <div className={`wm-map-surface ${mode === 'editor' ? 'is-editor' : ''}`} ref={surfaceRef}>
        <div className="wm-map-title">Сольеймар: Мир</div>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: mode === 'editor'
              ? (
                dragState?.kind === 'pan'
                  ? 'grabbing'
                  : selectedTool === 'pan'
                    ? 'grab'
                    : (selectedTool === 'circle' || selectedTool === 'polygon' || selectedTool === 'rectangle' || selectedTool === 'measure')
                      ? 'crosshair'
                      : 'default'
              )
              : 'pointer',
          }}
        />

        {playPlayerAvatarStyle ? (
          <span
            className="wm-play-player-avatar-marker"
            style={playPlayerAvatarStyle}
            title="Игрок"
          />
        ) : null}

        {mode === 'play' && playCamera && onWorldEntityClick ? (
          <ActiveWorldEntitiesLayer
            camera={playCamera}
            worldSnapshot={sceneSnapshot?.worldSnapshot ?? null}
            renderedEntities={sceneSnapshot?.renderedActiveEntities ?? []}
            lockedEntity={
              lockedWorldEntityId && lockedWorldEntityCoordinates
                ? {
                  id: lockedWorldEntityId,
                  coordinates: lockedWorldEntityCoordinates,
                }
                : null
            }
          />
        ) : null}

        {tooltip && (mode === 'editor' || shouldShowPlayModeHoverTooltip(tooltip.zone)) ? (
          <div className="wm-zone-tooltip" style={{ left: `${tooltip.x + 14}px`, top: `${tooltip.y + 14}px` }}>
            <strong>{tooltip.zone.name}</strong>
            <p>{tooltip.zone.description}</p>
          </div>
        ) : null}

        {contextMenu ? (
          <div className="wm-editor-context-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}>
            {contextMenu.zone ? (
              <>
                <button onClick={() => { onSelectZone?.(contextMenu.zone); setContextMenu(null); }}>Select</button>
                <button onClick={() => { onSelectZone?.(contextMenu.zone); onToolChange?.('select'); setContextMenu(null); }}>Edit</button>
                <button onClick={() => { if (contextMenu.zone) { onDuplicateZone?.(contextMenu.zone); } setContextMenu(null); }}>Duplicate</button>
                <button onClick={() => { if (contextMenu.zone) { onDeleteZone?.(contextMenu.zone.id); } setContextMenu(null); }}>Delete</button>
                <button onClick={() => { onCopyJson?.(contextMenu.zone); setContextMenu(null); }}>Copy Zone JSON</button>
                <button onClick={() => { if (contextMenu.zone) { focusZoneInView(contextMenu.zone.id); } setContextMenu(null); }}>Focus</button>
                <button onClick={() => { if (contextMenu.zone) { onToggleZoneVisibility?.(contextMenu.zone.id); } setContextMenu(null); }}>{contextMenu.zone.isVisibleToPlayer ? 'Hide Zone' : 'Show Zone'}</button>
              </>
            ) : (
              <>
                <button onClick={() => { onToolChange?.('circle'); onSelectZone?.(null); onDraftChange?.({ ...createEmptyZoneDraft('circle'), x: contextMenu.mapPoint[0], y: contextMenu.mapPoint[1], radius: 0.03 }); setContextMenu(null); }}>Add Circle Here</button>
                <button onClick={() => { onToolChange?.('polygon'); onSelectZone?.(null); onDraftChange?.({ ...createEmptyZoneDraft('polygon'), points: [contextMenu.mapPoint] }); setContextMenu(null); }}>Start Polygon Here</button>
                <button onClick={() => { void onPasteZoneAt?.(contextMenu.mapPoint); setContextMenu(null); }}>Paste Zone Here</button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {mode === 'play' ? (
        <footer className="wm-map-legend">
          <span>Игрок: {snapshotPlayerPosition.x.toFixed(3)}, {snapshotPlayerPosition.y.toFixed(3)} | Зона: {currentZone?.name ?? 'Пустоши'} | Наведение: {hoverZone?.name ?? '-'}</span>
        </footer>
      ) : null}
    </section>
  );
});

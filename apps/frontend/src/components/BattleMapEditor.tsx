import type {
  BattleMapCellType,
  BattleMapDefinition,
  BattleMapObjectType,
  BattleMapSpawnZoneType,
  BattleMapTriggerType,
  BattleMapNpcRole,
  ExitZone,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { AdminImageField } from '../admin/AdminImageField';
import { AdminHelpTooltip } from '../admin/help/AdminHelpTooltip';
import {
  createDefaultBattleMap,
  deleteBattleMap,
  loadBattleMaps,
  loadBattleMapsFromStore,
  normalizeBattleMap,
  upsertBattleMap,
  validateBattleMap,
} from '../services/battleMaps/battleMapStorage';
import { ensureNpcsLoaded, getAllNpcs } from '../services/npcRepository';
import { imageService } from '../services/content/imageService';
import type { NpcDefinition } from '../types/npc';

const CELL_TOOL_OPTIONS: Array<{ value: BattleMapCellType | 'erase'; label: string; helpField: string }> = [
  { value: 'walkable', label: 'Walkable', helpField: 'walkable' },
  { value: 'blocked', label: 'Blocked', helpField: 'blocked' },
  { value: 'difficult', label: 'Difficult', helpField: 'difficult' },
  { value: 'water', label: 'Water', helpField: 'water' },
  { value: 'lowCover', label: 'Low Cover', helpField: 'lowCover' },
  { value: 'highCover', label: 'High Cover', helpField: 'highCover' },
  { value: 'trap', label: 'Trap', helpField: 'trap' },
  { value: 'erase', label: 'Eraser', helpField: 'eraser' },
];

const SPAWN_ZONE_OPTIONS: Array<{ value: BattleMapSpawnZoneType; label: string; helpField: string }> = [
  { value: 'player', label: 'Player Spawn', helpField: 'playerSpawn' },
  { value: 'enemy', label: 'Enemy Spawn', helpField: 'enemySpawn' },
  { value: 'neutralNpc', label: 'Neutral NPC Spawn', helpField: 'neutralNpcSpawn' },
  { value: 'reinforcement', label: 'Reinforcement Spawn', helpField: 'reinforcementSpawn' },
];

const OBJECT_TYPES: BattleMapObjectType[] = ['loot', 'container', 'door', 'lever', 'resource', 'questObject', 'decoration', 'cover', 'destructible'];
const NPC_ROLES: BattleMapNpcRole[] = ['enemy', 'neutral', 'ally', 'merchant', 'questGiver', 'civilian'];
const TRIGGER_TYPES: BattleMapTriggerType[] = ['quest', 'dialogue', 'ambush', 'trap', 'scene', 'exit', 'custom'];
const MIN_BOARD_ZOOM = 0.4;
const MAX_BOARD_ZOOM = 4;

type EditorLayer = 'cells' | 'spawns' | 'exitZones' | 'objects' | 'traps' | 'npcs' | 'triggers';
type CellTool = BattleMapCellType | 'erase';
type ExitZoneTeam = 'player' | 'enemy' | 'any';

interface BattleMapEditorProps {
  selectedMapId?: string | null;
  onSelectedMapIdChange?: (mapId: string) => void;
  onStatusMessage?: (text: string) => void;
}

function getCellKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function getCellType(map: BattleMapDefinition, x: number, y: number): BattleMapCellType {
  return map.cells.find((cell) => cell.x === x && cell.y === y)?.type ?? 'walkable';
}

function getCellStyle(x: number, y: number, cellSizePx: number, gridOffsetX: number, gridOffsetY: number): CSSProperties {
  return {
    left: `${gridOffsetX + x * cellSizePx}px`,
    top: `${gridOffsetY + y * cellSizePx}px`,
    width: `${cellSizePx}px`,
    height: `${cellSizePx}px`,
  };
}

function ensureSpawnZone(map: BattleMapDefinition, type: BattleMapSpawnZoneType) {
  const existing = map.spawnZones.find((zone) => zone.type === type);
  if (existing) {
    return existing;
  }
  const next = {
    id: `spawn-${type}`,
    type,
    name: `${type} spawn`,
    cells: [] as Array<{ x: number; y: number }>,
  };
  map.spawnZones = [...map.spawnZones, next];
  return next;
}

function nextExitZoneId(existing: ExitZone[] | undefined): string {
  const zones = Array.isArray(existing) ? existing : [];
  let index = zones.length + 1;
  while (zones.some((zone) => zone.id === `exit_zone_${String(index).padStart(3, '0')}`)) {
    index += 1;
  }
  return `exit_zone_${String(index).padStart(3, '0')}`;
}

function ensureExitZone(map: BattleMapDefinition, zoneId?: string | null): ExitZone {
  const zones = Array.isArray(map.exitZones) ? map.exitZones : [];
  const found = zoneId ? zones.find((zone) => zone.id === zoneId) : undefined;
  if (found) {
    return found;
  }
  const created: ExitZone = {
    id: nextExitZoneId(zones),
    cells: [],
    team: 'player',
    enabledForArena: false,
  };
  map.exitZones = [...zones, created];
  return created;
}

function replaceCellType(map: BattleMapDefinition, x: number, y: number, type: BattleMapCellType): BattleMapDefinition {
  const otherCells = map.cells.filter((cell) => !(cell.x === x && cell.y === y));
  return {
    ...map,
    cells: [...otherCells, { x, y, type }],
    updatedAt: Date.now(),
  };
}

function duplicateMapDefinition(map: BattleMapDefinition): BattleMapDefinition {
  return normalizeBattleMap({
    ...map,
    id: `${map.id}_copy_${Date.now()}`,
    name: `${map.name} Copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

function isDirectImageSource(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://');
}

export function BattleMapEditor({ selectedMapId, onSelectedMapIdChange, onStatusMessage }: BattleMapEditorProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const lastPaintedCellRef = useRef<string | null>(null);
  const [maps, setMaps] = useState<BattleMapDefinition[]>(() => loadBattleMaps());
  const [currentMapId, setCurrentMapId] = useState<string>(selectedMapId ?? loadBattleMaps()[0]?.id ?? createDefaultBattleMap().id);
  const [draft, setDraft] = useState<BattleMapDefinition>(() => normalizeBattleMap(loadBattleMaps()[0] ?? createDefaultBattleMap()));
  const [layer, setLayer] = useState<EditorLayer>('cells');
  const [cellTool, setCellTool] = useState<CellTool>('blocked');
  const [spawnTool, setSpawnTool] = useState<BattleMapSpawnZoneType>('player');
  const [isPainting, setIsPainting] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null);
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string | null>(null);
  const [selectedExitZoneId, setSelectedExitZoneId] = useState<string | null>(null);
  const [selectedNpcSourceId, setSelectedNpcSourceId] = useState('random');
  const [adminNpcs, setAdminNpcs] = useState<NpcDefinition[]>([]);
  const [undoStack, setUndoStack] = useState<BattleMapDefinition[]>([]);
  const [redoStack, setRedoStack] = useState<BattleMapDefinition[]>([]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPanX, setCanvasPanX] = useState(0);
  const [canvasPanY, setCanvasPanY] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'paint' | 'pan'>('paint');
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [resolvedMapImageUrl, setResolvedMapImageUrl] = useState<string>('/map/battle-map_arena.png');

  useEffect(() => {
    let disposed = false;
    loadBattleMapsFromStore()
      .then((loadedMaps) => {
        if (disposed) {
          return;
        }
        const nextMaps = loadedMaps.length > 0 ? loadedMaps : [createDefaultBattleMap()];
        setMaps(nextMaps);
        const nextId = selectedMapId && nextMaps.some((map) => map.id === selectedMapId)
          ? selectedMapId
          : nextMaps[0]?.id ?? createDefaultBattleMap().id;
        setCurrentMapId(nextId);
        setDraft(normalizeBattleMap(nextMaps.find((map) => map.id === nextId) ?? nextMaps[0] ?? createDefaultBattleMap()));
      })
      .catch((error) => onStatusMessage?.(`Battle maps database load failed: ${(error as Error).message}`));
    return () => {
      disposed = true;
    };
  }, [onStatusMessage, selectedMapId]);

  useEffect(() => {
    let disposed = false;
    ensureNpcsLoaded()
      .then(() => {
        if (!disposed) {
          setAdminNpcs(getAllNpcs().sort((left, right) => left.name.localeCompare(right.name)));
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedMapId) {
      return;
    }
    const map = maps.find((entry) => entry.id === selectedMapId);
    if (!map) {
      return;
    }
    setCurrentMapId(map.id);
    setDraft(normalizeBattleMap(map));
  }, [maps, selectedMapId]);

  useEffect(() => {
    const current = maps.find((map) => map.id === currentMapId) ?? maps[0] ?? createDefaultBattleMap();
    setDraft(normalizeBattleMap(current));
  }, [currentMapId, maps]);

  useEffect(() => {
    const imageUrl = resolvedMapImageUrl || '/map/battle-map_arena.png';
    const image = new Image();
    image.onload = () => {
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      setImageSize(null);
    };
    image.src = imageUrl;
  }, [resolvedMapImageUrl]);

  useEffect(() => {
    const rawValue = draft.imageUrl?.trim();
    if (!rawValue) {
      setResolvedMapImageUrl('/map/battle-map_arena.png');
      return;
    }

    if (isDirectImageSource(rawValue)) {
      setResolvedMapImageUrl(rawValue);
      return;
    }

    let disposed = false;
    void imageService.get(rawValue)
      .then((entry) => {
        if (!disposed) {
          setResolvedMapImageUrl(entry?.dataUrl ?? '/map/battle-map_arena.png');
        }
      })
      .catch(() => {
        if (!disposed) {
          setResolvedMapImageUrl('/map/battle-map_arena.png');
        }
      });

    return () => {
      disposed = true;
    };
  }, [draft.imageUrl]);

  const validationIssues = useMemo(() => validateBattleMap(draft), [draft]);
  const blockingObjectCells = useMemo(() => {
    const set = new Set<string>();
    for (const object of draft.objects) {
      const width = object.width ?? 1;
      const height = object.height ?? 1;
      for (let offsetX = 0; offsetX < width; offsetX += 1) {
        for (let offsetY = 0; offsetY < height; offsetY += 1) {
          set.add(getCellKey(object.x + offsetX, object.y + offsetY));
        }
      }
    }
    return set;
  }, [draft.objects]);

  const selectedObject = draft.objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedTrap = draft.traps.find((trap) => trap.id === selectedTrapId) ?? null;
  const selectedNpc = draft.npcs.find((npc) => npc.id === selectedNpcId) ?? null;
  const selectedTrigger = draft.triggers.find((trigger) => trigger.id === selectedTriggerId) ?? null;
  const selectedExitZone = (draft.exitZones ?? []).find((zone) => zone.id === selectedExitZoneId) ?? null;

  const commitDraft = (updater: (current: BattleMapDefinition) => BattleMapDefinition, trackHistory = false) => {
    setDraft((current) => {
      if (trackHistory) {
        setUndoStack((stack) => [...stack.slice(-39), current]);
        setRedoStack([]);
      }
      return normalizeBattleMap(updater(current));
    });
  };

  const handleSave = () => {
    const normalized = normalizeBattleMap({ ...draft, updatedAt: Date.now() });
    upsertBattleMap(normalized);
    const nextMaps = loadBattleMaps();
    setMaps(nextMaps);
    setCurrentMapId(normalized.id);
    onSelectedMapIdChange?.(normalized.id);
    const hardErrors = validateBattleMap(normalized).filter((entry) => !entry.startsWith('Warning:'));
    onStatusMessage?.(hardErrors.length > 0 ? `Карта сохранена с ${hardErrors.length} ошибками валидации.` : `Карта сохранена: ${normalized.name}`);
  };

  const handleNew = () => {
    const fresh = normalizeBattleMap({
      ...createDefaultBattleMap(),
      id: `battlemap_${Date.now()}`,
      name: 'New Tactical Map',
      description: '',
      tags: [],
      linkedLocationId: '',
      linkedQuestId: '',
      linkedZoneId: '',
    });
    setDraft(fresh);
    setCurrentMapId(fresh.id);
    onSelectedMapIdChange?.(fresh.id);
    onStatusMessage?.('Создан новый черновик tactical map.');
  };

  const handleDuplicate = () => {
    const copy = duplicateMapDefinition(draft);
    upsertBattleMap(copy);
    const nextMaps = loadBattleMaps();
    setMaps(nextMaps);
    setCurrentMapId(copy.id);
    onSelectedMapIdChange?.(copy.id);
    onStatusMessage?.(`Карта дублирована: ${copy.name}`);
  };

  const handleDelete = () => {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    deleteBattleMap(draft.id);
    const nextMaps = loadBattleMaps();
    setMaps(nextMaps);
    const fallback = nextMaps[0] ?? createDefaultBattleMap();
    setCurrentMapId(fallback.id);
    onSelectedMapIdChange?.(fallback.id);
    onStatusMessage?.(`Карта удалена: ${draft.name}`);
  };

  const updateIdentityField = (field: keyof BattleMapDefinition, value: string | number | string[] | boolean) => {
    commitDraft((current) => ({ ...current, [field]: value, updatedAt: Date.now() }));
  };

  const updateCellAt = (x: number, y: number) => {
    if (layer === 'cells') {
      commitDraft((current) => replaceCellType(current, x, y, cellTool === 'erase' ? 'walkable' : cellTool), true);
      return;
    }

    if (layer === 'spawns') {
      commitDraft((current) => {
        const next = normalizeBattleMap(current);
        const zone = ensureSpawnZone(next, spawnTool);
        const key = getCellKey(x, y);
        const nextZones = next.spawnZones.map((entry) => ({
          ...entry,
          cells: entry.type === spawnTool
            ? entry.cells.some((cell) => getCellKey(cell.x, cell.y) === key)
              ? entry.cells.filter((cell) => getCellKey(cell.x, cell.y) !== key)
              : [...entry.cells, { x, y }]
            : entry.cells.filter((cell) => getCellKey(cell.x, cell.y) !== key),
        }));
        if (!nextZones.some((entry) => entry.id === zone.id)) {
          nextZones.push(zone);
        }
        return { ...next, spawnZones: nextZones, updatedAt: Date.now() };
      }, true);
      return;
    }

    if (layer === 'exitZones') {
      commitDraft((current) => {
        const next = normalizeBattleMap(current);
        const zone = ensureExitZone(next, selectedExitZoneId);
        const key = getCellKey(x, y);
        const zones = (next.exitZones ?? []).map((entry) => {
          if (entry.id !== zone.id) {
            return entry;
          }
          const cells = entry.cells.some((cell) => getCellKey(cell.x, cell.y) === key)
            ? entry.cells.filter((cell) => getCellKey(cell.x, cell.y) !== key)
            : [...entry.cells, { x, y }];
          return { ...entry, cells };
        });
        return { ...next, exitZones: zones, updatedAt: Date.now() };
      }, true);
      return;
    }

    if (layer === 'objects') {
      const objectId = `object-${Date.now()}`;
      commitDraft((current) => ({
        ...current,
        objects: [...current.objects, {
          id: objectId,
          type: 'decoration',
          name: 'New Object',
          x,
          y,
          width: 1,
          height: 1,
          blocksMovement: false,
          blocksLineOfSight: false,
          interactable: false,
        }],
        updatedAt: Date.now(),
      }), true);
      setSelectedObjectId(objectId);
      onStatusMessage?.(`Object placed at ${x}:${y}.`);
      return;
    }

    if (layer === 'traps') {
      const trapId = `trap-${Date.now()}`;
      commitDraft((current) => ({
        ...current,
        traps: [...current.traps, {
          id: trapId,
          name: 'New Trap',
          x,
          y,
          damage: 3,
          staminaCost: 5,
          triggerOnce: true,
          revealedByDefault: true,
        }],
        updatedAt: Date.now(),
      }), true);
      setSelectedTrapId(trapId);
      return;
    }

    if (layer === 'npcs') {
      const npcId = `npc-${Date.now()}`;
      const selectedAdminNpc = selectedNpcSourceId === 'random' ? null : adminNpcs.find((npc) => npc.id === selectedNpcSourceId) ?? null;
      commitDraft((current) => ({
        ...current,
        npcs: [...current.npcs, {
          id: npcId,
          npcId: selectedAdminNpc?.id ?? '',
          name: selectedAdminNpc?.name ?? 'Random Arena Enemy',
          role: selectedAdminNpc ? 'neutral' : 'enemy',
          x,
          y,
          startsCombat: false,
          ...(selectedAdminNpc ? {} : { isGenerated: true }),
        }],
        updatedAt: Date.now(),
      }), true);
      setSelectedNpcId(npcId);
      onStatusMessage?.(`NPC placed at ${x}:${y}.`);
      return;
    }

    const triggerId = `trigger-${Date.now()}`;
    commitDraft((current) => ({
      ...current,
      triggers: [...current.triggers, {
        id: triggerId,
        type: 'custom',
        name: 'New Trigger',
        cells: [{ x, y }],
        enabled: true,
      }],
      updatedAt: Date.now(),
    }), true);
    setSelectedTriggerId(triggerId);
    onStatusMessage?.(`Trigger placed at ${x}:${y}.`);
  };

  const cellSizePx = draft.cellSizePx ?? 64;
  const gridOffsetX = draft.gridOffsetX ?? 0;
  const gridOffsetY = draft.gridOffsetY ?? 0;
  const logicalColumns = draft.logicalColumns ?? draft.width;
  const logicalRows = draft.logicalRows ?? draft.height;
  const gridPixelWidth = logicalColumns * cellSizePx;
  const gridPixelHeight = logicalRows * cellSizePx;
  const mapPixelWidth = imageSize?.width ?? Math.max(gridOffsetX + gridPixelWidth, 1);
  const mapPixelHeight = imageSize?.height ?? Math.max(gridOffsetY + gridPixelHeight, 1);

  const fitCanvasToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const nextZoom = Math.max(MIN_BOARD_ZOOM, Math.min(MAX_BOARD_ZOOM, Math.min(rect.width / mapPixelWidth, rect.height / mapPixelHeight)));
    const nextPanX = (rect.width - mapPixelWidth * nextZoom) / 2;
    const nextPanY = (rect.height - mapPixelHeight * nextZoom) / 2;

    setCanvasZoom(nextZoom);
    setCanvasPanX(nextPanX);
    setCanvasPanY(nextPanY);
  }, [mapPixelHeight, mapPixelWidth]);

  useEffect(() => {
    fitCanvasToViewport();
  }, [fitCanvasToViewport, currentMapId]);

  function resolveCellFromPointer(clientX: number, clientY: number): { x: number; y: number } | null {
    const viewport = viewportRef.current;
    if (!viewport) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    const actualX = (mouseX - canvasPanX) / canvasZoom;
    const actualY = (mouseY - canvasPanY) / canvasZoom;
    const translatedX = actualX - gridOffsetX;
    const translatedY = actualY - gridOffsetY;
    const cellX = Math.floor(translatedX / cellSizePx);
    const cellY = Math.floor(translatedY / cellSizePx);

    if (cellX < 0 || cellY < 0 || cellX >= logicalColumns || cellY >= logicalRows) {
      return null;
    }

    return { x: cellX, y: cellY };
  }

  const handleLogicalColumnsChange = (value: number) => {
    const next = Math.max(6, value || 12);
    commitDraft((current) => ({
      ...current,
      width: next,
      logicalColumns: next,
      viewportWidth: Math.min(current.viewportWidth, next),
      updatedAt: Date.now(),
    }));
  };

  const handleLogicalRowsChange = (value: number) => {
    const next = Math.max(6, value || 12);
    commitDraft((current) => ({
      ...current,
      height: next,
      logicalRows: next,
      viewportHeight: Math.min(current.viewportHeight, next),
      updatedAt: Date.now(),
    }));
  };

  function applyPaintAtPointer(clientX: number, clientY: number) {
    const cell = resolveCellFromPointer(clientX, clientY);
    if (!cell) {
      return;
    }

    const key = getCellKey(cell.x, cell.y);
    if (lastPaintedCellRef.current === key) {
      return;
    }

    lastPaintedCellRef.current = key;
    updateCellAt(cell.x, cell.y);
  }

  function handleCanvasMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button === 1 || interactionMode === 'pan') {
      event.preventDefault();
      setPanDrag({ startX: event.clientX, startY: event.clientY, originX: canvasPanX, originY: canvasPanY });
      return;
    }

    if (event.button !== 0) {
      return;
    }

    setIsPainting(true);
    applyPaintAtPointer(event.clientX, event.clientY);
  }

  function handleCanvasMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (panDrag) {
      setCanvasPanX(panDrag.originX + (event.clientX - panDrag.startX));
      setCanvasPanY(panDrag.originY + (event.clientY - panDrag.startY));
      return;
    }

    if (!isPainting || interactionMode === 'pan') {
      return;
    }

    applyPaintAtPointer(event.clientX, event.clientY);
  }

  function handleCanvasMouseUp() {
    setPanDrag(null);
    setIsPainting(false);
    lastPaintedCellRef.current = null;
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.altKey) {
      return;
    }

    event.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const nextZoom = Math.max(MIN_BOARD_ZOOM, Math.min(MAX_BOARD_ZOOM, canvasZoom * zoomFactor));
    const mapX = (mouseX - canvasPanX) / canvasZoom;
    const mapY = (mouseY - canvasPanY) / canvasZoom;
    const nextPanX = mouseX - mapX * nextZoom;
    const nextPanY = mouseY - mapY * nextZoom;

    setCanvasZoom(nextZoom);
    setCanvasPanX(nextPanX);
    setCanvasPanY(nextPanY);
  }

  function deleteSelectedObject(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      objects: current.objects.filter((object) => object.id !== id),
      updatedAt: Date.now(),
    }), true);
    if (selectedObjectId === id) setSelectedObjectId(null);
  }

  function deleteSelectedNpc(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      npcs: current.npcs.filter((npc) => npc.id !== id),
      updatedAt: Date.now(),
    }), true);
    if (selectedNpcId === id) setSelectedNpcId(null);
  }

  function deleteSelectedTrap(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      traps: current.traps.filter((trap) => trap.id !== id),
      updatedAt: Date.now(),
    }), true);
    if (selectedTrapId === id) setSelectedTrapId(null);
  }

  function deleteSelectedTrigger(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      triggers: current.triggers.filter((trigger) => trigger.id !== id),
      updatedAt: Date.now(),
    }), true);
    if (selectedTriggerId === id) setSelectedTriggerId(null);
  }

  function handleUndo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) {
      return;
    }
    setRedoStack((stack) => [...stack.slice(-39), draft]);
    setUndoStack((stack) => stack.slice(0, -1));
    setDraft(normalizeBattleMap(previous));
  }

  function handleRedo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) {
      return;
    }
    setUndoStack((stack) => [...stack.slice(-39), draft]);
    setRedoStack((stack) => stack.slice(0, -1));
    setDraft(normalizeBattleMap(next));
  }

  return (
    <section className="battle-map-editor battle-map-editor-page">
      <div className="battle-map-editor-head">
        <div>
          <h3>Tactical Battle Map Editor</h3>
          <p className="muted">Reusable tactical scene maps for arena, quests, ambushes, dungeons, NPC encounters and scripted battles.</p>
        </div>
        <div className="battle-map-editor-actions">
          <button type="button" className={layer === 'cells' && cellTool === 'walkable' ? 'is-active' : ''} onClick={() => { setLayer('cells'); setCellTool('walkable'); setInteractionMode('paint'); }}>Paint Walkable</button>
          <button type="button" className={layer === 'cells' && cellTool === 'blocked' ? 'is-active' : ''} onClick={() => { setLayer('cells'); setCellTool('blocked'); setInteractionMode('paint'); }}>Paint Blocked</button>
          <button type="button" className={layer === 'cells' && cellTool === 'trap' ? 'is-active' : ''} onClick={() => { setLayer('cells'); setCellTool('trap'); setInteractionMode('paint'); }}>Paint Trap</button>
          <button type="button" className={layer === 'spawns' && spawnTool === 'player' ? 'is-active' : ''} onClick={() => { setLayer('spawns'); setSpawnTool('player'); setInteractionMode('paint'); }}>Player Spawn</button>
          <button type="button" className={layer === 'spawns' && spawnTool === 'enemy' ? 'is-active' : ''} onClick={() => { setLayer('spawns'); setSpawnTool('enemy'); setInteractionMode('paint'); }}>Enemy Spawn</button>
          <button type="button" className={layer === 'objects' ? 'is-active' : ''} onClick={() => { setLayer('objects'); setInteractionMode('paint'); onStatusMessage?.('Object tool selected. Click a map cell to place object.'); }}>Object Tool</button>
          <button type="button" className={layer === 'npcs' ? 'is-active' : ''} onClick={() => { setLayer('npcs'); setInteractionMode('paint'); onStatusMessage?.('NPC tool selected. Click a map cell to place NPC.'); }}>NPC Tool</button>
          <button type="button" className={layer === 'triggers' ? 'is-active' : ''} onClick={() => { setLayer('triggers'); setInteractionMode('paint'); onStatusMessage?.('Trigger tool selected. Click a map cell to place trigger.'); }}>Trigger Tool</button>
          <button type="button" className={interactionMode === 'pan' ? 'is-active' : ''} onClick={() => setInteractionMode((mode) => mode === 'pan' ? 'paint' : 'pan')}>Pan</button>
          <button type="button" onClick={fitCanvasToViewport}>Fit</button>
          <button type="button" onClick={handleUndo} disabled={undoStack.length === 0}>Undo</button>
          <button type="button" onClick={handleRedo} disabled={redoStack.length === 0}>Redo</button>
          <button type="button" onClick={handleSave}>Save</button>
        </div>
      </div>

      <div className="battle-map-editor-main">
        <section className="battle-map-editor-section battle-map-editor-canvas-section">
        <div
          ref={viewportRef}
          className="battle-map-editor-canvas-viewport"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleCanvasWheel}
        >
          <div
            className="battle-map-editor-canvas-content"
            style={{
              width: `${mapPixelWidth}px`,
              height: `${mapPixelHeight}px`,
              transform: `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`,
              transformOrigin: '0 0',
            }}
          >
            <div
              className="battle-map-editor-image-layer"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(9, 8, 7, 0.28), rgba(8, 6, 5, 0.4)), url('${resolvedMapImageUrl || '/map/battle-map_arena.png'}')` }}
            />
            {draft.showEditorGrid ? (
              <div
                className="battle-map-editor-grid-overlay"
                style={{
                  left: `${gridOffsetX}px`,
                  top: `${gridOffsetY}px`,
                  width: `${gridPixelWidth}px`,
                  height: `${gridPixelHeight}px`,
                  backgroundSize: `${cellSizePx}px ${cellSizePx}px`,
                  opacity: draft.gridOpacity ?? 0.12,
                }}
              />
            ) : null}
            <div className="battle-map-editor-board">
              {Array.from({ length: logicalColumns * logicalRows }, (_, index) => {
                const x = index % logicalColumns;
                const y = Math.floor(index / logicalColumns);
                const cellType = getCellType(draft, x, y);
                const spawnTypes = draft.spawnZones.filter((zone) => zone.cells.some((cell) => cell.x === x && cell.y === y)).map((zone) => zone.type);
                const hasObject = draft.objects.some((object) => object.x === x && object.y === y);
                const hasTrap = draft.traps.some((trap) => trap.x === x && trap.y === y);
                const hasNpc = draft.npcs.some((npc) => npc.x === x && npc.y === y);
                const hasTrigger = draft.triggers.some((trigger) => trigger.cells.some((cell) => cell.x === x && cell.y === y));
                const hasExitZone = (draft.exitZones ?? []).some((zone) => zone.cells.some((cell) => cell.x === x && cell.y === y));
                return (
                  <div
                    key={`battle-map-cell-${x}-${y}`}
                    className={`battle-map-editor-tile is-${cellType} ${spawnTypes.map((type) => `has-spawn-${type}`).join(' ')} ${hasObject ? 'has-object' : ''} ${hasTrap ? 'has-trap' : ''} ${hasNpc ? 'has-npc' : ''} ${hasTrigger ? 'has-trigger' : ''} ${hasExitZone ? 'has-exit-zone' : ''}`}
                    title={`${x}:${y} ${cellType}`}
                    style={{
                      left: `${gridOffsetX + x * cellSizePx}px`,
                      top: `${gridOffsetY + y * cellSizePx}px`,
                      width: `${cellSizePx}px`,
                      height: `${cellSizePx}px`,
                      ...(hasExitZone ? { outline: '2px solid rgba(0, 200, 255, 0.7)', outlineOffset: '-2px', boxShadow: 'inset 0 0 0 9999px rgba(0, 200, 255, 0.08)' } : {}),
                    }}
                  >
                    <span className="battle-map-editor-tile-markers">
                      {spawnTypes.includes('player') ? 'P' : ''}
                      {spawnTypes.includes('enemy') ? 'E' : ''}
                      {hasObject ? 'O' : ''}
                      {hasTrap ? 'T' : ''}
                      {hasNpc ? 'N' : ''}
                      {hasTrigger ? 'G' : ''}
                      {hasExitZone ? 'X' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            {draft.objects.map((object) => (
              <button
                key={object.id}
                type="button"
                className={`battle-map-editor-marker battle-map-editor-marker-object ${selectedObjectId === object.id ? 'is-selected' : ''}`}
                style={getCellStyle(object.x, object.y, cellSizePx, gridOffsetX, gridOffsetY)}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setSelectedObjectId(object.id);
                }}
                title={`${object.name} (${object.x}:${object.y})`}
              >
                O
              </button>
            ))}
            {draft.npcs.map((npc) => (
              <button
                key={npc.id}
                type="button"
                className={`battle-map-editor-marker battle-map-editor-marker-npc ${selectedNpcId === npc.id ? 'is-selected' : ''}`}
                style={getCellStyle(npc.x, npc.y, cellSizePx, gridOffsetX, gridOffsetY)}
                onMouseDown={(event) => {
                  event.stopPropagation();
                  setSelectedNpcId(npc.id);
                }}
                title={`${npc.name} (${npc.x}:${npc.y})`}
              >
                N
              </button>
            ))}
            {draft.triggers.map((trigger) => {
              const cell = trigger.cells[0];
              if (!cell) return null;

              return (
                <button
                  key={trigger.id}
                  type="button"
                  className={`battle-map-editor-marker battle-map-editor-marker-trigger ${selectedTriggerId === trigger.id ? 'is-selected' : ''}`}
                  style={getCellStyle(cell.x, cell.y, cellSizePx, gridOffsetX, gridOffsetY)}
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setSelectedTriggerId(trigger.id);
                  }}
                  title={`${trigger.name} (${cell.x}:${cell.y})`}
                >
                  T
                </button>
              );
            })}
          </div>
        </div>
        </section>

        <div className="battle-map-editor-bottom-panels">
          <section className="battle-map-editor-section battle-map-editor-left-panel">
            <div className="battle-map-editor-section-head">
              <h4>Tools</h4>
            </div>
            <div className="row">
              <label>Map</label>
              <select value={currentMapId} onChange={(event) => {
                const nextId = event.target.value;
                setCurrentMapId(nextId);
                onSelectedMapIdChange?.(nextId);
              }}>
                {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
              </select>
            </div>
            <div className="battle-map-editor-actions">
              <button type="button" onClick={handleNew}>New</button>
              <button type="button" onClick={handleDuplicate}>Duplicate</button>
              <button type="button" onClick={handleDelete}>Delete</button>
            </div>
            <div className="battle-map-editor-section-head">
              <h4>Layers</h4>
            </div>
            <div className="battle-map-editor-layer-tabs">
              {(['cells', 'spawns', 'exitZones', 'objects', 'traps', 'npcs', 'triggers'] as EditorLayer[]).map((entry) => (
                <button key={entry} type="button" className={layer === entry ? 'is-active' : ''} onClick={() => setLayer(entry)}>
                  {entry}
                </button>
              ))}
            </div>
            {layer === 'cells' ? (
              <div className="battle-map-editor-toolbar">
                {CELL_TOOL_OPTIONS.map((option) => (
                  <button key={option.value} type="button" className={cellTool === option.value ? 'is-active' : ''} onClick={() => setCellTool(option.value)}>
                    {option.label} <AdminHelpTooltip section="battleMaps" field={option.helpField} />
                  </button>
                ))}
              </div>
            ) : null}
            {layer === 'spawns' ? (
              <div className="battle-map-editor-toolbar">
                {SPAWN_ZONE_OPTIONS.map((option) => (
                  <button key={option.value} type="button" className={spawnTool === option.value ? 'is-active' : ''} onClick={() => setSpawnTool(option.value)}>
                    {option.label} <AdminHelpTooltip section="battleMaps" field={option.helpField} />
                  </button>
                ))}
              </div>
            ) : null}
            {layer === 'exitZones' ? (
              <div className="battle-map-editor-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    const newId = nextExitZoneId(draft.exitZones);
                    commitDraft((current) => {
                      const next = normalizeBattleMap(current);
                      const zones = next.exitZones ?? [];
                      return {
                        ...next,
                        exitZones: [...zones, { id: newId, cells: [], team: 'player', enabledForArena: false }],
                        updatedAt: Date.now(),
                      };
                    }, true);
                    setSelectedExitZoneId(newId);
                    onStatusMessage?.('Зона выхода добавлена. Кликните по клеткам, чтобы отметить exit_zone.');
                  }}
                >
                  + Зона выхода
                </button>
                <div className="row">
                  <label>Зона</label>
                  <select value={selectedExitZoneId ?? ''} onChange={(event) => setSelectedExitZoneId(event.target.value || null)}>
                    <option value="">(нет)</option>
                    {(draft.exitZones ?? []).map((zone) => (
                      <option key={zone.id} value={zone.id}>{zone.id}</option>
                    ))}
                  </select>
                </div>
                {selectedExitZone ? (
                  <>
                    <div className="row">
                      <label>Team</label>
                      <select
                        value={(selectedExitZone.team ?? 'player') as ExitZoneTeam}
                        onChange={(event) => {
                          const team: ExitZoneTeam = event.target.value === 'enemy' || event.target.value === 'any'
                            ? event.target.value
                            : 'player';
                          commitDraft((current) => {
                            const next = normalizeBattleMap(current);
                            const zones = (next.exitZones ?? []).map((zone) => zone.id === selectedExitZone.id ? { ...zone, team, enabledForArena: false as const } : zone);
                            return { ...next, exitZones: zones, updatedAt: Date.now() };
                          }, true);
                        }}
                      >
                        <option value="player">player</option>
                        <option value="enemy">enemy</option>
                        <option value="any">any</option>
                      </select>
                    </div>
                    <div className="row">
                      <label>Info</label>
                      <span title="Зона выхода из боя. Работает только вне арены.">enabledForArena=false</span>
                    </div>
                    <div className="row">
                      <label>Клетки</label>
                      <span>{selectedExitZone.cells.length}</span>
                    </div>
                  </>
                ) : (
                  <p title="Зона выхода из боя. Работает только вне арены.">Выберите зону и рисуйте клетки exit_zone.</p>
                )}
              </div>
            ) : null}
            {layer === 'npcs' ? (
              <div className="row">
                <label>NPC</label>
                <select value={selectedNpcSourceId} onChange={(event) => setSelectedNpcSourceId(event.target.value)}>
                  <option value="random">Random Arena Enemy</option>
                  {adminNpcs.map((npc) => (
                    <option key={npc.id} value={npc.id}>{npc.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </section>

          <div className="battle-map-editor-inspector-stack">
            <section className="battle-map-editor-section battle-map-editor-identity-panel battle-map-editor-side-section">
              <div className="battle-map-editor-section-head">
                <h4>Map Identity</h4>
              </div>
              <div className="row">
                <label>ID <AdminHelpTooltip section="battleMaps" field="id" /></label>
                <input value={draft.id} onChange={(event) => updateIdentityField('id', event.target.value)} />
              </div>
              <div className="row">
                <label>Name <AdminHelpTooltip section="battleMaps" field="name" /></label>
                <input value={draft.name} onChange={(event) => updateIdentityField('name', event.target.value)} />
              </div>
              <div className="row">
                <label>Description <AdminHelpTooltip section="battleMaps" field="description" /></label>
                <textarea value={draft.description ?? ''} onChange={(event) => updateIdentityField('description', event.target.value)} rows={3} />
              </div>
              <div className="row">
                <label>Tags <AdminHelpTooltip section="battleMaps" field="tags" /></label>
                <input value={(draft.tags ?? []).join(', ')} onChange={(event) => updateIdentityField('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} placeholder="arena, dungeon, quest" />
              </div>
              <div className="row">
                <label>Background image URL <AdminHelpTooltip section="battleMaps" field="backgroundImageUrl" /></label>
                <input value={draft.imageUrl ?? ''} onChange={(event) => updateIdentityField('imageUrl', event.target.value)} />
              </div>
              <div className="muted">Загрузка фона <AdminHelpTooltip section="battleMaps" field="imageUpload" /></div>
              <AdminImageField
                value={draft.imageUrl}
                onChange={(nextValue) => updateIdentityField('imageUrl', nextValue)}
                onStatus={(text) => onStatusMessage?.(text)}
                presetId="battle-map-background"
                suggestedName={`${draft.id || 'battlemap'}-background`}
                label="Загрузка фона карты"
                hint="Загружает картинку в content-хранилище и подставляет её ID в карту, чтобы фон сохранялся и работал на другом устройстве."
              />
              <div className="battle-map-editor-dimensions">
                <div className="row">
                  <label>Width <AdminHelpTooltip section="battleMaps" field="width" /></label>
                  <input type="number" min={12} value={draft.width} onChange={(event) => handleLogicalColumnsChange(Number(event.target.value) || 12)} />
                </div>
                <div className="row">
                  <label>Height <AdminHelpTooltip section="battleMaps" field="height" /></label>
                  <input type="number" min={12} value={draft.height} onChange={(event) => handleLogicalRowsChange(Number(event.target.value) || 12)} />
                </div>
                <div className="row">
                  <label>Viewport width <AdminHelpTooltip section="battleMaps" field="viewportWidth" /></label>
                  <input type="number" min={6} max={draft.width} value={draft.viewportWidth} onChange={(event) => updateIdentityField('viewportWidth', Number(event.target.value) || 12)} />
                </div>
                <div className="row">
                  <label>Viewport height <AdminHelpTooltip section="battleMaps" field="viewportHeight" /></label>
                  <input type="number" min={6} max={draft.height} value={draft.viewportHeight} onChange={(event) => updateIdentityField('viewportHeight', Number(event.target.value) || 12)} />
                </div>
              </div>
              <div className="battle-map-editor-dimensions">
                <div className="row">
                  <label>Cell size px <AdminHelpTooltip section="battleMaps" field="cellSizePx" /></label>
                  <input type="number" min={32} max={160} value={draft.cellSizePx ?? 64} onChange={(event) => updateIdentityField('cellSizePx', Number(event.target.value) || 64)} />
                </div>
                <div className="row">
                  <label>Grid offset X <AdminHelpTooltip section="battleMaps" field="gridOffsetX" /></label>
                  <input type="number" value={draft.gridOffsetX ?? 0} onChange={(event) => updateIdentityField('gridOffsetX', Number(event.target.value) || 0)} />
                </div>
                <div className="row">
                  <label>Grid offset Y <AdminHelpTooltip section="battleMaps" field="gridOffsetY" /></label>
                  <input type="number" value={draft.gridOffsetY ?? 0} onChange={(event) => updateIdentityField('gridOffsetY', Number(event.target.value) || 0)} />
                </div>
                <div className="row">
                  <label>Logical columns <AdminHelpTooltip section="battleMaps" field="logicalColumns" /></label>
                  <input type="number" min={6} value={draft.logicalColumns ?? draft.width} onChange={(event) => handleLogicalColumnsChange(Number(event.target.value))} />
                </div>
                <div className="row">
                  <label>Logical rows <AdminHelpTooltip section="battleMaps" field="logicalRows" /></label>
                  <input type="number" min={6} value={draft.logicalRows ?? draft.height} onChange={(event) => handleLogicalRowsChange(Number(event.target.value))} />
                </div>
                <label className="zone-editor-checkbox">
                  <input type="checkbox" checked={Boolean(draft.showEditorGrid)} onChange={(event) => updateIdentityField('showEditorGrid', event.target.checked)} />
                  <span>Show editor grid <AdminHelpTooltip section="battleMaps" field="showEditorGrid" /></span>
                </label>
                <div className="row">
                  <label>Grid opacity <AdminHelpTooltip section="battleMaps" field="gridOpacity" /></label>
                  <input type="number" step={0.01} min={0.03} max={0.9} value={draft.gridOpacity ?? 0.12} onChange={(event) => updateIdentityField('gridOpacity', Number(event.target.value) || 0.12)} />
                </div>
              </div>
              <div className="battle-map-editor-dimensions">
                <div className="row">
                  <label>Linked location <AdminHelpTooltip section="battleMaps" field="linkedLocation" /></label>
                  <input value={draft.linkedLocationId ?? ''} onChange={(event) => updateIdentityField('linkedLocationId', event.target.value)} />
                </div>
                <div className="row">
                  <label>Linked quest <AdminHelpTooltip section="battleMaps" field="linkedQuest" /></label>
                  <input value={draft.linkedQuestId ?? ''} onChange={(event) => updateIdentityField('linkedQuestId', event.target.value)} />
                </div>
                <div className="row">
                  <label>Linked zone <AdminHelpTooltip section="battleMaps" field="linkedZone" /></label>
                  <input value={draft.linkedZoneId ?? ''} onChange={(event) => updateIdentityField('linkedZoneId', event.target.value)} />
                </div>
              </div>
            </section>

            <section className="battle-map-editor-section battle-map-editor-placed-panel battle-map-editor-side-section">
              <div className="battle-map-editor-section-head">
                <h4>Placed Data</h4>
              </div>
              <div className="battle-map-editor-side-grid">
                <section className="battle-map-editor-list-card">
              <h5>Objects <AdminHelpTooltip section="battleMaps" field="objects" /></h5>
            {draft.objects.map((object) => (
              <button key={object.id} type="button" className={selectedObjectId === object.id ? 'is-active' : ''} onClick={() => setSelectedObjectId(object.id)}>
                {object.name} [{object.type}] ({object.x},{object.y})
              </button>
            ))}
            {selectedObject ? (
              <div className="battle-map-editor-form-grid">
                <input value={selectedObject.id} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, id: event.target.value } : object) }))} placeholder="id" />
                <select value={selectedObject.type} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, type: event.target.value as BattleMapObjectType } : object) }))}>
                  {OBJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input value={selectedObject.name} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, name: event.target.value } : object) }))} placeholder="name" />
                <div className="battle-map-editor-inline-grid">
                  <input type="number" value={selectedObject.x} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, x: Number(event.target.value) || 0 } : object) }))} placeholder="x" />
                  <input type="number" value={selectedObject.y} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, y: Number(event.target.value) || 0 } : object) }))} placeholder="y" />
                  <input type="number" value={selectedObject.width ?? 1} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, width: Number(event.target.value) || 1 } : object) }))} placeholder="width" />
                  <input type="number" value={selectedObject.height ?? 1} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, height: Number(event.target.value) || 1 } : object) }))} placeholder="height" />
                </div>
                <input value={selectedObject.iconUrl ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, iconUrl: event.target.value } : object) }))} placeholder="icon url" />
                <input value={selectedObject.imageUrl ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, imageUrl: event.target.value } : object) }))} placeholder="image url" />
                <input value={selectedObject.lootTableId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, lootTableId: event.target.value } : object) }))} placeholder="lootTableId" />
                <input value={selectedObject.questId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, questId: event.target.value } : object) }))} placeholder="questId" />
                <input value={selectedObject.triggerId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, triggerId: event.target.value } : object) }))} placeholder="triggerId" />
                <label><input type="checkbox" checked={selectedObject.blocksMovement ?? false} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, blocksMovement: event.target.checked } : object) }))} /> blocks movement</label>
                <label><input type="checkbox" checked={selectedObject.blocksLineOfSight ?? false} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, blocksLineOfSight: event.target.checked } : object) }))} /> blocks line of sight</label>
                <label><input type="checkbox" checked={selectedObject.interactable ?? false} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, interactable: event.target.checked } : object) }))} /> interactable</label>
                <textarea value={selectedObject.description ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objects: current.objects.map((object) => object.id === selectedObject.id ? { ...object, description: event.target.value } : object) }))} placeholder="description" rows={2} />
                <button type="button" onClick={() => deleteSelectedObject(selectedObject.id)}>Remove object</button>
              </div>
            ) : null}
          </section>

                <section className="battle-map-editor-list-card">
              <h5>Traps <AdminHelpTooltip section="battleMaps" field="traps" /></h5>
            {draft.traps.map((trap) => (
              <button key={trap.id} type="button" className={selectedTrapId === trap.id ? 'is-active' : ''} onClick={() => setSelectedTrapId(trap.id)}>
                {trap.name} ({trap.x},{trap.y})
              </button>
            ))}
            {selectedTrap ? (
              <div className="battle-map-editor-form-grid">
                <input value={selectedTrap.id} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, id: event.target.value } : trap) }))} placeholder="id" />
                <input value={selectedTrap.name} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, name: event.target.value } : trap) }))} placeholder="name" />
                <div className="battle-map-editor-inline-grid">
                  <input type="number" value={selectedTrap.x} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, x: Number(event.target.value) || 0 } : trap) }))} placeholder="x" />
                  <input type="number" value={selectedTrap.y} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, y: Number(event.target.value) || 0 } : trap) }))} placeholder="y" />
                  <input type="number" value={selectedTrap.damage ?? 0} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, damage: Number(event.target.value) || 0 } : trap) }))} placeholder="damage" />
                  <input type="number" value={selectedTrap.staminaCost ?? 0} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, staminaCost: Number(event.target.value) || 0 } : trap) }))} placeholder="stamina" />
                </div>
                <label><input type="checkbox" checked={selectedTrap.triggerOnce ?? false} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, triggerOnce: event.target.checked } : trap) }))} /> trigger once</label>
                <label><input type="checkbox" checked={selectedTrap.revealedByDefault ?? false} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, revealedByDefault: event.target.checked } : trap) }))} /> revealed by default</label>
                <input type="number" value={selectedTrap.detectionDifficulty ?? 0} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, detectionDifficulty: Number(event.target.value) || 0 } : trap) }))} placeholder="detectionDifficulty" />
                <textarea value={selectedTrap.description ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, traps: current.traps.map((trap) => trap.id === selectedTrap.id ? { ...trap, description: event.target.value } : trap) }))} placeholder="description" rows={2} />
                <button type="button" onClick={() => deleteSelectedTrap(selectedTrap.id)}>Remove trap</button>
              </div>
            ) : null}
          </section>

                <section className="battle-map-editor-list-card">
              <h5>NPCs <AdminHelpTooltip section="battleMaps" field="npcs" /></h5>
            {draft.npcs.map((npc) => (
              <button key={npc.id} type="button" className={selectedNpcId === npc.id ? 'is-active' : ''} onClick={() => setSelectedNpcId(npc.id)}>
                {npc.name} [{npc.role}] ({npc.x},{npc.y})
              </button>
            ))}
            {selectedNpc ? (
              <div className="battle-map-editor-form-grid">
                <input value={selectedNpc.id} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, id: event.target.value } : npc) }))} placeholder="id" />
                <input value={selectedNpc.npcId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, npcId: event.target.value } : npc) }))} placeholder="npcId" />
                <input value={selectedNpc.name} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, name: event.target.value } : npc) }))} placeholder="name" />
                <select value={selectedNpc.role} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, role: event.target.value as BattleMapNpcRole } : npc) }))}>
                  {NPC_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <div className="battle-map-editor-inline-grid">
                  <input type="number" value={selectedNpc.x} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, x: Number(event.target.value) || 0 } : npc) }))} placeholder="x" />
                  <input type="number" value={selectedNpc.y} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, y: Number(event.target.value) || 0 } : npc) }))} placeholder="y" />
                </div>
                <input value={selectedNpc.factionId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, factionId: event.target.value } : npc) }))} placeholder="factionId" />
                <input value={selectedNpc.dialogueId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, dialogueId: event.target.value } : npc) }))} placeholder="dialogueId" />
                <input value={selectedNpc.questId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, questId: event.target.value } : npc) }))} placeholder="questId" />
                <input value={selectedNpc.merchantId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, merchantId: event.target.value } : npc) }))} placeholder="merchantId" />
                <input value={selectedNpc.avatarUrl ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, avatarUrl: event.target.value } : npc) }))} placeholder="avatarUrl" />
                <label><input type="checkbox" checked={selectedNpc.startsCombat ?? false} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, startsCombat: event.target.checked } : npc) }))} /> starts combat</label>
                <textarea value={selectedNpc.description ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, description: event.target.value } : npc) }))} placeholder="description" rows={2} />
                <button type="button" onClick={() => deleteSelectedNpc(selectedNpc.id)}>Remove NPC</button>
              </div>
            ) : null}
          </section>

                <section className="battle-map-editor-list-card">
              <h5>Triggers <AdminHelpTooltip section="battleMaps" field="triggers" /></h5>
            {draft.triggers.map((trigger) => (
              <button key={trigger.id} type="button" className={selectedTriggerId === trigger.id ? 'is-active' : ''} onClick={() => setSelectedTriggerId(trigger.id)}>
                {trigger.name} [{trigger.type}] ({trigger.cells.length} cells)
              </button>
            ))}
            {selectedTrigger ? (
              <div className="battle-map-editor-form-grid">
                <input value={selectedTrigger.id} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, id: event.target.value } : trigger) }))} placeholder="id" />
                <input value={selectedTrigger.name} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, name: event.target.value } : trigger) }))} placeholder="name" />
                <select value={selectedTrigger.type} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, type: event.target.value as BattleMapTriggerType } : trigger) }))}>
                  {TRIGGER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input value={selectedTrigger.questId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, questId: event.target.value } : trigger) }))} placeholder="questId" />
                <input value={selectedTrigger.dialogueId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, dialogueId: event.target.value } : trigger) }))} placeholder="dialogueId" />
                <input value={selectedTrigger.targetBattleMapId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, targetBattleMapId: event.target.value } : trigger) }))} placeholder="targetBattleMapId" />
                <input value={selectedTrigger.targetWorldZoneId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, targetWorldZoneId: event.target.value } : trigger) }))} placeholder="targetWorldZoneId" />
                <label><input type="checkbox" checked={selectedTrigger.startsCombat ?? false} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, startsCombat: event.target.checked } : trigger) }))} /> starts combat</label>
                <label><input type="checkbox" checked={selectedTrigger.once ?? false} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, once: event.target.checked } : trigger) }))} /> once</label>
                <label><input type="checkbox" checked={selectedTrigger.enabled ?? true} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, enabled: event.target.checked } : trigger) }))} /> enabled</label>
                <div className="muted">Paint trigger zone by creating a trigger, then keep it selected and extend its cells in future pass.</div>
                <textarea value={selectedTrigger.description ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, triggers: current.triggers.map((trigger) => trigger.id === selectedTrigger.id ? { ...trigger, description: event.target.value } : trigger) }))} placeholder="description" rows={2} />
                <button type="button" onClick={() => deleteSelectedTrigger(selectedTrigger.id)}>Remove trigger</button>
              </div>
            ) : null}
          </section>
              </div>
            </section>

            <section className="battle-map-editor-section battle-map-editor-validation-panel battle-map-editor-side-section">
              <div className="battle-map-editor-section-head">
                <h4>Validation</h4>
              </div>
              <div className="battle-map-editor-validation-list">
                {validationIssues.map((issue, index) => (
                  <div key={`${issue}-${index}`} className={issue.startsWith('Warning:') ? 'is-warning' : 'is-error'}>{issue}</div>
                ))}
              </div>
              <div className="muted">Blocking object cells tracked: {blockingObjectCells.size}</div>
            </section>
          </div>
        </div>

      </div>

      <div className="battle-map-editor-statusbar">
        <span>zoom: {(canvasZoom * 100).toFixed(0)}%</span>
        <span>pan: {Math.round(canvasPanX)}, {Math.round(canvasPanY)}</span>
        <span>tool: {interactionMode === 'pan' ? 'pan' : layer}</span>
        <span>logical: {logicalColumns}x{logicalRows}</span>
        <span>cell: {cellSizePx}px</span>
        <span>offset: {gridOffsetX},{gridOffsetY}</span>
        <span>viewport: {draft.viewportWidth}x{draft.viewportHeight}</span>
      </div>
    </section>
  );
}

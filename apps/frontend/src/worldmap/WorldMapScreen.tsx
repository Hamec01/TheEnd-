import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Equipment, InventoryState, ItemDefinition, StatBlock } from '@theend/rpg-domain';
import type { ArenaCharacter } from '../arena/types';
import { TopStatusBar } from './TopStatusBar';
import { PlayerQuickPanel } from './PlayerQuickPanel';
import { WorldMapCanvas, type WorldMapCanvasHandle } from './WorldMapCanvas';
import { ContextActionPanel } from './ContextActionPanel';
import { ZoneEditorPanel } from './ZoneEditorPanel';
import { ArenaMapEditor, type ArenaBlockedTile } from '../components/ArenaMapEditor';
import { createEmptyHistory, createSnapshot, pushHistory, redoHistory, undoHistory, type ZoneEditorHistoryState } from './zoneEditorHistory';
import { clearEditorSettingsStorage, clearZoneStorage, exportEditorDataJson, loadEditorDataFromBackend, loadEditorSettings, saveEditorDataToBackend, saveEditorSettings, validateEditorDataJson } from './zoneEditorStorage';
import { createDefaultEditorSettings, createDraftFromZone, createEmptyZoneDraft, createZoneFromDraft, type PaintedRegion, type RegionBrushSize, type RegionToolMode, type RegionType, type WorldMapZone, type ZoneEditorDraft, type ZoneEditorSettings, type ZoneEditorTool } from './zoneEditorTypes';
import type { ChatMessage, ChatType, ContextMode, MapNodeData, PlayerWorldState, WorldMapMode } from './types';
import { getNearbyPlayers, canAttackNearbyPlayer, type NearbyPlayer } from './nearbyPlayersSystem';
import { WORLD_MAP_ZONES, type Zone } from './worldMapNodes';
import { getZoneCenter, moveZone } from './zoneGeometry';
import type { AdminMerchant } from '../services/content/models';
import { subscribeToContentSync } from '../services/content/contentSync';

type LocationView = 'map' | 'arklein';

const DEFAULT_PLAYER_POSITION = { x: 0.53, y: 0.83 };
const ARKLEIN_MERCHANT_SLOTS = [
  { left: '37%', top: '46%', keywords: ['рынок', 'market', 'bazaar', 'лавка', 'торг'] },
  { left: '68%', top: '35%', keywords: ['куз', 'smith', 'forge', 'blacksmith'] },
  { left: '50%', top: '69%', keywords: ['площадь', 'manor', 'guild', 'центр', 'hall'] },
  { left: '80%', top: '54%', keywords: ['храм', 'church', 'temple', 'cathedral'] },
  { left: '17%', top: '72%', keywords: ['порт', 'dock', 'harbor', 'harbour', 'warehouse', 'склад'] },
  { left: '69%', top: '78%', keywords: ['таверн', 'inn', 'tavern', 'south', 'квартал'] },
] as const;

function assignArkleinMerchantSlots(merchants: AdminMerchant[]) {
  const freeSlots = [...ARKLEIN_MERCHANT_SLOTS];

  return merchants.map((merchant, index) => {
    const locationKey = `${merchant.location ?? ''} ${merchant.type}`.trim().toLowerCase();
    const preferredIndex = freeSlots.findIndex((slot) => slot.keywords.some((keyword) => locationKey.includes(keyword)));
    const slotIndex = preferredIndex >= 0 ? preferredIndex : 0;
    const slot = freeSlots.splice(slotIndex, 1)[0] ?? ARKLEIN_MERCHANT_SLOTS[index % ARKLEIN_MERCHANT_SLOTS.length];

    return {
      merchant,
      left: slot.left,
      top: slot.top,
    };
  });
}

function getPlayerPositionStorageKey(characterId: string): string {
  return `theend.worldMap.playerPosition.${characterId}`;
}

function loadPlayerPosition(characterId: string): { x: number; y: number } {
  if (typeof window === 'undefined') {
    return DEFAULT_PLAYER_POSITION;
  }

  const raw = window.localStorage.getItem(getPlayerPositionStorageKey(characterId));
  if (!raw) {
    return DEFAULT_PLAYER_POSITION;
  }

  try {
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (typeof parsed.x === 'number' && Number.isFinite(parsed.x) && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
      return {
        x: Math.max(0, Math.min(1, parsed.x)),
        y: Math.max(0, Math.min(1, parsed.y)),
      };
    }
  } catch {
    // Ignore broken saved values and fallback to defaults.
  }

  return DEFAULT_PLAYER_POSITION;
}

function cloneZones(zones: WorldMapZone[]): WorldMapZone[] {
  return zones.map((zone) => ({
    ...zone,
    points: zone.points ? zone.points.map((point) => [point[0], point[1]] as [number, number]) : undefined,
  }));
}

function offsetZone(zone: WorldMapZone, dx: number, dy: number): WorldMapZone {
  if (zone.shape === 'circle') {
    return {
      ...zone,
      x: Math.max(0, Math.min(1, (zone.x ?? 0) + dx)),
      y: Math.max(0, Math.min(1, (zone.y ?? 0) + dy)),
      updatedAt: Date.now(),
    };
  }

  return moveZone(zone, dx, dy);
}

function buildDraftForTool(tool: ZoneEditorTool, currentDraft: ZoneEditorDraft | null): ZoneEditorDraft {
  const nextDraft = currentDraft ?? createEmptyZoneDraft(tool);
  if (tool === 'polygon') {
    return { ...nextDraft, shape: 'polygon', x: null, y: null, radius: null };
  }
  if (tool === 'rectangle') {
    return { ...nextDraft, shape: 'rect', x: null, y: null, radius: null };
  }
  if (tool === 'circle') {
    return { ...nextDraft, shape: 'circle', points: [], radius: nextDraft.radius ?? 0.03 };
  }
  return nextDraft;
}

function normalizeClipboardText(text: string): string {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return text;
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).zones)) {
    return text;
  }
  return JSON.stringify([parsed], null, 2);
}

interface WorldMapScreenProps {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
  battleStats: {
    hp: number;
    mp: number;
    stamina: number;
  };
  chatLines: string[];
  onOpenStats: () => void;
  onOpenInventory: () => void;
  onOpenClan: () => void;
  onExit: () => void;
  onOpenArena: () => void;
  onStartCombat: () => Promise<void>;
  onOpenMerchant: (merchantId?: string) => void;
  onOpenArenaNpc: () => void;
  onOpenSkills: () => void;
  onStatus: (text: string) => void;
  cityMerchants?: AdminMerchant[];
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
  resolveMerchantImage?: (merchant: AdminMerchant | null | undefined) => string | undefined;
  battleMapImageUrl: string;
  battleBlockedTiles: ArenaBlockedTile[];
  battleMapDraftName: string;
  battleMapPresets: Array<{ id: string; name: string }>;
  selectedBattleMapPresetId: string | null;
  onBattleMapImageUrlChange: (value: string) => void;
  onBattleBlockedTilesChange: (tiles: ArenaBlockedTile[]) => void;
  onBattleMapDraftNameChange: (name: string) => void;
  onBattleMapSelect: (presetId: string) => void;
  onBattleMapSave: () => void;
  onBattleMapDelete: () => void;
  onBattleMapNew: () => void;
}

export function WorldMapScreen(props: WorldMapScreenProps) {
  const {
    character,
    inventory,
    equipment,
    battleStats,
    chatLines,
    onOpenStats,
    onOpenInventory,
    onOpenClan,
    onExit,
    onOpenArena,
    onStartCombat,
    onOpenMerchant,
    onOpenSkills,
    onStatus,
    cityMerchants = [],
    resolveItemById,
    resolveItemImage,
    resolveMerchantImage,
    battleMapImageUrl,
    battleBlockedTiles,
    battleMapDraftName,
    battleMapPresets,
    selectedBattleMapPresetId,
    onBattleMapImageUrlChange,
    onBattleBlockedTilesChange,
    onBattleMapDraftNameChange,
    onBattleMapSelect,
    onBattleMapSave,
    onBattleMapDelete,
    onBattleMapNew,
    onOpenArenaNpc,
  } = props;

  const canvasRef = useRef<WorldMapCanvasHandle>(null);
  const skipNextZonePersistRef = useRef(true);
  const skipNextSettingsPersistRef = useRef(false);
  const worldMapRefreshRef = useRef<Promise<void> | null>(null);
  const lastWorldMapRefreshAtRef = useRef(0);

  const [worldMapMode, setWorldMapMode] = useState<WorldMapMode>('play');
  const [contextMode, setContextMode] = useState<ContextMode>('empty');
  const [locationView, setLocationView] = useState<LocationView>('map');
  const [currentZone, setCurrentZone] = useState<WorldMapZone | null>(null);
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [playerState, setPlayerState] = useState<PlayerWorldState>('idle');
  const [playerPosition, setPlayerPosition] = useState(() => loadPlayerPosition(character.id));
  const [playSpawnPosition, setPlaySpawnPosition] = useState(() => loadPlayerPosition(character.id));
  const [selectedNearbyPlayerId, setSelectedNearbyPlayerId] = useState<string | null>(null);
  const [chatType, setChatType] = useState<ChatType>('local');
  const [chatDraft, setChatDraft] = useState('');
  const [systemChat, setSystemChat] = useState<ChatMessage[]>([]);
  const [showBattleMapEditor, setShowBattleMapEditor] = useState(false);

  const [zones, setZones] = useState<WorldMapZone[]>(() => cloneZones(WORLD_MAP_ZONES));
  const [regions, setRegions] = useState<PaintedRegion[]>([]);
  const [regionToolMode, setRegionToolMode] = useState<RegionToolMode>('circle');
  const [regionType, setRegionType] = useState<RegionType>('blocked');
  const [regionBrushSize, setRegionBrushSize] = useState<RegionBrushSize>(1);
  const [editorSettings, setEditorSettings] = useState<ZoneEditorSettings>(() => (typeof window === 'undefined'
    ? createDefaultEditorSettings()
    : loadEditorSettings()));
  const [editorDraft, setEditorDraft] = useState<ZoneEditorDraft | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [editorJson, setEditorJson] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState('ready');
  const [mouseCoords, setMouseCoords] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [history, setHistory] = useState<ZoneEditorHistoryState>(createEmptyHistory());

  const selectedLocationName = currentZone?.name ?? 'Пустоши';
  const nearbyPlayers = useMemo(() => getNearbyPlayers(), []);
  const selectedNearbyPlayer = useMemo(
    () => nearbyPlayers.find((entry) => entry.id === selectedNearbyPlayerId) ?? nearbyPlayers[0] ?? null,
    [nearbyPlayers, selectedNearbyPlayerId],
  );
  const arkleinMerchantHotspots = useMemo(
    () => assignArkleinMerchantSlots(cityMerchants),
    [cityMerchants],
  );
  const canAttackPlayer = canAttackNearbyPlayer((currentZone?.type as never) ?? null);
  const avatarLetter = character.name.trim().charAt(0).toUpperCase() || 'H';
  const selectedZone = useMemo(() => zones.find((zone) => zone.id === selectedZoneId) ?? null, [selectedZoneId, zones]);
  const regionPaintSettings = useMemo(() => ({
    toolMode: regionToolMode,
    regionType,
    brushSize: regionBrushSize,
  }), [regionBrushSize, regionToolMode, regionType]);

  const reloadWorldMapFromBackend = useCallback(async (options?: { force?: boolean }) => {
    if (worldMapMode === 'editor') {
      return;
    }

    const now = Date.now();
    if (!options?.force && worldMapRefreshRef.current && now - lastWorldMapRefreshAtRef.current < 1200) {
      return worldMapRefreshRef.current;
    }

    lastWorldMapRefreshAtRef.current = now;
    const refreshPromise = loadEditorDataFromBackend(cloneZones(WORLD_MAP_ZONES))
      .then((loaded) => {
        skipNextZonePersistRef.current = true;
        setZones(loaded.zones);
        setRegions(loaded.regions);
        setCurrentZone((previous) => previous ? loaded.zones.find((zone) => zone.id === previous.id) ?? previous : previous);
        setHoverZone((previous) => previous ? loaded.zones.find((zone) => zone.id === previous.id) ?? previous : previous);
      })
      .catch(() => {
        // Keep the current in-memory map if backend content is unavailable.
      })
      .finally(() => {
        if (worldMapRefreshRef.current === refreshPromise) {
          worldMapRefreshRef.current = null;
        }
      });

    worldMapRefreshRef.current = refreshPromise;
    return refreshPromise;
  }, [worldMapMode]);

  useEffect(() => {
    setEditorJson(exportEditorDataJson(zones, regions));
  }, [regions, zones]);

  useEffect(() => {
    const restored = loadPlayerPosition(character.id);
    setPlayerPosition(restored);
    setPlaySpawnPosition(restored);
  }, [character.id]);

  useEffect(() => {
    if (worldMapMode !== 'play') {
      return;
    }

    void reloadWorldMapFromBackend({ force: true });
  }, [reloadWorldMapFromBackend, worldMapMode]);

  useEffect(() => {
    if (worldMapMode !== 'play') {
      return;
    }

    const refreshVisibleWorldMap = () => {
      void reloadWorldMapFromBackend();
    };

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === 'worldMap' || payload.scope === 'all') {
        void reloadWorldMapFromBackend({ force: true });
      }
    });

    const handleFocus = () => {
      refreshVisibleWorldMap();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshVisibleWorldMap();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reloadWorldMapFromBackend, worldMapMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(getPlayerPositionStorageKey(character.id), JSON.stringify(playerPosition));
  }, [character.id, playerPosition]);

  useEffect(() => {
    if (worldMapMode !== 'editor') {
      return;
    }

    if (skipNextZonePersistRef.current) {
      skipNextZonePersistRef.current = false;
      return;
    }

    setAutosaveStatus('saving');
    void (async () => {
      try {
        if (zones.length === 0 && regions.length === 0) {
          clearZoneStorage();
          await saveEditorDataToBackend([], []);
        } else {
          await saveEditorDataToBackend(zones, regions);
        }
        setAutosaveStatus('autosaved');
      } catch {
        setAutosaveStatus('save failed');
      }
    })();
  }, [regions, worldMapMode, zones]);

  useEffect(() => {
    if (skipNextSettingsPersistRef.current) {
      skipNextSettingsPersistRef.current = false;
      return;
    }

    saveEditorSettings(editorSettings);
    setAutosaveStatus('autosaved');
  }, [editorSettings]);

  function captureCheckpoint() {
    setHistory((current) => pushHistory(current, createSnapshot(zones, regions, editorDraft, selectedZoneId)));
  }

  function applySnapshot(snapshot: ReturnType<typeof createSnapshot>) {
    setZones(snapshot.zones);
    setRegions(snapshot.regions);
    setEditorDraft(snapshot.draft);
    setSelectedZoneId(snapshot.selectedZoneId);
    setValidationErrors([]);
  }

  function handleUndo() {
    const current = createSnapshot(zones, regions, editorDraft, selectedZoneId);
    const result = undoHistory(history, current);
    if (!result.snapshot) {
      onStatus('Editor: nothing to undo.');
      return;
    }
    setHistory(result.history);
    applySnapshot(result.snapshot);
    onStatus('Editor: undo.');
  }

  function handleRedo() {
    const current = createSnapshot(zones, regions, editorDraft, selectedZoneId);
    const result = redoHistory(history, current);
    if (!result.snapshot) {
      onStatus('Editor: nothing to redo.');
      return;
    }
    setHistory(result.history);
    applySnapshot(result.snapshot);
    onStatus('Editor: redo.');
  }

  const selectedNode: MapNodeData | null = useMemo(() => {
    if (!currentZone) {
      return null;
    }

    const [zoneCenterX, zoneCenterY] = getZoneCenter(currentZone);
    const dangerLabel = currentZone.dangerLevel >= 5 ? 'High' : currentZone.dangerLevel >= 3 ? 'Medium' : 'Low';
    const access: MapNodeData['access'] = currentZone.requiredLevel && currentZone.requiredLevel > character.level ? 'Locked' : 'Neutral';
    const actions: MapNodeData['actions'] = [];

    if (currentZone.type === 'city') {
      actions.push({ id: 'open-city', label: 'Войти в город', kind: 'enter' });
      actions.push({ id: 'trade', label: 'Торговец', kind: 'trade' });
      actions.push({ id: 'talk', label: 'Поговорить с NPC', kind: 'talk' });
    }

    if (currentZone.type === 'grind' || currentZone.type === 'danger' || currentZone.type === 'dungeon') {
      actions.push({ id: 'enter-battle', label: 'Искать бой', kind: 'combat' });
      actions.push({ id: 'scout-enemy', label: 'Разведка', kind: 'scout' });
    }

    if (currentZone.type === 'resource') {
      actions.push({ id: 'gather', label: 'Добывать ресурс', kind: 'quest' });
    }

    if (currentZone.type === 'profession') {
      actions.push({ id: 'profession-train', label: 'Обучение профессии', kind: 'talk' });
    }

    if (actions.length === 0) {
      actions.push({ id: 'look-around', label: 'Осмотреться', kind: 'scout' });
    }

    return {
      id: currentZone.id,
      name: currentZone.name,
      type: currentZone.type,
      faction: currentZone.faction ?? (currentZone.type === 'danger' ? 'Враждебная зона' : 'Нейтральная зона'),
      danger: dangerLabel,
      access,
      recommendedLevel: Math.max(1, currentZone.recommendedLevel ?? currentZone.dangerLevel),
      description: currentZone.description,
      tooltip: currentZone.tooltip ?? currentZone.description,
      x: zoneCenterX,
      y: zoneCenterY,
      actions,
    };
  }, [character.level, currentZone]);

  const chatMessages = useMemo<ChatMessage[]>(() => {
    const localMessages = chatLines.map((line, index) => ({
      id: `local-${index}-${line}`,
      text: line,
      type: 'local' as const,
    }));
    return [...localMessages, ...systemChat].slice(-24);
  }, [chatLines, systemChat]);

  const quickButtons = useMemo(() => [
    {
      id: 'combat',
      tone: 'red' as const,
      icon: '⚔',
      title: 'Combat status',
      onClick: () => setContextMode('combat'),
    },
    {
      id: 'messages',
      tone: 'blue' as const,
      icon: '✉',
      title: 'Messages / quests / notifications',
      badge: 3,
      onClick: () => setContextMode('npc'),
    },
    {
      id: 'inventory',
      tone: 'yellow' as const,
      icon: '🎒',
      title: 'Инвентарь и экипировка',
      onClick: onOpenInventory,
    },
  ], [onOpenInventory]);

  // Memoize callbacks to prevent infinite loops in animation frames
  const handlePlayerPosition = useCallback((x: number, y: number) => {
    setPlayerPosition({ x, y });
  }, []);

  const handlePlayerState = useCallback((state: PlayerWorldState) => {
    setPlayerState(state);
  }, []);

  const handleHoverZone = useCallback((zone: WorldMapZone | null) => {
    setHoverZone(zone);
  }, []);

  const rememberCurrentMapPosition = useCallback(() => {
    setPlaySpawnPosition((current) => {
      if (current.x === playerPosition.x && current.y === playerPosition.y) {
        return current;
      }

      return playerPosition;
    });
  }, [playerPosition]);

  const handleZoneEnterMemoized = useCallback((zone: Zone | null) => {
    setCurrentZone(zone as WorldMapZone | null);
    if (worldMapMode === 'editor') {
      return;
    }
    if (!zone) {
      setContextMode('empty');
      return;
    }
    setContextMode('location');
    setPlayerState(zone.type === 'city' ? 'in_city' : 'in_zone');
    const entry: ChatMessage = {
      id: `sys-zone-${Date.now()}-${zone.id}`,
      text: `Вы вошли в: ${zone.name}`,
      type: 'system',
    };
    setSystemChat((prev) => [...prev, entry].slice(-12));
  }, [worldMapMode]);

  function setMode(mode: WorldMapMode) {
    if (mode !== 'play') {
      rememberCurrentMapPosition();
    }
    setWorldMapMode(mode);
    if (mode === 'editor') {
      setLocationView('map');
      setContextMode('empty');
      onStatus('Editor mode enabled. Gameplay panels hidden.');
      return;
    }
    onStatus('Play mode enabled.');
  }

  function validateDraft(draft: ZoneEditorDraft | null): draft is ZoneEditorDraft {
    if (!draft) {
      onStatus('Editor: no draft to save.');
      return false;
    }

    if (!draft.id.trim() || !draft.name.trim() || !draft.description.trim()) {
      onStatus('Editor: id, name and description are required.');
      return false;
    }

    if (draft.shape === 'circle') {
      if (draft.x === null || draft.y === null || draft.radius === null || draft.radius <= 0) {
        onStatus('Editor: circle requires x, y and radius.');
        return false;
      }
    } else if (draft.points.length < 3) {
      onStatus('Editor: polygon/rect requires at least 3 points.');
      return false;
    }

    return true;
  }

  function upsertZone(nextZone: WorldMapZone) {
    setZones((prev) => [...prev.filter((zone) => zone.id !== nextZone.id), nextZone]);
    setSelectedZoneId(nextZone.id);
    setEditorDraft(createDraftFromZone(nextZone));
  }

  function handleSaveNewZone() {
    if (!validateDraft(editorDraft)) {
      return;
    }

    const duplicate = zones.find((zone) => zone.id === editorDraft.id);
    if (duplicate && duplicate.id !== selectedZoneId && !window.confirm(`Zone id ${editorDraft.id} already exists. Replace it?`)) {
      return;
    }

    captureCheckpoint();
    const nextZone = createZoneFromDraft(editorDraft, duplicate?.createdAt);
    upsertZone(nextZone);
    onStatus(`Editor: saved zone ${nextZone.name}.`);
  }

  function handleUpdateSelectedZone() {
    if (!selectedZoneId) {
      onStatus('Editor: no selected zone.');
      return;
    }
    if (!validateDraft(editorDraft)) {
      return;
    }

    const existing = zones.find((zone) => zone.id === selectedZoneId) ?? null;
    captureCheckpoint();
    const nextZone = createZoneFromDraft(editorDraft, existing?.createdAt);
    setZones((prev) => [...prev.filter((zone) => zone.id !== selectedZoneId && zone.id !== nextZone.id), nextZone]);
    setSelectedZoneId(nextZone.id);
    setEditorDraft(createDraftFromZone(nextZone));
    onStatus(`Editor: updated zone ${nextZone.name}.`);
  }

  function handleConfirmDraft() {
    if (selectedZoneId) {
      handleUpdateSelectedZone();
      return;
    }
    handleSaveNewZone();
  }

  function handleDuplicateSelected(zoneOverride?: WorldMapZone) {
    const source = zoneOverride ?? selectedZone;
    if (!source) {
      onStatus('Editor: no selected zone to duplicate.');
      return;
    }

    captureCheckpoint();
    const duplicated = offsetZone({
      ...source,
      id: `${source.id}_copy`,
      name: `${source.name} Copy`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, 0.01, 0.01);

    let suffix = 1;
    while (zones.some((zone) => zone.id === duplicated.id)) {
      duplicated.id = `${source.id}_copy_${suffix}`;
      suffix += 1;
    }

    setZones((prev) => [...prev, duplicated]);
    setSelectedZoneId(duplicated.id);
    setEditorDraft(createDraftFromZone(duplicated));
    onStatus(`Editor: duplicated ${source.name}.`);
  }

  function handleDeleteZone(zoneId = selectedZoneId) {
    if (!zoneId) {
      onStatus('Editor: nothing to delete.');
      return;
    }

    captureCheckpoint();
    setZones((prev) => prev.filter((zone) => zone.id !== zoneId));
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(null);
      setEditorDraft(null);
    }
    onStatus(`Editor: deleted zone ${zoneId}.`);
  }

  function handleClearDraft() {
    setEditorDraft(null);
    setSelectedZoneId(null);
    onStatus('Editor: draft cleared.');
  }

  function handleClearAllZones() {
    if (!window.confirm('Delete all zones and painted regions from the editor?')) {
      return;
    }
    captureCheckpoint();
    setZones([]);
    setRegions([]);
    setSelectedZoneId(null);
    setEditorDraft(null);
    setEditorJson('');
    clearZoneStorage();
    void saveEditorDataToBackend([], []);
    onStatus('Editor: all zones and regions cleared.');
  }

  function handleResetStorage() {
    skipNextZonePersistRef.current = true;
    skipNextSettingsPersistRef.current = true;
    clearZoneStorage();
    void saveEditorDataToBackend([], []);
    clearEditorSettingsStorage();
    setZones(cloneZones(WORLD_MAP_ZONES));
    setRegions([]);
    setEditorSettings(createDefaultEditorSettings());
    setSelectedZoneId(null);
    setEditorDraft(null);
    setValidationErrors([]);
    setHistory(createEmptyHistory());
    setEditorJson(exportEditorDataJson(cloneZones(WORLD_MAP_ZONES), []));
    onStatus('Editor: storage reset to defaults.');
  }

  function handleExportJson() {
    setEditorJson(exportEditorDataJson(zones, regions));
    setValidationErrors([]);
    onStatus('Editor: JSON exported to textarea.');
  }

  async function handleCopyJson(zone: WorldMapZone | null = selectedZone) {
    const payload = zone ? JSON.stringify(zone, null, 2) : exportEditorDataJson(zones, regions);
    setEditorJson(payload);
    try {
      await navigator.clipboard.writeText(payload);
      onStatus(zone ? `Copied zone JSON: ${zone.id}` : 'Copied zones JSON');
    } catch {
      onStatus('Editor: clipboard copy failed, JSON left in textarea.');
    }
  }

  function validateJsonText(text: string) {
    try {
      return validateEditorDataJson(normalizeClipboardText(text));
    } catch {
      return { valid: false, errors: ['Invalid JSON syntax'], zones: [], regions: [] };
    }
  }

  function handleValidateJson() {
    const result = validateJsonText(editorJson);
    setValidationErrors(result.errors);
    onStatus(result.valid
      ? `JSON valid: ${result.zones.length} zones, ${result.regions.length} regions`
      : `JSON invalid: ${result.errors.length} errors`);
  }

  function mergeImportedData(importedZones: WorldMapZone[], importedRegions: PaintedRegion[]) {
    const importedIds = new Set(importedZones.map((zone) => zone.id));
    const importedRegionIds = new Set(importedRegions.map((region) => region.id));
    const duplicates = zones.filter((zone) => importedIds.has(zone.id));
    const regionDuplicates = regions.filter((region) => importedRegionIds.has(region.id));
    if ((duplicates.length > 0 || regionDuplicates.length > 0)
      && !window.confirm(`Replace ${duplicates.length} zones and ${regionDuplicates.length} regions with matching ids?`)) {
      return false;
    }

    captureCheckpoint();
    setZones((prev) => [...prev.filter((zone) => !importedIds.has(zone.id)), ...importedZones]);
    setRegions((prev) => [...prev.filter((region) => !importedRegionIds.has(region.id)), ...importedRegions]);
    setSelectedZoneId(null);
    setEditorDraft(null);
    return true;
  }

  function handleImportJson() {
    const result = validateJsonText(editorJson);
    setValidationErrors(result.errors);
    if (!result.valid) {
      onStatus(`Editor: import failed with ${result.errors.length} errors.`);
      return;
    }

    if (mergeImportedData(result.zones, result.regions)) {
      onStatus(`Editor: imported ${result.zones.length} zones and ${result.regions.length} regions.`);
    }
  }

  async function handlePasteZoneAt(point: [number, number]) {
    try {
      const raw = await navigator.clipboard.readText();
      const result = validateJsonText(raw);
      if (!result.valid) {
        setValidationErrors(result.errors);
        onStatus('Editor: clipboard JSON invalid.');
        return;
      }

      const importedZones = result.zones;
      const anchor = importedZones.length === 1
        ? getZoneCenter(importedZones[0])
        : importedZones.reduce((acc, zone) => {
          const center = getZoneCenter(zone);
          return [acc[0] + center[0], acc[1] + center[1]] as [number, number];
        }, [0, 0] as [number, number]).map((value) => value / importedZones.length) as [number, number];
      const offsetX = point[0] - anchor[0];
      const offsetY = point[1] - anchor[1];
      const shiftedZones = importedZones.map((zone) => ({
        ...offsetZone(zone, offsetX, offsetY),
        id: zones.some((entry) => entry.id === zone.id) ? `${zone.id}_${Date.now()}` : zone.id,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }));

      captureCheckpoint();
      setZones((prev) => [...prev, ...shiftedZones]);
      onStatus(`Editor: pasted ${shiftedZones.length} zones.`);
    } catch {
      onStatus('Editor: clipboard paste failed.');
    }
  }

  function handleToggleZoneVisibility(zoneId: string) {
    captureCheckpoint();
    setZones((prev) => prev.map((zone) => (
      zone.id === zoneId ? { ...zone, isVisibleToPlayer: !zone.isVisibleToPlayer, updatedAt: Date.now() } : zone
    )));
  }

  function handleToolChange(tool: ZoneEditorTool) {
    setEditorSettings((prev) => ({ ...prev, selectedTool: tool }));
    if (tool === 'circle' || tool === 'polygon' || tool === 'rectangle') {
      setSelectedZoneId(null);
      setEditorDraft((current) => buildDraftForTool(tool, current));
    }
  }

  function handleDraftChange(draft: ZoneEditorDraft | null) {
    setEditorDraft(draft);
    if (!draft) {
      return;
    }
    if (!selectedZoneId) {
      return;
    }
    if (draft.id !== selectedZoneId) {
      setSelectedZoneId(selectedZoneId);
    }
  }

  function handleSelectZone(zone: WorldMapZone | null) {
    setSelectedZoneId(zone?.id ?? null);
    setEditorDraft(zone ? createDraftFromZone(zone) : null);
  }

  function handleDeleteSelectedPoint() {
    if (!editorDraft || editorDraft.selectedPointIndex === null) {
      return;
    }
    const nextPoints = editorDraft.points.filter((_, index) => index !== editorDraft.selectedPointIndex);
    setEditorDraft({
      ...editorDraft,
      points: nextPoints,
      selectedPointIndex: null,
      updatedAt: Date.now(),
    });
  }

  function handleReversePoints() {
    if (!editorDraft || editorDraft.points.length < 3) {
      return;
    }
    setEditorDraft({
      ...editorDraft,
      points: [...editorDraft.points].reverse(),
      selectedPointIndex: null,
      updatedAt: Date.now(),
    });
  }

  function handleEditorViewChange(patch: Partial<ZoneEditorSettings>) {
    setEditorSettings((prev) => ({ ...prev, ...patch }));
  }

  function handleSaveShortcut() {
    void saveEditorDataToBackend(zones, regions);
    saveEditorSettings(editorSettings);
    setAutosaveStatus('autosaved');
    onStatus('Editor: saved to backend content store.');
  }

  async function handleAction(actionId: string, kind: string): Promise<void> {
    if (worldMapMode === 'editor') {
      return;
    }

    if (kind === 'combat' || actionId === 'enter-battle') {
      if (currentZone?.type === 'safe' || currentZone?.type === 'city' || currentZone?.type === 'settlement') {
        onStatus('В безопасной зоне бой запрещен.');
        return;
      }

      if (Math.random() < 0.5 || currentZone?.type === 'danger' || currentZone?.type === 'grind') {
        await onStartCombat();
        setPlayerState('in_combat');
        setContextMode('combat');
        onStatus('Враг найден. Бой начался.');
      } else {
        onStatus('Поблизости нет врагов. Попробуйте снова.');
      }
      return;
    }

    if (actionId === 'open-city' && currentZone?.type === 'city') {
      handleOpenLocation(currentZone.id);
      return;
    }

    if (kind === 'trade' && currentZone?.type === 'city') {
      if (cityMerchants.length === 0) {
        onStatus('В этом городе пока нет торговцев из админки. Создайте торговца и укажите город "Арклейн".');
        return;
      }

      if (cityMerchants.length === 1) {
        onOpenMerchant(cityMerchants[0].id);
        onStatus(`Открыт торговец: ${cityMerchants[0].name}.`);
        return;
      }

      setLocationView('arklein');
      setContextMode('location');
      onStatus('Войдите в город и выберите торговца на карте.');
      return;
    }

    if (kind === 'trade') {
      onOpenMerchant();
      onStatus(`Открыт торговец в ${selectedLocationName}.`);
      return;
    }

    if (kind === 'talk' || kind === 'quest') {
      setContextMode('npc');
      onStatus(`Interaction started in ${selectedLocationName}.`);
      return;
    }

    onStatus(`Action: ${actionId}`);
  }

  function handleOpenLocation(locationId: string) {
    if (worldMapMode === 'editor') {
      return;
    }
    const zone = zones.find((entry) => entry.id === locationId) ?? null;
    const opensArkleinScene = locationId === 'arklein' || zone?.targetScene === 'city_arklein';
    if (!opensArkleinScene) {
      onStatus(`Локация ${locationId} пока недоступна.`);
      return;
    }
    rememberCurrentMapPosition();
    setLocationView('arklein');
    setContextMode('location');
    setPlayerState('in_city');
    onStatus(`Вы вошли в ${zone?.name ?? 'Арклейн'}.`);
  }

  function handleReturnToMap() {
    rememberCurrentMapPosition();
    setLocationView('map');
    setContextMode(currentZone ? 'location' : 'empty');
    setPlayerState(currentZone ? 'in_zone' : 'idle');
  }


  function handleNearbyAction(action: 'attack' | 'message' | 'trade' | 'inspect', player: NearbyPlayer) {
    if (action === 'attack') {
      if (!canAttackPlayer) {
        onStatus('В этой зоне PvP запрещен.');
        return;
      }
      onStatus(`Вы атакуете игрока ${player.name}.`);
      return;
    }
    if (action === 'message') {
      setChatType('private');
      setChatDraft(`/w ${player.name} `);
      onStatus(`Приватный чат с ${player.name}.`);
      return;
    }
    if (action === 'trade') {
      onStatus(`Запрос на торговлю отправлен игроку ${player.name}.`);
      return;
    }
    onStatus(`${player.name}: уровень ${player.level}, состояние ${player.state}.`);
  }

  function handleSendChat() {
    const text = chatDraft.trim();
    if (!text) {
      return;
    }
    const entry: ChatMessage = { id: `msg-${Date.now()}`, text, type: chatType };
    setSystemChat((prev) => [...prev, entry].slice(-12));
    setChatDraft('');
  }

  function handleEnterArena() {
    setShowBattleMapEditor(true);
    onStatus('Открыт редактор баттл-карт под Zone Editor. Сохраните карту и запускайте бой отсюда.');
  }

  const playLayout = (
    <>
      <TopStatusBar
        name={character.name}
        gold={inventory.gold}
        level={character.level}
        exp={character.exp}
        statusValue={character.activeStats.strength}
        oreValue={Math.max(0, character.activeStats.constitution + 80)}
        crystalValue={Math.max(0, character.activeStats.intelligence + 40)}
        woodValue={Math.max(0, character.activeStats.stamina - 10)}
        meatValue={Math.max(0, character.activeStats.hp - 160)}
        herbValue={Math.max(0, character.activeStats.perception + 2)}
        onStats={onOpenStats}
        onSkills={onOpenSkills}
        onInventory={onOpenInventory}
        onMap={() => {
          if (locationView === 'map') {
            setContextMode(currentZone ? 'location' : 'empty');
            return;
          }

          handleReturnToMap();
        }}
        onClan={onOpenClan}
        onExit={onExit}
      />

      <section className="wm-grid">
        <PlayerQuickPanel
          name={character.name}
          avatarLetter={avatarLetter}
          hpText={`${battleStats.hp}/${character.activeStats.hp}`}
          mpText={`${battleStats.mp}/${character.activeStats.mp}`}
          staminaText={`${battleStats.stamina}/${character.activeStats.stamina}`}
          activeStats={character.activeStats as StatBlock}
          equipment={equipment}
          inventory={inventory}
          quickActions={quickButtons}
          resolveItemById={resolveItemById}
          resolveItemImage={resolveItemImage}
        />

        {locationView === 'map' ? (
          <WorldMapCanvas
            mode="play"
            playerStartPosition={playSpawnPosition}
            zones={zones}
            regions={regions}
            onOpenLocation={handleOpenLocation}
            onEnterZone={handleZoneEnterMemoized}
            onHoverZone={handleHoverZone}
            onPlayerPosition={handlePlayerPosition}
            onPlayerState={handlePlayerState}
          />
        ) : (
          <section className="wm-map card">
            <div
              className="wm-map-surface wm-city-surface"
              style={{ backgroundImage: "linear-gradient(rgba(24, 17, 12, 0.38), rgba(24, 17, 12, 0.62)), url('/map/City_Arclain.png')" }}
            >
              <div className="wm-map-title">Арклейн</div>
              <div className="wm-city-hotspots">
                <button type="button" className="wm-city-hotspot hotspot-arena" onClick={handleEnterArena}>Арена</button>
                {arkleinMerchantHotspots.map(({ merchant, left, top }) => {
                  const portrait = resolveMerchantImage?.(merchant);
                  const subtitle = merchant.location?.trim() || merchant.type.replace(/_/g, ' ');
                  const merchantInitial = merchant.name.trim().charAt(0).toUpperCase() || 'Т';

                  return (
                    <button
                      key={merchant.id}
                      type="button"
                      className="wm-city-hotspot wm-city-merchant-hotspot"
                      style={{ left, top }}
                      onClick={() => onOpenMerchant(merchant.id)}
                    >
                      {portrait ? (
                        <img src={portrait} alt={merchant.name} />
                      ) : (
                        <span className="wm-city-merchant-avatar" aria-hidden="true">{merchantInitial}</span>
                      )}
                      <span className="wm-city-merchant-copy">
                        <strong>{merchant.name}</strong>
                        <span>{subtitle}</span>
                      </span>
                    </button>
                  );
                })}
                {arkleinMerchantHotspots.length === 0 ? (
                  <div className="wm-city-empty-note">
                    В Арклейне пока нет торговцев из админки. Создайте торговца и поставьте город: Арклейн.
                  </div>
                ) : null}
              </div>
            </div>
            <footer className="wm-map-legend">
              <span>Арклейн | Торговцы из админки появляются здесь автоматически, если у них указан город "Арклейн".</span>
              <button className="wm-city-back" onClick={handleReturnToMap}>Назад к карте</button>
            </footer>
          </section>
        )}

        <div className="wm-right-stack">
          <div className="wm-editor-launch card">
            <button onClick={() => setMode('editor')}>Zone Editor</button>
          </div>

          <section className="wm-battle-map-panel card">
            <div className="wm-battle-map-head">
              <h3>Battle Map Editor</h3>
              <button type="button" onClick={() => setShowBattleMapEditor((prev) => !prev)}>
                {showBattleMapEditor ? 'Свернуть' : 'Открыть'}
              </button>
            </div>

            {showBattleMapEditor ? (
              <>
                <div className="row">
                  <label>Сохраненные карты</label>
                  <select
                    value={selectedBattleMapPresetId ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        return;
                      }
                      onBattleMapSelect(value);
                    }}
                  >
                    <option value="">Черновик (не сохранен)</option>
                    {battleMapPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                </div>

                <div className="row">
                  <label>Имя карты</label>
                  <input
                    value={battleMapDraftName}
                    placeholder="Например: Подземелье Арклейна"
                    onChange={(event) => onBattleMapDraftNameChange(event.target.value)}
                  />
                </div>

                <div className="wm-action-grid">
                  <button onClick={onBattleMapSave}>Сохранить карту</button>
                  <button onClick={onBattleMapNew}>Новая карта</button>
                  <button onClick={onBattleMapDelete} disabled={!selectedBattleMapPresetId}>Удалить карту</button>
                  <button onClick={() => { void onStartCombat(); }}>Начать бой</button>
                </div>

                <div className="wm-action-grid" style={{ marginTop: '6px' }}>
                  <button onClick={onOpenArenaNpc}>Настроить NPC</button>
                </div>

                <ArenaMapEditor
                  mapImageUrl={battleMapImageUrl}
                  blockedTiles={battleBlockedTiles}
                  onMapImageUrlChange={onBattleMapImageUrlChange}
                  onBlockedTilesChange={onBattleBlockedTilesChange}
                />
              </>
            ) : null}
          </section>

          <ContextActionPanel mode={contextMode} selectedNode={selectedNode} onAction={(actionId, kind) => { void handleAction(actionId, kind); }} />
          <section className="wm-context card" style={{ borderTop: 'none' }}>
            <section className="wm-context-block">
              <h3>Игроки рядом</h3>
              {nearbyPlayers.map((entry) => (
                <button
                  key={entry.id}
                  style={{ width: '100%', marginBottom: '6px', textAlign: 'left', opacity: selectedNearbyPlayer?.id === entry.id ? 1 : 0.82 }}
                  onClick={() => setSelectedNearbyPlayerId(entry.id)}
                >
                  {entry.name} (ур.{entry.level}) [{entry.state}]
                </button>
              ))}
              {selectedNearbyPlayer ? (
                <div className="wm-action-grid" style={{ marginTop: '8px' }}>
                  <button disabled={!canAttackPlayer} onClick={() => handleNearbyAction('attack', selectedNearbyPlayer)}>Напасть</button>
                  <button onClick={() => handleNearbyAction('message', selectedNearbyPlayer)}>Написать</button>
                  <button onClick={() => handleNearbyAction('trade', selectedNearbyPlayer)}>Торговать</button>
                  <button onClick={() => handleNearbyAction('inspect', selectedNearbyPlayer)}>Осмотреть</button>
                </div>
              ) : null}
            </section>
          </section>
          <section className="wm-chat card">
            <h3>Чат</h3>
            <div className="wm-chat-log">
              {chatMessages.map((line) => (
                <p key={line.id}><strong>[{line.type.toUpperCase()}]</strong> {line.text}</p>
              ))}
            </div>
            <div className="wm-chat-input">
              <select value={chatType} onChange={(event) => setChatType(event.target.value as ChatType)}>
                <option value="local">local</option>
                <option value="private">private</option>
                <option value="system">system</option>
              </select>
              <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Введите сообщение..." />
              <button onClick={handleSendChat}>▶</button>
            </div>
          </section>
        </div>
      </section>

      <footer className="wm-footer card">
        <span>Локация: {selectedLocationName} | Коорд: {playerPosition.x.toFixed(3)}, {playerPosition.y.toFixed(3)}</span>
        <span>Состояние: {playerState}</span>
        <span>Под курсором: {hoverZone?.name ?? '-'}</span>
        <span>Онлайн: 124</span>
        <span>22:41</span>
      </footer>
    </>
  );

  const editorLayout = (
    <section className="wm-editor-shell">
      <div className="wm-editor-toolbar card">
        <div className="wm-editor-toolbar-group">
          <button onClick={() => setMode('play')}>Play Mode</button>
          <button className="is-active" onClick={() => setMode('editor')}>Editor Mode</button>
        </div>
        <div className="wm-editor-toolbar-group">
          <button className={editorSettings.selectedTool === 'select' ? 'is-active' : ''} onClick={() => handleToolChange('select')}>Select</button>
          <button className={editorSettings.selectedTool === 'circle' ? 'is-active' : ''} onClick={() => handleToolChange('circle')}>Circle</button>
          <button className={editorSettings.selectedTool === 'polygon' ? 'is-active' : ''} onClick={() => handleToolChange('polygon')}>Polygon</button>
          <button className={editorSettings.selectedTool === 'rectangle' ? 'is-active' : ''} onClick={() => handleToolChange('rectangle')}>Rectangle</button>
          <button className={editorSettings.selectedTool === 'pan' ? 'is-active' : ''} onClick={() => handleToolChange('pan')}>Pan</button>
          <button className={editorSettings.selectedTool === 'measure' ? 'is-active' : ''} onClick={() => handleToolChange('measure')}>Measure</button>
        </div>
        <div className="wm-editor-toolbar-group">
          <button onClick={handleUndo}>Undo</button>
          <button onClick={handleRedo}>Redo</button>
          <button onClick={() => canvasRef.current?.fitToScreen()}>Fit</button>
          <button onClick={() => canvasRef.current?.focusZone(selectedZoneId)}>Focus</button>
          <button onClick={handleSaveShortcut}>Save</button>
        </div>
      </div>

      <div className="wm-editor-main">
        <div className="wm-editor-map-area card">
          <WorldMapCanvas
            ref={canvasRef}
            mode="editor"
            zones={zones}
            regions={regions}
            selectedZoneId={selectedZoneId}
            selectedTool={editorSettings.selectedTool}
            settings={editorSettings}
            draft={editorDraft}
            regionPaintSettings={regionPaintSettings}
            onSettingsChange={handleEditorViewChange}
            onDraftChange={handleDraftChange}
            onZonesChange={setZones}
            onRegionsChange={setRegions}
            onRegionCheckpoint={captureCheckpoint}
            onSelectZone={handleSelectZone}
            onCheckpoint={captureCheckpoint}
            onDeleteZone={handleDeleteZone}
            onDuplicateZone={handleDuplicateSelected}
            onToggleZoneVisibility={handleToggleZoneVisibility}
            onCopyJson={handleCopyJson}
            onPasteZoneAt={handlePasteZoneAt}
            onConfirmDraft={handleConfirmDraft}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSaveShortcut={handleSaveShortcut}
            onToolChange={handleToolChange}
            onStatusMessage={onStatus}
            onMouseCoordinatesChange={setMouseCoords}
            onHoverZone={(zone) => setHoverZone(zone as WorldMapZone | null)}
          />
        </div>

        <ZoneEditorPanel
          draft={editorDraft}
          zones={zones}
          selectedZoneId={selectedZoneId}
          selectedTool={editorSettings.selectedTool}
          settings={editorSettings}
          jsonValue={editorJson}
          validationErrors={validationErrors}
          regionToolMode={regionToolMode}
          regionType={regionType}
          regionBrushSize={regionBrushSize}
          onRegionToolModeChange={setRegionToolMode}
          onRegionTypeChange={setRegionType}
          onRegionBrushSizeChange={setRegionBrushSize}
          onToolChange={handleToolChange}
          onSettingsChange={handleEditorViewChange}
          onDraftChange={handleDraftChange}
          onSaveNewZone={handleSaveNewZone}
          onUpdateSelected={handleUpdateSelectedZone}
          onDuplicateSelected={() => handleDuplicateSelected()}
          onDeleteSelected={() => handleDeleteZone()}
          onClearDraft={handleClearDraft}
          onClearAll={handleClearAllZones}
          onResetStorage={handleResetStorage}
          onExport={handleExportJson}
          onCopyJson={() => { void handleCopyJson(); }}
          onImportJson={handleImportJson}
          onValidateJson={handleValidateJson}
          onJsonChange={setEditorJson}
          onDeleteSelectedPoint={handleDeleteSelectedPoint}
          onReversePoints={handleReversePoints}
        />
      </div>

      <div className="wm-editor-statusbar card">
        <span>x: {mouseCoords.x?.toFixed(4) ?? '-'} y: {mouseCoords.y?.toFixed(4) ?? '-'}</span>
        <span>zoom {Math.round(editorSettings.zoom * 100)}%</span>
        <span>tool: {editorSettings.selectedTool}</span>
        <span>selected: {selectedZone?.id ?? '-'}</span>
        <span>draft: {editorDraft ? `${editorDraft.shape}${editorDraft.points.length ? ` (${editorDraft.points.length})` : ''}` : '-'}</span>
        <span>zones: {zones.length}</span>
        <span>regions: {regions.length}</span>
        <span>{autosaveStatus}</span>
      </div>
    </section>
  );

  return <section className="wm-shell">{worldMapMode === 'play' ? playLayout : editorLayout}</section>;
}

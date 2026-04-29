import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Equipment, InventoryState, ItemDefinition, StatBlock } from '@theend/rpg-domain';
import type { ArenaCharacter } from '../arena/types';
import { TopStatusBar } from './TopStatusBar';
import { PlayerQuickPanel } from './PlayerQuickPanel';
import { WorldMapCanvas, type WorldMapCanvasHandle } from './WorldMapCanvas';
import { ContextActionPanel } from './ContextActionPanel';
import { ZoneEditorPanel } from './ZoneEditorPanel';
import { NpcInteractionPanel } from './NpcInteractionPanel';
import { createEmptyHistory, createSnapshot, pushHistory, redoHistory, undoHistory, type ZoneEditorHistoryState } from './zoneEditorHistory';
import { clearEditorSettingsStorage, clearZoneStorage, exportEditorDataJson, loadEditorDataFromBackend, loadEditorSettings, saveEditorDataToBackend, saveEditorSettings, validateEditorDataJson } from './zoneEditorStorage';
import { replaceAllZones } from '../services/worldRepository';
import { createDefaultEditorSettings, createDraftFromZone, createEmptyZoneDraft, createZoneFromDraft, type PaintedRegion, type RegionBrushSize, type RegionToolMode, type RegionType, type WorldMapZone, type ZoneEditorDraft, type ZoneEditorSettings, type ZoneEditorTool } from './zoneEditorTypes';
import type { ChatMessage, ChatType, ContextMode, MapNodeData, PlayerWorldState, WorldMapMode } from './types';
import { getNearbyPlayers, canAttackNearbyPlayer, type NearbyPlayer } from './nearbyPlayersSystem';
import { WORLD_MAP_ZONES, type Zone } from './worldMapNodes';
import { getZoneCenter, moveZone } from './zoneGeometry';
import type { AdminMerchant } from '../services/content/models';
import { cityService } from '../services/cityRepository';
import { imageService } from '../services/content/imageService';
import type { City, CityLocation } from '../types/city';
import { subscribeToContentSync } from '../services/content/contentSync';
import { ensureQuestsLoaded, getAllPlayerQuestStates, getAllQuests } from '../services/questRepository';
import { tryStartRandomQuestFromZone } from '../services/questRuntime';
import type { PlayerQuestState, QuestDefinition, QuestMarkerDefinition } from '../types/quest';
import { ensureNpcsLoaded, getAllNpcs, saveNpc } from '../services/npcRepository';
import { getDialoguesByNpc } from '../services/dialogueRepository';
import { chooseDialogueOption, getStartNode } from '../services/dialogueRuntime';
import { getNearbyMappedNpcs } from '../services/npcMapRuntime';
import type { DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';

type LocationView = 'map' | 'city';
type SidePanelKey = 'adminEditor' | 'adminBattle' | 'contextActions' | 'npcInteraction' | 'nearbyNpc' | 'nearbyPlayers';

const DEFAULT_PLAYER_POSITION = { x: 0.53, y: 0.83 };
const UI_LEFT_PANEL_COLLAPSED_KEY = 'theend.worldMap.ui.leftPanelCollapsed';
const UI_RIGHT_PANEL_COLLAPSED_KEY = 'theend.worldMap.ui.rightPanelCollapsed';
const UI_CHAT_MINIMIZED_KEY = 'theend.worldMap.ui.chatMinimized';
const POPUP_HIDE_DELAY_MS = 3000;
const POPUP_FADE_DURATION_MS = 450;
function isCitySceneId(value: string | null | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === 'arklein' || normalized.startsWith('city_');
}

function normalizeCitySceneId(value: string | null | undefined): string {
  const normalized = (value ?? '').trim();
  const lower = normalized.toLowerCase();
  if (lower === 'arklein' || lower === 'arclein' || lower === 'arkea') {
    return 'city_arklein';
  }
  return normalized;
}

function getLocationPercent(location: CityLocation): { left: string; top: string; width: string; height: string } {
  const shape = location.shape;
  const x = Math.max(0, Math.min(1200, shape.x ?? 0));
  const y = Math.max(0, Math.min(720, shape.y ?? 0));
  if (location.shapeType === 'circle') {
    const radius = Math.max(20, shape.radius ?? 48);
    return {
      left: `${((x - radius) / 1200) * 100}%`,
      top: `${((y - radius) / 720) * 100}%`,
      width: `${((radius * 2) / 1200) * 100}%`,
      height: `${((radius * 2) / 720) * 100}%`,
    };
  }
  return {
    left: `${(x / 1200) * 100}%`,
    top: `${(y / 720) * 100}%`,
    width: `${((shape.width ?? 140) / 1200) * 100}%`,
    height: `${((shape.height ?? 90) / 720) * 100}%`,
  };
}

function getPlayerPositionStorageKey(characterId: string): string {
  return `theend.worldMap.playerPosition.${characterId}`;
}

function upsertQuestMarkerList(current: QuestMarkerDefinition[], marker: QuestMarkerDefinition): QuestMarkerDefinition[] {
  const index = current.findIndex((entry) => entry.id === marker.id);
  if (index === -1) {
    return [...current, marker];
  }
  return current.map((entry) => (entry.id === marker.id ? marker : entry));
}

function mergeQuestMarkerLists(primary: QuestMarkerDefinition[], fallback: QuestMarkerDefinition[]): QuestMarkerDefinition[] {
  const merged = new Map<string, QuestMarkerDefinition>();
  fallback.forEach((entry) => merged.set(entry.id, entry));
  primary.forEach((entry) => merged.set(entry.id, entry));
  return Array.from(merged.values());
}

function loadUiBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  return fallback;
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
  onStartCombat: () => Promise<void>;
  onStartBattleMap?: (battleMapId: string) => Promise<void>;
  onOpenMerchant: (merchantId?: string) => void;
  onOpenSkills: () => void;
  onStatus: (text: string) => void;
  cityMerchants?: AdminMerchant[];
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (item: ItemDefinition | null | undefined) => string | undefined;
  resolveMerchantImage?: (merchant: AdminMerchant | null | undefined) => string | undefined;
  playerAvatarUrl?: string;
  initialMode?: WorldMapMode;
  adminEditorOnly?: boolean;
  showAdminShortcuts?: boolean;
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
    onStartCombat,
    onStartBattleMap,
    onOpenMerchant,
    onOpenSkills,
    onStatus,
    cityMerchants = [],
    resolveItemById,
    resolveItemImage,
    resolveMerchantImage,
    playerAvatarUrl,
    initialMode = 'play',
    adminEditorOnly = false,
    showAdminShortcuts = false,
  } = props;

  const canvasRef = useRef<WorldMapCanvasHandle>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const popupTimeoutsRef = useRef<Map<string, { fadeTimer: number; removeTimer: number }>>(new Map());
  const seenPopupMessageIdsRef = useRef<Set<string>>(new Set());
  const skipNextZonePersistRef = useRef(true);
  const skipNextSettingsPersistRef = useRef(false);
  const worldMapRefreshRef = useRef<Promise<void> | null>(null);
  const lastWorldMapRefreshAtRef = useRef(0);
  const lastAggroNpcRef = useRef<{ id: string; at: number } | null>(null);

  const [worldMapMode, setWorldMapMode] = useState<WorldMapMode>(adminEditorOnly ? 'editor' : initialMode);
  const [contextMode, setContextMode] = useState<ContextMode>('empty');
  const [locationView, setLocationView] = useState<LocationView>('map');
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [activeCity, setActiveCity] = useState<City | null>(null);
  const [activeCityBackgroundUrl, setActiveCityBackgroundUrl] = useState('');
  const [currentZone, setCurrentZone] = useState<WorldMapZone | null>(null);
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [playerState, setPlayerState] = useState<PlayerWorldState>('idle');
  const [playerPosition, setPlayerPosition] = useState(() => loadPlayerPosition(character.id));
  const [playSpawnPosition, setPlaySpawnPosition] = useState(() => loadPlayerPosition(character.id));
  const [selectedNearbyPlayerId, setSelectedNearbyPlayerId] = useState<string | null>(null);
  const [chatType, setChatType] = useState<ChatType>('local');
  const [chatDraft, setChatDraft] = useState('');
  const [systemChat, setSystemChat] = useState<ChatMessage[]>([]);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => loadUiBoolean(UI_LEFT_PANEL_COLLAPSED_KEY, false));
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => loadUiBoolean(UI_RIGHT_PANEL_COLLAPSED_KEY, false));
  const [chatMinimized, setChatMinimized] = useState(() => loadUiBoolean(UI_CHAT_MINIMIZED_KEY, false));
  const [eventOverlayMessages, setEventOverlayMessages] = useState<Array<ChatMessage & { isFading: boolean }>>([]);
  const [collapsedSidePanels, setCollapsedSidePanels] = useState<Record<SidePanelKey, boolean>>({
    adminEditor: true,
    adminBattle: true,
    contextActions: true,
    npcInteraction: true,
    nearbyNpc: true,
    nearbyPlayers: true,
  });
  const [questDefinitions, setQuestDefinitions] = useState<QuestDefinition[]>([]);
  const [playerQuestStates, setPlayerQuestStates] = useState<PlayerQuestState[]>([]);
  const [questMarkers, setQuestMarkers] = useState<QuestMarkerDefinition[]>([]);
  const [selectedQuestMarkerId, setSelectedQuestMarkerId] = useState<string | null>(null);
  const [questMarkerDraft, setQuestMarkerDraft] = useState<QuestMarkerDefinition | null>(null);
  const [npcs, setNpcs] = useState<NpcDefinition[]>([]);
  const [selectedNpcIdForPlacement, setSelectedNpcIdForPlacement] = useState('');
  const [selectedNpcForInteractionId, setSelectedNpcForInteractionId] = useState<string | null>(null);
  const [activeDialogue, setActiveDialogue] = useState<DialogueDefinition | null>(null);
  const [activeDialogueNode, setActiveDialogueNode] = useState<DialogueNode | null>(null);
  const [dialogueLogs, setDialogueLogs] = useState<string[]>([]);

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
  const [lastMouseCoords, setLastMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<ZoneEditorHistoryState>(createEmptyHistory());

  const selectedLocationName = currentZone?.name ?? 'Пустоши';
  const nearbyPlayers = useMemo(() => getNearbyPlayers(), []);
  const nearbyNpcs = useMemo(
    () => getNearbyMappedNpcs('worldmap-main', playerPosition.x, playerPosition.y, 0.09),
    [playerPosition.x, playerPosition.y],
  );
  const playQuestMarkers = useMemo(
    () => questMarkers.filter((entry) => entry.mapId === 'worldmap-main' && entry.visibleToPlayer),
    [questMarkers],
  );
  const playNpcMarkers = useMemo(() => {
    // NPC interactions stay available, but map labels/markers are intentionally hidden.
    return [] as Array<{ id: string; name: string; kind: string; x: number; y: number; isHostile: boolean; hasQuest: boolean }>;
  }, []);
  const selectedNpcForInteraction = useMemo(() => {
    if (selectedNpcForInteractionId) {
      return npcs.find((entry) => entry.id === selectedNpcForInteractionId) ?? null;
    }
    return nearbyNpcs[0]?.npc ?? null;
  }, [nearbyNpcs, npcs, selectedNpcForInteractionId]);
  const selectedNearbyPlayer = useMemo(
    () => nearbyPlayers.find((entry) => entry.id === selectedNearbyPlayerId) ?? nearbyPlayers[0] ?? null,
    [nearbyPlayers, selectedNearbyPlayerId],
  );
  const cityMerchantById = useMemo(
    () => new Map(cityMerchants.map((merchant) => [merchant.id, merchant])),
    [cityMerchants],
  );
  const visibleCityLocations = useMemo(
    () => (activeCity?.locations ?? []).filter((location) => location.isVisible && location.isUnlocked),
    [activeCity?.locations],
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
        setQuestMarkers((current) => mergeQuestMarkerLists(loaded.questMarkers, current));
        replaceAllZones(loaded.zones);
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
    if (worldMapMode !== 'editor') {
      return;
    }

    let cancelled = false;
    void loadEditorDataFromBackend(cloneZones(WORLD_MAP_ZONES))
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        skipNextZonePersistRef.current = true;
        setZones(loaded.zones);
        setRegions(loaded.regions);
        setQuestMarkers(loaded.questMarkers);
        replaceAllZones(loaded.zones);
      })
      .catch(() => {
        // Keep the current editor state if backend content is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [worldMapMode]);

  useEffect(() => {
    setEditorJson(exportEditorDataJson(zones, regions, questMarkers));
  }, [questMarkers, regions, zones]);

  useEffect(() => {
    if (!activeCityId) {
      setActiveCity(null);
      setActiveCityBackgroundUrl('');
      return;
    }

    let cancelled = false;
    cityService.getCityById(activeCityId)
      .then((city) => {
        if (!cancelled) {
          setActiveCity(city);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveCity(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCityId]);

  useEffect(() => {
    let cancelled = false;
    const imageId = activeCity?.backgroundImageId?.trim();
    const fallbackUrl = activeCity?.backgroundImageUrl?.trim() || '';

    if (!imageId) {
      setActiveCityBackgroundUrl(fallbackUrl);
      return;
    }

    if (!imageId.startsWith('img_')) {
      setActiveCityBackgroundUrl(imageId);
      return;
    }

    imageService.get(imageId)
      .then((image) => {
        if (!cancelled) {
          setActiveCityBackgroundUrl(image?.dataUrl ?? fallbackUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveCityBackgroundUrl(fallbackUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCity?.backgroundImageId, activeCity?.backgroundImageUrl]);

  useEffect(() => {
    void Promise.all([
      ensureQuestsLoaded(),
      ensureNpcsLoaded(),
    ]).then(() => {
      setQuestDefinitions(getAllQuests());
      setPlayerQuestStates(getAllPlayerQuestStates().filter((entry) => entry.playerId === character.id));
      setNpcs(getAllNpcs());
    }).catch(() => {
      setQuestDefinitions([]);
      setQuestMarkers([]);
      setNpcs([]);
    });
  }, [character.id]);

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
        if (zones.length === 0 && regions.length === 0 && questMarkers.length === 0) {
          clearZoneStorage();
          await saveEditorDataToBackend([], [], []);
          replaceAllZones([]);
        } else {
          await saveEditorDataToBackend(zones, regions, questMarkers);
          replaceAllZones(zones);
        }
        setAutosaveStatus('autosaved');
      } catch {
        setAutosaveStatus('save failed');
      }
    })();
  }, [questMarkers, regions, worldMapMode, zones]);

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

    const questPool = (zone.randomQuestPoolIds ?? []).filter(Boolean);
    if (questPool.length > 0) {
      const triggered = tryStartRandomQuestFromZone(
        {
          id: character.id,
          level: character.level,
          race: character.race,
        },
        zone.id,
        questPool,
        zone.chancePercent ?? 10,
        zone.cooldownSeconds ?? 120,
      );

      if (triggered) {
        const questEntry: ChatMessage = {
          id: `sys-quest-${Date.now()}-${triggered.id}`,
          text: `Новый квест: ${triggered.title}`,
          type: 'system',
        };
        setSystemChat((prev) => [...prev, questEntry].slice(-12));
        setPlayerQuestStates(getAllPlayerQuestStates().filter((state) => state.playerId === character.id));
      }
    }
  }, [character.id, character.level, character.race, worldMapMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(UI_LEFT_PANEL_COLLAPSED_KEY, String(leftPanelCollapsed));
  }, [leftPanelCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(UI_RIGHT_PANEL_COLLAPSED_KEY, String(rightPanelCollapsed));
  }, [rightPanelCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(UI_CHAT_MINIMIZED_KEY, String(chatMinimized));
  }, [chatMinimized]);

  useEffect(() => {
    if (chatMinimized) {
      return;
    }
    const element = chatLogRef.current;
    if (!element) {
      return;
    }
    element.scrollTop = element.scrollHeight;
  }, [chatMessages, chatMinimized]);

  useEffect(() => {
    const freshMessages = chatMessages.filter(
      (message) => message.type === 'system' && message.text.trim().length > 0 && !seenPopupMessageIdsRef.current.has(message.id),
    );

    if (freshMessages.length === 0) {
      return;
    }

    for (const message of freshMessages) {
      seenPopupMessageIdsRef.current.add(message.id);

      setEventOverlayMessages((current) => {
        const next = [...current, { ...message, isFading: false }];
        return next.slice(-4);
      });

      const fadeTimer = window.setTimeout(() => {
        setEventOverlayMessages((current) => current.map((entry) => (
          entry.id === message.id ? { ...entry, isFading: true } : entry
        )));
      }, Math.max(0, POPUP_HIDE_DELAY_MS - POPUP_FADE_DURATION_MS));

      const removeTimer = window.setTimeout(() => {
        setEventOverlayMessages((current) => current.filter((entry) => entry.id !== message.id));
        popupTimeoutsRef.current.delete(message.id);
      }, POPUP_HIDE_DELAY_MS);

      popupTimeoutsRef.current.set(message.id, { fadeTimer, removeTimer });
    }
  }, [chatMessages]);

  useEffect(() => () => {
    popupTimeoutsRef.current.forEach(({ fadeTimer, removeTimer }) => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    });
    popupTimeoutsRef.current.clear();
  }, []);

  const handleSelectQuestMarker = useCallback((id: string | null) => {
    setSelectedQuestMarkerId(id);
    if (!id) {
      setQuestMarkerDraft(null);
      return;
    }

    const existing = questMarkers.find((entry) => entry.id === id) ?? null;
    setQuestMarkerDraft(existing ? { ...existing } : null);
    if (existing && worldMapMode === 'editor') {
      canvasRef.current?.focusPoint([existing.x, existing.y]);
    }
  }, [questMarkers, worldMapMode]);

  const handleSaveQuestMarker = useCallback(async () => {
    const draft = questMarkerDraft ?? {
      id: `marker_${Date.now()}`,
      title: 'Новый маркер',
      mapId: 'worldmap-main',
      x: lastMouseCoords?.x ?? mouseCoords.x ?? 0.5,
      y: lastMouseCoords?.y ?? mouseCoords.y ?? 0.5,
      type: 'quest_start' as const,
      visibleToPlayer: true,
      conditionIds: [],
    };

    if (!draft.id.trim() || !draft.title.trim()) {
      onStatus('Quest marker: id и title обязательны.');
      return;
    }

    const existing = questMarkers.find((entry) => entry.id === draft.id.trim()) ?? null;
    const useCursorForNewMarker = !existing
      && lastMouseCoords
      && draft.x === 0.5
      && draft.y === 0.5;

    const normalized: QuestMarkerDefinition = {
      ...draft,
      id: draft.id.trim(),
      title: draft.title.trim(),
      mapId: String(draft.mapId ?? 'worldmap-main').trim() || 'worldmap-main',
      x: useCursorForNewMarker
        ? lastMouseCoords.x
        : (typeof draft.x === 'number' && Number.isFinite(draft.x) ? Math.max(0, Math.min(1, draft.x)) : 0.5),
      y: useCursorForNewMarker
        ? lastMouseCoords.y
        : (typeof draft.y === 'number' && Number.isFinite(draft.y) ? Math.max(0, Math.min(1, draft.y)) : 0.5),
      visibleToPlayer: draft.visibleToPlayer !== false,
      conditionIds: Array.isArray(draft.conditionIds) ? draft.conditionIds : [],
    };

    setQuestMarkers((current) => upsertQuestMarkerList(current, normalized));
    setSelectedQuestMarkerId(normalized.id);
    setQuestMarkerDraft({ ...normalized });
    onStatus(`Quest marker сохранен: ${normalized.title}.`);
  }, [lastMouseCoords, mouseCoords.x, mouseCoords.y, onStatus, questMarkerDraft, questMarkers]);

  const handleDeleteQuestMarker = useCallback(async () => {
    if (!selectedQuestMarkerId) {
      return;
    }
    setQuestMarkers((current) => current.filter((entry) => entry.id !== selectedQuestMarkerId));
    setSelectedQuestMarkerId(null);
    setQuestMarkerDraft(null);
    onStatus('Quest marker удален.');
  }, [onStatus, selectedQuestMarkerId]);

  const handleMouseCoordinatesChange = useCallback((coords: { x: number | null; y: number | null }) => {
    setMouseCoords(coords);
    if (typeof coords.x === 'number' && Number.isFinite(coords.x) && typeof coords.y === 'number' && Number.isFinite(coords.y)) {
      setLastMouseCoords({ x: coords.x, y: coords.y });
    }
  }, []);

  const handlePlaceQuestMarkerAtCursor = useCallback(() => {
    const cursor = typeof mouseCoords.x === 'number' && Number.isFinite(mouseCoords.x) && typeof mouseCoords.y === 'number' && Number.isFinite(mouseCoords.y)
      ? { x: mouseCoords.x, y: mouseCoords.y }
      : lastMouseCoords;

    if (!cursor) {
      onStatus('Наведите курсор на карту, чтобы получить координаты.');
      return;
    }

    setQuestMarkerDraft((current) => {
      const base = current ?? {
        id: `marker_${Date.now()}`,
        title: 'Новый маркер',
        mapId: 'worldmap-main',
        x: cursor.x,
        y: cursor.y,
        type: 'quest_start' as const,
        visibleToPlayer: true,
        conditionIds: [] as string[],
      };
      return { ...base, x: cursor.x, y: cursor.y };
    });
    onStatus(`Quest marker: coords set to x:${cursor.x.toFixed(4)} y:${cursor.y.toFixed(4)}.`);
  }, [lastMouseCoords, mouseCoords.x, mouseCoords.y, onStatus]);

  useEffect(() => {
    if (!selectedNpcForInteractionId && nearbyNpcs[0]?.npc.id) {
      setSelectedNpcForInteractionId(nearbyNpcs[0].npc.id);
    }
  }, [nearbyNpcs, selectedNpcForInteractionId]);

  useEffect(() => {
    if (worldMapMode !== 'play') {
      return;
    }
    const hostile = nearbyNpcs.find((entry) => (entry.npc.defaultDisposition === 'hostile' || entry.npc.defaultDisposition === 'aggressive_on_sight') && entry.npc.canFight);
    if (!hostile) {
      return;
    }
    const now = Date.now();
    if (lastAggroNpcRef.current && lastAggroNpcRef.current.id === hostile.npc.id && now - lastAggroNpcRef.current.at < 12000) {
      return;
    }
    lastAggroNpcRef.current = { id: hostile.npc.id, at: now };
    setSelectedNpcForInteractionId(hostile.npc.id);
    setContextMode('combat');
    onStatus(`${hostile.npc.name} атакует вас при приближении.`);
    void onStartCombat();
  }, [nearbyNpcs, onStartCombat, onStatus, worldMapMode]);

  const handlePlaceNpcAtCursor = useCallback(async () => {
    if (!selectedNpcIdForPlacement) {
      onStatus('Выберите NPC для размещения.');
      return;
    }
    if (mouseCoords.x === null || mouseCoords.y === null) {
      onStatus('Наведите курсор на карту, чтобы получить координаты.');
      return;
    }

    const npc = npcs.find((entry) => entry.id === selectedNpcIdForPlacement);
    if (!npc) {
      onStatus('NPC не найден.');
      return;
    }

    const binding = {
      id: `npc_map_${Date.now()}`,
      mapId: 'worldmap-main',
      x: mouseCoords.x,
      y: mouseCoords.y,
      spawnType: 'fixed' as const,
      visibleToPlayer: true,
    };

    const saved = await saveNpc({
      ...npc,
      mapBindings: [...npc.mapBindings, binding],
      updatedAt: new Date().toISOString(),
    });

    const all = getAllNpcs();
    setNpcs(all);
    setSelectedNpcForInteractionId(saved.id);
    onStatus(`NPC размещен: ${saved.name} (${binding.x.toFixed(3)}, ${binding.y.toFixed(3)}).`);
  }, [mouseCoords.x, mouseCoords.y, npcs, onStatus, selectedNpcIdForPlacement]);

  const handleNpcTalk = useCallback(() => {
    if (!selectedNpcForInteraction) {
      return;
    }
    const dialogues = getDialoguesByNpc(selectedNpcForInteraction.id).filter((entry) => entry.status !== 'disabled');
    const first = dialogues[0] ?? null;
    if (!first) {
      onStatus('У этого NPC пока нет диалогов.');
      setActiveDialogue(null);
      setActiveDialogueNode(null);
      return;
    }
    setActiveDialogue(first);
    setActiveDialogueNode(getStartNode(first));
    setDialogueLogs((prev) => [...prev, `Open dialogue: ${first.id}`].slice(-12));
  }, [onStatus, selectedNpcForInteraction]);

  const handleNpcTrade = useCallback(() => {
    if (!selectedNpcForInteraction?.traderId) {
      onStatus('У NPC не настроен trader profile.');
      return;
    }
    onOpenMerchant(selectedNpcForInteraction.traderId);
  }, [onOpenMerchant, onStatus, selectedNpcForInteraction]);

  const handleNpcTrain = useCallback(() => {
    if (!selectedNpcForInteraction?.canTrain) {
      onStatus('Этот NPC не обучает навыкам.');
      return;
    }
    onOpenSkills();
    const trainerCount = selectedNpcForInteraction.trainer?.skillIds?.length ?? 0;
    onStatus(`Открыто обучение у NPC: ${selectedNpcForInteraction.name}. Доступно навыков: ${trainerCount}.`);
  }, [onOpenSkills, onStatus, selectedNpcForInteraction]);

  const handleNpcAttack = useCallback(async () => {
    if (!selectedNpcForInteraction?.canFight) {
      onStatus('Этот NPC не доступен для боя.');
      return;
    }
    await onStartCombat();
  }, [onStartCombat, onStatus, selectedNpcForInteraction]);

  const handleNpcQuest = useCallback(() => {
    if (!selectedNpcForInteraction) {
      return;
    }
    setContextMode('npc');
    if (!selectedNpcForInteraction.canGiveQuests && selectedNpcForInteraction.questBindings.length === 0) {
      onStatus('У NPC нет активных квестовых связок.');
      return;
    }
    handleNpcTalk();
    onStatus(`Квестовый диалог с NPC: ${selectedNpcForInteraction.name}.`);
  }, [handleNpcTalk, onStatus, selectedNpcForInteraction]);

  const handleNpcInspect = useCallback(() => {
    if (!selectedNpcForInteraction) {
      return;
    }
    onStatus(`${selectedNpcForInteraction.name}: ${selectedNpcForInteraction.description || 'без описания'}`);
  }, [onStatus, selectedNpcForInteraction]);

  const handleSelectDialogueChoice = useCallback((choiceId: string) => {
    if (!selectedNpcForInteraction || !activeDialogue || !activeDialogueNode) {
      return;
    }
    try {
      const result = chooseDialogueOption(
        character.id,
        selectedNpcForInteraction.id,
        activeDialogue.id,
        activeDialogueNode.id,
        choiceId,
      );
      setDialogueLogs((prev) => [...prev, ...result.logs].slice(-20));
      setActiveDialogueNode(result.nextNode);
      if (result.ended) {
        setDialogueLogs((prev) => [...prev, 'Dialogue ended.'].slice(-20));
      }
    } catch (error) {
      onStatus((error as Error).message);
    }
  }, [activeDialogue, activeDialogueNode, character.id, onStatus, selectedNpcForInteraction]);

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
    replaceAllZones([]);
    setQuestMarkers([]);
    void saveEditorDataToBackend([], [], []);
    onStatus('Editor: all zones and regions cleared.');
  }

  function handleResetStorage() {
    skipNextZonePersistRef.current = true;
    skipNextSettingsPersistRef.current = true;
    clearZoneStorage();
    void saveEditorDataToBackend([], [], []);
    clearEditorSettingsStorage();
    setZones(cloneZones(WORLD_MAP_ZONES));
    replaceAllZones(cloneZones(WORLD_MAP_ZONES));
    setRegions([]);
    setQuestMarkers([]);
    setEditorSettings(createDefaultEditorSettings());
    setSelectedZoneId(null);
    setEditorDraft(null);
    setValidationErrors([]);
    setHistory(createEmptyHistory());
    setEditorJson(exportEditorDataJson(cloneZones(WORLD_MAP_ZONES), [], []));
    onStatus('Editor: storage reset to defaults.');
  }

  function handleExportJson() {
    setEditorJson(exportEditorDataJson(zones, regions, questMarkers));
    setValidationErrors([]);
    onStatus('Editor: JSON exported to textarea.');
  }

  async function handleCopyJson(zone: WorldMapZone | null = selectedZone) {
    const payload = zone ? JSON.stringify(zone, null, 2) : exportEditorDataJson(zones, regions, questMarkers);
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
      return { valid: false, errors: ['Invalid JSON syntax'], zones: [], regions: [], questMarkers: [] };
    }
  }

  function handleValidateJson() {
    const result = validateJsonText(editorJson);
    setValidationErrors(result.errors);
    onStatus(result.valid
      ? `JSON valid: ${result.zones.length} zones, ${result.regions.length} regions, ${result.questMarkers.length} quest markers`
      : `JSON invalid: ${result.errors.length} errors`);
  }

  function mergeImportedData(importedZones: WorldMapZone[], importedRegions: PaintedRegion[], importedQuestMarkers: QuestMarkerDefinition[]) {
    const importedIds = new Set(importedZones.map((zone) => zone.id));
    const importedRegionIds = new Set(importedRegions.map((region) => region.id));
    const importedQuestMarkerIds = new Set(importedQuestMarkers.map((marker) => marker.id));
    const duplicates = zones.filter((zone) => importedIds.has(zone.id));
    const regionDuplicates = regions.filter((region) => importedRegionIds.has(region.id));
    const markerDuplicates = questMarkers.filter((marker) => importedQuestMarkerIds.has(marker.id));
    if ((duplicates.length > 0 || regionDuplicates.length > 0 || markerDuplicates.length > 0)
      && !window.confirm(`Replace ${duplicates.length} zones, ${regionDuplicates.length} regions and ${markerDuplicates.length} quest markers with matching ids?`)) {
      return false;
    }

    captureCheckpoint();
    setZones((prev) => [...prev.filter((zone) => !importedIds.has(zone.id)), ...importedZones]);
    setRegions((prev) => [...prev.filter((region) => !importedRegionIds.has(region.id)), ...importedRegions]);
    setQuestMarkers((prev) => [...prev.filter((marker) => !importedQuestMarkerIds.has(marker.id)), ...importedQuestMarkers]);
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

    if (mergeImportedData(result.zones, result.regions, result.questMarkers)) {
      onStatus(`Editor: imported ${result.zones.length} zones, ${result.regions.length} regions and ${result.questMarkers.length} quest markers.`);
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
    void saveEditorDataToBackend(zones, regions, questMarkers);
    replaceAllZones(zones);
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

      setLocationView('city');
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
    const targetScene = zone?.targetScene?.trim().toLowerCase();
    const opensCityScene = isCitySceneId(locationId) || isCitySceneId(targetScene);
    if (!opensCityScene) {
      onStatus(`Локация ${locationId} пока недоступна.`);
      return;
    }
    const cityId = normalizeCitySceneId(targetScene && isCitySceneId(targetScene) ? targetScene : locationId);
    rememberCurrentMapPosition();
    setActiveCityId(cityId);
    setLocationView('city');
    setContextMode('location');
    setPlayerState('in_city');
    onStatus(`Вы вошли в ${zone?.name ?? 'город'}.`);
  }

  function handleReturnToMap() {
    rememberCurrentMapPosition();
    setActiveCityId(null);
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

  const toggleSidePanel = useCallback((panel: SidePanelKey) => {
    setCollapsedSidePanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }, []);

  const renderSidePanel = useCallback((panel: SidePanelKey, title: string, content: React.ReactNode) => {
    const isCollapsed = collapsedSidePanels[panel];
    return (
      <section className={`wm-side-module ${isCollapsed ? 'is-collapsed' : ''}`}>
        <button
          type="button"
          className="wm-side-module-toggle"
          aria-expanded={!isCollapsed}
          onClick={() => toggleSidePanel(panel)}
        >
          <span>{title}</span>
          <span className="wm-side-module-caret" aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
        </button>
        {!isCollapsed ? <div className="wm-side-module-body">{content}</div> : null}
      </section>
    );
  }, [collapsedSidePanels, toggleSidePanel]);

  function handleCityLocation(location: CityLocation) {
    if (location.shopIds.length > 0) {
      onOpenMerchant(location.shopIds[0]);
      onStatus(`Opened shop from ${location.name}.`);
      return;
    }
    if (location.linkedBattleMapId) {
      void (onStartBattleMap ? onStartBattleMap(location.linkedBattleMapId) : onStartCombat());
      onStatus(`Starting encounter from ${location.name}.`);
      return;
    }
    if (location.npcIds.length > 0) {
      setSelectedNpcForInteractionId(location.npcIds[0]);
      setContextMode('npc');
      onStatus(`NPC interaction: ${location.name}.`);
      return;
    }
    if (location.questIds.length > 0) {
      onStatus(`Quest hook: ${location.questIds[0]} at ${location.name}.`);
      return;
    }
    onStatus(`${location.name}: ${location.description?.trim() || 'No action configured.'}`);
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
        <div className={`wm-left-panel ${leftPanelCollapsed ? 'is-collapsed' : ''}`}>
          <button
            type="button"
            className="wm-panel-collapse-btn wm-panel-collapse-btn-left"
            aria-label={leftPanelCollapsed ? 'Развернуть левую панель' : 'Свернуть левую панель'}
            aria-expanded={!leftPanelCollapsed}
            onClick={() => setLeftPanelCollapsed((current: boolean) => !current)}
          >
            {leftPanelCollapsed ? '▶' : '◀'}
          </button>
          <PlayerQuickPanel
            name={character.name}
            avatarLetter={avatarLetter}
            avatarUrl={playerAvatarUrl}
            hpText={`${battleStats.hp}/${character.activeStats.hp}`}
            mpText={`${battleStats.mp}/${character.activeStats.mp}`}
            staminaText={`${battleStats.stamina}/${character.activeStats.stamina}`}
            activeStats={character.activeStats as StatBlock}
            equipment={equipment}
            inventory={inventory}
            quickActions={quickButtons}
            resolveItemById={resolveItemById}
            resolveItemImage={resolveItemImage}
            worldStatusLines={[
              `Локация: ${selectedLocationName}`,
              `Коорд: ${playerPosition.x.toFixed(3)}, ${playerPosition.y.toFixed(3)}`,
              `Состояние: ${playerState}`,
              `Под курсором: ${hoverZone?.name ?? '-'}`,
              'Онлайн: 124',
              '22:41',
            ]}
          />
        </div>

        <div className="wm-main-column">
          {locationView === 'map' ? (
            <WorldMapCanvas
              mode="play"
              playerStartPosition={playSpawnPosition}
              zones={zones}
              regions={regions}
              playQuestMarkers={playQuestMarkers}
              playNpcMarkers={playNpcMarkers}
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
                style={{
                  backgroundImage: activeCityBackgroundUrl
                    ? `linear-gradient(rgba(24, 17, 12, 0.28), rgba(24, 17, 12, 0.52)), url('${activeCityBackgroundUrl}')`
                    : 'linear-gradient(135deg, rgba(38, 29, 20, 0.96), rgba(14, 12, 10, 0.98))',
                }}
              >
                <div className="wm-map-title">{activeCity?.name ?? selectedLocationName}</div>
                <div className="wm-city-hotspots">
                  {visibleCityLocations.map((location) => {
                    const locationMerchant = location.shopIds?.[0]
                      ? cityMerchantById.get(location.shopIds[0]) ?? null
                      : null;
                    const merchantImage = locationMerchant && resolveMerchantImage
                      ? resolveMerchantImage(locationMerchant)
                      : undefined;
                    return (
                      <button
                        key={location.id}
                        type="button"
                        className={`city-location-hotspot city-location-hotspot-${location.shapeType}`}
                        style={getLocationPercent(location)}
                        onClick={() => {
                          const merchantId = location.shopIds?.[0];
                          if (merchantId) {
                            onOpenMerchant(merchantId);
                            onStatus(`Opened shop from ${location.name}.`);
                            return;
                          }

                          const battleMapId = location.linkedBattleMapId?.trim();
                          if (battleMapId && onStartBattleMap) {
                            void onStartBattleMap(battleMapId);
                            return;
                          }

                          void handleCityLocation(location);
                        }}
                      >
                        <span className="city-location-hotspot-title">{location.name}</span>
                        {locationMerchant ? (
                          <span className="city-location-hotspot-merchant">
                            {merchantImage ? (
                              <img
                                className="city-location-hotspot-thumb"
                                src={merchantImage}
                                alt={locationMerchant.name}
                              />
                            ) : null}
                            <span className="city-location-hotspot-merchant-name">
                              {locationMerchant.name}
                            </span>
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  {activeCity && visibleCityLocations.length === 0 ? (
                    <div className="wm-city-empty-note">
                      В этом городе пока нет торговцев из админки. Привяжите торговца к `cityId` или названию города.
                    </div>
                  ) : null}
                </div>
              </div>
              <footer className="wm-map-legend">
                <span>{selectedLocationName} | Торговцы из админки появляются здесь автоматически, если у них указан `cityId` или совпадающее имя города.</span>
                <button className="wm-city-back" onClick={handleReturnToMap}>Назад к карте</button>
              </footer>
            </section>
          )}

          <div className="wm-chat-dock">
            <div className="wm-event-overlay" aria-live="polite">
              {eventOverlayMessages.map((line) => (
                <p key={`overlay-${line.id}`} className={`wm-event-line type-${line.type} ${line.isFading ? 'is-fading' : ''}`}>{line.text}</p>
              ))}
            </div>

            <section className={`wm-chat card wm-chat-under-map chat-container ${chatMinimized ? 'is-minimized' : ''}`}>
              <div className="wm-chat-header">
                <h3>Чат</h3>
                <button
                  type="button"
                  className="wm-chat-minimize-btn"
                  aria-label={chatMinimized ? 'Развернуть чат' : 'Свернуть чат'}
                  aria-expanded={!chatMinimized}
                  onClick={() => setChatMinimized((current: boolean) => !current)}
                >
                  {chatMinimized ? '▲' : '▼'}
                </button>
              </div>
              <div ref={chatLogRef} className="wm-chat-log chat-messages">
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
        </div>

        <div className={`wm-right-panel ${rightPanelCollapsed ? 'is-collapsed' : ''}`}>
          <button
            type="button"
            className="wm-panel-collapse-btn wm-panel-collapse-btn-right"
            aria-label={rightPanelCollapsed ? 'Развернуть правую панель' : 'Свернуть правую панель'}
            aria-expanded={!rightPanelCollapsed}
            onClick={() => setRightPanelCollapsed((current: boolean) => !current)}
          >
            {rightPanelCollapsed ? '◀' : '▶'}
          </button>

          <div className="wm-right-stack">
            {showAdminShortcuts ? (
            <>
              {renderSidePanel('adminEditor', 'Admin инструменты', (
                <div className="wm-editor-launch card">
                  <button
                    onClick={() => {
                      window.open('/admin/zone-editor', '_blank', 'noopener,noreferrer');
                      onStatus('Zone Editor открыт в отдельном окне админки.');
                    }}
                  >
                    Zone Editor (Admin)
                  </button>
                </div>
              ))}

              {renderSidePanel('adminBattle', 'Battle Map Editor', (
                <section className="wm-battle-map-panel card">
                  <div className="wm-battle-map-head">
                    <h3>Battle Map Editor</h3>
                  </div>

                  <div className="wm-action-grid">
                    <button
                      onClick={() => {
                        window.open('/admin/battle-maps', '_blank', 'noopener,noreferrer');
                        onStatus('Battle Map Editor открыт в отдельном окне админки.');
                      }}
                    >
                      Открыть редактор баттл-карт
                    </button>
                    <button onClick={() => { void onStartCombat(); }}>Start test battle</button>
                  </div>
                </section>
              ))}
            </>
            ) : null}

            {renderSidePanel('contextActions', 'Последние события и действия', (
              <ContextActionPanel
                mode={contextMode}
                selectedNode={selectedNode}
                quests={questDefinitions}
                playerQuestStates={playerQuestStates}
                onAction={(actionId, kind) => { void handleAction(actionId, kind); }}
              />
            ))}

            {renderSidePanel('npcInteraction', 'NPC взаимодействие', (
              <NpcInteractionPanel
                npc={selectedNpcForInteraction}
                dialogue={activeDialogue}
                node={activeDialogueNode}
                logs={dialogueLogs}
                onTalk={handleNpcTalk}
                onTrade={handleNpcTrade}
                onTrain={handleNpcTrain}
                onAttack={() => { void handleNpcAttack(); }}
                onQuest={handleNpcQuest}
                onInspect={handleNpcInspect}
                onSelectChoice={handleSelectDialogueChoice}
              />
            ))}

            {renderSidePanel('nearbyNpc', 'NPC рядом', (
              <section className="wm-context card" style={{ borderTop: 'none' }}>
                <section className="wm-context-block">
                  {nearbyNpcs.length > 0 ? nearbyNpcs.map((entry) => (
                    <button
                      key={entry.npc.id}
                      style={{ width: '100%', marginBottom: '6px', textAlign: 'left', opacity: selectedNpcForInteraction?.id === entry.npc.id ? 1 : 0.82 }}
                      onClick={() => setSelectedNpcForInteractionId(entry.npc.id)}
                    >
                      {entry.npc.name} [{entry.npc.kind}] ({entry.distance.toFixed(3)})
                    </button>
                  )) : <p className="muted">Нет NPC в радиусе взаимодействия.</p>}
                </section>
              </section>
            ))}

            {renderSidePanel('nearbyPlayers', 'Игроки рядом', (
              <section className="wm-context card" style={{ borderTop: 'none' }}>
                <section className="wm-context-block">
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
            ))}
          </div>
        </div>
      </section>

    </>
  );

  const editorLayout = (
    <section className={`wm-editor-shell ${adminEditorOnly ? 'is-admin-editor' : ''}`}>
      <div className="wm-editor-toolbar card">
        <div className="wm-editor-toolbar-group">
          {!adminEditorOnly ? <button onClick={() => setMode('play')}>Play Mode</button> : null}
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
            onMouseCoordinatesChange={handleMouseCoordinatesChange}
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
          questMarkers={questMarkers}
          selectedQuestMarkerId={selectedQuestMarkerId}
          questMarkerDraft={questMarkerDraft}
          onSelectQuestMarker={handleSelectQuestMarker}
          onQuestMarkerDraftChange={setQuestMarkerDraft}
          onSaveQuestMarker={handleSaveQuestMarker}
          onDeleteQuestMarker={handleDeleteQuestMarker}
          onPlaceQuestMarkerAtCursor={handlePlaceQuestMarkerAtCursor}
          npcOptions={npcs}
          selectedNpcIdForPlacement={selectedNpcIdForPlacement}
          onSelectNpcForPlacement={setSelectedNpcIdForPlacement}
          onPlaceNpcAtCursor={handlePlaceNpcAtCursor}
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

  if (adminEditorOnly) {
    return <section className="wm-shell wm-shell-admin-editor">{editorLayout}</section>;
  }

  return <section className="wm-shell">{worldMapMode === 'play' ? playLayout : editorLayout}</section>;
}

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from "react";
import type {
  Equipment,
  InventoryState,
  ItemDefinition,
  StatBlock,
} from "@theend/rpg-domain";
import { addProfessionXp, getPlayerProfession, normalizePlayerProfessionsState, PROFESSION_DEFINITIONS, Race } from "@theend/rpg-domain";
import type { ArenaCharacter } from "../arena/types";
import type { CustomArenaNpcPayload, NearbyPvpPlayer } from "../api";
import { challengePvpPlayer, fetchNearbyPvpPlayers } from "../api";
import { TopStatusBar } from "./TopStatusBar";
import { PlayerQuickPanel } from "./PlayerQuickPanel";
import { WorldMapCanvas, type WorldMapCanvasHandle } from "./WorldMapCanvas";
import { PhaserWorldMapCanvas } from "./PhaserWorldMapCanvas";
import { readWorldRendererSetting, writeWorldRendererSetting, type WorldRendererKind } from "./worldRendererSettings";
import { WorldMapViewer } from "./WorldMapViewer";
import { MiniMapWidget } from "./MiniMapWidget";
import { TutorialOverlay } from "./TutorialOverlay";
import { resolveQuestIcon, resolveQuestMarkerObjectiveText } from "./questVisuals";
import { ZoneEditorPanel } from "./ZoneEditorPanel";
import { QuestJournalModal } from "./QuestJournalModal";
import { QuestInteractionModal } from "./QuestInteractionModal";
import {
  createEmptyHistory,
  createSnapshot,
  pushHistory,
  redoHistory,
  undoHistory,
  type ZoneEditorHistoryState,
} from "./zoneEditorHistory";
import {
  clearEditorSettingsStorage,
  clearZoneStorage,
  exportEditorDataJson,
  loadEditorDataFromBackend,
  loadEditorSettings,
  saveEditorDataToBackend,
  saveEditorSettings,
  validateEditorDataJson,
} from "./zoneEditorStorage";
import {
  applyWorldMapRepairAction,
  validateWorldMapContent,
  type WorldMapRepairActionId,
  type WorldMapValidationIssue,
} from "./worldMapValidation";
import { replaceAllZones } from "../services/worldRepository";
import {
  createDefaultEditorSettings,
  createDraftFromZone,
  createEmptyZoneDraft,
  createZoneFromDraft,
  type PaintedRegion,
  type RegionBrushSize,
  type RegionToolMode,
  type RegionType,
  type WorldMapZone,
  type WorldAudioCue,
  type ZoneEditorDraft,
  type ZoneEditorSettings,
  type ZoneEditorTool,
} from "./zoneEditorTypes";
import {
  getDefaultBlocksClick,
  getDefaultEditorLayer,
  getDefaultInteractionMode,
  getDefaultLayerVisibilityState,
  getDefaultPassiveEffects,
  getDefaultPlayerClickable,
  getDefaultTypeForLayer,
  getDefaultZoneColor,
  type LayerVisibilityMode,
  type LayerVisibilityState,
  type MapEditorLayer,
} from "./zoneTaxonomy";
import type {
  ChatMessage,
  ChatType,
  ContextMode,
  MapNodeData,
  PlayerWorldState,
  WorldMapMode,
} from "./types";
import { WORLD_MAP_ZONES, type Zone } from "./worldMapNodes";
import { clamp, getZoneCenter, moveZone } from "./zoneGeometry";
import { detectHoverZone, getPassiveZonesAtPoint, isInsideZone } from "./zoneSystem";
import { type MapPlayer } from "./movementSystem";
import {
  getPaintedRegionCellMap,
  getRegionMoveSpeedMultiplier,
  getRegionStaminaCostMultiplier,
  isBlockedRegionType,
  REGION_GRID_SIZE,
  REGION_TYPE_HEX_COLORS,
} from "./regionPaintSystem";
import {
  canEnterLinkedLocation,
  getLocationActiveState,
  getZoneLinkedLocation,
  isLinkedLocationVisibleToPlayer,
} from "./zoneLocationLinking";
import type { AdminMerchant, StoredImage } from "../services/content/models";
import {
  getContentSnapshot,
  type ContentSnapshot,
} from "../services/content/contentApi";
import { cityService } from "../services/cityRepository";
import { imageService } from "../services/content/imageService";
import { loadRuntimeImages, resolveStoredImageSource } from "../services/content/runtimeImageService";
import type { City, CityLocation } from "../types/city";
import { subscribeToContentSync } from "../services/content/contentSync";
import {
  ensureQuestsLoaded,
  getAllPlayerQuestStates,
  getAllQuests,
  getQuestInteractions,
} from "../services/questRepository";
import {
  advanceQuest,
  applyQuestRewards,
  canStartQuest,
  handleQuestEvent,
  tryStartRandomQuestFromZone,
  type QuestRuntimePlayer,
} from "../services/questRuntime";
import {
  getAllCompatibleProfessionIds,
  getLegacyProfessionIdFromProfessions,
  playerHasProfessionCompat,
} from "../services/professionCompat";
import { findMineById, findMineDepthById, loadMinesFromStorage } from "../services/miningRepository";
import {
  closeMineRun,
  descendMineRun,
  ensureMiningPlaceholderItems,
  escapeMineRun,
  getMineRunAwardXp,
  hitMineBlock,
  forceMineRunOutcome,
  resolveMiningSkillEffects,
  startMineRun,
  toPublicMineRun,
  retreatMineRun,
  useMineActiveSkill as applyMineActiveSkill,
} from "../services/miningRuntime";
import { recordMiningCareerRun } from '../services/miningCareerStats';
import { MiningScreen } from "./MiningScreen";
import {
  findMatchingQuestInteractions,
  getAvailableQuestInteractionChoices,
  runQuestInteractionEffects,
} from "../services/questInteractionRuntime";
import {
  checkMarkerRequirements,
  getQuestMarkerObjectiveId,
  getTrackedQuestMarker,
} from "../utils/questMarkerVisibility";
import type {
  PlayerQuestState,
  QuestDefinition,
  QuestInteractionChoice,
  QuestInteractionDefinition,
  QuestMarkerDefinition,
  QuestStep,
} from "../types/quest";
import {
  ensureNpcsLoaded,
  getAllNpcs,
  saveNpc,
} from "../services/npcRepository";
import {
  ensureDialoguesLoaded,
  getAllDialogues,
  getDialogueById,
  getDialoguesByNpc,
} from "../services/dialogueRepository";
import { useDialogueRunner } from "../services/dialogueRunner";
import { getNpcQuestMarker, selectBestInteractionForNpc } from "../services/npcInteractionSelector";
import { getNearbyMappedNpcs } from "../services/npcMapRuntime";
import {
  createLocationAutoTriggerKey,
  hasTriggeredLocationAutoTrigger,
  markLocationAutoTriggerTriggered,
} from "../services/locationAutoTriggerStore";
import {
  addDiscoveredMapEntity,
  getExplorationCellKeyFromPosition,
  loadDiscoveredCells,
  loadMapDiscoveryState,
  type MapDiscoveryEntityType,
  type MapDiscoveryMarker,
  type PlayerMapDiscoveryState,
  revealCellsAroundPosition,
  saveDiscoveredCells,
  saveMapDiscoveryState,
} from "./worldMapExploration";
import type { NpcDefinition } from "../types/npc";
import type { LocationArea, WorldLocation } from "../types/location";
import type { ActiveMiningEffect, InternalMineRunState } from "../types/mining";
import type { WorldSimulationSnapshot } from "../types/world-simulation.types";
import {
  loadMovementControlScheme,
  PLAYER_MOVEMENT_CONTROL_SCHEME_EVENT,
  type MovementControlScheme,
} from "./playerMovementSettings";
import { loadWorldMapRuntimeSettings } from "./worldMapRuntimeSettings";
import { useWorldSnapshot } from "../services/useWorldSimulation";
import { buildWorldSceneSnapshot } from "./worldSceneAdapter";
import { resolveRenderedWorldEntities } from "./worldEntityVisualResolver";
import {
  PLAYER_GOLD_STORAGE_KEY,
  PLAYER_ITEMS_STORAGE_KEY,
  readNumberStorage,
  readStringArrayStorage,
  writeNumberStorage,
  writeStringArrayStorage,
} from "../utils/playerInventory";
import {
  loadCharacterProfile,
  updateCharacterProfile,
  type CharacterSavedWorldState,
} from "../services/characterProfileStorage";
import {
  markInitialSpawnCompleted,
  resolveInitialSpawn,
  shouldResolveInitialSpawn,
} from "../services/initialSpawn";
import { getTutorialDefinition, TUTORIAL_ARGOS_INTRO_ID } from "../services/tutorialDefinitions";
import {
  ARGOS_INTRO_SEEN_FLAG,
  ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG,
  completeTutorial,
  getCharacterFlag,
  isHumanArgosProfile,
  loadTutorialState,
  nextStep,
  setCharacterFlag,
  skipTutorial,
  startTutorial,
} from "../services/tutorialManager";
import type { WorldSceneCommand, WorldSceneSnapshot } from "./worldSceneTypes";
import { useWorldRuntimeController } from "./useWorldRuntimeController";
import { resolveNpcReaction, resolveZoneReaction } from "../services/reputationRuntime";
import { fixMojibake } from "../utils/fixMojibake";

const WORLD_ENTITY_INTERACTION_DISTANCE = 0.0045;
const HOSTILE_BANDIT_AGGRO_RADIUS = 0.028;
const HOSTILE_BANDIT_AGGRO_COOLDOWN_MS = 18_000;
const HOSTILE_BANDIT_ATTACK_CHANCE = 0.4;
const HOSTILE_BANDIT_BATTLE_MAP_ID = "teramor_forest";
const HOSTILE_BANDIT_MIN_ENEMIES = 3;
const HOSTILE_BANDIT_MAX_ENEMIES = 5;
const BANDIT_TOLL_PERCENT = 0.15;
const BANDIT_ESCAPE_BASE_PERCENT = 30;
const BANDIT_ESCAPE_PER_LUCK_PERCENT = 1;
const BRAN_INTRO_NPC_ID = "npc_klinogorie_bran_legless_soldier";
const KLINOGORIE_START_LOCATION_ID = "loc_argos_klinogorie_start_village";
const BRAN_INTRO_DIALOGUE_IDS = new Set([
  "dlg_klinogorie_bran_intro",
  "dlg_npc_klinogorie_bran_legless_soldier_yyzx",
]);

function rollHostileBanditEnemyCount(): number {
  return HOSTILE_BANDIT_MIN_ENEMIES + Math.floor(Math.random() * (HOSTILE_BANDIT_MAX_ENEMIES - HOSTILE_BANDIT_MIN_ENEMIES + 1));
}

function toCombatRace(race: string | undefined): Race {
  switch ((race ?? "").toLowerCase()) {
    case "dwarf":
      return Race.Dwarf;
    case "high_elf":
    case "highelf":
      return Race.HighElf;
    case "forest_elf":
    case "wood_elf":
      return Race.WoodElf;
    case "human":
    default:
      return Race.Human;
  }
}

function buildWorldEntityCombatEnemies(
  npc: NpcDefinition,
  enemyCount: number,
): CustomArenaNpcPayload[] {
  const combat = npc.combat;
  const normalizedCount = Math.max(1, Math.min(5, enemyCount));
  return Array.from({ length: normalizedCount }, (_, index) => {
    const variation = index === 0 ? 1 : Math.max(0.82, 0.96 - index * 0.06);
    return {
      name: normalizedCount > 1 ? `${npc.name} ${index + 1}` : npc.name,
      race: toCombatRace(npc.race),
      stats: {
        hp: Math.max(60, Math.round((combat?.hp ?? 120) * variation)),
        mp: 0,
        stamina: Math.max(40, Math.round((combat?.stamina ?? 90) * variation)),
        strength: Math.max(6, Math.round((combat?.strength ?? 10) * variation)),
        constitution: Math.max(6, Math.round((combat?.endurance ?? 10) * variation)),
        dexterity: Math.max(6, Math.round((combat?.agility ?? 10) * variation)),
        intelligence: Math.max(4, Math.round((combat?.intellect ?? 6) * variation)),
        luck: Math.max(4, Math.round((combat?.luck ?? 6) * variation)),
        perception: Math.max(4, Math.round((combat?.perception ?? 6) * variation)),
        willpower: Math.max(4, Math.round((combat?.wisdom ?? 6) * variation)),
      },
      equipment: {},
      avatarUrl: npc.portraitUrl ?? npc.combatImageUrl ?? npc.iconUrl ?? undefined,
    };
  });
}

function isZoneInteractionModeInteractive(interactionMode: string | undefined): boolean {
  if (!interactionMode) {
    return true;
  }
  if (interactionMode === "none" || interactionMode === "random_event" || interactionMode === "danger") {
    return false;
  }
  return true;
}

type LocationView = "map" | "city" | "location";
type ActiveWorldModal =
  | {
    type: "merchant";
    locationId: string;
    merchantId: string;
  }
  | {
    type: "npc";
    locationId?: string;
    npcId: string;
  }
  | {
    type: "encounter";
    locationId: string;
  }
  | {
    type: "location";
    locationId: string;
  }
  | {
    type: "zone";
    zoneId: string;
  }
  | {
    type: "bandit_encounter";
    entityId: string;
    enemyCount: number;
    demandGold: number;
    escapeChancePercent: number;
    customEnemies?: CustomArenaNpcPayload[];
    introLine: string;
    demandLine: string;
  }
  | null;
type SidePanelKey =
  | "adminEditor"
  | "adminBattle"
  | "contextActions";

function isMineResourceZone(zone: WorldMapZone | null | undefined): zone is WorldMapZone & { resourceKind: 'mine'; mineId: string } {
  return Boolean(zone && zone.resourceKind === 'mine' && zone.mineId?.trim());
}

const DEFAULT_PLAYER_POSITION = { x: 0.53, y: 0.83 };
const UI_LEFT_PANEL_COLLAPSED_KEY = "theend.worldMap.ui.leftPanelCollapsed";
const UI_RIGHT_PANEL_COLLAPSED_KEY = "theend.worldMap.ui.rightPanelCollapsed";
const UI_CHAT_MINIMIZED_KEY = "theend.worldMap.ui.chatMinimized";
const UI_MINI_MAP_VISIBLE_KEY = "theend.worldMap.ui.miniMapVisible";
const UI_EDITOR_ACTIVE_LAYER_KEY = "theend.worldMap.editor.activeLayer";
const UI_EDITOR_LAYER_VISIBILITY_KEY = "theend.worldMap.editor.layerVisibility";
const POPUP_HIDE_DELAY_MS = 3000;
const POPUP_FADE_DURATION_MS = 450;
const PLAY_WORLD_MAP_IMAGE_PATH = "/map/main_world_map.webp";
const LABELED_WORLD_MAP_IMAGE_PATH = "/map/world_mini_map.webp";
const MIN_CITY_ZOOM = 1;
const MAX_CITY_ZOOM = 1.4;
const WORLD_MAP_BASE_TRAVEL_SPEED = 0.0001;
const WORLD_MAP_DEXTERITY_SPEED_STEP = 0.00001;
const WORLD_MAP_WALK_STAMINA_COST_MULTIPLIER = 1;
const WORLD_MAP_SPRINT_STAMINA_COST_MULTIPLIER = 1.2;

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === "input"
    || tag === "textarea"
    || tag === "select"
    || target.isContentEditable
    || target.closest("[contenteditable='true']") !== null
  );
}

function normalizeLayerVisibilityState(raw: unknown): LayerVisibilityState {
  const fallback = getDefaultLayerVisibilityState();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const source = raw as Partial<Record<MapEditorLayer, LayerVisibilityMode>>;
  return {
    areas: source.areas === "hidden" || source.areas === "dimmed" || source.areas === "visible" ? source.areas : fallback.areas,
    locations: source.locations === "hidden" || source.locations === "dimmed" || source.locations === "visible" ? source.locations : fallback.locations,
    quests: source.quests === "hidden" || source.quests === "dimmed" || source.quests === "visible" ? source.quests : fallback.quests,
    resources: source.resources === "hidden" || source.resources === "dimmed" || source.resources === "visible" ? source.resources : fallback.resources,
    zones: source.zones === "hidden" || source.zones === "dimmed" || source.zones === "visible" ? source.zones : fallback.zones,
    passability: source.passability === "hidden" || source.passability === "dimmed" || source.passability === "visible" ? source.passability : fallback.passability,
  };
}

function loadEditorActiveLayer(): MapEditorLayer {
  if (typeof window === "undefined") {
    return "zones";
  }

  const raw = window.localStorage.getItem(UI_EDITOR_ACTIVE_LAYER_KEY);
  if (raw === "areas" || raw === "locations" || raw === "quests" || raw === "resources" || raw === "zones" || raw === "passability") {
    return raw;
  }

  return "zones";
}

function loadEditorLayerVisibility(): LayerVisibilityState {
  if (typeof window === "undefined") {
    return getDefaultLayerVisibilityState();
  }

  const raw = window.localStorage.getItem(UI_EDITOR_LAYER_VISIBILITY_KEY);
  if (!raw) {
    return getDefaultLayerVisibilityState();
  }

  try {
    return normalizeLayerVisibilityState(JSON.parse(raw));
  } catch {
    return getDefaultLayerVisibilityState();
  }
}
function isCitySceneId(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "arklein" || normalized.startsWith("city_");
}

function normalizeCitySceneId(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  const lower = normalized.toLowerCase();
  if (lower === "arklein" || lower === "arclein" || lower === "arkea") {
    return "city_arklein";
  }
  return normalized;
}

function getLocationPercent(location: CityLocation): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  const shape = location.shape;
  const x = Math.max(0, Math.min(1200, shape.x ?? 0));
  const y = Math.max(0, Math.min(720, shape.y ?? 0));
  if (location.shapeType === "circle") {
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

function locationHasLocalMap(location: WorldLocation | null | undefined): boolean {
  if (!location) return false;
  const activeState = getLocationActiveState(location);
  const hasImage = Boolean(
    (activeState?.imageId && String(activeState.imageId).trim())
    || (activeState?.imagePath && String(activeState.imagePath).trim())
    || (location.defaultImageId && String(location.defaultImageId).trim())
    || (location.defaultImagePath && String(location.defaultImagePath).trim()),
  );
  const hasAreas = Array.isArray(location.areas) && location.areas.length > 0;
  return hasImage || hasAreas;
}

function resolveLocalLocationMapImageRef(location: WorldLocation | null | undefined): string {
  if (!location) return "";
  const activeState = getLocationActiveState(location);
  const fromState = String(activeState?.imageId ?? activeState?.imagePath ?? "").trim();
  if (fromState) return fromState;
  const fallback = String(location.defaultImageId ?? location.defaultImagePath ?? "").trim();
  return fallback;
}

function isDirectLocationImageSource(value: string): boolean {
  return value.startsWith("/")
    || value.startsWith("data:")
    || value.startsWith("http://")
    || value.startsWith("https://");
}

function getAreaPercent(area: { shapeType?: string; shape?: any }): { left: string; top: string; width: string; height: string } {
  const shape = area.shape ?? {};
  const x = Math.max(0, Math.min(1200, shape.x ?? 0));
  const y = Math.max(0, Math.min(720, shape.y ?? 0));
  if (area.shapeType === "circle") {
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

function getFirstString(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
    return typeof first === "string" ? first.trim() : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function isDirectAudioSource(value: string): boolean {
  return value.startsWith("/")
    || value.startsWith("http://")
    || value.startsWith("https://")
    || value.startsWith("data:audio/");
}

function isLikelyWindowsLocalPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function getGlobalAudioVolume(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  const volumeKeys = ["theend.audio.volume", "theend.sound.volume"];
  const rawVolume = volumeKeys
    .map((key) => window.localStorage.getItem(key))
    .find((value) => value !== null);
  const parsed = rawVolume ? Number(rawVolume) : 1;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 1;
}

function resolveWorldAudioSource(value: string | undefined | null): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized || isLikelyWindowsLocalPath(normalized)) {
    return null;
  }
  return isDirectAudioSource(normalized)
    ? normalized
    : `/api/content/assets/audio/${encodeURIComponent(normalized)}/raw`;
}

function getWorldAudioCueSources(cue: WorldAudioCue | undefined): string[] {
  if (!cue) {
    return [];
  }

  const rawRefs: string[] = [];
  if (Array.isArray(cue.urls)) {
    rawRefs.push(...cue.urls);
  }
  if (Array.isArray(cue.assetIds)) {
    rawRefs.push(...cue.assetIds);
  }
  if (cue.url) {
    rawRefs.push(cue.url);
  }
  if (cue.assetId) {
    rawRefs.push(cue.assetId);
  }

  const unique = new Set<string>();
  const sources: string[] = [];
  for (const ref of rawRefs) {
    const source = resolveWorldAudioSource(ref);
    if (!source || unique.has(source)) {
      continue;
    }
    unique.add(source);
    sources.push(source);
  }
  return sources;
}

function getFirstAvailableNpcDialogueId(npc: NpcDefinition | null | undefined): string | null {
  if (!npc) {
    return null;
  }

  const bindings = Array.isArray(npc.dialogues) ? [...npc.dialogues] : [];
  bindings.sort((left, right) => Number(right?.priority ?? 0) - Number(left?.priority ?? 0));

  for (const binding of bindings) {
    const dialogueId = getFirstString(binding?.dialogueId);
    if (!dialogueId) {
      continue;
    }
    const dialogue = getDialogueById(dialogueId);
    if (dialogue?.status === "active") {
      return dialogue.id;
    }
  }

  const fallbackDialogue = getDialoguesByNpc(npc.id).find((dialogue) => dialogue.status === "active") ?? null;
  return fallbackDialogue?.id ?? null;
}

function getPlayerPositionStorageKey(characterId: string): string {
  return `theend.worldMap.playerPosition.${characterId}`;
}

interface TrackedQuestState {
  questId: string | null;
  objectiveId: string | null;
}

function getTrackedQuestStorageKey(characterId: string): string {
  return `theend.worldMap.trackedQuest.${characterId}`;
}

function loadTrackedQuestState(characterId: string): TrackedQuestState {
  if (typeof window === "undefined") {
    return { questId: null, objectiveId: null };
  }

  const raw = window.localStorage.getItem(getTrackedQuestStorageKey(characterId));
  if (!raw) {
    return { questId: null, objectiveId: null };
  }

  try {
    const parsed = JSON.parse(raw) as { questId?: unknown; objectiveId?: unknown };
    const questId = typeof parsed.questId === "string" && parsed.questId.trim().length > 0
      ? parsed.questId.trim()
      : null;
    const objectiveId = typeof parsed.objectiveId === "string" && parsed.objectiveId.trim().length > 0
      ? parsed.objectiveId.trim()
      : null;
    return { questId, objectiveId };
  } catch {
    return { questId: null, objectiveId: null };
  }
}

function evaluateLocationAutoTriggerCondition(
  condition: string | undefined,
  player: {
    activeQuestIds?: string[];
    completedQuestIds?: string[];
    itemIds?: string[];
    flags?: Record<string, unknown>;
  },
): boolean {
  const raw = (condition ?? "").trim();
  if (!raw) {
    return true;
  }

  let negate = false;
  let expression = raw;
  if (expression.startsWith("!")) {
    negate = true;
    expression = expression.slice(1).trim();
  }

  const [kindRaw, ...rest] = expression.split(":");
  const kind = (kindRaw ?? "").trim().toLowerCase();
  const value = rest.join(":").trim();

  let result = false;
  switch (kind) {
    case "true":
      result = true;
      break;
    case "false":
      result = false;
      break;
    case "quest_active":
    case "questactive":
      result = Boolean(value && (player.activeQuestIds ?? []).includes(value));
      break;
    case "quest_completed":
    case "questcompleted":
      result = Boolean(value && (player.completedQuestIds ?? []).includes(value));
      break;
    case "has_item":
    case "hasitem":
      result = Boolean(value && (player.itemIds ?? []).includes(value));
      break;
    case "flag":
      result = Boolean(value && player.flags && Object.prototype.hasOwnProperty.call(player.flags, value));
      break;
    default:
      result = false;
      break;
  }

  return negate ? !result : result;
}

function upsertQuestMarkerList(
  current: QuestMarkerDefinition[],
  marker: QuestMarkerDefinition,
): QuestMarkerDefinition[] {
  const index = current.findIndex((entry) => entry.id === marker.id);
  if (index === -1) {
    return [...current, marker];
  }
  return current.map((entry) => (entry.id === marker.id ? marker : entry));
}

function mergeQuestMarkerLists(
  primary: QuestMarkerDefinition[],
  fallback: QuestMarkerDefinition[],
): QuestMarkerDefinition[] {
  const merged = new Map<string, QuestMarkerDefinition>();
  fallback.forEach((entry) => merged.set(entry.id, entry));
  primary.forEach((entry) => merged.set(entry.id, entry));
  return Array.from(merged.values());
}

function getQuestCurrentStep(quest: QuestDefinition, state: PlayerQuestState): QuestStep | null {
  const steps = Array.isArray(quest.steps) ? quest.steps : [];
  if (steps.length === 0) {
    return null;
  }
  if (state.currentStepId) {
    return steps.find((step) => step.id === state.currentStepId) ?? steps[0] ?? null;
  }
  return steps.find((step) => !state.completedStepIds.includes(step.id)) ?? steps[0] ?? null;
}

function getObjectiveAutoMarkerTargetId(objective: QuestDefinition['steps'][number]['objectives'][number]): string {
  return String(
    objective.markerTargetId
    ?? objective.targetCityId
    ?? objective.targetLocationId
    ?? objective.zoneId
    ?? '',
  ).trim();
}

function findAutoQuestMarkerTargetZone(targetId: string, zones: WorldMapZone[]): WorldMapZone | null {
  const normalized = targetId.trim();
  if (!normalized) {
    return null;
  }
  const lower = normalized.toLowerCase();
  const withoutCityPrefix = lower.startsWith('city_') ? lower.slice(5) : lower;
  const withCityPrefix = lower.startsWith('city_') ? lower : `city_${lower}`;

  return zones.find((zone) => {
    const candidates = [
      zone.id,
      zone.cityId,
      zone.targetScene,
      zone.linkedLocationId,
      zone.linkedLocation,
    ].map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
    return candidates.some((candidate) => (
      candidate === lower
      || candidate === withoutCityPrefix
      || candidate === withCityPrefix
    ));
  }) ?? null;
}

function getManualQuestObjectiveMarkerKey(marker: QuestMarkerDefinition): string | null {
  const questId = String(marker.linkedQuestId ?? (marker as QuestMarkerDefinition & { questId?: string }).questId ?? '').trim();
  const objectiveId = String(marker.linkedObjectiveId ?? marker.objectiveId ?? '').trim();
  return questId && objectiveId ? `${questId}:${objectiveId}` : null;
}

function loadUiBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return fallback;
}

function getDialogueChoiceKey(choice: {
  id?: string | null;
  text?: string | null;
  next?: string | null;
  nextNodeId?: string | null;
  giveQuest?: string | null;
  end?: boolean | null;
  endsDialogue?: boolean | null;
}): string {
  const id = String(choice.id ?? "").trim();
  if (id) {
    return id;
  }

  const text = String(choice.text ?? "").trim();
  const next = String(choice.next ?? choice.nextNodeId ?? "").trim();
  const giveQuest = String(choice.giveQuest ?? "").trim();
  const end = (choice.end ?? choice.endsDialogue) ? "end" : "";
  return `${text}:${next}:${giveQuest}:${end}`;
}

function loadSavedPlayerPosition(characterId: string): { x: number; y: number } | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(
    getPlayerPositionStorageKey(characterId),
  );
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (
      typeof parsed.x === "number" &&
      Number.isFinite(parsed.x) &&
      typeof parsed.y === "number" &&
      Number.isFinite(parsed.y)
    ) {
      return {
        x: Math.max(0, Math.min(1, parsed.x)),
        y: Math.max(0, Math.min(1, parsed.y)),
      };
    }
  } catch {
    // Ignore broken saved values and fallback to defaults.
  }

  return null;
}

function loadPlayerPosition(characterId: string): { x: number; y: number } {
  const saved = loadSavedPlayerPosition(characterId);
  if (saved) {
    return saved;
  }

  return DEFAULT_PLAYER_POSITION;
}

function resolvePlayerPositionFromWorldState(
  worldState: CharacterSavedWorldState | null | undefined,
  zones: WorldMapZone[],
): { x: number; y: number } | null {
  if (!worldState) {
    return null;
  }

  const zoneId = String(worldState.currentZoneId ?? "").trim();
  const locationId = String(worldState.currentLocationId ?? "").trim();
  const zone = zones.find((entry) =>
    entry.id === zoneId
    || (locationId.length > 0 && (
      entry.linkedLocationId === locationId
      || entry.linkedLocation === locationId
      || entry.id === locationId
    )),
  );
  if (!zone) {
    return null;
  }

  const [x, y] = getZoneCenter(zone);
  return { x, y };
}

function cloneZones(zones: WorldMapZone[]): WorldMapZone[] {
  return zones.map((zone) => ({
    ...zone,
    points: zone.points
      ? zone.points.map((point) => [point[0], point[1]] as [number, number])
      : undefined,
  }));
}

function offsetZone(zone: WorldMapZone, dx: number, dy: number): WorldMapZone {
  if (zone.shape === "circle") {
    return {
      ...zone,
      x: Math.max(0, Math.min(1, (zone.x ?? 0) + dx)),
      y: Math.max(0, Math.min(1, (zone.y ?? 0) + dy)),
      updatedAt: Date.now(),
    };
  }

  return moveZone(zone, dx, dy);
}

function buildDraftForTool(
  tool: ZoneEditorTool,
  currentDraft: ZoneEditorDraft | null,
  activeEditorLayer: MapEditorLayer,
): ZoneEditorDraft {
  const nextDraft = currentDraft ?? createEmptyZoneDraft(tool);
  const nextType = getDefaultTypeForLayer(activeEditorLayer);
  const nextColor = getDefaultZoneColor(nextType, activeEditorLayer);
  const nextInteractionMode = getDefaultInteractionMode(nextType);
  const nextPlayerClickable = getDefaultPlayerClickable(nextType);
  const nextBlocksClick = getDefaultBlocksClick(nextType);
  const nextPassiveEffects = getDefaultPassiveEffects(nextType);

  const baseDraft: ZoneEditorDraft = {
    ...nextDraft,
    editorLayer: activeEditorLayer,
    type: nextType,
    color: nextColor,
    interactionMode: nextInteractionMode,
    playerClickable: nextPlayerClickable,
    blocksClick: nextBlocksClick,
    passiveEffects: nextPassiveEffects,
  };

  if (tool === "polygon") {
    return { ...baseDraft, shape: "polygon", x: null, y: null, radius: null };
  }
  if (tool === "rectangle") {
    return { ...baseDraft, shape: "rect", x: null, y: null, radius: null };
  }
  if (tool === "circle") {
    return {
      ...baseDraft,
      shape: "circle",
      points: [],
      radius: baseDraft.radius ?? 0.03,
    };
  }
  return baseDraft;
}

function normalizeClipboardText(text: string): string {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return text;
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as Record<string, unknown>).zones)
  ) {
    return text;
  }
  return JSON.stringify([parsed], null, 2);
}

function formatJsonExportStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function downloadJsonFile(filePrefix: string, payload: string): boolean {
  try {
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filePrefix}_${formatJsonExportStamp()}.json`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Delay revoke to avoid race in browsers with slow download handoff.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
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
  onOpenProfessions: () => void;
  onOpenCharacter: () => void;
  onOpenEquipment: () => void;
  onOpenClan: () => void;
  onExit: () => void;
  onStartCombat: (
    battleMapIdOverride?: string,
    options?: { enemyCount?: number; customEnemies?: CustomArenaNpcPayload[] },
  ) => Promise<void>;
  onStartBattleMap?: (battleMapId: string) => Promise<void>;
  onOpenMerchant: (merchantId?: string) => void;
  onOpenSkills: (trainerNpcId?: string, trainerSkillIds?: unknown, trainerNpcName?: string) => void;
  onGrantSkill?: (skillId: string, sourceNpcId?: string) => Promise<void>;
  onApplyHealingService?: (options: { costGold?: number }) => Promise<void>;
  onRuntimeInventoryChanged?: () => void;
  onStatus: (text: string) => void;
  onTravelStaminaChange?: (nextStamina: number) => void;
  onMineRunResourcesChange?: (next: { hp: number; stamina: number }) => void;
  onPlayerProfessionsChange?: (next: ArenaCharacter["professions"]) => void;
  cityMerchants?: AdminMerchant[];
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveItemImage?: (
    item: ItemDefinition | null | undefined,
  ) => string | undefined;
  resolveMerchantImage?: (
    merchant: AdminMerchant | null | undefined,
  ) => string | undefined;
  playerAvatarUrl?: string;
  devTravelRequest?: {
    mode: 'world' | 'city' | 'location' | 'mine';
    targetId?: string | null;
    mineAction?: 'open' | 'close' | 'finish';
    mineResult?: 'escaped' | 'retreated' | 'failed' | 'dead';
    token: number;
  } | null;
  initialMode?: WorldMapMode;
  adminEditorOnly?: boolean;
  showAdminShortcuts?: boolean;
}

function resolveNpcTrainerSkillIds(npc: NpcDefinition | null | undefined): unknown {
  const record = npc as unknown as {
    trainerSkillIds?: unknown;
    trainingSkillIds?: unknown;
    trainer?: { skillIds?: unknown };
    skills?: { trainerSkillIds?: unknown };
  } | null | undefined;
  return record?.trainerSkillIds
    ?? record?.trainingSkillIds
    ?? record?.trainer?.skillIds
    ?? record?.skills?.trainerSkillIds
    ?? [];
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
    onOpenProfessions,
    onOpenCharacter,
    onOpenEquipment,
    onOpenClan,
    onExit,
    onStartCombat,
    onStartBattleMap,
    onOpenMerchant,
    onOpenSkills,
    onGrantSkill,
    onApplyHealingService,
    onRuntimeInventoryChanged,
    onStatus,
    onTravelStaminaChange,
    onMineRunResourcesChange,
    onPlayerProfessionsChange,
    cityMerchants = [],
    resolveItemById,
    resolveItemImage,
    resolveMerchantImage,
    playerAvatarUrl,
    devTravelRequest,
    initialMode = "play",
    adminEditorOnly = false,
    showAdminShortcuts = false,
  } = props;

  const canvasRef = useRef<WorldMapCanvasHandle>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const popupTimeoutsRef = useRef<
    Map<string, { fadeTimer: number; removeTimer: number }>
  >(new Map());
  const seenPopupMessageIdsRef = useRef<Set<string>>(new Set());
  const skipNextZonePersistRef = useRef(true);
  const skipNextSettingsPersistRef = useRef(false);
  const worldMapRefreshRef = useRef<Promise<void> | null>(null);
  const lastWorldMapRefreshAtRef = useRef(0);
  const processedDevTravelTokenRef = useRef<number | null>(null);
  const lastAggroNpcRef = useRef<{ id: string; at: number } | null>(null);
  const lastZoneTransitionRef = useRef<{ zoneId: string; at: number } | null>(
    null,
  );
  const queuedEditorSaveRef = useRef<{
    zones: WorldMapZone[];
    regions: PaintedRegion[];
    questMarkers: QuestMarkerDefinition[];
  } | null>(null);
  const editorSaveInFlightRef = useRef<Promise<void> | null>(null);
  const lastRevealedCellRef = useRef<string | null>(null);
  const dialogueVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const worldMusicActiveAudioRef = useRef<HTMLAudioElement | null>(null);
  const worldMusicIdleAudioRef = useRef<HTMLAudioElement | null>(null);
  const worldMusicFadeRafRef = useRef<number | null>(null);
  const worldMusicCurrentKingdomRef = useRef<string | null>(null);
  const worldMusicLastTrackByKingdomRef = useRef<Map<string, string>>(new Map());
  const lastDialogueVoiceKeyRef = useRef<string | null>(null);
  const warnedDialogueVoiceSourcesRef = useRef<Set<string>>(new Set());
  const pendingDialogueVoicePlayRef = useRef(false);
  const dialogueVoiceRetryBoundRef = useRef(false);
  const restoredWorldContextCharacterRef = useRef<string | null>(null);
  const initialSpawnResolvedCharacterRef = useRef<string | null>(null);
  const argosIntroAutoOpenCharacterRef = useRef<string | null>(null);
  const argosStartRecoveryCharacterRef = useRef<string | null>(null);
  const playerPositionHydratedCharacterRef = useRef<string | null>(null);
  const handlePrimaryWorldInteractionRef = useRef<() => void>(() => undefined);
  const handleRuntimeZoneInteractRef = useRef<((zone: WorldMapZone, point: { x: number; y: number }) => void) | null>(null);

  const [worldMapMode, setWorldMapMode] = useState<WorldMapMode>(
    adminEditorOnly ? "editor" : initialMode,
  );
  const [contextMode, setContextMode] = useState<ContextMode>("empty");
  const [locationView, setLocationView] = useState<LocationView>("map");
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [activeCity, setActiveCity] = useState<City | null>(null);
  const [activeCityBackgroundUrl, setActiveCityBackgroundUrl] = useState("");
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [activeLocationBackgroundUrl, setActiveLocationBackgroundUrl] = useState("");
  const [currentZone, setCurrentZone] = useState<WorldMapZone | null>(null);
  const [hoverZone, setHoverZone] = useState<WorldMapZone | null>(null);
  const [playerState, setPlayerState] = useState<PlayerWorldState>("idle");
  const [lastRuntimeClickPoint, setLastRuntimeClickPoint] = useState<
    { x: number; y: number } | null
  >(null);
  const [playMovementTarget, setPlayMovementTarget] = useState<{
    point: { x: number; y: number };
    pendingLocationId: string | null;
  } | null>(null);
  const [playerPosition, setPlayerPosition] = useState(() =>
    loadPlayerPosition(character.id),
  );
  const [trackedQuestId, setTrackedQuestId] = useState<string | null>(() =>
    loadTrackedQuestState(character.id).questId,
  );
  const [trackedObjectiveId, setTrackedObjectiveId] = useState<string | null>(
    () => loadTrackedQuestState(character.id).objectiveId,
  );
  const [worldMapViewerOpen, setWorldMapViewerOpen] = useState(false);
  const [discoveredWorldMapCells, setDiscoveredWorldMapCells] = useState<string[]>(() =>
    loadDiscoveredCells(character.id),
  );
  const [mapDiscoveryState, setMapDiscoveryState] = useState<PlayerMapDiscoveryState>(() =>
    loadMapDiscoveryState(character.id),
  );
  const [cityZoom, setCityZoom] = useState(MIN_CITY_ZOOM);
  const [cityPan, setCityPan] = useState({ x: 0, y: 0 });
  const [playSpawnPosition, setPlaySpawnPosition] = useState(() =>
    loadPlayerPosition(character.id),
  );
  const [chatType, setChatType] = useState<ChatType>("local");
  const [chatDraft, setChatDraft] = useState("");
  const [systemChat, setSystemChat] = useState<ChatMessage[]>([]);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() =>
    loadUiBoolean(UI_LEFT_PANEL_COLLAPSED_KEY, false),
  );
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() =>
    loadUiBoolean(UI_RIGHT_PANEL_COLLAPSED_KEY, false),
  );
  const [chatMinimized, setChatMinimized] = useState(() =>
    loadUiBoolean(UI_CHAT_MINIMIZED_KEY, false),
  );
  const [miniMapVisible, setMiniMapVisible] = useState(() =>
    loadUiBoolean(UI_MINI_MAP_VISIBLE_KEY, true),
  );
  const [tutorialState, setTutorialState] = useState(() =>
    loadTutorialState(character.id),
  );
  const [worldRenderer, setWorldRenderer] = useState<WorldRendererKind>(() =>
    readWorldRendererSetting(),
  );
  const [movementControlScheme, setMovementControlScheme] = useState<MovementControlScheme>(() =>
    loadMovementControlScheme(),
  );
  const [shiftPressed, setShiftPressed] = useState(false);
  const [playCameraFocusPoint, setPlayCameraFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [eventOverlayMessages, setEventOverlayMessages] = useState<
    Array<ChatMessage & { isFading: boolean }>
  >([]);
  const [collapsedSidePanels, setCollapsedSidePanels] = useState<
    Record<SidePanelKey, boolean>
  >({
    adminEditor: true,
    adminBattle: true,
    contextActions: false,
  });
  const [questDefinitions, setQuestDefinitions] = useState<QuestDefinition[]>(
    [],
  );
  const [playerQuestStates, setPlayerQuestStates] = useState<
    PlayerQuestState[]
  >([]);
  const [questMarkers, setQuestMarkers] = useState<QuestMarkerDefinition[]>([]);
  const [selectedQuestMarkerId, setSelectedQuestMarkerId] = useState<
    string | null
  >(null);
  const [questMarkerDraft, setQuestMarkerDraft] =
    useState<QuestMarkerDefinition | null>(null);

  const [npcs, setNpcs] = useState<NpcDefinition[]>([]);
  const [runtimeImages, setRuntimeImages] = useState<StoredImage[]>([]);
  const [contentSnapshot, setContentSnapshot] = useState<ContentSnapshot | null>(
    null,
  );
  const [validationCities, setValidationCities] = useState<City[]>([]);
  const [validationSnapshot, setValidationSnapshot] =
    useState<ContentSnapshot | null>(null);
  const [selectedNpcIdForPlacement, setSelectedNpcIdForPlacement] =
    useState("");
  const [selectedNpcForInteractionId, setSelectedNpcForInteractionId] =
    useState<string | null>(null);
  const [selectedWorldEntity, setSelectedWorldEntity] =
    useState<WorldSimulationSnapshot["activeEntities"][number] | null>(null);
  const [pendingWorldEntityInteractionId, setPendingWorldEntityInteractionId] =
    useState<string | null>(null);
  const [engagedWorldEntityId, setEngagedWorldEntityId] = useState<string | null>(null);
  const [engagedWorldEntityAnchor, setEngagedWorldEntityAnchor] = useState<{ x: number; y: number } | null>(null);
  const hostileBanditAggroCooldownRef = useRef<Record<string, number>>({});
  const [travelExhausted, setTravelExhausted] = useState(false);
  const [terrainStaminaDrainMultiplier, setTerrainStaminaDrainMultiplier] = useState(1);
  const [activeWorldModal, setActiveWorldModal] =
    useState<ActiveWorldModal>(null);
  const [expandedMineZoneId, setExpandedMineZoneId] = useState<string | null>(null);
  const [activeMineRun, setActiveMineRun] = useState<InternalMineRunState | null>(null);
  const [activeMineEffects, setActiveMineEffects] = useState<ActiveMiningEffect[] | null>(null);
  const [activeMineLoading, setActiveMineLoading] = useState(false);
  const [questJournalOpen, setQuestJournalOpen] = useState(false);
  const [pvpBrowserOpen, setPvpBrowserOpen] = useState(false);
  const [pvpPlayers, setPvpPlayers] = useState<NearbyPvpPlayer[]>([]);
  const [pvpLoading, setPvpLoading] = useState(false);
  const [pvpError, setPvpError] = useState<string | null>(null);
  const [npcQuestSceneModal, setNpcQuestSceneModal] = useState<
    | null
    | {
      npcId: string;
      npcName: string;
      portrait?: string;
      stages: Array<{
        questId: string;
        questTitle: string;
        stepTitle: string | null;
        journalText: string | null;
        objectives: Array<{ id: string; text: string; completed: boolean }>;
      }>;
      selectedQuestId: string;
    }
  >(null);
  const [randomEventModal, setRandomEventModal] = useState<
    | null
    | {
      zoneId: string;
      zoneName: string;
      questId: string;
      questTitle: string;
      questText: string;
    }
  >(null);

  const [activeInteraction, setActiveInteraction] = useState<QuestInteractionDefinition | null>(null);
  const [activeInteractionChoices, setActiveInteractionChoices] = useState<QuestInteractionChoice[]>([]);
  const [questInteractions, setQuestInteractions] = useState<QuestInteractionDefinition[]>([]);
  const runtimeSettings = useMemo(() => loadWorldMapRuntimeSettings(), []);
  const { snapshot: worldSnapshot, loading: worldSnapshotLoading, error: worldSnapshotError } = useWorldSnapshot();
  const playMovementLocked = worldMapMode === "play"
    && locationView === "map"
    && (travelExhausted || Boolean(engagedWorldEntityId));
  const playMovementLockReason = worldMapViewerOpen
    ? "viewer_open"
    : travelExhausted
      ? "travel_exhausted"
      : engagedWorldEntityId
        ? "world_entity_engaged"
        : null;
  const questRuntimeProfessionCompat = useMemo(
    () => ({
      professions: character.professions,
      // TODO professions-v2: remove legacy professionId after all content/runtime checks use professions array.
      professionId: getLegacyProfessionIdFromProfessions(character.professions),
    }),
    [character.professions],
  );
  const compatibleProfessionIds = useMemo(
    () => {
      const ids = new Set<string>([...getAllCompatibleProfessionIds(), ...PROFESSION_DEFINITIONS.map((entry) => entry.id)]);
      return Array.from(ids);
    },
    [],
  );
  const dialoguePlayer = useMemo(
    () => ({
      id: character.id,
      level: character.level,
      race: character.race,
      ...questRuntimeProfessionCompat,
      stats: Object.fromEntries(
        Object.entries(character.activeStats ?? {}).map(([key, value]) => [key, Number(value ?? 0)]),
      ),
    }),
    [character.activeStats, character.id, character.level, character.race, questRuntimeProfessionCompat],
  );
  const refreshPlayerQuestStates = useCallback(() => {
    setPlayerQuestStates(
      getAllPlayerQuestStates().filter((state) => state.playerId === character.id),
    );
  }, [character.id]);
  const dialogueRunner = useDialogueRunner({
    player: dialoguePlayer,
    onStartQuest: refreshPlayerQuestStates,
  });

  useEffect(() => {
    return () => {
      if (dialogueVoiceAudioRef.current) {
        dialogueVoiceAudioRef.current.pause();
        dialogueVoiceAudioRef.current.currentTime = 0;
      }
      if (worldMusicFadeRafRef.current !== null) {
        window.cancelAnimationFrame(worldMusicFadeRafRef.current);
        worldMusicFadeRafRef.current = null;
      }
      if (worldMusicActiveAudioRef.current) {
        worldMusicActiveAudioRef.current.pause();
        worldMusicActiveAudioRef.current.currentTime = 0;
      }
      if (worldMusicIdleAudioRef.current) {
        worldMusicIdleAudioRef.current.pause();
        worldMusicIdleAudioRef.current.currentTime = 0;
      }
      worldMusicCurrentKingdomRef.current = null;
      pendingDialogueVoicePlayRef.current = false;
      dialogueVoiceRetryBoundRef.current = false;
    };
  }, []);

  const handleTrackQuest = useCallback((questId: string, objectiveId: string | null) => {
    setTrackedQuestId(questId);
    setTrackedObjectiveId(objectiveId);
    onStatus(`Отслеживание: ${questId}${objectiveId ? ` / ${objectiveId}` : ""}`);
  }, [onStatus]);

  const handleClearTrackedQuest = useCallback(() => {
    setTrackedQuestId(null);
    setTrackedObjectiveId(null);
    onStatus("Отслеживание квеста отключено.");
  }, [onStatus]);

  const handleToggleMiniMap = useCallback(() => {
    setMiniMapVisible((current) => !current);
  }, []);

  const [selectedCityLocationId, setSelectedCityLocationId] = useState<
    string | null
  >(null);

  const travelMoveSpeed = useMemo(() => {
    const dexterity = Number(character.activeStats?.dexterity ?? 0);
    return WORLD_MAP_BASE_TRAVEL_SPEED + Math.max(0, dexterity) * WORLD_MAP_DEXTERITY_SPEED_STEP;
  }, [character.activeStats?.dexterity]);

  const staminaRegenPerSecond = useMemo(
    () => Math.max(10, Math.floor(character.maxStamina * 0.1)),
    [character.maxStamina],
  );

  const walkStaminaCostPerSecond = useMemo(
    () => Math.max(1, Math.floor(staminaRegenPerSecond * WORLD_MAP_WALK_STAMINA_COST_MULTIPLIER)),
    [staminaRegenPerSecond],
  );

  const sprintStaminaCostPerSecond = useMemo(
    () => Math.max(walkStaminaCostPerSecond + 1, Math.ceil(walkStaminaCostPerSecond * WORLD_MAP_SPRINT_STAMINA_COST_MULTIPLIER)),
    [walkStaminaCostPerSecond],
  );

  const canTravelOnWorldMap = worldMapMode === "play"
    && locationView === "map"
    && !travelExhausted;

  const sprintActive = canTravelOnWorldMap
    && playerState === "moving"
    && shiftPressed
    && battleStats.stamina > 0;

  useEffect(() => {
    const currentStamina = Math.max(0, Math.floor(battleStats.stamina));
    const staminaToResumeTravel = Math.max(1, walkStaminaCostPerSecond);

    if (!travelExhausted && currentStamina <= 0) {
      setTravelExhausted(true);
      onStatus("Вы вымотались. Нужно остановиться и дождаться, пока выносливости снова хватит на шаг.");
      return;
    }

    if (travelExhausted && currentStamina >= staminaToResumeTravel) {
      setTravelExhausted(false);
      onStatus("Выносливости достаточно для ходьбы. Можно снова идти.");
    }
  }, [battleStats.stamina, onStatus, travelExhausted, walkStaminaCostPerSecond]);

  useEffect(() => {
    const handleControlSchemeChanged = (event: Event) => {
      if (event instanceof StorageEvent) {
        setMovementControlScheme(loadMovementControlScheme());
        return;
      }

      const nextValue = (event as CustomEvent<MovementControlScheme>).detail;
      if (nextValue === "arrows" || nextValue === "wasd") {
        setMovementControlScheme(nextValue);
      }
    };

    window.addEventListener("storage", handleControlSchemeChanged);
    window.addEventListener(PLAYER_MOVEMENT_CONTROL_SCHEME_EVENT, handleControlSchemeChanged as EventListener);
    return () => {
      window.removeEventListener("storage", handleControlSchemeChanged);
      window.removeEventListener(PLAYER_MOVEMENT_CONTROL_SCHEME_EVENT, handleControlSchemeChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    writeWorldRendererSetting(worldRenderer);
  }, [worldRenderer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftPressed(false);
      }
    };

    const handleBlur = () => setShiftPressed(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    if (!onTravelStaminaChange) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      const currentStamina = Math.max(0, Math.floor(battleStats.stamina));
      const maxStamina = Math.max(0, character.maxStamina);

      if (travelExhausted) {
        if (currentStamina < maxStamina) {
          const nextStamina = Math.min(maxStamina, currentStamina + staminaRegenPerSecond);
          if (nextStamina !== currentStamina) {
            onTravelStaminaChange(nextStamina);
          }
        }
        return;
      }

      if (playerState === "moving") {
        const baseDrain = sprintActive ? sprintStaminaCostPerSecond : walkStaminaCostPerSecond;
        const drain = Math.max(1, Math.ceil(baseDrain * terrainStaminaDrainMultiplier));
        const nextStamina = Math.max(0, currentStamina - drain);
        if (nextStamina !== currentStamina) {
          onTravelStaminaChange(nextStamina);
        }
        return;
      }

      if (currentStamina < maxStamina) {
        const nextStamina = Math.min(maxStamina, currentStamina + staminaRegenPerSecond);
        if (nextStamina !== currentStamina) {
          onTravelStaminaChange(nextStamina);
        }
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    battleStats.stamina,
    character.maxStamina,
    onTravelStaminaChange,
    playerState,
    sprintActive,
    sprintStaminaCostPerSecond,
    staminaRegenPerSecond,
    terrainStaminaDrainMultiplier,
    travelExhausted,
    walkStaminaCostPerSecond,
  ]);

  const nextSystemChatIdRef = useRef(0);
  const [zones, setZones] = useState<WorldMapZone[]>(() =>
    cloneZones(WORLD_MAP_ZONES),
  );
  const [regions, setRegions] = useState<PaintedRegion[]>([]);
  const [regionToolMode, setRegionToolMode] =
    useState<RegionToolMode>("pencil");
  const [regionType, setRegionType] = useState<RegionType>("blocked");
  const [regionBrushSize, setRegionBrushSize] = useState<RegionBrushSize>(0.5);
  const [regionColorByType, setRegionColorByType] = useState<Record<RegionType, string>>(() => ({ ...REGION_TYPE_HEX_COLORS }));
  const [editorSettings, setEditorSettings] = useState<ZoneEditorSettings>(
    () =>
      typeof window === "undefined"
        ? createDefaultEditorSettings()
        : loadEditorSettings(),
  );
  const [editorDraft, setEditorDraft] = useState<ZoneEditorDraft | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [activeEditorLayer, setActiveEditorLayer] = useState<MapEditorLayer>(() => loadEditorActiveLayer());
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibilityState>(() => loadEditorLayerVisibility());
  const [editorJson, setEditorJson] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState("ready");
  const [mouseCoords, setMouseCoords] = useState<{
    x: number | null;
    y: number | null;
  }>({ x: null, y: null });
  const [lastMouseCoords, setLastMouseCoords] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [markerPickMode, setMarkerPickMode] = useState(false);
  const [history, setHistory] =
    useState<ZoneEditorHistoryState>(createEmptyHistory());
  const cityDragRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const selectedLocationName = currentZone?.name ?? "\u041f\u0443\u0441\u0442\u043e\u0448\u0438";
  const passiveProbePoint = useMemo(() => {
    if (Number.isFinite(playerPosition.x) && Number.isFinite(playerPosition.y)) {
      return { x: playerPosition.x, y: playerPosition.y };
    }
    return lastRuntimeClickPoint;
  }, [lastRuntimeClickPoint, playerPosition.x, playerPosition.y]);
  const passiveZonesAtCurrentPoint = useMemo(() => {
    if (!passiveProbePoint) {
      return [] as WorldMapZone[];
    }
    return getPassiveZonesAtPoint(zones as Zone[], passiveProbePoint.x, passiveProbePoint.y) as WorldMapZone[];
  }, [passiveProbePoint, zones]);
  const currentPassiveContexts = useMemo(() => {
    const currentKingdomArea = passiveZonesAtCurrentPoint.find((zone) => zone.type === "kingdom_area") ?? null;
    const currentFactionAreas = passiveZonesAtCurrentPoint.filter((zone) => zone.type === "faction_area");
    const currentCityArea = passiveZonesAtCurrentPoint.find((zone) => zone.type === "city_area") ?? null;
    const currentDangerAreas = passiveZonesAtCurrentPoint.filter((zone) => zone.type === "danger_area");
    const currentResourceAreas = passiveZonesAtCurrentPoint.filter((zone) => zone.type === "resource_area");
    const currentRandomEventAreas = passiveZonesAtCurrentPoint.filter((zone) => zone.type === "random_event_area");

    return {
      currentKingdomArea,
      currentFactionAreas,
      currentCityArea,
      currentDangerAreas,
      currentResourceAreas,
      currentRandomEventAreas,
    };
  }, [passiveZonesAtCurrentPoint]);
  const passiveAreaStatusLines = useMemo(() => {
    const lines: string[] = [];

    if (currentPassiveContexts.currentKingdomArea) {
      lines.push(`Территория королевства: ${currentPassiveContexts.currentKingdomArea.name}`);
    }
    if (currentPassiveContexts.currentCityArea) {
      lines.push(`Территория города: ${currentPassiveContexts.currentCityArea.name}`);
    }
    if (currentPassiveContexts.currentFactionAreas.length > 0) {
      lines.push(`Территории фракций: ${currentPassiveContexts.currentFactionAreas.map((zone) => zone.name).join(", ")}`);
    }
    if (currentPassiveContexts.currentDangerAreas.length > 0) {
      lines.push(`Опасные области: ${currentPassiveContexts.currentDangerAreas.map((zone) => zone.name).join(", ")}`);
    }
    if (currentPassiveContexts.currentResourceAreas.length > 0) {
      lines.push(`Ресурсные области: ${currentPassiveContexts.currentResourceAreas.map((zone) => zone.name).join(", ")}`);
    }
    if (currentPassiveContexts.currentRandomEventAreas.length > 0) {
      lines.push(`Области случайных событий: ${currentPassiveContexts.currentRandomEventAreas.map((zone) => zone.name).join(", ")}`);
    }

    lines.push(`currentKingdomArea: ${currentPassiveContexts.currentKingdomArea?.name ?? "-"}`);
    lines.push(`currentFactionAreas: ${currentPassiveContexts.currentFactionAreas.map((zone) => zone.name).join(", ") || "-"}`);
    lines.push(`currentCityArea: ${currentPassiveContexts.currentCityArea?.name ?? "-"}`);
    lines.push(`currentDangerAreas: ${currentPassiveContexts.currentDangerAreas.map((zone) => zone.name).join(", ") || "-"}`);
    lines.push(`currentResourceAreas: ${currentPassiveContexts.currentResourceAreas.map((zone) => zone.name).join(", ") || "-"}`);
    lines.push(`currentRandomEventAreas: ${currentPassiveContexts.currentRandomEventAreas.map((zone) => zone.name).join(", ") || "-"}`);

    return lines;
  }, [currentPassiveContexts]);

  useEffect(() => {
    const kingdomArea = currentPassiveContexts.currentKingdomArea;
    const kingdomKey = (kingdomArea?.kingdomId || kingdomArea?.id || '').trim() || null;
    const cue = kingdomArea?.music;
    const sources = getWorldAudioCueSources(cue);
    const targetVolume = Math.max(0, Math.min(1, (cue?.volume ?? 0.45) * getGlobalAudioVolume()));
    const fadeOutMs = Math.max(250, cue?.fadeOutMs ?? 1200);
    const fadeInMs = Math.max(250, cue?.fadeInMs ?? 1200);

    const ensureAudioPair = () => {
      if (!worldMusicActiveAudioRef.current) {
        const active = new Audio();
        active.preload = 'auto';
        active.loop = true;
        worldMusicActiveAudioRef.current = active;
      }
      if (!worldMusicIdleAudioRef.current) {
        const idle = new Audio();
        idle.preload = 'auto';
        idle.loop = true;
        worldMusicIdleAudioRef.current = idle;
      }
    };

    const clearFade = () => {
      if (worldMusicFadeRafRef.current !== null) {
        window.cancelAnimationFrame(worldMusicFadeRafRef.current);
        worldMusicFadeRafRef.current = null;
      }
    };

    const fadeOutAndStop = (audio: HTMLAudioElement | null, durationMs: number) => {
      if (!audio) {
        return;
      }
      clearFade();
      const startAt = performance.now();
      const fromVolume = Number.isFinite(audio.volume) ? audio.volume : targetVolume;
      const step = (now: number) => {
        const progress = Math.min(1, Math.max(0, (now - startAt) / durationMs));
        audio.volume = Math.max(0, fromVolume * (1 - progress));
        if (progress >= 1) {
          audio.pause();
          audio.currentTime = 0;
          audio.removeAttribute('src');
          audio.load();
          worldMusicFadeRafRef.current = null;
          return;
        }
        worldMusicFadeRafRef.current = window.requestAnimationFrame(step);
      };
      worldMusicFadeRafRef.current = window.requestAnimationFrame(step);
    };

    const pickRandomSource = (pool: string[], previous: string | null): string => {
      if (pool.length <= 1) {
        return pool[0]!;
      }
      const candidates = pool.filter((entry) => entry !== previous);
      const sourcePool = candidates.length > 0 ? candidates : pool;
      const randomIndex = Math.floor(Math.random() * sourcePool.length);
      return sourcePool[Math.max(0, Math.min(sourcePool.length - 1, randomIndex))]!;
    };

    if (!kingdomKey || sources.length === 0) {
      worldMusicCurrentKingdomRef.current = null;
      fadeOutAndStop(worldMusicActiveAudioRef.current, fadeOutMs);
      return;
    }

    const sameKingdom = worldMusicCurrentKingdomRef.current === kingdomKey;
    const activeAudio = worldMusicActiveAudioRef.current;
    const currentlyPlaying = Boolean(activeAudio && !activeAudio.paused && activeAudio.currentSrc);
    if (sameKingdom && currentlyPlaying) {
      return;
    }

    ensureAudioPair();

    const outgoing = worldMusicActiveAudioRef.current;
    const incoming = worldMusicIdleAudioRef.current;
    if (!incoming) {
      return;
    }

    const previousTrack = worldMusicLastTrackByKingdomRef.current.get(kingdomKey) ?? null;
    const nextSource = pickRandomSource(sources, previousTrack);
    worldMusicLastTrackByKingdomRef.current.set(kingdomKey, nextSource);
    worldMusicCurrentKingdomRef.current = kingdomKey;

    incoming.pause();
    incoming.currentTime = 0;
    incoming.src = nextSource;
    incoming.loop = true;
    incoming.volume = 0;

    const playPromise = incoming.play();
    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise.then(() => {
        clearFade();
        const startAt = performance.now();
        const outgoingVolume = outgoing ? Math.max(0, outgoing.volume || targetVolume) : 0;
        const durationMs = Math.max(fadeOutMs, fadeInMs);
        const step = (now: number) => {
          const elapsed = now - startAt;
          const fadeOutProgress = Math.min(1, Math.max(0, elapsed / fadeOutMs));
          const fadeInProgress = Math.min(1, Math.max(0, elapsed / fadeInMs));

          if (outgoing) {
            outgoing.volume = Math.max(0, outgoingVolume * (1 - fadeOutProgress));
          }
          incoming.volume = Math.max(0, targetVolume * fadeInProgress);

          if (elapsed >= durationMs) {
            incoming.volume = targetVolume;
            if (outgoing) {
              outgoing.pause();
              outgoing.currentTime = 0;
              outgoing.removeAttribute('src');
              outgoing.load();
            }
            worldMusicActiveAudioRef.current = incoming;
            worldMusicIdleAudioRef.current = outgoing ?? worldMusicIdleAudioRef.current;
            worldMusicFadeRafRef.current = null;
            return;
          }

          worldMusicFadeRafRef.current = window.requestAnimationFrame(step);
        };

        worldMusicFadeRafRef.current = window.requestAnimationFrame(step);
      }).catch(() => {
        // Ignore autoplay restrictions silently; audio starts after next user interaction.
      });
    }
  }, [currentPassiveContexts.currentKingdomArea]);
  const nearbyNpcs = useMemo(
    () =>
      getNearbyMappedNpcs(
        "worldmap-main",
        playerPosition.x,
        playerPosition.y,
        0.09,
      ),
    [playerPosition.x, playerPosition.y],
  );
  const nearbyNpcReactions = useMemo(
    () => nearbyNpcs.map((entry) => ({ ...entry, reaction: resolveNpcReaction(entry.npc) })),
    [nearbyNpcs],
  );
  const automaticQuestMarkers = useMemo(() => {
    const manualObjectiveMarkerKeys = new Set(
      questMarkers
        .map(getManualQuestObjectiveMarkerKey)
        .filter((entry): entry is string => Boolean(entry)),
    );
    const markers: QuestMarkerDefinition[] = [];

    for (const state of playerQuestStates) {
      if (state.status !== 'active') {
        continue;
      }

      const quest = questDefinitions.find((entry) => entry.id === state.questId) ?? null;
      if (!quest) {
        continue;
      }

      const currentStep = getQuestCurrentStep(quest, state);
      if (!currentStep) {
        continue;
      }

      for (const objective of currentStep.objectives ?? []) {
        if (state.completedObjectiveIds.includes(objective.id)) {
          continue;
        }
        if (objective.autoMarker === false) {
          continue;
        }

        const objectiveMarkerKey = `${quest.id}:${objective.id}`;
        if (manualObjectiveMarkerKeys.has(objectiveMarkerKey)) {
          continue;
        }

        const targetId = getObjectiveAutoMarkerTargetId(objective);
        if (!targetId) {
          continue;
        }

        const targetZone = findAutoQuestMarkerTargetZone(targetId, zones);
        if (!targetZone) {
          if (import.meta.env.DEV) {
            console.warn('[QuestMarkers] target zone not found for objective', {
              questId: quest.id,
              stepId: currentStep.id,
              objectiveId: objective.id,
              targetId,
            });
          }
          continue;
        }

        const [x, y] = getZoneCenter(targetZone);
        const markerType = String(objective.markerType ?? '').trim() || 'quest_objective';
        const objectiveDescription = String(
          objective.markerDescription
          ?? objective.description
          ?? currentStep.journalText
          ?? '',
        ).trim();
        const title = String(objective.markerLabel ?? quest.title ?? '').trim() || quest.id;

        markers.push({
          id: `auto_marker_${quest.id}_${objective.id}`,
          mapId: 'worldmap-main',
          x,
          y,
          type: markerType as QuestMarkerDefinition['type'],
          title,
          description: objectiveDescription || undefined,
          targetId,
          zoneId: targetZone.id,
          linkedQuestId: quest.id,
          linkedStepId: currentStep.id,
          linkedObjectiveId: objective.id,
          objectiveId: objective.id,
          visibleToPlayer: true,
          conditionIds: [],
          isActive: true,
          hideAfterQuestCompleted: true,
          hideAfterObjectiveCompleted: objective.hideMarkerWhenCompleted !== false,
          hideAfterStepCompleted: false,
          showOnWorldMap: true,
          showOnMiniMap: true,
          worldMapVisibility: 'always',
          miniMapVisibility: 'always',
          runtimeQuestTitle: title,
          runtimeQuestIconUrl: resolveQuestIcon(quest, runtimeImages),
          runtimeQuestObjectiveText: objectiveDescription || undefined,
        } as QuestMarkerDefinition);
      }
    }

    return markers;
  }, [playerQuestStates, questDefinitions, questMarkers, runtimeImages, zones]);

  const runtimeQuestMarkers = useMemo(
    () => mergeQuestMarkerLists(questMarkers, automaticQuestMarkers),
    [automaticQuestMarkers, questMarkers],
  );

  const playQuestMarkers = useMemo(() => {
    const activeStates = playerQuestStates.filter((entry) => entry.status === "active");
    const stateByQuestId = new Map(activeStates.map((state) => [state.questId, state]));

    const visibleMarkers = runtimeQuestMarkers.filter((marker) => {
      if (marker.mapId !== "worldmap-main") {
        return false;
      }

      const linkedQuestId = marker.linkedQuestId?.trim() || null;
      const state = linkedQuestId ? stateByQuestId.get(linkedQuestId) ?? null : null;

      // Build player context for requirement checks.
      const player: QuestRuntimePlayer = {
        id: character.id,
        level: character.level,
        race: character.race,
        ...questRuntimeProfessionCompat,
        activeQuestIds: playerQuestStates.filter((entry) => entry.status === "active").map((entry) => entry.questId),
        completedQuestIds: playerQuestStates.filter((entry) => entry.status === "completed").map((entry) => entry.questId),
        itemIds: inventory.items.filter((entry) => entry.quantity > 0).map((entry) => entry.itemId),
      };

      // 1) Data-driven visibility: isActive / requirements / hideAfter* flags.
      const requirementResult = checkMarkerRequirements(marker, player);
      if (requirementResult === false) {
        return false;
      }
      if (requirementResult === true) {
        return true;
      }

      // 2) Legacy: active quest objective markers (must be visible even if visibleToPlayer=false).
      if (state) {
        if (marker.linkedStepId && marker.linkedStepId !== state.currentStepId) {
          return false;
        }
        const markerObjectiveId = String(
          marker.linkedObjectiveId ?? marker.objectiveId ?? ""
        ).trim();

        if (markerObjectiveId && state.completedObjectiveIds.includes(markerObjectiveId)) {
          return false;
        }
        return true;
      }

      // 3) Legacy: public markers.
      if (marker.visibleToPlayer) {
        return true;
      }

      // 4) Legacy: quest start markers (show if quest can start and is not yet active/completed).
      if (marker.type === "quest_start" && linkedQuestId) {
        const quest = questDefinitions.find((entry) => entry.id === linkedQuestId) ?? null;
        if (!quest) {
          return false;
        }
        return canStartQuest(player, quest);
      }

      return false;
    });

    return visibleMarkers.map((marker) => {
      const linkedQuestId = marker.linkedQuestId?.trim() || null;
      const linkedQuest = linkedQuestId
        ? questDefinitions.find((entry) => entry.id === linkedQuestId) ?? null
        : null;
      const linkedQuestState = linkedQuestId
        ? stateByQuestId.get(linkedQuestId) ?? null
        : null;
      const runtimeQuestIconUrl = resolveQuestIcon(linkedQuest, runtimeImages)
        ?? (marker.imageUrl?.trim() || undefined);
      const runtimeQuestObjectiveText = String((marker as QuestMarkerDefinition & { runtimeQuestObjectiveText?: string }).runtimeQuestObjectiveText ?? '').trim()
        || marker.description?.trim()
        || (linkedQuest ? resolveQuestMarkerObjectiveText(marker, linkedQuest, linkedQuestState) : undefined);
      return {
        ...marker,
        runtimeQuestTitle: String((marker as QuestMarkerDefinition & { runtimeQuestTitle?: string }).runtimeQuestTitle ?? '').trim()
          || marker.title?.trim()
          || linkedQuest?.title?.trim()
          || undefined,
        runtimeQuestIconUrl,
        runtimeQuestObjectiveText,
      };
    });
  }, [
    character.id,
    character.level,
    character.race,
    inventory.items,
    playerQuestStates,
    questRuntimeProfessionCompat,
    questDefinitions,
    runtimeQuestMarkers,
    runtimeImages,
  ]);
  const trackedQuestMarker = useMemo(
    () => getTrackedQuestMarker({
      questMarkers: playQuestMarkers,
      trackedQuestId,
      trackedObjectiveId,
      questStates: playerQuestStates,
      questDefinitions,
    }),
    [playQuestMarkers, playerQuestStates, questDefinitions, trackedObjectiveId, trackedQuestId],
  );
  const trackedQuestMarkerId = trackedQuestMarker?.id ?? null;

  useEffect(() => {
    if (!trackedQuestId) {
      return;
    }

    const state = playerQuestStates.find((entry) => entry.questId === trackedQuestId) ?? null;
    if (!state || state.status === "completed" || state.status === "failed" || state.status === "abandoned") {
      setTrackedQuestId(null);
      setTrackedObjectiveId(null);
      return;
    }

    if (!trackedQuestMarker) {
      return;
    }

    const nextObjectiveId = getQuestMarkerObjectiveId(trackedQuestMarker);
    if (nextObjectiveId && nextObjectiveId !== trackedObjectiveId) {
      setTrackedObjectiveId(nextObjectiveId);
    }
  }, [playerQuestStates, trackedObjectiveId, trackedQuestId, trackedQuestMarker]);
  const playNpcMarkers = useMemo(() => {
    // NPC interactions stay available, but map labels/markers are intentionally hidden.
    return [] as Array<{
      id: string;
      name: string;
      kind: string;
      x: number;
      y: number;
      isHostile: boolean;
      hasQuest: boolean;
    }>;
  }, []);
  const selectedNpcForInteraction = useMemo(() => {
    if (!selectedNpcForInteractionId) {
      return null;
    }

    return (
      npcs.find((entry) => entry.id === selectedNpcForInteractionId) ?? null
    );
  }, [npcs, selectedNpcForInteractionId]);
  const npcById = useMemo(() => {
    const entries = new Map<string, NpcDefinition>();
    for (const npc of npcs) {
      const rawId = String(npc.id ?? "").trim();
      if (!rawId) {
        continue;
      }

      entries.set(rawId, npc);
      const lowered = rawId.toLowerCase();
      if (!entries.has(lowered)) {
        entries.set(lowered, npc);
      }
    }
    return entries;
  }, [npcs]);
  const resolveNpcById = useCallback((id: string | null | undefined): NpcDefinition | null => {
    const normalized = String(id ?? "").trim();
    if (!normalized) {
      return null;
    }

    return npcById.get(normalized) ?? npcById.get(normalized.toLowerCase()) ?? null;
  }, [npcById]);

  useEffect(() => {
    if (!dialogueRunner.state.isOpen || !dialogueRunner.dialogue) {
      lastDialogueVoiceKeyRef.current = null;
      pendingDialogueVoicePlayRef.current = false;
      if (dialogueVoiceAudioRef.current) {
        dialogueVoiceAudioRef.current.pause();
        dialogueVoiceAudioRef.current.currentTime = 0;
      }
      return;
    }

    const contextNpcId = dialogueRunner.state.context?.npcId;
    const contextNpc = contextNpcId ? resolveNpcById(contextNpcId) : null;
    const voiceRef = String(
      dialogueRunner.dialogue.introVoiceAssetId
      ?? contextNpc?.dialogueStartVoiceAssetId
      ?? "",
    ).trim();

    if (!voiceRef) {
      return;
    }

    const voiceKey = `${dialogueRunner.dialogue.id}:${contextNpc?.id ?? ""}:${voiceRef}`;
    if (lastDialogueVoiceKeyRef.current === voiceKey) {
      return;
    }
    lastDialogueVoiceKeyRef.current = voiceKey;

    if (isLikelyWindowsLocalPath(voiceRef)) {
      if (!warnedDialogueVoiceSourcesRef.current.has(voiceRef)) {
        warnedDialogueVoiceSourcesRef.current.add(voiceRef);
        onStatus("Голос диалога задан как локальный путь Windows. Загрузите файл через админку, чтобы получить asset ID.");
      }
      return;
    }

    const source = isDirectAudioSource(voiceRef)
      ? voiceRef
      : `/api/content/assets/audio/${encodeURIComponent(voiceRef)}/raw`;

    try {
      const audio = dialogueVoiceAudioRef.current ?? new Audio();
      dialogueVoiceAudioRef.current = audio;
      audio.pause();
      audio.currentTime = 0;
      audio.preload = "auto";
      audio.src = source;
      audio.volume = getGlobalAudioVolume();
      void audio.play()
        .then(() => {
          pendingDialogueVoicePlayRef.current = false;
        })
        .catch((error) => {
          const name = String((error as { name?: string } | null)?.name ?? '').toLowerCase();
          const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
          if (name.includes('aborterror') || message.includes('interrupted by a call to pause')) {
            pendingDialogueVoicePlayRef.current = false;
            return;
          }
          // Browser can block autoplay in edge cases; retry on the next explicit user gesture.
          pendingDialogueVoicePlayRef.current = true;
          if (!dialogueVoiceRetryBoundRef.current && typeof window !== "undefined") {
            dialogueVoiceRetryBoundRef.current = true;
            const retry = () => {
              dialogueVoiceRetryBoundRef.current = false;
              if (!pendingDialogueVoicePlayRef.current) {
                return;
              }
              const pendingAudio = dialogueVoiceAudioRef.current;
              if (!pendingAudio) {
                return;
              }
              pendingAudio.volume = getGlobalAudioVolume();
              void pendingAudio.play()
                .then(() => {
                  pendingDialogueVoicePlayRef.current = false;
                })
                .catch(() => {
                  // Keep silent fail to avoid interrupting gameplay.
                });
            };
            window.addEventListener("pointerdown", retry, { once: true, capture: true });
          }
        });
    } catch {
      // Ignore audio setup failures to avoid breaking dialogue flow.
    }
  }, [dialogueRunner.dialogue, dialogueRunner.state.context, dialogueRunner.state.isOpen, onStatus, resolveNpcById]);
  const npcQuestMarkerPlayer = useMemo<QuestRuntimePlayer>(() => {
    const activeQuestIds = playerQuestStates
      .filter((entry) => entry.playerId === character.id && entry.status === "active")
      .map((entry) => entry.questId);
    const completedQuestIds = playerQuestStates
      .filter((entry) => entry.playerId === character.id && entry.status === "completed")
      .map((entry) => entry.questId);
    const itemIds = inventory.items
      .filter((entry) => entry.quantity > 0)
      .map((entry) => entry.itemId);

    return {
      id: character.id,
      level: character.level,
      race: character.race,
      gold: inventory.gold,
      itemIds,
      activeQuestIds,
      completedQuestIds,
    };
  }, [character.id, character.level, character.race, inventory.gold, inventory.items, playerQuestStates]);
  const npcQuestMarkerById = useMemo(() => {
    const dialogues = getAllDialogues();
    return new Map(
      npcs.map((npc) => [
        npc.id,
        getNpcQuestMarker({
          npc,
          player: npcQuestMarkerPlayer,
          questDefinitions,
          playerQuestStates,
          dialogues,
        }),
      ]),
    );
  }, [npcQuestMarkerPlayer, npcs, playerQuestStates, questDefinitions]);
  const resolveNpcPortrait = useCallback(
    (npc: NpcDefinition | null | undefined) => {
      if (!npc) {
        return undefined;
      }

      const candidates = [npc.fullImageUrl, npc.portraitUrl, npc.combatImageUrl, npc.iconUrl]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));

      for (const candidate of candidates) {
        const resolved = resolveStoredImageSource(candidate, runtimeImages);
        if (resolved) {
          return resolved;
        }

        if (
          candidate.startsWith("/")
          || candidate.startsWith("data:")
          || candidate.startsWith("http://")
          || candidate.startsWith("https://")
        ) {
          return candidate;
        }
      }

      return undefined;
    },
    [runtimeImages],
  );
  const merchantById = useMemo(() => {
    const entries = new Map<string, AdminMerchant>();
    for (const merchant of cityMerchants) {
      entries.set(merchant.id, merchant);
    }
    for (const merchant of contentSnapshot?.merchants ?? []) {
      entries.set(merchant.id, merchant);
    }
    return entries;
  }, [cityMerchants, contentSnapshot?.merchants]);
  const appendLocationPlaceSystemMessage = useCallback((text: string) => {
    const message = text.trim();
    if (!message) {
      return;
    }

    const now = Date.now();
    setSystemChat((prev) => [
      ...prev,
      {
        id: `sys-location-place-${now}-${nextSystemChatIdRef.current++}`,
        text: message,
        type: "system" as const,
      },
    ].slice(-12));
    onStatus(message);
  }, [onStatus]);
  const visibleCityLocations = useMemo(
    () =>
      (activeCity?.locations ?? []).filter(
        (location) => location.isVisible && location.isUnlocked,
      ),
    [activeCity?.locations],
  );
  const selectedCityLocation = useMemo(
    () =>
      locationView === "city" && selectedCityLocationId && activeCity?.locations
        ? (activeCity.locations.find(
          (location) => location.id === selectedCityLocationId,
        ) ?? null)
        : null,
    [activeCity?.locations, locationView, selectedCityLocationId],
  );
  const avatarLetter = character.name.trim().charAt(0).toUpperCase() || "H";
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [selectedZoneId, zones],
  );
  const playVisibleZones = useMemo(() => {
    const discoveredLocationIds = new Set(mapDiscoveryState.discoveredLocationIds);
    const discoveredZoneIds = new Set(mapDiscoveryState.discoveredZoneIds);
    return zones.map((zone) => {
      if (zone.type !== "location" || !contentSnapshot) {
        return zone;
      }
      const linkedLocation = getZoneLinkedLocation(zone, contentSnapshot);
      if (!linkedLocation) {
        return zone;
      }
      return {
        ...zone,
        subtype: zone.subtype ?? linkedLocation.subtype,
        currentState: zone.currentState ?? linkedLocation.currentState,
        hidden: zone.hidden === true || linkedLocation.isHidden === true || linkedLocation.hidden === true,
        requiresDiscovery: zone.requiresDiscovery === true || linkedLocation.requiresDiscovery === true,
      };
    }).filter((zone) => {
      if (zone.isVisibleToPlayer === false) {
        return false;
      }
      if (zone.hidden === true) {
        return false;
      }
      const linkedLocationId = zone.linkedLocationId ?? zone.linkedLocation ?? zone.id;
      const zoneDiscovered = zone.isDiscovered === true
        || discoveredZoneIds.has(zone.id)
        || discoveredLocationIds.has(linkedLocationId);
      if (zone.requiresDiscovery === true && !zoneDiscovered) {
        return false;
      }
      if (zone.type !== "location" || !contentSnapshot) {
        return true;
      }
      const linkedLocation = getZoneLinkedLocation(zone, contentSnapshot);
      if (!linkedLocation) {
        return true;
      }
      const linkedLocationDiscovered = linkedLocation.isDiscovered === true
        || linkedLocation.requiresDiscovery === false
        || discoveredLocationIds.has(linkedLocation.id);
      if (linkedLocation.requiresDiscovery === true && !linkedLocationDiscovered) {
        return false;
      }
      return isLinkedLocationVisibleToPlayer(linkedLocation);
    });
  }, [contentSnapshot, mapDiscoveryState.discoveredLocationIds, mapDiscoveryState.discoveredZoneIds, zones]);
  const paintedCellMap = useMemo(() => getPaintedRegionCellMap(regions), [regions]);
  const resolveCanMoveTo = useCallback((x: number, y: number) => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    return cell ? !isBlockedRegionType(cell.regionType) : true;
  }, [paintedCellMap]);
  const resolveSpeedMultiplier = useCallback((x: number, y: number) => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    return cell ? getRegionMoveSpeedMultiplier(cell.regionType) : 1;
  }, [paintedCellMap]);
  useEffect(() => {
    const cellX = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(playerPosition.x * REGION_GRID_SIZE)));
    const cellY = Math.max(0, Math.min(REGION_GRID_SIZE - 1, Math.floor(playerPosition.y * REGION_GRID_SIZE)));
    const cell = paintedCellMap.get(`${cellX}:${cellY}`);
    setTerrainStaminaDrainMultiplier(cell ? getRegionStaminaCostMultiplier(cell.regionType) : 1);
  }, [paintedCellMap, playerPosition.x, playerPosition.y]);
  const mapDiscoveryMarkers = useMemo<MapDiscoveryMarker[]>(() => {
    const cityIds = new Set(mapDiscoveryState.discoveredCityIds);
    const locationIds = new Set(mapDiscoveryState.discoveredLocationIds);
    const zoneIds = new Set(mapDiscoveryState.discoveredZoneIds);
    const markers: MapDiscoveryMarker[] = [];

    const findCityZone = (city: City): WorldMapZone | null => {
      const worldZoneId = city.worldZoneId?.trim();
      if (worldZoneId) {
        const direct = zones.find((zone) => zone.id === worldZoneId) ?? null;
        if (direct) {
          return direct;
        }
      }

      return zones.find((zone) => (
        zone.type === "city" &&
        (
          zone.cityId === city.id ||
          zone.id === city.id ||
          normalizeCitySceneId(zone.targetScene) === city.id
        )
      )) ?? null;
    };

    for (const city of contentSnapshot?.cities ?? validationCities) {
      if (!cityIds.has(city.id)) {
        continue;
      }

      const zone = findCityZone(city);
      if (!zone || zone.isVisibleToPlayer === false) {
        continue;
      }

      const [x, y] = getZoneCenter(zone);
      markers.push({
        id: `city:${city.id}`,
        entityId: city.id,
        entityType: "city",
        title: city.name,
        x,
        y,
        icon: "city",
        discovered: true,
      });
    }

    for (const location of contentSnapshot?.locations ?? []) {
      const discoveredByFlag = location.isDiscovered === true || location.requiresDiscovery === false;
      if (!locationIds.has(location.id) && !discoveredByFlag) {
        continue;
      }
      if (!isLinkedLocationVisibleToPlayer(location)) {
        continue;
      }

      const zone = zones.find((entry) => (
        entry.type === "location" &&
        (
          entry.linkedLocationId === location.id ||
          entry.linkedLocation === location.id ||
          entry.id === location.id
        )
      )) ?? null;
      if (!zone || zone.isVisibleToPlayer === false) {
        continue;
      }

      const [x, y] = getZoneCenter(zone);
      markers.push({
        id: `location:${location.id}`,
        entityId: location.id,
        entityType: "location",
        title: location.name,
        x,
        y,
        icon: location.subtype,
        discovered: true,
      });
    }

    for (const zone of zones) {
      if (!zoneIds.has(zone.id) || zone.type === "city" || zone.type === "location" || zone.isVisibleToPlayer === false) {
        continue;
      }
      if (zone.type !== "landmark" && zone.type !== "settlement" && zone.type !== "safe" && zone.type !== "rest") {
        continue;
      }

      const [x, y] = getZoneCenter(zone);
      markers.push({
        id: `zone:${zone.id}`,
        entityId: zone.id,
        entityType: "zone",
        title: zone.name,
        x,
        y,
        icon: zone.type,
        discovered: true,
      });
    }

    return markers;
  }, [contentSnapshot?.cities, contentSnapshot?.locations, mapDiscoveryState, validationCities, zones]);
  const worldMapValidationIssues = useMemo(
    () =>
      validateWorldMapContent({
        zones: zones as unknown[],
        questMarkers: questMarkers as unknown[],
        npcs: npcs as unknown[],
        quests: questDefinitions as unknown[],
        cities: validationCities as unknown[],
        lootTables: validationSnapshot?.lootTables as unknown[] | undefined,
        battleMaps: validationSnapshot?.battleMaps as unknown[] | undefined,
        items: validationSnapshot?.items as unknown[] | undefined,
        professionIds: compatibleProfessionIds,
        mineIds: loadMinesFromStorage().map((entry) => entry.id),
      }),
    [
      npcs,
      questDefinitions,
      questMarkers,
      validationCities,
      validationSnapshot?.battleMaps,
      validationSnapshot?.items,
      validationSnapshot?.lootTables,
      compatibleProfessionIds,
      zones,
    ],
  );
  const regionColor = regionColorByType[regionType] ?? REGION_TYPE_HEX_COLORS[regionType];
  const handleRegionTypeChange = useCallback((nextType: RegionType) => {
    setRegionType(nextType);
  }, []);

  const handleRegionColorChange = useCallback((nextColor: string) => {
    setRegionColorByType((prev) => ({
      ...prev,
      [regionType]: nextColor,
    }));
  }, [regionType]);

  const regionPaintSettings = useMemo(
    () => ({
      toolMode: regionToolMode,
      regionType,
      brushSize: regionBrushSize,
      regionColor,
    }),
    [regionBrushSize, regionColor, regionToolMode, regionType],
  );

  const flushQueuedEditorSaves = useCallback(function run() {
    if (editorSaveInFlightRef.current || !queuedEditorSaveRef.current) {
      return;
    }

    const nextSnapshot = queuedEditorSaveRef.current;
    queuedEditorSaveRef.current = null;
    setAutosaveStatus("saving");

    editorSaveInFlightRef.current = (async () => {
      try {
        if (
          nextSnapshot.zones.length === 0
          && nextSnapshot.regions.length === 0
          && nextSnapshot.questMarkers.length === 0
        ) {
          clearZoneStorage();
          await saveEditorDataToBackend([], [], []);
          replaceAllZones([]);
        } else {
          await saveEditorDataToBackend(
            nextSnapshot.zones,
            nextSnapshot.regions,
            nextSnapshot.questMarkers,
          );
          replaceAllZones(nextSnapshot.zones);
        }
        setAutosaveStatus("autosaved");
      } catch {
        setAutosaveStatus("save failed");
      }
    })().finally(() => {
      editorSaveInFlightRef.current = null;
      run();
    });
  }, []);

  const queueEditorSave = useCallback(
    (
      snapshot: {
        zones: WorldMapZone[];
        regions: PaintedRegion[];
        questMarkers: QuestMarkerDefinition[];
      },
    ) => {
      queuedEditorSaveRef.current = {
        zones: cloneZones(snapshot.zones),
        regions: snapshot.regions.map((region) => ({
          ...region,
          cells: region.cells.map((cell) => ({ ...cell })),
        })),
        questMarkers: snapshot.questMarkers.map((marker) => ({
          ...marker,
          conditionIds: [...marker.conditionIds],
          requirements: marker.requirements
            ? marker.requirements.map((entry) => ({ ...entry }))
            : undefined,
        })),
      };
      flushQueuedEditorSaves();
    },
    [flushQueuedEditorSaves],
  );

  const reloadWorldMapFromBackend = useCallback(
    async (options?: { force?: boolean }) => {
      if (worldMapMode === "editor") {
        return;
      }

      const now = Date.now();
      if (
        !options?.force &&
        worldMapRefreshRef.current &&
        now - lastWorldMapRefreshAtRef.current < 1200
      ) {
        return worldMapRefreshRef.current;
      }

      lastWorldMapRefreshAtRef.current = now;
      const refreshPromise = loadEditorDataFromBackend(
        cloneZones(WORLD_MAP_ZONES),
      )
        .then((loaded) => {
          skipNextZonePersistRef.current = true;
          setZones(loaded.zones);
          setRegions(loaded.regions);
          setQuestMarkers((current) =>
            mergeQuestMarkerLists(loaded.questMarkers, current),
          );
          replaceAllZones(loaded.zones);
          setCurrentZone((previous) =>
            previous
              ? (loaded.zones.find((zone) => zone.id === previous.id) ??
                previous)
              : previous,
          );
          setHoverZone((previous) =>
            previous
              ? (loaded.zones.find((zone) => zone.id === previous.id) ??
                previous)
              : previous,
          );
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
    },
    [worldMapMode],
  );

  useEffect(() => {
    if (worldMapMode !== "editor") {
      return;
    }

    // Block the persist effect from firing with stale WORLD_MAP_ZONES while
    // the async backend load is in progress.  This ref must be set
    // synchronously here (before the persist effect runs in the same render
    // cycle) so that the first persist triggered by worldMapMode→"editor"
    // is skipped.  The second skip (after setZones) is set inside .then().
    skipNextZonePersistRef.current = true;

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
        // Allow normal saves after a failed load.
        skipNextZonePersistRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [worldMapMode]);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const snapshot = await getContentSnapshot();
        if (!cancelled) {
          setContentSnapshot(snapshot);
        }
      } catch {
        if (!cancelled) {
          setContentSnapshot(null);
        }
      }
    };

    void loadSnapshot();

    const unsubscribe = subscribeToContentSync((payload) => {
      if (
        payload.scope === "all"
        || payload.scope === "worldMap"
        || payload.scope === "content"
      ) {
        void loadSnapshot();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setEditorJson(exportEditorDataJson(zones, regions, questMarkers));
  }, [questMarkers, regions, zones]);

  useEffect(() => {
    if (worldMapMode !== "editor" && markerPickMode) {
      setMarkerPickMode(false);
    }
  }, [markerPickMode, worldMapMode]);

  useEffect(() => {
    if (worldMapMode === "play") {
      return;
    }

    if (worldMapViewerOpen) {
      setWorldMapViewerOpen(false);
    }
  }, [worldMapMode, worldMapViewerOpen]);

  useEffect(() => {
    if (worldMapMode !== "play") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) {
        return;
      }

      if (event.key === "Escape" && worldMapViewerOpen) {
        event.preventDefault();
        setWorldMapViewerOpen(false);
        return;
      }

      if (event.code === "KeyM") {
        event.preventDefault();
        setWorldMapViewerOpen((current) => !current);
        return;
      }

      if (event.code === "KeyN") {
        event.preventDefault();
        setMiniMapVisible((current) => !current);
        return;
      }

      if (event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        handlePrimaryWorldInteractionRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [worldMapMode, worldMapViewerOpen]);

  useEffect(() => {
    if (!activeCityId) {
      setActiveCity(null);
      setActiveCityBackgroundUrl("");
      return;
    }

    let cancelled = false;
    cityService
      .getCityById(activeCityId)
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
    const fallbackUrl = activeCity?.backgroundImageUrl?.trim() || "";

    if (!imageId) {
      setActiveCityBackgroundUrl(fallbackUrl);
      return;
    }

    if (isDirectLocationImageSource(imageId)) {
      setActiveCityBackgroundUrl(imageId);
      return;
    }

    imageService
      .get(imageId)
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

  const activeLocation = useMemo(() => {
    if (!activeLocationId || !contentSnapshot) return null;
    return contentSnapshot.locations.find((entry) => entry.id === activeLocationId) ?? null;
  }, [activeLocationId, contentSnapshot]);
  const activeTutorial = useMemo(
    () => getTutorialDefinition(tutorialState.activeTutorialId),
    [tutorialState.activeTutorialId],
  );
  const zoneLinkedLocation = useMemo(() => {
    if (!contentSnapshot || currentZone?.type !== "location") {
      return null;
    }
    const linkedLocationId = currentZone.linkedLocationId ?? currentZone.linkedLocation ?? currentZone.id;
    return contentSnapshot.locations.find((entry) => entry.id === linkedLocationId) ?? null;
  }, [contentSnapshot, currentZone]);

  useEffect(() => {
    let cancelled = false;
    const imageRef = resolveLocalLocationMapImageRef(activeLocation);
    if (!imageRef) {
      setActiveLocationBackgroundUrl("");
      return;
    }
    if (isDirectLocationImageSource(imageRef)) {
      setActiveLocationBackgroundUrl(imageRef);
      return;
    }
    imageService
      .get(imageRef)
      .then((image) => {
        if (!cancelled) {
          setActiveLocationBackgroundUrl(image?.dataUrl ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveLocationBackgroundUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLocation?.id, activeLocation?.currentState, (activeLocation?.stateVariants ?? []).length, activeLocation?.defaultImageId, activeLocation?.defaultImagePath]);

  useEffect(() => {
    let cancelled = false;

    void loadRuntimeImages()
      .then((images) => {
        if (!cancelled) {
          setRuntimeImages(images);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntimeImages([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (worldMapMode !== "editor") {
      return;
    }

    let cancelled = false;

    void Promise.allSettled([cityService.getCities(), getContentSnapshot()]).then(
      (results) => {
        if (cancelled) {
          return;
        }

        const [citiesResult, snapshotResult] = results;
        if (citiesResult.status === "fulfilled") {
          setValidationCities(citiesResult.value);
        } else {
          setValidationCities([]);
        }

        if (snapshotResult.status === "fulfilled") {
          setValidationSnapshot(snapshotResult.value);
        } else {
          setValidationSnapshot(null);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [worldMapMode]);

  useEffect(() => {
    void Promise.all([ensureQuestsLoaded(), ensureNpcsLoaded(), ensureDialoguesLoaded()])
      .then(() => {
        setQuestDefinitions(getAllQuests());
        setQuestInteractions(getQuestInteractions());
        setPlayerQuestStates(
          getAllPlayerQuestStates().filter(
            (entry) => entry.playerId === character.id,
          ),
        );
        setNpcs(getAllNpcs());
      })
      .catch(() => {
        setQuestDefinitions([]);
        setQuestInteractions([]);
        setQuestMarkers([]);
        setNpcs([]);
      });
  }, [character.id]);

  useEffect(() => {
    const profile = loadCharacterProfile(character.id);
    const restored = loadSavedPlayerPosition(character.id);
    const resolvedFromWorldState = resolvePlayerPositionFromWorldState(profile?.worldState, zones);

    if (restored) {
      const expectedZoneId = String(profile?.worldState?.currentZoneId ?? '').trim();
      const expectedLocationId = String(profile?.worldState?.currentLocationId ?? '').trim();
      const restoredZone = detectHoverZone(zones as Zone[], restored.x, restored.y);
      const restoredMatchesExpectedZone = !restoredZone
        ? false
        : (
          (expectedZoneId.length > 0 && restoredZone.id === expectedZoneId)
          || (expectedLocationId.length > 0 && (
            restoredZone.linkedLocationId === expectedLocationId
            || restoredZone.linkedLocation === expectedLocationId
            || restoredZone.id === expectedLocationId
          ))
        );
      const hasExpectedSpawnTarget = expectedZoneId.length > 0 || expectedLocationId.length > 0;

      if (!hasExpectedSpawnTarget || restoredMatchesExpectedZone) {
        playerPositionHydratedCharacterRef.current = character.id;
        setPlayerPosition(restored);
        setPlaySpawnPosition(restored);
        return;
      }

      console.info('[worldMap] drop stale saved playerPosition', {
        characterId: character.id,
        restored,
        expectedZoneId: expectedZoneId || null,
        expectedLocationId: expectedLocationId || null,
      });
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(getPlayerPositionStorageKey(character.id));
      }
    }

    if (profile?.worldState && !resolvedFromWorldState) {
      return;
    }

    const nextPosition = resolvedFromWorldState ?? DEFAULT_PLAYER_POSITION;
    playerPositionHydratedCharacterRef.current = character.id;
    setPlayerPosition(nextPosition);
    setPlaySpawnPosition(nextPosition);
  }, [character.id, zones]);

  useEffect(() => {
    setTutorialState(loadTutorialState(character.id));
  }, [character.id]);

  useEffect(() => {
    restoredWorldContextCharacterRef.current = null;
    initialSpawnResolvedCharacterRef.current = null;
    argosIntroAutoOpenCharacterRef.current = null;
    argosStartRecoveryCharacterRef.current = null;
  }, [character.id]);

  useEffect(() => {
    if (!contentSnapshot || restoredWorldContextCharacterRef.current === character.id) {
      return;
    }

    const profile = loadCharacterProfile(character.id);
    const savedState = profile?.worldState;
    restoredWorldContextCharacterRef.current = character.id;

    console.info("[worldMap] loaded active character location", {
      characterId: character.id,
      locationId: savedState?.currentLocationId ?? profile?.currentLocationId ?? profile?.locationId ?? null,
      zoneId: savedState?.currentZoneId ?? profile?.currentZoneId ?? profile?.zoneId ?? null,
      mapId: savedState?.currentMapId ?? profile?.currentMapId ?? profile?.mapId ?? null,
      initialSpawnCompleted: profile?.initialSpawnCompleted === true,
    });

    if (!savedState) {
      return;
    }

    const savedLocationId = String(savedState.currentLocationId ?? "").trim();
    const savedCityId = String(savedState.currentCityId ?? "").trim();
    const savedView = savedState.locationView;

    if (savedView === "city" && savedCityId) {
      setActiveCityId(savedCityId);
      setActiveLocationId(null);
      setActiveWorldModal(null);
      setLocationView("city");
      setContextMode("location");
      setPlayerState("in_city");
      return;
    }

    if (savedView === "location" && savedLocationId) {
      const savedLocation = contentSnapshot.locations.find((entry) => entry.id === savedLocationId) ?? null;
      if (locationHasLocalMap(savedLocation)) {
        setActiveLocationId(savedLocationId);
        setActiveCityId(null);
        setActiveWorldModal(null);
        setLocationView("location");
        setContextMode("location");
        setPlayerState("in_zone");
        return;
      }
      setActiveLocationId(null);
      setActiveCityId(null);
      setActiveWorldModal({
        type: "location",
        locationId: savedLocationId,
      });
      setLocationView("map");
      setContextMode("location");
      setPlayerState("in_zone");
    }
  }, [character.id, contentSnapshot]);

  useEffect(() => {
    if (!contentSnapshot || initialSpawnResolvedCharacterRef.current === character.id) {
      return;
    }

    const profile = loadCharacterProfile(character.id);
    if (!profile || !shouldResolveInitialSpawn(profile)) {
      initialSpawnResolvedCharacterRef.current = character.id;
      return;
    }

    const resolution = resolveInitialSpawn(profile, zones);
    if (!resolution) {
      return;
    }
    initialSpawnResolvedCharacterRef.current = character.id;

    setPlayerPosition(resolution.position);
    setPlaySpawnPosition(resolution.position);
    setCurrentZone(resolution.zone);
    setActiveCityId(null);
    setContextMode("location");
    setPlayerState("in_zone");

    const spawnedLocation = contentSnapshot.locations.find((entry) => entry.id === resolution.rule.locationId) ?? null;
    if (locationHasLocalMap(spawnedLocation)) {
      setActiveLocationId(resolution.rule.locationId);
      setActiveCityId(null);
      setActiveWorldModal(null);
      setLocationView("location");
      setContextMode("location");
      setPlayerState("in_zone");
    } else {
      setActiveLocationId(null);
      setActiveWorldModal({
        type: "location",
        locationId: resolution.rule.locationId,
      });
      setLocationView("map");
    }

    updateCharacterProfile(character.id, (currentProfile) => {
      if (!currentProfile) {
        return currentProfile;
      }
      return markInitialSpawnCompleted(currentProfile, resolution.worldState);
    });
  }, [character.id, contentSnapshot, zones]);

  useEffect(() => {
    if (!contentSnapshot || argosStartRecoveryCharacterRef.current === character.id) {
      return;
    }

    const profile = loadCharacterProfile(character.id);
    if (!profile || !isHumanArgosProfile(profile)) {
      return;
    }
    const activeProfile = profile;

    const expectedLocationId = String(
      activeProfile.worldState?.currentLocationId
      ?? activeProfile.currentLocationId
      ?? activeProfile.locationId
      ?? '',
    ).trim();
    if (expectedLocationId !== KLINOGORIE_START_LOCATION_ID) {
      return;
    }

    const resolution = resolveInitialSpawn(activeProfile, zones);
    if (!resolution) {
      return;
    }

    const currentZoneAtPlayer = detectHoverZone(zones as Zone[], playerPosition.x, playerPosition.y);
    const isAlreadyAtExpectedZone = Boolean(
      currentZoneAtPlayer
      && (
        currentZoneAtPlayer.id === resolution.rule.zoneId
        || currentZoneAtPlayer.linkedLocationId === resolution.rule.locationId
        || currentZoneAtPlayer.linkedLocation === resolution.rule.locationId
      ),
    );

    if (isAlreadyAtExpectedZone) {
      argosStartRecoveryCharacterRef.current = character.id;
      return;
    }

    console.info('[worldMap] force teleport to argos start', {
      characterId: character.id,
      from: { x: playerPosition.x, y: playerPosition.y },
      to: resolution.position,
      zoneId: resolution.rule.zoneId,
      locationId: resolution.rule.locationId,
    });

    setPlayerPosition(resolution.position);
    setPlaySpawnPosition(resolution.position);
    setCurrentZone(resolution.zone);
    setActiveCityId(null);
    setContextMode('location');
    setPlayerState('in_zone');

    const spawnedLocation = contentSnapshot.locations.find((entry) => entry.id === resolution.rule.locationId) ?? null;
    if (locationHasLocalMap(spawnedLocation)) {
      setActiveLocationId(resolution.rule.locationId);
      setActiveWorldModal(null);
      setLocationView('location');
    } else {
      setActiveLocationId(null);
      setActiveWorldModal({
        type: 'location',
        locationId: resolution.rule.locationId,
      });
      setLocationView('map');
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        getPlayerPositionStorageKey(character.id),
        JSON.stringify(resolution.position),
      );
    }

    updateCharacterProfile(character.id, (current) => {
      if (!current) {
        return current;
      }
      return {
        ...markInitialSpawnCompleted(current, resolution.worldState),
        introDialoguePending: current.introDialoguePending !== false,
      };
    });
    argosStartRecoveryCharacterRef.current = character.id;
  }, [character.id, contentSnapshot, zones]);

  useEffect(() => {
    if (!contentSnapshot || dialogueRunner.state.isOpen || argosIntroAutoOpenCharacterRef.current === character.id) {
      return;
    }

    const profile = loadCharacterProfile(character.id);
    if (!isHumanArgosProfile(profile) || profile?.flags?.[ARGOS_INTRO_SEEN_FLAG] === true) {
      return;
    }

    const currentLocationId = activeLocationId
      ?? (activeWorldModal?.type === "location" ? activeWorldModal.locationId : null)
      ?? profile?.worldState?.currentLocationId
      ?? null;

    if (currentLocationId !== KLINOGORIE_START_LOCATION_ID) {
      return;
    }

    const introPending = profile?.introDialoguePending === true
      || typeof profile?.introDialoguePending !== "boolean";
    if (!introPending) {
      return;
    }

    const knownDialogueIds = new Set(getAllDialogues().map((entry) => entry.id));
    const configuredDialogueId = String(profile?.introDialogueId ?? "").trim();
    const dialogueIdToOpen = [
      configuredDialogueId,
      "dlg_klinogorie_bran_intro",
      "dlg_npc_klinogorie_bran_legless_soldier_yyzx",
    ].find((candidate) => candidate && (knownDialogueIds.size === 0 || knownDialogueIds.has(candidate)))
      ?? "dlg_npc_klinogorie_bran_legless_soldier_yyzx";

    argosIntroAutoOpenCharacterRef.current = character.id;
    updateCharacterProfile(character.id, (current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        introDialoguePending: false,
      };
    });

    dialogueRunner.openDialogue(dialogueIdToOpen, {
      npcId: BRAN_INTRO_NPC_ID,
      locationId: KLINOGORIE_START_LOCATION_ID,
      sourceType: "location",
    });
  }, [
    activeLocationId,
    activeWorldModal,
    character.id,
    contentSnapshot,
    dialogueRunner,
  ]);

  useEffect(() => {
    if (worldMapMode !== "play") {
      return;
    }

    void reloadWorldMapFromBackend({ force: true });
  }, [reloadWorldMapFromBackend, worldMapMode]);

  useEffect(() => {
    if (worldMapMode !== "play") {
      return;
    }

    const refreshVisibleWorldMap = () => {
      void reloadWorldMapFromBackend();
    };

    const unsubscribe = subscribeToContentSync((payload) => {
      if (payload.scope === "worldMap" || payload.scope === "all") {
        void reloadWorldMapFromBackend({ force: true });
      }
    });

    const handleFocus = () => {
      refreshVisibleWorldMap();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshVisibleWorldMap();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reloadWorldMapFromBackend, worldMapMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const tracked = loadTrackedQuestState(character.id);
    setTrackedQuestId(tracked.questId);
    setTrackedObjectiveId(tracked.objectiveId);
    setDiscoveredWorldMapCells(loadDiscoveredCells(character.id));
    setMapDiscoveryState(loadMapDiscoveryState(character.id));
    lastRevealedCellRef.current = null;
  }, [character.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      getTrackedQuestStorageKey(character.id),
      JSON.stringify({
        questId: trackedQuestId,
        objectiveId: trackedObjectiveId,
      }),
    );
  }, [character.id, trackedObjectiveId, trackedQuestId]);

  useEffect(() => {
    saveDiscoveredCells(character.id, discoveredWorldMapCells);
  }, [character.id, discoveredWorldMapCells]);

  useEffect(() => {
    saveMapDiscoveryState(character.id, mapDiscoveryState);
  }, [character.id, mapDiscoveryState]);

  useEffect(() => {
    if (worldMapMode !== "play") {
      return;
    }

    const currentCellKey = getExplorationCellKeyFromPosition(
      playerPosition.x,
      playerPosition.y,
    );
    if (lastRevealedCellRef.current === currentCellKey) {
      return;
    }

    lastRevealedCellRef.current = currentCellKey;
    setDiscoveredWorldMapCells((current) =>
      revealCellsAroundPosition(current, playerPosition.x, playerPosition.y),
    );
  }, [playerPosition.x, playerPosition.y, worldMapMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (playerPositionHydratedCharacterRef.current !== character.id) {
      return;
    }

    window.localStorage.setItem(
      getPlayerPositionStorageKey(character.id),
      JSON.stringify(playerPosition),
    );
  }, [character.id, playerPosition]);

  useEffect(() => {
    const profile = loadCharacterProfile(character.id);
    if (!isHumanArgosProfile(profile)) {
      return;
    }

    if (profile?.flags?.[ARGOS_INTRO_SEEN_FLAG] === true && profile.flags?.[ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG] !== true) {
      setTutorialState(startTutorial(character.id, TUTORIAL_ARGOS_INTRO_ID));
    }
  }, [character.id]);

  useEffect(() => {
    const savedModalType = activeWorldModal?.type === "zone" || activeWorldModal?.type === "location"
      ? activeWorldModal.type
      : null;
    const savedWorldState: CharacterSavedWorldState = {
      currentLocationId: activeLocation?.id ?? activeLocationId ?? zoneLinkedLocation?.id ?? null,
      currentZoneId: currentZone?.id ?? null,
      currentMapId: "worldmap-main",
      currentCityId: activeCityId ?? null,
      kingdomId: activeLocation?.kingdomId ?? zoneLinkedLocation?.kingdomId ?? currentZone?.kingdomId ?? null,
      regionId: activeLocation?.regionId ?? zoneLinkedLocation?.regionId ?? currentZone?.region ?? null,
      areaId: null,
      locationView,
      modalType: savedModalType,
      modalZoneId: activeWorldModal?.type === "zone" ? activeWorldModal.zoneId : null,
      modalLocationId: activeWorldModal?.type === "location" ? activeWorldModal.locationId : null,
    };

    updateCharacterProfile(character.id, (profile) => {
      if (!profile) {
        return profile;
      }

      const currentSerialized = JSON.stringify(profile.worldState ?? {});
      const nextSerialized = JSON.stringify(savedWorldState);
      if (currentSerialized === nextSerialized) {
        return profile;
      }

      return {
        ...profile,
        worldState: savedWorldState,
      };
    });
  }, [
    activeCityId,
    activeLocation?.id,
    activeLocation?.kingdomId,
    activeLocation?.regionId,
    activeLocationId,
    activeWorldModal,
    character.id,
    currentZone?.id,
    currentZone?.kingdomId,
    currentZone?.region,
    locationView,
    zoneLinkedLocation?.id,
    zoneLinkedLocation?.kingdomId,
    zoneLinkedLocation?.regionId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(UI_MINI_MAP_VISIBLE_KEY, String(miniMapVisible));
  }, [miniMapVisible]);

  useEffect(() => {
    if (worldMapMode !== "editor") {
      return;
    }

    if (skipNextZonePersistRef.current) {
      skipNextZonePersistRef.current = false;
      return;
    }

    queueEditorSave({ zones, regions, questMarkers });
  }, [questMarkers, queueEditorSave, regions, worldMapMode, zones]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    saveEditorSettings(editorSettings);
    setAutosaveStatus("autosaved");
  }, [editorSettings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(UI_EDITOR_ACTIVE_LAYER_KEY, activeEditorLayer);
  }, [activeEditorLayer]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      UI_EDITOR_LAYER_VISIBILITY_KEY,
      JSON.stringify(layerVisibility),
    );
  }, [layerVisibility]);

  useEffect(() => {
    if (worldMapMode !== "editor") {
      return;
    }

    const selectedZone = selectedZoneId
      ? zones.find((zone) => zone.id === selectedZoneId) ?? null
      : null;
    if (
      selectedZone &&
      (selectedZone.editorLayer ?? getDefaultEditorLayer(selectedZone.type)) !== activeEditorLayer
    ) {
      setSelectedZoneId(null);
      setEditorDraft(null);
      return;
    }

    if (
      editorDraft &&
      (editorDraft.editorLayer ?? getDefaultEditorLayer(editorDraft.type)) !== activeEditorLayer
    ) {
      setEditorDraft(null);
    }
  }, [activeEditorLayer, editorDraft, selectedZoneId, worldMapMode, zones]);

  function captureCheckpoint() {
    setHistory((current) =>
      pushHistory(
        current,
        createSnapshot(zones, regions, editorDraft, selectedZoneId),
      ),
    );
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
      onStatus("Editor: nothing to undo.");
      return;
    }
    setHistory(result.history);
    applySnapshot(result.snapshot);
    onStatus("Editor: undo.");
  }

  function handleRedo() {
    const current = createSnapshot(zones, regions, editorDraft, selectedZoneId);
    const result = redoHistory(history, current);
    if (!result.snapshot) {
      onStatus("Editor: nothing to redo.");
      return;
    }
    setHistory(result.history);
    applySnapshot(result.snapshot);
    onStatus("Editor: redo.");
  }

  const selectedNode: MapNodeData | null = useMemo(() => {
    if (!currentZone) {
      return null;
    }

    const [zoneCenterX, zoneCenterY] = getZoneCenter(currentZone);
    const dangerLabel =
      currentZone.dangerLevel >= 5
        ? "High"
        : currentZone.dangerLevel >= 3
          ? "Medium"
          : "Low";
    const access: MapNodeData["access"] =
      currentZone.requiredLevel && currentZone.requiredLevel > character.level
        ? "Locked"
        : "Neutral";
    const actions: MapNodeData["actions"] = [];

    if (currentZone.type === "city") {
      actions.push({ id: "open-city", label: "\u0412\u043e\u0439\u0442\u0438 \u0432 \u0433\u043e\u0440\u043e\u0434", kind: "enter" });

    }

    if (
      currentZone.type === "grind" ||
      currentZone.type === "danger" ||
      currentZone.type === "dungeon"
    ) {
      actions.push({ id: "enter-battle", label: "\u0418\u0441\u043a\u0430\u0442\u044c \u0431\u043e\u0439", kind: "combat" });
      actions.push({ id: "scout-enemy", label: "Разведка", kind: "scout" });
    }

    if (currentZone.type === "resource") {
      actions.push({ id: "gather", label: "\u0414\u043e\u0431\u044b\u0432\u0430\u0442\u044c \u0440\u0435\u0441\u0443\u0440\u0441", kind: "quest" });
    }

    if (currentZone.type === "profession") {
      actions.push({
        id: "profession-train",
        label: "\u041e\u0431\u0443\u0447\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0444\u0435\u0441\u0441\u0438\u0438",
        kind: "talk",
      });
    }

    if (actions.length === 0) {
      actions.push({ id: "look-around", label: "\u041e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c\u0441\u044f", kind: "scout" });
    }

    return {
      id: currentZone.id,
      name: currentZone.name,
      type: currentZone.type,
      faction:
        currentZone.faction ??
        (currentZone.type === "danger"
          ? "\u0412\u0440\u0430\u0436\u0434\u0435\u0431\u043d\u0430\u044f \u0437\u043e\u043d\u0430"
          : "\u041d\u0435\u0439\u0442\u0440\u0430\u043b\u044c\u043d\u0430\u044f \u0437\u043e\u043d\u0430"),
      danger: dangerLabel,
      access,
      recommendedLevel: Math.max(
        1,
        currentZone.recommendedLevel ?? currentZone.dangerLevel,
      ),
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
      type: "local" as const,
    }));
    return [...localMessages, ...systemChat].slice(-24);
  }, [chatLines, systemChat]);

  const appendQuestRuntimeLogsToSystemChat = useCallback((logs: string[] | undefined | null) => {
    const playerLogLines: string[] = [];
    for (const rawLine of logs ?? []) {
      const line = String(rawLine ?? "").trim();
      if (!line) {
        continue;
      }

      if (line === "Вы осмотрелись, но ничего важного не нашли.") {
        playerLogLines.push(line);
        continue;
      }

      if (line.startsWith("Quest started:")) {
        const questId = line.slice("Quest started:".length).trim();
        const questTitle = questDefinitions.find((entry) => entry.id === questId)?.title ?? null;
        playerLogLines.push(questTitle ? `Новый квест: ${questTitle}` : "Новый квест принят.");
        continue;
      }
      if (line.startsWith("Quest completed:")) {
        const questId = line.slice("Quest completed:".length).trim();
        const questTitle = questDefinitions.find((entry) => entry.id === questId)?.title ?? null;
        playerLogLines.push(questTitle ? `Квест завершён: ${questTitle}` : "Квест завершён.");
        continue;
      }
      if (line.startsWith("Quest advanced:")) {
        playerLogLines.push("Квест обновлён.");
        continue;
      }
      if (line.startsWith("Quest failed:")) {
        playerLogLines.push("Квест провален.");
        continue;
      }
      if (line.startsWith("Gold granted:")) {
        const amount = line.slice("Gold granted:".length).trim();
        playerLogLines.push(`Получено золото: ${amount}`);
        continue;
      }
      if (line.startsWith("Gold removed:")) {
        const amount = line.slice("Gold removed:".length).trim();
        playerLogLines.push(`Потрачено золото: ${amount}`);
        continue;
      }
      if (line.startsWith("Item granted:")) {
        const itemId = line.slice("Item granted:".length).trim();
        const name = resolveItemById ? (resolveItemById(itemId)?.name ?? itemId) : itemId;
        playerLogLines.push(`Получен предмет: ${name}`);
        continue;
      }
      if (line.startsWith("Item removed:")) {
        const itemId = line.slice("Item removed:".length).trim();
        const name = resolveItemById ? (resolveItemById(itemId)?.name ?? itemId) : itemId;
        playerLogLines.push(`Потерян предмет: ${name}`);
        continue;
      }
      if (line.startsWith("Quest item granted:")) {
        playerLogLines.push("Получен квестовый предмет.");
        continue;
      }
      if (line.startsWith("Quest item removed:")) {
        playerLogLines.push("Квестовый предмет потерян.");
        continue;
      }
      if (line.startsWith("Location unlocked:")) {
        playerLogLines.push("Открыта новая локация.");
        continue;
      }
    }

    if (playerLogLines.length === 0) {
      return;
    }

    const now = Date.now();
    const next = playerLogLines.map((text) => ({
      id: `sys-quest-${now}-${nextSystemChatIdRef.current++}`,
      text,
      type: "system" as const,
    }));
    setSystemChat((prev) => [...prev, ...next].slice(-12));
  }, [questDefinitions, resolveItemById]);

  const applyCompletedQuestRewardsToChat = useCallback(
    (completedQuestIds: string[]) => {
      const uniqueCompletedQuestIds = Array.from(new Set(completedQuestIds));

      if (uniqueCompletedQuestIds.length === 0) {
        return;
      }

      const now = Date.now();
      const rewardLines: ChatMessage[] = [];

      for (const completedQuestId of uniqueCompletedQuestIds) {
        const questTitle =
          questDefinitions.find((entry) => entry.id === completedQuestId)
            ?.title ?? completedQuestId;

        const result = applyQuestRewards(character.id, completedQuestId);

        if (!result.applied) {
          continue;
        }

        rewardLines.push({
          id: `sys-quest-complete-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
          text: `Квест завершён: ${questTitle}`,
          type: "system",
        });

        if (result.rewards.length > 0) {
          for (const reward of result.rewards) {
            if (reward.startsWith("gold:+")) {
              const amount = reward.slice("gold:+".length);
              rewardLines.push({
                id: `sys-quest-gold-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
                text: `Получено золото: ${amount}`,
                type: "system",
              });
              continue;
            }

            if (reward.startsWith("experience:+")) {
              const amount = reward.slice("experience:+".length);
              rewardLines.push({
                id: `sys-quest-xp-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
                text: `Получен опыт: ${amount}`,
                type: "system",
              });
              continue;
            }

            if (reward.startsWith("item:")) {
              const itemId = reward.slice("item:".length);
              const name = resolveItemById
                ? resolveItemById(itemId)?.name ?? itemId
                : itemId;

              rewardLines.push({
                id: `sys-quest-item-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
                text: `Получен предмет: ${name}`,
                type: "system",
              });
              continue;
            }

            if (reward.startsWith("quest_item:")) {
              const itemId = reward.slice("quest_item:".length);

              rewardLines.push({
                id: `sys-quest-qitem-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
                text: `Получен квестовый предмет: ${itemId}`,
                type: "system",
              });
              continue;
            }

            if (reward.startsWith("skill:")) {
              const skillId = reward.slice("skill:".length);

              rewardLines.push({
                id: `sys-quest-skill-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
                text: `Получен навык: ${skillId}`,
                type: "system",
              });
              continue;
            }

            rewardLines.push({
              id: `sys-quest-reward-${now}-${completedQuestId}-${nextSystemChatIdRef.current++}`,
              text: `Награда: ${reward}`,
              type: "system",
            });
          }
        }
      }

      setSystemChat((prev) => [...prev, ...rewardLines].slice(-12));
    },
    [character.id, questDefinitions, resolveItemById],
  );

  const quickButtons = useMemo(
    () => [
      {
        id: "combat",
        tone: "red" as const,
        icon: "\u2694",
        title: "Combat status",
        onClick: () => setContextMode("combat"),
      },
      {
        id: "messages",
        tone: "blue" as const,
        icon: "\u2709",
        title: "Messages / quests / notifications",
        badge: 3,
        onClick: () => setContextMode("npc"),
      },
      {
        id: "inventory",
        tone: "yellow" as const,
        icon: "I",
        title: "\u0418\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u044c \u0438 \u044d\u043a\u0438\u043f\u0438\u0440\u043e\u0432\u043a\u0430",
        onClick: onOpenInventory,
      },
    ],
    [onOpenInventory],
  );

  // Memoize callbacks to prevent infinite loops in animation frames
  const handlePlayerPosition = useCallback((x: number, y: number) => {
    setPlayerPosition({ x, y });
    setPlaySpawnPosition((current) => {
      if (Math.abs(current.x - x) < 0.0005 && Math.abs(current.y - y) < 0.0005) {
        return current;
      }

      return { x, y };
    });
  }, []);

  const handlePlayerState = useCallback((state: PlayerWorldState) => {
    setPlayerState(state);
  }, []);

  const handleHoverZone = useCallback((zone: WorldMapZone | null) => {
    setHoverZone(zone);
  }, []);

  const discoverMapEntity = useCallback((entityType: MapDiscoveryEntityType, entityId: string | null | undefined) => {
    const normalizedId = String(entityId ?? "").trim();
    if (!normalizedId) {
      return;
    }

    setMapDiscoveryState((current) => addDiscoveredMapEntity(current, entityType, normalizedId));
  }, []);

  const rememberCurrentMapPosition = useCallback(() => {
    setPlaySpawnPosition((current) => {
      if (current.x === playerPosition.x && current.y === playerPosition.y) {
        return current;
      }

      return playerPosition;
    });
  }, [playerPosition]);

  useEffect(() => {
    if (activeCityId) {
      discoverMapEntity("city", activeCityId);
    }
  }, [activeCityId, discoverMapEntity]);

  useEffect(() => {
    if (activeLocationId) {
      discoverMapEntity("location", activeLocationId);
    }
  }, [activeLocationId, discoverMapEntity]);

  useEffect(() => {
    if (!currentZone) {
      return;
    }

    discoverMapEntity("zone", currentZone.id);
    if (currentZone.type === "city") {
      discoverMapEntity("city", currentZone.cityId ?? currentZone.id);
    }
    if (currentZone.type === "location") {
      discoverMapEntity("location", currentZone.linkedLocationId ?? currentZone.linkedLocation ?? currentZone.id);
    }
  }, [currentZone, discoverMapEntity]);

  const handleOpenLocationMemoized = useCallback(
    (locationId: string) => {
      if (worldMapMode === "editor") {
        return;
      }
      const zone = zones.find((entry) => entry.id === locationId) ?? null;
      if (zone?.type === "location") {
        const linkedLocation = contentSnapshot
          ? getZoneLinkedLocation(zone, contentSnapshot)
          : null;
        if (!linkedLocation || !isLinkedLocationVisibleToPlayer(linkedLocation)) {
          onStatus("Вы ничего не находите.");
          return;
        }
        if (!canEnterLinkedLocation(linkedLocation)) {
          onStatus("Вы пока не можете войти сюда.");
          return;
        }
        discoverMapEntity("location", linkedLocation.id);
        if (locationHasLocalMap(linkedLocation)) {
          rememberCurrentMapPosition();
          setActiveLocationId(linkedLocation.id);
          setActiveCityId(null);
          setActiveWorldModal(null);
          setLocationView("location");
          setContextMode("location");
          setPlayerState("in_zone");
          onStatus(`Вы вошли в ${linkedLocation.name}.`);
        } else {
          setActiveWorldModal({
            type: "location",
            locationId: linkedLocation.id,
          });
          setContextMode("location");
          setPlayerState("in_zone");
          onStatus(`Вы прибыли к ${linkedLocation.name}.`);
        }
        return;
      }
      const targetScene = zone?.targetScene?.trim().toLowerCase();
      const opensCityScene =
        isCitySceneId(locationId) || isCitySceneId(targetScene);
      if (!opensCityScene) {
        onStatus(`\u041b\u043e\u043a\u0430\u0446\u0438\u044f ${locationId} \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.`);
        return;
      }
      const cityId = normalizeCitySceneId(
        targetScene && isCitySceneId(targetScene) ? targetScene : locationId,
      );
      const zoneReaction = zone ? resolveZoneReaction(zone) : null;
      if (zoneReaction && !zoneReaction.allowed) {
        onStatus(fixMojibake(zoneReaction.summary, "Вас не впускают в город."));
        if (zoneReaction.hostile) {
          setContextMode("combat");
          void onStartCombat();
        }
        return;
      }
      rememberCurrentMapPosition();
      setActiveCityId(cityId);
      setActiveLocationId(null);
      setActiveWorldModal(null);
      setLocationView("city");
      setContextMode("location");
      setPlayerState("in_city");
      onStatus(`\u0412\u044b \u0432\u043e\u0448\u043b\u0438 \u0432 ${zone?.name ?? "\u0433\u043e\u0440\u043e\u0434"}.`);
    },
    [contentSnapshot, discoverMapEntity, onStartCombat, onStatus, rememberCurrentMapPosition, worldMapMode, zones],
  );

  const handleZoneEnterMemoized = useCallback(
    (zone: Zone | null) => {
      setCurrentZone(zone as WorldMapZone | null);
      if (worldMapMode === "editor") {
        return;
      }
      if (!zone) {
        setContextMode("empty");
        return;
      }
      setContextMode("location");
      setPlayerState(zone.type === "city" ? "in_city" : "in_zone");
      const entry: ChatMessage = {
        id: `sys-zone-${Date.now()}-${zone.id}`,
        text: `\u0412\u044b \u0432\u043e\u0448\u043b\u0438 \u0432: ${zone.name}`,
        type: "system",
      };
      setSystemChat((prev) => [...prev, entry].slice(-12));
      const zoneReaction = resolveZoneReaction(zone as WorldMapZone);
      if (zoneReaction.summary) {
        const reactionText = zoneReaction.summary;
        const reactionEntry: ChatMessage = {
          id: `sys-zone-reaction-${Date.now()}-${zone.id}`,
          text: reactionText,
          type: "system",
        };
        setSystemChat((prev) => [...prev, reactionEntry].slice(-12));
      }
      if (!zoneReaction.allowed) {
        onStatus(zoneReaction.summary ?? "\u0412\u0440\u0430\u0436\u0434\u0435\u0431\u043d\u0430\u044f \u0442\u0435\u0440\u0440\u0438\u0442\u043e\u0440\u0438\u044f.");
        if (zoneReaction.hostile) {
          setContextMode("combat");
          void onStartCombat();
        }
      }

      const questRuntimePlayer = {
        id: character.id,
        level: character.level,
        race: character.race,
        ...questRuntimeProfessionCompat,
        itemIds: inventory.items
          .filter((item) => item.quantity > 0)
          .map((item) => item.itemId),
      };

      const zoneEnterResult = handleQuestEvent(
        questRuntimePlayer,
        { type: "zone_enter", zoneId: zone.id },
      );
      onRuntimeInventoryChanged?.();

      appendQuestRuntimeLogsToSystemChat([
        ...zoneEnterResult.logs,
      ]);

      applyCompletedQuestRewardsToChat([
        ...zoneEnterResult.completedQuestIds,
      ]);

      if (
        zoneEnterResult.startedQuestIds.length > 0 ||
        zoneEnterResult.advancedQuestIds.length > 0 ||
        zoneEnterResult.completedQuestIds.length > 0 ||
        zoneEnterResult.completedObjectiveIds.length > 0 ||
        zoneEnterResult.failedQuestIds.length > 0
      ) {
        setPlayerQuestStates(
          getAllPlayerQuestStates().filter((state) => state.playerId === character.id),
        );
      }

      const zoneEnterInteraction =
        findMatchingQuestInteractions(
          { type: "zone_enter", zoneId: zone.id },
          questRuntimePlayer,
          questInteractions,
        )[0] ?? null;
      if (zoneEnterInteraction) {
        setActiveInteraction(zoneEnterInteraction);
        setActiveInteractionChoices(getAvailableQuestInteractionChoices(zoneEnterInteraction, questRuntimePlayer));
      }

      const worldZone = zone as WorldMapZone;
      const interactionMode = worldZone.interactionMode ?? getDefaultInteractionMode(worldZone.type);
      const shouldAutoInteractOnEntry = (
        worldZone.type !== "resource_area"
        && isZoneInteractionModeInteractive(interactionMode)
        && (isMineResourceZone(worldZone) || interactionMode !== "enter")
      );

      if (shouldAutoInteractOnEntry) {
        const [zoneCenterX, zoneCenterY] = getZoneCenter(worldZone);
        handleRuntimeZoneInteractRef.current?.(worldZone, { x: zoneCenterX, y: zoneCenterY });
      }

      const targetScene = worldZone.targetScene?.trim();
      if (targetScene && worldZone.type !== "city") {
        const now = Date.now();
        const guard = lastZoneTransitionRef.current;
        if (guard && guard.zoneId === worldZone.id && now - guard.at < 2500) {
          return;
        }

        if (
          worldZone.requiredLevel &&
          character.level < worldZone.requiredLevel
        ) {
          onStatus(
            `\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0443\u0440\u043e\u0432\u0435\u043d\u044c ${worldZone.requiredLevel}.`,
          );
          lastZoneTransitionRef.current = { zoneId: worldZone.id, at: now };
          return;
        }

        if (worldZone.requiredQuestId) {
          const requiredQuestId = worldZone.requiredQuestId.trim();
          const state =
            playerQuestStates.find(
              (entry) => entry.questId === requiredQuestId,
            ) ?? null;
          if (
            !state ||
            (state.status !== "active" && state.status !== "completed")
          ) {
            onStatus(`\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043a\u0432\u0435\u0441\u0442 ${requiredQuestId}.`);
            lastZoneTransitionRef.current = { zoneId: worldZone.id, at: now };
            return;
          }
        }

        if (worldZone.requiredItemId) {
          const requiredItemId = worldZone.requiredItemId.trim();
          const hasItem = inventory.items.some(
            (item) => item.itemId === requiredItemId && item.quantity > 0,
          );
          if (!hasItem) {
            onStatus(`\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442: \u043d\u0443\u0436\u0435\u043d \u043f\u0440\u0435\u0434\u043c\u0435\u0442 ${requiredItemId}.`);
            lastZoneTransitionRef.current = { zoneId: worldZone.id, at: now };
            return;
          }
        }

        if (worldZone.requiredFaction) {
          const requiredFaction = worldZone.requiredFaction.trim();
          onStatus(`\u0414\u043e\u0441\u0442\u0443\u043f \u0437\u0430\u043a\u0440\u044b\u0442: \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0444\u0440\u0430\u043a\u0446\u0438\u044f ${requiredFaction}.`);
          lastZoneTransitionRef.current = { zoneId: worldZone.id, at: now };
          return;
        }

        lastZoneTransitionRef.current = { zoneId: worldZone.id, at: now };

        const sceneId = targetScene.toLowerCase();
        if (isCitySceneId(sceneId)) {
          handleOpenLocationMemoized(worldZone.id);
          return;
        }

        if (sceneId.startsWith("battlemap_")) {
          if (onStartBattleMap) {
            void onStartBattleMap(targetScene);
            return;
          }
          void onStartCombat();
          return;
        }

        onStatus(`\u041f\u0435\u0440\u0435\u0445\u043e\u0434 \u0432 \u0441\u0446\u0435\u043d\u0443 '${targetScene}' \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f.`);
      }

      const questPool = (zone.randomQuestPoolIds ?? []).filter(Boolean);
      if (questPool.length > 0) {
        const triggered = tryStartRandomQuestFromZone(
          {
            id: character.id,
            level: character.level,
            race: character.race,
            ...questRuntimeProfessionCompat,
          },
          zone.id,
          questPool,
          zone.chancePercent ?? 10,
          zone.cooldownSeconds ?? 120,
        );

        if (triggered) {
          setRandomEventModal({
            zoneId: zone.id,
            zoneName: zone.name,
            questId: triggered.id,
            questTitle: triggered.title,
            questText: triggered.playerDescription || triggered.adminDescription || "",
          });
          const questEntry: ChatMessage = {
            id: `sys-quest-${Date.now()}-${triggered.id}`,
            text: `\u041d\u043e\u0432\u044b\u0439 \u043a\u0432\u0435\u0441\u0442: ${triggered.title}`,
            type: "system",
          };
          setSystemChat((prev) => [...prev, questEntry].slice(-12));
          setPlayerQuestStates(
            getAllPlayerQuestStates().filter(
              (state) => state.playerId === character.id,
            ),
          );
        }
      }
    },
    [
      character.id,
      character.level,
      character.race,
      handleOpenLocationMemoized,
      inventory.items,
      onStartBattleMap,
      onStartCombat,
      onStatus,
      playerQuestStates,
      questInteractions,
      questRuntimeProfessionCompat,
      appendQuestRuntimeLogsToSystemChat,
      applyCompletedQuestRewardsToChat,
      worldMapMode,
    ],
  );

  const handleRuntimeZoneInteract = useCallback(
    (zone: WorldMapZone, point: { x: number; y: number }) => {
      if (worldMapMode !== "play") {
        return;
      }

      setLastRuntimeClickPoint(point);

      const isMineZone = isMineResourceZone(zone);
      const interactionMode = zone.interactionMode ?? getDefaultInteractionMode(zone.type);
      const resolvedInteractionMode = isMineZone && interactionMode === "none" ? "resource" : interactionMode;
      const clickable =
        isMineZone
          ? true
          : typeof zone.playerClickable === "boolean"
            ? zone.playerClickable
            : getDefaultPlayerClickable(zone.type);

      if (!clickable || resolvedInteractionMode === "none") {
        return;
      }

      if (resolvedInteractionMode === "random_event" || resolvedInteractionMode === "danger") {
        return;
      }

      if (isMineZone) {
        setExpandedMineZoneId(null);
        setActiveWorldModal({ type: "zone", zoneId: zone.id });
        setContextMode("location");
        return;
      }

      if (zone.type === "resource_area") {
        return;
      }

      if (resolvedInteractionMode === "enter") {
        onStatus(`Вход в локацию: ${zone.name}`);
        return;
      }

      // For all other interactive modes open a zone info popup.
      setActiveWorldModal({ type: "zone", zoneId: zone.id });
      setContextMode("location");
    },
    [onStatus, setActiveWorldModal, setContextMode, worldMapMode],
  );

  useEffect(() => {
    handleRuntimeZoneInteractRef.current = handleRuntimeZoneInteract;
  }, [handleRuntimeZoneInteract]);

  const handleInspectCurrentZone = useCallback(() => {
    if (worldMapMode === "editor") {
      return;
    }
    const inspectPoint =
      Number.isFinite(playerPosition.x) && Number.isFinite(playerPosition.y)
        ? { x: playerPosition.x, y: playerPosition.y }
        : lastRuntimeClickPoint;

    let hasPassiveResourceAreas = false;
    if (inspectPoint) {
      const passiveResourceAreas = getPassiveZonesAtPoint(
        zones as Zone[],
        inspectPoint.x,
        inspectPoint.y,
      )
        .filter((zone) => zone.type === "resource_area")
        .map((zone) => zone as WorldMapZone);

      if (passiveResourceAreas.length > 0) {
        hasPassiveResourceAreas = true;
        const details = passiveResourceAreas
          .map((zone) => {
            const profession = zone.professionId?.trim() || "-";
            const table = zone.resourceTableId?.trim() || "-";
            return `${zone.name} (Профессия: ${profession}, Resource Table: ${table})`;
          })
          .join("; ");
        onStatus(`Найдены ресурсы: ${details}`);
      } else {
        onStatus("Поблизости не найдено мест добычи.");
      }
    }

    if (!currentZone) {
      if (!inspectPoint) {
        onStatus("Сначала войдите в зону.");
      }
      return;
    }

    if (!hasPassiveResourceAreas && !inspectPoint) {
      onStatus("Поблизости не найдено мест добычи.");
    }

    const player: QuestRuntimePlayer = {
      id: character.id,
      level: character.level,
      race: character.race,
      classId: undefined,
      ...questRuntimeProfessionCompat,
      itemIds: inventory.items.filter((item) => item.quantity > 0).map((item) => item.itemId),
    };

    const matchedInteraction =
      findMatchingQuestInteractions(
        { type: "zone_inspect", zoneId: currentZone.id },
        player,
        questInteractions,
      )[0] ?? null;

    if (matchedInteraction) {
      setActiveInteraction(matchedInteraction);
      setActiveInteractionChoices(getAvailableQuestInteractionChoices(matchedInteraction, player));
      return;
    }

    // Fallback: run classic zone_inspect quest event.
    const questEventResult = handleQuestEvent(
      player,
      { type: "zone_inspect", zoneId: currentZone.id },
    );
    onRuntimeInventoryChanged?.();

    appendQuestRuntimeLogsToSystemChat(questEventResult.logs);
    applyCompletedQuestRewardsToChat(questEventResult.completedQuestIds);
    if (
      questEventResult.logs.length === 0
      && questEventResult.completedQuestIds.length === 0
      && questEventResult.completedObjectiveIds.length === 0
    ) {
      const now = Date.now();
      setSystemChat((prev) => [
        ...prev,
        {
          id: `sys-inspect-empty-${now}-${nextSystemChatIdRef.current++}`,
          text: "Вы осмотрелись, но ничего важного не нашли.",
          type: "system" as const,
        },
      ].slice(-12));
    }
    setPlayerQuestStates(
      getAllPlayerQuestStates().filter((state) => state.playerId === character.id),
    );
  }, [
    appendQuestRuntimeLogsToSystemChat,
    applyCompletedQuestRewardsToChat,
    character.id,
    character.level,
    character.race,
    currentZone,
    inventory.items,
    lastRuntimeClickPoint,
    onStatus,
    playerPosition.x,
    playerPosition.y,
    questInteractions,
    questRuntimeProfessionCompat,
    zones,
    worldMapMode,
  ]);

  const handlePrimaryWorldInteraction = useCallback(() => {
    if (worldMapMode !== "play" || locationView !== "map") {
      return;
    }

    const activeZone = currentZone;
    if (activeZone) {
      const [x, y] = getZoneCenter(activeZone);
      handleRuntimeZoneInteract(activeZone, { x, y });
      return;
    }

    handleInspectCurrentZone();
  }, [currentZone, handleInspectCurrentZone, handleRuntimeZoneInteract, locationView, worldMapMode]);

  useEffect(() => {
    handlePrimaryWorldInteractionRef.current = handlePrimaryWorldInteraction;
  }, [handlePrimaryWorldInteraction]);

  const handleInteractionChoice = useCallback((choice: QuestInteractionChoice) => {
    if (!activeInteraction) {
      return;
    }

    if (choice.id === "__leave__") {
      setActiveInteraction(null);
      setActiveInteractionChoices([]);
      return;
    }

    const result = runQuestInteractionEffects(character.id, activeInteraction, choice);
    onRuntimeInventoryChanged?.();
    if (result.logs.length > 0) {
      appendQuestRuntimeLogsToSystemChat(result.logs);
    }
    if (result.completedQuestIds.length > 0) {
      applyCompletedQuestRewardsToChat(result.completedQuestIds);
    }

    if (result.grantedRewardLines.length > 0) {
      const now = Date.now();
      const lines = result.grantedRewardLines.map((rewardLine) => {
        if (rewardLine.startsWith("gold:+")) {
          return {
            id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
            text: `Получено золото: ${rewardLine.slice("gold:+".length)}`,
            type: "system" as const,
          };
        }
        if (rewardLine.startsWith("experience:+")) {
          return {
            id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
            text: `Получен опыт: ${rewardLine.slice("experience:+".length)}`,
            type: "system" as const,
          };
        }
        if (rewardLine.startsWith("item:")) {
          const itemId = rewardLine.slice("item:".length);
          const name = resolveItemById
            ? resolveItemById(itemId)?.name ?? itemId
            : itemId;
          return {
            id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
            text: `Получен предмет: ${name}`,
            type: "system" as const,
          };
        }
        if (rewardLine.startsWith("quest_item:")) {
          return {
            id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
            text: `Получен квестовый предмет: ${rewardLine.slice("quest_item:".length)}`,
            type: "system" as const,
          };
        }
        if (rewardLine.startsWith("skill:")) {
          return {
            id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
            text: `Получен навык: ${rewardLine.slice("skill:".length)}`,
            type: "system" as const,
          };
        }
        if (rewardLine.startsWith("unlock_location:")) {
          return {
            id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
            text: `Открыта локация: ${rewardLine.slice("unlock_location:".length)}`,
            type: "system" as const,
          };
        }
        return {
          id: `sys-interaction-reward-${now}-${nextSystemChatIdRef.current++}`,
          text: `Награда: ${rewardLine}`,
          type: "system" as const,
        };
      });
      setSystemChat((prev) => [...prev, ...lines].slice(-12));
    }

    setPlayerQuestStates(
      getAllPlayerQuestStates().filter((state) => state.playerId === character.id),
    );

    if (!choice.resultText?.trim() && choice.close !== false) {
      setActiveInteraction(null);
      setActiveInteractionChoices([]);
    }
  }, [
    activeInteraction,
    appendQuestRuntimeLogsToSystemChat,
    applyCompletedQuestRewardsToChat,
    character.id,
    onRuntimeInventoryChanged,
    resolveItemById,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      UI_LEFT_PANEL_COLLAPSED_KEY,
      String(leftPanelCollapsed),
    );
  }, [leftPanelCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      UI_RIGHT_PANEL_COLLAPSED_KEY,
      String(rightPanelCollapsed),
    );
  }, [rightPanelCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
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
      (message) =>
        message.type === "system" &&
        message.text.trim().length > 0 &&
        !seenPopupMessageIdsRef.current.has(message.id),
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

      const fadeTimer = window.setTimeout(
        () => {
          setEventOverlayMessages((current) =>
            current.map((entry) =>
              entry.id === message.id ? { ...entry, isFading: true } : entry,
            ),
          );
        },
        Math.max(0, POPUP_HIDE_DELAY_MS - POPUP_FADE_DURATION_MS),
      );

      const removeTimer = window.setTimeout(() => {
        setEventOverlayMessages((current) =>
          current.filter((entry) => entry.id !== message.id),
        );
        popupTimeoutsRef.current.delete(message.id);
      }, POPUP_HIDE_DELAY_MS);

      popupTimeoutsRef.current.set(message.id, { fadeTimer, removeTimer });
    }
  }, [chatMessages]);

  useEffect(
    () => () => {
      popupTimeoutsRef.current.forEach(({ fadeTimer, removeTimer }) => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(removeTimer);
      });
      popupTimeoutsRef.current.clear();
    },
    [],
  );

  const handleSelectQuestMarker = useCallback(
    (id: string | null) => {
      setSelectedQuestMarkerId(id);
      if (!id) {
        setQuestMarkerDraft(null);
        return;
      }

      const existing = questMarkers.find((entry) => entry.id === id) ?? null;
      setQuestMarkerDraft(existing ? { ...existing } : null);
      if (existing && worldMapMode === "editor") {
        canvasRef.current?.focusPoint([existing.x, existing.y]);
      }
    },
    [questMarkers, worldMapMode],
  );

  const handleSaveQuestMarker = useCallback(async () => {
    const draft = questMarkerDraft ?? {
      id: `marker_${Date.now()}`,
      title: "\u041d\u043e\u0432\u044b\u0439 \u043c\u0430\u0440\u043a\u0435\u0440",
      mapId: "worldmap-main",
      x: lastMouseCoords?.x ?? mouseCoords.x ?? 0.5,
      y: lastMouseCoords?.y ?? mouseCoords.y ?? 0.5,
      type: "quest_start" as const,
      visibleToPlayer: true,
      conditionIds: [],
      isActive: true,
      requirements: undefined,
      hideAfterQuestCompleted: false,
      hideAfterObjectiveCompleted: false,
      hideAfterStepCompleted: false,
    };

    if (!draft.id.trim() || !draft.title.trim()) {
      onStatus("Quest marker: id \u0438 title \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b.");
      return;
    }

    const existing =
      questMarkers.find((entry) => entry.id === draft.id.trim()) ?? null;
    const useCursorForNewMarker =
      !existing && lastMouseCoords && draft.x === 0.5 && draft.y === 0.5;

    const normalized: QuestMarkerDefinition = {
      ...draft,
      id: draft.id.trim(),
      title: draft.title.trim(),
      mapId: String(draft.mapId ?? "worldmap-main").trim() || "worldmap-main",
      x: useCursorForNewMarker
        ? lastMouseCoords.x
        : typeof draft.x === "number" && Number.isFinite(draft.x)
          ? Math.max(0, Math.min(1, draft.x))
          : 0.5,
      y: useCursorForNewMarker
        ? lastMouseCoords.y
        : typeof draft.y === "number" && Number.isFinite(draft.y)
          ? Math.max(0, Math.min(1, draft.y))
          : 0.5,
      visibleToPlayer: draft.visibleToPlayer !== false,
      conditionIds: Array.isArray(draft.conditionIds) ? draft.conditionIds : [],
      isActive: draft.isActive !== false,
      requirements: Array.isArray(draft.requirements) ? draft.requirements : undefined,
      hideAfterQuestCompleted: draft.hideAfterQuestCompleted === true,
      hideAfterObjectiveCompleted: draft.hideAfterObjectiveCompleted === true,
      hideAfterStepCompleted: draft.hideAfterStepCompleted === true,
    };

    setQuestMarkers((current) => upsertQuestMarkerList(current, normalized));
    setSelectedQuestMarkerId(normalized.id);
    setQuestMarkerDraft({ ...normalized });
    onStatus(`Quest marker \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d: ${normalized.title}.`);
  }, [
    lastMouseCoords,
    mouseCoords.x,
    mouseCoords.y,
    onStatus,
    questMarkerDraft,
    questMarkers,
  ]);

  const handleDeleteQuestMarker = useCallback(async () => {
    if (!selectedQuestMarkerId) {
      return;
    }
    setQuestMarkers((current) =>
      current.filter((entry) => entry.id !== selectedQuestMarkerId),
    );
    setSelectedQuestMarkerId(null);
    setQuestMarkerDraft(null);
    onStatus("Quest marker \u0443\u0434\u0430\u043b\u0435\u043d.");
  }, [onStatus, selectedQuestMarkerId]);

  const handleMouseCoordinatesChange = useCallback(
    (coords: { x: number | null; y: number | null }) => {
      setMouseCoords(coords);
      if (
        typeof coords.x === "number" &&
        Number.isFinite(coords.x) &&
        typeof coords.y === "number" &&
        Number.isFinite(coords.y)
      ) {
        setLastMouseCoords({ x: coords.x, y: coords.y });
      }
    },
    [],
  );

  const handlePlaceQuestMarkerAtCursor = useCallback(() => {
    const cursorAvailable =
      typeof mouseCoords.x === "number" &&
      Number.isFinite(mouseCoords.x) &&
      typeof mouseCoords.y === "number" &&
      Number.isFinite(mouseCoords.y);

    if (cursorAvailable) {
      const cursor = { x: mouseCoords.x as number, y: mouseCoords.y as number };
      setQuestMarkerDraft((current) =>
        current ? { ...current, x: cursor.x, y: cursor.y } : current,
      );
      onStatus(
        `Quest marker: coords set to x:${cursor.x.toFixed(4)} y:${cursor.y.toFixed(4)}.`,
      );
      return;
    }

    setQuestMarkerDraft(
      (current) =>
        current ?? {
          id: `marker_${Date.now()}`,
          title: "\u041d\u043e\u0432\u044b\u0439 \u043c\u0430\u0440\u043a\u0435\u0440",
          mapId: "worldmap-main",
          x: 0.5,
          y: 0.5,
          type: "quest_start" as const,
          visibleToPlayer: true,
          conditionIds: [] as string[],
          isActive: true,
          requirements: undefined,
          hideAfterQuestCompleted: false,
          hideAfterObjectiveCompleted: false,
          hideAfterStepCompleted: false,
        },
    );

    setMarkerPickMode(true);
    onStatus("Quest marker: click the map to place marker coordinates.");
  }, [mouseCoords.x, mouseCoords.y, onStatus]);

  const handlePickMarkerPoint = useCallback(
    (point: [number, number]) => {
      setMarkerPickMode(false);
      setQuestMarkerDraft((current) => {
        if (!current) {
          return current;
        }
        return { ...current, x: point[0], y: point[1] };
      });
      onStatus(
        `Quest marker: coords set to x:${point[0].toFixed(4)} y:${point[1].toFixed(4)}.`,
      );
    },
    [onStatus],
  );

  useEffect(() => {
    if (worldMapMode !== "play") {
      return;
    }
    const hostile = nearbyNpcReactions.find(
      (entry) => entry.reaction.autoHostile && entry.npc.canFight,
    );
    if (!hostile) {
      return;
    }
    const now = Date.now();
    if (
      lastAggroNpcRef.current &&
      lastAggroNpcRef.current.id === hostile.npc.id &&
      now - lastAggroNpcRef.current.at < 12000
    ) {
      return;
    }
    lastAggroNpcRef.current = { id: hostile.npc.id, at: now };
    setSelectedNpcForInteractionId(hostile.npc.id);
    setContextMode("combat");
    onStatus(`${hostile.npc.name} \u0430\u0442\u0430\u043a\u0443\u0435\u0442 \u0432\u0430\u0441 \u043f\u0440\u0438 \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0438.`);
    void onStartCombat();
  }, [nearbyNpcReactions, onStartCombat, onStatus, worldMapMode]);

  const handlePlaceNpcAtCursor = useCallback(async () => {
    if (!selectedNpcIdForPlacement) {
      onStatus("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 NPC \u0434\u043b\u044f \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u0438\u044f.");
      return;
    }
    if (mouseCoords.x === null || mouseCoords.y === null) {
      onStatus("\u041d\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u0443\u0440\u0441\u043e\u0440 \u043d\u0430 \u043a\u0430\u0440\u0442\u0443, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u044b.");
      return;
    }

    const npc = npcs.find((entry) => entry.id === selectedNpcIdForPlacement);
    if (!npc) {
      onStatus("NPC не найден.");
      return;
    }

    const binding = {
      id: `npc_map_${Date.now()}`,
      mapId: "worldmap-main",
      x: mouseCoords.x,
      y: mouseCoords.y,
      spawnType: "fixed" as const,
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
    onStatus(
      `NPC \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d: ${saved.name} (${binding.x.toFixed(3)}, ${binding.y.toFixed(3)}).`,
    );
  }, [mouseCoords.x, mouseCoords.y, npcs, onStatus, selectedNpcIdForPlacement]);

  const openLocationPlaceDetails = useCallback((place: LocationArea) => {
    appendLocationPlaceSystemMessage(
      place.description?.trim()
        ? `${place.name}: ${place.description}`
        : place.name,
    );
  }, [appendLocationPlaceSystemMessage]);

  const openDialogueFromLocationPlace = useCallback((params: {
    place: LocationArea;
    dialogueId: string;
    npcId?: string | null;
  }) => {
    const currentLocationId = activeLocation?.id ?? activeLocationId ?? undefined;
    const dialogue = getDialogueById(params.dialogueId);
    const resolvedNpcId = params.npcId?.trim() || dialogue?.npcId?.trim() || null;

    if (!dialogue) {
      console.warn("[LocationPlaceClick] Dialogue not found", {
        dialogueId: params.dialogueId,
        placeId: params.place.id,
        locationId: currentLocationId,
      });
      appendLocationPlaceSystemMessage(`[SYSTEM] Диалог не найден: ${params.dialogueId}`);
      openLocationPlaceDetails(params.place);
      return;
    }

    if (resolvedNpcId && !npcById.get(resolvedNpcId)) {
      console.warn("[LocationPlaceClick] NPC not found", {
        npcId: resolvedNpcId,
        dialogueId: params.dialogueId,
        placeId: params.place.id,
        locationId: currentLocationId,
      });
      appendLocationPlaceSystemMessage(`[SYSTEM] NPC не найден: ${resolvedNpcId}`);
      openLocationPlaceDetails(params.place);
      return;
    }

    console.info("[LocationPlaceClick]", {
      placeId: params.place.id,
      placeName: params.place.name,
      locationId: currentLocationId,
      dialogueId: params.dialogueId,
      npcId: resolvedNpcId,
    });

    if (resolvedNpcId) {
      setSelectedNpcForInteractionId(resolvedNpcId);
      setContextMode("npc");
    } else {
      setContextMode("location");
    }

    setActiveWorldModal(null);
    setNpcQuestSceneModal(null);
    dialogueRunner.openDialogue(dialogue.id, {
      npcId: resolvedNpcId ?? undefined,
      locationId: currentLocationId,
      placeId: params.place.id,
      sourceType: "location_place",
    });
  }, [
    activeLocation?.id,
    activeLocationId,
    appendLocationPlaceSystemMessage,
    dialogueRunner,
    npcById,
    openLocationPlaceDetails,
  ]);

  const openNpcFromLocationPlace = useCallback((params: {
    place: LocationArea;
    npcId: string;
  }) => {
    const currentLocationId = activeLocation?.id ?? activeLocationId ?? undefined;
    const npc = npcById.get(params.npcId) ?? null;

    if (!npc) {
      console.warn("[LocationPlaceClick] NPC not found", {
        npcId: params.npcId,
        placeId: params.place.id,
        locationId: currentLocationId,
      });
      appendLocationPlaceSystemMessage(`[SYSTEM] NPC не найден: ${params.npcId}`);
      openLocationPlaceDetails(params.place);
      return;
    }

    console.info("[LocationPlaceClick]", {
      placeId: params.place.id,
      placeName: params.place.name,
      locationId: currentLocationId,
      npcId: params.npcId,
    });

    setSelectedNpcForInteractionId(npc.id);

    const npcDialogueId = getFirstAvailableNpcDialogueId(npc);
    if (npcDialogueId) {
      openDialogueFromLocationPlace({
        place: params.place,
        dialogueId: npcDialogueId,
        npcId: npc.id,
      });
      return;
    }

    dialogueRunner.closeDialogue();
    setNpcQuestSceneModal(null);
    setActiveWorldModal({
      type: "npc",
      locationId: currentLocationId,
      npcId: npc.id,
    });
    setContextMode("npc");
    onStatus(`Вы видите: ${npc.name ?? npc.id}`);
  }, [
    activeLocation?.id,
    activeLocationId,
    appendLocationPlaceSystemMessage,
    dialogueRunner,
    npcById,
    onStatus,
    openDialogueFromLocationPlace,
    openLocationPlaceDetails,
  ]);

  const openMerchantFromLocationPlace = useCallback((params: {
    place: LocationArea;
    merchantId: string;
  }) => {
    const currentLocationId = activeLocation?.id ?? activeLocationId ?? undefined;
    const merchant = merchantById.get(params.merchantId) ?? null;

    if (!merchant) {
      console.warn("[LocationPlaceClick] Merchant not found", {
        merchantId: params.merchantId,
        placeId: params.place.id,
        locationId: currentLocationId,
      });
      appendLocationPlaceSystemMessage(`[SYSTEM] Торговец не найден: ${params.merchantId}`);
      openLocationPlaceDetails(params.place);
      return;
    }

    console.info("[LocationPlaceClick]", {
      placeId: params.place.id,
      placeName: params.place.name,
      locationId: currentLocationId,
      merchantId: params.merchantId,
    });

    dialogueRunner.closeDialogue();
    setNpcQuestSceneModal(null);
    setActiveWorldModal({
      type: "merchant",
      locationId: currentLocationId ?? "",
      merchantId: merchant.id,
    });
    setContextMode("location");
    onStatus(`Открыт торговец: ${merchant.name ?? merchant.id}`);
  }, [
    activeLocation?.id,
    activeLocationId,
    appendLocationPlaceSystemMessage,
    dialogueRunner,
    merchantById,
    onStatus,
    openLocationPlaceDetails,
  ]);

  const openBattleMapFromLocationPlace = useCallback((params: {
    place: LocationArea;
    battleMapId: string;
  }) => {
    console.info("[LocationPlaceClick]", {
      placeId: params.place.id,
      placeName: params.place.name,
      locationId: activeLocation?.id ?? activeLocationId ?? null,
      battleMapId: params.battleMapId,
    });

    dialogueRunner.closeDialogue();
    setActiveWorldModal(null);
    setNpcQuestSceneModal(null);
    setContextMode("location");

    if (onStartBattleMap) {
      void onStartBattleMap(params.battleMapId);
    } else {
      void onStartCombat(params.battleMapId);
    }

    onStatus(`Открыта боевая сцена: ${params.place.name}.`);
  }, [activeLocation?.id, activeLocationId, dialogueRunner, onStartBattleMap, onStartCombat, onStatus]);

  const handleLocationPlaceClick = useCallback((place: LocationArea | null | undefined) => {
    if (!place || place.isHidden) {
      return;
    }

    const dialogueId = getFirstString(place.dialogueIds);
    const npcId = getFirstString(place.npcIds);
    const merchantId = getFirstString(place.merchantIds);
    const questId = getFirstString(place.questIds);
    const battleMapId = getFirstString(place.battleMapIds);
    const hasInteraction = Boolean(
      dialogueId || npcId || merchantId || questId || battleMapId || place.canEnter,
    );

    console.info("[LocationPlaceClick]", {
      placeId: place.id,
      placeName: place.name,
      locationId: activeLocation?.id ?? activeLocationId ?? null,
      dialogueId,
      npcId,
      merchantId,
      questId,
      battleMapId,
      canEnter: place.canEnter,
    });

    if (dialogueId) {
      openDialogueFromLocationPlace({ place, dialogueId, npcId });
      return;
    }

    if (npcId) {
      openNpcFromLocationPlace({ place, npcId });
      return;
    }

    if (merchantId) {
      openMerchantFromLocationPlace({ place, merchantId });
      return;
    }

    if (questId) {
      const quest = questDefinitions.find((entry) => entry.id === questId) ?? null;
      if (!quest) {
        console.warn("[LocationPlaceClick] Quest not found", {
          questId,
          placeId: place.id,
          locationId: activeLocation?.id ?? activeLocationId ?? null,
        });
        appendLocationPlaceSystemMessage(`[SYSTEM] Квест не найден: ${questId}`);
        openLocationPlaceDetails(place);
        return;
      }

      handleTrackQuest(quest.id, null);
      setQuestJournalOpen(true);
      appendLocationPlaceSystemMessage(`Связанный квест: ${quest.title}`);
      return;
    }

    if (battleMapId) {
      openBattleMapFromLocationPlace({ place, battleMapId });
      return;
    }

    if (!hasInteraction) {
      openLocationPlaceDetails(place);
      return;
    }

    openLocationPlaceDetails(place);
  }, [
    activeLocation?.id,
    activeLocationId,
    appendLocationPlaceSystemMessage,
    handleTrackQuest,
    openBattleMapFromLocationPlace,
    openDialogueFromLocationPlace,
    openLocationPlaceDetails,
    openMerchantFromLocationPlace,
    openNpcFromLocationPlace,
    questDefinitions,
  ]);

  const openNpcDialogue = useCallback(
    (npcId: string, context?: { cityId?: string; locationId?: string }) => {
      const npc = resolveNpcById(npcId);
      if (!npc) {
        dialogueRunner.openDialogueForNpc(npcId, context ?? {});
        return;
      }

      const activeQuestIds = playerQuestStates.filter((entry) => entry.status === "active").map((entry) => entry.questId);
      const completedQuestIds = playerQuestStates.filter((entry) => entry.status === "completed").map((entry) => entry.questId);
      const itemIds = inventory.items.filter((entry) => entry.quantity > 0).map((entry) => entry.itemId);

      const player = {
        id: character.id,
        level: character.level,
        race: character.race,
        gold: inventory.gold,
        itemIds,
        activeQuestIds,
        completedQuestIds,
      };

      const bindingDialogueIds = (npc.dialogues ?? []).map((binding) => binding.dialogueId);
      const candidateDialogues = getAllDialogues().filter((dialogue) => {
        if (dialogue.status !== "active") {
          return false;
        }
        return dialogue.npcId === npcId || bindingDialogueIds.includes(dialogue.id);
      });

      const best = selectBestInteractionForNpc({
        npc,
        player,
        questDefinitions,
        playerQuestStates,
        dialogues: candidateDialogues,
      });

      if (best.kind === "quest_scene") {
        const stages = best.questStages.map((stage) => ({
          questId: stage.questId,
          questTitle: stage.questTitle,
          stepTitle: stage.stepTitle,
          journalText: stage.journalText,
          objectives: stage.objectives,
        }));
        const selectedQuestId = stages[0]?.questId ?? "";
        setNpcQuestSceneModal({
          npcId,
          npcName: npc.name ?? npcId,
          portrait: resolveNpcPortrait(npc),
          stages,
          selectedQuestId,
        });
        return;
      }

      if (best.kind === "dialogue") {
        dialogueRunner.openDialogue(best.dialogueId, { ...context, npcId, sourceType: "npc" });
        return;
      }

      dialogueRunner.openDialogueForNpc(npcId, context ?? {});
    },
    [character.id, character.level, character.race, dialogueRunner, inventory.gold, inventory.items, playerQuestStates, questDefinitions, resolveNpcById],
  );

  const handleNpcTalk = useCallback(() => {
    if (!selectedNpcForInteraction) {
      return;
    }
    openNpcDialogue(selectedNpcForInteraction.id, {
      cityId: activeCity?.id,
      locationId: selectedNpcForInteraction.cityLocationId ?? selectedNpcForInteraction.locationId ?? undefined,
    });
  }, [activeCity?.id, openNpcDialogue, selectedNpcForInteraction]);

  const openBanditEncounter = useCallback((
    entity: WorldSimulationSnapshot['activeEntities'][number],
    options?: { ambush?: boolean },
  ) => {
    const npc = entity.npcTemplateId?.trim()
      ? resolveNpcById(entity.npcTemplateId.trim())
      : null;
    const randomizedEnemyCount = rollHostileBanditEnemyCount();
    const enemyCount = Math.max(HOSTILE_BANDIT_MIN_ENEMIES, Math.max(entity.memberCount, randomizedEnemyCount));
    const customEnemies = npc
      ? buildWorldEntityCombatEnemies(npc, enemyCount)
      : undefined;
    const currentGold = Math.max(0, Math.floor(Number(inventory.gold ?? 0)));
    const demandGold = currentGold > 0
      ? Math.max(1, Math.ceil(currentGold * BANDIT_TOLL_PERCENT))
      : 0;
    const luck = Math.max(0, Math.floor(Number(character.activeStats?.luck ?? 0)));
    const escapeChancePercent = Math.max(
      0,
      Math.min(100, BANDIT_ESCAPE_BASE_PERCENT + luck * BANDIT_ESCAPE_PER_LUCK_PERCENT),
    );

    setActiveWorldModal({
      type: 'bandit_encounter',
      entityId: entity.id,
      enemyCount,
      demandGold,
      escapeChancePercent,
      customEnemies,
      introLine: options?.ambush
        ? 'Бандиты бросаются за вами с дороги: "Стоять! Добыча сама пришла."'
        : 'Р“Р»Р°РІР°СЂСЊ Р±Р°РЅРґРёС‚РѕРІ РїРµСЂРµРєСЂС‹РІР°РµС‚ РґРѕСЂРѕРіСѓ: "РЎС‚РѕР№. Р”Р°Р»СЊС€Рµ РёРґС‘С‚ С‚РѕР»СЊРєРѕ С‚РѕС‚, РєС‚Рѕ РїР»Р°С‚РёС‚ Р·Р° С‚РёС€РёРЅСѓ."',
      demandLine: demandGold > 0
        ? `"РџР»Р°С‚Рё ${demandGold} Р·РѕР»РѕС‚С‹С…, Рё СЃРµРіРѕРґРЅСЏ РјС‹ С‚РµР±СЏ РЅРµ С‚СЂРѕРЅРµРј."`
        : '"Р—РѕР»РѕС‚Р° Сѓ С‚РµР±СЏ РЅРµС‚... С‚РѕРіРґР° РїР»Р°С‚Рё РєСЂРѕРІСЊСЋ РёР»Рё Р±РµРіРё, РїРѕРєР° РјРѕР¶РµС€СЊ."',
    });
    setContextMode('npc');
    onStatus(options?.ambush
      ? 'Бандиты заметили вас и бросились в погоню.'
      : 'Р‘Р°РЅРґРёС‚С‹ С‚СЂРµР±СѓСЋС‚ РїР»Р°С‚Сѓ Р·Р° РїСЂРѕС…РѕРґ.');
  }, [character.activeStats?.luck, inventory.gold, onStatus, resolveNpcById]);

  const interactWithWorldEntity = useCallback((entity: WorldSimulationSnapshot['activeEntities'][number]) => {
    const npcId = entity.npcTemplateId?.trim();
    const merchantId = entity.merchantId?.trim();

    if (npcId) {
      const npc = resolveNpcById(npcId);

      if (entity.kind === 'bandit') {
        const willAttack = Math.random() < HOSTILE_BANDIT_ATTACK_CHANCE;
        if (willAttack) {
          const randomizedEnemyCount = rollHostileBanditEnemyCount();
          const enemyCount = Math.max(HOSTILE_BANDIT_MIN_ENEMIES, Math.max(entity.memberCount, randomizedEnemyCount));
          const customEnemies = npc
            ? buildWorldEntityCombatEnemies(npc, enemyCount)
            : undefined;

          const currentGold = Math.max(0, Math.floor(Number(inventory.gold ?? 0)));
          const demandGold = currentGold > 0
            ? Math.max(1, Math.ceil(currentGold * BANDIT_TOLL_PERCENT))
            : 0;
          const luck = Math.max(0, Math.floor(Number(character.activeStats?.luck ?? 0)));
          const escapeChancePercent = Math.max(
            0,
            Math.min(100, BANDIT_ESCAPE_BASE_PERCENT + luck * BANDIT_ESCAPE_PER_LUCK_PERCENT),
          );

          setActiveWorldModal({
            type: 'bandit_encounter',
            entityId: entity.id,
            enemyCount,
            demandGold,
            escapeChancePercent,
            customEnemies,
            introLine: 'Главарь бандитов перекрывает дорогу: "Стой. Дальше идёт только тот, кто платит за тишину."',
            demandLine: demandGold > 0
              ? `"Плати ${demandGold} золотых, и сегодня мы тебя не тронем."`
              : '"Золота у тебя нет... тогда плати кровью или беги, пока можешь."',
          });
          setContextMode('npc');
          onStatus('Бандиты требуют плату за проход.');
          return;
        }

        onStatus('Бандиты заметили вас, но в этот раз не напали.');
        return;
      }

      openNpcDialogue(npcId, {
        cityId: npc?.cityId ?? activeCity?.id,
        locationId: npc?.cityLocationId ?? npc?.locationId,
      });
      return;
    }

    if (merchantId) {
      onOpenMerchant(merchantId);
      return;
    }

    if (entity.sourceType === 'merchant' && entity.sourceId?.trim()) {
      onOpenMerchant(entity.sourceId.trim());
      return;
    }

    onStatus(`У сущности ${entity.id} не задан NPC или merchant source.`);
  }, [activeCity?.id, character.activeStats?.luck, inventory.gold, onOpenMerchant, onStartCombat, onStatus, openNpcDialogue, resolveNpcById]);

  const pendingWorldEntityInteraction = useMemo(() => {
    if (!pendingWorldEntityInteractionId) {
      return null;
    }

    return worldSnapshot?.activeEntities.find((entity) => entity.id === pendingWorldEntityInteractionId)
      ?? (selectedWorldEntity?.id === pendingWorldEntityInteractionId ? selectedWorldEntity : null);
  }, [pendingWorldEntityInteractionId, selectedWorldEntity, worldSnapshot?.activeEntities]);

  const worldEntityApproachTarget = useMemo(() => {
    if (!pendingWorldEntityInteraction || engagedWorldEntityId) {
      return null;
    }

    return {
      x: pendingWorldEntityInteraction.coordinates.x,
      y: pendingWorldEntityInteraction.coordinates.y,
    };
  }, [engagedWorldEntityId, pendingWorldEntityInteraction]);
  const sharedWorldMovementTarget = worldEntityApproachTarget ?? playMovementTarget?.point ?? null;
  const sharedWorldMovementTargetLocationId = worldEntityApproachTarget
    ? null
    : playMovementTarget?.pendingLocationId ?? null;
  const initialPlayer = useMemo<MapPlayer>(() => ({
    x: clamp(playSpawnPosition.x, 0, 1),
    y: clamp(playSpawnPosition.y, 0, 1),
    targetX: null,
    targetY: null,
    speed: runtimeSettings.playerSpeed,
  }), [playSpawnPosition.x, playSpawnPosition.y, runtimeSettings.playerSpeed]);

  const worldRuntime = useWorldRuntimeController({
    enabled: worldMapMode === "play" && locationView === "map",
    initialPlayer,
    playerStartPosition: playSpawnPosition,
    defaultPlayerSpeed: runtimeSettings.playerSpeed,
    playerSpeed: travelMoveSpeed,
    gameplayPaused: worldMapViewerOpen,
    movementLocked: playMovementLocked,
    controlScheme: movementControlScheme,
    sprintActive,
    zones: playVisibleZones,
    resolveCanMoveTo,
    resolveSpeedMultiplier,
    playerTargetPosition: sharedWorldMovementTarget,
    playerTargetLocationId: sharedWorldMovementTargetLocationId,
    onPlayerPosition: handlePlayerPosition,
    onPlayerState: handlePlayerState,
    onEnterZone: handleZoneEnterMemoized,
    onOpenLocation: handleOpenLocationMemoized,
  });

  const playRuntimePlayerPosition = useMemo(() => ({
    x: worldRuntime.player.x,
    y: worldRuntime.player.y,
  }), [worldRuntime.player.x, worldRuntime.player.y]);

  const playCamera = useMemo(() => {
    const width = 1 / runtimeSettings.playZoom;
    const height = 1 / runtimeSettings.playZoom;
    const target = playCameraFocusPoint ?? playRuntimePlayerPosition;
    return {
      width,
      height,
      left: clamp(target.x - width / 2, 0, 1 - width),
      top: clamp(target.y - height / 2, 0, 1 - height),
    };
  }, [playCameraFocusPoint, playRuntimePlayerPosition, runtimeSettings.playZoom]);

  const renderedActiveEntities = useMemo(
    () => resolveRenderedWorldEntities(
      worldSnapshot?.activeEntities ?? [],
      runtimeImages,
      contentSnapshot?.npcs ?? [],
    ),
    [contentSnapshot?.npcs, runtimeImages, worldSnapshot?.activeEntities],
  );
  const playWorldSceneSnapshot = useMemo<WorldSceneSnapshot>(
    () => buildWorldSceneSnapshot({
      playerPosition: playRuntimePlayerPosition,
      playerState: playerState === "moving" ? "moving" : worldRuntime.currentZone?.type === "city" ? "in_city" : worldRuntime.currentZone ? "in_zone" : playerState,
      playerAvatarUrl: playerAvatarUrl ?? null,
      movementTarget: worldRuntime.player.targetX !== null && worldRuntime.player.targetY !== null
        ? { x: worldRuntime.player.targetX, y: worldRuntime.player.targetY }
        : null,
      movementLocked: playMovementLocked,
      movementLockReason: playMovementLockReason,
      controlScheme: movementControlScheme,
      camera: playCamera,
      zones: playVisibleZones,
      currentZoneId: worldRuntime.currentZone?.id ?? currentZone?.id ?? null,
      hoverZoneId: hoverZone?.id ?? null,
      questMarkers: playQuestMarkers,
      npcMarkers: playNpcMarkers,
      worldSnapshot,
      renderedActiveEntities,
      lockedWorldEntityId: engagedWorldEntityId,
      lockedWorldEntityCoordinates: engagedWorldEntityAnchor,
      discoveryMarkers: mapDiscoveryMarkers,
    }),
    [
      currentZone?.id,
      engagedWorldEntityAnchor,
      engagedWorldEntityId,
      hoverZone?.id,
      mapDiscoveryMarkers,
      movementControlScheme,
      playCamera,
      playMovementLocked,
      playMovementLockReason,
      playNpcMarkers,
      playQuestMarkers,
      playVisibleZones,
      playerAvatarUrl,
      playRuntimePlayerPosition,
      playerState,
      playMovementTarget?.pendingLocationId,
      renderedActiveEntities,
      sharedWorldMovementTarget,
      worldRuntime.currentZone,
      worldRuntime.player.targetX,
      worldRuntime.player.targetY,
      worldSnapshot,
    ],
  );
  const worldParityDebugLine = useMemo(() => {
    const position = `${playWorldSceneSnapshot.player.position.x.toFixed(3)},${playWorldSceneSnapshot.player.position.y.toFixed(3)}`;
    return `Parity ${worldRenderer} pos=${position} current=${playWorldSceneSnapshot.currentZoneId ?? '-'} hover=${playWorldSceneSnapshot.hoverZoneId ?? '-'} active=${playWorldSceneSnapshot.activeEntities.length} pending=${pendingWorldEntityInteractionId ?? '-'} locked=${engagedWorldEntityId ?? '-'}`;
  }, [engagedWorldEntityId, pendingWorldEntityInteractionId, playWorldSceneSnapshot.activeEntities.length, playWorldSceneSnapshot.currentZoneId, playWorldSceneSnapshot.hoverZoneId, playWorldSceneSnapshot.player.position.x, playWorldSceneSnapshot.player.position.y, worldRenderer]);
  const lastWorldParityLogRef = useRef<string | null>(null);
  const worldParityDebugEnabled = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem('theend.debug.worldParity') === '1';
  }, []);

  useEffect(() => {
    if (!worldParityDebugEnabled) {
      return;
    }

    if (lastWorldParityLogRef.current === worldParityDebugLine) {
      return;
    }

    lastWorldParityLogRef.current = worldParityDebugLine;
    console.info(`[world-parity] ${worldParityDebugLine}`);
  }, [worldParityDebugEnabled, worldParityDebugLine]);

  const isWithinWorldEntityInteractionRange = useCallback((entity: WorldSimulationSnapshot['activeEntities'][number]) => {
    return Math.hypot(
      playerPosition.x - entity.coordinates.x,
      playerPosition.y - entity.coordinates.y,
    ) <= WORLD_ENTITY_INTERACTION_DISTANCE;
  }, [playerPosition.x, playerPosition.y]);

  useEffect(() => {
    if (worldMapMode !== 'play' || locationView !== 'map' || !worldSnapshot || activeWorldModal) {
      return;
    }
    if (dialogueRunner.state.isOpen || npcQuestSceneModal || activeMineRun || engagedWorldEntityId) {
      return;
    }

    const now = Date.now();
    for (const entity of worldSnapshot.activeEntities) {
      if (entity.kind !== 'bandit' || !entity.isHostile || entity.state === 'dead' || entity.state === 'in_combat') {
        continue;
      }

      const distance = Math.hypot(
        playerPosition.x - entity.coordinates.x,
        playerPosition.y - entity.coordinates.y,
      );
      if (distance > HOSTILE_BANDIT_AGGRO_RADIUS) {
        continue;
      }

      const nextAllowedAt = hostileBanditAggroCooldownRef.current[entity.id] ?? 0;
      if (now < nextAllowedAt) {
        continue;
      }
      hostileBanditAggroCooldownRef.current[entity.id] = now + HOSTILE_BANDIT_AGGRO_COOLDOWN_MS;

      if (Math.random() >= HOSTILE_BANDIT_ATTACK_CHANCE) {
        onStatus('Бандиты заметили вас, но не решились нападать.');
        return;
      }

      setPlayMovementTarget(null);
      setPendingWorldEntityInteractionId(null);
      setSelectedWorldEntity(entity);
      setEngagedWorldEntityId(entity.id);
      setEngagedWorldEntityAnchor({
        x: playerPosition.x,
        y: playerPosition.y,
      });
      openBanditEncounter(entity, { ambush: true });
      return;
    }
  }, [
    activeMineRun,
    activeWorldModal,
    dialogueRunner.state.isOpen,
    engagedWorldEntityId,
    locationView,
    npcQuestSceneModal,
    onStatus,
    openBanditEncounter,
    playerPosition.x,
    playerPosition.y,
    worldMapMode,
    worldSnapshot,
  ]);

  const handleWorldEntityClick = useCallback((entity: WorldSimulationSnapshot['activeEntities'][number]) => {
    const liveEntity = worldSnapshot?.activeEntities.find((entry) => entry.id === entity.id) ?? entity;
    if (engagedWorldEntityId && engagedWorldEntityId !== liveEntity.id) {
      return;
    }

    setPlayMovementTarget(null);
    setSelectedWorldEntity(liveEntity);
    setEngagedWorldEntityAnchor(null);
    setPendingWorldEntityInteractionId(liveEntity.id);
  }, [engagedWorldEntityId, worldSnapshot?.activeEntities]);
  const handleWorldSceneCommand = useCallback((command: WorldSceneCommand) => {
    switch (command.type) {
      case 'hover_point': {
        if (!command.point) {
          handleHoverZone(null);
          return;
        }

        const hoveredZone = detectHoverZone(
          playVisibleZones as Zone[],
          command.point.x,
          command.point.y,
        ) as WorldMapZone | null;
        handleHoverZone(hoveredZone);
        return;
      }
      case 'interact_zone': {
        const zone = playVisibleZones.find((entry) => entry.id === command.zoneId) ?? null;
        if (zone) {
          const isInside = isInsideZone(zone as Zone, playerPosition.x, playerPosition.y, 0);
          if (isInside || currentZone?.id === zone.id) {
            handleRuntimeZoneInteract(zone, command.point);
          }
        }
        return;
      }
      case 'interact_world_entity': {
        const entity = worldSnapshot?.activeEntities.find((entry) => entry.id === command.entityId) ?? null;
        if (entity) {
          handleWorldEntityClick(entity);
        }
        return;
      }
      case 'move_to_point': {
        setLastRuntimeClickPoint(command.point);
        setPlayCameraFocusPoint(null);
        setPlayMovementTarget({
          point: command.point,
          pendingLocationId: command.pendingLocationId ?? null,
        });
        return;
      }
      case 'inspect_current_zone': {
        handleInspectCurrentZone();
        return;
      }
      case 'focus_zone': {
        if (!command.zoneId) {
          setPlayCameraFocusPoint(null);
          return;
        }
        const zone = playVisibleZones.find((entry) => entry.id === command.zoneId) ?? null;
        if (!zone) {
          return;
        }
        const [x, y] = getZoneCenter(zone);
        setPlayCameraFocusPoint({ x, y });
        return;
      }
      case 'focus_point': {
        setPlayCameraFocusPoint(command.point ? { x: command.point.x, y: command.point.y } : null);
        return;
      }
      case 'move_directional':
      case 'stop_movement':
      default:
        return;
    }
  }, [currentZone?.id, handleHoverZone, handleInspectCurrentZone, handleRuntimeZoneInteract, handleWorldEntityClick, playVisibleZones, playerPosition.x, playerPosition.y, worldSnapshot?.activeEntities]);

  useEffect(() => {
    if (!playMovementTarget || playerState === 'moving') {
      return;
    }

    if (Math.hypot(playerPosition.x - playMovementTarget.point.x, playerPosition.y - playMovementTarget.point.y) > 0.003) {
      return;
    }

    setPlayMovementTarget(null);
  }, [playMovementTarget, playerPosition.x, playerPosition.y, playerState]);

  useEffect(() => {
    if (locationView === 'map') {
      return;
    }

    setPlayMovementTarget(null);
  }, [locationView]);

  useEffect(() => {
    if (!pendingWorldEntityInteractionId) {
      return;
    }

    if (!pendingWorldEntityInteraction) {
      if (worldSnapshot) {
        setPendingWorldEntityInteractionId(null);
      }
      return;
    }

    if (!isWithinWorldEntityInteractionRange(pendingWorldEntityInteraction)) {
      return;
    }

    setSelectedWorldEntity(pendingWorldEntityInteraction);
    setEngagedWorldEntityId(pendingWorldEntityInteraction.id);
    setEngagedWorldEntityAnchor({
      x: pendingWorldEntityInteraction.coordinates.x,
      y: pendingWorldEntityInteraction.coordinates.y,
    });
    setPendingWorldEntityInteractionId(null);
    interactWithWorldEntity(pendingWorldEntityInteraction);
  }, [
    interactWithWorldEntity,
    isWithinWorldEntityInteractionRange,
    pendingWorldEntityInteraction,
    pendingWorldEntityInteractionId,
    worldSnapshot,
  ]);

  useEffect(() => {
    if (!engagedWorldEntityId) {
      return;
    }

    const hasOpenInteractionUi = dialogueRunner.state.isOpen
      || npcQuestSceneModal !== null
      || activeWorldModal !== null
      || activeMineRun !== null;

    if (hasOpenInteractionUi) {
      return;
    }

    setEngagedWorldEntityId(null);
    setEngagedWorldEntityAnchor(null);
  }, [
    activeWorldModal,
    activeMineRun,
    dialogueRunner.state.isOpen,
    engagedWorldEntityId,
    npcQuestSceneModal,
  ]);

  const handleNpcTrade = useCallback(() => {
    if (!selectedNpcForInteraction?.traderId) {
      onStatus("\u0423 NPC \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d trader profile.");
      return;
    }
    onOpenMerchant(selectedNpcForInteraction.traderId);
  }, [onOpenMerchant, onStatus, selectedNpcForInteraction]);

  const openTrainingForNpc = useCallback((npc: NpcDefinition | null | undefined) => {
    if (!npc) {
      console.warn("[openTrainingForNpc] missing npc");
      return;
    }
    if (!npc.id) {
      console.warn("[openTrainingForNpc] missing npc.id", npc);
      return;
    }
    if (!npc.canTrain) {
      console.warn("[openTrainingForNpc] npc cannot train", {
        npcId: npc.id,
        npcName: npc.name,
      });
      onStatus("\u042d\u0442\u043e\u0442 NPC \u043d\u0435 \u043e\u0431\u0443\u0447\u0430\u0435\u0442 \u043d\u0430\u0432\u044b\u043a\u0430\u043c.");
      return;
    }

    const trainerSkillIds = resolveNpcTrainerSkillIds(npc);
    console.debug("[WorldMapScreen] openTrainingForNpc -> onOpenSkills", {
      npcId: npc.id,
      npcName: npc.name,
      canTrain: npc.canTrain,
      trainerSkillIds,
    });
    onOpenSkills(npc.id, trainerSkillIds, npc.name);
  }, [onOpenSkills, onStatus]);

  const handleNpcTrain = useCallback(() => {
    openTrainingForNpc(selectedNpcForInteraction);
    const trainerCount =
      Array.isArray(resolveNpcTrainerSkillIds(selectedNpcForInteraction))
        ? (resolveNpcTrainerSkillIds(selectedNpcForInteraction) as unknown[]).length
        : 0;
    if (selectedNpcForInteraction?.canTrain) {
      onStatus(
        `\u041e\u0442\u043a\u0440\u044b\u0442\u043e \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435 \u0443 NPC: ${selectedNpcForInteraction.name}. \u0414\u043e\u0441\u0442\u0443\u043f\u043d\u043e \u043d\u0430\u0432\u044b\u043a\u043e\u0432: ${trainerCount}.`,
      );
    }
  }, [openTrainingForNpc, onStatus, selectedNpcForInteraction]);

  const handleNpcAttack = useCallback(async () => {
    if (!selectedNpcForInteraction?.canFight) {
      onStatus("\u042d\u0442\u043e\u0442 NPC \u043d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d \u0434\u043b\u044f \u0431\u043e\u044f.");
      return;
    }
    await onStartCombat();
  }, [onStartCombat, onStatus, selectedNpcForInteraction]);

  const handleNpcQuest = useCallback(() => {
    if (!selectedNpcForInteraction) {
      return;
    }
    setContextMode("npc");
    if (
      !selectedNpcForInteraction.canGiveQuests &&
      selectedNpcForInteraction.questBindings.length === 0
    ) {
      onStatus("\u0423 NPC \u043d\u0435\u0442 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043a\u0432\u0435\u0441\u0442\u043e\u0432\u044b\u0445 \u0441\u0432\u044f\u0437\u043e\u043a.");
      return;
    }
    handleNpcTalk();
    onStatus(`\u041a\u0432\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u0434\u0438\u0430\u043b\u043e\u0433 \u0441 NPC: ${selectedNpcForInteraction.name}.`);
  }, [handleNpcTalk, onStatus, selectedNpcForInteraction]);

  const handleNpcInspect = useCallback(() => {
    if (!selectedNpcForInteraction) {
      return;
    }
    onStatus(
      `${selectedNpcForInteraction.name}: ${selectedNpcForInteraction.description || "без описания"}`,
    );
  }, [onStatus, selectedNpcForInteraction]);

  const activeDialogue = dialogueRunner.state.dialogueId;
  const activeDialogueNode = dialogueRunner.state.nodeId;
  const setDialogueLogs = useCallback((updater: (prev: string[]) => string[]) => {
    void updater;
  }, []);

  const closeMine = useCallback(() => {
    setActiveMineRun(null);
    setActiveMineEffects(null);
  }, []);

  const addItemsToPlayerInventory = useCallback((loot: Array<{ itemId: string; quantity: number }>) => {
    if (loot.length === 0) {
      return;
    }
    const currentItems = readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY);
    const nextItems = [...currentItems];
    for (const stack of loot) {
      const resolvedName = resolveItemById?.(stack.itemId)?.name ?? null;
      if (!resolvedName) {
        onStatus(`Неизвестная добыча: ${stack.itemId}`);
        continue;
      }
      const amount = Math.max(0, Math.floor(Number(stack.quantity ?? 0)));
      for (let index = 0; index < amount; index += 1) {
        nextItems.push(stack.itemId);
      }
    }
    writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, nextItems);
  }, [onStatus, resolveItemById]);

  const addGoldToPlayerInventory = useCallback((goldAmount: number) => {
    const normalized = Math.max(0, Math.floor(Number(goldAmount ?? 0)));
    if (normalized <= 0) {
      return;
    }
    const currentGold = Math.max(0, Math.floor(readNumberStorage(PLAYER_GOLD_STORAGE_KEY, 0)));
    writeNumberStorage(PLAYER_GOLD_STORAGE_KEY, currentGold + normalized);
  }, []);

  const resolveMineItemName = useCallback((itemId: string) => {
    const item = resolveItemById?.(itemId);
    return item?.name ?? itemId;
  }, [resolveItemById]);

  const resolveMineItemMeta = useCallback((itemId: string) => {
    const item = resolveItemById?.(itemId);
    if (!item) {
      return null;
    }
    const itemRecord = item as ItemDefinition & {
      gameplayDescription?: string;
      loreDescription?: string;
      description?: string;
    };
    return {
      name: itemRecord.name,
      description: itemRecord.gameplayDescription
        || itemRecord.loreDescription
        || itemRecord.description
        || '',
      iconUrl: resolveItemImage?.(itemRecord) ?? undefined,
    };
  }, [resolveItemById, resolveItemImage]);

  const handleMineDropLoot = useCallback((itemId: string, quantity: number) => {
    if (!activeMineRun || activeMineRun.status !== 'active') {
      return;
    }

    const normalizedItemId = String(itemId ?? '').trim();
    if (!normalizedItemId) {
      return;
    }

    const stack = activeMineRun.temporaryLoot.find((entry) => entry.itemId === normalizedItemId) ?? null;
    if (!stack) {
      onStatus(`Предмет не найден в добыче: ${normalizedItemId}.`);
      return;
    }

    const dropAmount = Math.max(1, Math.min(stack.quantity, Math.floor(Number(quantity) || 0)));
    if (!Number.isFinite(dropAmount) || dropAmount <= 0) {
      return;
    }

    const nextLoot = activeMineRun.temporaryLoot
      .map((entry) => {
        if (entry.itemId !== normalizedItemId) {
          return entry;
        }
        return {
          ...entry,
          quantity: Math.max(0, entry.quantity - dropAmount),
        };
      })
      .filter((entry) => entry.quantity > 0);

    const droppedName = resolveMineItemName(normalizedItemId);
    const nextLogEntry = `Выброшено: ${droppedName} x${dropAmount}.`;
    const nextRun: InternalMineRunState = {
      ...activeMineRun,
      temporaryLoot: nextLoot,
      eventLog: [...activeMineRun.eventLog.slice(-149), nextLogEntry],
    };

    setActiveMineRun(nextRun);
    onStatus(nextLogEntry);
  }, [activeMineRun, onStatus, resolveMineItemName]);

  const finishMineRun = useCallback((nextRun: InternalMineRunState) => {
    setActiveMineRun(nextRun);
    if (nextRun.status === 'escaped') {
      onStatus('Вы выбрались из шахты. Подтвердите результат, чтобы перенести добычу.');
      return;
    }
    if (nextRun.status === 'retreated') {
      onStatus('Вы отступили и потеряли часть добычи. Подтвердите результат.');
      return;
    }
    if (nextRun.status === 'failed' || nextRun.status === 'dead') {
      onStatus(nextRun.status === 'dead'
        ? 'Вы потеряли сознание в шахте. Подтвердите результат.'
        : 'Забег в шахте провален. Подтвердите результат.');
    }
  }, [onStatus]);

  const finalizeMineRunResult = useCallback(() => {
    if (!activeMineRun || activeMineRun.status === 'active') {
      return;
    }

    const awardedLoot = activeMineRun.awardedLoot ?? activeMineRun.temporaryLoot;
    const awardedGold = Math.max(0, Math.floor(activeMineRun.awardedGold ?? activeMineRun.temporaryGold ?? 0));
    const xpAward = getMineRunAwardXp(activeMineRun);

    addItemsToPlayerInventory(awardedLoot);
    addGoldToPlayerInventory(awardedGold);

    const currentProfessions = normalizePlayerProfessionsState(character.professions);
    const nextProfessions = addProfessionXp(currentProfessions, 'mining', xpAward);
    const levelBefore = currentProfessions.professions.find((entry) => entry.professionId === 'mining')?.level ?? 0;
    const levelAfter = nextProfessions.professions.find((entry) => entry.professionId === 'mining')?.level ?? 0;
    if (onPlayerProfessionsChange && nextProfessions !== currentProfessions) {
      onPlayerProfessionsChange(nextProfessions);
    }

    if (onMineRunResourcesChange) {
      const nextHp = Math.max(0, Math.min(character.maxHp, Math.floor(Number(activeMineRun.hp) || 0)));
      const nextStamina = Math.max(0, Math.min(character.maxStamina, Math.floor(Number(activeMineRun.stamina) || 0)));
      onMineRunResourcesChange({ hp: nextHp, stamina: nextStamina });
    }

    onRuntimeInventoryChanged?.();
    recordMiningCareerRun(character.id, toPublicMineRun(activeMineRun), xpAward);
    onStatus(`Итог шахты: добыча перенесена, золото +${awardedGold}, опыт Горняка +${xpAward}.`);
    if (levelAfter > levelBefore) {
      onStatus('Горняк повысил уровень!');
    }

    setActiveMineRun(null);
    setActiveMineEffects(null);
  }, [
    activeMineRun,
    addGoldToPlayerInventory,
    addItemsToPlayerInventory,
    character.maxHp,
    character.maxStamina,
    character.professions,
    onMineRunResourcesChange,
    onPlayerProfessionsChange,
    onRuntimeInventoryChanged,
    onStatus,
  ]);

  const openMine = useCallback(async (mineId: string) => {
    const normalizedMineId = String(mineId ?? '').trim();
    if (!normalizedMineId) {
      onStatus('Шахта не найдена: (пустой mineId)');
      return;
    }

    const miningState = getPlayerProfession(questRuntimeProfessionCompat.professions ?? { professions: [] }, 'mining');
    setActiveMineLoading(true);
    try {
      await ensureMiningPlaceholderItems();
      const effects = await resolveMiningSkillEffects(miningState);
      const run = startMineRun({
        mineId: normalizedMineId,
        playerHp: battleStats.hp,
        playerStamina: battleStats.stamina,
        effects,
      });
      setActiveMineEffects(effects);
      setActiveMineRun(run);
    } catch (error) {
      onStatus((error as Error).message);
    } finally {
      setActiveMineLoading(false);
    }
  }, [battleStats.hp, battleStats.stamina, onStatus, questRuntimeProfessionCompat.professions]);

  const resolveMineOpenError = useCallback((mineId: string): string | null => {
    const hasMiningProfession = playerHasProfessionCompat(questRuntimeProfessionCompat, 'mining');
    if (!hasMiningProfession) {
      return 'Вы не знаете профессию Горняк.';
    }

    const normalizedMineId = String(mineId ?? '').trim();
    if (!normalizedMineId) {
      return 'Шахта не найдена: (пустой mineId)';
    }

    const mines = loadMinesFromStorage();
    if (mines.length === 0) {
      return null;
    }

    const mine = findMineById(normalizedMineId);
    if (!mine) {
      return `Шахта не найдена: ${normalizedMineId}`;
    }

    const miningState = getPlayerProfession(questRuntimeProfessionCompat.professions ?? { professions: [] }, 'mining');
    const miningLevel = Number(miningState?.level ?? 0);
    if (Number.isFinite(Number(mine.requiredMiningLevel)) && miningLevel < Number(mine.requiredMiningLevel)) {
      return 'Ваш уровень Горняка слишком низкий.';
    }

    return null;
  }, [questRuntimeProfessionCompat]);

  const resolveMineZoneOpenError = useCallback((zone: WorldMapZone): string | null => {
    if (!playerHasProfessionCompat(questRuntimeProfessionCompat, 'mining')) {
      return 'Вы не умеете работать в шахте. Найдите наставника-горняка.';
    }

    const miningState = getPlayerProfession(questRuntimeProfessionCompat.professions ?? { professions: [] }, 'mining');
    const miningLevel = Number(miningState?.level ?? 0);
    if (Number.isFinite(Number(zone.requiredLevel)) && miningLevel < Number(zone.requiredLevel)) {
      return 'Ваш уровень Горняка слишком низкий.';
    }

    if (zone.requiredQuestId) {
      const requiredQuestId = zone.requiredQuestId.trim();
      const state = playerQuestStates.find((entry) => entry.questId === requiredQuestId) ?? null;
      if (!state || (state.status !== 'active' && state.status !== 'completed')) {
        return `Доступ закрыт: требуется квест ${requiredQuestId}.`;
      }
    }

    if (zone.requiredItemId) {
      const requiredItemId = zone.requiredItemId.trim();
      const hasItem = inventory.items.some((item) => item.itemId === requiredItemId && item.quantity > 0);
      if (!hasItem) {
        return `Доступ закрыт: нужен предмет ${requiredItemId}.`;
      }
    }

    if (zone.requiredFaction) {
      return `Доступ закрыт: требуется фракция ${zone.requiredFaction.trim()}.`;
    }

    return resolveMineOpenError(zone.mineId ?? '');
  }, [inventory.items, playerQuestStates, questRuntimeProfessionCompat, resolveMineOpenError]);

  useEffect(() => {
    if (!devTravelRequest || worldMapMode === 'editor') {
      return;
    }

    if (processedDevTravelTokenRef.current === devTravelRequest.token) {
      return;
    }
    processedDevTravelTokenRef.current = devTravelRequest.token;

    const targetId = String(devTravelRequest.targetId ?? '').trim();

    if (devTravelRequest.mode === 'mine') {
      if (devTravelRequest.mineAction === 'open') {
        if (!targetId) {
          onStatus('GODMODE: mine id is required.');
          return;
        }
        const mineError = resolveMineOpenError(targetId);
        if (mineError) {
          onStatus(mineError);
          return;
        }
        openMine(targetId);
        onStatus(`GODMODE: opened mine ${targetId}.`);
        return;
      }

      if (devTravelRequest.mineAction === 'close') {
        if (!activeMineRun) {
          closeMine();
          onStatus('GODMODE: closed mine view.');
          return;
        }
        finishMineRun(closeMineRun(activeMineRun, activeMineEffects ?? []));
        onStatus('GODMODE: mine closed as retreat.');
        return;
      }

      if (devTravelRequest.mineAction === 'finish') {
        if (!activeMineRun || !devTravelRequest.mineResult) {
          onStatus('GODMODE: no active mine run to finish.');
          return;
        }
        const nextRun = forceMineRunOutcome(activeMineRun, devTravelRequest.mineResult, activeMineEffects ?? []);
        if (nextRun.status === 'active') {
          onStatus('GODMODE: mine run is still active.');
          return;
        }
        finishMineRun(nextRun);
        onStatus(`GODMODE: mine finished as ${devTravelRequest.mineResult}.`);
        return;
      }

      onStatus('GODMODE: unknown mine action.');
      return;
    }

    if (devTravelRequest.mode === 'world') {
      setActiveCityId(null);
      setActiveLocationId(null);
      setActiveWorldModal(null);
      setLocationView('map');
      setSelectedCityLocationId(null);
      setContextMode(currentZone ? 'location' : 'empty');
      setPlayerState(currentZone ? 'in_zone' : 'idle');
      onStatus('GODMODE: returned to world map.');
      return;
    }

    if (devTravelRequest.mode === 'city') {
      if (!targetId) {
        onStatus('GODMODE: city id is required.');
        return;
      }
      void cityService
        .getCityById(targetId)
        .then((city) => {
          if (!city) {
            onStatus(`GODMODE: city not found: ${targetId}`);
            return;
          }
          setActiveCityId(city.id);
          setActiveLocationId(null);
          setActiveWorldModal(null);
          setLocationView('city');
          setSelectedCityLocationId(null);
          setContextMode('location');
          setPlayerState('in_city');
          onStatus(`GODMODE: teleported to city ${city.name}.`);
        })
        .catch((error) => {
          onStatus(`GODMODE city teleport error: ${(error as Error).message}`);
        });
      return;
    }

    if (devTravelRequest.mode === 'location') {
      if (!targetId) {
        onStatus('GODMODE: location id is required.');
        return;
      }
      const linkedLocation = contentSnapshot?.locations.find((entry) => entry.id === targetId) ?? null;
      if (!linkedLocation) {
        onStatus(`GODMODE: location not found: ${targetId}`);
        return;
      }
      if (locationHasLocalMap(linkedLocation)) {
        setActiveLocationId(linkedLocation.id);
        setActiveCityId(null);
        setActiveWorldModal(null);
        setLocationView('location');
        setContextMode('location');
        setPlayerState('in_zone');
        onStatus(`GODMODE: teleported to ${linkedLocation.name}.`);
        return;
      }

      setActiveLocationId(null);
      setActiveCityId(null);
      setActiveWorldModal({
        type: 'location',
        locationId: linkedLocation.id,
      });
      setLocationView('map');
      setContextMode('location');
      setPlayerState('in_zone');
      onStatus(`GODMODE: opened location ${linkedLocation.name}.`);
    }
  }, [activeMineEffects, activeMineRun, closeMine, contentSnapshot, currentZone, devTravelRequest, finishMineRun, onStatus, openMine, resolveMineOpenError, worldMapMode]);

  const handleMineHitBlock = useCallback((blockIndex: number) => {
    if (!activeMineRun || !activeMineEffects) {
      return;
    }
    const result = hitMineBlock(activeMineRun, blockIndex, activeMineEffects);
    if (!result.changed) {
      return;
    }
    finishMineRun(result.run);
  }, [activeMineEffects, activeMineRun, finishMineRun, onStatus]);

  const handleMineEscape = useCallback(() => {
    if (!activeMineRun) {
      return;
    }
    const nextRun = escapeMineRun(activeMineRun, activeMineEffects ?? []);
    finishMineRun(nextRun);
  }, [activeMineEffects, activeMineRun, finishMineRun]);

  const handleMineRetreat = useCallback(() => {
    if (!activeMineRun) {
      return;
    }
    const nextRun = retreatMineRun(activeMineRun, activeMineEffects ?? []);
    finishMineRun(nextRun);
  }, [activeMineEffects, activeMineRun, finishMineRun]);

  const handleMineDescend = useCallback(() => {
    if (!activeMineRun || !activeMineEffects) {
      return;
    }
    const nextRun = descendMineRun(activeMineRun, activeMineEffects);
    setActiveMineRun(nextRun);
  }, [activeMineEffects, activeMineRun]);

  const handleMineUseActiveSkill = useCallback((skillId: string, blockIndex: number): string => {
    if (!activeMineRun || !activeMineEffects) {
      return 'Спуск не активен.';
    }
    const result = applyMineActiveSkill(activeMineRun, activeMineEffects, skillId, blockIndex);
    if (result.changed) {
      setActiveMineRun(result.run);
    }
    if (result.message) {
      onStatus(result.message);
    }
    return result.message ?? 'Подсказка недоступна.';
  }, [activeMineEffects, activeMineRun, onStatus]);

  const handleMineClose = useCallback(() => {
    if (!activeMineRun) {
      setActiveMineRun(null);
      setActiveMineEffects(null);
      return;
    }
    if (activeMineRun.status === 'active') {
      const confirmed = window.confirm('Активная шахта будет засчитана как отступление. Продолжить?');
      if (!confirmed) {
        return;
      }
      finishMineRun(closeMineRun(activeMineRun, activeMineEffects ?? []));
      return;
    }
    onStatus('Сначала подтвердите результат шахты.');
  }, [activeMineEffects, activeMineRun, finishMineRun]);

  const handleSelectDialogueChoice = useCallback(
    async (choiceId: string) => {
      try {
      const dialogueIdAtChoiceTime =
        dialogueRunner.state.isOpen ? (dialogueRunner.state.dialogueId ?? null) : null;
      const dialogueNpcId =
        dialogueRunner.state.isOpen ? (dialogueRunner.state.context.npcId ?? null) : null;
      const result = await dialogueRunner.selectChoice(choiceId);
      if (!result) {
        return;
      }
      onRuntimeInventoryChanged?.();
      const playerLogLines: string[] = [];
      for (const rawLine of result.logs ?? []) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        if (line.endsWith("event emitted.")) {
          continue;
        }
        if (line.startsWith("Unhandled action:")) {
          continue;
        }
        if (line.startsWith("Quest flag set:")) {
          continue;
        }
        if (line.startsWith("Global flag set:")) {
          continue;
        }
        if (line.startsWith("NPC disposition updated for")) {
          continue;
        }
        if (line.startsWith("Dialogue ended.")) {
          continue;
        }

        if (line.startsWith("Quest started:")) {
          const questId = line.slice("Quest started:".length).trim();
          const questTitle =
            questDefinitions.find((entry) => entry.id === questId)?.title ??
            null;
          playerLogLines.push(
            questTitle ? `\u041d\u043e\u0432\u044b\u0439 \u043a\u0432\u0435\u0441\u0442: ${questTitle}` : "\u041d\u043e\u0432\u044b\u0439 \u043a\u0432\u0435\u0441\u0442 \u043f\u0440\u0438\u043d\u044f\u0442.",
          );
          onStatus("\u041a\u0432\u0435\u0441\u0442 \u043f\u0440\u0438\u043d\u044f\u0442.");
          continue;
        }
        if (line.startsWith("Quest completed:")) {
          const questId = line.slice("Quest completed:".length).trim();
          const questTitle =
            questDefinitions.find((entry) => entry.id === questId)?.title ??
            null;
          playerLogLines.push(
            questTitle ? `\u041a\u0432\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d: ${questTitle}` : "\u041a\u0432\u0435\u0441\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d.",
          );
          continue;
        }
        if (line.startsWith("Quest advanced:")) {
          playerLogLines.push("\u041a\u0432\u0435\u0441\u0442 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d.");
          continue;
        }
        if (line.startsWith("Quest failed:")) {
          playerLogLines.push("\u041a\u0432\u0435\u0441\u0442 \u043f\u0440\u043e\u0432\u0430\u043b\u0435\u043d.");
          continue;
        }
        if (line.startsWith("Gold granted:")) {
          const amount = line.slice("Gold granted:".length).trim();
          playerLogLines.push(`\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u043e \u0437\u043e\u043b\u043e\u0442\u043e: ${amount}`);
          continue;
        }
        if (line.startsWith("Gold removed:")) {
          const amount = line.slice("Gold removed:".length).trim();
          playerLogLines.push(`\u041f\u043e\u0442\u0440\u0430\u0447\u0435\u043d\u043e \u0437\u043e\u043b\u043e\u0442\u043e: ${amount}`);
          continue;
        }
        if (line.startsWith("Item granted:")) {
          const itemId = line.slice("Item granted:".length).trim();
          const name = resolveItemById
            ? (resolveItemById(itemId)?.name ?? itemId)
            : itemId;
          playerLogLines.push(`\u041f\u043e\u043b\u0443\u0447\u0435\u043d \u043f\u0440\u0435\u0434\u043c\u0435\u0442: ${name}`);
          continue;
        }
        if (line.startsWith("Item removed:")) {
          const itemId = line.slice("Item removed:".length).trim();
          const name = resolveItemById
            ? (resolveItemById(itemId)?.name ?? itemId)
            : itemId;
          playerLogLines.push(`\u041f\u043e\u0442\u0435\u0440\u044f\u043d \u043f\u0440\u0435\u0434\u043c\u0435\u0442: ${name}`);
          continue;
        }
        if (line.startsWith("Skill granted:")) {
          const skillId = line.slice("Skill granted:".length).trim();
          playerLogLines.push(`\u041f\u043e\u043b\u0443\u0447\u0435\u043d \u043d\u0430\u0432\u044b\u043a: ${skillId}`);
          continue;
        }
        if (line.startsWith("Quest item granted:")) {
          playerLogLines.push("\u041f\u043e\u043b\u0443\u0447\u0435\u043d \u043a\u0432\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043f\u0440\u0435\u0434\u043c\u0435\u0442.");
          continue;
        }
        if (line.startsWith("Quest item removed:")) {
          playerLogLines.push("\u041a\u0432\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043f\u0440\u0435\u0434\u043c\u0435\u0442 \u043f\u043e\u0442\u0435\u0440\u044f\u043d.");
          continue;
        }
        if (line.startsWith("Location unlocked:")) {
          playerLogLines.push("\u041e\u0442\u043a\u0440\u044b\u0442\u0430 \u043d\u043e\u0432\u0430\u044f \u043b\u043e\u043a\u0430\u0446\u0438\u044f.");
          continue;
        }

        // For any remaining logs, avoid leaking internal IDs to the player.
      }

      if (playerLogLines.length > 0) {
        const now = Date.now();
        const next = playerLogLines.map((text) => ({
          id: `sys-dialogue-${now}-${nextSystemChatIdRef.current++}`,
          text,
          type: "system" as const,
        }));
        setSystemChat((prev) => [...prev, ...next].slice(-12));
      }

      setPlayerQuestStates(
        getAllPlayerQuestStates().filter(
          (entry) => entry.playerId === character.id,
        ),
      );

      let modalClosed = false;
      for (const intent of result.intents ?? []) {
        if (intent.type === "HEAL_PLAYER_FULL") {
          if (!onApplyHealingService) {
            onStatus("\u041b\u0435\u0447\u0435\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.");
            continue;
          }

          await onApplyHealingService({ costGold: intent.costGold ?? 0 });
          const healEntry: ChatMessage = {
            id: `sys-heal-${Date.now()}-${nextSystemChatIdRef.current++}`,
            text: "\u0412\u044b \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u043b\u0438 \u0437\u0434\u043e\u0440\u043e\u0432\u044c\u0435.",
            type: "system",
          };
          setSystemChat((prev) => [...prev, healEntry].slice(-12));
          onStatus("\u0417\u0434\u043e\u0440\u043e\u0432\u044c\u0435 \u0432\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043e.");
          continue;
        }
        if (intent.type === "OPEN_SHOP") {
          const npc = npcs.find((entry) => entry.id === dialogueNpcId) ?? null;
          const traderId = npc?.traderId?.trim() || intent.merchantId?.trim();
          if (!traderId) {
            onStatus("\u0414\u043b\u044f openShop \u043d\u0435\u0442 traderId \u0443 NPC.");
            continue;
          }
          dialogueRunner.closeDialogue();
          setActiveWorldModal(null);
          onOpenMerchant(traderId);
          modalClosed = true;
          break;
        }
        if (intent.type === "START_COMBAT") {
          const encounterNpc = dialogueNpcId
            ? npcs.find((entry) => entry.id === dialogueNpcId) ?? null
            : null;
          const customEnemies = selectedWorldEntity?.isHostile && encounterNpc
            ? buildWorldEntityCombatEnemies(encounterNpc, selectedWorldEntity.memberCount)
            : undefined;
          dialogueRunner.closeDialogue();
          setActiveWorldModal(null);
          void onStartCombat(undefined, customEnemies && customEnemies.length > 0 ? { customEnemies } : undefined);
          modalClosed = true;
          break;
        }
        if (intent.type === "OPEN_TRAINING") {
          dialogueRunner.closeDialogue();
          setActiveWorldModal(null);
          const resolvedTrainerId = intent.trainerNpcId?.trim()
            || selectedNpcForInteraction?.id
            || dialogueNpcId
            || '';
          const trainerNpc = npcs.find((entry) => entry.id === resolvedTrainerId) ?? null;
          openTrainingForNpc(trainerNpc);
          modalClosed = true;
          break;
        }
        if (intent.type === 'OPEN_MINE') {
          const mineId = String(intent.mineId ?? '').trim();
          const mineError = resolveMineOpenError(mineId);
          if (mineError) {
            onStatus(mineError);
            continue;
          }

          dialogueRunner.closeDialogue();
          setActiveWorldModal(null);
          openMine(mineId);
          onStatus(`Открыта шахта: ${mineId}`);
          modalClosed = true;
          break;
        }
        if (intent.type === "GRANT_SKILL") {
          if (!onGrantSkill) {
            onStatus("Навык не может быть выдан: отсутствует обработчик onGrantSkill.");
            continue;
          }
          const npcId = dialogueNpcId ?? undefined;
          void onGrantSkill(intent.skillId, npcId);
          modalClosed = false;
          continue;
        }
      }

      if (modalClosed) {
        return;
      }
      if (result.ended) {
        dialogueRunner.closeDialogue();
        const profile = loadCharacterProfile(character.id);
        const isBranIntroDialogue = Boolean(
          dialogueIdAtChoiceTime
          && dialogueNpcId === BRAN_INTRO_NPC_ID
          && BRAN_INTRO_DIALOGUE_IDS.has(dialogueIdAtChoiceTime),
        );
        if (isBranIntroDialogue && isHumanArgosProfile(profile)) {
          setCharacterFlag(character.id, ARGOS_INTRO_SEEN_FLAG, true);
          if (getCharacterFlag(character.id, ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG) !== true) {
            setCharacterFlag(character.id, ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG, false);
            setTutorialState(startTutorial(character.id, TUTORIAL_ARGOS_INTRO_ID));
          }
        }
      }
      const questIntents = result.intents.filter((intent) => (
        intent.type === 'QUEST_STARTED' || intent.type === 'QUEST_ADVANCED' || intent.type === 'QUEST_COMPLETED'
      ));
      for (const intent of questIntents) {
        setDialogueLogs((prev) => [...prev, `Intent: ${intent.type} (${intent.questId})`].slice(-20));
      }
      if (questIntents.length > 0) {
        setPlayerQuestStates(getAllPlayerQuestStates().filter((state) => state.playerId === character.id));
      }
      for (const intent of questIntents) {
        if (intent.type !== 'QUEST_STARTED') {
          continue;
        }
        const quest = getAllQuests().find((entry) => entry.id === intent.questId);
        const questEntry: ChatMessage = {
          id: `sys-quest-dialogue-${Date.now()}-${intent.questId}`,
          text: `Новый квест: ${quest?.title ?? intent.questId}`,
          type: 'system',
        };
        setSystemChat((prev) => [...prev, questEntry].slice(-12));
      }

      const modalIntents = result.intents.filter((intent) => (
        intent.type === 'OPEN_SHOP' || intent.type === 'START_COMBAT' || intent.type === 'OPEN_TRAINING' || intent.type === 'OPEN_MINE'
      ));
      const primaryModalIntent = modalIntents[0];
      if (primaryModalIntent?.type === 'OPEN_SHOP') {
        onOpenMerchant(primaryModalIntent.merchantId ?? '');
      } else if (primaryModalIntent?.type === 'START_COMBAT') {
        void onStartCombat();
      } else if (primaryModalIntent?.type === 'OPEN_TRAINING') {
        const resolvedTrainerId = primaryModalIntent.trainerNpcId?.trim()
          || selectedNpcForInteraction?.id
          || dialogueNpcId
          || '';
        const trainerNpc = npcs.find((entry) => entry.id === resolvedTrainerId) ?? null;
        openTrainingForNpc(trainerNpc);
      } else if (primaryModalIntent?.type === 'OPEN_MINE') {
        const mineError = resolveMineOpenError(primaryModalIntent.mineId);
        if (mineError) {
          onStatus(mineError);
        } else {
          openMine(primaryModalIntent.mineId);
        }
      }

      if (modalIntents.length > 1) {
        const ignored = modalIntents.slice(1).map((intent) => intent.type).join(', ');
        setDialogueLogs((prev) => [...prev, `Ignored intents: ${ignored}`].slice(-20));
      }
    } catch (error) {
      onStatus((error as Error).message);
    }
  }, [activeDialogue, activeDialogueNode, character.id, dialogueRunner, onApplyHealingService, onGrantSkill, onOpenMerchant, onRuntimeInventoryChanged, onStartCombat, onStatus, openMine, openTrainingForNpc, questDefinitions, resolveItemById, resolveMineOpenError, selectedNpcForInteraction]);

  function setMode(mode: WorldMapMode) {
    if (mode !== "play") {
      rememberCurrentMapPosition();
      closeMine();
    }
    if (mode !== "play") {
      setWorldMapViewerOpen(false);
    }
    setWorldMapMode(mode);
    if (mode === "editor") {
      setLocationView("map");
      setContextMode("empty");
      onStatus("Editor mode enabled. Gameplay panels hidden.");
      return;
    }
    onStatus("Play mode enabled.");
  }

  function validateDraft(
    draft: ZoneEditorDraft | null,
  ): draft is ZoneEditorDraft {
    if (!draft) {
      onStatus("Editor: no draft to save.");
      return false;
    }

    if (!draft.id.trim() || !draft.name.trim() || !draft.description.trim()) {
      onStatus("Editor: id, name and description are required.");
      return false;
    }

    if (draft.shape === "circle") {
      if (
        draft.x === null ||
        draft.y === null ||
        draft.radius === null ||
        draft.radius <= 0
      ) {
        onStatus("Editor: circle requires x, y and radius.");
        return false;
      }
    } else if (draft.points.length < 3) {
      onStatus("Editor: polygon/rect requires at least 3 points.");
      return false;
    }

    return true;
  }

  function upsertZone(nextZone: WorldMapZone) {
    setZones((prev) => [
      ...prev.filter((zone) => zone.id !== nextZone.id),
      nextZone,
    ]);
    setSelectedZoneId(nextZone.id);
    setEditorDraft(createDraftFromZone(nextZone));
  }

  function handleSaveNewZone() {
    if (!validateDraft(editorDraft)) {
      return;
    }

    const duplicate = zones.find((zone) => zone.id === editorDraft.id);
    if (
      duplicate &&
      duplicate.id !== selectedZoneId &&
      !window.confirm(`Zone id ${editorDraft.id} already exists. Replace it?`)
    ) {
      return;
    }

    captureCheckpoint();
    const nextZone = createZoneFromDraft(editorDraft, duplicate?.createdAt);
    upsertZone(nextZone);
    onStatus(`Editor: saved zone ${nextZone.name}.`);
  }

  function handleUpdateSelectedZone() {
    if (!selectedZoneId) {
      onStatus("Editor: no selected zone.");
      return;
    }
    if (!validateDraft(editorDraft)) {
      return;
    }

    const existing = zones.find((zone) => zone.id === selectedZoneId) ?? null;
    captureCheckpoint();
    const nextZone = createZoneFromDraft(editorDraft, existing?.createdAt);
    setZones((prev) => [
      ...prev.filter(
        (zone) => zone.id !== selectedZoneId && zone.id !== nextZone.id,
      ),
      nextZone,
    ]);
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
      onStatus("Editor: no selected zone to duplicate.");
      return;
    }

    captureCheckpoint();
    const duplicated = offsetZone(
      {
        ...source,
        id: `${source.id}_copy`,
        name: `${source.name} Copy`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      0.01,
      0.01,
    );

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
      onStatus("Editor: nothing to delete.");
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
    onStatus("Editor: draft cleared.");
  }

  function handleClearAllZones() {
    if (
      !window.confirm("Delete all zones and painted regions from the editor?")
    ) {
      return;
    }
    captureCheckpoint();
    setZones([]);
    setRegions([]);
    setSelectedZoneId(null);
    setEditorDraft(null);
    setEditorJson("");
    clearZoneStorage();
    replaceAllZones([]);
    setQuestMarkers([]);
    queueEditorSave({ zones: [], regions: [], questMarkers: [] });
    onStatus("Editor: all zones and regions cleared.");
  }

  function handleResetStorage() {
    skipNextZonePersistRef.current = true;
    skipNextSettingsPersistRef.current = true;
    clearZoneStorage();
    clearEditorSettingsStorage();
    const defaultZones = cloneZones(WORLD_MAP_ZONES);
    setZones(defaultZones);
    replaceAllZones(defaultZones);
    setRegions([]);
    setQuestMarkers([]);
    queueEditorSave({ zones: defaultZones, regions: [], questMarkers: [] });
    setEditorSettings(createDefaultEditorSettings());
    setActiveEditorLayer("zones");
    setLayerVisibility(getDefaultLayerVisibilityState());
    setSelectedZoneId(null);
    setEditorDraft(null);
    setValidationErrors([]);
    setHistory(createEmptyHistory());
    setEditorJson(exportEditorDataJson(defaultZones, [], []));
    onStatus("Editor: storage reset to defaults.");
  }

  function handleExportJson() {
    const payload = exportEditorDataJson(zones, regions, questMarkers);
    setEditorJson(payload);
    setValidationErrors([]);
    const downloaded = downloadJsonFile("theend_worldmap", payload);
    onStatus(
      downloaded
        ? "Editor: JSON exported to textarea and file."
        : "Editor: JSON exported to textarea (file download blocked).",
    );
  }

  function handleExportJsonFile() {
    const payload = exportEditorDataJson(zones, regions, questMarkers);
    setEditorJson(payload);
    setValidationErrors([]);
    const downloaded = downloadJsonFile("theend_worldmap", payload);
    onStatus(
      downloaded
        ? "Editor: JSON exported to file."
        : "Editor: file export blocked by browser.",
    );
  }

  async function handleCopyJson(zone: WorldMapZone | null = selectedZone) {
    const payload = zone
      ? JSON.stringify(zone, null, 2)
      : exportEditorDataJson(zones, regions, questMarkers);
    setEditorJson(payload);
    try {
      await navigator.clipboard.writeText(payload);
      onStatus(zone ? `Copied zone JSON: ${zone.id}` : "Copied zones JSON");
    } catch {
      onStatus("Editor: clipboard copy failed, JSON left in textarea.");
    }
  }

  function validateJsonText(text: string) {
    try {
      return validateEditorDataJson(normalizeClipboardText(text));
    } catch {
      return {
        valid: false,
        errors: ["Invalid JSON syntax"],
        zones: [],
        regions: [],
        questMarkers: [],
      };
    }
  }

  function handleValidateJson() {
    const result = validateJsonText(editorJson);
    setValidationErrors(result.errors);
    onStatus(
      result.valid
        ? `JSON valid: ${result.zones.length} zones, ${result.regions.length} regions, ${result.questMarkers.length} quest markers`
        : `JSON invalid: ${result.errors.length} errors`,
    );
  }

  function mergeImportedData(
    importedZones: WorldMapZone[],
    importedRegions: PaintedRegion[],
    importedQuestMarkers: QuestMarkerDefinition[],
  ) {
    const importedIds = new Set(importedZones.map((zone) => zone.id));
    const importedRegionIds = new Set(
      importedRegions.map((region) => region.id),
    );
    const importedQuestMarkerIds = new Set(
      importedQuestMarkers.map((marker) => marker.id),
    );
    const duplicates = zones.filter((zone) => importedIds.has(zone.id));
    const regionDuplicates = regions.filter((region) =>
      importedRegionIds.has(region.id),
    );
    const markerDuplicates = questMarkers.filter((marker) =>
      importedQuestMarkerIds.has(marker.id),
    );
    if (
      (duplicates.length > 0 ||
        regionDuplicates.length > 0 ||
        markerDuplicates.length > 0) &&
      !window.confirm(
        `Replace ${duplicates.length} zones, ${regionDuplicates.length} regions and ${markerDuplicates.length} quest markers with matching ids?`,
      )
    ) {
      return false;
    }

    captureCheckpoint();
    setZones((prev) => [
      ...prev.filter((zone) => !importedIds.has(zone.id)),
      ...importedZones,
    ]);
    setRegions((prev) => [
      ...prev.filter((region) => !importedRegionIds.has(region.id)),
      ...importedRegions,
    ]);
    setQuestMarkers((prev) => [
      ...prev.filter((marker) => !importedQuestMarkerIds.has(marker.id)),
      ...importedQuestMarkers,
    ]);
    setSelectedZoneId(null);
    setEditorDraft(null);
    return true;
  }

  function handleImportJson(sourceText: string = editorJson) {
    const result = validateJsonText(sourceText);
    setValidationErrors(result.errors);
    if (!result.valid) {
      onStatus(`Editor: import failed with ${result.errors.length} errors.`);
      return;
    }

    if (sourceText !== editorJson) {
      setEditorJson(sourceText);
    }

    if (mergeImportedData(result.zones, result.regions, result.questMarkers)) {
      onStatus(
        `Editor: imported ${result.zones.length} zones, ${result.regions.length} regions and ${result.questMarkers.length} quest markers.`,
      );
    }
  }

  async function handlePasteZoneAt(point: [number, number]) {
    try {
      const raw = await navigator.clipboard.readText();
      const result = validateJsonText(raw);
      if (!result.valid) {
        setValidationErrors(result.errors);
        onStatus("Editor: clipboard JSON invalid.");
        return;
      }

      const importedZones = result.zones;
      const anchor =
        importedZones.length === 1
          ? getZoneCenter(importedZones[0])
          : (importedZones
            .reduce(
              (acc, zone) => {
                const center = getZoneCenter(zone);
                return [acc[0] + center[0], acc[1] + center[1]] as [
                  number,
                  number,
                ];
              },
              [0, 0] as [number, number],
            )
            .map((value) => value / importedZones.length) as [
              number,
              number,
            ]);
      const offsetX = point[0] - anchor[0];
      const offsetY = point[1] - anchor[1];
      const shiftedZones = importedZones.map((zone) => ({
        ...offsetZone(zone, offsetX, offsetY),
        id: zones.some((entry) => entry.id === zone.id)
          ? `${zone.id}_${Date.now()}`
          : zone.id,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      }));

      captureCheckpoint();
      setZones((prev) => [...prev, ...shiftedZones]);
      onStatus(`Editor: pasted ${shiftedZones.length} zones.`);
    } catch {
      onStatus("Editor: clipboard paste failed.");
    }
  }

  function handleToggleZoneVisibility(zoneId: string) {
    captureCheckpoint();
    setZones((prev) =>
      prev.map((zone) =>
        zone.id === zoneId
          ? {
            ...zone,
            isVisibleToPlayer: !zone.isVisibleToPlayer,
            updatedAt: Date.now(),
          }
          : zone,
      ),
    );
  }

  function handleSetActiveEditorLayer(layer: MapEditorLayer) {
    if (layer === "passability") {
      setSelectedZoneId(null);
      setEditorDraft(null);
    }
    setActiveEditorLayer(layer);
  }

  function handleCycleLayerVisibility(layer: MapEditorLayer) {
    if (layer === activeEditorLayer) {
      return;
    }

    setLayerVisibility((prev) => {
      const current = prev[layer];
      const next: LayerVisibilityMode = current === "hidden"
        ? "dimmed"
        : current === "dimmed"
          ? "visible"
          : "hidden";

      return {
        ...prev,
        [layer]: next,
      };
    });
  }

  function handleToolChange(tool: ZoneEditorTool) {
    setEditorSettings((prev) => ({ ...prev, selectedTool: tool }));
    if (tool === "circle" || tool === "polygon" || tool === "rectangle") {
      setSelectedZoneId(null);
      setEditorDraft((current) => buildDraftForTool(tool, current, activeEditorLayer));
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
    if (zone) {
      const zoneLayer = zone.editorLayer ?? getDefaultEditorLayer(zone.type);
      if (zoneLayer !== activeEditorLayer) {
        setSelectedZoneId(null);
        setEditorDraft(null);
        return;
      }
    }

    setSelectedZoneId(zone?.id ?? null);
    setEditorDraft(zone ? createDraftFromZone(zone) : null);
  }

  const handleSelectValidationIssue = useCallback(
    (issue: WorldMapValidationIssue) => {
      if (!issue.zoneId) {
        onStatus(issue.message);
        return;
      }

      const zone = zones.find((entry) => entry.id === issue.zoneId) ?? null;
      if (!zone) {
        onStatus(`Объект ${issue.zoneId} не найден.`);
        return;
      }

      const targetLayer =
        issue.editorLayer ?? zone.editorLayer ?? getDefaultEditorLayer(zone.type);
      if (targetLayer !== activeEditorLayer) {
        setActiveEditorLayer(targetLayer);
      }

      setSelectedZoneId(zone.id);
      setEditorDraft(createDraftFromZone(zone));
      canvasRef.current?.focusZone(zone.id);
      onStatus(`Выбран объект: ${zone.name} (${zone.id}).`);
    },
    [activeEditorLayer, onStatus, zones],
  );

  const applyRepairToZoneById = useCallback(
    (zoneId: string, action: WorldMapRepairActionId) => {
      const current = zones.find((entry) => entry.id === zoneId) ?? null;
      if (!current) {
        onStatus(`Невозможно применить исправление: объект ${zoneId} не найден.`);
        return;
      }

      captureCheckpoint();
      const repaired = applyWorldMapRepairAction(current, action);
      setZones((prev) => prev.map((zone) => (zone.id === zoneId ? repaired : zone)));
      if (selectedZoneId === zoneId || editorDraft?.id === zoneId) {
        setEditorDraft(createDraftFromZone(repaired));
        setSelectedZoneId(zoneId);
      }
      onStatus(`Исправление применено к ${repaired.name} (${repaired.id}).`);
    },
    [captureCheckpoint, editorDraft?.id, onStatus, selectedZoneId, zones],
  );

  const handleRepairValidationIssue = useCallback(
    (issue: WorldMapValidationIssue) => {
      if (!issue.repairAction) {
        onStatus("Для этой проблемы авто-исправление недоступно.");
        return;
      }

      if (issue.repairAction === "remove_null_entry") {
        captureCheckpoint();
        setZones((prev) =>
          prev.filter(
            (entry) =>
              Boolean(entry)
              && typeof entry.id === "string"
              && entry.id.trim().length > 0,
          ),
        );
        onStatus("Удалены пустые/повреждённые записи карты.");
        return;
      }

      const zoneId = issue.zoneId ?? selectedZoneId ?? editorDraft?.id ?? null;
      if (!zoneId) {
        onStatus("Невозможно определить объект для исправления.");
        return;
      }

      applyRepairToZoneById(zoneId, issue.repairAction);
    },
    [applyRepairToZoneById, captureCheckpoint, editorDraft?.id, onStatus, selectedZoneId],
  );

  const handleRepairSelectedZoneContract = useCallback(
    (action: WorldMapRepairActionId) => {
      const zoneId = selectedZoneId ?? editorDraft?.id ?? null;
      if (!zoneId) {
        onStatus("Сначала выберите объект карты для исправления.");
        return;
      }

      applyRepairToZoneById(zoneId, action);
    },
    [applyRepairToZoneById, editorDraft?.id, onStatus, selectedZoneId],
  );

  function handleDeleteSelectedPoint() {
    if (!editorDraft || editorDraft.selectedPointIndex === null) {
      return;
    }
    const nextPoints = editorDraft.points.filter(
      (_, index) => index !== editorDraft.selectedPointIndex,
    );
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
    queueEditorSave({ zones, regions, questMarkers });
    saveEditorSettings(editorSettings);
    setAutosaveStatus("saving");
    onStatus("Editor: save queued to backend content store.");
  }

  function handleOpenLocation(locationId: string) {
    if (worldMapMode === "editor") {
      return;
    }
    const zone = zones.find((entry) => entry.id === locationId) ?? null;
    if (zone?.type === "location") {
      const linkedLocation = contentSnapshot
        ? getZoneLinkedLocation(zone, contentSnapshot)
        : null;
      if (!linkedLocation || !isLinkedLocationVisibleToPlayer(linkedLocation)) {
        onStatus("Вы ничего не находите.");
        return;
      }
      if (!canEnterLinkedLocation(linkedLocation)) {
        onStatus("Вы пока не можете войти сюда.");
        return;
      }
      discoverMapEntity("location", linkedLocation.id);
      if (locationHasLocalMap(linkedLocation)) {
        rememberCurrentMapPosition();
        setActiveLocationId(linkedLocation.id);
        setActiveCityId(null);
        setActiveWorldModal(null);
        setLocationView("location");
        setContextMode("location");
        setPlayerState("in_zone");
        onStatus(`Вы вошли в ${linkedLocation.name}.`);
      } else {
        setActiveWorldModal({
          type: "location",
          locationId: linkedLocation.id,
        });
        setContextMode("location");
        setPlayerState("in_zone");
        onStatus(`Вы прибыли к ${linkedLocation.name}.`);
      }
      return;
    }
    const targetScene = zone?.targetScene?.trim().toLowerCase();
    const opensCityScene =
      isCitySceneId(locationId) || isCitySceneId(targetScene);
    if (!opensCityScene) {
      onStatus(`\u041b\u043e\u043a\u0430\u0446\u0438\u044f ${locationId} \u043f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.`);
      return;
    }
    const cityId = normalizeCitySceneId(
      targetScene && isCitySceneId(targetScene) ? targetScene : locationId,
    );
    rememberCurrentMapPosition();
    setActiveCityId(cityId);
    setActiveLocationId(null);
    setActiveWorldModal(null);
    setLocationView("city");
    setContextMode("location");
    setPlayerState("in_city");
    onStatus(`\u0412\u044b \u0432\u043e\u0448\u043b\u0438 \u0432 ${zone?.name ?? "\u0433\u043e\u0440\u043e\u0434"}.`);
  }

  function handleReturnToMap() {
    rememberCurrentMapPosition();
    setActiveCityId(null);
    setActiveLocationId(null);
    setActiveWorldModal(null);
    setLocationView("map");
    setSelectedCityLocationId(null);
    setContextMode(currentZone ? "location" : "empty");
    setPlayerState(currentZone ? "in_zone" : "idle");
  }

  function resetCityTransform() {
    cityDragRef.current = null;
    setCityZoom(MIN_CITY_ZOOM);
    setCityPan({ x: 0, y: 0 });
  }

  function handleCityWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    setCityZoom((current) => Math.max(MIN_CITY_ZOOM, Math.min(MAX_CITY_ZOOM, current * factor)));
  }

  function handleCityPanStart(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    event.preventDefault();
    cityDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: cityPan.x,
      panY: cityPan.y,
    };
  }

  function handleCityPanMove(event: ReactMouseEvent<HTMLDivElement>) {
    const drag = cityDragRef.current;
    if (!drag) {
      return;
    }

    event.preventDefault();
    const limit = 180 * cityZoom;
    setCityPan({
      x: Math.max(-limit, Math.min(limit, drag.panX + event.clientX - drag.startX)),
      y: Math.max(-limit, Math.min(limit, drag.panY + event.clientY - drag.startY)),
    });
  }

  function handleCityPanEnd() {
    cityDragRef.current = null;
  }

  useEffect(() => {
    resetCityTransform();
  }, [activeCityId, activeLocationId, locationView]);

  function handleSendChat() {
    const text = chatDraft.trim();
    if (!text) {
      return;
    }
    const entry: ChatMessage = {
      id: `msg-${Date.now()}`,
      text,
      type: chatType,
    };
    setSystemChat((prev) => [...prev, entry].slice(-12));
    setChatDraft("");
  }

  const toggleSidePanel = useCallback((panel: SidePanelKey) => {
    setCollapsedSidePanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  }, []);

  const renderSidePanel = useCallback(
    (panel: SidePanelKey, title: string, content: React.ReactNode) => {
      const isCollapsed = collapsedSidePanels[panel];
      return (
        <section
          className={`wm-side-module ${isCollapsed ? "is-collapsed" : ""}`}
        >
          <button
            type="button"
            className="wm-side-module-toggle"
            aria-expanded={!isCollapsed}
            onClick={() => toggleSidePanel(panel)}
          >
            <span>{title}</span>
            <span className="wm-side-module-caret" aria-hidden="true">
              {isCollapsed ? ">" : "v"}
            </span>
          </button>
          {!isCollapsed ? (
            <div className="wm-side-module-body">{content}</div>
          ) : null}
        </section>
      );
    },
    [collapsedSidePanels, toggleSidePanel],
  );

  function handleCityLocation(location: CityLocation) {
    discoverMapEntity("location", location.id);
    setSelectedCityLocationId(location.id);
    setNpcQuestSceneModal(null);
    setActiveWorldModal({
      type: "location",
      locationId: location.id,
    });
    dialogueRunner.closeDialogue();
    setContextMode("location");

    const triggers = location.autoTriggers ?? [];
    if (triggers.length === 0) {
      return;
    }

    const activeQuestIds = playerQuestStates
      .filter((entry) => entry.status === "active")
      .map((entry) => entry.questId);
    const completedQuestIds = playerQuestStates
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.questId);
    const itemIds = inventory.items
      .filter((entry) => entry.quantity > 0)
      .map((entry) => entry.itemId);

    const player = {
      activeQuestIds,
      completedQuestIds,
      itemIds,
    };

    for (const trigger of triggers) {
      const npcId = String(trigger?.npcId ?? "").trim();
      const dialogueId = String(trigger?.dialogueId ?? "").trim();
      if (!npcId || !dialogueId) {
        continue;
      }

      if (!evaluateLocationAutoTriggerCondition(trigger.condition, player)) {
        continue;
      }

      const triggerKey = createLocationAutoTriggerKey({
        locationId: location.id,
        npcId,
        dialogueId,
      });

      if (trigger.once && hasTriggeredLocationAutoTrigger(character.id, triggerKey)) {
        continue;
      }

      if (trigger.once) {
        markLocationAutoTriggerTriggered(character.id, triggerKey);
      }

      dialogueRunner.openDialogue(dialogueId, {
        npcId,
        cityId: activeCity?.id,
        locationId: location.id,
        sourceType: "location",
      });
      break;
    }
  }

  const activeWorldModalElement = (() => {
    if (!activeWorldModal) {
      return null;
    }

    const modalCityLocation =
      activeCity?.locations.find(
        (location) =>
          activeWorldModal.type !== "zone" &&
          "locationId" in activeWorldModal &&
          location.id === activeWorldModal.locationId,
      ) ?? null;
    const modalWorldLocation =
      activeWorldModal.type !== "zone" && "locationId" in activeWorldModal
        ? (contentSnapshot?.locations.find(
          (location) => location.id === activeWorldModal.locationId,
        ) ?? null)
        : null;
    const modalLocation = modalCityLocation ?? modalWorldLocation;
    const closeModal = () => {
      setActiveWorldModal(null);
      setExpandedMineZoneId(null);
      dialogueRunner.closeDialogue();
    };


    let portrait: string | undefined;
    let title = "";
    let subtitle: string | undefined;
    let description: string | undefined;
    let content: React.ReactNode = null;
    let buttons: React.ReactNode = null;
    const cardWidth =
      activeWorldModal.type === "location" ? "min(760px, 100%)" : "min(520px, 100%)";

    if (activeWorldModal.type === "merchant") {
      const merchant = merchantById.get(activeWorldModal.merchantId) ?? null;
      portrait = resolveMerchantImage?.(merchant);
      title = merchant?.name ?? activeWorldModal.merchantId;
      description = merchant?.description ?? modalLocation?.description;
      buttons = (
        <>
          <button
            onClick={() => {
              closeModal();
              onOpenMerchant(merchant?.id ?? activeWorldModal.merchantId);
            }}
          >
            {"\u0422\u043e\u0440\u0433\u043e\u0432\u0430\u0442\u044c"}
          </button>
          <button onClick={closeModal}>{"\u0423\u0439\u0442\u0438"}</button>
        </>
      );
    } else if (activeWorldModal.type === "npc") {
      const npc = npcs.find((entry) => entry.id === activeWorldModal.npcId) ?? null;
      portrait = resolveNpcPortrait(npc);
      title = npc?.name ?? activeWorldModal.npcId;
      subtitle = npc?.title;
      description = npc?.description;
      const canTalk = Boolean(npc?.canTalk);
      const canQuest = Boolean(
        npc?.canGiveQuests ||
        npc?.questBindings.length ||
        modalLocation?.questIds?.length,
      );
      const canTrain = Boolean(npc?.canTrain);
      const canTrade = Boolean(npc?.canTrade);
      const npcReaction = npc ? resolveNpcReaction(npc) : null;

      const canOpenDialogue = (npcReaction?.canTalk ?? canTalk) || canQuest;
      buttons = (
        <>
          {canOpenDialogue ? (
            <button
              onClick={() =>
                openNpcDialogue(activeWorldModal.npcId, {
                  cityId: activeCity?.id,
                  locationId: activeWorldModal.locationId,
                })
              }
            >
              {"\u0417\u0430\u0433\u043e\u0432\u043e\u0440\u0438\u0442\u044c"}
            </button>
          ) : null}
          {canTrain && (npcReaction?.canTrain ?? true) ? (
            <button
              onClick={() => {
                console.debug("[NPC CARD] training clicked", {
                  npcId: npc?.id,
                  npcName: npc?.name,
                  canTrain: npc?.canTrain,
                  trainerSkillIds: resolveNpcTrainerSkillIds(npc),
                });
                closeModal();
                openTrainingForNpc(npc);
              }}
            >
              {"\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430"}
            </button>
          ) : null}
          {canTrade ? (
            <button
              disabled={npcReaction ? !npcReaction.canTrade : false}
              onClick={() => {
                if (npcReaction && !npcReaction.canTrade) {
                  onStatus(fixMojibake(npcReaction.summary, "Торговец не хочет иметь с вами дело."));
                  return;
                }
                const traderId = npc?.traderId?.trim();
                if (!traderId) {
                  onStatus(
                    "\u0423 NPC \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d trader profile.",
                  );
                  return;
                }
                closeModal();
                onOpenMerchant(traderId);
              }}
            >
              {"\u0422\u043e\u0440\u0433\u043e\u0432\u0430\u0442\u044c"}
            </button>
          ) : null}
          {npc?.canFight ? (
            <button
              onClick={() => {
                closeModal();
                void onStartCombat();
              }}
            >
              {"\u0410\u0442\u0430\u043a\u043e\u0432\u0430\u0442\u044c"}
            </button>
          ) : null}
          <button
            onClick={() => {
              onStatus(
                `${npc?.name ?? "NPC"}: ${npc?.description || "\u0431\u0435\u0437 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f"}${npcReaction?.summary ? ` ${npcReaction.summary}` : ""}`,
              );
            }}
          >
            {"\u041e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c"}
          </button>
          <button onClick={closeModal}>{"\u0423\u0439\u0442\u0438"}</button>
        </>
      );
    } else if (activeWorldModal.type === "bandit_encounter") {
      title = "Засада бандитов";
      subtitle = `${activeWorldModal.enemyCount} противников`;
      description = `${activeWorldModal.introLine} ${activeWorldModal.demandLine}`;

      const startBanditCombat = () => {
        void onStartCombat(
          HOSTILE_BANDIT_BATTLE_MAP_ID,
          activeWorldModal.customEnemies && activeWorldModal.customEnemies.length > 0
            ? { customEnemies: activeWorldModal.customEnemies }
            : { enemyCount: activeWorldModal.enemyCount },
        );
      };

      content = (
        <div style={{ marginTop: 16, display: "grid", gap: 8, textAlign: "left" }}>
          <div className="wm-stat-block">
            <div><strong>Требуемая сумма:</strong> {activeWorldModal.demandGold} золота (15%)</div>
            <div><strong>Шанс побега:</strong> {activeWorldModal.escapeChancePercent}%</div>
          </div>
        </div>
      );

      buttons = (
        <>
          <button
            disabled={Math.max(0, Math.floor(readNumberStorage(PLAYER_GOLD_STORAGE_KEY, inventory.gold ?? 0))) < activeWorldModal.demandGold}
            onClick={() => {
              const currentGold = Math.max(0, Math.floor(readNumberStorage(PLAYER_GOLD_STORAGE_KEY, inventory.gold ?? 0)));
              if (currentGold < activeWorldModal.demandGold) {
                onStatus('У вас недостаточно золота, чтобы откупиться.');
                return;
              }
              writeNumberStorage(PLAYER_GOLD_STORAGE_KEY, Math.max(0, currentGold - activeWorldModal.demandGold));
              onRuntimeInventoryChanged?.();
              closeModal();
              onStatus(`Вы заплатили ${activeWorldModal.demandGold} золота. Бандиты пропустили вас без боя.`);
            }}
          >
            Заплатить
          </button>
          <button
            onClick={() => {
              closeModal();
              onStatus('Вы решили атаковать бандитов.');
              startBanditCombat();
            }}
          >
            Атаковать
          </button>
          <button
            onClick={() => {
              const roll = Math.random() * 100;
              const escaped = roll < activeWorldModal.escapeChancePercent;
              closeModal();
              if (escaped) {
                onStatus(`Побег удался (${Math.round(activeWorldModal.escapeChancePercent)}% шанс). Вы ушли от бандитов.`);
                return;
              }
              onStatus(`Побег провалился (${Math.round(activeWorldModal.escapeChancePercent)}% шанс). Бандиты навязали бой.`);
              startBanditCombat();
            }}
          >
            Сбежать
          </button>
        </>
      );
    } else if (activeWorldModal.type === "encounter") {
      title = modalLocation?.name ?? activeWorldModal.locationId;
      description = modalLocation?.description;

      const encounter = modalCityLocation?.encounter;
      const legacyBattleMapId = modalCityLocation?.linkedBattleMapId?.trim() || null;
      const battleMapIds = [
        ...(encounter?.battleMapIds ?? []),
        ...(legacyBattleMapId ? [legacyBattleMapId] : []),
      ]
        .map((entry) => String(entry).trim())
        .filter(Boolean);
      const uniqueBattleMapIds = Array.from(new Set(battleMapIds));
      const presets = (encounter?.presets ?? []).filter(
        (preset: { id?: string; label?: string } | null | undefined) =>
          Boolean(preset?.id && preset?.label),
      );

      const startBattleMap = async (battleMapId?: string | null) => {
        closeModal();
        if (battleMapId && onStartBattleMap) {
          await onStartBattleMap(battleMapId);
          return;
        }
        await onStartCombat();
      };

      buttons = (
        <>
          {presets.length > 0 ? (
            presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  void startBattleMap(preset.battleMapId ?? uniqueBattleMapIds[0] ?? null);
                  onStatus(`Starting encounter: ${preset.label}`);
                }}
              >
                {preset.label}
              </button>
            ))
          ) : uniqueBattleMapIds.length > 0 ? (
            uniqueBattleMapIds.map((battleMapId, index) => (
              <button
                key={battleMapId}
                onClick={() => {
                  void startBattleMap(battleMapId);
                  onStatus(`Starting encounter from ${title}.`);
                }}
              >
                {uniqueBattleMapIds.length > 1 ? `Войти (${index + 1})` : "Войти"}
              </button>
            ))
          ) : (
            <button
              onClick={() => {
                void startBattleMap(null);
                onStatus(`Starting encounter from ${title}.`);
              }}
            >
              {"Войти"}
            </button>
          )}

          {encounter?.allowPvP ? (
            <button
              onClick={() => {
                closeModal();
                setPvpBrowserOpen(true);
                setPvpLoading(true);
                setPvpError(null);
                fetchNearbyPvpPlayers(character.id)
                  .then((players) => {
                    setPvpPlayers(players);
                  })
                  .catch((error) => {
                    setPvpError((error as Error).message);
                    setPvpPlayers([]);
                  })
                  .finally(() => {
                    setPvpLoading(false);
                  });
              }}
            >
              {"PvP"}
            </button>
          ) : null}

          <button onClick={closeModal}>{"\u0423\u0439\u0442\u0438"}</button>
        </>
      );
    } else if (activeWorldModal.type === "location") {
      title = modalLocation?.name ?? activeWorldModal.locationId;
      description = modalLocation?.description;

      const locationNpcIds = modalLocation?.npcIds ?? [];
      const locationNpcs = locationNpcIds
        .map((npcId) => npcById.get(npcId))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const locationShopIds =
        modalCityLocation?.shopIds
        ?? modalWorldLocation?.merchantIds
        ?? [];
      const locationMerchants = locationShopIds
        .map((merchantId) => merchantById.get(merchantId) ?? null)
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const hasPeople = locationNpcs.length > 0 || locationMerchants.length > 0;
      content = (
        <div style={{ display: "grid", gap: 16, margin: "18px auto 0", maxWidth: 640 }}>
          {locationNpcs.length > 0 ? (
            <div>
              <div className="muted" style={{ marginBottom: 8, textAlign: "left" }}>
                Персонажи
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
                  gap: 10,
                }}
              >
                {locationNpcs.map((npc) => {
                  const npcPortrait = resolveNpcPortrait(npc);
                  const questMarker = npcQuestMarkerById.get(npc.id) ?? null;
                  return (
                    <button
                      key={npc.id}
                      type="button"
                      className="btn"
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        display: "grid",
                        gap: 8,
                        justifyItems: "center",
                      }}
                      onClick={() => {
                        dialogueRunner.closeDialogue();
                        setActiveWorldModal({
                          type: "npc",
                          locationId: modalLocation?.id ?? activeWorldModal.locationId,
                          npcId: npc.id,
                        });
                        setContextMode("npc");
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 72,
                          height: 72,
                          borderRadius: 10,
                          border: "1px solid #8b6a3f",
                          overflow: "hidden",
                          background: "rgba(0, 0, 0, 0.35)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {questMarker ? (
                          <span
                            aria-hidden="true"
                            title={questMarker === "progress" ? "Есть активный квестовый прогресс" : "Доступен новый квест"}
                            style={{
                              position: "absolute",
                              top: -8,
                              right: -6,
                              minWidth: 24,
                              height: 24,
                              padding: "0 6px",
                              borderRadius: 999,
                              border: "1px solid rgba(228, 186, 113, 0.9)",
                              background: questMarker === "progress"
                                ? "radial-gradient(circle at 30% 30%, rgba(225, 244, 203, 0.98), rgba(128, 163, 91, 0.96))"
                                : "radial-gradient(circle at 30% 30%, rgba(255, 241, 201, 0.98), rgba(168, 123, 44, 0.96))",
                              color: questMarker === "progress" ? "#1d2812" : "#2b1a0a",
                              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 15,
                              fontWeight: 800,
                              lineHeight: 1,
                              textShadow: "none",
                              pointerEvents: "none",
                              zIndex: 1,
                            }}
                          >
                            {questMarker === "progress" ? "?" : "!"}
                          </span>
                        ) : null}
                        {npcPortrait ? (
                          <img
                            src={npcPortrait}
                            alt={npc.name ?? npc.id}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span className="muted">{(npc.name ?? npc.id).charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.1 }}>{npc.name ?? npc.id}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {locationMerchants.length > 0 ? (
            <div>
              <div className="muted" style={{ marginBottom: 8, textAlign: "left" }}>
                Торговцы
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
                  gap: 10,
                }}
              >
                {locationMerchants.map((merchant) => {
                  const merchantPortrait = resolveMerchantImage?.(merchant);
                  return (
                    <button
                      key={merchant.id}
                      type="button"
                      className="btn"
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        display: "grid",
                        gap: 8,
                        justifyItems: "center",
                      }}
                      onClick={() => {
                        dialogueRunner.closeDialogue();
                        setActiveWorldModal({
                          type: "merchant",
                          locationId: modalLocation?.id ?? activeWorldModal.locationId,
                          merchantId: merchant.id,
                        });
                        setContextMode("location");
                      }}
                    >
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 10,
                          border: "1px solid #8b6a3f",
                          overflow: "hidden",
                          background: "rgba(0, 0, 0, 0.35)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {merchantPortrait ? (
                          <img
                            src={merchantPortrait}
                            alt={merchant.name ?? merchant.id}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span className="muted">{(merchant.name ?? merchant.id).charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.1 }}>{merchant.name ?? merchant.id}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {!hasPeople ? <div className="muted">Здесь никого нет.</div> : null}
        </div>
      );

      const battleMapId =
        modalCityLocation?.linkedBattleMapId?.trim()
        || modalWorldLocation?.battleMapIds?.[0]?.trim()
        || null;
      const hasEncounter = Boolean(modalCityLocation?.encounter) || Boolean(battleMapId);
      buttons = (
        <>
          {hasEncounter ? (
            <button
              onClick={() => {
                closeModal();
                if (modalCityLocation?.encounter || battleMapId) {
                  setActiveWorldModal({
                    type: "encounter",
                    locationId: modalLocation?.id ?? activeWorldModal.locationId,
                  });
                  setContextMode("location");
                  return;
                }
              }}
            >
              {"\u0412\u043e\u0439\u0442\u0438"}
            </button>
          ) : null}
          <button onClick={closeModal}>{"\u0423\u0439\u0442\u0438"}</button>
        </>
      );
    } else if (activeWorldModal.type === "zone") {
      const worldZone = zones.find((z) => z.id === activeWorldModal.zoneId) ?? null;
      title = worldZone?.name ?? activeWorldModal.zoneId;
      description = worldZone?.description || undefined;
      const linkedMine = isMineResourceZone(worldZone) ? findMineById(worldZone.mineId) : null;
      const isMineZone = isMineResourceZone(worldZone);

      const zoneInteractions = questInteractions.filter(
        (qi) => qi.triggerType === "zone_inspect" && qi.zoneId === activeWorldModal.zoneId,
      );
      const questRuntimePlayer = {
        id: character.id,
        level: character.level,
        race: character.race,
        ...questRuntimeProfessionCompat,
        itemIds: inventory.items.filter((item) => item.quantity > 0).map((item) => item.itemId),
      };

      const mineDetailsVisible = isMineZone && expandedMineZoneId === worldZone?.id;
      const mineKnownResources = linkedMine
        ? [...(linkedMine.knownResourceItemIds ?? []), ...(linkedMine.knownMaterialIds ?? [])].filter(Boolean)
        : [];
      content = (
        <div style={{ marginTop: 16, display: "grid", gap: 10, textAlign: "left" }}>
          {isMineZone ? (
            <>
              <div className="wm-stat-block">
                <div><strong>Mine ID:</strong> {worldZone.mineId}</div>
                <div><strong>Profession:</strong> {worldZone.professionId?.trim() || 'mining'}</div>
                {worldZone.requiredLevel ? <div><strong>Required level:</strong> {worldZone.requiredLevel}</div> : null}
              </div>
              {mineDetailsVisible ? (
                <div className="wm-stat-block">
                  <div><strong>Name:</strong> {linkedMine?.name ?? worldZone.name}</div>
                  <div><strong>Region:</strong> {linkedMine?.region || worldZone.region || '-'}</div>
                  <div><strong>Depths:</strong> {linkedMine?.depthIds.length ?? 0}</div>
                  <div><strong>Required mining level:</strong> {linkedMine?.requiredMiningLevel ?? worldZone.requiredLevel ?? 1}</div>
                  <div><strong>Known resources:</strong> {mineKnownResources.length > 0 ? mineKnownResources.join(', ') : '-'}</div>
                  <div style={{ marginTop: 6 }}>{linkedMine?.description || worldZone.tooltip || worldZone.description || 'No additional information.'}</div>
                </div>
              ) : null}
            </>
          ) : null}
          {zoneInteractions.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {zoneInteractions.map((qi) => (
                <button
                  key={qi.id}
                  className="btn"
                  onClick={() => {
                    const choices = getAvailableQuestInteractionChoices(qi, questRuntimePlayer);
                    setActiveInteraction(qi);
                    setActiveInteractionChoices(choices);
                    closeModal();
                  }}
                >
                  {qi.title || qi.id}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      );

      if (worldZone?.dangerLevel && worldZone.dangerLevel > 0) {
        subtitle = `Уровень опасности: ${worldZone.dangerLevel}`;
      }
      if (worldZone?.recommendedLevel) {
        subtitle = `${subtitle ? subtitle + " | " : ""}Рек. уровень: ${worldZone.recommendedLevel}`;
      }

      buttons = isMineZone ? (
        <>
          <button
            onClick={() => {
              if (!worldZone || !isMineResourceZone(worldZone)) {
                return;
              }
              const mineError = resolveMineZoneOpenError(worldZone);
              if (mineError) {
                onStatus(mineError);
                return;
              }
              closeModal();
              openMine(worldZone.mineId);
            }}
          >
            {"\u0412\u043e\u0439\u0442\u0438"}
          </button>
          <button
            onClick={() => {
              if (!worldZone) {
                return;
              }
              setExpandedMineZoneId((current) => current === worldZone.id ? null : worldZone.id);
            }}
          >
            {mineDetailsVisible ? 'Скрыть' : 'Осмотреть'}
          </button>
          <button onClick={closeModal}>{"\u0423\u0439\u0442\u0438"}</button>
        </>
      ) : <button onClick={closeModal}>{"\u0417\u0430\u043a\u0440\u044b\u0442\u044c"}</button>;
    } else {
      const _exhaustive: never = activeWorldModal;
      title = modalLocation?.name ?? String((_exhaustive as any)?.locationId ?? "");
      description = modalLocation?.description;
      buttons = <button onClick={closeModal}>{"\u0423\u0439\u0442\u0438"}</button>;
    }
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(0, 0, 0, 0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          className="card"
          style={{
            width: cardWidth,
            padding: 24,
            textAlign: "center",
          }}
        >
          {portrait ? (
            <div
              style={{
                width: 220,
                height: 260,
                margin: "0 auto 18px",
                border: "1px solid #8b6a3f",
                borderRadius: 8,
                overflow: "hidden",
                background: "rgba(0, 0, 0, 0.35)",
              }}
            >
              <img
                src={portrait}
                alt={title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          ) : null}

          <h2 style={{ margin: "0 0 12px" }}>{title}</h2>
          {subtitle ? (
            <p className="muted" style={{ margin: "0 auto 12px", maxWidth: 380 }}>
              {subtitle}
            </p>
          ) : null}
          {description?.trim() ? (
            <p className="muted" style={{ margin: "0 auto 20px", maxWidth: 640 }}>
              {description.trim()}
            </p>
          ) : null}

          {content}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "min(260px, 100%)",
              margin: "0 auto",
            }}
          >
            {buttons}
          </div>
        </div>
      </div>
    );
  })();

  const pvpBrowserElement = (() => {
    if (!pvpBrowserOpen) {
      return null;
    }

    const close = () => {
      setPvpBrowserOpen(false);
      setPvpError(null);
      setPvpPlayers([]);
      setPvpLoading(false);
    };

    const startChallenge = async (target: NearbyPvpPlayer) => {
      try {
        setPvpLoading(true);
        setPvpError(null);
        const result = await challengePvpPlayer({
          challengerId: character.id,
          targetId: target.characterId,
        });
        const enemy: CustomArenaNpcPayload = result.customEnemy;
        close();
        onStatus(`PvP skeleton: бой против ${target.name}.`);
        void onStartCombat(undefined, { customEnemies: [enemy] });
      } catch (error) {
        setPvpError((error as Error).message);
      } finally {
        setPvpLoading(false);
      }
    };

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0, 0, 0, 0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="card" style={{ width: "min(720px, 100%)", padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>PvP</h2>
            <button onClick={close}>Закрыть</button>
          </div>

          <p className="muted" style={{ marginTop: 10 }}>
            Skeleton режим: PvP пока запускает бой против слепка персонажа (как arena enemy).
          </p>

          {pvpError ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Ошибка: {pvpError}
            </p>
          ) : null}

          {pvpLoading ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Загрузка...
            </p>
          ) : null}

          {!pvpLoading && pvpPlayers.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Рядом никого нет (пока). Создайте второго персонажа или откройте игру в другом аккаунте.
            </p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
            {pvpPlayers.map((player) => (
              <div
                key={player.characterId}
                className="card"
                style={{
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <strong>{player.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {player.race} • lvl {player.level}
                  </div>
                </div>
                <button disabled={pvpLoading} onClick={() => void startChallenge(player)}>
                  Вызвать
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  })();

  const randomEventModalElement = (() => {
    if (!randomEventModal) {
      return null;
    }

    const close = () => setRandomEventModal(null);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0, 0, 0, 0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="card" style={{ width: "min(620px, 100%)", padding: 18, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 10px" }}>Случайное событие</h2>
          <p className="muted" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
            Зона: {randomEventModal.zoneName}
          </p>
          <h3 style={{ margin: "10px 0 10px" }}>{randomEventModal.questTitle}</h3>
          {randomEventModal.questText.trim() ? (
            <p className="muted" style={{ margin: "0 auto 16px", maxWidth: 520 }}>
              {randomEventModal.questText.trim()}
            </p>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "min(280px, 100%)", margin: "0 auto" }}>
            <button
              onClick={() => {
                close();
                setQuestJournalOpen(true);
              }}
            >
              Открыть журнал
            </button>
            <button onClick={close}>Продолжить</button>
          </div>
        </div>
      </div>
    );
  })();

  const npcQuestSceneModalElement = (() => {
    if (!npcQuestSceneModal) {
      return null;
    }

    const npc = npcs.find((entry) => entry.id === npcQuestSceneModal.npcId) ?? null;
    const activeStage =
      npcQuestSceneModal.stages.find((stage) => stage.questId === npcQuestSceneModal.selectedQuestId) ??
      npcQuestSceneModal.stages[0] ??
      null;

    const questState = activeStage
      ? playerQuestStates.find((state) => state.playerId === character.id && state.questId === activeStage.questId) ?? null
      : null;

    const questDefinition = activeStage
      ? questDefinitions.find((quest) => quest.id === activeStage.questId) ?? null
      : null;

    const stepDefinition = (() => {
      if (!questDefinition || !questState) {
        return null;
      }
      const steps = questDefinition.steps ?? [];
      const stepId = questState.currentStepId ?? steps[0]?.id ?? null;
      if (!stepId) {
        return null;
      }
      return steps.find((step) => step.id === stepId) ?? null;
    })();

    const canTurnIn = (() => {
      if (!questState || !stepDefinition) {
        return false;
      }
      const requiredObjectiveIds = (stepDefinition.objectives ?? [])
        .filter((objective) => !objective.isOptional)
        .map((objective) => objective.id);
      if (requiredObjectiveIds.length === 0) {
        return true;
      }
      return requiredObjectiveIds.every((objectiveId) => questState.completedObjectiveIds.includes(objectiveId));
    })();

    const close = () => setNpcQuestSceneModal(null);

    const openQuestDialogue = () => {
      if (!activeStage) {
        close();
        return;
      }
      const npcId = npcQuestSceneModal.npcId;
      const context = {
        cityId: activeCity?.id,
        locationId: npc?.cityLocationId ?? npc?.locationId ?? undefined,
        questId: activeStage.questId,
      };
      close();
      dialogueRunner.openDialogueForNpc(npcId, context);
    };

    const turnInQuestStage = () => {
      if (!activeStage || !questState) {
        close();
        return;
      }

      close();

      try {
        const before = questState;
        const next = advanceQuest(character.id, activeStage.questId);

        setPlayerQuestStates(
          getAllPlayerQuestStates().filter((entry) => entry.playerId === character.id),
        );

        const questTitle = questDefinition?.title ?? activeStage.questTitle ?? activeStage.questId;

        if (next.status === "completed") {
          const rewards = applyQuestRewards(character.id, activeStage.questId);
          const lines: ChatMessage[] = [];
          const now = Date.now();
          lines.push({
            id: `sys-quest-complete-${now}-${activeStage.questId}`,
            text: `Квест завершён: ${questTitle}`,
            type: "system",
          });
          if (rewards.applied && rewards.rewards.length > 0) {
            rewards.rewards.slice(0, 6).forEach((reward, index) => {
              lines.push({
                id: `sys-quest-reward-${now}-${activeStage.questId}-${index}`,
                text: `Награда: ${reward}`,
                type: "system",
              });
            });
          }
          setSystemChat((prev) => [...prev, ...lines].slice(-12));
          onStatus(`Квест завершён: ${questTitle}`);
          return;
        }

        if (next.currentStepId !== before.currentStepId) {
          setSystemChat((prev) =>
            [
              ...prev,
              {
                id: `sys-quest-advanced-${Date.now()}-${activeStage.questId}`,
                text: `Квест обновлён: ${questTitle}`,
                type: "system" as const,
              },
            ].slice(-12),
          );
          onStatus(`Квест обновлён: ${questTitle}`);
          return;
        }

        onStatus("Квест пока нельзя сдать: не все цели выполнены.");
      } catch (error) {
        onStatus(`Ошибка сдачи квеста: ${(error as Error).message}`);
      }
    };

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0, 0, 0, 0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="card" style={{ width: "min(720px, 100%)", padding: 18, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 10px" }}>{npcQuestSceneModal.npcName}</h2>
          <p className="muted" style={{ margin: "0 auto 12px", maxWidth: 560 }}>
            Квестовый этап
          </p>

          {npcQuestSceneModal.portrait ? (
            <div
              style={{
                width: 220,
                height: 260,
                margin: "0 auto 14px",
                border: "1px solid #8b6a3f",
                borderRadius: 8,
                overflow: "hidden",
                background: "rgba(0, 0, 0, 0.35)",
              }}
            >
              <img
                src={npcQuestSceneModal.portrait}
                alt={npcQuestSceneModal.npcName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ) : null}

          {npcQuestSceneModal.stages.length > 1 ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", margin: "12px 0" }}>
              {npcQuestSceneModal.stages.map((stage) => (
                <button
                  key={`${stage.questId}:${stage.stepTitle ?? stage.questTitle}`}
                  className={stage.questId === npcQuestSceneModal.selectedQuestId ? "is-active" : ""}
                  onClick={() =>
                    setNpcQuestSceneModal((prev) =>
                      prev ? { ...prev, selectedQuestId: stage.questId } : prev,
                    )
                  }
                >
                  {stage.questTitle}
                </button>
              ))}
            </div>
          ) : null}

          {activeStage ? (
            <div className="card" style={{ padding: 12, margin: "0 auto 14px", maxWidth: 620, textAlign: "left" }}>
              <strong>{activeStage.questTitle}</strong>
              {activeStage.stepTitle ? (
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  Шаг: {activeStage.stepTitle}
                </p>
              ) : null}
              {activeStage.journalText ? (
                <p className="muted" style={{ margin: "8px 0 0" }}>
                  {activeStage.journalText}
                </p>
              ) : null}

              {activeStage.objectives.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  {activeStage.objectives.map((obj) => (
                    <p key={obj.id || `${obj.text}:${obj.completed ? "done" : "todo"}`} className="muted" style={{ margin: "6px 0" }}>
                      {obj.completed ? "✓" : "•"} {obj.text}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "min(280px, 100%)", margin: "0 auto" }}>
            {canTurnIn ? (
              <button onClick={turnInQuestStage}>Сдать / получить награду</button>
            ) : (
              <button onClick={openQuestDialogue}>Продолжить</button>
            )}
            <button
              onClick={() => {
                close();
                setQuestJournalOpen(true);
              }}
            >
              Открыть журнал
            </button>
            <button onClick={close}>Назад</button>
          </div>
        </div>
      </div>
    );
  })();

  const dialogueModalElement = (() => {
    if (!dialogueRunner.state.isOpen) {
      return null;
    }

    const context = dialogueRunner.state.context;
    const contextNpc =
      context.npcId
        ? resolveNpcById(context.npcId)
        : null;
    const currentNode = dialogueRunner.node;

    const speakerName =
      currentNode?.speaker === "player"
        ? character.name
        : currentNode?.speaker === "system"
          ? "\u0421\u0438\u0441\u0442\u0435\u043c\u0430"
          : contextNpc?.name ?? context.npcId ?? "\u041d\u041f\u0421";

    const title = speakerName;
    const subtitle = dialogueRunner.dialogue
      ? `\u0414\u0438\u0430\u043b\u043e\u0433: ${dialogueRunner.dialogue.title}`
      : "\u0414\u0438\u0430\u043b\u043e\u0433";

    const portrait =
      currentNode?.imageUrl ??
      currentNode?.portraitUrl ??
      (currentNode?.speaker === "player"
        ? playerAvatarUrl
        : resolveNpcPortrait(contextNpc));

    const description =
      currentNode?.text ||
      dialogueRunner.state.error ||
      "\u0414\u0438\u0430\u043b\u043e\u0433 \u043d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.";

    const backToNpcMenu =
      activeWorldModal?.type === "npc" &&
      Boolean(context.npcId) &&
      activeWorldModal.npcId === context.npcId;

    const closeDialogue = () => {
      dialogueRunner.closeDialogue();
    };

    const leaveInteraction = () => {
      dialogueRunner.closeDialogue();
      if (backToNpcMenu) {
        setActiveWorldModal(null);
      }
    };

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0, 0, 0, 0.72)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          className="card"
          style={{
            width: "min(560px, 100%)",
            padding: 24,
            textAlign: "center",
          }}
        >
          {portrait ? (
            <div
              style={{
                width: 220,
                height: 260,
                margin: "0 auto 18px",
                border: "1px solid #8b6a3f",
                borderRadius: 8,
                overflow: "hidden",
                background: "rgba(0, 0, 0, 0.35)",
              }}
            >
              <img
                src={portrait}
                alt={title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          ) : null}

          <h2 style={{ margin: "0 0 12px" }}>{title}</h2>
          <p className="muted" style={{ margin: "0 auto 12px", maxWidth: 420 }}>
            {subtitle}
          </p>

          {description?.trim() ? (
            <p className="muted" style={{ margin: "0 auto 20px", maxWidth: 420 }}>
              {description.trim()}
            </p>
          ) : null}

          {dialogueRunner.state.error ? (
            <p className="muted" style={{ margin: "0 auto 12px", maxWidth: 420 }}>
              {dialogueRunner.state.error}
            </p>
          ) : null}
          {dialogueRunner.state.notice ? (
            <p className="muted" style={{ margin: "0 auto 12px", maxWidth: 420 }}>
              {dialogueRunner.state.notice}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "min(300px, 100%)",
              margin: "0 auto",
            }}
          >
            {dialogueRunner.choices.map((choice) => (
              <button
                key={getDialogueChoiceKey(choice)}
                disabled={choice.disabled}
                onClick={() => handleSelectDialogueChoice(choice.id)}
              >
                {choice.text || choice.id}
              </button>
            ))}
            {backToNpcMenu ? (
              <button onClick={closeDialogue}>{"\u041d\u0430\u0437\u0430\u0434"}</button>
            ) : (
              <button onClick={closeDialogue}>{"\u0417\u0430\u043a\u0440\u044b\u0442\u044c"}</button>
            )}
            {backToNpcMenu ? (
              <button onClick={leaveInteraction}>{"\u0423\u0439\u0442\u0438"}</button>
            ) : null}
          </div>
        </div>
      </div>
    );
  })();

  const miningModalElement = (() => {
    if (!activeMineRun && !activeMineLoading) {
      return null;
    }

    if (activeMineLoading || !activeMineRun) {
      return (
        <div className="battle-overlay" role="dialog" aria-modal="true">
          <section className="card battle-window wm-modal">
            <div className="battle-window-head">
              <h2>Горняк / Горянка</h2>
              <button onClick={closeMine}>×</button>
            </div>
            <p className="muted">Подготавливаем шахту...</p>
          </section>
        </div>
      );
    }

    const mine = findMineById(activeMineRun.mineId);
    const depth = findMineDepthById(activeMineRun.currentDepthId);
    const miningProfession = getPlayerProfession(questRuntimeProfessionCompat.professions ?? { professions: [] }, 'mining');
    const activeMiningSkillDefs = [
      {
        id: 'mining_stone_hearing',
        name: 'Каменный слух',
        description: 'Моментально раскрывает подсказку выбранного блока.',
        iconUrl: '/art/mining-skills/Каменный слух.png',
      },
      {
        id: 'mining_careful_strike',
        name: 'Осторожный удар',
        description: 'Выполняет более бережный удар по выбранному блоку.',
        iconUrl: '/art/mining-skills/Осторожный удар.png',
      },
      {
        id: 'mining_soft_strike',
        name: 'Мягкий удар',
        description: 'Сильно снижает риск повредить хрупкую добычу при ударе.',
        iconUrl: '/art/mining-skills/Мягкий удар.png',
      },
      {
        id: 'mining_crack_reading',
        name: 'Чтение трещин',
        description: 'Проверяет выбранный блок на признаки скрытой опасности.',
        iconUrl: '/art/mining-skills/Чтение трещин.png',
      },
      {
        id: 'mining_support_beams',
        name: 'Подпорки',
        description: 'Укрепляет участок и может нейтрализовать опасный блок.',
        iconUrl: '/art/mining-skills/Подпорки.png',
      },
      {
        id: 'mining_master_brace',
        name: 'Распорка мастера',
        description: 'Усиливает укрепление и дополнительно снижает риск обвала.',
        iconUrl: '/art/mining-skills/Распорка мастера.png',
      },
      {
        id: 'mining_underground_map',
        name: 'Карта подземья',
        description: 'Показывает дополнительные подсказки по проходам и опасностям.',
        iconUrl: '/art/mining-skills/Карта подземья.png',
      },
      {
        id: 'mining_stone_memory',
        name: 'Память камня',
        description: 'Закрепляет скрытое свойство для выбранного кристалла/самоцвета.',
        iconUrl: '/art/mining-skills/Память камня.png',
      },
    ];
    const activeMiningSkills = activeMiningSkillDefs
      .filter((skill) => Boolean(activeMineEffects?.some((effect) => effect.skillId === skill.id)))
      .map((skill) => {
        const used = (activeMineRun.usedEffects?.[`active_skill:${skill.id}`] ?? 0) > 0;
        return {
          ...skill,
          enabled: !used,
          used,
        };
      });

    if (!mine || !depth) {
      return (
        <div className="battle-overlay" role="dialog" aria-modal="true">
          <section className="card battle-window wm-modal">
            <div className="battle-window-head">
              <h2>Горняк / Горянка</h2>
              <button onClick={closeMine}>×</button>
            </div>
            <p className="muted">Шахта или глубина не найдены.</p>
          </section>
        </div>
      );
    }

    return (
      <MiningScreen
        mine={mine}
        depth={depth}
        run={toPublicMineRun(activeMineRun)}
        miningLevel={miningProfession?.level ?? 1}
        pickaxeName="Безымянная кирка"
        emergencyEscapeAvailable={Boolean(activeMineEffects?.some((effect) => effect.type === 'mine_once_per_run_escape') && !activeMineRun.usedEmergencyEscape)}
        activeMiningSkills={activeMiningSkills}
        resolveItemName={resolveMineItemName}
        resolveItemMeta={resolveMineItemMeta}
        onHitBlock={handleMineHitBlock}
        onUseActiveMiningSkill={handleMineUseActiveSkill}
        onDropLoot={handleMineDropLoot}
        onEscape={handleMineEscape}
        onRetreat={handleMineRetreat}
        onDescend={handleMineDescend}
        onFinalize={finalizeMineRunResult}
        onClose={handleMineClose}
      />
    );
  })();

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
        onProfessions={onOpenProfessions}
        onSkills={onOpenSkills}
        onInventory={onOpenInventory}
        onCharacter={onOpenCharacter}
        onEquipment={onOpenEquipment}
        onQuests={() => setQuestJournalOpen(true)}
        onMap={() => {
          if (worldMapMode !== "play") {
            return;
          }

          setWorldMapViewerOpen((current) => !current);
        }}
        onToggleMiniMap={handleToggleMiniMap}
        miniMapVisible={miniMapVisible}
        onClan={onOpenClan}
        onExit={onExit}
      />

      <section className="wm-grid">
        <div
          className={`wm-left-panel ${leftPanelCollapsed ? "is-collapsed" : ""}`}
          data-tutorial="player-quick-panel"
        >
          <button
            type="button"
            className="wm-panel-collapse-btn wm-panel-collapse-btn-left"
            aria-label={
              leftPanelCollapsed
                ? "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043b\u0435\u0432\u0443\u044e \u043f\u0430\u043d\u0435\u043b\u044c"
                : "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043b\u0435\u0432\u0443\u044e \u043f\u0430\u043d\u0435\u043b\u044c"
            }
            aria-expanded={!leftPanelCollapsed}
            onClick={() =>
              setLeftPanelCollapsed((current: boolean) => !current)
            }
          >
            {leftPanelCollapsed ? ">" : "<"}
          </button>
          <PlayerQuickPanel
            name={character.name}
            avatarLetter={avatarLetter}
            avatarUrl={playerAvatarUrl}
            hpText={`${battleStats.hp}/${character.maxHp}`}
            mpText={`${battleStats.mp}/${character.maxMp}`}
            staminaText={`${battleStats.stamina}/${character.maxStamina}`}
            activeStats={character.activeStats as StatBlock}
            equipment={equipment}
            inventory={inventory}
            quickActions={quickButtons}
            resolveItemById={resolveItemById}
            resolveItemImage={resolveItemImage}
            worldStatusLines={[
              `\u041b\u043e\u043a\u0430\u0446\u0438\u044f: ${selectedLocationName}`,
              `\u041a\u043e\u043e\u0440\u0434: ${playerPosition.x.toFixed(3)}, ${playerPosition.y.toFixed(3)}`,
              `\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435: ${playerState}`,
              `\u041f\u043e\u0434 \u043a\u0443\u0440\u0441\u043e\u0440\u043e\u043c: ${hoverZone?.name ?? "-"}`,
              ...passiveAreaStatusLines,
              "\u041e\u043d\u043b\u0430\u0439\u043d: 124",
              "22:41",
            ]}
          />
        </div>

        <div className="wm-main-column">
          {locationView === "map" ? (
            <div className="wm-play-map-wrap" data-tutorial="world-surface">
              <button
                type="button"
                className="wm-renderer-toggle"
                onClick={() => setWorldRenderer((current) => current === "phaser" ? "canvas" : "phaser")}
              >
                World renderer: {worldRenderer}
              </button>
              <div className="wm-map-dev-status" style={{ marginTop: 8, fontSize: 12, color: worldSnapshotError ? '#ff9a9a' : '#d8c29a' }}>
                {worldSnapshotError
                  ? `World snapshot unavailable: ${worldSnapshotError}`
                  : worldSnapshotLoading
                    ? 'World snapshot: loading...'
                    : `World snapshot OK, activeEntities: ${worldSnapshot?.activeEntities.length ?? 0}`}
              </div>
              <div className="wm-map-dev-status" style={{ marginTop: 4, fontSize: 12, color: '#d8c29a', fontFamily: 'Consolas, monospace' }}>
                {worldParityDebugLine}
              </div>
              {worldRenderer === "phaser" ? (
                <PhaserWorldMapCanvas
                  ref={canvasRef}
                  sceneSnapshot={playWorldSceneSnapshot}
                  onSceneCommand={handleWorldSceneCommand}
                  gameplayPaused={worldMapViewerOpen}
                  playerStartPosition={playSpawnPosition}
                  playerAvatarUrl={playerAvatarUrl}
                  zones={playVisibleZones}
                  playQuestMarkers={playQuestMarkers}
                  playNpcMarkers={playNpcMarkers}
                  onHoverZone={handleHoverZone}
                  movementLocked={playMovementLocked}
                  onWorldEntityClick={handleWorldEntityClick}
                  lockedWorldEntityId={engagedWorldEntityId}
                  lockedWorldEntityCoordinates={engagedWorldEntityAnchor}
                  discoveredLocationIds={new Set(mapDiscoveryState.discoveredLocationIds)}
                  discoveredZoneIds={new Set(mapDiscoveryState.discoveredZoneIds)}
                />
              ) : (
                <WorldMapCanvas
                  mode="play"
                  sceneSnapshot={playWorldSceneSnapshot}
                  onSceneCommand={handleWorldSceneCommand}
                  gameplayPaused={worldMapViewerOpen}
                  playerStartPosition={playSpawnPosition}
                  playerAvatarUrl={playerAvatarUrl}
                  zones={playVisibleZones}
                  regions={regions}
                  playQuestMarkers={playQuestMarkers}
                  playNpcMarkers={playNpcMarkers}
                  onHoverZone={handleHoverZone}
                  movementLocked={playMovementLocked}
                  onWorldEntityClick={handleWorldEntityClick}
                  lockedWorldEntityId={engagedWorldEntityId}
                  lockedWorldEntityCoordinates={engagedWorldEntityAnchor}
                  discoveredLocationIds={new Set(mapDiscoveryState.discoveredLocationIds)}
                  discoveredZoneIds={new Set(mapDiscoveryState.discoveredZoneIds)}
                />
              )}
              {miniMapVisible ? (
                <MiniMapWidget
                  mapImagePath={LABELED_WORLD_MAP_IMAGE_PATH}
                  fallbackMapImagePath={PLAY_WORLD_MAP_IMAGE_PATH}
                  playerPosition={playerPosition}
                  questMarkers={playQuestMarkers}
                  trackedMarkerId={trackedQuestMarkerId}
                  discoveryMarkers={mapDiscoveryMarkers}
                  onOpenViewer={() => setWorldMapViewerOpen(true)}
                />
              ) : null}
            </div>
          ) : locationView === "city" ? (
            <section className="wm-map card" data-tutorial="world-surface">
              <div
                className="wm-map-surface wm-city-surface"
                onWheel={handleCityWheel}
                onMouseDown={handleCityPanStart}
                onMouseMove={handleCityPanMove}
                onMouseUp={handleCityPanEnd}
                onMouseLeave={handleCityPanEnd}
                onDoubleClick={resetCityTransform}
              >
                <div
                  className="city-map-transform-layer"
                  style={{
                    transform: `translate(${cityPan.x}px, ${cityPan.y}px) scale(${cityZoom})`,
                    backgroundImage: activeCityBackgroundUrl
                      ? `linear-gradient(rgba(24, 17, 12, 0.28), rgba(24, 17, 12, 0.52)), url('${activeCityBackgroundUrl}')`
                      : "linear-gradient(135deg, rgba(38, 29, 20, 0.96), rgba(14, 12, 10, 0.98))",
                  }}
                >
                  <div className="wm-map-title">
                    {activeCity?.name ?? selectedLocationName}
                  </div>
                  <div className="wm-city-hotspots">
                    {visibleCityLocations.map((location) => {
                      const locationMerchant = location.shopIds?.[0]
                      ? (merchantById.get(location.shopIds[0]) ?? null)
                        : null;
                      const merchantImage =
                        locationMerchant && resolveMerchantImage
                          ? resolveMerchantImage(locationMerchant)
                          : undefined;
                      return (
                        <button
                          key={location.id}
                          type="button"
                          className={`city-location-hotspot city-location-hotspot-${location.shapeType}`}
                          style={getLocationPercent(location)}
                          onClick={() => handleCityLocation(location)}
                        >
                          <span className="city-location-hotspot-title">
                            {location.name}
                          </span>
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
                        {"\u0412 \u044d\u0442\u043e\u043c \u0433\u043e\u0440\u043e\u0434\u0435 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0442\u043e\u0440\u0433\u043e\u0432\u0446\u0435\u0432 \u0438\u0437 \u0430\u0434\u043c\u0438\u043d\u043a\u0438. \u041f\u0440\u0438\u0432\u044f\u0436\u0438\u0442\u0435"}
                        {"\u0442\u043e\u0440\u0433\u043e\u0432\u0446\u0430 \u043a cityId \u0438\u043b\u0438 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e \u0433\u043e\u0440\u043e\u0434\u0430."}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <footer className="wm-map-legend">
                <span>
                  {selectedLocationName} | {"\u0422\u043e\u0440\u0433\u043e\u0432\u0446\u044b \u0438\u0437 \u0430\u0434\u043c\u0438\u043d\u043a\u0438 \u043f\u043e\u044f\u0432\u043b\u044f\u044e\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c"}
                  {"\u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438, \u0435\u0441\u043b\u0438 \u0443 \u043d\u0438\u0445 \u0443\u043a\u0430\u0437\u0430\u043d cityId \u0438\u043b\u0438 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0449\u0435\u0435 \u0438\u043c\u044f"}
                  {"\u0433\u043e\u0440\u043e\u0434\u0430."}
                </span>
                <button className="wm-city-back" onClick={handleReturnToMap}>
                  {"\u041d\u0430\u0437\u0430\u0434 \u043a \u043a\u0430\u0440\u0442\u0435"}
                </button>
              </footer>
            </section>
          ) : (
            <section className="wm-map card" data-tutorial="world-surface">
              <div
                className="wm-map-surface wm-city-surface"
                onWheel={handleCityWheel}
                onMouseDown={handleCityPanStart}
                onMouseMove={handleCityPanMove}
                onMouseUp={handleCityPanEnd}
                onMouseLeave={handleCityPanEnd}
                onDoubleClick={resetCityTransform}
              >
                <div
                  className="city-map-transform-layer"
                  style={{
                    transform: `translate(${cityPan.x}px, ${cityPan.y}px) scale(${cityZoom})`,
                    backgroundImage: activeLocationBackgroundUrl
                      ? `linear-gradient(rgba(24, 17, 12, 0.28), rgba(24, 17, 12, 0.52)), url('${activeLocationBackgroundUrl}')`
                      : "linear-gradient(135deg, rgba(38, 29, 20, 0.96), rgba(14, 12, 10, 0.98))",
                  }}
                >
                  <div className="wm-map-title">
                    {activeLocation?.name ?? selectedLocationName}
                  </div>
                  <div className="wm-city-hotspots">
                    {(activeLocation?.areas ?? []).map((area) => (
                      <button
                        key={area.id}
                        type="button"
                        className={`city-location-hotspot city-location-hotspot-${area.shapeType ?? "rectangle"}`}
                        style={getAreaPercent(area)}
                        onClick={() => handleLocationPlaceClick(area)}
                      >
                        <span className="city-location-hotspot-title">
                          {area.name}
                        </span>
                      </button>
                    ))}

                    {(() => {
                      const stateNpcIds = activeLocation ? getLocationActiveState(activeLocation)?.npcIds : undefined;
                      const locationNpcIds: string[] = (stateNpcIds ?? activeLocation?.npcIds ?? [])
                        .filter((npcId): npcId is string => typeof npcId === "string" && npcId.trim().length > 0);
                      const locationNpcs: NpcDefinition[] = locationNpcIds
                        .map((npcId) => npcById.get(npcId))
                        .filter((entry): entry is NpcDefinition => Boolean(entry));
                      return locationNpcs.map((npc: NpcDefinition, index: number) => {
                        const left = 8 + (index % 5) * 18;
                        const top = 72 + Math.floor(index / 5) * 12;
                        return (
                          <button
                            key={npc.id}
                            type="button"
                            className="city-location-hotspot city-location-hotspot-rectangle"
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              width: "16%",
                              height: "10%",
                            }}
                            onClick={() =>
                              handleLocationPlaceClick({
                                id: `location_npc_${npc.id}`,
                                name: npc.name ?? npc.id,
                                type: "npc",
                                npcIds: [npc.id],
                                canEnter: true,
                                isHidden: false,
                              })
                            }
                          >
                            <span className="city-location-hotspot-title">
                              {npc.name ?? npc.id}
                            </span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              <footer className="wm-map-legend">
                <span>{activeLocation?.name ?? selectedLocationName}</span>
                <button className="wm-city-back" onClick={handleReturnToMap}>
                  {"← Мировая карта"}
                </button>
              </footer>
            </section>
          )}

          <div className="wm-chat-dock">
            <div className="wm-event-overlay" aria-live="polite">
              {eventOverlayMessages.map((line) => (
                <p
                  key={`overlay-${line.id}`}
                  className={`wm-event-line type-${line.type} ${line.isFading ? "is-fading" : ""}`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            <section
              className={`wm-chat card wm-chat-under-map chat-container ${chatMinimized ? "is-minimized" : ""}`}
            >
              <div className="wm-chat-header">
                <h3>{"\u0427\u0430\u0442"}</h3>
                <button
                  type="button"
                  className="wm-chat-minimize-btn"
                  aria-label={chatMinimized ? "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0447\u0430\u0442" : "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0447\u0430\u0442"}
                  aria-expanded={!chatMinimized}
                  onClick={() =>
                    setChatMinimized((current: boolean) => !current)
                  }
                >
                  {chatMinimized ? "^" : "v"}
                </button>
              </div>
              <div ref={chatLogRef} className="wm-chat-log chat-messages">
                {chatMessages.map((line) => (
                  <p key={line.id}>
                    <strong>[{line.type.toUpperCase()}]</strong> {line.text}
                  </p>
                ))}
              </div>
              <div className="wm-chat-input">
                <select
                  value={chatType}
                  onChange={(event) =>
                    setChatType(event.target.value as ChatType)
                  }
                >
                  <option value="local">local</option>
                  <option value="private">private</option>
                  <option value="system">system</option>
                </select>
                <input
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder={"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435..."}
                />
                <button onClick={handleSendChat}>{">"}</button>
              </div>
            </section>
          </div>
        </div>
        {activeWorldModalElement}
        {dialogueModalElement}
        {miningModalElement}
        {pvpBrowserElement}
        {randomEventModalElement}
        {npcQuestSceneModalElement}
        <QuestJournalModal
          isOpen={questJournalOpen}
          onClose={() => setQuestJournalOpen(false)}
          questDefinitions={questDefinitions}
          playerQuestStates={playerQuestStates}
          runtimeImages={runtimeImages}
          trackedQuestId={trackedQuestId}
          trackedObjectiveId={trackedObjectiveId}
          onTrackQuest={handleTrackQuest}
          onClearTrackedQuest={handleClearTrackedQuest}
        />
        <QuestInteractionModal
          interaction={activeInteraction}
          choices={activeInteractionChoices}
          onClose={() => {
            setActiveInteraction(null);
            setActiveInteractionChoices([]);
          }}
          onChoice={handleInteractionChoice}
        />
        <div
          className={`wm-right-panel ${rightPanelCollapsed ? "is-collapsed" : ""}`}
          data-tutorial="world-context-actions"
        >
          <button
            type="button"
            className="wm-panel-collapse-btn wm-panel-collapse-btn-right"
            aria-label={
              rightPanelCollapsed
                ? "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0440\u0430\u0432\u0443\u044e \u043f\u0430\u043d\u0435\u043b\u044c"
                : "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0440\u0430\u0432\u0443\u044e \u043f\u0430\u043d\u0435\u043b\u044c"
            }
            aria-expanded={!rightPanelCollapsed}
            onClick={() =>
              setRightPanelCollapsed((current: boolean) => !current)
            }
          >
            {rightPanelCollapsed ? "<" : ">"}
          </button>

          <div className="wm-right-stack">
            {showAdminShortcuts ? (
              <>
                {renderSidePanel(
                  "adminEditor",
                  "Admin \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b",
                  <div className="wm-editor-launch card">
                    <button
                      onClick={() => {
                        window.open(
                          "/admin/zone-editor",
                          "_blank",
                          "noopener,noreferrer",
                        );
                        onStatus(
                          "Zone Editor \u043e\u0442\u043a\u0440\u044b\u0442 \u0432 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u043c \u043e\u043a\u043d\u0435 \u0430\u0434\u043c\u0438\u043d\u043a\u0438.",
                        );
                      }}
                    >
                      Zone Editor (Admin)
                    </button>
                  </div>,
                )}

                {renderSidePanel(
                  "adminBattle",
                  "Battle Map Editor",
                  <section className="wm-battle-map-panel card">
                    <div className="wm-battle-map-head">
                      <h3>Battle Map Editor</h3>
                    </div>

                    <div className="wm-action-grid">
                      <button
                        onClick={() => {
                          window.open(
                            "/admin/battle-maps",
                            "_blank",
                            "noopener,noreferrer",
                          );
                          onStatus(
                            "Battle Map Editor \u043e\u0442\u043a\u0440\u044b\u0442 \u0432 \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u043c \u043e\u043a\u043d\u0435 \u0430\u0434\u043c\u0438\u043d\u043a\u0438.",
                          );
                        }}
                      >
                        {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440 \u0431\u0430\u0442\u0442\u043b-\u043a\u0430\u0440\u0442"}
                      </button>
                      <button
                        onClick={() => {
                          void onStartCombat();
                        }}
                      >
                        Start test battle
                      </button>
                    </div>
                  </section>,
                )}
              </>
            ) : null}

            {renderSidePanel(
              "contextActions",
              "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u044f",
              <section
                className="wm-context wm-context-summary card"
                style={{ borderTop: "none" }}
              >
                <section className="wm-context-block">
                  <h3 style={{ marginTop: 0 }}>
                    {locationView === "city"
                      ? (selectedCityLocation?.name ?? activeCity?.name ?? "\u0413\u043e\u0440\u043e\u0434")
                      : (selectedNode?.name ?? selectedLocationName)}
                  </h3>
                  {locationView === "city" ? (
                    <p className="muted">
                      {selectedCityLocation?.description?.trim() ||
                        activeCity?.shortDescription ||
                        activeCity?.fullDescription ||
                        "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043c\u0435\u0441\u0442\u043e \u043d\u0430 \u043a\u0430\u0440\u0442\u0435 \u0433\u043e\u0440\u043e\u0434\u0430."}
                    </p>
                  ) : selectedNode ? (
                    <>
                      <p className="wm-meta-row">
                        <span>{selectedNode.type}</span>
                        <span>{selectedNode.faction}</span>
                      </p>
                      <p className="wm-meta-row">
                        <span>Danger: {selectedNode.danger}</span>
                        <span>Lvl {selectedNode.recommendedLevel}</span>
                        <span>{selectedNode.access}</span>
                      </p>
                      <p className="muted">{selectedNode.description}</p>
                    </>
                  ) : (
                    <p className="muted">{"\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043e\u0447\u043a\u0443 \u043d\u0430 \u043a\u0430\u0440\u0442\u0435."}</p>
                  )}
                  {worldMapMode === "play" && locationView === "map" ? (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
                      <button onClick={handleInspectCurrentZone}>{"\u041e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c\u0441\u044f"}</button>
                    </div>
                  ) : null}
                </section>

                <section className="wm-context-block">
                  <h3>Текущие области</h3>
                  {passiveAreaStatusLines.length > 0 ? (
                    passiveAreaStatusLines.map((line) => (
                      <p key={`passive-zone-${line}`} className="muted">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="muted">Пассивные области не обнаружены.</p>
                  )}
                </section>

                <section className="wm-context-block">
                  <h3>{"\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u043d\u0438\u044f"}</h3>
                  {playerQuestStates.filter((entry) => entry.status === "active").length > 0 ? (
                    playerQuestStates
                      .filter((entry) => entry.status === "active")
                      .slice(0, 5)
                      .map((state) => {
                        const quest =
                          questDefinitions.find((entry) => entry.id === state.questId) ??
                          null;
                        return (
                          <p key={state.questId} className="muted">
                            {quest?.title ?? state.questId}
                          </p>
                        );
                      })
                  ) : (
                    <p className="muted">{"\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u0437\u0430\u0434\u0430\u043d\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."}</p>
                  )}
                </section>

                <section className="wm-context-block">
                  <h3>{"\u0416\u0443\u0440\u043d\u0430\u043b"}</h3>
                  <div className="wm-context-journal-scroll">
                    {chatMessages.slice(-16).length > 0 ? (
                      chatMessages.slice(-16).map((line) => (
                        <p key={`side-${line.id}`} className="muted">
                          [{line.type.toUpperCase()}] {line.text}
                        </p>
                      ))
                    ) : (
                      <p className="muted">
                        {"\u0421\u043e\u0431\u044b\u0442\u0438\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."}
                      </p>
                    )}
                  </div>
                </section>
              </section>,
            )}

          </div>
        </div>
        <WorldMapViewer
          isOpen={worldMapViewerOpen}
          mapImagePath={LABELED_WORLD_MAP_IMAGE_PATH}
          fallbackMapImagePath={PLAY_WORLD_MAP_IMAGE_PATH}
          playerPosition={playerPosition}
          playerAvatarUrl={playerAvatarUrl}
          discoveredCells={discoveredWorldMapCells}
          discoveryMarkers={mapDiscoveryMarkers}
          questMarkers={playQuestMarkers}
          playerQuestStates={playerQuestStates}
          trackedMarkerId={trackedQuestMarkerId}
          trackedQuestId={trackedQuestId}
          trackedObjectiveId={trackedObjectiveId}
          onClose={() => setWorldMapViewerOpen(false)}
        />
      </section>
      {activeTutorial ? (
        <TutorialOverlay
          tutorial={activeTutorial}
          currentStepIndex={tutorialState.currentStepIndex}
          onNext={() => setTutorialState(nextStep(character.id))}
          onSkip={() => setTutorialState(skipTutorial(character.id))}
          onComplete={() => setTutorialState(completeTutorial(character.id))}
        />
      ) : null}
    </>
  );

  const editorLayout = (
    <section
      className={`wm-editor-shell ${adminEditorOnly ? "is-admin-editor" : ""}`}
    >
      <div className="wm-editor-toolbar card">
        <div className="wm-editor-toolbar-group">
          {!adminEditorOnly ? (
            <button onClick={() => setMode("play")}>Play Mode</button>
          ) : null}
          <button className="is-active" onClick={() => setMode("editor")}>
            Editor Mode
          </button>
        </div>
        <div className="wm-editor-toolbar-group">
          <button
            className={
              editorSettings.selectedTool === "select" ? "is-active" : ""
            }
            onClick={() => handleToolChange("select")}
          >
            Select
          </button>
          <button
            className={
              editorSettings.selectedTool === "circle" ? "is-active" : ""
            }
            onClick={() => handleToolChange("circle")}
          >
            Circle
          </button>
          <button
            className={
              editorSettings.selectedTool === "polygon" ? "is-active" : ""
            }
            onClick={() => handleToolChange("polygon")}
          >
            Polygon
          </button>
          <button
            className={
              editorSettings.selectedTool === "rectangle" ? "is-active" : ""
            }
            onClick={() => handleToolChange("rectangle")}
          >
            Rectangle
          </button>
          <button
            className={editorSettings.selectedTool === "pan" ? "is-active" : ""}
            onClick={() => handleToolChange("pan")}
          >
            Pan
          </button>
          <button
            className={
              editorSettings.selectedTool === "measure" ? "is-active" : ""
            }
            onClick={() => handleToolChange("measure")}
          >
            Measure
          </button>
        </div>
        <div className="wm-editor-toolbar-group">
          <button onClick={handleUndo}>Undo</button>
          <button onClick={handleRedo}>Redo</button>
          <button onClick={() => canvasRef.current?.fitToScreen()}>Fit</button>
          <button onClick={() => canvasRef.current?.focusZone(selectedZoneId)}>
            Focus
          </button>
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
            playQuestMarkers={questMarkers}
            activeEditorLayer={activeEditorLayer}
            layerVisibility={layerVisibility}
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
            markerPickMode={markerPickMode}
            onPickMarkerPoint={handlePickMarkerPoint}
          />
        </div>

        <ZoneEditorPanel
          activeEditorLayer={activeEditorLayer}
          layerVisibility={layerVisibility}
          onSetActiveEditorLayer={handleSetActiveEditorLayer}
          onCycleLayerVisibility={handleCycleLayerVisibility}
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
          regionColor={regionColor}
          onRegionToolModeChange={setRegionToolMode}
          onRegionTypeChange={handleRegionTypeChange}
          onRegionBrushSizeChange={setRegionBrushSize}
          onRegionColorChange={handleRegionColorChange}
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
          onExportFile={handleExportJsonFile}
          onCopyJson={() => {
            void handleCopyJson();
          }}
          onImportJson={handleImportJson}
          onImportJsonFile={(text) => {
            handleImportJson(text);
          }}
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
          locationOptions={validationSnapshot?.locations ?? []}
          locationPreviewImages={validationSnapshot?.images ?? []}
          selectedNpcIdForPlacement={selectedNpcIdForPlacement}
          onSelectNpcForPlacement={setSelectedNpcIdForPlacement}
          onPlaceNpcAtCursor={handlePlaceNpcAtCursor}
          validationIssues={worldMapValidationIssues}
          onSelectValidationIssue={handleSelectValidationIssue}
          onRepairValidationIssue={handleRepairValidationIssue}
          onRepairSelectedZoneContract={handleRepairSelectedZoneContract}
        />
      </div>

      <div className="wm-editor-statusbar card">
        <span>
          x: {mouseCoords.x?.toFixed(4) ?? "-"} y:{" "}
          {mouseCoords.y?.toFixed(4) ?? "-"}
        </span>
        <span>zoom {Math.round(editorSettings.zoom * 100)}%</span>
        <span>tool: {editorSettings.selectedTool}</span>
        <span>selected: {selectedZone?.id ?? "-"}</span>
        <span>
          draft:{" "}
          {editorDraft
            ? `${editorDraft.shape}${editorDraft.points.length ? ` (${editorDraft.points.length})` : ""}`
            : "-"}
        </span>
        <span>zones: {zones.length}</span>
        <span>regions: {regions.length}</span>
        <span>{autosaveStatus}</span>
      </div>
    </section>
  );

  if (adminEditorOnly) {
    return (
      <section className="wm-shell wm-shell-admin-editor">
        {editorLayout}
      </section>
    );
  }

  return (
    <section className="wm-shell">
      {worldMapMode === "play" ? playLayout : editorLayout}
    </section>
  );
}

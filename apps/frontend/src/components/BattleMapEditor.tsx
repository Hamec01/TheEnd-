import {
  inferRelationStance,
  type GlobalRelation,
  type DiplomaticActorDefinition,
} from '@theend/rpg-domain';
import type {
  BattleMapCellType,
  BattleMapDefinition,
  BattleMapExtractionZone,
  BattleMapObjectType,
  BattleMapObjective,
  BattleMapObjectiveType,
  BattleMapScriptEvent,
  BattleScriptEventType,
  BattleMapSpawnZoneType,
  BattleMapTriggerType,
  BattleMapNpcRole,
  ExitZone,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { AdminImageField } from '../admin/AdminImageField';
import { AdminAudioField } from '../admin/AdminAudioField';
import { AdminHelpTooltip } from '../admin/help/AdminHelpTooltip';
import {
  createDefaultBattleMap,
  deleteBattleMap,
  loadBattleMaps,
  loadBattleMapsFromStore,
  normalizeBattleMap,
  saveBattleMaps,
  saveBattleMapsToStore,
  upsertBattleMap,
  validateBattleMap,
} from '../services/battleMaps/battleMapStorage';
import { ensureNpcsLoaded, getAllNpcs } from '../services/npcRepository';
import { imageService } from '../services/content/imageService';
import { buildUploadFolder } from '../services/content/uploadFolders';
import { downloadCollectionJson, extractRawCollectionFromImportJson } from '../services/content/adminJsonImportExport';
import { getContentCollection } from '../services/content/contentApi';
import type { NpcDefinition } from '../types/npc';
import type { AdminDialogue, AdminMerchant, AdminQuest } from '../services/content/models';

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
const OBJECTIVE_TYPES: BattleMapObjectiveType[] = ['extract_bodies', 'survive_rounds', 'defeat_group', 'protect_npc', 'reach_zone', 'hold_zone', 'custom'];
const SCRIPT_EVENT_TYPES: BattleScriptEventType[] = ['battle_start', 'round_start', 'objective_progress', 'objective_completed', 'important_actor_down', 'battle_end'];
const MIN_BOARD_ZOOM = 0.4;
const MAX_BOARD_ZOOM = 4;

type EditorLayer = 'cells' | 'spawns' | 'exitZones' | 'extractionZones' | 'objects' | 'traps' | 'npcs' | 'triggers';
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

function nextExtractionZoneId(existing: BattleMapExtractionZone[] | undefined): string {
  const zones = Array.isArray(existing) ? existing : [];
  let index = zones.length + 1;
  while (zones.some((zone) => zone.id === `extraction_zone_${String(index).padStart(3, '0')}`)) {
    index += 1;
  }
  return `extraction_zone_${String(index).padStart(3, '0')}`;
}

function ensureExtractionZone(map: BattleMapDefinition, zoneId?: string | null): BattleMapExtractionZone {
  const zones = Array.isArray(map.extractionZones) ? map.extractionZones : [];
  const found = zoneId ? zones.find((zone) => zone.id === zoneId) : undefined;
  if (found) {
    return found;
  }
  const created: BattleMapExtractionZone = {
    id: nextExtractionZoneId(zones),
    name: 'New extraction zone',
    cells: [],
    allowedKingdomIds: [],
    allowedFactionIds: [],
    allowedObjectiveTags: [],
    objectiveId: '',
    description: '',
  };
  map.extractionZones = [...zones, created];
  return created;
}

function nextObjectiveId(existing: BattleMapObjective[] | undefined): string {
  const objectives = Array.isArray(existing) ? existing : [];
  let index = objectives.length + 1;
  while (objectives.some((objective) => objective.id === `battle_objective_${String(index).padStart(3, '0')}`)) {
    index += 1;
  }
  return `battle_objective_${String(index).padStart(3, '0')}`;
}

function createObjectiveDraft(existing: BattleMapObjective[] | undefined): BattleMapObjective {
  return {
    id: nextObjectiveId(existing),
    type: 'extract_bodies',
    title: 'New objective',
    description: '',
    requiredCount: 1,
    currentCount: 0,
    sourceKingdomId: '',
    sourceFactionId: '',
    sourceGroupId: '',
    sourceObjectiveTag: '',
    targetZoneId: '',
    questId: '',
    questObjectiveId: '',
    completeQuestObjectiveOnDone: false,
    failOnAllSourceActorsDead: false,
  };
}

function nextScriptEventId(existing: BattleMapScriptEvent[] | undefined): string {
  const events = Array.isArray(existing) ? existing : [];
  let index = events.length + 1;
  while (events.some((event) => event.id === `battle_script_event_${String(index).padStart(3, '0')}`)) {
    index += 1;
  }
  return `battle_script_event_${String(index).padStart(3, '0')}`;
}

function createScriptEventDraft(existing: BattleMapScriptEvent[] | undefined): BattleMapScriptEvent {
  return {
    id: nextScriptEventId(existing),
    type: 'battle_start',
    objectiveId: '',
    actorId: '',
    speakerNpcId: '',
    speakerName: '',
    portraitImageRef: '',
    message: 'New battle comment',
    pauseCombat: false,
    once: true,
  };
}

function parseListField(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatListField(values: string[] | undefined): string {
  return Array.isArray(values) ? values.join(', ') : '';
}

function joinTruthy(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' · ');
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
  const importFileRef = useRef<HTMLInputElement | null>(null);
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
  const [selectedExtractionZoneId, setSelectedExtractionZoneId] = useState<string | null>(null);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedScriptEventId, setSelectedScriptEventId] = useState<string | null>(null);
  const [selectedNpcSourceId, setSelectedNpcSourceId] = useState('random');
  const [adminNpcs, setAdminNpcs] = useState<NpcDefinition[]>([]);
  const [dialogues, setDialogues] = useState<AdminDialogue[]>([]);
  const [quests, setQuests] = useState<AdminQuest[]>([]);
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [diplomaticActors, setDiplomaticActors] = useState<DiplomaticActorDefinition[]>([]);
  const [globalRelations, setGlobalRelations] = useState<GlobalRelation[]>([]);
  const [undoStack, setUndoStack] = useState<BattleMapDefinition[]>([]);
  const [redoStack, setRedoStack] = useState<BattleMapDefinition[]>([]);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPanX, setCanvasPanX] = useState(0);
  const [canvasPanY, setCanvasPanY] = useState(0);
  const [interactionMode, setInteractionMode] = useState<'paint' | 'pan'>('paint');
  const [panDrag, setPanDrag] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [resolvedMapImageUrl, setResolvedMapImageUrl] = useState<string>('/map/battle-map_arena.png');
  const [isImporting, setIsImporting] = useState(false);

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
    let disposed = false;
    Promise.all([
      getContentCollection<AdminDialogue>('dialogues'),
      getContentCollection<AdminQuest>('quests'),
      getContentCollection<AdminMerchant>('merchants'),
      getContentCollection<DiplomaticActorDefinition>('diplomaticActors'),
      getContentCollection<GlobalRelation>('globalRelations'),
    ])
      .then(([loadedDialogues, loadedQuests, loadedMerchants, actors, relations]) => {
        if (disposed) {
          return;
        }
        setDialogues(loadedDialogues);
        setQuests(loadedQuests);
        setMerchants(loadedMerchants);
        setDiplomaticActors(actors);
        setGlobalRelations(relations);
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
  const selectedExtractionZone = (draft.extractionZones ?? []).find((zone) => zone.id === selectedExtractionZoneId) ?? null;
  const selectedObjective = (draft.objectives ?? []).find((objective) => objective.id === selectedObjectiveId) ?? null;
  const selectedScriptEvent = (draft.scriptEvents ?? []).find((event) => event.id === selectedScriptEventId) ?? null;
  const actorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const actor of diplomaticActors) {
      map.set(actor.id, actor.name || actor.id);
    }
    return map;
  }, [diplomaticActors]);
  const detectedRelationSummaries = useMemo(() => {
    const detected = new Map<string, { id: string; label: string }>();
    for (const npc of draft.npcs) {
      if (npc.kingdomId?.trim()) {
        const id = npc.kingdomId.trim();
        detected.set(`kingdom:${id}`, { id, label: actorNameById.get(id) ?? `Kingdom ${id}` });
      }
      if (npc.factionId?.trim()) {
        const id = npc.factionId.trim();
        detected.set(`faction:${id}`, { id, label: actorNameById.get(id) ?? `Faction ${id}` });
      }
      if (npc.raceId?.trim()) {
        const id = npc.raceId.trim();
        detected.set(`race:${id}`, { id, label: actorNameById.get(id) ?? `Race ${id}` });
      }
      if (npc.groupId?.trim()) {
        const id = npc.groupId.trim();
        detected.set(`group:${id}`, { id, label: actorNameById.get(id) ?? `Group ${id}` });
      }
    }

    const relationRows = globalRelations.filter((relation) => {
      const sourceKey = `${relation.sourceActorType}:${relation.sourceActorId}`;
      const targetKey = `${relation.targetActorType}:${relation.targetActorId}`;
      return detected.has(sourceKey) && detected.has(targetKey);
    });

    return {
      actors: [...detected.entries()].map(([key, value]) => ({ key, ...value })),
      relations: relationRows.map((relation) => {
        const sourceName = actorNameById.get(relation.sourceActorId) ?? relation.sourceActorId;
        const targetName = actorNameById.get(relation.targetActorId) ?? relation.targetActorId;
        const direction = relation.isMutual ? '↔' : '→';
        const extras = [
          relation.attackOnSight ? 'attack on sight' : null,
          relation.assistInCombat ? 'assist in combat' : null,
        ].filter(Boolean).join(', ');
        return `${sourceName} ${direction} ${targetName}: ${(relation.stance ?? inferRelationStance(relation.value)).toUpperCase()} (${relation.value})${extras ? `, ${extras}` : ''}`;
      }),
    };
  }, [actorNameById, draft.npcs, globalRelations]);
  const kingdomOptions = useMemo(() => {
    const dynamic = diplomaticActors
      .filter((actor) => actor.actorType === 'kingdom')
      .map((actor) => ({ id: actor.id, label: actor.name || actor.id }));
    return dynamic.sort((left, right) => left.label.localeCompare(right.label));
  }, [diplomaticActors]);
  const factionSelectorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const actor of diplomaticActors.filter((entry) => entry.actorType === 'faction')) {
      map.set(actor.id, actor.name || actor.id);
    }
    for (const option of adminNpcs.flatMap((npc) => npc.factionId ? [{ id: npc.factionId, label: npc.factionId }] : [])) {
      if (!map.has(option.id)) {
        map.set(option.id, option.label);
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [adminNpcs, diplomaticActors]);
  const raceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const actor of diplomaticActors.filter((entry) => entry.actorType === 'race')) {
      map.set(actor.id, actor.name || actor.id);
    }
    for (const npc of adminNpcs) {
      if (npc.race && !map.has(npc.race)) {
        map.set(npc.race, npc.race);
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label));
  }, [adminNpcs, diplomaticActors]);
  const existingBattleNpcSuggestions = useMemo(() => {
    const combatPresetIds = new Set<string>();
    const loadoutPresetIds = new Set<string>();
    const aiProfileIds = new Set<string>();
    for (const map of maps) {
      for (const npc of map.npcs ?? []) {
        if (npc.combatPresetId) combatPresetIds.add(npc.combatPresetId);
        if (npc.loadoutPresetId) loadoutPresetIds.add(npc.loadoutPresetId);
        if (npc.aiProfileId) aiProfileIds.add(npc.aiProfileId);
      }
      for (const zone of map.spawnZones ?? []) {
        if (zone.combatPresetId) combatPresetIds.add(zone.combatPresetId);
        if (zone.loadoutPresetId) loadoutPresetIds.add(zone.loadoutPresetId);
        if (zone.aiProfileId) aiProfileIds.add(zone.aiProfileId);
      }
    }
    for (const npc of adminNpcs) {
      if (npc.combat?.aiProfileId) {
        aiProfileIds.add(npc.combat.aiProfileId);
      }
    }
    return {
      combatPresetIds: [...combatPresetIds].sort(),
      loadoutPresetIds: [...loadoutPresetIds].sort(),
      aiProfileIds: [...aiProfileIds].sort(),
    };
  }, [adminNpcs, maps]);
  const dialogueOptions = useMemo(() => dialogues.map((dialogue) => ({
    id: dialogue.id,
    label: dialogue.title || dialogue.id,
  })).sort((left, right) => left.label.localeCompare(right.label)), [dialogues]);
  const questOptions = useMemo(() => quests.map((quest) => ({
    id: quest.id,
    label: quest.title || quest.id,
    objectives: quest.steps.flatMap((step) => (step.objectives ?? []).map((objective) => ({
      id: objective.id,
      label: `${step.title || step.id}: ${objective.text || objective.description || objective.id}`,
    }))),
  })).sort((left, right) => left.label.localeCompare(right.label)), [quests]);
  const merchantOptions = useMemo(() => merchants.map((merchant) => ({
    id: merchant.id,
    label: merchant.name || merchant.id,
  })).sort((left, right) => left.label.localeCompare(right.label)), [merchants]);
  const clanOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const map of maps) {
      for (const npc of map.npcs ?? []) {
        if (npc.clanId?.trim()) {
          ids.add(npc.clanId.trim());
        }
      }
    }
    return [...ids].sort().map((id) => ({ id, label: id }));
  }, [maps]);
  const groupOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const map of maps) {
      for (const npc of map.npcs ?? []) {
        if (npc.groupId?.trim()) {
          ids.add(npc.groupId.trim());
        }
      }
    }
    return [...ids].sort().map((id) => ({ id, label: id }));
  }, [maps]);
  const selectedScriptEventQuestObjectives = useMemo(() => {
    const questId = (draft.scriptEvents ?? []).find((event) => event.id === selectedScriptEventId)?.questEffect?.questId?.trim();
    if (!questId) {
      return [];
    }
    return questOptions.find((quest) => quest.id === questId)?.objectives ?? [];
  }, [draft.scriptEvents, questOptions, selectedScriptEventId]);
  const selectedScriptEventValidation = useMemo(() => {
    if (!selectedScriptEvent) {
      return [] as string[];
    }

    const issues: string[] = [];
    const objectiveIds = new Set((draft.objectives ?? []).map((objective) => objective.id));
    const npcIds = new Set(draft.npcs.map((npc) => npc.id));

    if (selectedScriptEvent.objectiveId && !objectiveIds.has(selectedScriptEvent.objectiveId)) {
      issues.push(`objectiveId ${selectedScriptEvent.objectiveId} не найден среди battle objectives.`);
    }
    if (selectedScriptEvent.speakerNpcId && !npcIds.has(selectedScriptEvent.speakerNpcId)) {
      issues.push(`speakerNpcId ${selectedScriptEvent.speakerNpcId} не найден среди размещённых NPC.`);
    }

    const questEffect = selectedScriptEvent.questEffect;
    if (questEffect?.type && !questEffect.questId) {
      issues.push('questEffect.type задан, но questId не выбран.');
    }
    if (questEffect?.questId) {
      const quest = questOptions.find((entry) => entry.id === questEffect.questId) ?? null;
      if (!quest) {
        issues.push(`questEffect.questId ${questEffect.questId} не найден в quests.`);
      } else if (questEffect.objectiveId && !quest.objectives.some((objective) => objective.id === questEffect.objectiveId)) {
        issues.push(`questEffect.objectiveId ${questEffect.objectiveId} не найден в выбранном quest.`);
      }
    }
    if (questEffect?.type === 'complete_objective' && !questEffect.objectiveId) {
      issues.push('complete_objective требует questEffect.objectiveId.');
    }

    return issues;
  }, [draft.npcs, draft.objectives, questOptions, selectedScriptEvent]);

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

  const handleExportJson = () => {
    downloadCollectionJson({
      filePrefix: 'theend_battle_maps',
      collectionKey: 'battleMaps',
      entries: maps,
    });
    onStatusMessage?.(`Экспорт battle maps: ${maps.length}`);
  };

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isImporting) {
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const entries = extractRawCollectionFromImportJson(payload, 'battleMaps');
      const normalized = entries
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => normalizeBattleMap(entry as Partial<BattleMapDefinition>));

      if (normalized.length === 0) {
        throw new Error('Файл не содержит battle maps.');
      }

      const seen = new Set<string>();
      for (const map of normalized) {
        if (seen.has(map.id)) {
          throw new Error(`Повторяющийся id карты: ${map.id}`);
        }
        seen.add(map.id);
      }

      const existingMaps = await loadBattleMapsFromStore();
      const existingIds = new Set(existingMaps.map((map) => map.id));
      const createdMaps = normalized.filter((map) => !existingIds.has(map.id));
      const skippedExisting = normalized.length - createdMaps.length;
      const mergedMaps = [...existingMaps, ...createdMaps];

      saveBattleMaps(mergedMaps);
      await saveBattleMapsToStore(mergedMaps);
      setMaps(mergedMaps);
      const nextMap = mergedMaps.find((map) => map.id === currentMapId) ?? mergedMaps[0];
      if (nextMap) {
        setCurrentMapId(nextMap.id);
        setDraft(nextMap);
        onSelectedMapIdChange?.(nextMap.id);
      }
      setUndoStack([]);
      setRedoStack([]);
      onStatusMessage?.(`Импорт battle maps завершён: создано ${createdMaps.length}, пропущено существующих ${skippedExisting}.`);
    } catch (error) {
      onStatusMessage?.(`Импорт battle maps: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
    }
  }

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

    if (layer === 'extractionZones') {
      commitDraft((current) => {
        const next = normalizeBattleMap(current);
        const zone = ensureExtractionZone(next, selectedExtractionZoneId);
        const key = getCellKey(x, y);
        const zones = (next.extractionZones ?? []).map((entry) => {
          if (entry.id !== zone.id) {
            return entry;
          }
          const cells = entry.cells.some((cell) => getCellKey(cell.x, cell.y) === key)
            ? entry.cells.filter((cell) => getCellKey(cell.x, cell.y) !== key)
            : [...entry.cells, { x, y }];
          return { ...entry, cells };
        });
        return { ...next, extractionZones: zones, updatedAt: Date.now() };
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

  function deleteSelectedExtractionZone(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      extractionZones: (current.extractionZones ?? []).filter((zone) => zone.id !== id),
      objectives: (current.objectives ?? []).map((objective) => objective.targetZoneId === id ? { ...objective, targetZoneId: '' } : objective),
      updatedAt: Date.now(),
    }), true);
    if (selectedExtractionZoneId === id) {
      setSelectedExtractionZoneId(null);
    }
  }

  function deleteSelectedObjective(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      objectives: (current.objectives ?? []).filter((objective) => objective.id !== id),
      extractionZones: (current.extractionZones ?? []).map((zone) => zone.objectiveId === id ? { ...zone, objectiveId: '' } : zone),
      updatedAt: Date.now(),
    }), true);
    if (selectedObjectiveId === id) {
      setSelectedObjectiveId(null);
    }
  }

  function deleteSelectedScriptEvent(id: string) {
    if (!window.confirm('Вы уверены? Это действие нельзя отменить.')) {
      return;
    }
    commitDraft((current) => ({
      ...current,
      scriptEvents: (current.scriptEvents ?? []).filter((event) => event.id !== id),
      updatedAt: Date.now(),
    }), true);
    if (selectedScriptEventId === id) {
      setSelectedScriptEventId(null);
    }
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
          <button type="button" className={layer === 'extractionZones' ? 'is-active' : ''} onClick={() => { setLayer('extractionZones'); setInteractionMode('paint'); onStatusMessage?.('Extraction zone tool selected. Click cells to paint evacuation area.'); }}>Extraction Zone</button>
          <button type="button" className={layer === 'objects' ? 'is-active' : ''} onClick={() => { setLayer('objects'); setInteractionMode('paint'); onStatusMessage?.('Object tool selected. Click a map cell to place object.'); }}>Object Tool</button>
          <button type="button" className={layer === 'npcs' ? 'is-active' : ''} onClick={() => { setLayer('npcs'); setInteractionMode('paint'); onStatusMessage?.('NPC tool selected. Click a map cell to place NPC.'); }}>NPC Tool</button>
          <button type="button" className={layer === 'triggers' ? 'is-active' : ''} onClick={() => { setLayer('triggers'); setInteractionMode('paint'); onStatusMessage?.('Trigger tool selected. Click a map cell to place trigger.'); }}>Trigger Tool</button>
          <button type="button" className={interactionMode === 'pan' ? 'is-active' : ''} onClick={() => setInteractionMode((mode) => mode === 'pan' ? 'paint' : 'pan')}>Pan</button>
          <button type="button" onClick={fitCanvasToViewport}>Fit</button>
          <button type="button" onClick={handleUndo} disabled={undoStack.length === 0}>Undo</button>
          <button type="button" onClick={handleRedo} disabled={redoStack.length === 0}>Redo</button>
          <button type="button" onClick={handleSave}>Save</button>
          <button type="button" onClick={handleExportJson}>Export JSON</button>
          <button type="button" disabled={isImporting} onClick={() => importFileRef.current?.click()}>{isImporting ? 'Importing...' : 'Import JSON'}</button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={handleImportFile} />
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
                suggestedId={draft.id ? `${draft.id}_background` : undefined}
                suggestedName={`${draft.id || 'battlemap'}-background`}
                uploadFolder={buildUploadFolder('images', 'battlemaps', draft.id || draft.name || undefined)}
                label="Загрузка фона карты"
                hint="Загружает картинку в content-хранилище и подставляет её ID в карту, чтобы фон сохранялся и работал на другом устройстве."
              />
              <div className="row">
                <label>Battle music URL</label>
                <input value={draft.musicUrl ?? ''} onChange={(event) => updateIdentityField('musicUrl', event.target.value)} placeholder="/content/assets/audio/my-battle-theme.mp3" />
              </div>
              <AdminAudioField
                value={draft.musicUrl}
                onChange={(nextValue) => updateIdentityField('musicUrl', nextValue)}
                onStatus={(text) => onStatusMessage?.(text)}
                suggestedAssetId={`${draft.id || 'battlemap'}-music`}
                suggestedName={`${draft.id || 'battlemap'}-music`}
                uploadFolder={buildUploadFolder('audio', 'battlemaps', draft.id || draft.name || undefined, 'music')}
                mode="url"
                label="Загрузка музыки боя"
                hint="Загружает музыку в content-хранилище и подставляет URL, который автоматически запускается при старте боя на этой карте."
              />
              <div className="row">
                <label>Ambient URL</label>
                <input value={draft.ambientUrl ?? ''} onChange={(event) => updateIdentityField('ambientUrl', event.target.value)} placeholder="/content/assets/audio/my-ambient-loop.ogg" />
              </div>
              <AdminAudioField
                value={draft.ambientUrl}
                onChange={(nextValue) => updateIdentityField('ambientUrl', nextValue)}
                onStatus={(text) => onStatusMessage?.(text)}
                suggestedAssetId={`${draft.id || 'battlemap'}-ambient`}
                suggestedName={`${draft.id || 'battlemap'}-ambient`}
                uploadFolder={buildUploadFolder('audio', 'battlemaps', draft.id || draft.name || undefined, 'ambient')}
                mode="url"
                label="Загрузка ambient-аудио"
                hint="Дополнительный ambient-трек карты. Пока сохраняется в карте и доступен для дальнейшего расширения звуковой сцены."
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

              <div className="battle-map-editor-dimensions">
                <div className="row">
                  <label>Objectives</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextObjective = createObjectiveDraft(draft.objectives);
                      commitDraft((current) => ({
                        ...current,
                        objectives: [...(current.objectives ?? []), nextObjective],
                        updatedAt: Date.now(),
                      }), true);
                      setSelectedObjectiveId(nextObjective.id);
                    }}
                  >
                    Add objective
                  </button>
                </div>
                <div className="row">
                  <label>Extraction zones</label>
                  <button
                    type="button"
                    onClick={() => {
                      const zone = ensureExtractionZone(normalizeBattleMap(draft), null);
                      commitDraft((current) => ({
                        ...current,
                        extractionZones: [...(current.extractionZones ?? []), zone],
                        updatedAt: Date.now(),
                      }), true);
                      setSelectedExtractionZoneId(zone.id);
                      setLayer('extractionZones');
                    }}
                  >
                    Add extraction zone
                  </button>
                </div>
                <div className="row">
                  <label>Script events</label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextEvent = createScriptEventDraft(draft.scriptEvents);
                      commitDraft((current) => ({
                        ...current,
                        scriptEvents: [...(current.scriptEvents ?? []), nextEvent],
                        updatedAt: Date.now(),
                      }), true);
                      setSelectedScriptEventId(nextEvent.id);
                    }}
                  >
                    Add script event
                  </button>
                </div>
              </div>
            </section>

            <section className="battle-map-editor-section battle-map-editor-placed-panel battle-map-editor-side-section">
              <div className="battle-map-editor-section-head">
                <h4>Placed Data</h4>
              </div>
              <div className="battle-map-editor-side-grid">
                <section className="battle-map-editor-list-card">
              <h5>Relation Preview</h5>
            <div className="battle-map-editor-form-grid">
              <div className="muted">
                Detected actors: {detectedRelationSummaries.actors.length > 0
                  ? detectedRelationSummaries.actors.map((actor) => actor.label).join(', ')
                  : 'none'}
              </div>
              {detectedRelationSummaries.relations.length > 0 ? detectedRelationSummaries.relations.map((summary) => (
                <div key={summary} className="muted">{summary}</div>
              )) : <div className="muted">No matching global relations found for placed battle actors yet.</div>}
            </div>
          </section>

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
              <h5>Objectives</h5>
            {(draft.objectives ?? []).map((objective) => (
              <button key={objective.id} type="button" className={selectedObjectiveId === objective.id ? 'is-active' : ''} onClick={() => setSelectedObjectiveId(objective.id)}>
                {objective.title} [{objective.type}] {objective.currentCount ?? 0}/{objective.requiredCount ?? 0}
              </button>
            ))}
            {selectedObjective ? (
              <div className="battle-map-editor-form-grid">
                <input value={selectedObjective.id} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, id: event.target.value } : objective) }))} placeholder="id" />
                <select value={selectedObjective.type} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, type: event.target.value as BattleMapObjectiveType } : objective) }))}>
                  {OBJECTIVE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <input value={selectedObjective.title} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, title: event.target.value } : objective) }))} placeholder="title" />
                <textarea value={selectedObjective.description ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, description: event.target.value } : objective) }))} placeholder="description" rows={2} />
                <div className="battle-map-editor-inline-grid">
                  <input type="number" value={selectedObjective.requiredCount ?? 0} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, requiredCount: Number(event.target.value) || 0 } : objective) }))} placeholder="requiredCount" />
                  <input type="number" value={selectedObjective.currentCount ?? 0} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, currentCount: Number(event.target.value) || 0 } : objective) }))} placeholder="currentCount" />
                </div>
                <input value={selectedObjective.sourceKingdomId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, sourceKingdomId: event.target.value } : objective) }))} placeholder="sourceKingdomId" />
                <input value={selectedObjective.sourceFactionId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, sourceFactionId: event.target.value } : objective) }))} placeholder="sourceFactionId" />
                <input value={selectedObjective.sourceGroupId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, sourceGroupId: event.target.value } : objective) }))} placeholder="sourceGroupId" />
                <input value={selectedObjective.sourceObjectiveTag ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, sourceObjectiveTag: event.target.value } : objective) }))} placeholder="sourceObjectiveTag" />
                <select value={selectedObjective.targetZoneId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, targetZoneId: event.target.value } : objective) }))}>
                  <option value="">targetZoneId</option>
                  {(draft.extractionZones ?? []).map((zone) => <option key={zone.id} value={zone.id}>{zone.name || zone.id}</option>)}
                </select>
                <input value={selectedObjective.questId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, questId: event.target.value } : objective) }))} placeholder="questId" />
                <input value={selectedObjective.questObjectiveId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, questObjectiveId: event.target.value } : objective) }))} placeholder="questObjectiveId" />
                <label><input type="checkbox" checked={selectedObjective.completeQuestObjectiveOnDone ?? false} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, completeQuestObjectiveOnDone: event.target.checked } : objective) }))} /> complete quest objective on done</label>
                <label><input type="checkbox" checked={selectedObjective.failOnAllSourceActorsDead ?? false} onChange={(event) => commitDraft((current) => ({ ...current, objectives: (current.objectives ?? []).map((objective) => objective.id === selectedObjective.id ? { ...objective, failOnAllSourceActorsDead: event.target.checked } : objective) }))} /> fail on all source actors dead</label>
                <button type="button" onClick={() => deleteSelectedObjective(selectedObjective.id)}>Remove objective</button>
              </div>
            ) : null}
          </section>

                <section className="battle-map-editor-list-card">
              <h5>Extraction Zones</h5>
            {(draft.extractionZones ?? []).map((zone) => (
              <button key={zone.id} type="button" className={selectedExtractionZoneId === zone.id ? 'is-active' : ''} onClick={() => setSelectedExtractionZoneId(zone.id)}>
                {zone.name} ({zone.cells.length} cells){zone.objectiveId ? ` -> ${zone.objectiveId}` : ''}
              </button>
            ))}
            {selectedExtractionZone ? (
              <div className="battle-map-editor-form-grid">
                <div className="muted">Paint this zone on the map with the `Extraction Zone` tool.</div>
                <input value={selectedExtractionZone.id} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, id: event.target.value } : zone) }))} placeholder="id" />
                <input value={selectedExtractionZone.name} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, name: event.target.value } : zone) }))} placeholder="name" />
                <select value={selectedExtractionZone.objectiveId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, objectiveId: event.target.value } : zone) }))}>
                  <option value="">objectiveId</option>
                  {(draft.objectives ?? []).map((objective) => <option key={objective.id} value={objective.id}>{objective.title || objective.id}</option>)}
                </select>
                <input value={formatListField(selectedExtractionZone.allowedKingdomIds)} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, allowedKingdomIds: parseListField(event.target.value) } : zone) }))} placeholder="allowedKingdomIds: argos, artalon" />
                <input value={formatListField(selectedExtractionZone.allowedFactionIds)} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, allowedFactionIds: parseListField(event.target.value) } : zone) }))} placeholder="allowedFactionIds" />
                <input value={formatListField(selectedExtractionZone.allowedObjectiveTags)} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, allowedObjectiveTags: parseListField(event.target.value) } : zone) }))} placeholder="allowedObjectiveTags" />
                <textarea value={selectedExtractionZone.description ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, extractionZones: (current.extractionZones ?? []).map((zone) => zone.id === selectedExtractionZone.id ? { ...zone, description: event.target.value } : zone) }))} placeholder="description" rows={2} />
                <div className="muted">Summary: {joinTruthy([
                  selectedExtractionZone.allowedKingdomIds?.length ? `kingdoms ${selectedExtractionZone.allowedKingdomIds.join(', ')}` : null,
                  selectedExtractionZone.allowedFactionIds?.length ? `factions ${selectedExtractionZone.allowedFactionIds.join(', ')}` : null,
                  selectedExtractionZone.allowedObjectiveTags?.length ? `tags ${selectedExtractionZone.allowedObjectiveTags.join(', ')}` : null,
                ]) || 'open extraction zone'}</div>
                <button type="button" onClick={() => deleteSelectedExtractionZone(selectedExtractionZone.id)}>Remove extraction zone</button>
              </div>
            ) : null}
          </section>

                <section className="battle-map-editor-list-card">
              <h5>Script Events</h5>
            {(draft.scriptEvents ?? []).map((event) => (
              <button key={event.id} type="button" className={selectedScriptEventId === event.id ? 'is-active' : ''} onClick={() => setSelectedScriptEventId(event.id)}>
                {event.type} {event.speakerName || event.speakerNpcId || event.id}
              </button>
            ))}
            {selectedScriptEvent ? (
              <div className="battle-map-editor-form-grid">
                <input value={selectedScriptEvent.id} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, id: event.target.value } : entry) }))} placeholder="id" />
                <select value={selectedScriptEvent.type} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, type: event.target.value as BattleScriptEventType } : entry) }))}>
                  {SCRIPT_EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select value={selectedScriptEvent.objectiveId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, objectiveId: event.target.value || undefined } : entry) }))}>
                  <option value="">objectiveId</option>
                  {(draft.objectives ?? []).map((objective) => <option key={objective.id} value={objective.id}>{objective.title || objective.id}</option>)}
                </select>
                <select value={selectedScriptEvent.speakerNpcId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, speakerNpcId: event.target.value || undefined } : entry) }))}>
                  <option value="">speakerNpcId</option>
                  {draft.npcs.map((npc) => <option key={npc.id} value={npc.id}>{npc.name}</option>)}
                </select>
                <input value={selectedScriptEvent.speakerName ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, speakerName: event.target.value } : entry) }))} placeholder="speakerName" />
                <input value={selectedScriptEvent.actorId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, actorId: event.target.value } : entry) }))} placeholder="actorId" />
                <input type="number" value={selectedScriptEvent.triggerAtCount ?? 0} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, triggerAtCount: Number(event.target.value) || undefined } : entry) }))} placeholder="triggerAtCount" />
                <input value={selectedScriptEvent.portraitImageRef ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, portraitImageRef: event.target.value } : entry) }))} placeholder="portraitImageRef" />
                <div className="muted">Quest effect</div>
                <select
                  value={selectedScriptEvent.questEffect?.type ?? ''}
                  onChange={(event) => commitDraft((current) => ({
                    ...current,
                    scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? {
                      ...entry,
                      questEffect: event.target.value
                        ? {
                          type: event.target.value as NonNullable<BattleMapScriptEvent['questEffect']>['type'],
                          questId: entry.questEffect?.questId,
                          objectiveId: entry.questEffect?.objectiveId,
                        }
                        : undefined,
                    } : entry),
                  }))}
                >
                  <option value="">questEffect.type</option>
                  <option value="start_quest">start_quest</option>
                  <option value="complete_objective">complete_objective</option>
                  <option value="advance_quest">advance_quest</option>
                  <option value="complete_quest">complete_quest</option>
                </select>
                <select
                  value={selectedScriptEvent.questEffect?.questId ?? ''}
                  onChange={(event) => commitDraft((current) => ({
                    ...current,
                    scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? {
                      ...entry,
                      questEffect: event.target.value
                        ? {
                          type: entry.questEffect?.type ?? 'advance_quest',
                          questId: event.target.value,
                          objectiveId: entry.questEffect?.objectiveId,
                        }
                        : entry.questEffect
                          ? { ...entry.questEffect, questId: undefined, objectiveId: undefined }
                          : undefined,
                    } : entry),
                  }))}
                >
                  <option value="">questEffect.questId</option>
                  {questOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select
                  value={selectedScriptEvent.questEffect?.objectiveId ?? ''}
                  onChange={(event) => commitDraft((current) => ({
                    ...current,
                    scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? {
                      ...entry,
                      questEffect: entry.questEffect
                        ? { ...entry.questEffect, objectiveId: event.target.value || undefined }
                        : event.target.value
                          ? { type: 'advance_quest', objectiveId: event.target.value }
                          : undefined,
                    } : entry),
                  }))}
                >
                  <option value="">questEffect.objectiveId</option>
                  {selectedScriptEventQuestObjectives.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <label><input type="checkbox" checked={selectedScriptEvent.pauseCombat ?? false} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, pauseCombat: event.target.checked } : entry) }))} /> pause combat</label>
                <label><input type="checkbox" checked={selectedScriptEvent.once ?? false} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, once: event.target.checked } : entry) }))} /> once</label>
                <textarea value={selectedScriptEvent.message ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, scriptEvents: (current.scriptEvents ?? []).map((entry) => entry.id === selectedScriptEvent.id ? { ...entry, message: event.target.value } : entry) }))} placeholder="message" rows={4} />
                <div className="muted">Preview: {(selectedScriptEvent.speakerName || selectedScriptEvent.speakerNpcId || 'Narrator')} — {selectedScriptEvent.message || 'empty message'}</div>
                {selectedScriptEventValidation.length > 0 ? (
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 4, padding: 10, border: '1px solid rgba(214, 182, 121, 0.22)', borderRadius: 8 }}>
                    <strong>Script event validation</strong>
                    {selectedScriptEventValidation.map((issue) => (
                      <div key={issue} style={{ color: '#f6d680' }}>{issue}</div>
                    ))}
                  </div>
                ) : null}
                <button type="button" onClick={() => deleteSelectedScriptEvent(selectedScriptEvent.id)}>Remove script event</button>
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
                <div className="muted">Basic</div>
                <input value={selectedNpc.id} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, id: event.target.value } : npc) }))} placeholder="id" />
                <input value={selectedNpc.npcId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, npcId: event.target.value } : npc) }))} placeholder="npcId" />
                <input value={selectedNpc.name} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, name: event.target.value } : npc) }))} placeholder="name" />
                <select value={selectedNpc.role} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, role: event.target.value as BattleMapNpcRole } : npc) }))}>
                  {NPC_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <select value={selectedNpc.sourceType ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, sourceType: (event.target.value || undefined) as typeof npc.sourceType } : npc) }))}>
                  <option value="">sourceType</option>
                  <option value="linked_npc">linked_npc</option>
                  <option value="generated_npc">generated_npc</option>
                  <option value="monster_template">monster_template</option>
                  <option value="animal_template">animal_template</option>
                </select>
                <div className="battle-map-editor-inline-grid">
                  <input type="number" value={selectedNpc.x} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, x: Number(event.target.value) || 0 } : npc) }))} placeholder="x" />
                  <input type="number" value={selectedNpc.y} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, y: Number(event.target.value) || 0 } : npc) }))} placeholder="y" />
                </div>
                <div className="muted">Identity</div>
                <select value={selectedNpc.kingdomId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, kingdomId: event.target.value || undefined } : npc) }))}>
                  <option value="">kingdomId</option>
                  {kingdomOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNpc.factionId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, factionId: event.target.value || undefined } : npc) }))}>
                  <option value="">factionId</option>
                  {factionSelectorOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNpc.raceId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, raceId: event.target.value || undefined } : npc) }))}>
                  <option value="">raceId</option>
                  {raceOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNpc.clanId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, clanId: event.target.value || undefined } : npc) }))}>
                  <option value="">clanId</option>
                  {clanOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNpc.groupId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, groupId: event.target.value || undefined } : npc) }))}>
                  <option value="">groupId</option>
                  {groupOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <div className="muted">Combat</div>
                <select value={selectedNpc.combatRole ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, combatRole: (event.target.value || undefined) as typeof npc.combatRole } : npc) }))}>
                  <option value="">combatRole</option>
                  <option value="melee">melee</option>
                  <option value="ranged">ranged</option>
                  <option value="mage">mage</option>
                  <option value="healer">healer</option>
                  <option value="tank">tank</option>
                  <option value="assassin">assassin</option>
                  <option value="beast">beast</option>
                  <option value="support">support</option>
                </select>
                <select value={selectedNpc.combatPresetId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, combatPresetId: event.target.value || undefined } : npc) }))}>
                  <option value="">combatPresetId</option>
                  {existingBattleNpcSuggestions.combatPresetIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <select value={selectedNpc.loadoutPresetId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, loadoutPresetId: event.target.value || undefined } : npc) }))}>
                  <option value="">loadoutPresetId</option>
                  {existingBattleNpcSuggestions.loadoutPresetIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <select value={selectedNpc.aiProfileId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, aiProfileId: event.target.value || undefined } : npc) }))}>
                  <option value="">aiProfileId</option>
                  {existingBattleNpcSuggestions.aiProfileIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <input value={selectedNpc.aiPersonality ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, aiPersonality: event.target.value } : npc) }))} placeholder="aiPersonality" />
                <input type="number" value={selectedNpc.level ?? 1} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, level: Number(event.target.value) || 1 } : npc) }))} placeholder="level" />
                <div className="muted">Links / Visual</div>
                <select value={selectedNpc.dialogueId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, dialogueId: event.target.value || undefined } : npc) }))}>
                  <option value="">dialogueId</option>
                  {dialogueOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNpc.questId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, questId: event.target.value || undefined } : npc) }))}>
                  <option value="">questId</option>
                  {questOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNpc.merchantId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, merchantId: event.target.value || undefined } : npc) }))}>
                  <option value="">merchantId</option>
                  {merchantOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <input value={selectedNpc.avatarUrl ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, avatarUrl: event.target.value } : npc) }))} placeholder="avatarUrl" />
                <input value={selectedNpc.avatarPoolId ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, avatarPoolId: event.target.value } : npc) }))} placeholder="avatarPoolId" />
                <input value={selectedNpc.imageRef ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, imageRef: event.target.value } : npc) }))} placeholder="imageRef" />
                <div className="muted">Objective</div>
                <label><input type="checkbox" checked={selectedNpc.startsCombat ?? false} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, startsCombat: event.target.checked } : npc) }))} /> starts combat</label>
                <label><input type="checkbox" checked={selectedNpc.canBeCarried ?? false} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, canBeCarried: event.target.checked } : npc) }))} /> can be carried</label>
                <label><input type="checkbox" checked={selectedNpc.countsForObjective ?? false} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, countsForObjective: event.target.checked } : npc) }))} /> counts for objective</label>
                <input value={selectedNpc.objectiveTag ?? ''} onChange={(event) => commitDraft((current) => ({ ...current, npcs: current.npcs.map((npc) => npc.id === selectedNpc.id ? { ...npc, objectiveTag: event.target.value } : npc) }))} placeholder="objectiveTag" />
                <div className="muted">Summary: {joinTruthy([
                  selectedNpc.kingdomId ? `kingdom ${selectedNpc.kingdomId}` : null,
                  selectedNpc.factionId ? `faction ${selectedNpc.factionId}` : null,
                  selectedNpc.combatRole ? `role ${selectedNpc.combatRole}` : null,
                  selectedNpc.objectiveTag ? `objective ${selectedNpc.objectiveTag}` : null,
                  selectedNpc.canBeCarried ? 'carryable' : null,
                ]) || 'basic placed NPC'}</div>
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

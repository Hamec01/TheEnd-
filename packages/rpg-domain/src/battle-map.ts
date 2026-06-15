export type BattleMapCellType =
  | 'walkable'
  | 'blocked'
  | 'trap'
  | 'difficult'
  | 'water'
  | 'lowCover'
  | 'highCover';

export type BattleMapSpawnZoneType =
  | 'player'
  | 'enemy'
  | 'neutralNpc'
  | 'reinforcement';

export type BattleMapObjectType =
  | 'loot'
  | 'container'
  | 'door'
  | 'lever'
  | 'resource'
  | 'questObject'
  | 'decoration'
  | 'cover'
  | 'destructible';

export type BattleMapTriggerType =
  | 'quest'
  | 'dialogue'
  | 'ambush'
  | 'trap'
  | 'scene'
  | 'exit'
  | 'custom';

export type BattleMapNpcRole =
  | 'enemy'
  | 'neutral'
  | 'ally'
  | 'merchant'
  | 'questGiver'
  | 'civilian';

export type BattleMapObjectiveType =
  | 'extract_bodies'
  | 'survive_rounds'
  | 'defeat_group'
  | 'protect_npc'
  | 'reach_zone'
  | 'hold_zone'
  | 'custom';

export type BattleScriptEventType =
  | 'battle_start'
  | 'round_start'
  | 'objective_progress'
  | 'objective_completed'
  | 'important_actor_down'
  | 'battle_end';

export type BattleMapZoneType =
  | 'blocked'
  | 'walkable'
  | 'spawn_player'
  | 'spawn_enemy'
  | 'spawn'
  | 'cover'
  | 'hazard'
  | 'exit_zone';

export interface ExitZone {
  id: string;
  cells: Array<{ x: number; y: number }>;
  team?: 'player' | 'enemy' | 'any';
  enabledForArena: false;
  label?: string;
  description?: string;
}

export interface BattleMapCell {
  x: number;
  y: number;
  type: BattleMapCellType;
  trapId?: string;
  movementCost?: number;
  blocksMovement?: boolean;
  blocksLineOfSight?: boolean;
}

export interface BattleMapSpawnZone {
  id: string;
  type: BattleMapSpawnZoneType;
  name: string;
  cells: Array<{ x: number; y: number }>;
  kingdomId?: string;
  factionId?: string;
  raceId?: string;
  groupId?: string;
  spawnMode?: 'manual' | 'generated';
  count?: number;
  npcTemplateIds?: string[];
  combatPresetId?: string;
  loadoutPresetId?: string;
  aiProfileId?: string;
  objectiveTag?: string;
}

export interface BattleMapPlacedObject {
  id: string;
  type: BattleMapObjectType;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  iconUrl?: string;
  imageUrl?: string;
  blocksMovement?: boolean;
  blocksLineOfSight?: boolean;
  interactable?: boolean;
  lootTableId?: string;
  questId?: string;
  triggerId?: string;
  description?: string;
}

export interface BattleMapTrap {
  id: string;
  name: string;
  x: number;
  y: number;
  damage?: number;
  staminaCost?: number;
  triggerOnce?: boolean;
  revealedByDefault?: boolean;
  detectionDifficulty?: number;
  description?: string;
}

export interface BattleMapPlacedNpc {
  id: string;
  npcId?: string;
  name: string;
  role: BattleMapNpcRole;
  x: number;
  y: number;
  factionId?: string;
  dialogueId?: string;
  questId?: string;
  merchantId?: string;
  startsCombat?: boolean;
  avatarUrl?: string;
  description?: string;
  sourceType?: 'linked_npc' | 'generated_npc' | 'monster_template' | 'animal_template';
  kingdomId?: string;
  raceId?: string;
  clanId?: string;
  groupId?: string;
  combatRole?: 'melee' | 'ranged' | 'mage' | 'healer' | 'tank' | 'assassin' | 'beast' | 'support';
  combatPresetId?: string;
  loadoutPresetId?: string;
  aiProfileId?: string;
  aiPersonality?: string;
  level?: number;
  equipment?: {
    weaponItemId?: string;
    offhandItemId?: string;
    armorItemIds?: string[];
  };
  skillIds?: string[];
  statOverrides?: Record<string, number>;
  avatarPoolId?: string;
  imageRef?: string;
  canBeCarried?: boolean;
  countsForObjective?: boolean;
  objectiveTag?: string;
}

export interface BattleMapObjective {
  id: string;
  type: BattleMapObjectiveType;
  title: string;
  description?: string;
  requiredCount?: number;
  currentCount?: number;
  sourceKingdomId?: string;
  sourceFactionId?: string;
  sourceGroupId?: string;
  sourceObjectiveTag?: string;
  targetZoneId?: string;
  questId?: string;
  questObjectiveId?: string;
  completeQuestObjectiveOnDone?: boolean;
  failOnAllSourceActorsDead?: boolean;
}

export interface BattleMapExtractionZone {
  id: string;
  name: string;
  cells: Array<{ x: number; y: number }>;
  allowedKingdomIds?: string[];
  allowedFactionIds?: string[];
  allowedObjectiveTags?: string[];
  objectiveId?: string;
  description?: string;
}

export interface BattleMapScriptEvent {
  id: string;
  type: BattleScriptEventType;
  objectiveId?: string;
  triggerAtCount?: number;
  actorId?: string;
  speakerNpcId?: string;
  speakerName?: string;
  portraitImageRef?: string;
  message: string;
  pauseCombat?: boolean;
  questEffect?: {
    type: 'start_quest' | 'complete_objective' | 'advance_quest' | 'complete_quest';
    questId?: string;
    objectiveId?: string;
  };
  once?: boolean;
}

export interface BattleMapTrigger {
  id: string;
  type: BattleMapTriggerType;
  name: string;
  cells: Array<{ x: number; y: number }>;
  questId?: string;
  dialogueId?: string;
  targetBattleMapId?: string;
  targetWorldZoneId?: string;
  startsCombat?: boolean;
  once?: boolean;
  enabled?: boolean;
  description?: string;
}

export interface BattleMapDefinition {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  musicAssetId?: string;
  musicUrl?: string;
  ambientAssetId?: string;
  ambientUrl?: string;
  cellSizePx?: number;
  gridOffsetX?: number;
  gridOffsetY?: number;
  logicalColumns?: number;
  logicalRows?: number;
  showEditorGrid?: boolean;
  gridOpacity?: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  cells: BattleMapCell[];
  spawnZones: BattleMapSpawnZone[];
  objects: BattleMapPlacedObject[];
  traps: BattleMapTrap[];
  npcs: BattleMapPlacedNpc[];
  triggers: BattleMapTrigger[];
  exitZones?: ExitZone[];
  objectives?: BattleMapObjective[];
  extractionZones?: BattleMapExtractionZone[];
  scriptEvents?: BattleMapScriptEvent[];
  tags?: string[];
  linkedLocationId?: string;
  linkedQuestId?: string;
  linkedZoneId?: string;
  createdAt: number;
  updatedAt: number;
}

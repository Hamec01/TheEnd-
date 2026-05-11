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
  tags?: string[];
  linkedLocationId?: string;
  linkedQuestId?: string;
  linkedZoneId?: string;
  createdAt: number;
  updatedAt: number;
}

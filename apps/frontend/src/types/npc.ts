export type NpcStatus = 'draft' | 'active' | 'disabled' | 'archived';

export type NpcKind =
  | 'civilian'
  | 'quest_giver'
  | 'trader'
  | 'trainer'
  | 'guard'
  | 'enemy'
  | 'boss'
  | 'companion'
  | 'random_encounter'
  | 'story_character'
  | 'monster'
  | 'animal';

export type NpcRace =
  | 'human'
  | 'high_elf'
  | 'forest_elf'
  | 'ancient_elf'
  | 'dwarf'
  | 'orc'
  | 'dark_elf'
  | 'arin_fellar'
  | 'monster'
  | 'beast'
  | 'undead'
  | 'spirit'
  | 'other';

export type NpcDispositionMode =
  | 'friendly'
  | 'neutral'
  | 'hostile'
  | 'fearful'
  | 'aggressive_on_sight'
  | 'quest_locked'
  | 'hidden';

export type NpcCombatRole =
  | 'none'
  | 'melee'
  | 'ranged'
  | 'mage'
  | 'healer'
  | 'tank'
  | 'assassin'
  | 'summoner'
  | 'support'
  | 'beast';

export type GameImageRef =
  | {
    type: 'image';
    src: string;
  }
  | {
    type: 'tileset';
    sheetId: string;
    frame: number;
  };

export interface NpcDefinition {
  id: string;
  name: string;
  title?: string;
  status: NpcStatus;
  kind: NpcKind;

  race: NpcRace;
  gender?: string;
  age?: number | string;

  kingdomId?: string;
  factionId?: string;
  cityId?: string;
  locationId?: string;

  homeCityId?: string;
  currentCityId?: string;
  cityLocationId?: string;
  allowedCityIds?: string[];

  description: string;
  adminNotes?: string;

  portraitUrl?: string;
  portraitImageRef?: GameImageRef;
  fullImageUrl?: string;
  fullImageRef?: GameImageRef;
  combatImageUrl?: string;
  combatImageRef?: GameImageRef;
  iconUrl?: string;
  iconImageRef?: GameImageRef;
  battleSpriteAssetId?: string;
  spriteProfileId?: string;
  deathEffectId?: string;
  hitEffectPreset?: string;
  dialogueStartVoiceAssetId?: string;
  dialogueStartLine?: string;
  voiceProfileId?: string;

  mapBindings: NpcMapBinding[];

  defaultDisposition: NpcDispositionMode;
  reputationValue?: number;

  isUnique: boolean;
  canRespawn: boolean;
  respawnSeconds?: number;

  canFight: boolean;
  canTalk: boolean;
  canTrade: boolean;
  worldSimTrader?: boolean;
  canTrain: boolean;
  canGiveQuests: boolean;
  canBeKilled: boolean;

  combat?: NpcCombatData;
  inventory?: NpcInventoryData;
  traderId?: string;
  trainer?: NpcTrainerData;
  dialogues: NpcDialogueBinding[];
  questBindings: NpcQuestBinding[];

  behavior?: NpcBehaviorData;

  conditions?: NpcCondition[];

  professionTrainer?: string;
  merchantId?: string;
  workshopId?: string;
  services?: string[];

  createdAt: string;
  updatedAt: string;
}

export interface NpcMapBinding {
  id: string;
  mapId: string;
  markerId?: string;
  zoneId?: string;
  x?: number;
  y?: number;
  spawnType: 'fixed' | 'random_in_zone' | 'quest_spawn' | 'event_spawn';
  visibleToPlayer: boolean;
  conditions?: NpcCondition[];
}

export interface NpcCombatData {
  level: number;
  role: NpcCombatRole;

  hp: number;
  mana?: number;
  stamina?: number;

  strength?: number;
  agility?: number;
  endurance?: number;
  intellect?: number;
  wisdom?: number;
  luck?: number;
  perception?: number;
  charisma?: number;

  physicalArmor?: number;
  magicResist?: number;

  initiative?: number;
  actionPoints?: number;

  damageMin?: number;
  damageMax?: number;

  weaponItemId?: string;
  armorItemIds?: string[];

  skillIds: string[];

  aiProfileId?: string;
  lootTableId?: string;

  onDeathQuestActions?: NpcQuestAction[];
}

export interface NpcInventoryData {
  itemIds: string[];
  questItemIds: string[];
  lootTableId?: string;
  goldMin?: number;
  goldMax?: number;
}

export interface NpcTrainerData {
  professionIds?: string[];
  skillIds?: string[];
  requiresQuestIds?: string[];
  requiresReputation?: number;
  priceGold?: number;
}

export interface NpcDialogueBinding {
  dialogueId: string;
  priority: number;
  conditions?: NpcCondition[];
}

export interface NpcQuestBinding {
  questId: string;
  role: 'giver' | 'target' | 'receiver' | 'enemy' | 'escort' | 'trainer' | 'lore_source';
  conditions?: NpcCondition[];
}

export interface NpcBehaviorData {
  scheduleId?: string;
  patrolZoneId?: string;
  movementRadius?: number;
  aggressionRadius?: number;
  interactionRadius?: number;
  fleeAtHpPercent?: number;
  callsGuards?: boolean;
  attacksEnemiesOfFaction?: boolean;
  dailyRoutineText?: string;
}

export interface NpcCondition {
  id: string;
  type:
    | 'quest_active'
    | 'quest_completed'
    | 'quest_not_started'
    | 'quest_failed'
    | 'player_level'
    | 'player_race'
    | 'player_profession'
    | 'faction_reputation'
    | 'kingdom_reputation'
    | 'has_item'
    | 'has_quest_item'
    | 'time_of_day'
    | 'global_flag'
    | 'npc_alive'
    | 'npc_dead';
  key?: string;
  operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value?: string | number | boolean;
}

export interface NpcQuestAction {
  type:
    | 'startQuest'
    | 'completeObjective'
    | 'advanceQuest'
    | 'completeQuest'
    | 'failQuest'
    | 'setQuestFlag'
    | 'giveItem'
    | 'giveQuestItem'
    | 'takeItem'
    | 'takeQuestItem'
    | 'addReputation'
    | 'giveGold'
    | 'takeGold'
    | 'unlockDialogue'
    | 'unlockLocation';
  questId?: string;
  objectiveId?: string;
  key?: string;
  value?: string | number | boolean;
  targetId?: string;
  amount?: number;
}

export interface NpcValidationWorldData {
  questIds: string[];
  skillIds: string[];
  traderIds: string[];
  itemIds: string[];
  questItemIds: string[];
  zoneIds: string[];
  markerIds: string[];
  dialogueIds: string[];
  factionIds: string[];
  kingdomIds: string[];
  cityIds: string[];
  mapIds: string[];
}

export type QuestCategory =
  | 'global'
  | 'kingdom'
  | 'faction'
  | 'profession'
  | 'lore'
  | 'city'
  | 'npc'
  | 'random'
  | 'hidden'
  | 'repeatable';

export type QuestStatus = 'draft' | 'active' | 'disabled' | 'archived';

export type QuestRunStatus = 'not_started' | 'active' | 'completed' | 'failed' | 'abandoned';

export type QuestObjectiveType =
  | 'talk_to_npc'
  | 'enter_zone'
  | 'reach_marker'
  | 'kill_enemy'
  | 'collect_item'
  | 'deliver_item'
  | 'use_item'
  | 'pay_gold'
  | 'receive_gold'
  | 'choose_dialogue'
  | 'craft_item'
  | 'learn_profession'
  | 'gain_reputation'
  | 'wait_time'
  | 'read_book'
  | 'inspect_object'
  | 'survive_battle'
  | 'escort_npc';

export type QuestTriggerType =
  | 'npc_dialogue'
  | 'map_marker'
  | 'map_zone_enter'
  | 'item_use'
  | 'enemy_death'
  | 'global_event'
  | 'profession_unlock'
  | 'manual_admin'
  | 'random_zone_roll';

export type QuestRewardType =
  | 'gold'
  | 'experience'
  | 'item'
  | 'quest_item'
  | 'reputation'
  | 'title'
  | 'profession'
  | 'skill'
  | 'recipe'
  | 'unlock_dialogue'
  | 'unlock_location'
  | 'unlock_shop'
  | 'faction_access'
  | 'lore_entry';

export type QuestConditionType =
  | 'player_level'
  | 'player_race'
  | 'player_class'
  | 'player_profession'
  | 'kingdom_reputation'
  | 'faction_reputation'
  | 'has_item'
  | 'has_not_item'
  | 'quest_completed'
  | 'quest_not_completed'
  | 'quest_active'
  | 'npc_alive'
  | 'npc_dead'
  | 'time_of_day'
  | 'in_city'
  | 'in_kingdom'
  | 'stat_check'
  | 'flag_true'
  | 'flag_false'
  | 'gold_at_least';

export interface QuestDefinition {
  id: string;
  title: string;
  adminDescription: string;
  playerDescription: string;
  category: QuestCategory;
  status: QuestStatus;

  kingdomId?: string;
  factionId?: string;
  cityId?: string;
  npcId?: string;

  startCityId?: string;
  startLocationId?: string;
  targetCityId?: string;
  targetLocationId?: string;

  recommendedLevel?: number;
  minLevel?: number;
  maxLevel?: number;

  isRepeatable: boolean;
  isHidden: boolean;

  portraitUrl?: string;
  imageUrl?: string;
  bannerUrl?: string;

  steps: QuestStep[];
  triggers: QuestTrigger[];
  conditions: QuestCondition[];
  rewards: QuestReward[];
  failureConsequences: QuestReward[];

  flags?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export interface QuestStep {
  id: string;
  questId: string;
  title: string;
  journalText: string;
  order: number;
  objectives: QuestObjective[];
  nextStepId?: string;
  alternativeNextStepIds?: string[];
  failureStepId?: string;
  branchId?: string;
  imageUrl?: string;
}

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;

  targetId?: string;
  targetName?: string;
  requiredCount?: number;
  currentCount?: number;

  mapId?: string;
  markerId?: string;
  zoneId?: string;
  itemId?: string;
  questItemId?: string;
  npcId?: string;
  enemyId?: string;
  dialogueChoiceId?: string;

  isOptional?: boolean;
}

export interface QuestCondition {
  id: string;
  type: QuestConditionType;
  operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
  key?: string;
  value?: string | number | boolean;
  description?: string;
}

export interface QuestReward {
  id: string;
  type: QuestRewardType;
  targetId?: string;
  amount?: number;
  title?: string;
  description?: string;
}

export interface QuestTrigger {
  id: string;
  type: QuestTriggerType;

  npcId?: string;
  dialogueId?: string;
  dialogueNodeId?: string;
  dialogueChoiceId?: string;

  mapId?: string;
  markerId?: string;
  zoneId?: string;

  itemId?: string;
  questItemId?: string;
  enemyId?: string;

  chancePercent?: number;
  cooldownSeconds?: number;

  conditions?: QuestCondition[];
}

export interface PlayerQuestState {
  playerId: string;
  questId: string;
  status: QuestRunStatus;
  currentStepId?: string;

  completedStepIds: string[];
  completedObjectiveIds: string[];

  branchId?: string;
  flags: Record<string, unknown>;

  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  repeatCount?: number;
}

export interface QuestItemDefinition {
  id: string;
  name: string;
  description: string;

  iconUrl?: string;
  imageUrl?: string;

  linkedQuestId?: string;

  canDrop: boolean;
  canSell: boolean;
  canTrade: boolean;

  removeOnQuestComplete: boolean;
  showInQuestInventory: boolean;
}

export type QuestMarkerType =
  | 'quest_start'
  | 'quest_objective'
  | 'quest_finish'
  | 'npc_quest'
  | 'item_spawn'
  | 'enemy_spawn'
  | 'inspect_object'
  | 'hidden_location';

export interface QuestMarkerDefinition {
  id: string;
  mapId: string;
  x: number;
  y: number;
  type: QuestMarkerType;
  title: string;
  linkedQuestId?: string;
  linkedStepId?: string;
  linkedObjectiveId?: string;
  linkedNpcId?: string;
  icon?: string;
  visibleToPlayer: boolean;
  conditionIds: string[];
  imageUrl?: string;
}

export type QuestZoneType =
  | 'quest_area'
  | 'random_event_area'
  | 'danger_area'
  | 'faction_area'
  | 'kingdom_area'
  | 'city_area'
  | 'resource_area'
  | 'hidden_area';

export interface QuestZoneDefinition {
  id: string;
  mapId: string;
  title: string;
  type: QuestZoneType;
  polygon?: Array<[number, number]>;
  rectangle?: { x: number; y: number; width: number; height: number };
  layerPriority: number;
  color?: string;
  opacity?: number;
  linkedQuestIds: string[];
  randomQuestPoolIds: string[];
  chancePercent?: number;
  cooldownSeconds?: number;
  conditions: QuestCondition[];
  biome?: string;
  kingdomId?: string;
  factionId?: string;
  cityId?: string;
}

export interface QuestValidationResult {
  errors: string[];
  warnings: string[];
}

export interface QuestValidationWorldData {
  npcIds: string[];
  itemIds: string[];
  questItemIds: string[];
  professionIds: string[];
  markerIds: string[];
  zoneIds: string[];
  dialogueIds: string[];
  kingdoms: string[];
  factions: string[];
  cities: string[];
}

export interface RandomQuestCooldown {
  playerId: string;
  zoneId: string;
  expiresAt: number;
}

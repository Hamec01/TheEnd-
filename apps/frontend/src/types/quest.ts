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

export type QuestInteractionRequirementType =
  | 'quest_not_started'
  | 'quest_active'
  | 'quest_completed'
  | 'quest_failed'
  | 'objective_completed'
  | 'objective_not_completed'
  | 'step_completed'
  | 'step_not_completed'
  | 'has_item'
  | 'missing_item'
  | 'has_quest_item'
  | 'missing_quest_item'
  | 'has_skill'
  | 'missing_skill'
  | 'has_flag'
  | 'flag_equals'
  | 'race_is'
  | 'class_is'
  | 'level_min'
  | 'level_max'
  | 'faction_relation_min';

export interface QuestInteractionRequirement {
  type: QuestInteractionRequirementType;
  questId?: string;
  objectiveId?: string;
  stepId?: string;
  itemId?: string;
  questItemId?: string;
  skillId?: string;
  flagKey?: string;
  value?: unknown;
  raceId?: string;
  classId?: string;
  factionId?: string;
  amount?: number;
}

export type QuestInteractionEffectType =
  | 'complete_objective'
  | 'complete_step'
  | 'complete_quest'
  | 'start_quest'
  | 'fail_quest'
  | 'give_rewards'
  | 'add_reputation'
  | 'change_citizenship'
  | 'give_item'
  | 'take_item'
  | 'give_quest_item'
  | 'take_quest_item'
  | 'give_skill'
  | 'give_gold'
  | 'give_experience'
  | 'set_flag'
  | 'unlock_location'
  | 'unlock_dialogue'
  | 'open_dialogue'
  | 'open_shop'
  | 'start_combat';

export interface QuestInteractionEffect {
  type: QuestInteractionEffectType;
  questId?: string;
  objectiveId?: string;
  stepId?: string;
  itemId?: string;
  questItemId?: string;
  skillId?: string;
  dialogueId?: string;
  locationId?: string;
  shopId?: string;
  enemyId?: string;
  flagKey?: string;
  value?: unknown;
  amount?: number;
  factionId?: string;
  kingdomId?: string;
  reputationChanges?: Array<{
    factionId?: string;
    kingdomId?: string;
    amount: number;
  }>;
}

export interface QuestInteractionChoice {
  id: string;
  text: string;
  resultText?: string;
  imageId?: string;
  requirements?: QuestInteractionRequirement[];
  effects?: QuestInteractionEffect[];
  close?: boolean;

  // Legacy compatibility fields.
  completeObjectiveId?: string;
  completeStepId?: string;
  completeQuest?: boolean;
  giveRewards?: boolean;
  nextQuestId?: string;
  startQuestId?: string;
  setFlag?: {
    key: string;
    value: unknown;
  };
}

export type QuestInteractionTriggerType =
  | 'zone_inspect'
  | 'zone_enter'
  | 'marker_reached'
  | 'object_interact'
  | 'item_use'
  | 'npc_interact'
  | 'manual';

export interface QuestInteractionDefinition {
  id: string;
  title: string;
  triggerType: QuestInteractionTriggerType;

  zoneId?: string;
  markerId?: string;
  objectId?: string;
  itemId?: string;
  npcId?: string;

  questId?: string;
  stepId?: string;
  objectiveId?: string;

  text: string;
  imageId?: string;
  isActive?: boolean;
  requirements?: QuestInteractionRequirement[];
  choices: QuestInteractionChoice[];
  consumeOnUse?: boolean;
  hideAfterQuestCompleted?: boolean;
  hideAfterObjectiveCompleted?: boolean;
  hideAfterStepCompleted?: boolean;

  // Legacy compatibility fields.
  requiredQuestId?: string;
  requiredQuestStatus?: 'active' | 'completed' | 'failed';
  requiredObjectiveId?: string;
  requiredItemId?: string;
  requiredQuestItemId?: string;
}

export type QuestInteractionEvent =
  | { type: 'zone_inspect'; zoneId: string }
  | { type: 'zone_enter'; zoneId: string }
  | { type: 'marker_reached'; markerId: string; zoneId?: string }
  | { type: 'object_interact'; objectId: string; zoneId?: string }
  | { type: 'item_use'; itemId: string }
  | { type: 'npc_interact'; npcId: string }
  | { type: 'manual'; interactionId?: string };

export interface QuestInteractionEffectResult {
  logs: string[];
  completedQuestIds: string[];
  startedQuestIds: string[];
  grantedRewardLines: string[];
  events: Array<
    | { type: 'open_dialogue'; dialogueId: string }
    | { type: 'open_shop'; shopId?: string }
    | { type: 'start_combat'; enemyId?: string }
  >;
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

export type QuestMarkerVisibilityMode =
  | 'always'
  | 'nearby'
  | 'selectedQuestOnly'
  | 'discoveredOnly'
  | 'hidden';

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
  objectiveId?: string;
  linkedNpcId?: string;
  icon?: string;
  visibleToPlayer: boolean;
  conditionIds: string[];
  imageUrl?: string;
  isActive?: boolean;
  requirements?: QuestInteractionRequirement[];
  hideAfterQuestCompleted?: boolean;
  hideAfterObjectiveCompleted?: boolean;
  hideAfterStepCompleted?: boolean;
  showOnWorldMap?: boolean;
  showOnMiniMap?: boolean;
  worldMapVisibility?: QuestMarkerVisibilityMode;
  miniMapVisibility?: QuestMarkerVisibilityMode;
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
  skillIds: string[];
  professionIds: string[];
  markerIds: string[];
  zoneIds: string[];
  interactionQuestIds?: string[];
  dialogueCompletableQuestIds?: string[];
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

export interface DialogueDefinition {
  id: string;
  title: string;
  npcId?: string;
  status: 'draft' | 'active' | 'disabled';
  description?: string;
  startNodeId: string;
  introVoiceAssetId?: string;
  introMusicAssetId?: string;
  nodes: DialogueNode[];
  createdAt: string;
  updatedAt: string;
}

export interface DialogueNode {
  id: string;
  speaker: 'npc' | 'player' | 'system';
  text: string;
  portraitUrl?: string;
  imageUrl?: string;
  voiceAssetId?: string;
  soundAssetId?: string;
  choices: DialogueChoice[];
  conditions?: DialogueCondition[];
  actions?: DialogueAction[];
}

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  endsDialogue?: boolean;
  /**
   * Backward/forward compatibility with the newer dialogue schema used in TZ:
   * - `next` is an alias for `nextNodeId`
   * - `end` is an alias for `endsDialogue`
   */
  next?: string;
  end?: boolean;

  /**
   * Sugar fields (TZ) that are converted to actions at runtime.
   * Prefer using `actions[]` in admin, but keep these for imported content.
   */
  giveQuest?: string;
  completeQuest?: string;
  completeStep?:
    | string
    | {
        questId: string;
        stepId?: string;
      };
  completeObjective?:
    | string
    | {
        questId: string;
        objectiveId: string;
      };
  rewards?: unknown;

  conditions?: DialogueCondition[];
  actions?: DialogueAction[];
  effects?: DialogueAction[];

  hiddenIfConditionsFail?: boolean;
  disabledIfConditionsFail?: boolean;

  questIconMode?: 'none' | 'start' | 'continue' | 'complete' | 'locked';
}

export interface DialogueCondition {
  id: string;
  type:
    | 'quest_not_started'
    | 'quest_active'
    | 'quest_completed'
    | 'quest_failed'
    | 'objective_completed'
    | 'objective_not_completed'
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
    | 'faction_relation_min'
    | 'player_level'
    | 'player_race'
    | 'player_profession'
    | 'faction_reputation'
    | 'kingdom_reputation'
    | 'gold_at_least'
    | 'player_stat_min'
    | 'npc_disposition'
    | 'time_of_day'
    | 'global_flag'
    | 'quest_flag';
  key?: string;
  operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value?: string | number | boolean;

  // Compatibility with TZ-style conditions (camelCase + explicit fields).
  // These fields are optional and ignored by existing editors.
  questId?: string;
  objectiveId?: string;
  itemId?: string;
  questItemId?: string;
}

export interface DialogueAction {
  id?: string;
  type:
    | 'startQuest'
    | 'start_quest'
    | 'completeObjective'
    | 'complete_objective'
    | 'completeStep'
    | 'complete_step'
    | 'advanceQuest'
    | 'completeQuest'
    | 'complete_quest'
    | 'failQuest'
    | 'fail_quest'
    | 'giveRewards'
    | 'give_rewards'
    | 'setQuestFlag'
    | 'set_flag'
    | 'giveItem'
    | 'give_item'
    | 'takeItem'
    | 'take_item'
    | 'giveQuestItem'
    | 'give_quest_item'
    | 'takeQuestItem'
    | 'take_quest_item'
    | 'giveGold'
    | 'give_gold'
    | 'takeGold'
    | 'take_gold'
    | 'giveExperience'
    | 'give_experience'
    | 'addReputation'
    | 'openShop'
    | 'open_shop'
    | 'startCombat'
    | 'start_combat'
    | 'trainSkill'
    | 'give_skill'
    | 'unlockLocation'
    | 'unlock_location'
    | 'unlockDialogue'
    | 'unlock_dialogue'
    | 'openDialogue'
    | 'open_dialogue'
    | 'openTraining'
    | 'open_training'
    | 'openMine'
    | 'open_mine'
    | 'healPlayerFull'
    | 'heal_player_full'
    | 'fullHeal'
    | 'full_heal'
    | 'restoreHp'
    | 'restore_hp'
    | 'heal'
    | 'setNpcDisposition'
    | 'setGlobalFlag';
  npcId?: string;
  merchantId?: string;
  trainerNpcId?: string;
  questId?: string;
  objectiveId?: string;
  itemId?: string;
  questItemId?: string;
  skillId?: string;
  factionId?: string;
  kingdomId?: string;
  locationId?: string;
  key?: string;
  value?: string | number | boolean;
  amount?: number;
  mode?: string;
  costGold?: number;
  mineId?: string;
  action?: string;
  payload?: {
    mineId?: string;
    [key: string]: unknown;
  };
}

export interface DialogueValidationWorldData {
  npcIds: string[];
  questIds: string[];
  itemIds: string[];
  questItemIds: string[];
  skillIds: string[];
  factionIds: string[];
  kingdomIds: string[];
  locationIds: string[];
}

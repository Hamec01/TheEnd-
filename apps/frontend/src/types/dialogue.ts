export interface DialogueDefinition {
  id: string;
  title: string;
  npcId?: string;
  status: 'draft' | 'active' | 'disabled';
  description?: string;
  startNodeId: string;
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
  choices: DialogueChoice[];
  conditions?: DialogueCondition[];
  actions?: DialogueAction[];
}

export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId?: string;
  endsDialogue?: boolean;

  conditions?: DialogueCondition[];
  actions?: DialogueAction[];

  hiddenIfConditionsFail?: boolean;
  disabledIfConditionsFail?: boolean;

  questIconMode?: 'none' | 'start' | 'continue' | 'complete' | 'locked';
}

export interface DialogueCondition {
  id: string;
  type:
    | 'quest_active'
    | 'quest_completed'
    | 'quest_not_started'
    | 'quest_failed'
    | 'objective_completed'
    | 'has_item'
    | 'has_quest_item'
    | 'player_level'
    | 'player_race'
    | 'player_profession'
    | 'faction_reputation'
    | 'kingdom_reputation'
    | 'gold_at_least'
    | 'npc_disposition'
    | 'time_of_day'
    | 'global_flag'
    | 'quest_flag';
  key?: string;
  operator?: '==' | '!=' | '>' | '>=' | '<' | '<=';
  value?: string | number | boolean;
}

export interface DialogueAction {
  id: string;
  type:
    | 'startQuest'
    | 'completeObjective'
    | 'advanceQuest'
    | 'completeQuest'
    | 'failQuest'
    | 'setQuestFlag'
    | 'giveItem'
    | 'takeItem'
    | 'giveQuestItem'
    | 'takeQuestItem'
    | 'giveGold'
    | 'takeGold'
    | 'addReputation'
    | 'openShop'
    | 'startCombat'
    | 'trainSkill'
    | 'unlockLocation'
    | 'unlockDialogue'
    | 'setNpcDisposition'
    | 'setGlobalFlag';
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

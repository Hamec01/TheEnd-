import type { DialogueDefinition, DialogueValidationWorldData } from '../types/dialogue';

function hasId(list: string[], id: string | undefined): boolean {
  if (!id) {
    return true;
  }
  return list.includes(id);
}

function normalizeConditionType(type: string): string {
  switch (type) {
    case 'level_min':
      return 'player_level';
    case 'level_max':
      return 'player_level';
    case 'race_is':
      return 'player_race';
    case 'class_is':
      return 'player_profession';
    case 'faction_relation_min':
      return 'faction_reputation';
    default:
      return type;
  }
}

function normalizeActionType(type: string): string {
  switch (type) {
    case 'start_quest':
      return 'startQuest';
    case 'complete_objective':
      return 'completeObjective';
    case 'complete_step':
      return 'completeStep';
    case 'complete_quest':
      return 'completeQuest';
    case 'fail_quest':
      return 'failQuest';
    case 'give_rewards':
      return 'giveRewards';
    case 'set_flag':
      return 'setQuestFlag';
    case 'give_item':
      return 'giveItem';
    case 'take_item':
      return 'takeItem';
    case 'give_quest_item':
      return 'giveQuestItem';
    case 'take_quest_item':
      return 'takeQuestItem';
    case 'give_gold':
      return 'giveGold';
    case 'give_experience':
      return 'giveExperience';
    case 'give_skill':
      return 'trainSkill';
    case 'open_shop':
      return 'openShop';
    case 'start_combat':
      return 'startCombat';
    case 'unlock_location':
      return 'unlockLocation';
    case 'unlock_dialogue':
      return 'unlockDialogue';
    case 'open_dialogue':
      return 'openDialogue';
    default:
      return type;
  }
}

export function validateDialogue(
  dialogue: DialogueDefinition,
  worldData: DialogueValidationWorldData,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (dialogue.status === 'active' && !dialogue.title.trim()) {
    errors.push('Active dialogue must have a title.');
  }

  if (!dialogue.startNodeId.trim()) {
    errors.push('Dialogue startNodeId is missing.');
  }

  const duplicateNodeIds = dialogue.nodes
    .map((node) => node.id)
    .filter((id, index, list) => list.indexOf(id) !== index);
  if (duplicateNodeIds.length > 0) {
    errors.push(`Duplicate node ids: ${Array.from(new Set(duplicateNodeIds)).join(', ')}`);
  }

  const nodeMap = new Map(dialogue.nodes.map((node) => [node.id, node]));
  if (!nodeMap.has(dialogue.startNodeId)) {
    errors.push(`Start node does not exist: ${dialogue.startNodeId}.`);
  }

  if (dialogue.npcId && !hasId(worldData.npcIds, dialogue.npcId)) {
    errors.push(`Dialogue linked to missing NPC: ${dialogue.npcId}.`);
  }

  for (const node of dialogue.nodes) {
    if (node.choices.length === 0 && !node.actions?.length) {
      warnings.push(`Node '${node.id}' has no choices and no actions.`);
    }

    if (node.choices.length > 8) {
      warnings.push(`Node '${node.id}' has more than 8 choices.`);
    }

    for (const choice of node.choices) {
      const nextNodeId = choice.nextNodeId ?? choice.next;
      const endsDialogue = Boolean(choice.endsDialogue ?? choice.end);

      if (!nextNodeId && !endsDialogue) {
        warnings.push(`Choice '${choice.id}' has no next/end.`);
      }

      if (nextNodeId && !nodeMap.has(nextNodeId)) {
        errors.push(`Choice '${choice.id}' points to missing next node '${nextNodeId}'.`);
      }

      if (choice.questIconMode && choice.questIconMode !== 'none') {
        const hasQuestAction = (choice.actions ?? []).some((action) => action.questId || action.type === 'startQuest' || action.type === 'advanceQuest' || action.type === 'completeQuest');
        if (!hasQuestAction) {
          warnings.push(`Choice '${choice.id}' has questIconMode but no quest action.`);
        }
      }

      if (choice.giveQuest && !hasId(worldData.questIds, choice.giveQuest)) {
        errors.push(`Choice '${choice.id}' gives missing quest '${choice.giveQuest}'.`);
      }
      if (choice.completeQuest && !hasId(worldData.questIds, choice.completeQuest)) {
        errors.push(`Choice '${choice.id}' completes missing quest '${choice.completeQuest}'.`);
      }
      if (choice.completeStep && typeof choice.completeStep === 'object' && choice.completeStep.questId && !hasId(worldData.questIds, choice.completeStep.questId)) {
        errors.push(`Choice '${choice.id}' completeStep references missing quest '${choice.completeStep.questId}'.`);
      }
      if (choice.completeObjective && typeof choice.completeObjective === 'object' && choice.completeObjective.questId && !hasId(worldData.questIds, choice.completeObjective.questId)) {
        errors.push(`Choice '${choice.id}' completeObjective references missing quest '${choice.completeObjective.questId}'.`);
      }

      for (const action of choice.actions ?? []) {
        const actionType = normalizeActionType(action.type);
        if (!hasId(worldData.questIds, action.questId)) {
          errors.push(`Action '${action.id}' has missing quest '${action.questId}'.`);
        }
        if (!hasId(worldData.itemIds, action.itemId)) {
          errors.push(`Action '${action.id}' has missing item '${action.itemId}'.`);
        }
        if (!hasId(worldData.questItemIds, action.questItemId)) {
          errors.push(`Action '${action.id}' has missing quest item '${action.questItemId}'.`);
        }
        if (!hasId(worldData.skillIds, action.skillId)) {
          errors.push(`Action '${action.id}' has missing skill '${action.skillId}'.`);
        }
        if (!hasId(worldData.locationIds, action.locationId)) {
          errors.push(`Action '${action.id}' has missing location '${action.locationId}'.`);
        }

        if (actionType === 'startQuest' && !action.questId) {
          warnings.push(`Action '${action.id}' startQuest is missing questId.`);
        }
        if (actionType === 'completeQuest' && !action.questId) {
          warnings.push(`Action '${action.id}' completeQuest is missing questId.`);
        }
        if ((actionType === 'advanceQuest' || actionType === 'failQuest') && !action.questId) {
          warnings.push(`Action '${action.id}' ${action.type} is missing questId.`);
        }
        if (actionType === 'completeObjective' && (!action.questId || !action.objectiveId)) {
          warnings.push(`Action '${action.id}' completeObjective is missing questId/objectiveId.`);
        }
        if (actionType === 'completeStep' && !action.questId) {
          warnings.push(`Action '${action.id}' completeStep is missing questId.`);
        }
      }

      for (const condition of choice.conditions ?? []) {
        const conditionType = normalizeConditionType(condition.type);
        if (
          (conditionType.includes('quest') || conditionType === 'objective_completed' || conditionType === 'objective_not_completed')
          && typeof (condition.questId ?? condition.value) === 'string'
          && !hasId(worldData.questIds, String(condition.questId ?? condition.value))
        ) {
          errors.push(`Condition '${condition.id}' references missing quest '${condition.value}'.`);
        }
        if ((conditionType === 'has_item' || conditionType === 'missing_item') && typeof (condition.itemId ?? condition.value) === 'string' && !hasId(worldData.itemIds, String(condition.itemId ?? condition.value))) {
          errors.push(`Condition '${condition.id}' references missing item '${condition.value}'.`);
        }
        if ((conditionType === 'has_quest_item' || conditionType === 'missing_quest_item') && typeof (condition.questItemId ?? condition.value) === 'string' && !hasId(worldData.questItemIds, String(condition.questItemId ?? condition.value))) {
          errors.push(`Condition '${condition.id}' references missing quest item '${condition.value}'.`);
        }
        if ((conditionType === 'faction_reputation' || conditionType === 'faction_relation_min') && condition.key && !hasId(worldData.factionIds, condition.key)) {
          errors.push(`Condition '${condition.id}' references missing faction '${condition.key}'.`);
        }
      }
    }
  }

  if (!dialogue.nodes.some((node) => node.portraitUrl || node.imageUrl)) {
    warnings.push('Dialogue has no NPC portrait/image on nodes.');
  }

  return { errors, warnings };
}

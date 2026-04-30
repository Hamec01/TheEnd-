import type { DialogueDefinition, DialogueValidationWorldData } from '../types/dialogue';

function hasId(list: string[], id: string | undefined): boolean {
  if (!id) {
    return true;
  }
  return list.includes(id);
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

  const nodeMap = new Map(dialogue.nodes.map((node) => [node.id, node]));
  if (!nodeMap.has(dialogue.startNodeId)) {
    errors.push(`Start node does not exist: ${dialogue.startNodeId}.`);
  }

  if (dialogue.npcId && !hasId(worldData.npcIds, dialogue.npcId)) {
    errors.push(`Dialogue linked to missing NPC: ${dialogue.npcId}.`);
  }

  for (const node of dialogue.nodes) {
    if (node.choices.length === 0 && !node.actions?.length) {
      warnings.push(`Node '${node.id}' has no choices.`);
    }

    if (node.choices.length > 8) {
      warnings.push(`Node '${node.id}' has more than 8 choices.`);
    }

    for (const choice of node.choices) {
      if (choice.nextNodeId && !nodeMap.has(choice.nextNodeId)) {
        errors.push(`Choice '${choice.id}' points to missing nextNodeId '${choice.nextNodeId}'.`);
      }

      if (choice.questIconMode && choice.questIconMode !== 'none') {
        const hasQuestAction = (choice.actions ?? []).some((action) => action.questId || action.type === 'startQuest' || action.type === 'advanceQuest' || action.type === 'completeQuest');
        if (!hasQuestAction) {
          warnings.push(`Choice '${choice.id}' has questIconMode but no quest action.`);
        }
      }

      for (const action of choice.actions ?? []) {
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
      }

      for (const condition of choice.conditions ?? []) {
        if ((condition.type.includes('quest') || condition.type === 'objective_completed') && typeof condition.value === 'string' && !hasId(worldData.questIds, condition.value)) {
          errors.push(`Condition '${condition.id}' references missing quest '${condition.value}'.`);
        }
        if (condition.type === 'has_item' && typeof condition.value === 'string' && !hasId(worldData.itemIds, condition.value)) {
          errors.push(`Condition '${condition.id}' references missing item '${condition.value}'.`);
        }
        if (condition.type === 'has_quest_item' && typeof condition.value === 'string' && !hasId(worldData.questItemIds, condition.value)) {
          errors.push(`Condition '${condition.id}' references missing quest item '${condition.value}'.`);
        }
        if (condition.type === 'faction_reputation' && condition.key && !hasId(worldData.factionIds, condition.key)) {
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

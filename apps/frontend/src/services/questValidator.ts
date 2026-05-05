import type {
  QuestDefinition,
  QuestReward,
  QuestTrigger,
  QuestValidationResult,
  QuestValidationWorldData,
} from '../types/quest';

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function hasId(list: string[], id: string | undefined): boolean {
  if (!id) {
    return true;
  }
  const normalizedId = id.trim();
  return list.some((entry) => String(entry).trim() === normalizedId);
}

function validateRewardReferences(
  reward: QuestReward,
  worldData: QuestValidationWorldData,
  errors: string[],
): void {
  if (!reward.targetId) {
    return;
  }

  if (reward.type === 'item' && !hasId(worldData.itemIds, reward.targetId)) {
    errors.push(`Reward '${reward.id}' references missing item '${reward.targetId}'.`);
  }
  if (reward.type === 'quest_item' && !hasId(worldData.questItemIds, reward.targetId)) {
    errors.push(`Reward '${reward.id}' references missing quest item '${reward.targetId}'.`);
  }
  if (reward.type === 'profession' && !hasId(worldData.professionIds, reward.targetId)) {
    errors.push(`Reward '${reward.id}' references missing profession '${reward.targetId}'.`);
  }
}

function validateTrigger(trigger: QuestTrigger, worldData: QuestValidationWorldData, errors: string[]): void {
  if (trigger.npcId && !hasId(worldData.npcIds, trigger.npcId)) {
    errors.push(`Trigger '${trigger.id}' references missing NPC '${trigger.npcId}'.`);
  }
  if (trigger.dialogueId && !hasId(worldData.dialogueIds, trigger.dialogueId)) {
    errors.push(`Trigger '${trigger.id}' references missing dialogue '${trigger.dialogueId}'.`);
  }
  if (trigger.zoneId && !hasId(worldData.zoneIds, trigger.zoneId)) {
    errors.push(`Trigger '${trigger.id}' references missing zone '${trigger.zoneId}'.`);
  }
  if (trigger.markerId && !hasId(worldData.markerIds, trigger.markerId)) {
    errors.push(`Trigger '${trigger.id}' references missing marker '${trigger.markerId}'.`);
  }
  if (trigger.itemId && !hasId(worldData.itemIds, trigger.itemId)) {
    errors.push(`Trigger '${trigger.id}' references missing item '${trigger.itemId}'.`);
  }
  if (trigger.questItemId && !hasId(worldData.questItemIds, trigger.questItemId)) {
    errors.push(`Trigger '${trigger.id}' references missing quest item '${trigger.questItemId}'.`);
  }

  if (trigger.type === 'random_zone_roll') {
    if (!trigger.chancePercent || trigger.chancePercent <= 0) {
      errors.push(`Random trigger '${trigger.id}' must define chancePercent.`);
    }
    if (!trigger.cooldownSeconds || trigger.cooldownSeconds <= 0) {
      errors.push(`Random trigger '${trigger.id}' must define cooldownSeconds.`);
    }
  }

  if (trigger.type === 'map_zone_enter' && !trigger.zoneId) {
    errors.push(`Map zone trigger '${trigger.id}' must define zoneId.`);
  }
}

export function validateQuest(quest: QuestDefinition, worldData: QuestValidationWorldData): QuestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const steps = asArray(quest.steps);
  const triggers = asArray(quest.triggers);
  const rewards = asArray(quest.rewards);
  const failureConsequences = asArray(quest.failureConsequences);

  if (quest.status === 'active' && !quest.title.trim()) {
    errors.push('Active quest must have a title.');
  }
  if (quest.status === 'active' && triggers.length === 0) {
    const completableByInteraction = Boolean(worldData.interactionQuestIds?.includes(quest.id));
    const completableByDialogue = Boolean(worldData.dialogueCompletableQuestIds?.includes(quest.id));
    if (!completableByInteraction && !completableByDialogue) {
      errors.push('Active quest must have at least one trigger or a completion path via interaction/dialogue effects.');
    }
  }
  if (quest.status === 'active' && steps.length === 0) {
    errors.push('Active quest must have at least one step.');
  }

  const stepIds = new Set(steps.map((step) => step.id));

  for (const step of steps) {
    const objectives = asArray(step.objectives);
    if (objectives.length === 0) {
      errors.push(`Step '${step.id}' has no objectives.`);
    }
    if (step.nextStepId && !stepIds.has(step.nextStepId)) {
      errors.push(`Step '${step.id}' references missing nextStepId '${step.nextStepId}'.`);
    }
    for (const alternativeId of step.alternativeNextStepIds ?? []) {
      if (!stepIds.has(alternativeId)) {
        errors.push(`Step '${step.id}' references missing alternativeNextStepId '${alternativeId}'.`);
      }
    }
    if (step.failureStepId && !stepIds.has(step.failureStepId)) {
      errors.push(`Step '${step.id}' references missing failureStepId '${step.failureStepId}'.`);
    }

    for (const objective of objectives) {
      if (objective.npcId && !hasId(worldData.npcIds, objective.npcId)) {
        errors.push(`Objective '${objective.id}' references missing NPC '${objective.npcId}'.`);
      }
      if (objective.itemId && !hasId(worldData.itemIds, objective.itemId)) {
        errors.push(`Objective '${objective.id}' references missing item '${objective.itemId}'.`);
      }
      if (objective.questItemId && !hasId(worldData.questItemIds, objective.questItemId)) {
        errors.push(`Objective '${objective.id}' references missing quest item '${objective.questItemId}'.`);
      }
      if (objective.zoneId && !hasId(worldData.zoneIds, objective.zoneId)) {
        errors.push(`Objective '${objective.id}' references missing zone '${objective.zoneId}'.`);
      }
      if (objective.markerId && !hasId(worldData.markerIds, objective.markerId)) {
        errors.push(`Objective '${objective.id}' references missing marker '${objective.markerId}'.`);
      }
    }
  }

  for (const trigger of triggers) {
    validateTrigger(trigger, worldData, errors);
    if (trigger.type === 'random_zone_roll' && (trigger.chancePercent ?? 0) > 50) {
      warnings.push(`Random trigger '${trigger.id}' chancePercent is above 50.`);
    }
  }

  for (const reward of [...rewards, ...failureConsequences]) {
    validateRewardReferences(reward, worldData, errors);
  }

  if (!quest.portraitUrl && !quest.imageUrl && !quest.bannerUrl) {
    warnings.push('Quest has no portrait/image/banner.');
  }
  if (rewards.length === 0) {
    warnings.push('Quest has no rewards.');
  }
  if (failureConsequences.length === 0) {
    warnings.push('Quest has no failure consequences.');
  }
  if (quest.isHidden && triggers.some((trigger) => trigger.type === 'map_marker')) {
    warnings.push('Hidden quest has visible marker trigger.');
  }
  if (quest.isRepeatable && rewards.some((reward) => reward.type === 'quest_item')) {
    warnings.push('Repeatable quest gives quest_item reward. Ensure this item can be duplicated.');
  }
  if (quest.adminDescription.trim() && !quest.playerDescription.trim()) {
    warnings.push('Quest has admin description but no player description.');
  }

  return { errors, warnings };
}

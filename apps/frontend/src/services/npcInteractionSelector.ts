import type { DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';
import type { PlayerQuestState, QuestDefinition, QuestObjective } from '../types/quest';
import type { QuestRuntimePlayer } from './questRuntime';
import { canStartQuest } from './questRuntime';
import { getQuestById } from './questRepository';
import { evaluateDialogueConditions, getStartNode } from './dialogueRuntime';
import { isDialogueCompleted } from './dialogueProgressStore';

export type BestNpcInteraction =
  | { kind: 'quest_scene'; npcId: string; questStages: QuestNpcStage[] }
  | { kind: 'dialogue'; npcId: string; dialogueId: string }
  | { kind: 'npc_menu'; npcId: string };

export interface QuestNpcStage {
  questId: string;
  questTitle: string;
  stepId: string | null;
  stepTitle: string | null;
  journalText: string | null;
  objectives: Array<{ id: string; text: string; completed: boolean }>;
}

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function objectiveNpcId(objective: QuestObjective): string | null {
  if (typeof objective.npcId === 'string' && objective.npcId.trim()) {
    return objective.npcId.trim();
  }
  if (typeof objective.targetId === 'string' && objective.type === 'talk_to_npc') {
    return objective.targetId.trim();
  }
  return null;
}

function currentStep(quest: QuestDefinition, state: PlayerQuestState) {
  const steps = asArray(quest.steps);
  if (!state.currentStepId) {
    return steps[0] ?? null;
  }
  return steps.find((step) => step.id === state.currentStepId) ?? steps[0] ?? null;
}

function buildQuestStage(npcId: string, quest: QuestDefinition, state: PlayerQuestState): QuestNpcStage | null {
  const step = currentStep(quest, state);
  if (!step) {
    return null;
  }

  const objectives = asArray(step.objectives)
    .filter((objective) => objectiveNpcId(objective) === npcId)
    .map((objective) => ({
      id: objective.id,
      text: objective.description || objective.id,
      completed: state.completedObjectiveIds.includes(objective.id),
    }));

  if (objectives.length === 0) {
    return null;
  }

  return {
    questId: quest.id,
    questTitle: quest.title,
    stepId: step.id ?? null,
    stepTitle: step.title ?? null,
    journalText: step.journalText ?? null,
    objectives,
  };
}

function dialogueHasQuestActions(dialogue: DialogueDefinition): boolean {
  const nodes = asArray(dialogue.nodes);
  for (const node of nodes) {
    for (const action of asArray(node.actions)) {
      if (action.questId || action.type.includes('Quest') || action.type.includes('Objective') || action.type === 'advanceQuest') {
        return true;
      }
    }
    for (const choice of asArray(node.choices)) {
      if ((choice as any).giveQuest || (choice as any).completeQuest || (choice as any).completeObjective || (choice as any).completeStep) {
        return true;
      }
      for (const action of asArray(choice.actions)) {
        if (action.questId || action.type.includes('Quest') || action.type.includes('Objective') || action.type === 'advanceQuest') {
          return true;
        }
      }
    }
  }
  return false;
}

function dialogueHasQuestStart(dialogue: DialogueDefinition): boolean {
  const nodes = asArray(dialogue.nodes);
  for (const node of nodes) {
    for (const choice of asArray(node.choices)) {
      if ((choice as any).giveQuest) {
        return true;
      }
      for (const action of asArray(choice.actions)) {
        if (action.type === 'startQuest' && typeof action.questId === 'string' && action.questId.trim()) {
          return true;
        }
      }
    }
    for (const action of asArray(node.actions)) {
      if (action.type === 'startQuest' && typeof action.questId === 'string' && action.questId.trim()) {
        return true;
      }
    }
  }
  return false;
}

function dialogueStartsStartableQuest(dialogue: DialogueDefinition, player: QuestRuntimePlayer): boolean {
  const nodes = asArray(dialogue.nodes);
  const questIds: string[] = [];

  for (const node of nodes) {
    for (const action of asArray(node.actions)) {
      if (action.type === 'startQuest' && typeof action.questId === 'string' && action.questId.trim()) {
        questIds.push(action.questId.trim());
      }
    }
    for (const choice of asArray(node.choices)) {
      const giveQuest = (choice as any).giveQuest;
      if (typeof giveQuest === 'string' && giveQuest.trim()) {
        questIds.push(giveQuest.trim());
      }
      for (const action of asArray(choice.actions)) {
        if (action.type === 'startQuest' && typeof action.questId === 'string' && action.questId.trim()) {
          questIds.push(action.questId.trim());
        }
      }
    }
  }

  for (const questId of questIds) {
    const quest = getQuestById(questId);
    if (!quest) {
      continue;
    }
    if (canStartQuest(player, quest)) {
      return true;
    }
  }

  return false;
}

function dialogueIsQuestRelatedByConditions(dialogue: DialogueDefinition): boolean {
  const nodes = asArray(dialogue.nodes);
  for (const node of nodes) {
    const allConditions = [...asArray(node.conditions)];
    for (const choice of asArray(node.choices)) {
      allConditions.push(...asArray(choice.conditions));
    }
    for (const condition of allConditions) {
      const t = String((condition as any).type ?? '');
      if (t.includes('quest') || t.includes('objective') || t.includes('Quest') || t.includes('Objective')) {
        return true;
      }
    }
  }
  return false;
}

function dialogueAvailable(player: QuestRuntimePlayer, npc: NpcDefinition, dialogue: DialogueDefinition): boolean {
  if (dialogue.status !== 'active') {
    return false;
  }
  const start = getStartNode(dialogue);
  if (!start) {
    return false;
  }
  return evaluateDialogueConditions(player, npc, asArray(start.conditions));
}

function pickDialogueNodeById(dialogue: DialogueDefinition, nodeId: string): DialogueNode | null {
  return asArray(dialogue.nodes).find((node) => node.id === nodeId) ?? null;
}

function dialogueHasValidStart(dialogue: DialogueDefinition): boolean {
  if (!dialogue.startNodeId?.trim()) {
    return false;
  }
  return Boolean(pickDialogueNodeById(dialogue, dialogue.startNodeId));
}

export function selectBestInteractionForNpc(params: {
  npc: NpcDefinition;
  player: QuestRuntimePlayer;
  questDefinitions: QuestDefinition[];
  playerQuestStates: PlayerQuestState[];
  dialogues: DialogueDefinition[];
}): BestNpcInteraction {
  const { npc, player, questDefinitions, playerQuestStates, dialogues } = params;

  // 1) Quest scene if NPC participates in an ACTIVE quest stage.
  const activeStates = playerQuestStates.filter((state) => state.playerId === player.id && state.status === 'active');
  const questById = new Map(questDefinitions.map((quest) => [quest.id, quest]));

  const stages: QuestNpcStage[] = [];
  for (const state of activeStates) {
    const quest = questById.get(state.questId) ?? null;
    if (!quest) {
      continue;
    }
    const stage = buildQuestStage(npc.id, quest, state);
    if (stage) {
      stages.push(stage);
    }
  }

  if (stages.length > 0) {
    // Prefer stages with any incomplete objective first.
    const sorted = [...stages].sort((a, b) => {
      const aIncomplete = a.objectives.some((o) => !o.completed) ? 1 : 0;
      const bIncomplete = b.objectives.some((o) => !o.completed) ? 1 : 0;
      return bIncomplete - aIncomplete;
    });
    return { kind: 'quest_scene', npcId: npc.id, questStages: sorted };
  }

  // 2-4) Best dialogue selection.
  const bindingPriorityByDialogueId = new Map<string, number>(
    (npc.dialogues ?? []).map((binding) => [binding.dialogueId, Number(binding.priority ?? 0)]),
  );

  const allowDialogue = (dialogue: DialogueDefinition): boolean => {
    const record = isDialogueCompleted(npc.id, dialogue.id);
    if (!record) {
      return true;
    }
    if (record.questId) {
      const quest = getQuestById(record.questId);
      if (quest?.isRepeatable) {
        return true;
      }
    }
    return false;
  };

  const candidates = dialogues
    .filter((dialogue) => dialogueAvailable(player, npc, dialogue))
    .filter((dialogue) => dialogueHasValidStart(dialogue))
    .filter((dialogue) => allowDialogue(dialogue));

  const scoreDialogue = (dialogue: DialogueDefinition): number => {
    const bindingPriority = bindingPriorityByDialogueId.get(dialogue.id) ?? 0;

    const hasQuestActions = dialogueHasQuestActions(dialogue);
    const hasQuestStart = dialogueHasQuestStart(dialogue);
    const questRelatedByConditions = dialogueIsQuestRelatedByConditions(dialogue);

    // 1) quest continuation/turn-in are handled by quest_scene above.
    // 2) available quest start
    if (hasQuestStart && dialogueStartsStartableQuest(dialogue, player)) {
      return 4000 + bindingPriority;
    }
    // 3) quest-related dialogue by conditions/actions
    if (hasQuestActions || questRelatedByConditions) {
      return 3000 + bindingPriority;
    }
    // 4) normal active NPC dialogue
    return 2000 + bindingPriority;
  };

  const sorted = [...candidates].sort((a, b) => scoreDialogue(b) - scoreDialogue(a));
  const best = sorted[0] ?? null;
  if (best) {
    return { kind: 'dialogue', npcId: npc.id, dialogueId: best.id };
  }

  // 5) fallback NPC menu
  return { kind: 'npc_menu', npcId: npc.id };
}

export function selectQuestStartAvailable(params: {
  npc: NpcDefinition;
  player: QuestRuntimePlayer;
}): Array<{ questId: string; title: string }> {
  const { npc, player } = params;
  const bindings = asArray(npc.questBindings).filter((binding) => binding.role === 'giver' && Boolean(binding.questId));

  const available: Array<{ questId: string; title: string }> = [];
  for (const binding of bindings) {
    const quest = getQuestById(binding.questId);
    if (!quest) {
      continue;
    }
    if (canStartQuest(player, quest)) {
      available.push({ questId: quest.id, title: quest.title });
    }
  }
  return available;
}

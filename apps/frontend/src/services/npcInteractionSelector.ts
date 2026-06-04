import type { DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';
import type { PlayerQuestState, QuestDefinition, QuestObjective } from '../types/quest';
import type { QuestRuntimePlayer } from './questRuntime';
import { canStartQuest } from './questRuntime';
import { getQuestById } from './questRepository';
import { evaluateDialogueConditions, getStartNode } from './dialogueRuntime';
import { resolveCharacterScopedStorageKey } from './characterScopedStorage';

export type BestNpcInteraction =
  | { kind: 'quest_scene'; npcId: string; questStages: QuestNpcStage[] }
  | { kind: 'dialogue'; npcId: string; dialogueId: string }
  | { kind: 'npc_menu'; npcId: string };

export type NpcQuestMarkerMode = 'available' | 'progress' | null;

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

const DIALOGUE_CONDITION_ALIASES: Record<string, string> = {
  playerLevel: 'player_level',
  playerRace: 'player_race',
  playerRaceNot: 'player_race_not',
  playerOrigin: 'player_origin',
  playerOriginNot: 'player_origin_not',
  playerKingdom: 'player_kingdom',
  playerKingdomNot: 'player_kingdom_not',
  playerProfession: 'player_profession',
  statCheck: 'stat_check',
  questActive: 'quest_active',
  questCompleted: 'quest_completed',
  questNotStarted: 'quest_not_started',
  objectiveNotCompleted: 'objective_not_completed',
  missingItem: 'missing_item',
  missingQuestItem: 'missing_quest_item',
  hasSkill: 'has_skill',
  missingSkill: 'missing_skill',
  hasFlag: 'has_flag',
  missingFlag: 'missing_flag',
  flagTrue: 'flag_true',
  flagFalse: 'flag_false',
  flagEquals: 'flag_equals',
  raceIs: 'race_is',
  classIs: 'class_is',
  levelMin: 'level_min',
  levelMax: 'level_max',
  factionRelationMin: 'faction_relation_min',
  questFailed: 'quest_failed',
  objectiveCompleted: 'objective_completed',
  hasItem: 'has_item',
  hasQuestItem: 'has_quest_item',
  goldAtLeast: 'gold_at_least',
  factionReputation: 'faction_reputation',
  kingdomReputation: 'kingdom_reputation',
  npcDisposition: 'npc_disposition',
  globalFlag: 'global_flag',
  questFlag: 'quest_flag',
};

const SUPPORTED_DIALOGUE_CONDITION_TYPES = new Set([
  'player_level',
  'player_race',
  'player_race_not',
  'player_origin',
  'player_origin_not',
  'player_kingdom',
  'player_kingdom_not',
  'player_profession',
  'stat_check',
  'quest_active',
  'quest_completed',
  'quest_not_started',
  'quest_failed',
  'objective_completed',
  'objective_not_completed',
  'has_item',
  'missing_item',
  'has_quest_item',
  'missing_quest_item',
  'has_skill',
  'missing_skill',
  'has_flag',
  'missing_flag',
  'flag_true',
  'flag_false',
  'flag_equals',
  'race_is',
  'class_is',
  'level_min',
  'level_max',
  'faction_relation_min',
  'faction_reputation',
  'kingdom_reputation',
  'gold_at_least',
  'npc_disposition',
  'global_flag',
  'quest_flag',
  'time_of_day',
]);

function normalizeDialogueConditionType(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) {
    return '';
  }
  return DIALOGUE_CONDITION_ALIASES[value] ?? value;
}

const PLAYER_FLAGS_KEY = 'theend.player.flags';

function readPlayerFlags(): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(resolveCharacterScopedStorageKey(PLAYER_FLAGS_KEY)) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeFlagKey(condition: any): string {
  return String(condition?.flagKey ?? condition?.key ?? condition?.value ?? '').trim();
}

function isFlagTruthy(value: unknown): boolean {
  return value === true;
}

function evaluateDialogueConditionsStrict(
  player: QuestRuntimePlayer,
  npc: NpcDefinition,
  conditions: Array<{ type?: string }> | undefined,
  context: string,
): boolean {
  const remainingConditions: any[] = [];
  const flags = readPlayerFlags();

  for (const condition of asArray(conditions) as any[]) {
    const normalizedType = normalizeDialogueConditionType(condition.type);
    if (!normalizedType || !SUPPORTED_DIALOGUE_CONDITION_TYPES.has(normalizedType)) {
      console.warn(`[npcQuestMarker] Unsupported condition type in ${context}: ${String(condition.type ?? '')}`);
      return false;
    }

    if (normalizedType === 'has_flag' || normalizedType === 'flag_true') {
      const key = normalizeFlagKey(condition);
      if (!key || !Object.prototype.hasOwnProperty.call(flags, key) || !isFlagTruthy(flags[key])) {
        return false;
      }
      continue;
    }

    if (normalizedType === 'missing_flag' || normalizedType === 'flag_false') {
      const key = normalizeFlagKey(condition);
      if (!key) {
        return false;
      }
      if (!Object.prototype.hasOwnProperty.call(flags, key) || flags[key] === false) {
        continue;
      }
      return false;
    }

    remainingConditions.push(condition);
  }

  return evaluateDialogueConditions(player, npc, remainingConditions);
}

function normalizeActionType(raw: unknown): string {
  return String(raw ?? '').trim().replace(/_/g, '').toLowerCase();
}

function getDialogueStartNodeStrict(player: QuestRuntimePlayer, npc: NpcDefinition, dialogue: DialogueDefinition): DialogueNode | null {
  if (dialogue.status !== 'active') {
    return null;
  }

  const configuredStart = dialogue.startNodeId?.trim()
    ? asArray(dialogue.nodes).find((node) => node.id === dialogue.startNodeId.trim()) ?? null
    : null;

  if (configuredStart && evaluateDialogueConditionsStrict(player, npc, configuredStart.conditions as Array<{ type?: string }> | undefined, `dialogue ${dialogue.id} start node ${configuredStart.id}`)) {
    return configuredStart;
  }

  for (const node of asArray(dialogue.nodes)) {
    if (evaluateDialogueConditionsStrict(player, npc, node.conditions as Array<{ type?: string }> | undefined, `dialogue ${dialogue.id} node ${node.id}`)) {
      return node;
    }
  }

  return null;
}

function getMarkerStartableQuestIds(player: QuestRuntimePlayer, questIds: string[]): string[] {
  const uniqueQuestIds = [...new Set(questIds.map((questId) => questId.trim()).filter(Boolean))];
  return uniqueQuestIds.filter((questId) => {
    const existing = player.activeQuestIds?.includes(questId)
      || player.completedQuestIds?.includes(questId)
      || false;
    if (existing) {
      return false;
    }
    const quest = getQuestById(questId);
    return Boolean(quest && canStartQuest(player, quest));
  });
}

function collectDialogueQuestStartIdsFromStartNode(player: QuestRuntimePlayer, npc: NpcDefinition, dialogue: DialogueDefinition): string[] {
  const startNode = getDialogueStartNodeStrict(player, npc, dialogue);
  if (!startNode) {
    return [];
  }

  const questIds: string[] = [];
  for (const action of asArray(startNode.actions)) {
    if (normalizeActionType(action.type) === 'startquest' && typeof action.questId === 'string' && action.questId.trim()) {
      questIds.push(action.questId.trim());
    }
  }

  for (const choice of asArray(startNode.choices)) {
    if (!evaluateDialogueConditionsStrict(player, npc, choice.conditions as Array<{ type?: string }> | undefined, `dialogue ${dialogue.id} choice ${choice.id}`)) {
      continue;
    }
    if (typeof choice.giveQuest === 'string' && choice.giveQuest.trim()) {
      questIds.push(choice.giveQuest.trim());
    }
    for (const action of asArray(choice.actions)) {
      if (normalizeActionType(action.type) === 'startquest' && typeof action.questId === 'string' && action.questId.trim()) {
        questIds.push(action.questId.trim());
      }
    }
  }

  return questIds;
}

function nodeHasQuestProgressActions(node: DialogueNode, activeQuestIds: Set<string>): boolean {
  const hasRelevantQuestId = (questId: string | undefined): boolean => {
    if (!questId) {
      return false;
    }
    return activeQuestIds.has(questId.trim());
  };

  for (const action of asArray(node.actions)) {
    const type = normalizeActionType(action.type);
    if (type === 'completeobjective' || type === 'completestep' || type === 'completequest' || type === 'advancequest') {
      if (!action.questId || hasRelevantQuestId(action.questId)) {
        return true;
      }
    }
    if ((type === 'giverewards' || type === 'givegold' || type === 'giveitem' || type === 'givequestitem') && action.questId && hasRelevantQuestId(action.questId)) {
      return true;
    }
  }

  for (const choice of asArray(node.choices)) {
    const completeStepQuestId = typeof choice.completeStep === 'object' && choice.completeStep ? choice.completeStep.questId : undefined;
    const completeObjectiveQuestId = typeof choice.completeObjective === 'object' && choice.completeObjective ? choice.completeObjective.questId : undefined;
    if ((typeof choice.completeQuest === 'string' && hasRelevantQuestId(choice.completeQuest))
      || (completeStepQuestId && hasRelevantQuestId(completeStepQuestId))
      || (completeObjectiveQuestId && hasRelevantQuestId(completeObjectiveQuestId))) {
      return true;
    }
    for (const action of asArray(choice.actions)) {
      const type = normalizeActionType(action.type);
      if (type === 'completeobjective' || type === 'completestep' || type === 'completequest' || type === 'advancequest') {
        if (!action.questId || hasRelevantQuestId(action.questId)) {
          return true;
        }
      }
      if ((type === 'giverewards' || type === 'givegold' || type === 'giveitem' || type === 'givequestitem') && action.questId && hasRelevantQuestId(action.questId)) {
        return true;
      }
    }
  }

  return false;
}

function dialogueHasQuestProgressAtStart(player: QuestRuntimePlayer, npc: NpcDefinition, dialogue: DialogueDefinition, activeQuestIds: Set<string>): boolean {
  const startNode = getDialogueStartNodeStrict(player, npc, dialogue);
  if (!startNode) {
    return false;
  }

  const filteredChoices = asArray(startNode.choices).filter((choice) => evaluateDialogueConditionsStrict(
    player,
    npc,
    choice.conditions as Array<{ type?: string }> | undefined,
    `dialogue ${dialogue.id} choice ${choice.id}`,
  ));

  return nodeHasQuestProgressActions({ ...startNode, choices: filteredChoices }, activeQuestIds);
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
  const start = getStartNode(dialogue, player, npc);
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

  const candidates = dialogues
    .filter((dialogue) => dialogueAvailable(player, npc, dialogue))
    .filter((dialogue) => dialogueHasValidStart(dialogue));

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
    if (!evaluateDialogueConditionsStrict(player, npc, binding.conditions as Array<{ type?: string }> | undefined, `npc quest binding ${npc.id}:${binding.questId}`)) {
      continue;
    }
    const quest = getQuestById(binding.questId);
    if (!quest) {
      continue;
    }
    if (getMarkerStartableQuestIds(player, [quest.id]).length > 0) {
      available.push({ questId: quest.id, title: quest.title });
    }
  }
  return available;
}

export function getNpcQuestMarker(params: {
  npc: NpcDefinition;
  player: QuestRuntimePlayer;
  questDefinitions: QuestDefinition[];
  playerQuestStates: PlayerQuestState[];
  dialogues: DialogueDefinition[];
}): NpcQuestMarkerMode {
  const { npc, player, questDefinitions, playerQuestStates, dialogues } = params;

  const activeStates = playerQuestStates.filter((state) => state.playerId === player.id && state.status === 'active');
  const activeQuestIds = new Set(activeStates.map((state) => state.questId));
  const questById = new Map(questDefinitions.map((quest) => [quest.id, quest]));

  for (const state of activeStates) {
    const quest = questById.get(state.questId) ?? null;
    if (!quest) {
      continue;
    }
    if (buildQuestStage(npc.id, quest, state)) {
      return 'progress';
    }
  }

  const bindingDialogueIds = new Set(asArray(npc.dialogues).map((binding) => binding.dialogueId));
  const candidateDialogues = dialogues.filter((dialogue) => dialogue.status === 'active' && (dialogue.npcId === npc.id || bindingDialogueIds.has(dialogue.id)));

  for (const dialogue of candidateDialogues) {
    if (dialogueHasQuestProgressAtStart(player, npc, dialogue, activeQuestIds)) {
      return 'progress';
    }
  }

  if (selectQuestStartAvailable({ npc, player }).length > 0) {
    return 'available';
  }

  for (const dialogue of candidateDialogues) {
    const startableQuestIds = getMarkerStartableQuestIds(player, collectDialogueQuestStartIdsFromStartNode(player, npc, dialogue));
    if (startableQuestIds.length > 0) {
      return 'available';
    }
  }

  return null;
}

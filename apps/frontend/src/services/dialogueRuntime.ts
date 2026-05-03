import { getDialogueById, getDialoguesByNpc } from './dialogueRepository';
import { getNpcById } from './npcRepository';
import { getPlayerQuestState } from './questRuntime';
import {
  advanceQuest,
  canStartQuest,
  completeObjective,
  completeStep,
  completeQuest,
  applyQuestRewards,
  failQuest,
  setQuestFlag,
  startQuest,
  handleQuestEvent,
  type QuestRuntimeEvent as QuestEvent,
  type QuestRuntimePlayer,
} from './questRuntime';
import { getQuestById } from './questRepository';
import type { DialogueAction, DialogueChoice, DialogueCondition, DialogueDefinition, DialogueNode } from '../types/dialogue';
import type { NpcDefinition } from '../types/npc';

const PLAYER_GOLD_KEY = 'theend.player.gold';
const PLAYER_FLAGS_KEY = 'theend.player.flags';
const PLAYER_ITEMS_KEY = 'theend.player.items';
const PLAYER_QUEST_ITEMS_KEY = 'theend.player.questItems';
const PLAYER_REP_KEY = 'theend.player.reputation';

export type DialogueRuntimeEvent =
  | { type: 'openShop'; npcId: string; merchantId?: string | null }
  | { type: 'startCombat'; npcId: string }
  | { type: 'trainSkill'; npcId: string; skillId?: string | null }
  | { type: 'unlockLocation'; npcId: string; locationId?: string | null }
  | { type: 'unlockDialogue'; npcId: string; dialogueId?: string | null };

export type DialogueRuntimeIntent =
  | { type: 'OPEN_SHOP'; merchantId?: string | null }
  | { type: 'START_COMBAT' }
  | { type: 'OPEN_TRAINING'; skillId?: string | null }
  | { type: 'QUEST_STARTED'; questId: string }
  | { type: 'QUEST_ADVANCED'; questId: string }
  | { type: 'QUEST_COMPLETED'; questId: string };

function readNumber(key: string, fallback = 0): number {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function writeNumber(key: string, value: number): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, String(value));
}

function readArray(key: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function writeArray(key: string, values: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(values));
}

function readRecord(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeRecord(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function evaluateDialogueConditions(player: QuestRuntimePlayer, npc: NpcDefinition | null, conditions: DialogueCondition[] = []): boolean {
  const normalizeType = (raw: string): string => {
    switch (raw) {
      case 'playerLevel':
        return 'player_level';
      case 'playerRace':
        return 'player_race';
      case 'playerProfession':
        return 'player_profession';
      case 'questActive':
        return 'quest_active';
      case 'questCompleted':
        return 'quest_completed';
      case 'questNotStarted':
        return 'quest_not_started';
      case 'questFailed':
        return 'quest_failed';
      case 'objectiveCompleted':
        return 'objective_completed';
      case 'hasItem':
        return 'has_item';
      case 'hasQuestItem':
        return 'has_quest_item';
      case 'goldAtLeast':
        return 'gold_at_least';
      case 'factionReputation':
        return 'faction_reputation';
      case 'kingdomReputation':
        return 'kingdom_reputation';
      case 'npcDisposition':
        return 'npc_disposition';
      case 'globalFlag':
        return 'global_flag';
      case 'questFlag':
        return 'quest_flag';
      default:
        return raw;
    }
  };

  const compare = (actual: number, operator: DialogueCondition['operator'], expected: number): boolean => {
    switch (operator) {
      case '!=':
        return actual !== expected;
      case '>':
        return actual > expected;
      case '>=':
        return actual >= expected;
      case '<':
        return actual < expected;
      case '<=':
        return actual <= expected;
      case '==':
      default:
        return actual === expected;
    }
  };

  for (const condition of conditions) {
    const value = condition.value;
    const type = normalizeType(condition.type);

    switch (type) {
      case 'player_level':
        if (typeof value === 'number' && (player.level ?? 0) < value) {
          return false;
        }
        break;
      case 'player_race':
        if (typeof value === 'string' && player.race !== value) {
          return false;
        }
        break;
      case 'player_profession':
        if (typeof value === 'string' && player.professionId !== value) {
          return false;
        }
        break;
      case 'quest_active':
        if (typeof (condition.questId ?? value) === 'string' && getPlayerQuestState(player.id, String(condition.questId ?? value))?.status !== 'active') {
          return false;
        }
        break;
      case 'quest_completed':
        if (typeof (condition.questId ?? value) === 'string' && getPlayerQuestState(player.id, String(condition.questId ?? value))?.status !== 'completed') {
          return false;
        }
        break;
      case 'quest_not_started':
        if (typeof (condition.questId ?? value) === 'string' && getPlayerQuestState(player.id, String(condition.questId ?? value))) {
          return false;
        }
        break;
      case 'quest_failed':
        if (typeof (condition.questId ?? value) === 'string' && getPlayerQuestState(player.id, String(condition.questId ?? value))?.status !== 'failed') {
          return false;
        }
        break;
      case 'objective_completed': {
        const questId = condition.questId ?? (typeof value === 'string' ? value : undefined);
        const objectiveId = condition.objectiveId ?? condition.key;
        if (!questId || !objectiveId) {
          return false;
        }
        const state = getPlayerQuestState(player.id, questId);
        if (!state || !state.completedObjectiveIds.includes(objectiveId)) {
          return false;
        }
        break;
      }
      case 'has_item':
        if (typeof (condition.itemId ?? value) === 'string' && !readArray(PLAYER_ITEMS_KEY).includes(String(condition.itemId ?? value))) {
          return false;
        }
        break;
      case 'has_quest_item':
        if (typeof (condition.questItemId ?? value) === 'string' && !readArray(PLAYER_QUEST_ITEMS_KEY).includes(String(condition.questItemId ?? value))) {
          return false;
        }
        break;
      case 'gold_at_least':
        if (typeof value === 'number' && readNumber(PLAYER_GOLD_KEY, 0) < value) {
          return false;
        }
        break;
      case 'faction_reputation':
      case 'kingdom_reputation': {
        const rep = readRecord(PLAYER_REP_KEY);
        const repKey = condition.key ?? String(value ?? '');
        if (!repKey) {
          return false;
        }
        const actual = Number(rep[repKey] ?? 0);
        if (typeof value === 'number' && !compare(actual, condition.operator, value)) {
          return false;
        }
        break;
      }
      case 'npc_disposition':
        if (typeof value === 'string' && npc?.defaultDisposition !== value) {
          return false;
        }
        break;
      case 'global_flag':
      case 'quest_flag': {
        const flags = readRecord(PLAYER_FLAGS_KEY);
        if (!condition.key) {
          return false;
        }
        if (flags[condition.key] !== value) {
          return false;
        }
        break;
      }
      default:
        break;
    }
  }

  return true;
}

export function getAvailableDialoguesForNpc(player: QuestRuntimePlayer, npcId: string): DialogueDefinition[] {
  const npc = getNpcById(npcId);
  return getDialoguesByNpc(npcId).filter((dialogue) => {
    if (dialogue.status !== 'active') {
      return false;
    }
    const startNode = dialogue.nodes.find((node) => node.id === dialogue.startNodeId);
    if (!startNode) {
      return false;
    }
    return evaluateDialogueConditions(player, npc, startNode.conditions ?? []);
  });
}

export function getStartNode(dialogue: DialogueDefinition): DialogueNode | null {
  return dialogue.nodes.find((node) => node.id === dialogue.startNodeId) ?? null;
}

export function getAvailableChoices(
  player: QuestRuntimePlayer,
  npc: NpcDefinition | null,
  node: DialogueNode,
): Array<DialogueChoice & { disabled: boolean; hidden: boolean }> {
  return node.choices
    .map((choice) => {
      const valid = evaluateDialogueConditions(player, npc, choice.conditions ?? []);
      return {
        ...choice,
        disabled: !valid && Boolean(choice.disabledIfConditionsFail),
        hidden: !valid && Boolean(choice.hiddenIfConditionsFail),
      };
    })
    .filter((choice) => !choice.hidden);
}

export function executeDialogueActions(
  playerId: string,
  npcId: string,
  actions: DialogueAction[] = [],
  playerOverride?: QuestRuntimePlayer,
): { logs: string[]; intents: DialogueRuntimeIntent[]; events: DialogueRuntimeEvent[] } {
  const logs: string[] = [];
  const intents: DialogueRuntimeIntent[] = [];
  const events: DialogueRuntimeEvent[] = [];
  const npc = getNpcById(npcId);
  const player: QuestRuntimePlayer = playerOverride ?? { id: playerId, level: 1 };

  const runQuestEvent = (event: QuestEvent) => {
    const result = handleQuestEvent(player, event);
    logs.push(...(result.logs ?? []));
    result.startedQuestIds.forEach((questId) => intents.push({ type: 'QUEST_STARTED', questId }));
    result.advancedQuestIds.forEach((questId) => intents.push({ type: 'QUEST_ADVANCED', questId }));
    result.completedQuestIds.forEach((questId) => intents.push({ type: 'QUEST_COMPLETED', questId }));
  };

  for (const action of actions) {
    switch (action.type) {
      case 'startQuest': {
        if (!action.questId) {
          logs.push('startQuest skipped: missing questId.');
          break;
        }
        runQuestEvent({ type: 'manual', questId: action.questId });
        break;
      }
      case 'completeObjective':
        if (action.questId && action.objectiveId) {
          runQuestEvent({ type: 'manual', questId: action.questId, objectiveId: action.objectiveId });
        }
        break;
      case 'completeStep':
        if (action.questId) {
          runQuestEvent({ type: 'manual', questId: action.questId, stepId: action.key ?? '' });
        }
        break;
      case 'advanceQuest':
        if (action.questId) {
          // keep legacy semantics: advance only if objectives are done
          const before = getPlayerQuestState(playerId, action.questId);
          const next = advanceQuest(playerId, action.questId);
          if (next.currentStepId !== before?.currentStepId) {
            logs.push(`Quest advanced: ${action.questId}`);
            intents.push({ type: 'QUEST_ADVANCED', questId: action.questId });
          }
          if (next.status === 'completed') {
            intents.push({ type: 'QUEST_COMPLETED', questId: action.questId });
          }
        }
        break;
      case 'completeQuest':
        if (action.questId) {
          // explicit completion request
          completeQuest(playerId, action.questId);
          intents.push({ type: 'QUEST_COMPLETED', questId: action.questId });
          logs.push(`Quest completed: ${action.questId}`);
          const rewards = applyQuestRewards(playerId, action.questId);
          if (rewards.applied) {
            rewards.rewards.forEach((reward) => logs.push(`Reward granted: ${reward}`));
          }
        }
        break;
      case 'failQuest':
        if (action.questId) {
          failQuest(playerId, action.questId, 'dialogue_action');
          logs.push(`Quest failed: ${action.questId}`);
        }
        break;
      case 'setQuestFlag':
        if (action.questId && action.key) {
          setQuestFlag(playerId, action.questId, action.key, action.value ?? true);
          logs.push(`Quest flag set: ${action.key}`);
        }
        break;
      case 'giveItem':
        if (action.itemId) {
          const items = readArray(PLAYER_ITEMS_KEY);
          if (!items.includes(action.itemId)) {
            writeArray(PLAYER_ITEMS_KEY, [...items, action.itemId]);
          }
          logs.push(`Item granted: ${action.itemId}`);
        }
        break;
      case 'takeItem':
        if (action.itemId) {
          writeArray(PLAYER_ITEMS_KEY, readArray(PLAYER_ITEMS_KEY).filter((itemId) => itemId !== action.itemId));
          logs.push(`Item removed: ${action.itemId}`);
        }
        break;
      case 'giveQuestItem':
        if (action.questItemId) {
          const items = readArray(PLAYER_QUEST_ITEMS_KEY);
          if (!items.includes(action.questItemId)) {
            writeArray(PLAYER_QUEST_ITEMS_KEY, [...items, action.questItemId]);
          }
          logs.push(`Quest item granted: ${action.questItemId}`);
        }
        break;
      case 'takeQuestItem':
        if (action.questItemId) {
          writeArray(PLAYER_QUEST_ITEMS_KEY, readArray(PLAYER_QUEST_ITEMS_KEY).filter((itemId) => itemId !== action.questItemId));
          logs.push(`Quest item removed: ${action.questItemId}`);
        }
        break;
      case 'giveGold':
        writeNumber(PLAYER_GOLD_KEY, readNumber(PLAYER_GOLD_KEY, 0) + Math.max(0, action.amount ?? 0));
        logs.push(`Gold granted: ${action.amount ?? 0}`);
        break;
      case 'takeGold':
        writeNumber(PLAYER_GOLD_KEY, Math.max(0, readNumber(PLAYER_GOLD_KEY, 0) - Math.max(0, action.amount ?? 0)));
        logs.push(`Gold removed: ${action.amount ?? 0}`);
        break;
      case 'addReputation': {
        const rep = readRecord(PLAYER_REP_KEY);
        const key = action.factionId ?? action.kingdomId ?? 'global';
        const current = Number(rep[key] ?? 0);
        rep[key] = current + (action.amount ?? 0);
        writeRecord(PLAYER_REP_KEY, rep);
        logs.push(`Reputation changed: ${key} (${action.amount ?? 0})`);
        break;
      }
      case 'setGlobalFlag': {
        if (!action.key) {
          break;
        }
        const flags = readRecord(PLAYER_FLAGS_KEY);
        flags[action.key] = action.value ?? true;
        writeRecord(PLAYER_FLAGS_KEY, flags);
        logs.push(`Global flag set: ${action.key}`);
        break;
      }
      case 'setNpcDisposition':
        logs.push(`NPC disposition updated for ${npc?.name ?? npcId}.`);
        break;
      case 'openShop':
        intents.push({ type: 'OPEN_SHOP', merchantId: npc?.traderId ?? null });
        events.push({ type: 'openShop', npcId, merchantId: npc?.traderId ?? null });
        break;
      case 'startCombat':
        intents.push({ type: 'START_COMBAT' });
        events.push({ type: 'startCombat', npcId });
        break;
      case 'trainSkill':
        intents.push({ type: 'OPEN_TRAINING', skillId: action.skillId ?? null });
        events.push({ type: 'trainSkill', npcId, skillId: action.skillId ?? null });
        break;
      case 'unlockLocation':
        logs.push(`Location unlocked: ${action.locationId ?? action.key ?? 'unknown'}`);
        events.push({ type: 'unlockLocation', npcId, locationId: action.locationId ?? action.key ?? null });
        break;
      case 'unlockDialogue':
        logs.push(`Dialogue unlocked: ${action.key ?? 'unknown'}`);
        events.push({ type: 'unlockDialogue', npcId, dialogueId: action.key ?? null });
        break;
      default:
        logs.push(`Unhandled action: ${action.type}`);
        break;
    }
  }

  return { logs, intents, events };
}

export function chooseDialogueOption(
  playerId: string,
  npcId: string,
  dialogueId: string,
  nodeId: string,
  choiceId: string,
): {
  nextNode: DialogueNode | null;
  ended: boolean;
  logs: string[];
  intents: DialogueRuntimeIntent[];
  events: DialogueRuntimeEvent[];
} {
  const dialogue = getDialogueById(dialogueId);
  if (!dialogue) {
    throw new Error(`Dialogue not found: ${dialogueId}`);
  }

  const node = dialogue.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Dialogue node not found: ${nodeId}`);
  }

  const choice = node.choices.find((entry) => entry.id === choiceId);
  if (!choice) {
    throw new Error(`Dialogue choice not found: ${choiceId}`);
  }

  const { logs, intents, events } = executeDialogueActions(playerId, npcId, [...(node.actions ?? []), ...(choice.actions ?? [])]);

  const nextNodeId = choice.nextNodeId ?? choice.next;
  const ended = Boolean(choice.endsDialogue ?? choice.end);

  if (ended) {
    return { nextNode: null, ended: true, logs, intents, events };
  }

  return {
    nextNode: nextNodeId ? (dialogue.nodes.find((entry) => entry.id === nextNodeId) ?? null) : null,
    ended: false,
    logs,
    intents,
    events,
  };
}

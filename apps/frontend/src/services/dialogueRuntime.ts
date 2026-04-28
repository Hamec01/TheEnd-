import { getDialogueById, getDialoguesByNpc } from './dialogueRepository';
import { getNpcById } from './npcRepository';
import { getPlayerQuestState } from './questRuntime';
import {
  advanceQuest,
  canStartQuest,
  completeObjective,
  completeQuest,
  failQuest,
  setQuestFlag,
  startQuest,
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
  for (const condition of conditions) {
    const value = condition.value;

    switch (condition.type) {
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
        if (typeof value === 'string' && getPlayerQuestState(player.id, value)?.status !== 'active') {
          return false;
        }
        break;
      case 'quest_completed':
        if (typeof value === 'string' && getPlayerQuestState(player.id, value)?.status !== 'completed') {
          return false;
        }
        break;
      case 'quest_not_started':
        if (typeof value === 'string' && getPlayerQuestState(player.id, value)) {
          return false;
        }
        break;
      case 'quest_failed':
        if (typeof value === 'string' && getPlayerQuestState(player.id, value)?.status !== 'failed') {
          return false;
        }
        break;
      case 'has_item':
        if (typeof value === 'string' && !readArray(PLAYER_ITEMS_KEY).includes(value)) {
          return false;
        }
        break;
      case 'has_quest_item':
        if (typeof value === 'string' && !readArray(PLAYER_QUEST_ITEMS_KEY).includes(value)) {
          return false;
        }
        break;
      case 'gold_at_least':
        if (typeof value === 'number' && readNumber(PLAYER_GOLD_KEY, 0) < value) {
          return false;
        }
        break;
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
    if (dialogue.status === 'disabled') {
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

export function executeDialogueActions(playerId: string, npcId: string, actions: DialogueAction[] = []): string[] {
  const logs: string[] = [];
  const npc = getNpcById(npcId);

  for (const action of actions) {
    switch (action.type) {
      case 'startQuest': {
        if (!action.questId) {
          logs.push('startQuest skipped: missing questId.');
          break;
        }
        const quest = getQuestById(action.questId);
        if (!quest) {
          logs.push(`startQuest failed: missing quest '${action.questId}'.`);
          break;
        }
        const player: QuestRuntimePlayer = { id: playerId, level: 1 };
        if (canStartQuest(player, quest)) {
          startQuest(playerId, action.questId);
          logs.push(`Quest started: ${action.questId}`);
        } else {
          logs.push(`Quest cannot start: ${action.questId}`);
        }
        break;
      }
      case 'completeObjective':
        if (action.questId && action.objectiveId) {
          completeObjective(playerId, action.questId, action.objectiveId);
          logs.push(`Objective completed: ${action.objectiveId}`);
        }
        break;
      case 'advanceQuest':
        if (action.questId) {
          advanceQuest(playerId, action.questId);
          logs.push(`Quest advanced: ${action.questId}`);
        }
        break;
      case 'completeQuest':
        if (action.questId) {
          completeQuest(playerId, action.questId);
          logs.push(`Quest completed: ${action.questId}`);
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
        logs.push('openShop event emitted.');
        break;
      case 'startCombat':
        logs.push('startCombat event emitted.');
        break;
      case 'trainSkill':
        logs.push(`trainSkill event emitted (${action.skillId ?? 'unknown skill'}).`);
        break;
      case 'unlockLocation':
        logs.push(`Location unlocked: ${action.locationId ?? action.key ?? 'unknown'}`);
        break;
      case 'unlockDialogue':
        logs.push(`Dialogue unlocked: ${action.key ?? 'unknown'}`);
        break;
      default:
        logs.push(`Unhandled action: ${action.type}`);
        break;
    }
  }

  return logs;
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

  const logs = executeDialogueActions(playerId, npcId, [...(node.actions ?? []), ...(choice.actions ?? [])]);

  if (choice.endsDialogue || !choice.nextNodeId) {
    return { nextNode: null, ended: true, logs };
  }

  return {
    nextNode: dialogue.nodes.find((entry) => entry.id === choice.nextNodeId) ?? null,
    ended: false,
    logs,
  };
}

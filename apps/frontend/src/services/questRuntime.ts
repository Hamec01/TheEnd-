import {
  getAllPlayerQuestStates,
  getAllQuests,
  getQuestById,
  getRandomZoneCooldowns,
  savePlayerQuestState,
  saveRandomZoneCooldown,
} from './questRepository';
import { validateQuest } from './questValidator';
import type {
  PlayerQuestState,
  QuestCondition,
  QuestDefinition,
  QuestObjective,
  QuestTrigger,
  QuestValidationWorldData,
} from '../types/quest';
import { getQuestMarkers } from './questMapRepository';
import { getAllZones } from './worldRepository';
import { getAllDialogues } from './dialogueRepository';
import { getAllNpcs } from './npcRepository';
import { getQuestItems } from './questRepository';
import { ITEMS } from '@theend/rpg-domain';

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export interface QuestRuntimePlayer {
  id: string;
  level?: number;
  race?: string;
  classId?: string;
  professionId?: string;
  gold?: number;
  flags?: Record<string, unknown>;
  completedQuestIds?: string[];
  activeQuestIds?: string[];
  itemIds?: string[];
}

export type QuestRuntimeEvent =
  | {
      type: 'dialogue_choice';
      npcId?: string;
      dialogueId?: string;
      nodeId?: string;
      choiceId?: string;
    }
  | {
      type: 'npc_talk';
      npcId: string;
    }
  | {
      type: 'location_enter';
      cityId?: string;
      locationId: string;
    }
  | {
      type: 'zone_enter';
      zoneId: string;
      markerId?: string;
      mapId?: string;
    }
  | {
      type: 'zone_inspect';
      zoneId: string;
      markerId?: string;
      mapId?: string;
    }
  | {
      type: 'marker_reached';
      markerId: string;
      zoneId?: string;
      mapId?: string;
    }
  | {
      type: 'item_pickup';
      itemId?: string;
      questItemId?: string;
    }
  | {
      type: 'item_use';
      itemId?: string;
      questItemId?: string;
    }
  | {
      type: 'enemy_killed';
      enemyId: string;
      npcId?: string;
    }
  | {
      type: 'battle_won';
      battleId?: string;
      enemyIds?: string[];
    }
  | {
      type: 'manual';
      questId?: string;
      objectiveId?: string;
      stepId?: string;
    };

export interface QuestEventResult {
  logs: string[];
  startedQuestIds: string[];
  advancedQuestIds: string[];
  completedQuestIds: string[];
  completedObjectiveIds: string[];
  failedQuestIds: string[];
  rewards: string[];
}

const PLAYER_GOLD_KEY = 'theend.player.gold';
const PLAYER_XP_KEY = 'theend.player.experience';
const PLAYER_ITEMS_KEY = 'theend.player.items';
const PLAYER_QUEST_ITEMS_KEY = 'theend.player.questItems';
const PLAYER_SKILLS_KEY = 'theend.player.skills';
const PLAYER_RECIPES_KEY = 'theend.player.recipes';
const PLAYER_TITLES_KEY = 'theend.player.titles';
const PLAYER_UNLOCKED_DIALOGUES_KEY = 'theend.player.unlockedDialogues';
const PLAYER_UNLOCKED_LOCATIONS_KEY = 'theend.player.unlockedLocations';
const PLAYER_UNLOCKED_SHOPS_KEY = 'theend.player.unlockedShops';
const PLAYER_FACTION_ACCESS_KEY = 'theend.player.factionAccess';
const PLAYER_LORE_ENTRIES_KEY = 'theend.player.loreEntries';
const PLAYER_REPUTATION_KEY = 'theend.player.reputation';
const QUEST_REWARDS_APPLIED_KEY = 'theend.questRewardsApplied';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readArray(key: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<string[]>(window.localStorage.getItem(key), []);
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
  return safeParse<Record<string, unknown>>(window.localStorage.getItem(key), {});
}

function writeRecord(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

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

function nowIso(): string {
  return new Date().toISOString();
}

function getQuestState(playerId: string, questId: string): PlayerQuestState | null {
  return getAllPlayerQuestStates().find((entry) => entry.playerId === playerId && entry.questId === questId) ?? null;
}

function getAllQuestStatesForPlayer(playerId: string): PlayerQuestState[] {
  return getAllPlayerQuestStates().filter((entry) => entry.playerId === playerId);
}

function saveQuestState(state: PlayerQuestState): PlayerQuestState {
  savePlayerQuestState(state);
  return state;
}

function currentStep(quest: QuestDefinition, state: PlayerQuestState) {
  const steps = asArray(quest.steps);
  if (!state.currentStepId) {
    return steps[0] ?? null;
  }
  return steps.find((step) => step.id === state.currentStepId) ?? steps[0] ?? null;
}

function compareNumber(actual: number, operator: QuestCondition['operator'], expected: number): boolean {
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
}

function evaluateConditionsDetailed(
  player: QuestRuntimePlayer,
  conditions: QuestCondition[],
  options?: { logs?: string[]; now?: Date; cityId?: string; kingdomId?: string },
): boolean {
  for (const condition of asArray(conditions)) {
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
      case 'player_class':
        if (typeof value === 'string' && player.classId !== value) {
          return false;
        }
        break;
      case 'player_profession':
        if (typeof value === 'string' && player.professionId !== value) {
          return false;
        }
        break;
      case 'kingdom_reputation':
      case 'faction_reputation': {
        const rep = readRecord(PLAYER_REPUTATION_KEY);
        const repKey = condition.key ?? String(value ?? '');
        if (!repKey) {
          return false;
        }
        const actual = Number(rep[repKey] ?? 0);
        if (typeof value === 'number' && !compareNumber(actual, condition.operator, value)) {
          return false;
        }
        break;
      }
      case 'quest_completed':
        if (typeof value === 'string' && !(player.completedQuestIds ?? []).includes(value)) {
          return false;
        }
        break;
      case 'quest_not_completed':
        if (typeof value === 'string' && (player.completedQuestIds ?? []).includes(value)) {
          return false;
        }
        break;
      case 'quest_active':
        if (typeof value === 'string' && !(player.activeQuestIds ?? []).includes(value)) {
          return false;
        }
        break;
      case 'has_item':
        if (typeof value === 'string' && !(player.itemIds ?? []).includes(value)) {
          return false;
        }
        break;
      case 'has_not_item':
        if (typeof value === 'string' && (player.itemIds ?? []).includes(value)) {
          return false;
        }
        break;
      case 'gold_at_least':
        if (typeof value === 'number' && (player.gold ?? 0) < value) {
          return false;
        }
        break;
      case 'time_of_day': {
        const now = options?.now ?? new Date();
        const hours = now.getHours();
        const expected = String(value ?? '').trim().toLowerCase();
        if (!expected) {
          return true;
        }
        // Very rough buckets: morning/day/evening/night.
        const bucket =
          hours >= 6 && hours < 11
            ? 'morning'
            : hours >= 11 && hours < 18
              ? 'day'
              : hours >= 18 && hours < 22
                ? 'evening'
                : 'night';
        if (bucket !== expected) {
          return false;
        }
        break;
      }
      case 'in_city': {
        if (typeof value === 'string' && options?.cityId && options.cityId !== value) {
          return false;
        }
        if (typeof value === 'string' && !options?.cityId) {
          return false;
        }
        break;
      }
      case 'in_kingdom': {
        if (typeof value === 'string' && options?.kingdomId && options.kingdomId !== value) {
          return false;
        }
        if (typeof value === 'string' && !options?.kingdomId) {
          return false;
        }
        break;
      }
      case 'npc_alive':
      case 'npc_dead':
        options?.logs?.push(`Condition '${condition.type}' is not supported yet.`);
        return false;
      case 'stat_check':
        options?.logs?.push(`Condition 'stat_check' is not supported yet.`);
        return false;
      case 'flag_true':
        if (typeof condition.key === 'string' && player.flags?.[condition.key] !== true) {
          return false;
        }
        break;
      case 'flag_false':
        if (typeof condition.key === 'string' && player.flags?.[condition.key] !== false) {
          return false;
        }
        break;
      default:
        options?.logs?.push(`Unsupported quest condition: ${condition.type}`);
        return false;
    }
  }

  return true;
}

export function evaluateConditions(player: QuestRuntimePlayer, conditions: QuestCondition[]): boolean {
  return evaluateConditionsDetailed(player, conditions);
}

export function canStartQuest(player: QuestRuntimePlayer, quest: QuestDefinition): boolean {
  return canStartQuestDetailed(player, quest).canStart;
}

function canStartQuestDetailed(player: QuestRuntimePlayer, quest: QuestDefinition): { canStart: boolean; reason?: string } {
  if (quest.status !== 'active' && quest.status !== 'draft') {
    return { canStart: false, reason: `Quest status is '${quest.status}'.` };
  }

  if (typeof quest.minLevel === 'number' && (player.level ?? 0) < quest.minLevel) {
    return { canStart: false, reason: `Requires level ${quest.minLevel}.` };
  }

  const conditionLogs: string[] = [];
  if (!evaluateConditionsDetailed(player, asArray(quest.conditions), { logs: conditionLogs })) {
    return { canStart: false, reason: conditionLogs[0] ?? 'Quest conditions failed.' };
  }

  const existing = getQuestState(player.id, quest.id);
  if (!existing) {
    return { canStart: true };
  }

  if (!quest.isRepeatable && (existing.status === 'completed' || existing.status === 'active')) {
    return { canStart: false, reason: 'Quest already active/completed and not repeatable.' };
  }

  return { canStart: true };
}

export function startQuest(playerId: string, questId: string): PlayerQuestState {
  const quest = getQuestById(questId);
  if (!quest) {
    throw new Error(`Quest not found: ${questId}`);
  }

  const existing = getQuestState(playerId, questId);
  if (existing?.status === 'active') {
    return existing;
  }
  if (existing?.status === 'completed' && !quest.isRepeatable) {
    return existing;
  }
  if (existing?.status === 'failed' && !quest.isRepeatable) {
    return existing;
  }

  const firstStepId = asArray(quest.steps)[0]?.id;
  const state: PlayerQuestState = {
    playerId,
    questId,
    status: 'active',
    currentStepId: firstStepId,
    completedStepIds: [],
    completedObjectiveIds: [],
    flags: existing?.flags ?? {},
    startedAt: nowIso(),
    repeatCount: (existing?.repeatCount ?? 0) + 1,
  };

  return saveQuestState(state);
}

export function completeObjective(playerId: string, questId: string, objectiveId: string): PlayerQuestState {
  const existing = getQuestState(playerId, questId);
  if (!existing) {
    throw new Error('Quest state not found. Start quest first.');
  }

  if (!existing.completedObjectiveIds.includes(objectiveId)) {
    existing.completedObjectiveIds.push(objectiveId);
  }

  return saveQuestState({ ...existing });
}

export function completeStep(playerId: string, questId: string, stepId?: string): PlayerQuestState {
  const quest = getQuestById(questId);
  if (!quest) {
    throw new Error(`Quest not found: ${questId}`);
  }

  const existing = getQuestState(playerId, questId);
  if (!existing) {
    throw new Error('Quest state not found. Start quest first.');
  }

  const step =
    (stepId ? asArray(quest.steps).find((entry) => entry.id === stepId) : null) ??
    currentStep(quest, existing);

  if (!step) {
    return completeQuest(playerId, questId);
  }

  if (!existing.completedStepIds.includes(step.id)) {
    existing.completedStepIds.push(step.id);
  }

  for (const objective of asArray(step.objectives)) {
    if (!existing.completedObjectiveIds.includes(objective.id)) {
      existing.completedObjectiveIds.push(objective.id);
    }
  }

  if (!step.nextStepId) {
    return completeQuest(playerId, questId);
  }

  existing.currentStepId = step.nextStepId;
  return saveQuestState({ ...existing });
}

export function advanceQuest(playerId: string, questId: string): PlayerQuestState {
  const quest = getQuestById(questId);
  if (!quest) {
    throw new Error(`Quest not found: ${questId}`);
  }

  const existing = getQuestState(playerId, questId);
  if (!existing) {
    throw new Error('Quest state not found.');
  }

  const step = currentStep(quest, existing);
  if (!step) {
    return completeQuest(playerId, questId);
  }

  const requiredObjectiveIds = asArray(step.objectives).filter((entry) => !entry.isOptional).map((entry) => entry.id);
  const hasAllRequired = requiredObjectiveIds.every((objectiveId) => existing.completedObjectiveIds.includes(objectiveId));

  if (!hasAllRequired) {
    return existing;
  }

  if (!existing.completedStepIds.includes(step.id)) {
    existing.completedStepIds.push(step.id);
  }

  if (!step.nextStepId) {
    return completeQuest(playerId, questId);
  }

  existing.currentStepId = step.nextStepId;
  return saveQuestState({ ...existing });
}

export function failQuest(playerId: string, questId: string, reason?: string): PlayerQuestState {
  const existing = getQuestState(playerId, questId);
  if (!existing) {
    throw new Error('Quest state not found.');
  }

  const failed = {
    ...existing,
    status: 'failed' as const,
    failedAt: nowIso(),
    flags: {
      ...existing.flags,
      failReason: reason ?? null,
    },
  };

  return saveQuestState(failed);
}

export function completeQuest(playerId: string, questId: string): PlayerQuestState {
  const existing = getQuestState(playerId, questId);
  if (!existing) {
    throw new Error('Quest state not found.');
  }

  const completed = {
    ...existing,
    status: 'completed' as const,
    completedAt: nowIso(),
  };

  return saveQuestState(completed);
}

export function applyQuestRewards(playerId: string, questId: string): { applied: boolean; rewards: string[] } {
  const quest = getQuestById(questId);
  const state = getQuestState(playerId, questId);
  if (!quest || !state || state.status !== 'completed') {
    return { applied: false, rewards: [] };
  }

  const instanceKey = `${playerId}:${questId}:${state.repeatCount ?? 1}`;
  const applied = readRecord(QUEST_REWARDS_APPLIED_KEY);
  if (applied[instanceKey] === true) {
    return { applied: false, rewards: [] };
  }

  const rewardLines: string[] = [];

  for (const reward of asArray(quest.rewards)) {
    const targetId = normalizeId(reward.targetId);
    const amount = typeof reward.amount === 'number' && Number.isFinite(reward.amount) ? reward.amount : undefined;

    switch (reward.type) {
      case 'gold': {
        const delta = Math.max(0, Math.round(amount ?? 0));
        if (delta > 0) {
          writeNumber(PLAYER_GOLD_KEY, readNumber(PLAYER_GOLD_KEY, 0) + delta);
          rewardLines.push(`gold:+${delta}`);
        }
        break;
      }
      case 'experience': {
        const delta = Math.max(0, Math.round(amount ?? 0));
        if (delta > 0) {
          writeNumber(PLAYER_XP_KEY, readNumber(PLAYER_XP_KEY, 0) + delta);
          rewardLines.push(`experience:+${delta}`);
        }
        break;
      }
      case 'item': {
        if (!targetId) break;
        const items = readArray(PLAYER_ITEMS_KEY);
        if (!items.includes(targetId)) {
          writeArray(PLAYER_ITEMS_KEY, [...items, targetId]);
        }
        rewardLines.push(`item:${targetId}`);
        break;
      }
      case 'quest_item': {
        if (!targetId) break;
        const items = readArray(PLAYER_QUEST_ITEMS_KEY);
        if (!items.includes(targetId)) {
          writeArray(PLAYER_QUEST_ITEMS_KEY, [...items, targetId]);
        }
        rewardLines.push(`quest_item:${targetId}`);
        break;
      }
      case 'skill': {
        if (!targetId) break;
        const skills = readArray(PLAYER_SKILLS_KEY);
        if (!skills.includes(targetId)) {
          writeArray(PLAYER_SKILLS_KEY, [...skills, targetId]);
        }
        rewardLines.push(`skill:${targetId}`);
        break;
      }
      case 'recipe': {
        if (!targetId) break;
        const recipes = readArray(PLAYER_RECIPES_KEY);
        if (!recipes.includes(targetId)) {
          writeArray(PLAYER_RECIPES_KEY, [...recipes, targetId]);
        }
        rewardLines.push(`recipe:${targetId}`);
        break;
      }
      case 'title': {
        const title = normalizeId(reward.title) ?? targetId;
        if (!title) break;
        const titles = readArray(PLAYER_TITLES_KEY);
        if (!titles.includes(title)) {
          writeArray(PLAYER_TITLES_KEY, [...titles, title]);
        }
        rewardLines.push(`title:${title}`);
        break;
      }
      case 'profession': {
        if (!targetId) break;
        rewardLines.push(`profession:${targetId}`);
        break;
      }
      case 'reputation': {
        const rep = readRecord(PLAYER_REPUTATION_KEY);
        const key = normalizeId(reward.title) ?? targetId ?? 'global';
        const current = Number(rep[key] ?? 0);
        rep[key] = current + (amount ?? 0);
        writeRecord(PLAYER_REPUTATION_KEY, rep);
        rewardLines.push(`reputation:${key}:${amount ?? 0}`);
        break;
      }
      case 'unlock_dialogue': {
        if (!targetId) break;
        const unlocked = readArray(PLAYER_UNLOCKED_DIALOGUES_KEY);
        if (!unlocked.includes(targetId)) {
          writeArray(PLAYER_UNLOCKED_DIALOGUES_KEY, [...unlocked, targetId]);
        }
        rewardLines.push(`unlock_dialogue:${targetId}`);
        break;
      }
      case 'unlock_location': {
        if (!targetId) break;
        const unlocked = readArray(PLAYER_UNLOCKED_LOCATIONS_KEY);
        if (!unlocked.includes(targetId)) {
          writeArray(PLAYER_UNLOCKED_LOCATIONS_KEY, [...unlocked, targetId]);
        }
        rewardLines.push(`unlock_location:${targetId}`);
        break;
      }
      case 'unlock_shop': {
        if (!targetId) break;
        const unlocked = readArray(PLAYER_UNLOCKED_SHOPS_KEY);
        if (!unlocked.includes(targetId)) {
          writeArray(PLAYER_UNLOCKED_SHOPS_KEY, [...unlocked, targetId]);
        }
        rewardLines.push(`unlock_shop:${targetId}`);
        break;
      }
      case 'faction_access': {
        if (!targetId) break;
        const access = readArray(PLAYER_FACTION_ACCESS_KEY);
        if (!access.includes(targetId)) {
          writeArray(PLAYER_FACTION_ACCESS_KEY, [...access, targetId]);
        }
        rewardLines.push(`faction_access:${targetId}`);
        break;
      }
      case 'lore_entry': {
        if (!targetId) break;
        const entries = readArray(PLAYER_LORE_ENTRIES_KEY);
        if (!entries.includes(targetId)) {
          writeArray(PLAYER_LORE_ENTRIES_KEY, [...entries, targetId]);
        }
        rewardLines.push(`lore_entry:${targetId}`);
        break;
      }
      default:
        rewardLines.push(`${reward.type}:${targetId ?? amount ?? reward.id}`);
        break;
    }
  }

  applied[instanceKey] = true;
  writeRecord(QUEST_REWARDS_APPLIED_KEY, applied);

  return { applied: true, rewards: rewardLines };
}

export function setQuestFlag(playerId: string, questId: string, key: string, value: unknown): PlayerQuestState {
  const existing = getQuestState(playerId, questId);
  if (!existing) {
    throw new Error('Quest state not found.');
  }

  const next = {
    ...existing,
    flags: {
      ...existing.flags,
      [key]: value,
    },
  };

  return saveQuestState(next);
}

export function getPlayerQuestState(playerId: string, questId: string): PlayerQuestState | null {
  return getQuestState(playerId, questId);
}

function isQuestActive(state: PlayerQuestState | null): boolean {
  return Boolean(state && state.status === 'active');
}

function isQuestCompleted(state: PlayerQuestState | null): boolean {
  return Boolean(state && state.status === 'completed');
}

function normalizeId(value: string | undefined | null): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function objectiveCountKey(objectiveId: string): string {
  return `objectiveCount:${objectiveId}`;
}

function getObjectiveProgressCount(state: PlayerQuestState, objectiveId: string): number {
  const raw = state.flags?.[objectiveCountKey(objectiveId)];
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setObjectiveProgressCount(state: PlayerQuestState, objectiveId: string, count: number): PlayerQuestState {
  return {
    ...state,
    flags: {
      ...state.flags,
      [objectiveCountKey(objectiveId)]: count,
    },
  };
}

function objectiveMatchesEvent(objective: QuestObjective, event: QuestRuntimeEvent): boolean {
  switch (objective.type) {
    case 'talk_to_npc':
      return event.type === 'npc_talk' && objective.npcId === event.npcId;
    case 'enter_zone':
      return event.type === 'zone_enter' && objective.zoneId === event.zoneId;
    case 'reach_marker':
      return event.type === 'marker_reached' && objective.markerId === event.markerId;
    case 'inspect_object': {
      if (event.type !== 'zone_inspect') {
        return false;
      }
      if (objective.markerId && event.markerId && objective.markerId === event.markerId) {
        return true;
      }
      if (objective.zoneId && objective.zoneId === event.zoneId) {
        return true;
      }
      if (objective.targetId && (objective.targetId === event.zoneId || objective.targetId === event.markerId)) {
        return true;
      }
      return false;
    }
    case 'collect_item':
      return event.type === 'item_pickup' && Boolean(
        (objective.itemId && objective.itemId === event.itemId) || (objective.questItemId && objective.questItemId === event.questItemId),
      );
    case 'use_item':
      return event.type === 'item_use' && Boolean(
        (objective.itemId && objective.itemId === event.itemId) || (objective.questItemId && objective.questItemId === event.questItemId),
      );
    case 'kill_enemy':
      return event.type === 'enemy_killed' && Boolean(
        (objective.enemyId && objective.enemyId === event.enemyId) || (objective.npcId && objective.npcId === event.npcId),
      );
    case 'choose_dialogue':
      return event.type === 'dialogue_choice' && Boolean(
        (objective.dialogueChoiceId && objective.dialogueChoiceId === event.choiceId) || (objective.npcId && objective.npcId === event.npcId),
      );
    case 'survive_battle':
      return event.type === 'battle_won';
    default:
      return false;
  }
}

function triggerMatchesEvent(trigger: QuestTrigger, event: QuestRuntimeEvent): boolean {
  switch (trigger.type) {
    case 'npc_dialogue': {
      if (event.type !== 'dialogue_choice' && event.type !== 'npc_talk') {
        return false;
      }
      if (trigger.npcId && trigger.npcId !== event.npcId) {
        return false;
      }
      if (event.type === 'npc_talk') {
        return true;
      }
      if (trigger.dialogueId && trigger.dialogueId !== event.dialogueId) {
        return false;
      }
      if (trigger.dialogueNodeId && trigger.dialogueNodeId !== event.nodeId) {
        return false;
      }
      if (trigger.dialogueChoiceId && trigger.dialogueChoiceId !== event.choiceId) {
        return false;
      }
      return true;
    }
    case 'map_zone_enter':
      return event.type === 'zone_enter' && Boolean(trigger.zoneId && trigger.zoneId === event.zoneId);
    case 'map_marker':
      return event.type === 'marker_reached' && Boolean(trigger.markerId && trigger.markerId === event.markerId);
    case 'item_use':
      return event.type === 'item_use' && Boolean(
        (trigger.itemId && trigger.itemId === event.itemId) || (trigger.questItemId && trigger.questItemId === event.questItemId),
      );
    case 'enemy_death':
      return event.type === 'enemy_killed' && Boolean(trigger.enemyId && trigger.enemyId === event.enemyId);
    case 'manual_admin':
      return event.type === 'manual' && Boolean(trigger.id);
    case 'random_zone_roll':
      return event.type === 'zone_enter' && Boolean(trigger.zoneId && trigger.zoneId === event.zoneId);
    case 'global_event':
    case 'profession_unlock':
    default:
      return false;
  }
}

export function tryStartRandomQuestFromZone(
  player: QuestRuntimePlayer,
  zoneId: string,
  randomQuestPoolIds: string[],
  chancePercent: number,
  cooldownSeconds: number,
): QuestDefinition | null {
  const now = Date.now();
  const activeCooldown = getRandomZoneCooldowns().find((entry) => entry.playerId === player.id && entry.zoneId === zoneId && entry.expiresAt > now);
  if (activeCooldown) {
    return null;
  }

  const roll = Math.random() * 100;
  if (roll > Math.max(0, Math.min(100, chancePercent))) {
    saveRandomZoneCooldown({
      playerId: player.id,
      zoneId,
      expiresAt: now + Math.max(1, cooldownSeconds) * 1000,
    });
    return null;
  }

  const quests = getAllQuests().filter((entry) => randomQuestPoolIds.includes(entry.id));
  for (const quest of quests) {
    if (canStartQuest(player, quest)) {
      startQuest(player.id, quest.id);
      saveRandomZoneCooldown({
        playerId: player.id,
        zoneId,
        expiresAt: now + Math.max(1, cooldownSeconds) * 1000,
      });
      return quest;
    }
  }

  saveRandomZoneCooldown({
    playerId: player.id,
    zoneId,
    expiresAt: now + Math.max(1, cooldownSeconds) * 1000,
  });
  return null;
}

export function handleQuestEvent(
  player: QuestRuntimePlayer,
  event: QuestRuntimeEvent,
): QuestEventResult {
  const logs: string[] = [];
  const startedQuestIds: string[] = [];
  const advancedQuestIds: string[] = [];
  const completedQuestIds: string[] = [];
  const completedObjectiveIds: string[] = [];
  const failedQuestIds: string[] = [];
  const rewardLines: string[] = [];

  const allStates = getAllQuestStatesForPlayer(player.id);
  const stateByQuestId = new Map(allStates.map((state) => [state.questId, state] as const));

  const activeQuestIdsSet = new Set(allStates.filter((state) => state.status === 'active').map((state) => state.questId));
  const completedQuestIdsSet = new Set(allStates.filter((state) => state.status === 'completed').map((state) => state.questId));

  const derivedPlayer: QuestRuntimePlayer = {
    ...player,
    gold: player.gold ?? readNumber(PLAYER_GOLD_KEY, 0),
    itemIds: player.itemIds ?? readArray(PLAYER_ITEMS_KEY),
    activeQuestIds: Array.from(activeQuestIdsSet),
    completedQuestIds: Array.from(completedQuestIdsSet),
    flags: player.flags ?? readRecord('theend.player.flags'),
  };

  const syncDerivedQuestLists = () => {
    derivedPlayer.activeQuestIds = Array.from(activeQuestIdsSet);
    derivedPlayer.completedQuestIds = Array.from(completedQuestIdsSet);
  };

  const startQuestSafe = (questId: string): void => {
    const quest = getQuestById(questId);
    if (!quest) {
      logs.push(`Quest not found: ${questId}`);
      return;
    }

    const check = canStartQuestDetailed(derivedPlayer, quest);
    if (!check.canStart) {
      logs.push(`Quest cannot start (${questId}): ${check.reason ?? 'conditions failed'}`);
      return;
    }

    const existing = stateByQuestId.get(questId) ?? null;
    if (existing?.status === 'active') {
      logs.push(`Quest already active: ${questId}`);
      return;
    }
    if ((existing?.status === 'completed' || existing?.status === 'failed') && !quest.isRepeatable) {
      logs.push(`Quest not repeatable: ${questId}`);
      return;
    }

    const state = startQuest(player.id, questId);
    stateByQuestId.set(questId, state);
    activeQuestIdsSet.add(questId);
    syncDerivedQuestLists();
    if (!startedQuestIds.includes(questId)) {
      startedQuestIds.push(questId);
    }
    logs.push(`Quest started: ${questId}`);
  };

  const completeObjectiveSafe = (questId: string, objectiveId: string): void => {
    const quest = getQuestById(questId);
    const state = stateByQuestId.get(questId) ?? null;
    if (!quest || !state || state.status !== 'active') {
      return;
    }

    const step = currentStep(quest, state);
    const objective = step ? asArray(step.objectives).find((entry) => entry.id === objectiveId) ?? null : null;
    const required = objective?.requiredCount && objective.requiredCount > 1 ? Math.max(1, Math.round(objective.requiredCount)) : 1;

    const existingCount = getObjectiveProgressCount(state, objectiveId);
    const nextCount = existingCount + 1;
    let nextState = setObjectiveProgressCount(state, objectiveId, nextCount);

    if (nextCount >= required) {
      if (!nextState.completedObjectiveIds.includes(objectiveId)) {
        nextState = { ...nextState, completedObjectiveIds: [...nextState.completedObjectiveIds, objectiveId] };
        if (!completedObjectiveIds.includes(objectiveId)) {
          completedObjectiveIds.push(objectiveId);
        }
        logs.push(`Objective completed: ${objectiveId}`);
      }
    } else {
      logs.push(`Objective progress: ${objectiveId} (${nextCount}/${required})`);
    }

    nextState = saveQuestState(nextState);
    stateByQuestId.set(questId, nextState);

    if (nextCount >= required) {
      const beforeStepId = nextState.currentStepId;
      const advanced = advanceQuest(player.id, questId);
      stateByQuestId.set(questId, advanced);
      if (advanced.currentStepId !== beforeStepId) {
        advancedQuestIds.push(questId);
        logs.push(`Quest advanced: ${questId}`);
      }
      if (advanced.status === 'completed') {
        completedQuestIds.push(questId);
        activeQuestIdsSet.delete(questId);
        completedQuestIdsSet.add(questId);
        syncDerivedQuestLists();
        logs.push(`Quest completed: ${questId}`);
        const rewards = applyQuestRewards(player.id, questId);
        if (rewards.applied) {
          rewardLines.push(...rewards.rewards);
        }
      }
    }
  };

  const completeStepSafe = (questId: string, stepId?: string): void => {
    const state = stateByQuestId.get(questId) ?? null;
    if (!state || state.status !== 'active') {
      return;
    }

    const beforeStepId = state.currentStepId;
    const next = completeStep(player.id, questId, stepId);
    stateByQuestId.set(questId, next);
    if (next.currentStepId !== beforeStepId) {
      advancedQuestIds.push(questId);
      logs.push(`Quest advanced: ${questId}`);
    }
    if (next.status === 'completed') {
      completedQuestIds.push(questId);
      activeQuestIdsSet.delete(questId);
      completedQuestIdsSet.add(questId);
      syncDerivedQuestLists();
      logs.push(`Quest completed: ${questId}`);
      const rewards = applyQuestRewards(player.id, questId);
      if (rewards.applied) {
        rewardLines.push(...rewards.rewards);
      }
    }
  };

  const completeQuestSafe = (questId: string): void => {
    const state = stateByQuestId.get(questId) ?? null;
    if (!state || state.status !== 'active') {
      return;
    }
    const next = completeQuest(player.id, questId);
    stateByQuestId.set(questId, next);
    completedQuestIds.push(questId);
    activeQuestIdsSet.delete(questId);
    completedQuestIdsSet.add(questId);
    syncDerivedQuestLists();
    logs.push(`Quest completed: ${questId}`);
    const rewards = applyQuestRewards(player.id, questId);
    if (rewards.applied) {
      rewardLines.push(...rewards.rewards);
    }
  };

  const failQuestSafe = (questId: string, reason?: string): void => {
    const state = stateByQuestId.get(questId) ?? null;
    if (!state || state.status !== 'active') {
      return;
    }
    const next = failQuest(player.id, questId, reason);
    stateByQuestId.set(questId, next);
    failedQuestIds.push(questId);
    activeQuestIdsSet.delete(questId);
    syncDerivedQuestLists();
    logs.push(`Quest failed: ${questId}`);
  };

  // Manual/direct event support.
  if (event.type === 'manual' && event.questId) {
    const questId = event.questId;
    if (event.objectiveId) {
      completeObjectiveSafe(questId, event.objectiveId);
    } else if (event.stepId !== undefined) {
      completeStepSafe(questId, event.stepId || undefined);
    } else {
      startQuestSafe(questId);
    }
  }

  // Trigger matching (not started quests).
  // IMPORTANT: explicit manual events that target a single quest must not accidentally start other quests via triggers.
  if (!(event.type === 'manual' && Boolean(event.questId))) {
    for (const quest of getAllQuests()) {
      const questId = quest.id;
      const existing = stateByQuestId.get(questId) ?? null;
      if (existing?.status === 'active') {
        continue;
      }
      if (existing?.status === 'completed' && !quest.isRepeatable) {
        continue;
      }
      if (existing?.status === 'failed' && !quest.isRepeatable) {
        continue;
      }

      for (const trigger of asArray(quest.triggers)) {
        if (!triggerMatchesEvent(trigger, event)) {
          continue;
        }

        const triggerConditionLogs: string[] = [];
        const triggerConditions = asArray(trigger.conditions);
        if (triggerConditions.length > 0 && !evaluateConditionsDetailed(derivedPlayer, triggerConditions, { logs: triggerConditionLogs })) {
          logs.push(`Trigger '${trigger.id}' blocked: ${triggerConditionLogs[0] ?? 'conditions failed'}`);
          continue;
        }

        if (trigger.type === 'random_zone_roll') {
          const zoneId = trigger.zoneId ?? '';
          const now = Date.now();
          const cooldownSeconds = Math.max(1, Math.round(trigger.cooldownSeconds ?? 0));
          const chancePercent = Math.max(0, Math.min(100, Number(trigger.chancePercent ?? 0)));

          const cooldownZoneKey = `${zoneId}::${trigger.id ?? 'random_zone_roll'}`;
          const existingCooldown = getRandomZoneCooldowns().find((entry) => entry.playerId === player.id && entry.zoneId === cooldownZoneKey && entry.expiresAt > now);
          if (existingCooldown) {
            continue;
          }

          const roll = Math.random() * 100;
          saveRandomZoneCooldown({ playerId: player.id, zoneId: cooldownZoneKey, expiresAt: now + cooldownSeconds * 1000 });
          if (roll > chancePercent) {
            continue;
          }
        }

        startQuestSafe(questId);
      }
    }
  }

  // Objective matching (active quests).
  for (const questId of Array.from(activeQuestIdsSet)) {
    const quest = getQuestById(questId);
    const state = stateByQuestId.get(questId) ?? null;
    if (!quest || !state || state.status !== 'active') {
      continue;
    }

    const step = currentStep(quest, state);
    if (!step) {
      continue;
    }

    for (const objective of asArray(step.objectives)) {
      if (state.completedObjectiveIds.includes(objective.id)) {
        continue;
      }
      if (!objectiveMatchesEvent(objective, event)) {
        continue;
      }
      completeObjectiveSafe(questId, objective.id);
    }
  }

  if (event.type === 'zone_inspect' && completedObjectiveIds.length === 0 && startedQuestIds.length === 0) {
    logs.push('Вы осмотрелись, но ничего важного не нашли.');
  }

  return {
    logs,
    startedQuestIds,
    advancedQuestIds,
    completedQuestIds,
    completedObjectiveIds,
    failedQuestIds,
    rewards: rewardLines,
  };
}

export function getQuestValidationWorldData(): QuestValidationWorldData {
  const quests = getAllQuests();
  return {
    npcIds: getAllNpcs().map((entry) => entry.id),
    itemIds: [...Object.keys(ITEMS ?? {})],
    questItemIds: getQuestItems().map((entry) => entry.id),
    professionIds: [],
    markerIds: getQuestMarkers().map((entry) => entry.id),
    zoneIds: getAllZones().map((zone) => zone.id),
    dialogueIds: getAllDialogues().map((entry) => entry.id),
    kingdoms: [],
    factions: [],
    cities: [],
  };
}

export function canActivateQuest(quest: QuestDefinition, worldData: QuestValidationWorldData): boolean {
  const validation = validateQuest(quest, worldData);
  return validation.errors.length === 0;
}

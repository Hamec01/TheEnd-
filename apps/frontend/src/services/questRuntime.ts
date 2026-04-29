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
  QuestValidationWorldData,
} from '../types/quest';

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

function nowIso(): string {
  return new Date().toISOString();
}

function getQuestState(playerId: string, questId: string): PlayerQuestState | null {
  return getAllPlayerQuestStates().find((entry) => entry.playerId === playerId && entry.questId === questId) ?? null;
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

export function evaluateConditions(player: QuestRuntimePlayer, conditions: QuestCondition[]): boolean {
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
      case 'quest_completed':
        if (typeof value === 'string' && !(player.completedQuestIds ?? []).includes(value)) {
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
        break;
    }
  }

  return true;
}

export function canStartQuest(player: QuestRuntimePlayer, quest: QuestDefinition): boolean {
  if (quest.status !== 'active' && quest.status !== 'draft') {
    return false;
  }

  if (typeof quest.minLevel === 'number' && (player.level ?? 0) < quest.minLevel) {
    return false;
  }

  if (!evaluateConditions(player, asArray(quest.conditions))) {
    return false;
  }

  const existing = getQuestState(player.id, quest.id);
  if (!existing) {
    return true;
  }

  if (!quest.isRepeatable && (existing.status === 'completed' || existing.status === 'active')) {
    return false;
  }

  return true;
}

export function startQuest(playerId: string, questId: string): PlayerQuestState {
  const quest = getQuestById(questId);
  if (!quest) {
    throw new Error(`Quest not found: ${questId}`);
  }

  const existing = getQuestState(playerId, questId);
  const state: PlayerQuestState = {
    playerId,
    questId,
    status: 'active',
    currentStepId: asArray(quest.steps)[0]?.id,
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

  return {
    applied: true,
    rewards: asArray(quest.rewards).map((reward) => `${reward.type}:${reward.targetId ?? reward.amount ?? reward.id}`),
  };
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

export function getQuestValidationWorldData(): QuestValidationWorldData {
  const quests = getAllQuests();
  return {
    npcIds: [],
    itemIds: [],
    questItemIds: [],
    professionIds: [],
    markerIds: [],
    zoneIds: [],
    dialogueIds: [],
    kingdoms: [],
    factions: [],
    cities: [],
    ...{},
  };
}

export function canActivateQuest(quest: QuestDefinition, worldData: QuestValidationWorldData): boolean {
  const validation = validateQuest(quest, worldData);
  return validation.errors.length === 0;
}

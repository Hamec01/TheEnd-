import type {
  QuestInteractionChoice,
  QuestInteractionDefinition,
  QuestInteractionEffect,
  QuestInteractionEffectResult,
  QuestInteractionEvent,
  QuestInteractionRequirement,
} from '../types/quest';
import { getQuestInteractions } from './questRepository';
import {
  applyQuestRewards,
  completeObjective,
  completeQuest,
  completeStep,
  failQuest,
  getPlayerQuestState,
  setQuestFlag,
  startQuest,
  type QuestRuntimePlayer,
} from './questRuntime';

const QUEST_INTERACTIONS_USED_KEY = 'theend.questInteractions.used';
const PLAYER_ITEMS_KEY = 'theend.player.items';
const PLAYER_QUEST_ITEMS_KEY = 'theend.player.questItems';
const PLAYER_SKILLS_KEY = 'theend.player.skills';
const PLAYER_GOLD_KEY = 'theend.player.gold';
const PLAYER_XP_KEY = 'theend.player.experience';
const PLAYER_FLAGS_KEY = 'theend.player.flags';
const PLAYER_REP_KEY = 'theend.player.reputation';
const PLAYER_UNLOCKED_LOCATIONS_KEY = 'theend.player.unlockedLocations';
const PLAYER_UNLOCKED_DIALOGUES_KEY = 'theend.player.unlockedDialogues';

interface UsedQuestInteractionRecord {
  usedAt: string;
  choiceId?: string;
}

type UsedQuestInteractionsByPlayer = Record<string, Record<string, UsedQuestInteractionRecord>>;

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

function readArray(key: string): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<string[]>(window.localStorage.getItem(key), []);
}

function writeArray(key: string, value: string[]): void {
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

function readUsedInteractions(): UsedQuestInteractionsByPlayer {
  if (typeof window === 'undefined') {
    return {};
  }
  return safeParse<UsedQuestInteractionsByPlayer>(window.localStorage.getItem(QUEST_INTERACTIONS_USED_KEY), {});
}

function writeUsedInteractions(value: UsedQuestInteractionsByPlayer): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(QUEST_INTERACTIONS_USED_KEY, JSON.stringify(value));
}

export function getUsedQuestInteractionIds(playerId: string): string[] {
  const normalizedPlayerId = String(playerId ?? '').trim();
  if (!normalizedPlayerId) {
    return [];
  }
  const map = readUsedInteractions();
  return Object.keys(map[normalizedPlayerId] ?? {});
}

export function hasUsedQuestInteraction(playerId: string, interactionId: string): boolean {
  const normalizedPlayerId = String(playerId ?? '').trim();
  const normalizedInteractionId = String(interactionId ?? '').trim();
  if (!normalizedPlayerId || !normalizedInteractionId) {
    return false;
  }
  const map = readUsedInteractions();
  return Boolean(map[normalizedPlayerId]?.[normalizedInteractionId]);
}

export function markQuestInteractionUsed(playerId: string, interactionId: string, choiceId?: string): void {
  const normalizedPlayerId = String(playerId ?? '').trim();
  const normalizedInteractionId = String(interactionId ?? '').trim();
  if (!normalizedPlayerId || !normalizedInteractionId) {
    return;
  }
  const map = readUsedInteractions();
  const playerMap = map[normalizedPlayerId] ?? {};
  playerMap[normalizedInteractionId] = {
    usedAt: new Date().toISOString(),
    choiceId: choiceId ? String(choiceId).trim() : undefined,
  };
  map[normalizedPlayerId] = playerMap;
  writeUsedInteractions(map);
}

function addUnique(target: string[], value: string): void {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function valueAsString(value: unknown): string {
  return String(value ?? '').trim();
}

function evaluateRequirement(player: QuestRuntimePlayer, requirement: QuestInteractionRequirement): boolean {
  const questId = valueAsString(requirement.questId);
  const objectiveId = valueAsString(requirement.objectiveId);
  const stepId = valueAsString(requirement.stepId);
  const itemId = valueAsString(requirement.itemId);
  const questItemId = valueAsString(requirement.questItemId);
  const skillId = valueAsString(requirement.skillId);
  const flagKey = valueAsString(requirement.flagKey);

  const state = questId ? getPlayerQuestState(player.id, questId) : null;

  switch (requirement.type) {
    case 'quest_not_started':
      return questId ? !state : false;
    case 'quest_active':
      return questId ? state?.status === 'active' : false;
    case 'quest_completed':
      return questId ? state?.status === 'completed' : false;
    case 'quest_failed':
      return questId ? state?.status === 'failed' : false;
    case 'objective_completed':
      return Boolean(state && objectiveId && state.completedObjectiveIds.includes(objectiveId));
    case 'objective_not_completed':
      return Boolean(state && objectiveId && !state.completedObjectiveIds.includes(objectiveId));
    case 'step_completed':
      return Boolean(state && stepId && state.completedStepIds.includes(stepId));
    case 'step_not_completed':
      return Boolean(state && stepId && !state.completedStepIds.includes(stepId));
    case 'has_item':
      return itemId ? readArray(PLAYER_ITEMS_KEY).includes(itemId) : false;
    case 'missing_item':
      return itemId ? !readArray(PLAYER_ITEMS_KEY).includes(itemId) : false;
    case 'has_quest_item':
      return questItemId ? readArray(PLAYER_QUEST_ITEMS_KEY).includes(questItemId) : false;
    case 'missing_quest_item':
      return questItemId ? !readArray(PLAYER_QUEST_ITEMS_KEY).includes(questItemId) : false;
    case 'has_skill':
      return skillId ? readArray(PLAYER_SKILLS_KEY).includes(skillId) : false;
    case 'missing_skill':
      return skillId ? !readArray(PLAYER_SKILLS_KEY).includes(skillId) : false;
    case 'has_flag': {
      const flags = readRecord(PLAYER_FLAGS_KEY);
      return Boolean(flagKey && Object.prototype.hasOwnProperty.call(flags, flagKey));
    }
    case 'flag_equals': {
      const flags = readRecord(PLAYER_FLAGS_KEY);
      return Boolean(flagKey && flags[flagKey] === requirement.value);
    }
    case 'race_is':
      return Boolean(valueAsString(requirement.raceId) && player.race === requirement.raceId);
    case 'class_is':
      return Boolean(valueAsString(requirement.classId) && player.classId === requirement.classId);
    case 'level_min':
      return typeof requirement.amount === 'number' ? (player.level ?? 0) >= requirement.amount : false;
    case 'level_max':
      return typeof requirement.amount === 'number' ? (player.level ?? 0) <= requirement.amount : false;
    case 'faction_relation_min': {
      const key = valueAsString(requirement.factionId);
      if (!key || typeof requirement.amount !== 'number') {
        return false;
      }
      const rep = readRecord(PLAYER_REP_KEY);
      return Number(rep[key] ?? 0) >= requirement.amount;
    }
    default:
      return false;
  }
}

export function evaluateRequirements(player: QuestRuntimePlayer, requirements: QuestInteractionRequirement[] | undefined): boolean {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return true;
  }
  return requirements.every((requirement) => evaluateRequirement(player, requirement));
}

function triggerMatchesEvent(interaction: QuestInteractionDefinition, event: QuestInteractionEvent): boolean {
  if (interaction.triggerType !== event.type) {
    return false;
  }

  switch (event.type) {
    case 'zone_inspect':
    case 'zone_enter':
      return !interaction.zoneId || interaction.zoneId === event.zoneId;
    case 'marker_reached':
      return !interaction.markerId || interaction.markerId === event.markerId;
    case 'object_interact':
      return !interaction.objectId || interaction.objectId === event.objectId;
    case 'item_use':
      return !interaction.itemId || interaction.itemId === event.itemId;
    case 'npc_interact':
      return !interaction.npcId || interaction.npcId === event.npcId;
    case 'manual':
      return true;
    default:
      return false;
  }
}

function isHiddenByProgress(player: QuestRuntimePlayer, interaction: QuestInteractionDefinition): boolean {
  const questId = valueAsString(interaction.questId);
  if (!questId) {
    return false;
  }
  const state = getPlayerQuestState(player.id, questId);
  if (!state) {
    return false;
  }

  if (interaction.hideAfterQuestCompleted && state.status === 'completed') {
    return true;
  }

  if (interaction.hideAfterObjectiveCompleted && interaction.objectiveId && state.completedObjectiveIds.includes(interaction.objectiveId)) {
    return true;
  }

  if (interaction.hideAfterStepCompleted && interaction.stepId && state.completedStepIds.includes(interaction.stepId)) {
    return true;
  }

  return false;
}

export function getAvailableQuestInteractionChoices(
  interaction: QuestInteractionDefinition,
  player: QuestRuntimePlayer,
): QuestInteractionChoice[] {
  const visible = (interaction.choices ?? []).filter((choice) => evaluateRequirements(player, choice.requirements));
  if (visible.length > 0) {
    return visible;
  }
  return [{ id: '__leave__', text: 'Уйти', close: true }];
}

export function findMatchingQuestInteractions(
  event: QuestInteractionEvent,
  player: QuestRuntimePlayer,
  interactions: QuestInteractionDefinition[] = getQuestInteractions(),
): QuestInteractionDefinition[] {
  return interactions
    .filter((interaction) => interaction.isActive !== false)
    .filter((interaction) => triggerMatchesEvent(interaction, event))
    .filter((interaction) => !(interaction.consumeOnUse && hasUsedQuestInteraction(player.id, interaction.id)))
    .filter((interaction) => !isHiddenByProgress(player, interaction))
    .filter((interaction) => {
      const legacyRequirements: QuestInteractionRequirement[] = [];
      if (interaction.requiredQuestId && interaction.requiredQuestStatus) {
        legacyRequirements.push({
          type: `quest_${interaction.requiredQuestStatus}` as QuestInteractionRequirement['type'],
          questId: interaction.requiredQuestId,
        });
      }
      if (interaction.requiredObjectiveId && interaction.questId) {
        legacyRequirements.push({
          type: 'objective_completed',
          questId: interaction.questId,
          objectiveId: interaction.requiredObjectiveId,
        });
      }
      if (interaction.requiredItemId) {
        legacyRequirements.push({ type: 'has_item', itemId: interaction.requiredItemId });
      }
      if (interaction.requiredQuestItemId) {
        legacyRequirements.push({ type: 'has_quest_item', questItemId: interaction.requiredQuestItemId });
      }
      return evaluateRequirements(player, [...legacyRequirements, ...(interaction.requirements ?? [])]);
    });
}

function normalizeChoiceEffects(interaction: QuestInteractionDefinition, choice: QuestInteractionChoice): QuestInteractionEffect[] {
  const fromNew = Array.isArray(choice.effects) ? choice.effects : [];
  const legacy: QuestInteractionEffect[] = [];
  const questId = interaction.questId;

  if (choice.completeObjectiveId) {
    legacy.push({ type: 'complete_objective', questId, objectiveId: choice.completeObjectiveId });
  }
  if (choice.completeStepId) {
    legacy.push({ type: 'complete_step', questId, stepId: choice.completeStepId });
  }
  if (choice.completeQuest) {
    legacy.push({ type: 'complete_quest', questId });
  }
  if (choice.giveRewards) {
    legacy.push({ type: 'give_rewards', questId });
  }
  if (choice.startQuestId) {
    legacy.push({ type: 'start_quest', questId: choice.startQuestId });
  }
  if (choice.setFlag?.key) {
    legacy.push({ type: 'set_flag', questId, flagKey: choice.setFlag.key, value: choice.setFlag.value });
  }

  return [...fromNew, ...legacy].filter((effect) => Boolean(effect.type));
}

export function runQuestInteractionEffects(
  playerId: string,
  interaction: QuestInteractionDefinition,
  choice: QuestInteractionChoice,
): QuestInteractionEffectResult {
  const logs: string[] = [];
  const completedQuestIds: string[] = [];
  const startedQuestIds: string[] = [];
  const grantedRewardLines: string[] = [];
  const events: QuestInteractionEffectResult['events'] = [];

  const effects = normalizeChoiceEffects(interaction, choice);

  for (const effect of effects) {
    const effectQuestId = valueAsString(effect.questId) || valueAsString(interaction.questId);

    try {
      switch (effect.type) {
        case 'complete_objective':
          if (effectQuestId && effect.objectiveId) {
            completeObjective(playerId, effectQuestId, effect.objectiveId);
            logs.push(`Objective completed: ${effect.objectiveId}`);
          }
          break;
        case 'complete_step':
          if (effectQuestId) {
            completeStep(playerId, effectQuestId, effect.stepId);
            logs.push(`Step completed: ${effect.stepId ?? 'current'}`);
          }
          break;
        case 'complete_quest':
          if (effectQuestId) {
            completeQuest(playerId, effectQuestId);
            addUnique(completedQuestIds, effectQuestId);
            logs.push(`Quest completed: ${effectQuestId}`);
          }
          break;
        case 'start_quest':
          if (effect.questId) {
            startQuest(playerId, effect.questId);
            addUnique(startedQuestIds, effect.questId);
            logs.push(`Quest started: ${effect.questId}`);
          }
          break;
        case 'fail_quest':
          if (effectQuestId) {
            failQuest(playerId, effectQuestId, 'interaction_effect');
            logs.push(`Quest failed: ${effectQuestId}`);
          }
          break;
        case 'give_rewards':
          if (effectQuestId) {
            const result = applyQuestRewards(playerId, effectQuestId);
            if (result.applied) {
              addUnique(completedQuestIds, effectQuestId);
              grantedRewardLines.push(...result.rewards);
              logs.push(`Rewards granted: ${effectQuestId}`);
            }
          }
          break;
        case 'give_item':
          if (effect.itemId) {
            const items = readArray(PLAYER_ITEMS_KEY);
            if (!items.includes(effect.itemId)) {
              writeArray(PLAYER_ITEMS_KEY, [...items, effect.itemId]);
            }
            logs.push(`Item granted: ${effect.itemId}`);
          }
          break;
        case 'take_item':
          if (effect.itemId) {
            writeArray(PLAYER_ITEMS_KEY, readArray(PLAYER_ITEMS_KEY).filter((id) => id !== effect.itemId));
            logs.push(`Item removed: ${effect.itemId}`);
          }
          break;
        case 'give_quest_item':
          if (effect.questItemId) {
            const questItems = readArray(PLAYER_QUEST_ITEMS_KEY);
            if (!questItems.includes(effect.questItemId)) {
              writeArray(PLAYER_QUEST_ITEMS_KEY, [...questItems, effect.questItemId]);
            }
            logs.push(`Quest item granted: ${effect.questItemId}`);
          }
          break;
        case 'take_quest_item':
          if (effect.questItemId) {
            writeArray(PLAYER_QUEST_ITEMS_KEY, readArray(PLAYER_QUEST_ITEMS_KEY).filter((id) => id !== effect.questItemId));
            logs.push(`Quest item removed: ${effect.questItemId}`);
          }
          break;
        case 'give_skill':
          if (effect.skillId) {
            const skills = readArray(PLAYER_SKILLS_KEY);
            if (!skills.includes(effect.skillId)) {
              writeArray(PLAYER_SKILLS_KEY, [...skills, effect.skillId]);
            }
            logs.push(`Skill granted: ${effect.skillId}`);
          }
          break;
        case 'give_gold': {
          const amount = Math.max(0, Number(effect.amount ?? 0));
          if (amount > 0) {
            writeNumber(PLAYER_GOLD_KEY, readNumber(PLAYER_GOLD_KEY, 0) + amount);
            grantedRewardLines.push(`gold:+${amount}`);
          }
          break;
        }
        case 'give_experience': {
          const amount = Math.max(0, Number(effect.amount ?? 0));
          if (amount > 0) {
            writeNumber(PLAYER_XP_KEY, readNumber(PLAYER_XP_KEY, 0) + amount);
            grantedRewardLines.push(`experience:+${amount}`);
          }
          break;
        }
        case 'set_flag': {
          if (effect.flagKey) {
            if (effectQuestId) {
              setQuestFlag(playerId, effectQuestId, effect.flagKey, effect.value ?? true);
            } else {
              const flags = readRecord(PLAYER_FLAGS_KEY);
              flags[effect.flagKey] = effect.value ?? true;
              writeRecord(PLAYER_FLAGS_KEY, flags);
            }
            logs.push(`Flag set: ${effect.flagKey}`);
          }
          break;
        }
        case 'unlock_location':
          if (effect.locationId) {
            const unlocked = readArray(PLAYER_UNLOCKED_LOCATIONS_KEY);
            if (!unlocked.includes(effect.locationId)) {
              writeArray(PLAYER_UNLOCKED_LOCATIONS_KEY, [...unlocked, effect.locationId]);
            }
            grantedRewardLines.push(`unlock_location:${effect.locationId}`);
          }
          break;
        case 'unlock_dialogue':
          if (effect.dialogueId) {
            const unlocked = readArray(PLAYER_UNLOCKED_DIALOGUES_KEY);
            if (!unlocked.includes(effect.dialogueId)) {
              writeArray(PLAYER_UNLOCKED_DIALOGUES_KEY, [...unlocked, effect.dialogueId]);
            }
            break;
          }
          break;
        case 'open_dialogue':
          if (effect.dialogueId) {
            events.push({ type: 'open_dialogue', dialogueId: effect.dialogueId });
          }
          break;
        case 'open_shop':
          events.push({ type: 'open_shop', shopId: effect.shopId });
          break;
        case 'start_combat':
          events.push({ type: 'start_combat', enemyId: effect.enemyId });
          break;
        default:
          logs.push(`Unhandled interaction effect: ${effect.type}`);
          break;
      }
    } catch (error) {
      logs.push(`Interaction effect failed (${effect.type}): ${(error as Error).message}`);
    }
  }

  const hasNonCloseEffects = effects.length > 0;
  if (interaction.consumeOnUse && hasNonCloseEffects && choice.close !== true) {
    markQuestInteractionUsed(playerId, interaction.id, choice.id);
  }

  return {
    logs,
    completedQuestIds,
    startedQuestIds,
    grantedRewardLines,
    events,
  };
}

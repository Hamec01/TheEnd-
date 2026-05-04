import type {
  PlayerQuestState,
  QuestDefinition,
  QuestInteractionDefinition,
  QuestItemDefinition,
  RandomQuestCooldown,
} from '../types/quest';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  updateContentEntry,
} from './content/contentApi';

const PLAYER_QUESTS_KEY = 'theend.playerQuests';
const RANDOM_ZONE_COOLDOWNS_KEY = 'theend.questRandomZoneCooldowns';

let questsCache: QuestDefinition[] = [];
let questInteractionsCache: QuestInteractionDefinition[] = [];
let questItemsCache: QuestItemDefinition[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

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

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<T[]>(window.localStorage.getItem(key), []);
}

function writeArray<T>(key: string, values: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(values));
}

export async function ensureQuestsLoaded(force = false): Promise<void> {
  if (loaded && !force) {
    return;
  }
  if (!loadPromise) {
    loadPromise = Promise.all([
      getContentCollection<QuestDefinition>('quests'),
      getContentCollection<QuestInteractionDefinition>('questInteractions'),
      getContentCollection<QuestItemDefinition>('questItems'),
    ]).then(([quests, interactions, items]) => {
      questsCache = quests;
      questInteractionsCache = interactions;
      questItemsCache = items;
      loaded = true;
      loadPromise = null;
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

function invalidate(): void {
  loaded = false;
}

export function getAllQuests(): QuestDefinition[] {
  return [...questsCache];
}

export function getQuestById(id: string): QuestDefinition | null {
  return questsCache.find((quest) => quest.id === id) ?? null;
}

export async function saveQuest(quest: QuestDefinition): Promise<QuestDefinition> {
  await ensureQuestsLoaded();
  const exists = questsCache.some((entry) => entry.id === quest.id);
  const saved = exists
    ? await updateContentEntry<QuestDefinition>('quests', quest.id, quest)
    : await createContentEntry<QuestDefinition>('quests', quest);
  invalidate();
  await ensureQuestsLoaded(true);
  return saved;
}

export async function deleteQuest(id: string): Promise<void> {
  await deleteContentEntry('quests', id);
  invalidate();
  await ensureQuestsLoaded(true);
}

export async function duplicateQuest(id: string): Promise<QuestDefinition> {
  const source = getQuestById(id);
  if (!source) {
    throw new Error(`Quest not found: ${id}`);
  }

  const suffix = Math.floor(Math.random() * 10000);
  const copy: QuestDefinition = {
    ...source,
    id: `${source.id}_copy_${suffix}`,
    title: `${source.title} Copy`,
    status: 'draft',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  return saveQuest(copy);
}

export function getQuestInteractions(): QuestInteractionDefinition[] {
  return [...questInteractionsCache];
}

export function getQuestInteractionById(id: string): QuestInteractionDefinition | null {
  return questInteractionsCache.find((interaction) => interaction.id === id) ?? null;
}

export async function saveQuestInteraction(interaction: QuestInteractionDefinition): Promise<QuestInteractionDefinition> {
  await ensureQuestsLoaded();
  const exists = questInteractionsCache.some((entry) => entry.id === interaction.id);
  const saved = exists
    ? await updateContentEntry<QuestInteractionDefinition>('questInteractions', interaction.id, interaction)
    : await createContentEntry<QuestInteractionDefinition>('questInteractions', interaction);
  invalidate();
  await ensureQuestsLoaded(true);
  return saved;
}

export async function deleteQuestInteraction(id: string): Promise<void> {
  await deleteContentEntry('questInteractions', id);
  invalidate();
  await ensureQuestsLoaded(true);
}

export function getQuestItems(): QuestItemDefinition[] {
  return [...questItemsCache];
}

export function getQuestItemById(id: string): QuestItemDefinition | null {
  return questItemsCache.find((item) => item.id === id) ?? null;
}

export async function saveQuestItem(item: QuestItemDefinition): Promise<QuestItemDefinition> {
  await ensureQuestsLoaded();
  const exists = questItemsCache.some((entry) => entry.id === item.id);
  const saved = exists
    ? await updateContentEntry<QuestItemDefinition>('questItems', item.id, item)
    : await createContentEntry<QuestItemDefinition>('questItems', item);
  invalidate();
  await ensureQuestsLoaded(true);
  return saved;
}

export async function deleteQuestItem(id: string): Promise<void> {
  await deleteContentEntry('questItems', id);
  invalidate();
  await ensureQuestsLoaded(true);
}

export async function exportQuestsJson(): Promise<string> {
  await ensureQuestsLoaded();
  return JSON.stringify(
    {
      quests: questsCache,
      questInteractions: questInteractionsCache,
      questItems: questItemsCache,
    },
    null,
    2,
  );
}

export async function importQuestsJson(raw: string): Promise<{ quests: number; questInteractions: number; questItems: number }> {
  const parsed = JSON.parse(raw) as {
    quests?: QuestDefinition[];
    questInteractions?: QuestInteractionDefinition[];
    questItems?: QuestItemDefinition[];
  };
  const quests = Array.isArray(parsed.quests) ? parsed.quests : [];
  const questInteractions = Array.isArray(parsed.questInteractions) ? parsed.questInteractions : [];
  const questItems = Array.isArray(parsed.questItems) ? parsed.questItems : [];

  await ensureQuestsLoaded();
  const questIds = new Set(questsCache.map((entry) => entry.id));
  const questInteractionIds = new Set(questInteractionsCache.map((entry) => entry.id));
  const questItemIds = new Set(questItemsCache.map((entry) => entry.id));

  let questCount = 0;
  for (const entry of quests) {
    if (!entry?.id?.trim()) {
      continue;
    }
    if (questIds.has(entry.id.trim())) {
      await updateContentEntry<QuestDefinition>('quests', entry.id.trim(), entry);
    } else {
      await createContentEntry<QuestDefinition>('quests', entry);
      questIds.add(entry.id.trim());
    }
    questCount += 1;
  }

  let questInteractionCount = 0;
  for (const entry of questInteractions) {
    if (!entry?.id?.trim()) {
      continue;
    }
    if (questInteractionIds.has(entry.id.trim())) {
      await updateContentEntry<QuestInteractionDefinition>('questInteractions', entry.id.trim(), entry);
    } else {
      await createContentEntry<QuestInteractionDefinition>('questInteractions', entry);
      questInteractionIds.add(entry.id.trim());
    }
    questInteractionCount += 1;
  }

  let questItemCount = 0;
  for (const entry of questItems) {
    if (!entry?.id?.trim()) {
      continue;
    }
    if (questItemIds.has(entry.id.trim())) {
      await updateContentEntry<QuestItemDefinition>('questItems', entry.id.trim(), entry);
    } else {
      await createContentEntry<QuestItemDefinition>('questItems', entry);
      questItemIds.add(entry.id.trim());
    }
    questItemCount += 1;
  }

  invalidate();
  await ensureQuestsLoaded(true);
  return {
    quests: questCount,
    questInteractions: questInteractionCount,
    questItems: questItemCount,
  };
}

export function getAllPlayerQuestStates(): PlayerQuestState[] {
  return readArray<PlayerQuestState>(PLAYER_QUESTS_KEY);
}

export function savePlayerQuestState(state: PlayerQuestState): void {
  const current = getAllPlayerQuestStates();
  const next = [...current.filter((entry) => !(entry.playerId === state.playerId && entry.questId === state.questId)), state];
  writeArray(PLAYER_QUESTS_KEY, next);
}

export function getRandomZoneCooldowns(): RandomQuestCooldown[] {
  return readArray<RandomQuestCooldown>(RANDOM_ZONE_COOLDOWNS_KEY);
}

export function saveRandomZoneCooldown(cooldown: RandomQuestCooldown): void {
  const current = getRandomZoneCooldowns();
  const next = [
    ...current.filter((entry) => !(entry.playerId === cooldown.playerId && entry.zoneId === cooldown.zoneId)),
    cooldown,
  ];
  writeArray(RANDOM_ZONE_COOLDOWNS_KEY, next);
}


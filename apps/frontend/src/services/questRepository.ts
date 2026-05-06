import type {
  PlayerQuestState,
  QuestDefinition,
  QuestInteractionDefinition,
  QuestItemDefinition,
  RandomQuestCooldown,
} from '../types/quest';
import {
  createContentEntry,
  getContentEntry,
  deleteContentEntry,
  getContentCollection,
  updateContentEntry,
} from './content/contentApi';
import { saveCharacterQuestState } from '../api';

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

function normalizeEntityId(id: string | undefined): string {
  return String(id ?? '').trim();
}

async function verifyCollectionEntry<T>(collection: 'quests' | 'questInteractions' | 'questItems', id: string): Promise<T> {
  const verified = await getContentEntry<T>(collection, id);
  if (!verified) {
    throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
  }
  return verified;
}

export function getAllQuests(): QuestDefinition[] {
  return [...questsCache];
}

export function getQuestById(id: string): QuestDefinition | null {
  const normalizedId = normalizeEntityId(id);
  return questsCache.find((quest) => normalizeEntityId(quest.id) === normalizedId) ?? null;
}

export async function saveQuest(quest: QuestDefinition): Promise<QuestDefinition> {
  await ensureQuestsLoaded();
  const normalizedId = normalizeEntityId(quest.id);
  if (!normalizedId) {
    throw new Error('Quest id is required.');
  }

  const normalizedQuest: QuestDefinition = {
    ...quest,
    id: normalizedId,
    title: quest.title?.trim() || normalizedId,
  };

  const exists = questsCache.some((entry) => normalizeEntityId(entry.id) === normalizedId);
  const saved = exists
    ? await updateContentEntry<QuestDefinition>('quests', normalizedId, normalizedQuest)
    : await createContentEntry<QuestDefinition>('quests', normalizedQuest);

  const verified = await verifyCollectionEntry<QuestDefinition>('quests', normalizedId);
  questsCache = exists
    ? questsCache.map((entry) => normalizeEntityId(entry.id) === normalizedId ? verified : entry)
    : [...questsCache, verified];

  return verified;
}

export async function renameQuest(oldId: string, quest: QuestDefinition): Promise<QuestDefinition> {
  await ensureQuestsLoaded();
  const fromId = normalizeEntityId(oldId);
  const toId = normalizeEntityId(quest.id);
  if (!fromId || !toId) {
    throw new Error('Quest id is required.');
  }
  if (fromId === toId) {
    return saveQuest(quest);
  }

  const alreadyExists = questsCache.some((entry) => normalizeEntityId(entry.id) === toId);
  if (alreadyExists) {
    throw new Error(`Duplicate quest id: ${toId}`);
  }

  const normalizedQuest: QuestDefinition = {
    ...quest,
    id: toId,
    title: quest.title?.trim() || toId,
  };

  await createContentEntry<QuestDefinition>('quests', normalizedQuest);
  await deleteContentEntry('quests', fromId);

  invalidate();
  await ensureQuestsLoaded(true);
  return verifyCollectionEntry<QuestDefinition>('quests', toId);
}

export async function deleteQuest(id: string): Promise<void> {
  const normalizedId = normalizeEntityId(id);
  if (!normalizedId) {
    return;
  }
  await deleteContentEntry('quests', normalizedId);
  questsCache = questsCache.filter((entry) => normalizeEntityId(entry.id) !== normalizedId);
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
  const normalizedId = normalizeEntityId(id);
  return questInteractionsCache.find((interaction) => normalizeEntityId(interaction.id) === normalizedId) ?? null;
}

export async function saveQuestInteraction(interaction: QuestInteractionDefinition): Promise<QuestInteractionDefinition> {
  await ensureQuestsLoaded();
  const normalizedId = normalizeEntityId(interaction.id);
  if (!normalizedId) {
    throw new Error('Quest interaction id is required.');
  }

  const normalizedInteraction: QuestInteractionDefinition = {
    ...interaction,
    id: normalizedId,
    title: interaction.title?.trim() || normalizedId,
  };

  const exists = questInteractionsCache.some((entry) => normalizeEntityId(entry.id) === normalizedId);
  const saved = exists
    ? await updateContentEntry<QuestInteractionDefinition>('questInteractions', normalizedId, normalizedInteraction)
    : await createContentEntry<QuestInteractionDefinition>('questInteractions', normalizedInteraction);

  const verified = await verifyCollectionEntry<QuestInteractionDefinition>('questInteractions', normalizedId);
  questInteractionsCache = exists
    ? questInteractionsCache.map((entry) => normalizeEntityId(entry.id) === normalizedId ? verified : entry)
    : [...questInteractionsCache, verified];

  return verified;
}

export async function renameQuestInteraction(oldId: string, interaction: QuestInteractionDefinition): Promise<QuestInteractionDefinition> {
  await ensureQuestsLoaded();
  const fromId = normalizeEntityId(oldId);
  const toId = normalizeEntityId(interaction.id);
  if (!fromId || !toId) {
    throw new Error('Quest interaction id is required.');
  }
  if (fromId === toId) {
    return saveQuestInteraction(interaction);
  }

  const alreadyExists = questInteractionsCache.some((entry) => normalizeEntityId(entry.id) === toId);
  if (alreadyExists) {
    throw new Error(`Duplicate quest interaction id: ${toId}`);
  }

  const normalizedInteraction: QuestInteractionDefinition = {
    ...interaction,
    id: toId,
    title: interaction.title?.trim() || toId,
  };

  await createContentEntry<QuestInteractionDefinition>('questInteractions', normalizedInteraction);
  await deleteContentEntry('questInteractions', fromId);

  invalidate();
  await ensureQuestsLoaded(true);
  return verifyCollectionEntry<QuestInteractionDefinition>('questInteractions', toId);
}

export async function deleteQuestInteraction(id: string): Promise<void> {
  const normalizedId = normalizeEntityId(id);
  if (!normalizedId) {
    return;
  }
  await deleteContentEntry('questInteractions', normalizedId);
  questInteractionsCache = questInteractionsCache.filter((entry) => normalizeEntityId(entry.id) !== normalizedId);
}

export function getQuestItems(): QuestItemDefinition[] {
  return [...questItemsCache];
}

export function getQuestItemById(id: string): QuestItemDefinition | null {
  const normalizedId = normalizeEntityId(id);
  return questItemsCache.find((item) => normalizeEntityId(item.id) === normalizedId) ?? null;
}

export async function saveQuestItem(item: QuestItemDefinition): Promise<QuestItemDefinition> {
  await ensureQuestsLoaded();

  const normalizedId = normalizeEntityId(item.id);
  if (!normalizedId) {
    throw new Error('Quest item id is required.');
  }

  const normalizedItem: QuestItemDefinition = {
    ...item,
    id: normalizedId,
    name: item.name?.trim() || normalizedId,
    description: item.description?.trim?.() ?? item.description,
    linkedQuestId: item.linkedQuestId?.trim() || undefined,
  };

  const exists = questItemsCache.some((entry) => normalizeEntityId(entry.id) === normalizedId);
  const saved = exists
    ? await updateContentEntry<QuestItemDefinition>('questItems', normalizedId, normalizedItem)
    : await createContentEntry<QuestItemDefinition>('questItems', normalizedItem);

  const verified = await verifyCollectionEntry<QuestItemDefinition>('questItems', normalizedId);
  questItemsCache = exists
    ? questItemsCache.map((entry) => normalizeEntityId(entry.id) === normalizedId ? verified : entry)
    : [...questItemsCache, verified];

  return verified;
}

export async function renameQuestItem(oldId: string, item: QuestItemDefinition): Promise<QuestItemDefinition> {
  await ensureQuestsLoaded();
  const fromId = normalizeEntityId(oldId);
  const toId = normalizeEntityId(item.id);
  if (!fromId || !toId) {
    throw new Error('Quest item id is required.');
  }
  if (fromId === toId) {
    return saveQuestItem(item);
  }

  const alreadyExists = questItemsCache.some((entry) => normalizeEntityId(entry.id) === toId);
  if (alreadyExists) {
    throw new Error(`Duplicate quest item id: ${toId}`);
  }

  const normalizedItem: QuestItemDefinition = {
    ...item,
    id: toId,
    name: item.name?.trim() || toId,
    description: item.description?.trim?.() ?? item.description,
    linkedQuestId: item.linkedQuestId?.trim() || undefined,
  };

  await createContentEntry<QuestItemDefinition>('questItems', normalizedItem);
  await deleteContentEntry('questItems', fromId);

  invalidate();
  await ensureQuestsLoaded(true);
  return verifyCollectionEntry<QuestItemDefinition>('questItems', toId);
}

export async function deleteQuestItem(id: string): Promise<void> {
  const normalizedId = normalizeEntityId(id);
  if (!normalizedId) {
    return;
  }
  await deleteContentEntry('questItems', normalizedId);
  questItemsCache = questItemsCache.filter((entry) => normalizeEntityId(entry.id) !== normalizedId);
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

  void saveCharacterQuestState(state.playerId, state.questId, state).catch((error) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[quests] Failed to persist quest state:', error);
    }
  });
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


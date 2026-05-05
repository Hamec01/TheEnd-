import type { DialogueDefinition } from '../types/dialogue';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  getContentEntry,
  updateContentEntry,
} from './content/contentApi';

let cache: DialogueDefinition[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

export async function ensureDialoguesLoaded(force = false): Promise<void> {
  if (loaded && !force) {
    return;
  }
  if (!loadPromise) {
    loadPromise = getContentCollection<DialogueDefinition>('dialogues').then((entries) => {
      cache = entries;
      loaded = true;
      loadPromise = null;
    }).catch((error) => {
      loadPromise = null;
      throw error;
    });
  }
  return loadPromise;
}

function invalidateCache(): void {
  loaded = false;
}

function normalizeId(id: string | undefined): string {
  return String(id ?? '').trim();
}

export function getAllDialogues(): DialogueDefinition[] {
  return [...cache];
}

export function getDialogueById(id: string): DialogueDefinition | null {
  const normalizedId = normalizeId(id);
  return cache.find((entry) => normalizeId(entry.id) === normalizedId) ?? null;
}

export function getDialoguesByNpc(npcId: string): DialogueDefinition[] {
  const normalizedNpcId = normalizeId(npcId);
  return cache.filter((entry) => normalizeId(entry.npcId) === normalizedNpcId);
}

export async function saveDialogue(dialogue: DialogueDefinition): Promise<DialogueDefinition> {
  await ensureDialoguesLoaded();
  const normalizedId = normalizeId(dialogue.id);
  if (!normalizedId) {
    throw new Error('Dialogue id is required.');
  }

  const normalizedDialogue: DialogueDefinition = {
    ...dialogue,
    id: normalizedId,
    title: dialogue.title?.trim() || normalizedId,
  };

  const exists = cache.some((entry) => normalizeId(entry.id) === normalizedId);
  const saved = exists
    ? await updateContentEntry<DialogueDefinition>('dialogues', normalizedId, normalizedDialogue)
    : await createContentEntry<DialogueDefinition>('dialogues', normalizedDialogue);

  const verified = await getContentEntry<DialogueDefinition>('dialogues', normalizedId);
  if (!verified) {
    throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
  }

  cache = exists
    ? cache.map((entry) => normalizeId(entry.id) === normalizedId ? verified : entry)
    : [...cache, verified];

  return verified;
}

export async function deleteDialogue(id: string): Promise<void> {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    return;
  }
  await deleteContentEntry('dialogues', normalizedId);
  cache = cache.filter((entry) => normalizeId(entry.id) !== normalizedId);
}

export async function duplicateDialogue(id: string): Promise<DialogueDefinition> {
  const source = getDialogueById(id);
  if (!source) {
    throw new Error(`Dialogue not found: ${id}`);
  }

  const copy: DialogueDefinition = {
    ...source,
    id: `${source.id}_copy_${Math.floor(Math.random() * 10000)}`,
    title: `${source.title} Copy`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: Array.isArray(source.nodes) ? source.nodes.map((node) => ({ ...node })) : [],
  };

  return saveDialogue(copy);
}

export async function exportDialoguesJson(): Promise<string> {
  await ensureDialoguesLoaded();
  return JSON.stringify(cache, null, 2);
}

export async function importDialoguesJson(raw: string): Promise<number> {
  const parsed = JSON.parse(raw) as DialogueDefinition[];
  const values = Array.isArray(parsed) ? parsed : [];

  await ensureDialoguesLoaded();
  const existingIds = new Set(cache.map((entry) => entry.id));

  let count = 0;
  for (const entry of values) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id.trim()) {
      continue;
    }
    const id = entry.id.trim();
    if (existingIds.has(id)) {
      await updateContentEntry<DialogueDefinition>('dialogues', id, entry);
    } else {
      await createContentEntry<DialogueDefinition>('dialogues', entry);
      existingIds.add(id);
    }
    count += 1;
  }

  invalidateCache();
  await ensureDialoguesLoaded(true);
  return count;
}

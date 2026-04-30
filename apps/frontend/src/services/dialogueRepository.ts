import type { DialogueDefinition } from '../types/dialogue';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
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

export function getAllDialogues(): DialogueDefinition[] {
  return [...cache];
}

export function getDialogueById(id: string): DialogueDefinition | null {
  return cache.find((entry) => entry.id === id) ?? null;
}

export function getDialoguesByNpc(npcId: string): DialogueDefinition[] {
  return cache.filter((entry) => entry.npcId === npcId);
}

export async function saveDialogue(dialogue: DialogueDefinition): Promise<DialogueDefinition> {
  await ensureDialoguesLoaded();
  const exists = cache.some((entry) => entry.id === dialogue.id);
  const saved = exists
    ? await updateContentEntry<DialogueDefinition>('dialogues', dialogue.id, dialogue)
    : await createContentEntry<DialogueDefinition>('dialogues', dialogue);
  invalidateCache();
  await ensureDialoguesLoaded(true);
  return saved;
}

export async function deleteDialogue(id: string): Promise<void> {
  await deleteContentEntry('dialogues', id);
  invalidateCache();
  await ensureDialoguesLoaded(true);
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

import type { DialogueDefinition } from '../types/dialogue';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  getContentEntry,
  updateContentEntry,
} from './content/contentApi';
import type { JsonImportMode } from './content/adminJsonImportExport';
import { subscribeToContentSync } from './content/contentSync';

let cache: DialogueDefinition[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
let syncSubscriptionReady = false;

function ensureSyncSubscription(): void {
  if (syncSubscriptionReady || typeof window === 'undefined') {
    return;
  }

  syncSubscriptionReady = true;
  subscribeToContentSync((payload) => {
    if (payload.scope !== 'content' && payload.scope !== 'all') {
      return;
    }
    invalidateCache();
    void ensureDialoguesLoaded(true).catch(() => undefined);
  });
}

export async function ensureDialoguesLoaded(force = false): Promise<void> {
  ensureSyncSubscription();
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

export async function renameDialogue(oldId: string, dialogue: DialogueDefinition): Promise<DialogueDefinition> {
  await ensureDialoguesLoaded();

  const fromId = normalizeId(oldId);
  const toId = normalizeId(dialogue.id);
  if (!fromId || !toId) {
    throw new Error('Dialogue id is required.');
  }
  if (fromId === toId) {
    return saveDialogue(dialogue);
  }

  const alreadyExists = cache.some((entry) => normalizeId(entry.id) === toId);
  if (alreadyExists) {
    throw new Error(`Duplicate dialogue id: ${toId}`);
  }

  const normalizedDialogue: DialogueDefinition = {
    ...dialogue,
    id: toId,
    title: dialogue.title?.trim() || toId,
  };

  await createContentEntry<DialogueDefinition>('dialogues', normalizedDialogue);
  await deleteContentEntry('dialogues', fromId);

  invalidateCache();
  await ensureDialoguesLoaded(true);
  const verified = await getContentEntry<DialogueDefinition>('dialogues', toId);
  if (!verified) {
    throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
  }
  return verified;
}

export async function deleteDialogue(id: string): Promise<void> {
  const normalizedId = normalizeId(id);
  if (!normalizedId) {
    return;
  }
  await deleteContentEntry('dialogues', normalizedId);
  invalidateCache();
  await ensureDialoguesLoaded(true);
  if (getDialogueById(normalizedId)) {
    throw new Error(`Удаление не подтверждено: диалог '${normalizedId}' вернулся после reload.`);
  }
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

export async function importDialoguesJson(raw: string, mode: JsonImportMode = 'addOnly'): Promise<number> {
  const parsed = JSON.parse(raw) as DialogueDefinition[];
  const values = Array.isArray(parsed) ? parsed : [];

  await ensureDialoguesLoaded();
  const existingIds = new Set(cache.map((entry) => entry.id));
  const seen = new Set<string>();
  const created: string[] = [];
  const skippedExisting: string[] = [];
  const updated: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const entry of values) {
    if (!entry || typeof entry !== 'object') {
      errors.push({ id: '—', message: 'Элемент списка должен быть объектом.' });
      continue;
    }
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) {
      errors.push({ id: '—', message: 'У записи нет строкового id.' });
      continue;
    }
    if (seen.has(id)) {
      errors.push({ id, message: 'Повторяющийся id внутри файла.' });
      continue;
    }
    seen.add(id);

    if (existingIds.has(id)) {
      if (mode === 'addOnly') {
        skippedExisting.push(id);
      } else {
        await updateContentEntry<DialogueDefinition>('dialogues', id, { ...entry, id });
        updated.push(id);
      }
    } else {
      await createContentEntry<DialogueDefinition>('dialogues', { ...entry, id });
      existingIds.add(id);
      created.push(id);
    }
  }

  invalidateCache();
  await ensureDialoguesLoaded(true);
  return created.length;
}

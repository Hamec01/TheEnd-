import type { NpcDefinition } from '../types/npc';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  updateContentEntry,
} from './content/contentApi';
import type { JsonImportMode } from './content/adminJsonImportExport';
import { normalizeNpcForAdmin } from './npcAdminNormalization';

let cache: NpcDefinition[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
let adminNormalizationIssuesById = new Map<string, string[]>();

export async function ensureNpcsLoaded(force = false): Promise<void> {
  if (loaded && !force) {
    return;
  }
  if (!loadPromise) {
    loadPromise = getContentCollection<NpcDefinition>('npcs').then((entries) => {
      const issues = new Map<string, string[]>();
      cache = (Array.isArray(entries) ? entries : []).map((entry) => {
        const result = normalizeNpcForAdmin(entry);
        if (result.issues.length > 0) {
          issues.set(result.npc.id || '(missing id)', result.issues);
        }
        return result.npc;
      });
      adminNormalizationIssuesById = issues;
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

export function getAllNpcs(): NpcDefinition[] {
  return [...cache];
}

export function getNpcById(id: string): NpcDefinition | null {
  return cache.find((entry) => entry.id === id) ?? null;
}

export function getNpcAdminNormalizationIssues(id: string): string[] {
  return adminNormalizationIssuesById.get(id) ?? [];
}

export async function saveNpc(npc: NpcDefinition): Promise<NpcDefinition> {
  await ensureNpcsLoaded();
  const exists = cache.some((entry) => entry.id === npc.id);
  const saved = exists
    ? await updateContentEntry<NpcDefinition>('npcs', npc.id, npc)
    : await createContentEntry<NpcDefinition>('npcs', npc);
  invalidateCache();
  await ensureNpcsLoaded(true);
  return saved;
}

export async function renameNpc(oldId: string, npc: NpcDefinition): Promise<NpcDefinition> {
  await ensureNpcsLoaded();

  const fromId = String(oldId ?? '').trim();
  const toId = String(npc.id ?? '').trim();
  if (!fromId || !toId) {
    throw new Error('NPC id is required.');
  }
  if (fromId === toId) {
    return saveNpc(npc);
  }

  const alreadyExists = cache.some((entry) => entry.id === toId);
  if (alreadyExists) {
    throw new Error(`Duplicate npc id: ${toId}`);
  }

  await createContentEntry<NpcDefinition>('npcs', { ...npc, id: toId });
  await deleteContentEntry('npcs', fromId);

  invalidateCache();
  await ensureNpcsLoaded(true);
  const verified = cache.find((entry) => entry.id === toId) ?? null;
  if (!verified) {
    throw new Error('Сохранение не подтверждено: запись не найдена после сохранения.');
  }
  return verified;
}

export async function deleteNpc(id: string): Promise<void> {
  await deleteContentEntry('npcs', id);
  invalidateCache();
  await ensureNpcsLoaded(true);
}

export async function duplicateNpc(id: string): Promise<NpcDefinition> {
  const source = getNpcById(id);
  if (!source) {
    throw new Error(`NPC not found: ${id}`);
  }

  const copy: NpcDefinition = {
    ...source,
    id: `${source.id}_copy_${Math.floor(Math.random() * 10000)}`,
    name: `${source.name} Copy`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mapBindings: Array.isArray(source.mapBindings) ? source.mapBindings.map((entry) => ({ ...entry })) : [],
    dialogues: Array.isArray(source.dialogues) ? source.dialogues.map((entry) => ({ ...entry })) : [],
    questBindings: Array.isArray(source.questBindings) ? source.questBindings.map((entry) => ({ ...entry })) : [],
    conditions: Array.isArray((source as any).conditions) ? (source as any).conditions.map((entry: any) => ({ ...entry })) : (source as any).conditions,
  };

  return saveNpc(copy);
}

export async function exportNpcsJson(): Promise<string> {
  await ensureNpcsLoaded();
  return JSON.stringify(cache, null, 2);
}

export async function importNpcsJson(raw: string, mode: JsonImportMode = 'addOnly'): Promise<number> {
  const parsed = JSON.parse(raw) as NpcDefinition[];
  const values = Array.isArray(parsed) ? parsed : [];

  await ensureNpcsLoaded();
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
    const normalized = normalizeNpcForAdmin(entry);
    const id = typeof normalized.npc.id === 'string' ? normalized.npc.id.trim() : '';
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
        await updateContentEntry<NpcDefinition>('npcs', id, { ...normalized.npc, id });
        updated.push(id);
      }
    } else {
      await createContentEntry<NpcDefinition>('npcs', { ...normalized.npc, id });
      existingIds.add(id);
      created.push(id);
    }
  }

  invalidateCache();
  await ensureNpcsLoaded(true);
  return created.length;
}

import { nowIso } from './storage';

export interface JsonImportResult {
  created: string[];
  updated: string[];
  errors: Array<{ id: string; message: string }>;
}

export function formatExportStamp(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}-${p(now.getMinutes())}`;
}

export function downloadCollectionJson<T>(params: {
  filePrefix: string;
  collectionKey: string;
  entries: T[];
}) {
  const envelope = {
    schemaVersion: 1,
    game: 'TheEnd' as const,
    exportedAt: nowIso(),
    exportedBy: 'admin' as const,
    contentCounts: { [params.collectionKey]: params.entries.length },
    [params.collectionKey]: params.entries,
  } as const;

  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${params.filePrefix}_${formatExportStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Extracts an array of raw records from export/manual json.
 * Supports:
 * - array
 * - { <collectionKey>: [...] }
 * - full backup { content: { <collectionKey>: [...] } }
 */
export function extractRawCollectionFromImportJson(payload: unknown, collectionKey: string): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const root = payload as Record<string, unknown>;
    const direct = root[collectionKey];
    if (Array.isArray(direct)) {
      return direct;
    }
    const content = root.content;
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const nested = (content as Record<string, unknown>)[collectionKey];
      if (Array.isArray(nested)) {
        return nested;
      }
    }
  }
  throw new Error(`Ожидался массив записей или объект с полем ${collectionKey} (или content.${collectionKey}).`);
}

export async function importCollectionFromJsonEntries<T extends { id: string }>(params: {
  entries: unknown[];
  defaults: () => T;
  normalize: (value: T) => T;
  validate?: (value: T) => string[];
  getAll: () => Promise<T[]>;
  create: (value: T) => Promise<unknown>;
  update: (id: string, value: T) => Promise<unknown>;
}): Promise<JsonImportResult> {
  const existingIds = new Set((await params.getAll()).map((entry) => entry.id));
  const seen = new Set<string>();
  const created: string[] = [];
  const updated: string[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const raw of params.entries) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ id: '—', message: 'Элемент списка должен быть объектом.' });
      continue;
    }

    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (!id) {
      errors.push({ id: '—', message: 'У записи нет строкового id.' });
      continue;
    }
    if (seen.has(id)) {
      errors.push({ id, message: 'Повторяющийся id внутри файла.' });
      continue;
    }
    seen.add(id);

    const candidate = params.normalize({ ...params.defaults(), ...record, id } as T);
    const validationErrors = params.validate?.(candidate) ?? [];
    if (validationErrors.length > 0) {
      errors.push({ id, message: validationErrors.join(', ') });
      continue;
    }

    try {
      if (existingIds.has(id)) {
        await params.update(id, candidate);
        updated.push(id);
      } else {
        await params.create(candidate);
        existingIds.add(id);
        created.push(id);
      }
    } catch (error) {
      errors.push({ id, message: (error as Error).message || 'Ошибка сохранения' });
    }
  }

  return { created, updated, errors };
}


import type { QuestMarkerDefinition } from '../types/quest';
import {
  createContentEntry,
  deleteContentEntry,
  getContentCollection,
  updateContentEntry,
} from './content/contentApi';

let cache: QuestMarkerDefinition[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

export async function ensureQuestMarkersLoaded(force = false): Promise<void> {
  if (loaded && !force) {
    return;
  }
  if (!loadPromise) {
    loadPromise = getContentCollection<QuestMarkerDefinition>('questMarkers').then((entries) => {
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

function invalidate(): void {
  loaded = false;
}

export function getQuestMarkers(): QuestMarkerDefinition[] {
  return [...cache];
}

export async function saveQuestMarker(marker: QuestMarkerDefinition): Promise<QuestMarkerDefinition> {
  await ensureQuestMarkersLoaded();
  const exists = cache.some((entry) => entry.id === marker.id);
  const saved = exists
    ? await updateContentEntry<QuestMarkerDefinition>('questMarkers', marker.id, marker)
    : await createContentEntry<QuestMarkerDefinition>('questMarkers', marker);
  invalidate();
  await ensureQuestMarkersLoaded(true);
  return saved;
}

export async function deleteQuestMarker(id: string): Promise<void> {
  await deleteContentEntry('questMarkers', id);
  invalidate();
  await ensureQuestMarkersLoaded(true);
}

export async function exportQuestMarkersJson(): Promise<string> {
  await ensureQuestMarkersLoaded();
  return JSON.stringify(cache, null, 2);
}

export async function importQuestMarkersJson(raw: string): Promise<number> {
  const parsed = JSON.parse(raw) as QuestMarkerDefinition[];
  const values = Array.isArray(parsed) ? parsed : [];

  await ensureQuestMarkersLoaded();
  const existingIds = new Set(cache.map((entry) => entry.id));

  let count = 0;
  for (const entry of values) {
    if (!entry?.id?.trim()) {
      continue;
    }
    const id = entry.id.trim();
    if (existingIds.has(id)) {
      await updateContentEntry<QuestMarkerDefinition>('questMarkers', id, entry);
    } else {
      await createContentEntry<QuestMarkerDefinition>('questMarkers', entry);
      existingIds.add(id);
    }
    count += 1;
  }

  invalidate();
  await ensureQuestMarkersLoaded(true);
  return count;
}


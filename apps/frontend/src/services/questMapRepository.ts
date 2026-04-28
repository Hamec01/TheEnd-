import type { QuestMarkerDefinition } from '../types/quest';

const QUEST_MARKERS_KEY = 'theend.questMap.markers';

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

function read(): QuestMarkerDefinition[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return safeParse<QuestMarkerDefinition[]>(window.localStorage.getItem(QUEST_MARKERS_KEY), []);
}

function write(values: QuestMarkerDefinition[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(QUEST_MARKERS_KEY, JSON.stringify(values));
}

export function getQuestMarkers(): QuestMarkerDefinition[] {
  return read();
}

export function saveQuestMarker(marker: QuestMarkerDefinition): QuestMarkerDefinition {
  const normalized: QuestMarkerDefinition = {
    ...marker,
    id: marker.id.trim(),
    title: marker.title.trim(),
    mapId: marker.mapId.trim(),
    x: Math.max(0, Math.min(1, marker.x)),
    y: Math.max(0, Math.min(1, marker.y)),
    visibleToPlayer: marker.visibleToPlayer !== false,
    conditionIds: Array.isArray(marker.conditionIds) ? marker.conditionIds.filter(Boolean) : [],
  };

  const values = read();
  const next = [...values.filter((entry) => entry.id !== normalized.id), normalized];
  write(next);
  return normalized;
}

export function deleteQuestMarker(id: string): void {
  const next = read().filter((entry) => entry.id !== id);
  write(next);
}

export function exportQuestMarkersJson(): string {
  return JSON.stringify(read(), null, 2);
}

export function importQuestMarkersJson(raw: string): number {
  const parsed = JSON.parse(raw) as QuestMarkerDefinition[];
  const values = Array.isArray(parsed) ? parsed : [];
  write(values);
  return values.length;
}

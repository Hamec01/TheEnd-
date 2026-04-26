import type { PaintedRegion, ZoneEditorDraft, ZoneEditorSnapshot, WorldMapZone } from './zoneEditorTypes';

const HISTORY_LIMIT = 100;

export interface ZoneEditorHistoryState {
  past: ZoneEditorSnapshot[];
  future: ZoneEditorSnapshot[];
}

function cloneZone(zone: WorldMapZone): WorldMapZone {
  return {
    ...zone,
    points: zone.points ? zone.points.map((point) => [point[0], point[1]] as [number, number]) : undefined,
  };
}

function cloneDraft(draft: ZoneEditorDraft | null): ZoneEditorDraft | null {
  if (!draft) {
    return null;
  }

  return {
    ...draft,
    points: draft.points.map((point) => [point[0], point[1]] as [number, number]),
  };
}

function cloneRegion(region: PaintedRegion): PaintedRegion {
  return {
    ...region,
    cells: region.cells.map((cell) => ({ ...cell })),
  };
}

export function createSnapshot(zones: WorldMapZone[], regions: PaintedRegion[], draft: ZoneEditorDraft | null, selectedZoneId: string | null): ZoneEditorSnapshot {
  return {
    zones: zones.map(cloneZone),
    regions: regions.map(cloneRegion),
    draft: cloneDraft(draft),
    selectedZoneId,
  };
}

export function createEmptyHistory(): ZoneEditorHistoryState {
  return {
    past: [],
    future: [],
  };
}

function isSameSnapshot(a: ZoneEditorSnapshot | null, b: ZoneEditorSnapshot): boolean {
  if (!a) {
    return false;
  }

  return JSON.stringify(a) === JSON.stringify(b);
}

export function pushHistory(history: ZoneEditorHistoryState, snapshot: ZoneEditorSnapshot): ZoneEditorHistoryState {
  const last = history.past[history.past.length - 1] ?? null;
  if (isSameSnapshot(last, snapshot)) {
    return history;
  }

  const nextPast = [...history.past, snapshot].slice(-HISTORY_LIMIT);
  return {
    past: nextPast,
    future: [],
  };
}

export function undoHistory(history: ZoneEditorHistoryState, current: ZoneEditorSnapshot): { history: ZoneEditorHistoryState; snapshot: ZoneEditorSnapshot | null } {
  const previous = history.past[history.past.length - 1] ?? null;
  if (!previous) {
    return { history, snapshot: null };
  }

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
    },
    snapshot: previous,
  };
}

export function redoHistory(history: ZoneEditorHistoryState, current: ZoneEditorSnapshot): { history: ZoneEditorHistoryState; snapshot: ZoneEditorSnapshot | null } {
  const next = history.future[0] ?? null;
  if (!next) {
    return { history, snapshot: null };
  }

  return {
    history: {
      past: [...history.past, current].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
    },
    snapshot: next,
  };
}

const HISTORY_LIMIT = 100;
function cloneZone(zone) {
    return {
        ...zone,
        points: zone.points ? zone.points.map((point) => [point[0], point[1]]) : undefined,
    };
}
function cloneDraft(draft) {
    if (!draft) {
        return null;
    }
    return {
        ...draft,
        points: draft.points.map((point) => [point[0], point[1]]),
    };
}
function cloneRegion(region) {
    return {
        ...region,
        cells: region.cells.map((cell) => ({ ...cell })),
    };
}
export function createSnapshot(zones, regions, draft, selectedZoneId) {
    return {
        zones: zones.map(cloneZone),
        regions: regions.map(cloneRegion),
        draft: cloneDraft(draft),
        selectedZoneId,
    };
}
export function createEmptyHistory() {
    return {
        past: [],
        future: [],
    };
}
function isSameSnapshot(a, b) {
    if (!a) {
        return false;
    }
    return JSON.stringify(a) === JSON.stringify(b);
}
export function pushHistory(history, snapshot) {
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
export function undoHistory(history, current) {
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
export function redoHistory(history, current) {
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

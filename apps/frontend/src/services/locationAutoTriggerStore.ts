export interface LocationAutoTriggerStoreState {
  version: 1;
  triggered: Record<string, true>;
}

const STORE_VERSION = 1 as const;

function getStorageKey(playerId: string): string {
  return `theend.locationAutoTriggers.${playerId}`;
}

function readStore(playerId: string): LocationAutoTriggerStoreState {
  try {
    const raw = localStorage.getItem(getStorageKey(playerId));
    if (!raw) {
      return { version: STORE_VERSION, triggered: {} };
    }
    const parsed = JSON.parse(raw) as Partial<LocationAutoTriggerStoreState> | null;
    if (!parsed || parsed.version !== STORE_VERSION || typeof parsed.triggered !== 'object' || !parsed.triggered) {
      return { version: STORE_VERSION, triggered: {} };
    }
    return {
      version: STORE_VERSION,
      triggered: parsed.triggered as Record<string, true>,
    };
  } catch {
    return { version: STORE_VERSION, triggered: {} };
  }
}

function writeStore(playerId: string, state: LocationAutoTriggerStoreState): void {
  try {
    localStorage.setItem(getStorageKey(playerId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function createLocationAutoTriggerKey(params: {
  locationId: string;
  npcId: string;
  dialogueId: string;
}): string {
  return `${params.locationId}::${params.npcId}::${params.dialogueId}`;
}

export function hasTriggeredLocationAutoTrigger(playerId: string, triggerKey: string): boolean {
  const store = readStore(playerId);
  return Boolean(store.triggered[triggerKey]);
}

export function markLocationAutoTriggerTriggered(playerId: string, triggerKey: string): void {
  const store = readStore(playerId);
  if (store.triggered[triggerKey]) {
    return;
  }
  store.triggered[triggerKey] = true;
  writeStore(playerId, store);
}


export interface WorkshopAccessUnlock {
  workshopId: string;
  unlockedAtIso: string;
  sourceNpcId?: string;
  sourceDialogueId?: string;
}

function getStorageKey(characterId: string): string {
  return `theend.workshopAccess.${String(characterId ?? '').trim()}`;
}

function normalizeUnlock(value: unknown): WorkshopAccessUnlock | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const workshopId = String(record.workshopId ?? '').trim();
  const unlockedAtIso = String(record.unlockedAtIso ?? '').trim();
  const sourceNpcId = String(record.sourceNpcId ?? '').trim() || undefined;
  const sourceDialogueId = String(record.sourceDialogueId ?? '').trim() || undefined;
  const unlockedAt = new Date(unlockedAtIso);
  if (!workshopId || Number.isNaN(unlockedAt.getTime())) {
    return null;
  }

  return {
    workshopId,
    unlockedAtIso: unlockedAt.toISOString(),
    sourceNpcId,
    sourceDialogueId,
  };
}

function readWorkshopUnlocks(characterId: string): WorkshopAccessUnlock[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const normalizedCharacterId = String(characterId ?? '').trim();
  if (!normalizedCharacterId) {
    return [];
  }

  const raw = window.localStorage.getItem(getStorageKey(normalizedCharacterId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeUnlock(entry))
      .filter((entry): entry is WorkshopAccessUnlock => Boolean(entry));
  } catch {
    return [];
  }
}

function writeWorkshopUnlocks(characterId: string, unlocks: WorkshopAccessUnlock[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedCharacterId = String(characterId ?? '').trim();
  if (!normalizedCharacterId) {
    return;
  }

  window.localStorage.setItem(getStorageKey(normalizedCharacterId), JSON.stringify(unlocks));
}

export function hasWorkshopAccessUnlock(characterId: string, workshopId: string): boolean {
  const normalizedWorkshopId = String(workshopId ?? '').trim();
  if (!normalizedWorkshopId) {
    return false;
  }
  return readWorkshopUnlocks(characterId).some((entry) => entry.workshopId === normalizedWorkshopId);
}

export function grantWorkshopAccessUnlock(params: {
  characterId: string;
  workshopId: string;
  sourceNpcId?: string;
  sourceDialogueId?: string;
}): void {
  const normalizedCharacterId = String(params.characterId ?? '').trim();
  const normalizedWorkshopId = String(params.workshopId ?? '').trim();
  if (!normalizedCharacterId || !normalizedWorkshopId) {
    return;
  }

  const unlocks = readWorkshopUnlocks(normalizedCharacterId).filter((entry) => entry.workshopId !== normalizedWorkshopId);
  unlocks.push({
    workshopId: normalizedWorkshopId,
    unlockedAtIso: new Date().toISOString(),
    sourceNpcId: String(params.sourceNpcId ?? '').trim() || undefined,
    sourceDialogueId: String(params.sourceDialogueId ?? '').trim() || undefined,
  });
  writeWorkshopUnlocks(normalizedCharacterId, unlocks);
}

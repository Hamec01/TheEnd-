const ACTIVE_CHARACTER_ID_STORAGE_KEY = 'theend.activeCharacterId';
const LEGACY_PLAYER_PREFIX = 'theend.player.';
const CHARACTER_PREFIX = 'theend.character.';

const EXTRA_CHARACTER_SCOPED_KEYS: Record<string, string> = {
  'theend.questRewardsApplied': 'questRewardsApplied',
};

const LEGACY_KEYS_TO_MIGRATE = [
  'theend.player.gold',
  'theend.player.items',
  'theend.player.questItems',
  'theend.player.materialIds',
  'theend.player.resourceIds',
  'theend.player.materials',
  'theend.player.resources',
  'theend.player.flags',
  'theend.player.skills',
  'theend.player.experience',
  'theend.player.recipes',
  'theend.player.titles',
  'theend.player.unlockedLocations',
  'theend.player.unlockedDialogues',
  'theend.player.unlockedShops',
  'theend.player.factionAccess',
  'theend.player.loreEntries',
  'theend.player.reputation',
  'theend.player.citizenship',
  'theend.questRewardsApplied',
] as const;

export function getActiveCharacterId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const value = window.localStorage.getItem(ACTIVE_CHARACTER_ID_STORAGE_KEY);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function setActiveCharacterId(characterId: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (characterId && characterId.trim()) {
    console.info('[characterScopedStorage] setActiveCharacterId', { characterId: characterId.trim() });
    window.localStorage.setItem(ACTIVE_CHARACTER_ID_STORAGE_KEY, characterId.trim());
    return;
  }
  console.info('[characterScopedStorage] clearActiveCharacterId');
  window.localStorage.removeItem(ACTIVE_CHARACTER_ID_STORAGE_KEY);
}

export function getCharacterStoragePrefix(characterId: string): string {
  return `${CHARACTER_PREFIX}${characterId}.`;
}

export function getCharacterScopedStorageKey(characterId: string, legacyKey: string): string | null {
  const normalizedCharacterId = String(characterId ?? '').trim();
  if (!normalizedCharacterId) {
    return null;
  }

  if (legacyKey.startsWith(LEGACY_PLAYER_PREFIX)) {
    return `${getCharacterStoragePrefix(normalizedCharacterId)}player.${legacyKey.slice(LEGACY_PLAYER_PREFIX.length)}`;
  }

  const extraSuffix = EXTRA_CHARACTER_SCOPED_KEYS[legacyKey];
  if (extraSuffix) {
    return `${getCharacterStoragePrefix(normalizedCharacterId)}${extraSuffix}`;
  }

  return null;
}

export function resolveCharacterScopedStorageKey(legacyKey: string, characterId = getActiveCharacterId()): string {
  if (!characterId) {
    return legacyKey;
  }
  return getCharacterScopedStorageKey(characterId, legacyKey) ?? legacyKey;
}

export function migrateLegacyStorageToCharacter(characterId: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  let migratedCount = 0;
  for (const legacyKey of LEGACY_KEYS_TO_MIGRATE) {
    const scopedKey = getCharacterScopedStorageKey(characterId, legacyKey);
    if (!scopedKey) {
      continue;
    }
    if (window.localStorage.getItem(scopedKey) !== null) {
      continue;
    }

    const legacyValue = window.localStorage.getItem(legacyKey);
    if (legacyValue === null) {
      continue;
    }

    window.localStorage.setItem(scopedKey, legacyValue);
    migratedCount += 1;
  }

  return migratedCount;
}

export function removeCharacterScopedStorage(characterId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const prefix = getCharacterStoragePrefix(characterId);
  const keysToDelete: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (typeof key === 'string' && key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    window.localStorage.removeItem(key);
  }
}

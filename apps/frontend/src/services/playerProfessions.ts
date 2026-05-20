import {
  EMPTY_PLAYER_PROFESSIONS_STATE,
  normalizePlayerProfessionsState,
  type PlayerProfessionsState,
} from '@theend/rpg-domain';

const PLAYER_PROFESSIONS_STORAGE_PREFIX = 'theend.playerProfessions';

function getPlayerProfessionsStorageKey(characterId: string): string {
  return `${PLAYER_PROFESSIONS_STORAGE_PREFIX}.${characterId}`;
}

export function loadPlayerProfessionsState(characterId: string): PlayerProfessionsState {
  if (typeof window === 'undefined') {
    return EMPTY_PLAYER_PROFESSIONS_STATE;
  }

  const raw = window.localStorage.getItem(getPlayerProfessionsStorageKey(characterId));
  if (!raw) {
    return EMPTY_PLAYER_PROFESSIONS_STATE;
  }

  try {
    return normalizePlayerProfessionsState(JSON.parse(raw));
  } catch {
    return EMPTY_PLAYER_PROFESSIONS_STATE;
  }
}

export function savePlayerProfessionsState(characterId: string, state: PlayerProfessionsState): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizePlayerProfessionsState(state);
  window.localStorage.setItem(getPlayerProfessionsStorageKey(characterId), JSON.stringify(normalized));
}

export function mergePlayerProfessionsState(
  primary: PlayerProfessionsState,
  fallback: PlayerProfessionsState,
): PlayerProfessionsState {
  if (primary.professions.length > 0) {
    return primary;
  }

  if (fallback.professions.length > 0) {
    return fallback;
  }

  return EMPTY_PLAYER_PROFESSIONS_STATE;
}

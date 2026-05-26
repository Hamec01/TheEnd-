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
  const normalizedPrimary = normalizePlayerProfessionsState(primary);
  const normalizedFallback = normalizePlayerProfessionsState(fallback);

  if (normalizedPrimary.professions.length === 0) {
    return normalizedFallback.professions.length > 0 ? normalizedFallback : EMPTY_PLAYER_PROFESSIONS_STATE;
  }

  if (normalizedFallback.professions.length === 0) {
    return normalizedPrimary;
  }

  const byProfessionId = new Map<string, { primary?: typeof normalizedPrimary.professions[number]; fallback?: typeof normalizedFallback.professions[number] }>();

  for (const entry of normalizedPrimary.professions) {
    byProfessionId.set(entry.professionId, { ...(byProfessionId.get(entry.professionId) ?? {}), primary: entry });
  }
  for (const entry of normalizedFallback.professions) {
    byProfessionId.set(entry.professionId, { ...(byProfessionId.get(entry.professionId) ?? {}), fallback: entry });
  }

  const merged = Array.from(byProfessionId.values()).map((pair) => {
    if (!pair.primary) {
      return pair.fallback!;
    }
    if (!pair.fallback) {
      return pair.primary;
    }

    const score = (entry: typeof pair.primary) => (
      entry.level * 1_000_000
      + entry.learnedSkillIds.length * 10_000
      + entry.selectedBranchIds.length * 1_000
      + entry.xp * 10
      + entry.skillPoints
    );

    const preferred = score(pair.primary) >= score(pair.fallback) ? pair.primary : pair.fallback;
    const secondary = preferred === pair.primary ? pair.fallback : pair.primary;

    const mergedStats: Record<string, number> | undefined = (() => {
      const first = preferred.stats ?? {};
      const second = secondary.stats ?? {};
      const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
      if (keys.size === 0) {
        return undefined;
      }
      const out: Record<string, number> = {};
      for (const key of keys) {
        const a = Number(first[key] ?? 0);
        const b = Number(second[key] ?? 0);
        out[key] = Math.max(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
      }
      return out;
    })();

    return {
      ...preferred,
      learnedSkillIds: Array.from(new Set([...(preferred.learnedSkillIds ?? []), ...(secondary.learnedSkillIds ?? [])])),
      selectedBranchIds: Array.from(new Set([...(preferred.selectedBranchIds ?? []), ...(secondary.selectedBranchIds ?? [])])),
      stats: mergedStats,
      unlockedAt: preferred.unlockedAt <= secondary.unlockedAt ? preferred.unlockedAt : secondary.unlockedAt,
    };
  });

  return {
    professions: merged,
  };
}

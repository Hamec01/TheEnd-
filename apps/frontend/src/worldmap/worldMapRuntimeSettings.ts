export interface WorldMapRuntimeSettings {
  playZoom: number;
  playerSpeed: number;
}

export const DEFAULT_WORLD_MAP_RUNTIME_SETTINGS: WorldMapRuntimeSettings = {
  playZoom: 10.4,
  playerSpeed: 0.000175,
};

const WORLD_MAP_RUNTIME_SETTINGS_STORAGE_KEY = 'theend.worldmap.runtime.settings';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeValue(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return clamp(numberValue, min, max);
}

export function normalizeWorldMapRuntimeSettings(
  input: Partial<WorldMapRuntimeSettings> | null | undefined,
): WorldMapRuntimeSettings {
  return {
    playZoom: normalizeValue(input?.playZoom, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.playZoom, 1, 20),
    playerSpeed: normalizeValue(input?.playerSpeed, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.playerSpeed, 0.00005, 0.002),
  };
}

export function loadWorldMapRuntimeSettings(): WorldMapRuntimeSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_WORLD_MAP_RUNTIME_SETTINGS };
  }

  const raw = window.localStorage.getItem(WORLD_MAP_RUNTIME_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_WORLD_MAP_RUNTIME_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorldMapRuntimeSettings>;
    return normalizeWorldMapRuntimeSettings(parsed);
  } catch {
    return { ...DEFAULT_WORLD_MAP_RUNTIME_SETTINGS };
  }
}

export function saveWorldMapRuntimeSettings(input: Partial<WorldMapRuntimeSettings>): WorldMapRuntimeSettings {
  const next = normalizeWorldMapRuntimeSettings({
    ...loadWorldMapRuntimeSettings(),
    ...input,
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(WORLD_MAP_RUNTIME_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

export function clearWorldMapRuntimeSettings(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(WORLD_MAP_RUNTIME_SETTINGS_STORAGE_KEY);
  }
}

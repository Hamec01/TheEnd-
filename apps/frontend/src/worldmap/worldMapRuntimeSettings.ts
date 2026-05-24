export interface WorldMapRuntimeSettings {
  playZoom: number;
  playerSpeed: number;
  phaserNpcMoveSpeedScale: number;
  phaserNpcMoveTweenMinMs: number;
  phaserNpcMoveTweenMaxMs: number;
}

export const DEFAULT_WORLD_MAP_RUNTIME_SETTINGS: WorldMapRuntimeSettings = {
  playZoom: 10.4,
  playerSpeed: 0.000175,
  phaserNpcMoveSpeedScale: 1.05,
  phaserNpcMoveTweenMinMs: 45,
  phaserNpcMoveTweenMaxMs: 980,
};

const WORLD_MAP_RUNTIME_SETTINGS_STORAGE_KEY = 'theend.worldmap.runtime.settings';
export const WORLD_MAP_RUNTIME_SETTINGS_EVENT = 'theend:worldMapRuntimeSettingsChanged';

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
  const tweenMin = normalizeValue(input?.phaserNpcMoveTweenMinMs, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.phaserNpcMoveTweenMinMs, 16, 240);
  const tweenMaxRaw = normalizeValue(input?.phaserNpcMoveTweenMaxMs, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.phaserNpcMoveTweenMaxMs, 120, 2000);
  const tweenMax = Math.max(tweenMin + 40, tweenMaxRaw);

  return {
    playZoom: normalizeValue(input?.playZoom, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.playZoom, 1, 20),
    playerSpeed: normalizeValue(input?.playerSpeed, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.playerSpeed, 0.00005, 0.002),
    phaserNpcMoveSpeedScale: normalizeValue(input?.phaserNpcMoveSpeedScale, DEFAULT_WORLD_MAP_RUNTIME_SETTINGS.phaserNpcMoveSpeedScale, 0.5, 2.5),
    phaserNpcMoveTweenMinMs: tweenMin,
    phaserNpcMoveTweenMaxMs: tweenMax,
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
    window.dispatchEvent(new CustomEvent<WorldMapRuntimeSettings>(WORLD_MAP_RUNTIME_SETTINGS_EVENT, { detail: next }));
  }

  return next;
}

export function clearWorldMapRuntimeSettings(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(WORLD_MAP_RUNTIME_SETTINGS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent<WorldMapRuntimeSettings>(WORLD_MAP_RUNTIME_SETTINGS_EVENT, {
      detail: { ...DEFAULT_WORLD_MAP_RUNTIME_SETTINGS },
    }));
  }
}

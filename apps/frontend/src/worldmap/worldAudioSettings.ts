export interface WorldAudioSettings {
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
}

export const DEFAULT_WORLD_AUDIO_SETTINGS: WorldAudioSettings = {
  musicEnabled: true,
  musicVolume: 0.55,
  sfxEnabled: true,
  sfxVolume: 0.8,
};

const WORLD_AUDIO_SETTINGS_STORAGE_KEY = 'theend.world.audio.settings';
export const WORLD_AUDIO_SETTINGS_EVENT = 'theend:worldAudioSettingsChanged';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeVolume(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return clamp(numeric, 0, 1);
}

function readLegacyGlobalVolume(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const keys = ['theend.audio.volume', 'theend.sound.volume'];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      continue;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, 0, 1);
    }
  }
  return null;
}

export function normalizeWorldAudioSettings(input: Partial<WorldAudioSettings> | null | undefined): WorldAudioSettings {
  return {
    musicEnabled: normalizeBoolean(input?.musicEnabled, DEFAULT_WORLD_AUDIO_SETTINGS.musicEnabled),
    musicVolume: normalizeVolume(input?.musicVolume, DEFAULT_WORLD_AUDIO_SETTINGS.musicVolume),
    sfxEnabled: normalizeBoolean(input?.sfxEnabled, DEFAULT_WORLD_AUDIO_SETTINGS.sfxEnabled),
    sfxVolume: normalizeVolume(input?.sfxVolume, DEFAULT_WORLD_AUDIO_SETTINGS.sfxVolume),
  };
}

export function loadWorldAudioSettings(): WorldAudioSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_WORLD_AUDIO_SETTINGS };
  }

  const raw = window.localStorage.getItem(WORLD_AUDIO_SETTINGS_STORAGE_KEY);
  if (!raw) {
    const legacyVolume = readLegacyGlobalVolume();
    if (legacyVolume === null) {
      return { ...DEFAULT_WORLD_AUDIO_SETTINGS };
    }
    return {
      ...DEFAULT_WORLD_AUDIO_SETTINGS,
      musicVolume: legacyVolume,
      sfxVolume: legacyVolume,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorldAudioSettings>;
    return normalizeWorldAudioSettings(parsed);
  } catch {
    return { ...DEFAULT_WORLD_AUDIO_SETTINGS };
  }
}

export function saveWorldAudioSettings(input: Partial<WorldAudioSettings>): WorldAudioSettings {
  const next = normalizeWorldAudioSettings({
    ...loadWorldAudioSettings(),
    ...input,
  });

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(WORLD_AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent<WorldAudioSettings>(WORLD_AUDIO_SETTINGS_EVENT, { detail: next }));
  }

  return next;
}

export function clearWorldAudioSettings(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(WORLD_AUDIO_SETTINGS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent<WorldAudioSettings>(WORLD_AUDIO_SETTINGS_EVENT, {
      detail: { ...DEFAULT_WORLD_AUDIO_SETTINGS },
    }));
  }
}

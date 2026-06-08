import { getContentCollection } from './content/contentApi';
import type { SoundDefinition } from './content/models';
import { subscribeToContentSync } from './content/contentSync';
import { normalizeSound } from './content/soundsService';
import { loadWorldAudioSettings } from '../worldmap/worldAudioSettings';

interface PlayRegisteredSoundOptions {
  fallbackUrl?: string;
  volumeMultiplier?: number;
}

const INTERACTIVE_SELECTOR = [
  'button',
  '[role="button"]',
  'a[href]',
  'summary',
  'label',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'select',
].join(', ');

let registryCache: Map<string, SoundDefinition> | null = null;
let registryPromise: Promise<Map<string, SoundDefinition>> | null = null;
let contentSyncSubscribed = false;
let installedGlobalUiBindings = false;
const lastPlayedAtById = new Map<string, number>();

function isDirectAudioSource(value: string): boolean {
  return value.startsWith('/')
    || value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('data:audio/');
}

function resolveAudioSource(soundId: string, definition?: SoundDefinition | null, fallbackUrl?: string): string | null {
  const assetUrl = String(definition?.assetUrl ?? '').trim();
  if (assetUrl) {
    if (isDirectAudioSource(assetUrl)) {
      return assetUrl;
    }
    return `/api/content/assets/audio/${encodeURIComponent(assetUrl)}/raw`;
  }
  if (fallbackUrl?.trim()) {
    return fallbackUrl.trim();
  }
  return `/api/content/assets/audio/${encodeURIComponent(soundId)}/raw`;
}

function invalidateRegistry() {
  registryCache = null;
  registryPromise = null;
}

function ensureContentSyncSubscription() {
  if (contentSyncSubscribed) {
    return;
  }
  contentSyncSubscribed = true;
  subscribeToContentSync((payload) => {
    if (payload.scope === 'content' || payload.scope === 'all') {
      invalidateRegistry();
    }
  });
}

async function loadRegistryMap(): Promise<Map<string, SoundDefinition>> {
  ensureContentSyncSubscription();
  if (registryCache) {
    return registryCache;
  }
  if (!registryPromise) {
    registryPromise = getContentCollection<SoundDefinition>('sounds')
      .then((entries) => {
        const map = new Map<string, SoundDefinition>();
        for (const rawEntry of entries) {
          const entry = normalizeSound(rawEntry);
          map.set(entry.id, entry);
        }
        registryCache = map;
        return map;
      })
      .catch((error) => {
        registryPromise = null;
        throw error;
      });
  }
  return registryPromise;
}

function getResolvedVolume(definition: SoundDefinition | undefined, volumeMultiplier: number): number {
  const audioSettings = loadWorldAudioSettings();
  if (!audioSettings.sfxEnabled) {
    return 0;
  }
  const baseVolume = Number.isFinite(definition?.volume) ? Number(definition?.volume) : 1;
  return Math.max(0, Math.min(1, audioSettings.sfxVolume * baseVolume * volumeMultiplier));
}

function computePlaybackRate(definition?: SoundDefinition): number {
  if (!definition?.randomPitch) {
    return 1;
  }
  const min = Number.isFinite(definition.pitchMin) ? Number(definition.pitchMin) : 0.96;
  const max = Number.isFinite(definition.pitchMax) ? Number(definition.pitchMax) : 1.04;
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return low + Math.random() * (high - low);
}

function isElementDisabled(target: Element): boolean {
  if ((target as HTMLButtonElement).disabled) {
    return true;
  }
  const ariaDisabled = target.getAttribute('aria-disabled');
  return ariaDisabled === 'true';
}

function findInteractiveTarget(eventTarget: EventTarget | null): HTMLElement | null {
  if (!(eventTarget instanceof Element)) {
    return null;
  }
  const interactive = eventTarget.closest(INTERACTIVE_SELECTOR);
  return interactive instanceof HTMLElement ? interactive : null;
}

async function playAudioSource(
  soundId: string,
  definition: SoundDefinition | undefined,
  source: string,
  volumeMultiplier: number,
): Promise<void> {
  const cooldownMs = Math.max(0, Number(definition?.cooldownMs ?? 0) || 0);
  const now = Date.now();
  const lastPlayedAt = lastPlayedAtById.get(soundId) ?? 0;
  if (cooldownMs > 0 && now - lastPlayedAt < cooldownMs) {
    return;
  }

  const volume = getResolvedVolume(definition, volumeMultiplier);
  if (volume <= 0) {
    return;
  }

  try {
    const audio = new Audio(source);
    audio.preload = 'auto';
    audio.volume = volume;
    audio.playbackRate = computePlaybackRate(definition);
    (audio as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).preservesPitch = false;
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = false;
    (audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = false;
    lastPlayedAtById.set(soundId, now);
    void audio.play().catch(() => undefined);
  } catch {
    // Keep UI interactions non-blocking even if audio cannot be decoded yet.
  }
}

export async function primeSoundRegistry(): Promise<void> {
  try {
    await loadRegistryMap();
  } catch {
    // Sound registry is optional at runtime.
  }
}

export async function playRegisteredSound(soundId: string, options?: PlayRegisteredSoundOptions): Promise<void> {
  const normalizedId = String(soundId ?? '').trim();
  if (!normalizedId) {
    return;
  }

  let definition: SoundDefinition | undefined;
  try {
    const registry = await loadRegistryMap();
    const candidate = registry.get(normalizedId);
    if (candidate?.status === 'active') {
      definition = candidate;
    }
  } catch {
    definition = undefined;
  }

  const source = resolveAudioSource(normalizedId, definition, options?.fallbackUrl);
  if (!source) {
    return;
  }

  await playAudioSource(
    normalizedId,
    definition,
    source,
    Number.isFinite(options?.volumeMultiplier) ? Number(options?.volumeMultiplier) : 1,
  );
}

export function installGlobalUiSoundBindings(): () => void {
  if (typeof window === 'undefined' || installedGlobalUiBindings) {
    return () => undefined;
  }
  installedGlobalUiBindings = true;
  ensureContentSyncSubscription();
  void primeSoundRegistry();

  const handlePointerDown = (event: PointerEvent) => {
    const target = findInteractiveTarget(event.target);
    if (!target || isElementDisabled(target)) {
      return;
    }
    const clickMode = target.dataset.soundClick;
    if (clickMode === 'off') {
      return;
    }
    const soundId = target.dataset.soundClickId || target.dataset.soundId || 'ui_click_primary';
    void playRegisteredSound(soundId, { volumeMultiplier: 1 });
  };
  window.addEventListener('pointerdown', handlePointerDown, true);

  return () => {
    installedGlobalUiBindings = false;
    window.removeEventListener('pointerdown', handlePointerDown, true);
  };
}

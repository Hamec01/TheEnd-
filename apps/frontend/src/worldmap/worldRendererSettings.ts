export type WorldRendererKind = 'canvas' | 'phaser';

const LEGACY_WORLD_RENDERER_STORAGE_KEY = 'theend.worldMap.renderer';
const WORLD_RENDERER_ROLLBACK_STORAGE_KEY = 'theend.dev.worldMapRendererFallback';

export function readWorldRendererSetting(): WorldRendererKind {
  if (typeof window === 'undefined') {
    return 'phaser';
  }

  window.localStorage.removeItem(LEGACY_WORLD_RENDERER_STORAGE_KEY);
  return window.localStorage.getItem(WORLD_RENDERER_ROLLBACK_STORAGE_KEY) === 'canvas' ? 'canvas' : 'phaser';
}

export function writeWorldRendererSetting(value: WorldRendererKind): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (value === 'canvas') {
    window.localStorage.setItem(WORLD_RENDERER_ROLLBACK_STORAGE_KEY, value);
    return;
  }

  window.localStorage.removeItem(WORLD_RENDERER_ROLLBACK_STORAGE_KEY);
}

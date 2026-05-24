export type WorldRendererKind = 'canvas' | 'phaser';

const WORLD_RENDERER_STORAGE_KEY = 'theend.worldMap.renderer';

export function readWorldRendererSetting(): WorldRendererKind {
  if (typeof window === 'undefined') {
    return 'phaser';
  }

  const raw = window.localStorage.getItem(WORLD_RENDERER_STORAGE_KEY);
  return raw === 'canvas' ? 'canvas' : 'phaser';
}

export function writeWorldRendererSetting(value: WorldRendererKind): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WORLD_RENDERER_STORAGE_KEY, value);
}

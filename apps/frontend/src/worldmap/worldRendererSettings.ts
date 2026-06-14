export type WorldRendererKind = 'canvas' | 'phaser';

const LEGACY_WORLD_RENDERER_STORAGE_KEY = 'theend.worldMap.renderer';
const WORLD_RENDERER_STORAGE_KEY = 'theend.worldMap.renderer.v2';

export function readWorldRendererSetting(): WorldRendererKind {
  if (typeof window === 'undefined') {
    return 'canvas';
  }

  window.localStorage.removeItem(LEGACY_WORLD_RENDERER_STORAGE_KEY);
  const raw = window.localStorage.getItem(WORLD_RENDERER_STORAGE_KEY);
  return raw === 'phaser' ? 'phaser' : 'canvas';
}

export function writeWorldRendererSetting(value: WorldRendererKind): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WORLD_RENDERER_STORAGE_KEY, value);
}

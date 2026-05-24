export type BattleRendererKind = 'react' | 'phaser';

export const BATTLE_RENDERER_STORAGE_KEY = 'theend.battleRenderer';

export function readBattleRendererSetting(): BattleRendererKind {
  if (typeof window === 'undefined') {
    return 'phaser';
  }
  return window.localStorage.getItem(BATTLE_RENDERER_STORAGE_KEY) === 'react' ? 'react' : 'phaser';
}

export function writeBattleRendererSetting(kind: BattleRendererKind): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(BATTLE_RENDERER_STORAGE_KEY, kind);
}

export type BattleRendererKind = 'react' | 'phaser';

export const BATTLE_RENDERER_STORAGE_KEY = 'theend.battleRenderer';

export function readBattleRendererSetting(): BattleRendererKind {
  if (typeof window === 'undefined') {
    return 'react';
  }
  return window.localStorage.getItem(BATTLE_RENDERER_STORAGE_KEY) === 'phaser' ? 'phaser' : 'react';
}

export function writeBattleRendererSetting(kind: BattleRendererKind): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(BATTLE_RENDERER_STORAGE_KEY, kind);
}

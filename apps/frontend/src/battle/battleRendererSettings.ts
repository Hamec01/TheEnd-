export type BattleRendererKind = 'react' | 'phaser';

const BATTLE_RENDERER_ROLLBACK_STORAGE_KEY = 'theend.dev.battleRendererFallback';
const DEFAULT_BATTLE_RENDERER: BattleRendererKind = 'phaser';

export function readBattleRendererSetting(): BattleRendererKind {
  if (typeof window === 'undefined') {
    return DEFAULT_BATTLE_RENDERER;
  }

  const stored = window.localStorage.getItem(BATTLE_RENDERER_ROLLBACK_STORAGE_KEY);
  if (stored === 'react' || stored === 'phaser') {
    return stored;
  }

  return DEFAULT_BATTLE_RENDERER;
}

export function writeBattleRendererSetting(kind: BattleRendererKind): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(BATTLE_RENDERER_ROLLBACK_STORAGE_KEY, kind);
}

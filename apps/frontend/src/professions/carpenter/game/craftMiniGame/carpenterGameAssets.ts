export const ASSET_KEYS = {
  workshopBg: 'carpenter_workshop_bg',
  workbenchOverlay: 'workbench_overlay',
  woodBlankRough: 'wood_blank_rough',
  woodBlankNormal: 'wood_blank_normal',
  woodBlankGood: 'wood_blank_good',
  woodBlankMaster: 'wood_blank_master',
  woodBlankBroken: 'wood_blank_broken',
} as const;

export const ASSET_PATHS = {
  carpenter_workshop_bg: '/assets/carpenter_workshop_bg.png',
  workbench_overlay: '/assets/workbench_overlay.png',
  wood_blank_rough: '/assets/wood_blank_rough.png',
  wood_blank_normal: '/assets/wood_blank_normal.png',
  wood_blank_good: '/assets/wood_blank_good.png',
  wood_blank_master: '/assets/wood_blank_master.png',
  wood_blank_broken: '/assets/wood_blank_broken.png',
} as const;

export function getWoodBlankKey(quality: number, broken: boolean): string {
  if (broken) return ASSET_KEYS.woodBlankBroken;
  if (quality >= 85) return ASSET_KEYS.woodBlankMaster;
  if (quality >= 60) return ASSET_KEYS.woodBlankGood;
  if (quality >= 30) return ASSET_KEYS.woodBlankNormal;
  return ASSET_KEYS.woodBlankRough;
}

export function getWoodColor(quality: number, broken: boolean): number {
  if (broken) return 0x3a1a0a;
  if (quality >= 85) return 0xf5d87a;
  if (quality >= 60) return 0xd4a855;
  if (quality >= 30) return 0xa87040;
  return 0x7a4820;
}

export function getIntegrityColor(integrity: number): number {
  if (integrity > 60) return 0x4cde68;
  if (integrity > 35) return 0xf5c842;
  if (integrity > 15) return 0xe07830;
  return 0xe03030;
}

export function getProgressColor(progress: number): number {
  if (progress >= 80) return 0x6ab4ff;
  if (progress >= 60) return 0x5aa0e0;
  return 0x4080c0;
}

export function getGradeColor(grade: string): number {
  switch (grade) {
    case 'masterpiece': return 0xffe066;
    case 'masterwork': return 0xc8a0f0;
    case 'excellent': return 0x4cde68;
    case 'good': return 0x5abaff;
    case 'common': return 0xd0d0d0;
    case 'poor': return 0x909090;
    case 'broken': return 0xe03030;
    default: return 0xffffff;
  }
}

export function getGradeLabel(grade: string): string {
  switch (grade) {
    case 'masterpiece': return '✦ ШЕДЕВР ✦';
    case 'masterwork': return '★ Мастерская работа';
    case 'excellent': return '◆ Отличное';
    case 'good': return '▲ Хорошее';
    case 'common': return '● Обычное';
    case 'poor': return '▽ Плохое';
    case 'broken': return '✕ Сломано';
    default: return grade;
  }
}

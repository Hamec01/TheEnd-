import type { ZoneType } from './zoneEditorTypes';

export const ZONE_COLORS: Record<ZoneType, string> = {
  city: '#2f80ff',
  settlement: '#60cfff',
  quest: '#ffd84d',
  story: '#ffb000',
  landmark: '#b56cff',
  danger: '#8b0000',
  grind: '#ff3333',
  resource: '#31c46b',
  profession: '#ff8a2a',
  dungeon: '#111111',
  transition: '#ffffff',
  safe: '#90ee90',
  event: '#ff77c8',
  faction: '#9a9a9a',
  locked: '#555555',
  fast_travel: '#00e5ff',
  rest: '#b6ff4d',
};

export const ZONE_DUNGEON_OUTLINE = '#8b5cff';
export const EDITOR_FILL_ALPHA = 0.22;
export const EDITOR_STROKE_ALPHA = 0.9;
export const EDITOR_DRAFT_ALPHA = 0.35;
export const INVALID_DRAFT_COLOR = '#ff3b30';

export function withAlpha(hexColor: string, alpha: number): string {
  const normalized = Math.max(0, Math.min(1, alpha));
  return `${hexColor}${Math.round(normalized * 255).toString(16).padStart(2, '0')}`;
}

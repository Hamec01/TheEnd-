export type ImagePresetId = 'item-icon' | 'merchant-portrait' | 'battle-map-background';

export interface ImagePreset {
  id: ImagePresetId;
  width: number;
  height: number;
  label: string;
}

export const IMAGE_PRESETS: Record<ImagePresetId, ImagePreset> = {
  'item-icon': {
    id: 'item-icon',
    width: 128,
    height: 128,
    label: 'Иконка предмета',
  },
  'merchant-portrait': {
    id: 'merchant-portrait',
    width: 384,
    height: 384,
    label: 'Портрет торговца',
  },
  'battle-map-background': {
    id: 'battle-map-background',
    width: 1920,
    height: 1080,
    label: 'Фон tactical карты',
  },
};

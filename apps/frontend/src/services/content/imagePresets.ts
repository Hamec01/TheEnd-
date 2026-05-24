export type ImagePresetId =
  | 'item-icon'
  | 'set-icon'
  | 'merchant-portrait'
  | 'battle-map-background'
  | 'mining-tool-icon'
  | 'mining-block';

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
    label: 'Item icon',
  },
  'set-icon': {
    id: 'set-icon',
    width: 128,
    height: 128,
    label: 'Set icon',
  },
  'merchant-portrait': {
    id: 'merchant-portrait',
    width: 384,
    height: 384,
    label: 'Character portrait',
  },
  'battle-map-background': {
    id: 'battle-map-background',
    width: 1920,
    height: 1080,
    label: 'Battle map background',
  },
  'mining-tool-icon': {
    id: 'mining-tool-icon',
    width: 128,
    height: 128,
    label: 'Mining tool icon',
  },
  'mining-block': {
    id: 'mining-block',
    width: 256,
    height: 256,
    label: 'Mining block sprite',
  },
};

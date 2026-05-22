export type PhaserAssetKind = 'image' | 'spritesheet' | 'atlas' | 'audio' | 'particle';

export interface PhaserAsset {
  id: string;
  kind: PhaserAssetKind;
  url: string;
  fallbackUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
}

export const PHASER_PLACEHOLDER_ASSET = '/art/races/human.png';

export const PHASER_ASSET_REGISTRY: Record<string, PhaserAsset> = {
  actor_human_placeholder: {
    id: 'actor_human_placeholder',
    kind: 'image',
    url: PHASER_PLACEHOLDER_ASSET,
  },
  fx_particle_placeholder: {
    id: 'fx_particle_placeholder',
    kind: 'particle',
    url: PHASER_PLACEHOLDER_ASSET,
  },
};

export function resolvePhaserAsset(assetId: string | null | undefined): PhaserAsset {
  if (!assetId) {
    return PHASER_ASSET_REGISTRY.actor_human_placeholder;
  }
  return PHASER_ASSET_REGISTRY[assetId] ?? {
    id: assetId,
    kind: 'image',
    url: assetId,
    fallbackUrl: PHASER_PLACEHOLDER_ASSET,
  };
}

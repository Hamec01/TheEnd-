export type PhaserAssetKind = 'image' | 'spritesheet' | 'atlas' | 'audio' | 'particle';

export interface PhaserAsset {
  id: string;
  kind: PhaserAssetKind;
  url: string;
  fallbackUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
  optional?: boolean;
  tags?: string[];
}

export interface PhaserAssetManifest {
  version: number;
  assets: PhaserAsset[];
}

export const PHASER_PLACEHOLDER_ASSET = '/art/races/human.png';

const DEFAULT_PHASER_ASSET_MANIFEST: PhaserAssetManifest = {
  version: 1,
  assets: [
    {
      id: 'actor_human_placeholder',
      kind: 'image',
      url: PHASER_PLACEHOLDER_ASSET,
    },
    {
      id: 'fx_particle_placeholder',
      kind: 'particle',
      url: PHASER_PLACEHOLDER_ASSET,
    },
    {
      id: 'actor_human_01',
      kind: 'image',
      url: '/sprites/actor/human_01.png',
      fallbackUrl: PHASER_PLACEHOLDER_ASSET,
      tags: ['sprite', 'actor'],
    },
    {
      id: 'actor_dwarf_01',
      kind: 'image',
      url: '/sprites/actor/dwarf_01.png',
      fallbackUrl: '/art/races/dwarf.png',
      tags: ['sprite', 'actor'],
    },
    {
      id: 'actor_high_elf_01',
      kind: 'image',
      url: '/sprites/actor/high_elf_01.png',
      fallbackUrl: '/art/races/elf.png',
      tags: ['sprite', 'actor'],
    },
    {
      id: 'world_trader_sprite',
      kind: 'image',
      url: '/sprites/world/trader_world_sprite.png',
      fallbackUrl: PHASER_PLACEHOLDER_ASSET,
      tags: ['sprite', 'world'],
    },
    {
      id: 'world_fire_sprite',
      kind: 'image',
      url: '/sprites/world/fire_world_sprite.png',
      fallbackUrl: PHASER_PLACEHOLDER_ASSET,
      tags: ['sprite', 'world'],
    },
    {
      id: 'world_camp_sprite',
      kind: 'image',
      url: '/sprites/world/camp_world_sprite.png',
      fallbackUrl: PHASER_PLACEHOLDER_ASSET,
      tags: ['sprite', 'world'],
    },
    {
      id: 'world_camp_sprite_alt',
      kind: 'image',
      url: '/sprites/world/camp_world_sprite_2.png',
      fallbackUrl: PHASER_PLACEHOLDER_ASSET,
      tags: ['sprite', 'world'],
    },
    {
      id: 'map_world_main',
      kind: 'image',
      url: '/map/main_world_map.webp',
      fallbackUrl: '/map/world-map.png',
      tags: ['map', 'world'],
    },
    {
      id: 'map_battle_arena',
      kind: 'image',
      url: '/map/battle-map_arena.png',
      fallbackUrl: '/art/battle-map.png',
      tags: ['map', 'battle'],
    },
    {
      id: 'particle_dot',
      kind: 'particle',
      url: PHASER_PLACEHOLDER_ASSET,
      optional: true,
      tags: ['particle', 'fallback'],
    },
    {
      id: 'melee_hit_01',
      kind: 'audio',
      url: '/audio/battle/melee_hit_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'sword_slash_01',
      kind: 'audio',
      url: '/audio/battle/sword_slash_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'arrow_shot_01',
      kind: 'audio',
      url: '/audio/battle/arrow_shot_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'arrow_hit_01',
      kind: 'audio',
      url: '/audio/battle/arrow_hit_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'fire_cast_01',
      kind: 'audio',
      url: '/audio/battle/fire_cast_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'fire_hit_01',
      kind: 'audio',
      url: '/audio/battle/fire_hit_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'ice_cast_01',
      kind: 'audio',
      url: '/audio/battle/ice_cast_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'ice_hit_01',
      kind: 'audio',
      url: '/audio/battle/ice_hit_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'death_01',
      kind: 'audio',
      url: '/audio/battle/death_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
    {
      id: 'loot_spawn_01',
      kind: 'audio',
      url: '/audio/battle/loot_spawn_01.ogg',
      optional: true,
      tags: ['audio', 'battle'],
    },
  ],
};

function toAssetRegistry(manifest: PhaserAssetManifest): Record<string, PhaserAsset> {
  return manifest.assets.reduce<Record<string, PhaserAsset>>((accumulator, asset) => {
    accumulator[asset.id] = asset;
    return accumulator;
  }, {});
}

let currentManifest: PhaserAssetManifest = DEFAULT_PHASER_ASSET_MANIFEST;

export let PHASER_ASSET_REGISTRY: Record<string, PhaserAsset> = toAssetRegistry(currentManifest);

export function getPhaserAssetManifest(): PhaserAssetManifest {
  return currentManifest;
}

export function listPhaserAssets(): PhaserAsset[] {
  return currentManifest.assets;
}

export function listPhaserAssetsByKind(kind: PhaserAssetKind): PhaserAsset[] {
  return currentManifest.assets.filter((asset) => asset.kind === kind);
}

export function setPhaserAssetManifest(manifest: PhaserAssetManifest): void {
  currentManifest = manifest;
  PHASER_ASSET_REGISTRY = toAssetRegistry(manifest);
}

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

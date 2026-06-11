import type {
  TreeDefinition,
  WoodMaterialInheritanceSnapshot,
  WoodOutputKind,
} from '../../services/content/models';

export const WOOD_OUTPUT_TRAIT_RETENTION: Record<WoodOutputKind, number> = {
  log: 100,
  plank: 80,
  beam: 85,
  firewood: 30,
  bark: 45,
  resin: 65,
  charcoal: 35,
  wood_glue: 55,
  unknown: 50,
};

type WoodAction = 'woodcutting' | 'sawing' | 'processing';

export function resolveWoodOutputKindByItemId(itemId: string): WoodOutputKind {
  const normalized = itemId.toLowerCase();
  if (normalized.includes('log')) return 'log';
  if (normalized.includes('plank')) return 'plank';
  if (normalized.includes('beam')) return 'beam';
  if (normalized.includes('firewood')) return 'firewood';
  if (normalized.includes('bark')) return 'bark';
  if (normalized.includes('resin')) return 'resin';
  if (normalized.includes('charcoal')) return 'charcoal';
  if (normalized.includes('glue')) return 'wood_glue';
  return 'unknown';
}

export function isLikelyGenericWoodStackItemId(itemId: string): boolean {
  const normalized = itemId.toLowerCase().trim();
  return (
    normalized === 'item_wood_log' ||
    normalized === 'item_log_common' ||
    normalized === 'item_wood_log_common' ||
    normalized === 'item_wood_plank' ||
    normalized === 'item_plank_common' ||
    normalized === 'item_wood_plank_common' ||
    normalized === 'item_wood_beam' ||
    normalized === 'item_beam_common' ||
    normalized === 'item_wood_beam_common' ||
    normalized === 'item_resin_common' ||
    normalized === 'item_wood_resin_common' ||
    normalized === 'item_glue_common' ||
    normalized === 'item_wood_glue_common' ||
    normalized === 'item_bark_common' ||
    normalized === 'item_wood_bark_common' ||
    normalized === 'item_charcoal_common' ||
    normalized === 'item_wood_charcoal_common'
  );
}

function inferTreeIdFromItemId(itemId: string): string | null {
  const normalized = itemId.toLowerCase();
  if (!normalized.startsWith('item_wood_')) return null;
  const prefixes = ['item_wood_log_', 'item_wood_plank_', 'item_wood_beam_'];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      const suffix = normalized.slice(prefix.length).trim();
      return suffix ? `tree_${suffix}` : null;
    }
  }
  return null;
}

export function resolveTreeForWoodItem(params: { itemId: string; trees: TreeDefinition[] }): TreeDefinition | null {
  const itemId = String(params.itemId || '').trim();
  if (!itemId) return null;
  if (isLikelyGenericWoodStackItemId(itemId)) return null;

  for (const tree of params.trees) {
    const directMatches = [
      tree.defaultLogMaterialId,
      tree.defaultPlankMaterialId,
      tree.defaultBeamMaterialId,
      tree.defaultResinMaterialId,
      tree.defaultBarkMaterialId,
      ...(tree.sourceMaterialIds || []),
    ].filter(Boolean);
    if (directMatches.includes(itemId)) return tree;
  }

  for (const tree of params.trees) {
    if ((tree.drops || []).some((drop) => drop.itemId === itemId)) return tree;
  }

  const inferredTreeId = inferTreeIdFromItemId(itemId);
  if (inferredTreeId) {
    return params.trees.find((tree) => tree.id === inferredTreeId) ?? null;
  }

  return null;
}

export function buildWoodMaterialInheritanceSnapshot(params: {
  tree: TreeDefinition | null | undefined;
  outputKind: WoodOutputKind;
  sourceItemId?: string;
  createdItemId?: string;
  retentionOverridePercent?: number;
  createdByAction: WoodAction;
}): WoodMaterialInheritanceSnapshot | null {
  if (!params.tree) return null;
  const tree = params.tree;
  const profile = tree.woodProfile;
  const retention = Math.max(
    0,
    Math.min(100, params.retentionOverridePercent ?? WOOD_OUTPUT_TRAIT_RETENTION[params.outputKind] ?? WOOD_OUTPUT_TRAIT_RETENTION.unknown),
  );

  return {
    sourceTreeId: tree.id,
    sourceTreeName: tree.name,
    sourceTreeRarity: tree.rarity,
    sourceTreeTier: tree.tier,
    outputKind: params.outputKind,
    sourceItemId: params.sourceItemId,
    createdItemId: params.createdItemId,
    traitRetentionPercent: retention,
    inheritedTraitTags: profile?.traitTags ?? [],
    inheritedWoodProfile: profile,
    inheritedEffects: profile?.defaultInheritedEffects ?? [],
    inheritedAtIso: new Date().toISOString(),
    createdByProfession: 'carpenter',
    createdByAction: params.createdByAction,
  };
}

import type { InventoryState } from '@theend/rpg-domain';
import { adjustDevInventoryItem, syncArenaItemInstance } from '../../api';
import type {
  AdminItem,
  CarpenterComponentKind,
  CarpenterCraftedComponentSnapshot,
  CarpenterItemTemplate,
  ItemEffect,
  Material,
  ProfessionWorkshopDefinition,
  TreeDefinition,
  WoodTraitTag,
} from '../../services/content/models';
import { itemsService } from '../../services/content/itemsService';
import {
  PLAYER_HIDDEN_RUNTIME_ITEM_TAG,
  PLAYER_RUNTIME_ITEM_TAG,
  upsertPlayerItemInstance,
} from '../../services/playerItemInstances';
import {
  mergeInventoryWithRuntimeOverlay,
  PLAYER_INVENTORY_REMOVALS_STORAGE_KEY,
  readStringNumberRecordStorage,
  writeStringNumberRecordStorage,
} from '../../utils/playerInventory';
import { canUseCarpenterTemplate, canUseCarpenterTemplateInWorkshop } from './carpenterTemplateAccess';
import { isLikelyGenericWoodStackItemId, resolveTreeForWoodItem } from './woodInheritance';

export interface CarpenterCraftInputSelection {
  slotId: string;
  itemId: string;
  quantity: number;
}

export interface CarpenterComponentCraftPreview {
  ok: boolean;
  errors: string[];
  warnings: string[];
  templateId: string;
  templateName: string;
  componentKind: CarpenterComponentKind;
  sourceTreeId?: string;
  sourceTreeName?: string;
  outputName: string;
  outputItemIdPreview: string;
  qualityScore: number;
  traitRetentionPercent: number;
  inheritedTraitTags: string[];
  sourceLost?: boolean;
}

export interface CarpenterComponentCraftResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  createdItemId?: string;
  createdItemName?: string;
  snapshot?: CarpenterCraftedComponentSnapshot;
  inventory?: InventoryState;
}

export interface EligibleCarpenterInputItem {
  itemId: string;
  quantity: number;
  itemName: string;
  componentKind: string;
}

type CarpenterTemplateWithComponentKind = CarpenterItemTemplate & {
  componentKind?: string;
};

interface CarpenterInputRemoval {
  itemId: string;
  quantity: number;
  slotId: string;
  slotLabel: string;
}

type CarpenterCraftContent = {
  items: AdminItem[];
  materials: Material[];
  trees?: TreeDefinition[];
};

const CARPENTER_COMPONENT_TRAIT_RETENTION: Partial<Record<CarpenterComponentKind, number>> = {
  log: 100,
  plank: 80,
  thin_plank: 72,
  planed_plank: 78,
  polished_plank: 82,
  beam: 85,
  handle: 55,
  sword_handle: 58,
  dagger_handle: 55,
  axe_haft: 62,
  hammer_handle: 65,
  mace_handle: 65,
  shaft: 70,
  spear_shaft: 70,
  javelin_shaft: 68,
  polearm_shaft: 72,
  arrow_shaft: 60,
  bolt_shaft: 62,
  staff_core: 75,
  wand_core: 78,
  ritual_staff_core: 82,
  rune_staff_core: 84,
  crossbow_stock: 70,
  crossbow_body: 72,
  shield_core_round: 82,
  shield_core_kite: 84,
  shield_core_tower: 88,
  rune_wood_plate: 78,
  ritual_board: 80,
  totem_core: 82,
  shamanic_frame: 80,
};

const COMMON_WOOD_ITEM_KIND_MAP: Record<string, string> = {
  item_wood_log_common: 'raw_log',
  item_log_common: 'raw_log',
  item_wood_plank_common: 'plank',
  item_plank_common: 'plank',
  item_wood_beam_common: 'beam',
  item_beam_common: 'beam',
  item_resin_common: 'resin',
  item_wood_resin_common: 'resin',
  item_wood_glue_common: 'wood_glue',
  item_glue_common: 'wood_glue',
  item_bark_common: 'bark_strip',
  item_wood_bark_common: 'bark_strip',
  item_charcoal_common: 'charcoal',
  item_wood_charcoal_common: 'charcoal',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeIdFragment(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function inferCarpenterComponentKindFromItemId(itemId?: string): string | null {
  const normalized = String(itemId ?? '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const direct = COMMON_WOOD_ITEM_KIND_MAP[normalized];
  if (direct) {
    return direct;
  }

  if (normalized.startsWith('item_wood_log_') || normalized.startsWith('item_log_')) {
    return 'raw_log';
  }
  if (normalized.startsWith('item_wood_plank_') || normalized.startsWith('item_plank_')) {
    return 'plank';
  }
  if (normalized.startsWith('item_wood_beam_') || normalized.startsWith('item_beam_')) {
    return 'beam';
  }
  if (normalized.startsWith('item_wood_resin_') || normalized.startsWith('item_resin_')) {
    return 'resin';
  }
  if (normalized.startsWith('item_wood_glue_') || normalized.startsWith('item_glue_')) {
    return 'wood_glue';
  }
  if (normalized.startsWith('item_wood_bark_') || normalized.startsWith('item_bark_')) {
    return 'bark_strip';
  }
  if (normalized.startsWith('item_wood_charcoal_') || normalized.startsWith('item_charcoal_')) {
    return 'charcoal';
  }

  return null;
}

export function resolveCarpenterTemplateOutputKind(template: CarpenterItemTemplate | null | undefined): CarpenterComponentKind {
  if (!template) {
    return 'unknown';
  }
  if (template.outputComponentKind && template.outputComponentKind !== 'unknown') {
    return template.outputComponentKind;
  }
  const fallbackKind = String((template as CarpenterTemplateWithComponentKind).componentKind ?? '').trim();
  return (fallbackKind || 'unknown') as CarpenterComponentKind;
}

export function resolveSelectedComponentKind(params: {
  itemId: string;
  contentItems: AdminItem[];
  inheritedFromComponent: Map<string, CarpenterCraftedComponentSnapshot>;
}): string {
  const inherited = params.inheritedFromComponent.get(params.itemId);
  if (inherited?.componentKind) {
    return inherited.componentKind;
  }

  const itemById = params.contentItems.find((entry) => entry.id === params.itemId);
  const itemMetadata = (itemById ?? {}) as AdminItem & {
    componentKind?: string;
    carpenterComponent?: { componentKind?: string };
  };
  const metadataKind = typeof itemMetadata.componentKind === 'string'
    ? itemMetadata.componentKind
    : typeof itemMetadata.carpenterComponent?.componentKind === 'string'
      ? itemMetadata.carpenterComponent.componentKind
      : undefined;
  if (metadataKind) {
    return metadataKind as CarpenterComponentKind;
  }

  const taggedKind = (itemById?.tags ?? []).find((tag) => tag.startsWith('component_kind:'))?.replace('component_kind:', '');
  if (taggedKind) {
    return taggedKind as CarpenterComponentKind;
  }

  return inferCarpenterComponentKindFromItemId(params.itemId) ?? 'unknown';
}

export function isCarpenterInputSlotSatisfied(
  slot: CarpenterItemTemplate['inputSlots'][number],
  selectedItem: { itemId?: string; id?: string } | null | undefined,
  selectedKind?: string | null,
): boolean {
  const selectedItemId = String(selectedItem?.itemId ?? selectedItem?.id ?? '').trim();
  const acceptedByItemId = Boolean(selectedItemId && slot.acceptedItemIds?.includes(selectedItemId));
  const acceptedByMaterialId = Boolean(selectedItemId && slot.acceptedMaterialIds?.includes(selectedItemId));
  const acceptedByKind = Boolean(selectedKind && slot.acceptedComponentKinds?.includes(selectedKind as CarpenterComponentKind));
  return acceptedByItemId || acceptedByMaterialId || acceptedByKind;
}

export function getEligibleInventoryItemsForCarpenterSlot(params: {
  slot: CarpenterItemTemplate['inputSlots'][number];
  inventoryItems: InventoryState['items'];
  contentItems: AdminItem[];
  inheritedFromComponent: Map<string, CarpenterCraftedComponentSnapshot>;
}): EligibleCarpenterInputItem[] {
  const acceptedItemIds = new Set(params.slot.acceptedItemIds ?? []);
  return params.inventoryItems
    .filter((entry) => entry.quantity > 0)
    .map((entry) => {
      const componentKind = resolveSelectedComponentKind({
        itemId: entry.itemId,
        contentItems: params.contentItems,
        inheritedFromComponent: params.inheritedFromComponent,
      });
      const item = params.contentItems.find((candidate) => candidate.id === entry.itemId);
      return {
        itemId: entry.itemId,
        quantity: entry.quantity,
        itemName: item?.name?.trim() || entry.itemId,
        componentKind,
        accepted: isCarpenterInputSlotSatisfied(params.slot, entry, componentKind),
      };
    })
    .filter((entry) => entry.accepted)
    .sort((left, right) => {
      const leftPriority = acceptedItemIds.has(left.itemId) ? 0 : 1;
      const rightPriority = acceptedItemIds.has(right.itemId) ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return left.itemName.localeCompare(right.itemName, 'ru');
    })
    .map(({ accepted: _accepted, ...entry }) => entry);
}

function getInventoryQuantity(inventory: InventoryState, itemId: string): number {
  return Math.max(0, Math.floor(Number(inventory.items.find((entry) => entry.itemId === itemId)?.quantity ?? 0)));
}

function removeFromInventoryState(inventory: InventoryState, itemId: string, quantity: number): InventoryState {
  let remainingToRemove = Math.max(0, Math.floor(quantity));
  return {
    ...inventory,
    items: inventory.items
      .map((entry) => {
        if (entry.itemId !== itemId) {
          return entry;
        }
        const removalForEntry = Math.min(remainingToRemove, Math.max(0, entry.quantity));
        remainingToRemove -= removalForEntry;
        return {
          ...entry,
          quantity: Math.max(0, entry.quantity - removalForEntry),
        };
      })
      .filter((entry) => entry.quantity > 0),
  };
}

function buildCarpenterInputRemovals(
  template: CarpenterItemTemplate,
  inputSelections: CarpenterCraftInputSelection[],
): CarpenterInputRemoval[] {
  const slotById = new Map(template.inputSlots.map((slot) => [slot.id, slot]));
  return inputSelections
    .map((selection) => {
      const itemId = String(selection.itemId ?? '').trim();
      const quantity = Math.max(0, Math.floor(Number(selection.quantity ?? 0)));
      if (!itemId || quantity <= 0) {
        return null;
      }
      const slot = slotById.get(selection.slotId);
      return {
        itemId,
        quantity,
        slotId: selection.slotId,
        slotLabel: slot?.label?.trim() || selection.slotId,
      } satisfies CarpenterInputRemoval;
    })
    .filter((entry): entry is CarpenterInputRemoval => Boolean(entry));
}

function createRuntimeCraftItemId(kind: CarpenterComponentKind, sourceTreeId?: string): string {
  const kindPart = sanitizeIdFragment(kind) || 'component';
  const sourcePart = sanitizeIdFragment(sourceTreeId ?? 'common_wood') || 'common_wood';
  const unique = (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`)
    .replace(/-/g, '')
    .slice(0, 8)
    .toLowerCase();
  return `item_carpenter_component_${kindPart}_${sourcePart}_${unique}`;
}

function deriveTreeFromSelections(
  inputSelections: CarpenterCraftInputSelection[],
  trees: TreeDefinition[],
  inheritedFromComponent: Map<string, CarpenterCraftedComponentSnapshot>,
): {
  sourceTree: TreeDefinition | null;
  sourceLost: boolean;
  sourceLostReason?: string;
  inheritedTraitTags: WoodTraitTag[];
  inheritedEffects: ItemEffect[];
  inheritedWoodProfile: CarpenterCraftedComponentSnapshot['inheritedWoodProfile'];
} {
  const traitSet = new Set<WoodTraitTag>();
  const effects: ItemEffect[] = [];
  let sourceTree: TreeDefinition | null = null;
  let sourceLost = false;
  let sourceLostReason: string | undefined;
  let inheritedWoodProfile: CarpenterCraftedComponentSnapshot['inheritedWoodProfile'];

  for (const selection of inputSelections) {
    const componentSnapshot = inheritedFromComponent.get(selection.itemId);
    if (componentSnapshot) {
      for (const trait of componentSnapshot.inheritedTraitTags ?? []) {
        traitSet.add(trait);
      }
      effects.push(...(componentSnapshot.inheritedEffects ?? []));
      if (!sourceTree && componentSnapshot.sourceTreeId) {
        sourceTree = trees.find((tree) => tree.id === componentSnapshot.sourceTreeId) ?? null;
      }
      if (!inheritedWoodProfile && componentSnapshot.inheritedWoodProfile) {
        inheritedWoodProfile = componentSnapshot.inheritedWoodProfile;
      }
      if (componentSnapshot.sourceLost) {
        sourceLost = true;
        sourceLostReason = componentSnapshot.sourceLostReason ?? 'source lost in parent component snapshot';
      }
      continue;
    }

    const resolvedTree = resolveTreeForWoodItem({ itemId: selection.itemId, trees });
    if (!sourceTree && resolvedTree) {
      sourceTree = resolvedTree;
      inheritedWoodProfile = resolvedTree.woodProfile;
      for (const trait of resolvedTree.woodProfile?.traitTags ?? []) {
        traitSet.add(trait);
      }
      effects.push(...(resolvedTree.woodProfile?.defaultInheritedEffects ?? []));
    }
    if (!resolvedTree && isLikelyGenericWoodStackItemId(selection.itemId)) {
      sourceLost = true;
      sourceLostReason = 'generic stacked itemId cannot preserve source tree';
    }
  }

  return {
    sourceTree,
    sourceLost,
    sourceLostReason,
    inheritedTraitTags: Array.from(traitSet),
    inheritedEffects: effects,
    inheritedWoodProfile,
  };
}

function computeQualityScore(params: {
  carpenterLevel: number;
  sourceLost: boolean;
  inheritedTraitTags: string[];
  template: CarpenterItemTemplate;
}): number {
  const preferredBonus = Math.min(20, (params.inheritedTraitTags.length > 0 ? 1 : 0) * 10);
  const sourceLostPenalty = params.sourceLost ? 15 : 0;
  const baseDifficulty = params.template.difficulty === 'master'
    ? 40
    : params.template.difficulty === 'advanced'
      ? 28
      : params.template.difficulty === 'standard'
        ? 18
        : 10;
  return clamp(Math.round(50 + params.carpenterLevel * 3 + preferredBonus - baseDifficulty * 0.25 - sourceLostPenalty), 1, 100);
}

function computeTraitRetentionPercent(kind: CarpenterComponentKind, qualityScore: number): number {
  const baseRetention = CARPENTER_COMPONENT_TRAIT_RETENTION[kind] ?? 60;
  const scaled = Math.round(baseRetention * (0.75 + qualityScore / 400));
  return clamp(scaled, 1, 100);
}

function validateSelections(params: {
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  inventory: InventoryState;
  content: CarpenterCraftContent;
  inheritedFromComponent: Map<string, CarpenterCraftedComponentSnapshot>;
}): { errors: string[] } {
  const errors: string[] = [];
  const bySlotId = new Map(params.inputSelections.map((entry) => [entry.slotId, entry]));

  for (const slot of params.template.inputSlots ?? []) {
    const selected = bySlotId.get(slot.id);
    if (slot.required && !selected) {
      errors.push(`Слот '${slot.label || slot.id}' обязателен.`);
      continue;
    }
    if (!selected) continue;
    if (!selected.itemId?.trim()) {
      errors.push(`Слот '${slot.label || slot.id}': itemId обязателен.`);
      continue;
    }
    if (!Number.isFinite(selected.quantity) || selected.quantity <= 0) {
      errors.push(`Слот '${slot.label || slot.id}': quantity должен быть > 0.`);
      continue;
    }
    const available = getInventoryQuantity(params.inventory, selected.itemId);
    if (available < selected.quantity) {
      errors.push(`Недостаточно ${selected.itemId}: нужно ${selected.quantity}, доступно ${available}.`);
    }

    const inferredKind = resolveSelectedComponentKind({
      itemId: selected.itemId,
      contentItems: params.content.items ?? [],
      inheritedFromComponent: params.inheritedFromComponent,
    });
    const hasAnyRestrictions = Boolean(
      (slot.acceptedItemIds?.length ?? 0) > 0
      || (slot.acceptedMaterialIds?.length ?? 0) > 0
      || (slot.acceptedComponentKinds?.length ?? 0) > 0,
    );
    if (hasAnyRestrictions && !isCarpenterInputSlotSatisfied(slot, selected, inferredKind)) {
      errors.push(`Слот '${slot.label || slot.id}': item '${selected.itemId}' / kind '${inferredKind}' не проходит acceptedItemIds, acceptedMaterialIds или acceptedComponentKinds.`);
    }
  }

  return { errors };
}

export function buildCarpenterCraftedComponentSnapshot(params: {
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  content: CarpenterCraftContent;
  carpenterLevel?: number;
  qualityScore: number;
  craftedByCharacterId?: string;
  inheritedFromComponent?: Map<string, CarpenterCraftedComponentSnapshot>;
}): CarpenterCraftedComponentSnapshot {
  const trees = params.content.trees ?? [];
  const inheritedMap = params.inheritedFromComponent ?? new Map<string, CarpenterCraftedComponentSnapshot>();
  const derived = deriveTreeFromSelections(params.inputSelections, trees, inheritedMap);
  const outputComponentKind = resolveCarpenterTemplateOutputKind(params.template);
  const retention = computeTraitRetentionPercent(outputComponentKind, params.qualityScore);
  return {
    sourceTreeId: derived.sourceTree?.id,
    sourceTreeName: derived.sourceTree?.name,
    sourceTreeRarity: derived.sourceTree?.rarity,
    sourceTreeTier: derived.sourceTree?.tier,
    sourceWoodItemIds: params.inputSelections.map((entry) => entry.itemId),
    templateId: params.template.id,
    templateName: params.template.name,
    componentKind: outputComponentKind,
    craftedByProfession: 'carpenter',
    craftedByCharacterId: params.craftedByCharacterId,
    carpenterLevel: params.carpenterLevel ?? 1,
    qualityScore: params.qualityScore,
    traitRetentionPercent: retention,
    inheritedTraitTags: derived.inheritedTraitTags,
    inheritedWoodProfile: derived.inheritedWoodProfile,
    inheritedEffects: derived.inheritedEffects,
    sourceLost: derived.sourceLost,
    sourceLostReason: derived.sourceLostReason,
    createdAtIso: new Date().toISOString(),
  };
}

export function createCarpenterComponentItemDefinition(params: {
  template: CarpenterItemTemplate;
  snapshot: CarpenterCraftedComponentSnapshot;
  outputItemId: string;
  ownerCharacterId?: string;
}): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  const sourceLabel = params.snapshot.sourceTreeName || (params.snapshot.sourceLost ? 'обычная древесина' : 'неизвестная древесина');
  const qualityBand = params.snapshot.qualityScore >= 80 ? 'high' : params.snapshot.qualityScore >= 55 ? 'mid' : 'low';
  const tags = new Set<string>([
    PLAYER_RUNTIME_ITEM_TAG,
    PLAYER_HIDDEN_RUNTIME_ITEM_TAG,
    'carpenter_component',
    `carpenter_template:${params.template.id}`,
    `component_kind:${params.snapshot.componentKind}`,
    `quality:${qualityBand}`,
  ]);
  if (params.ownerCharacterId) {
    tags.add(`crafted_owner:${params.ownerCharacterId}`);
  }
  if (params.snapshot.sourceTreeId) {
    tags.add(`source_tree:${params.snapshot.sourceTreeId}`);
  }
  if (params.snapshot.sourceLost) {
    tags.add('source_lost');
    tags.add('generic_wood_source');
  }
  const loreLines = [
    'Плотницкий компонент.',
    `Шаблон: ${params.template.name}.`,
    `Источник древесины: ${sourceLabel}.`,
    `Сохранение свойств: ${params.snapshot.traitRetentionPercent}%.`,
    `Качество: ${params.snapshot.qualityScore}/100.`,
    'Может быть использован кузнецом: да.',
  ];
  return {
    id: params.outputItemId,
    name: `${params.template.name} — ${sourceLabel}`,
    type: 'material',
    subtype: 'carpenter_component',
    slot: 'none',
    handsRequired: 1,
    rarity: params.snapshot.qualityScore >= 85 ? 'epic' : params.snapshot.qualityScore >= 65 ? 'rare' : 'common',
    price: Math.max(1, Math.round(30 + params.snapshot.qualityScore * 2)),
    stackable: false,
    maxStack: 1,
    requiredStats: {},
    bonuses: {},
    gameplayDescription: 'Промежуточный компонент для будущих ремесленных рецептов.',
    loreDescription: loreLines.join(' '),
    tags: Array.from(tags),
    isEnabled: true,
  };
}

export function buildCarpenterComponentPreview(params: {
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  inventoryItems: InventoryState;
  content: CarpenterCraftContent;
  carpenterLevel?: number;
  inheritedFromComponent?: Map<string, CarpenterCraftedComponentSnapshot>;
  learnedSkillIds?: string[];
  skillNameById?: Record<string, string>;
  activeWorkshop?: ProfessionWorkshopDefinition | null;
  activeStationType?: string | null;
}): CarpenterComponentCraftPreview {
  const access = canUseCarpenterTemplate({
    template: params.template,
    learnedSkillIds: params.learnedSkillIds ?? [],
    skillNameById: params.skillNameById,
  });
  const workshopAccess = canUseCarpenterTemplateInWorkshop({
    template: params.template,
    activeWorkshop: params.activeWorkshop,
  });
  const validation = validateSelections({
    template: params.template,
    inputSelections: params.inputSelections,
    inventory: params.inventoryItems,
    content: params.content,
    inheritedFromComponent: params.inheritedFromComponent ?? new Map<string, CarpenterCraftedComponentSnapshot>(),
  });
  const normalizedActiveStationType = String(params.activeStationType ?? '').trim();
  const stationAllowed = !params.activeWorkshop || !normalizedActiveStationType || params.template.stationType === normalizedActiveStationType;
  const stationError = stationAllowed
    ? null
    : `Нужен станок ${normalizedActiveStationType}, а шаблон рассчитан на ${params.template.stationType}.`;

  const derived = deriveTreeFromSelections(
    params.inputSelections,
    params.content.trees ?? [],
    params.inheritedFromComponent ?? new Map<string, CarpenterCraftedComponentSnapshot>(),
  );
  const carpenterLevel = Math.max(1, Math.floor(params.carpenterLevel ?? 1));
  const outputComponentKind = resolveCarpenterTemplateOutputKind(params.template);
  const qualityScore = computeQualityScore({
    carpenterLevel,
    sourceLost: derived.sourceLost,
    inheritedTraitTags: derived.inheritedTraitTags,
    template: params.template,
  });
  const retention = computeTraitRetentionPercent(outputComponentKind, qualityScore);
  const outputItemIdPreview = createRuntimeCraftItemId(outputComponentKind, derived.sourceTree?.id);
  const sourceLabel = derived.sourceTree?.name || (derived.sourceLost ? 'обычная древесина' : 'неизвестная древесина');

  const warnings: string[] = [];
  if (derived.sourceLost) {
    warnings.push('Происхождение древесины неизвестно: generic stacked itemId не хранит sourceTreeId.');
  }

  return {
    ok: access.isUnlocked && workshopAccess.isAllowed && stationAllowed && validation.errors.length === 0,
    errors: [
      ...(access.isUnlocked ? [] : [access.reason ?? 'Шаблон заблокирован по навыкам.']),
      ...(workshopAccess.isAllowed ? [] : [workshopAccess.reason ?? 'Шаблон заблокирован мастерской.']),
      ...(stationError ? [stationError] : []),
      ...validation.errors,
    ],
    warnings,
    templateId: params.template.id,
    templateName: params.template.name,
    componentKind: outputComponentKind,
    sourceTreeId: derived.sourceTree?.id,
    sourceTreeName: derived.sourceTree?.name,
    outputName: `${params.template.name} — ${sourceLabel}`,
    outputItemIdPreview,
    qualityScore,
    traitRetentionPercent: retention,
    inheritedTraitTags: derived.inheritedTraitTags,
    sourceLost: derived.sourceLost,
  };
}

export async function commitCarpenterComponentCraft(params: {
  characterId: string;
  template: CarpenterItemTemplate;
  inputSelections: CarpenterCraftInputSelection[];
  inventory: InventoryState;
  content: CarpenterCraftContent;
  carpenterLevel?: number;
  inheritedFromComponent?: Map<string, CarpenterCraftedComponentSnapshot>;
  learnedSkillIds?: string[];
  skillNameById?: Record<string, string>;
  activeWorkshop?: ProfessionWorkshopDefinition | null;
  activeStationType?: string | null;
}): Promise<CarpenterComponentCraftResult> {
  const access = canUseCarpenterTemplate({
    template: params.template,
    learnedSkillIds: params.learnedSkillIds ?? [],
    skillNameById: params.skillNameById,
  });
  if (!access.isUnlocked) {
    return {
      ok: false,
      errors: [access.reason ?? 'Шаблон заблокирован.'],
      warnings: [],
    };
  }
  const workshopAccess = canUseCarpenterTemplateInWorkshop({
    template: params.template,
    activeWorkshop: params.activeWorkshop,
  });
  if (!workshopAccess.isAllowed) {
    return {
      ok: false,
      errors: [workshopAccess.reason ?? 'Шаблон заблокирован мастерской.'],
      warnings: [],
    };
  }

  const normalizedActiveStationType = String(params.activeStationType ?? '').trim();
  if (params.activeWorkshop && normalizedActiveStationType && params.template.stationType !== normalizedActiveStationType) {
    return {
      ok: false,
      errors: [`Нужен станок ${normalizedActiveStationType}, а шаблон рассчитан на ${params.template.stationType}.`],
      warnings: [],
    };
  }

  const preview = buildCarpenterComponentPreview({
    template: params.template,
    inputSelections: params.inputSelections,
    inventoryItems: params.inventory,
    content: params.content,
    carpenterLevel: params.carpenterLevel,
    inheritedFromComponent: params.inheritedFromComponent,
    learnedSkillIds: params.learnedSkillIds,
    skillNameById: params.skillNameById,
    activeWorkshop: params.activeWorkshop,
    activeStationType: params.activeStationType,
  });
  if (!preview.ok) {
    return { ok: false, errors: preview.errors, warnings: preview.warnings };
  }

  const removals = buildCarpenterInputRemovals(params.template, params.inputSelections);
  for (const removal of removals) {
    const currentQty = getInventoryQuantity(params.inventory, removal.itemId);
    if (currentQty < removal.quantity) {
      return {
        ok: false,
        errors: [`Not enough inventory for slot "${removal.slotLabel}": ${removal.itemId} (need ${removal.quantity}, have ${currentQty})`],
        warnings: preview.warnings,
      };
    }
  }

  const snapshot = buildCarpenterCraftedComponentSnapshot({
    template: params.template,
    inputSelections: params.inputSelections,
    content: params.content,
    carpenterLevel: params.carpenterLevel,
    qualityScore: preview.qualityScore,
    craftedByCharacterId: params.characterId,
    inheritedFromComponent: params.inheritedFromComponent,
  });

  const outputComponentKind = resolveCarpenterTemplateOutputKind(params.template);
  const outputItemId = createRuntimeCraftItemId(outputComponentKind, snapshot.sourceTreeId);
  const outputDraft = createCarpenterComponentItemDefinition({
    template: params.template,
    snapshot,
    outputItemId,
    ownerCharacterId: params.characterId,
  });

  let created: AdminItem;
  try {
    created = await itemsService.create(outputDraft);
  } catch (error) {
    return {
      ok: false,
      errors: [`Cannot persist carpenter crafted component snapshot without existing custom item persistence or item instance metadata. ${(error as Error).message}`],
      warnings: preview.warnings,
    };
  }

  const instance = upsertPlayerItemInstance({
    itemId: created.id,
    ownerId: params.characterId,
    itemSnapshot: created,
    customName: created.name,
    craftedFromTemplateId: params.template.id,
    craftedMaterialIds: params.inputSelections.map((entry) => entry.itemId),
    craftedByProfession: 'carpenter',
    carpenterComponent: snapshot,
    tags: created.tags,
    notes: 'carpenter_component_craft',
  });
  await syncArenaItemInstance(params.characterId, created.id, {
    version: 1,
    itemSnapshot: created,
    customName: created.name,
    ownerTag: params.characterId,
    craftedFromTemplateId: params.template.id,
    craftedMaterialIds: params.inputSelections.map((entry) => entry.itemId),
    craftedByProfession: 'carpenter',
    carpenterComponent: snapshot,
    tags: created.tags,
    notes: 'carpenter_component_craft',
    forgedAtIso: instance.updatedAt,
  }, instance.id).catch(() => undefined);

  let latestInventory: InventoryState | undefined;
  try {
    let usedLocalBackendFallback = false;
    latestInventory = params.inventory;

    for (const input of removals) {
      const quantityToRemove = Math.abs(Math.floor(input.quantity));
      if (quantityToRemove <= 0) {
        continue;
      }

      const currentInventory = latestInventory ?? params.inventory;
      const currentQty = getInventoryQuantity(currentInventory, input.itemId);
      if (currentQty < quantityToRemove) {
        throw new Error(`Item is not in inventory: ${input.itemId}, slot: ${input.slotLabel}`);
      }

      try {
        const hub = await adjustDevInventoryItem(params.characterId, {
          itemId: input.itemId,
          quantityDelta: -quantityToRemove,
        });
        latestInventory = usedLocalBackendFallback ? mergeInventoryWithRuntimeOverlay(hub.inventory) : hub.inventory;
      } catch (error) {
        const message = (error as Error).message || 'Item is not in inventory.';
        const persistedRemovals = readStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY);
        persistedRemovals[input.itemId] = Math.max(0, Math.floor(Number(persistedRemovals[input.itemId]) || 0)) + quantityToRemove;
        writeStringNumberRecordStorage(PLAYER_INVENTORY_REMOVALS_STORAGE_KEY, persistedRemovals);
        latestInventory = removeFromInventoryState(currentInventory, input.itemId, quantityToRemove);
        usedLocalBackendFallback = true;
        if (!message.includes('Item is not in inventory')) {
          console.warn('Carpenter craft backend removal failed, applied local fallback:', error);
        }
      }
    }
    const addHub = await adjustDevInventoryItem(params.characterId, { itemId: created.id, quantityDelta: 1 });
    latestInventory = usedLocalBackendFallback ? mergeInventoryWithRuntimeOverlay(addHub.inventory) : addHub.inventory;
  } catch (error) {
    return {
      ok: false,
      errors: [`Ошибка фиксации quantity/inventory persistence: ${(error as Error).message}`],
      warnings: preview.warnings,
    };
  }

  return {
    ok: true,
    errors: [],
    warnings: preview.warnings,
    createdItemId: created.id,
    createdItemName: created.name,
    snapshot,
    inventory: latestInventory,
  };
}

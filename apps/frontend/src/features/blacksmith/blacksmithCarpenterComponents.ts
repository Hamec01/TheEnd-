import type {
  AdminItem,
  BlacksmithItemTemplate,
  BlacksmithUsedCarpenterComponentSnapshot,
  CarpenterComponentKind,
  CarpenterCraftedComponentSnapshot,
  ItemType,
  ItemInstance,
} from '../../services/content/models';

export interface BlacksmithCarpenterComponentOption {
  itemId: string;
  itemName: string;
  quantity: number;
  instanceId?: string;
  snapshot: CarpenterCraftedComponentSnapshot;
}

export interface BlacksmithCarpenterValidationResult {
  ok: boolean;
  reason?: string;
  requiredKinds: CarpenterComponentKind[];
}

export interface BlacksmithCarpenterForgeContribution {
  descriptionLines: string[];
  tags: string[];
  previewMetadata: string[];
  carpenterComponentsUsed: BlacksmithUsedCarpenterComponentSnapshot[];
  selectedComponentItemId: string;
  selectedComponentInstanceId?: string;
}

function formatComponentKind(kind: CarpenterComponentKind): string {
  return kind.replace(/_/g, ' ');
}

function inferTemplateSubtypeKind(template: BlacksmithItemTemplate): string {
  return String(template.subtype ?? '').trim().toLowerCase();
}

function isShieldTemplate(template: BlacksmithItemTemplate): boolean {
  const subtype = inferTemplateSubtypeKind(template);
  return subtype.includes('shield')
    || (template.itemType === 'armor' && template.slot === 'leftHand')
    || subtype.includes('buckler');
}

function isWeaponTemplate(template: BlacksmithItemTemplate, weaponKinds: string[]): boolean {
  if (template.itemType !== ('weapon' as ItemType)) {
    return false;
  }
  const subtype = inferTemplateSubtypeKind(template);
  return weaponKinds.some((kind) => subtype.includes(kind));
}

export function getRequiredCarpenterComponentKinds(template: BlacksmithItemTemplate | null): CarpenterComponentKind[] {
  if (!template) {
    return [];
  }
  const subtype = inferTemplateSubtypeKind(template);
  if (isWeaponTemplate(template, ['sword'])) {
    return ['sword_handle', 'handle'];
  }
  if (isWeaponTemplate(template, ['spear', 'pike', 'polearm', 'javelin'])) {
    return ['spear_shaft', 'shaft', 'polearm_shaft', 'javelin_shaft'];
  }
  if (isShieldTemplate(template)) {
    return ['shield_core_round', 'shield_core_kite', 'shield_core_tower', 'board', 'frame'];
  }
  return [];
}

export function validateCarpenterComponentForTemplate(
  template: BlacksmithItemTemplate | null,
  component: BlacksmithCarpenterComponentOption | null,
): BlacksmithCarpenterValidationResult {
  const requiredKinds = getRequiredCarpenterComponentKinds(template);
  if (!component) {
    return { ok: true, requiredKinds };
  }
  if (!template || requiredKinds.length === 0) {
    return { ok: false, reason: 'Для выбранного кузнечного шаблона компонент плотника не используется.', requiredKinds };
  }
  if (!requiredKinds.includes(component.snapshot.componentKind)) {
    return {
      ok: false,
      reason: `Требуется один из типов: ${requiredKinds.map(formatComponentKind).join(', ')}.`,
      requiredKinds,
    };
  }
  return { ok: true, requiredKinds };
}

export function extractCarpenterComponentOptionFromItemInstance(
  item: AdminItem,
  quantity: number,
  instance: ItemInstance | null,
): BlacksmithCarpenterComponentOption | null {
  const snapshot = instance?.carpenterComponent;
  if (!snapshot || quantity <= 0) {
    return null;
  }
  return {
    itemId: item.id,
    itemName: item.name,
    quantity: Math.max(1, Math.floor(quantity || 1)),
    instanceId: instance.id,
    snapshot,
  };
}

export function buildUsedCarpenterComponentSnapshot(
  component: BlacksmithCarpenterComponentOption,
  consumedAtIso: string,
): BlacksmithUsedCarpenterComponentSnapshot {
  return {
    componentItemId: component.itemId,
    componentInstanceId: component.instanceId,
    componentKind: component.snapshot.componentKind,
    templateId: component.snapshot.templateId,
    templateName: component.snapshot.templateName,
    qualityScore: component.snapshot.qualityScore,
    traitRetentionPercent: component.snapshot.traitRetentionPercent,
    inheritedTraitTags: component.snapshot.inheritedTraitTags,
    inheritedWoodProfile: component.snapshot.inheritedWoodProfile,
    inheritedEffects: component.snapshot.inheritedEffects,
    sourceTreeId: component.snapshot.sourceTreeId,
    sourceTreeName: component.snapshot.sourceTreeName,
    sourceTreeRarity: component.snapshot.sourceTreeRarity,
    sourceTreeTier: component.snapshot.sourceTreeTier,
    sourceWoodItemIds: component.snapshot.sourceWoodItemIds,
    sourceWoodMaterialIds: component.snapshot.sourceWoodMaterialIds,
    sourceLost: component.snapshot.sourceLost,
    sourceLostReason: component.snapshot.sourceLostReason,
    componentCreatedAtIso: component.snapshot.createdAtIso,
    consumedAtIso,
  };
}

export function deriveCarpenterComponentForgeContribution(params: {
  template: BlacksmithItemTemplate | null;
  component: BlacksmithCarpenterComponentOption | null;
  nowIso?: string;
}): BlacksmithCarpenterForgeContribution | null {
  const { template, component, nowIso } = params;
  const validation = validateCarpenterComponentForTemplate(template, component);
  if (!component || !validation.ok) {
    return null;
  }
  const consumedAtIso = nowIso ?? new Date().toISOString();
  const snapshot = buildUsedCarpenterComponentSnapshot(component, consumedAtIso);
  const sourceLine = snapshot.sourceLost
    ? `Источник древесины утрачен (${snapshot.sourceLostReason ?? 'generic_source'}).`
    : snapshot.sourceTreeName
      ? `Источник: ${snapshot.sourceTreeName}${snapshot.sourceTreeRarity ? ` (${snapshot.sourceTreeRarity})` : ''}.`
      : snapshot.sourceTreeId
        ? `Источник дерева: ${snapshot.sourceTreeId}.`
        : 'Источник древесины не указан.';
  return {
    descriptionLines: [
      `Использован компонент плотника: ${component.itemName} (${formatComponentKind(snapshot.componentKind)}).`,
      `Качество компонента: ${snapshot.qualityScore}, удержание свойств: ${snapshot.traitRetentionPercent}%.`,
      sourceLine,
    ],
    previewMetadata: [
      `Компонент: ${component.itemName}`,
      `Тип компонента: ${formatComponentKind(snapshot.componentKind)}`,
      `Источник потерян: ${snapshot.sourceLost ? 'да' : 'нет'}`,
    ],
    tags: [
      'carpenter_component_used',
      `carpenter_component_kind:${snapshot.componentKind}`,
      snapshot.sourceLost ? 'carpenter_component_source_lost' : 'carpenter_component_source_known',
    ],
    carpenterComponentsUsed: [snapshot],
    selectedComponentItemId: component.itemId,
    selectedComponentInstanceId: component.instanceId,
  };
}

export function applyCarpenterContributionToForgedItem(
  item: Omit<AdminItem, 'createdAt' | 'updatedAt'>,
  contribution: BlacksmithCarpenterForgeContribution | null,
): Omit<AdminItem, 'createdAt' | 'updatedAt'> {
  if (!contribution) {
    return item;
  }
  const gameplayDescription = [item.gameplayDescription, ...contribution.descriptionLines].filter(Boolean).join(' ');
  return {
    ...item,
    gameplayDescription,
    tags: Array.from(new Set([...(item.tags ?? []), ...contribution.tags])),
  };
}

import type {
  EquipmentVisualBindingDefinition,
  SpriteBodyTemplateDefinition,
  SpriteProfileDefinition,
  SpriteSurface,
} from '@theend/rpg-domain';

export interface ResolveEquipmentBindingParams {
  bindings: EquipmentVisualBindingDefinition[];
  itemId: string;
  bodyTemplateId?: string | null;
  raceId?: string | null;
  bodyType?: string | null;
  surface: SpriteSurface;
}

function scoreBinding(params: ResolveEquipmentBindingParams, binding: EquipmentVisualBindingDefinition): number {
  let score = 0;
  if (binding.itemId !== params.itemId) {
    return -1;
  }
  if (binding.compatibleSurfaces.length > 0 && !binding.compatibleSurfaces.includes(params.surface)) {
    return -1;
  }
  if (params.bodyTemplateId && binding.compatibleBodyTemplateIds.includes(params.bodyTemplateId)) {
    score += 8;
  } else if (binding.compatibleBodyTemplateIds.length > 0 && params.bodyTemplateId) {
    score -= 4;
  }
  if (params.raceId && binding.compatibleRaceIds.includes(params.raceId)) {
    score += 4;
  } else if (binding.compatibleRaceIds.length > 0 && params.raceId) {
    score -= 2;
  }
  if (params.bodyType && binding.compatibleBodyTypes.includes(params.bodyType)) {
    score += 3;
  } else if (binding.compatibleBodyTypes.length > 0 && params.bodyType) {
    score -= 2;
  }
  if (binding.defaultForItem) {
    score += 1;
  }
  return score;
}

export function resolveBestEquipmentVisualBinding(params: ResolveEquipmentBindingParams): EquipmentVisualBindingDefinition | null {
  const ranked = params.bindings
    .map((binding) => ({ binding, score: scoreBinding(params, binding) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.binding.id.localeCompare(right.binding.id));
  return ranked[0]?.binding ?? null;
}

export function resolveProfileBodyTemplate(
  profile: SpriteProfileDefinition | null | undefined,
  templates: SpriteBodyTemplateDefinition[],
): SpriteBodyTemplateDefinition | null {
  if (!profile?.bodyTemplateId) {
    return null;
  }
  return templates.find((template) => template.id === profile.bodyTemplateId) ?? null;
}

export function listProfileBindings(params: {
  profile: SpriteProfileDefinition | null | undefined;
  templates: SpriteBodyTemplateDefinition[];
  bindings: EquipmentVisualBindingDefinition[];
  raceId?: string | null;
  surface: SpriteSurface;
}): EquipmentVisualBindingDefinition[] {
  const template = resolveProfileBodyTemplate(params.profile, params.templates);
  const bodyType = template?.bodyType ?? null;
  return (params.profile?.defaultEquipmentItemIds ?? [])
    .map((itemId) => resolveBestEquipmentVisualBinding({
      bindings: params.bindings,
      itemId,
      bodyTemplateId: template?.id ?? null,
      bodyType,
      raceId: params.raceId ?? null,
      surface: params.surface,
    }))
    .filter((entry): entry is EquipmentVisualBindingDefinition => Boolean(entry));
}


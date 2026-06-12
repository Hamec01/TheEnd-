import type { LocationArea, WorldLocation } from '../types/location';
import { createContentEntry, deleteContentEntry, getContentCollection, getContentEntry, updateContentEntry } from './content/contentApi';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeStringList(value: string[] | undefined): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean) : [];
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function normalizeArea(area: LocationArea): LocationArea {
  return {
    ...area,
    id: String(area.id ?? '').trim(),
    name: String(area.name ?? '').trim(),
    type: normalizeOptionalString(area.type),
    description: normalizeOptionalString(area.description),
    imageId: normalizeOptionalString(area.imageId),
    imagePath: normalizeOptionalString(area.imagePath),
    shapeType: area.shapeType ?? 'none',
    shape: area.shape
      ? {
          x: typeof area.shape.x === 'number' ? area.shape.x : undefined,
          y: typeof area.shape.y === 'number' ? area.shape.y : undefined,
          radius: typeof area.shape.radius === 'number' ? area.shape.radius : undefined,
          width: typeof area.shape.width === 'number' ? area.shape.width : undefined,
          height: typeof area.shape.height === 'number' ? area.shape.height : undefined,
          points: Array.isArray(area.shape.points)
            ? area.shape.points
              .filter((point) => point && typeof point === 'object')
              .map((point) => ({
                x: typeof point.x === 'number' ? point.x : 0,
                y: typeof point.y === 'number' ? point.y : 0,
              }))
            : undefined,
        }
      : undefined,
    npcIds: normalizeStringList(area.npcIds),
    merchantIds: normalizeStringList(area.merchantIds),
    questIds: normalizeStringList(area.questIds),
    dialogueIds: normalizeStringList(area.dialogueIds),
    battleMapIds: normalizeStringList(area.battleMapIds),
    visibleInStates: normalizeStringList(area.visibleInStates),
    hiddenUntilQuestId: normalizeOptionalString(area.hiddenUntilQuestId),
    hiddenAfterQuestId: normalizeOptionalString(area.hiddenAfterQuestId),
    canEnter: area.canEnter !== false,
    isHidden: area.isHidden === true,
    tags: normalizeStringList(area.tags),
  };
}

function normalizeLocation(location: WorldLocation): WorldLocation {
  return {
    ...structuredClone(location),
    id: String(location.id ?? '').trim(),
    name: String(location.name ?? '').trim(),
    slug: normalizeOptionalString(location.slug),
    type: 'location',
    subtype: normalizeOptionalString(typeof location.subtype === 'string' ? location.subtype : undefined),
    status: location.status ?? 'draft',
    description: normalizeOptionalString(location.description),
    shortDescription: normalizeOptionalString(location.shortDescription),
    regionId: normalizeOptionalString(location.regionId),
    parentLocationId: normalizeOptionalString(location.parentLocationId),
    kingdomId: normalizeOptionalString(location.kingdomId),
    factionId: normalizeOptionalString(location.factionId),
    clanId: normalizeOptionalString(location.clanId),
    tribeId: normalizeOptionalString(location.tribeId),
    discoveryQuestId: normalizeOptionalString(location.discoveryQuestId),
    defaultImageId: normalizeOptionalString(location.defaultImageId),
    defaultImagePath: normalizeOptionalString(location.defaultImagePath),
    currentState: normalizeOptionalString(location.currentState),
    stateVariants: Array.isArray(location.stateVariants)
      ? location.stateVariants.map((variant) => ({
          ...variant,
          stateKey: String(variant.stateKey ?? '').trim(),
          name: String(variant.name ?? '').trim(),
          descriptionOverride: normalizeOptionalString(variant.descriptionOverride),
          imageId: normalizeOptionalString(variant.imageId),
          imagePath: normalizeOptionalString(variant.imagePath),
          ownerFactionId: normalizeOptionalString(variant.ownerFactionId),
          npcIds: normalizeStringList(variant.npcIds),
          merchantIds: normalizeStringList(variant.merchantIds),
          questIds: normalizeStringList(variant.questIds),
          dialogueIds: normalizeStringList(variant.dialogueIds),
          battleMapIds: normalizeStringList(variant.battleMapIds),
          tags: normalizeStringList(variant.tags),
        })).filter((variant) => variant.stateKey && variant.name)
      : [],
    npcIds: normalizeStringList(location.npcIds),
    merchantIds: normalizeStringList(location.merchantIds),
    questIds: normalizeStringList(location.questIds),
    dialogueIds: normalizeStringList(location.dialogueIds),
    battleMapIds: normalizeStringList(location.battleMapIds),
    workshopIds: normalizeStringList(location.workshopIds),
    services: normalizeStringList(location.services),
    areas: Array.isArray(location.areas)
      ? location.areas.map(normalizeArea).filter((area) => area.id && area.name)
      : [],
    entryRequirements: location.entryRequirements
      ? {
          minLevel: typeof location.entryRequirements.minLevel === 'number' ? Math.max(0, Math.round(location.entryRequirements.minLevel)) : undefined,
          requiredQuestId: normalizeOptionalString(location.entryRequirements.requiredQuestId),
          requiredCompletedQuestId: normalizeOptionalString(location.entryRequirements.requiredCompletedQuestId),
          requiredItemIds: normalizeStringList(location.entryRequirements.requiredItemIds),
          requiredFactionId: normalizeOptionalString(location.entryRequirements.requiredFactionId),
          requiredFactionReputation: typeof location.entryRequirements.requiredFactionReputation === 'number'
            ? location.entryRequirements.requiredFactionReputation
            : undefined,
          requiredRace: normalizeStringList(location.entryRequirements.requiredRace),
          requiredClass: normalizeStringList(location.entryRequirements.requiredClass),
          requiredProfession: normalizeStringList(location.entryRequirements.requiredProfession),
          requiredFlag: normalizeOptionalString(location.entryRequirements.requiredFlag),
        }
      : undefined,
    locationEffects: Array.isArray(location.locationEffects)
      ? location.locationEffects
        .map((effect) => ({
          ...effect,
          type: String(effect.type ?? '').trim(),
          stat: normalizeOptionalString(effect.stat),
          element: normalizeOptionalString(effect.element),
          description: normalizeOptionalString(effect.description),
          value: typeof effect.value === 'number' ? effect.value : undefined,
        }))
        .filter((effect) => effect.type)
      : [],
    tags: normalizeStringList(location.tags),
    published: location.published === true,
    hidden: location.hidden === true,
    createdAt: location.createdAt || nowIso(),
    updatedAt: location.updatedAt || nowIso(),
  };
}

export const locationService = {
  async getLocations(): Promise<WorldLocation[]> {
    return (await getContentCollection<WorldLocation>('locations')).map(normalizeLocation);
  },

  async getLocationById(id: string): Promise<WorldLocation | null> {
    const normalizedId = String(id ?? '').trim();
    if (!normalizedId) {
      return null;
    }
    const found = await getContentEntry<WorldLocation>('locations', normalizedId);
    return found ? normalizeLocation(found) : null;
  },

  async createLocation(location: WorldLocation): Promise<WorldLocation> {
    const normalized = normalizeLocation(location);
    return createContentEntry<WorldLocation>('locations', normalized);
  },

  async updateLocation(location: WorldLocation): Promise<WorldLocation> {
    const normalized = normalizeLocation(location);
    return updateContentEntry<WorldLocation>('locations', normalized.id, normalized);
  },

  async deleteLocation(id: string): Promise<void> {
    await deleteContentEntry('locations', String(id ?? '').trim());
  },

  async duplicateLocation(id: string): Promise<WorldLocation> {
    const source = await this.getLocationById(id);
    if (!source) {
      throw new Error(`Location not found: ${id}`);
    }

    const all = await this.getLocations();
    let nextId = `${source.id}_copy`;
    let suffix = 2;
    while (all.some((entry) => entry.id === nextId)) {
      nextId = `${source.id}_copy_${suffix}`;
      suffix += 1;
    }

    const copy = normalizeLocation({
      ...source,
      id: nextId,
      name: `${source.name} Copy`,
      slug: source.slug ? `${source.slug}-copy` : undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    return createContentEntry<WorldLocation>('locations', copy);
  },
};

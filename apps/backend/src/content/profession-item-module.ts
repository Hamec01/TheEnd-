import type { AdminItem, ProfessionItemKind, ProfessionItemStats } from './content.types';

function normalizedText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizedNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function normalizedStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((entry) => normalizedText(entry))
    .filter((entry): entry is string => Boolean(entry));
  return items.length > 0 ? Array.from(new Set(items)) : undefined;
}

function isLegacyProfessionType(item: AdminItem): boolean {
  return item.type === 'profession_tool' || item.type === 'profession_transport';
}

export function getProfessionItemKind(item: AdminItem | null | undefined): ProfessionItemKind | undefined {
  if (!item) {
    return undefined;
  }
  if (item.type === 'profession_tool') {
    return 'tool';
  }
  if (item.type === 'profession_transport') {
    return 'transport';
  }
  if (item.professionItemKind) {
    return item.professionItemKind;
  }
  return undefined;
}

export function getProfessionId(item: AdminItem | null | undefined): string | undefined {
  if (!item) {
    return undefined;
  }
  return normalizedText(item.professionId) ?? normalizedText(item.profession);
}

export function isProfessionItem(item: AdminItem | null | undefined): boolean {
  if (!item) {
    return false;
  }
  if (item.professionItem === true) {
    return true;
  }
  return Boolean(getProfessionId(item) && (getProfessionItemKind(item) || isLegacyProfessionType(item)));
}

export function getProfessionStats(item: AdminItem | null | undefined): ProfessionItemStats {
  if (!item) {
    return {};
  }
  const base = (item.professionStats ?? {}) as ProfessionItemStats;
  return {
    toolKind: normalizedText(base.toolKind) ?? normalizedText(item.toolKind),
    transportKind: normalizedText(base.transportKind) ?? normalizedText(item.transportKind),
    stationKind: normalizedText(base.stationKind),
    tier: normalizedNumber(base.tier) ?? normalizedNumber(item.tier),
    requiredProfessionLevel: normalizedNumber(base.requiredProfessionLevel) ?? normalizedNumber(item.requiredLevel),
    durability: normalizedNumber(base.durability) ?? normalizedNumber(item.durability),
    maxDurability: normalizedNumber(base.maxDurability) ?? normalizedNumber(item.maxDurability),
    efficiency: normalizedNumber(base.efficiency) ?? normalizedNumber(item.efficiency),
    breakChanceModifier: normalizedNumber(base.breakChanceModifier) ?? normalizedNumber(item.breakChanceModifier),
    staminaCostModifier: normalizedNumber(base.staminaCostModifier) ?? normalizedNumber(item.staminaCostModifier),
    capacityLogs: normalizedNumber(base.capacityLogs) ?? normalizedNumber(item.capacityLogs),
    capacityWeight: normalizedNumber(base.capacityWeight) ?? normalizedNumber(item.capacityWeight),
    speedModifier: normalizedNumber(base.speedModifier) ?? normalizedNumber(item.speed),
    rentPrice: normalizedNumber(base.rentPrice) ?? normalizedNumber(item.rentPrice),
    rentalDurationHours: normalizedNumber(base.rentalDurationHours) ?? normalizedNumber(item.rentDuration),
    requiresHorse: typeof base.requiresHorse === 'boolean'
      ? base.requiresHorse
      : (typeof item.requiresHorse === 'boolean' ? item.requiresHorse : undefined),
    allowedActions: normalizedStringArray(base.allowedActions),
    supportedResourceKinds: normalizedStringArray(base.supportedResourceKinds),
  };
}

export function getToolKind(item: AdminItem | null | undefined): string | undefined {
  return getProfessionStats(item).toolKind;
}

export function getTransportKind(item: AdminItem | null | undefined): string | undefined {
  return getProfessionStats(item).transportKind;
}

export function getDurability(item: AdminItem | null | undefined): number | undefined {
  return getProfessionStats(item).durability;
}

export function getMaxDurability(item: AdminItem | null | undefined): number | undefined {
  return getProfessionStats(item).maxDurability;
}

export function normalizeProfessionItem(item: AdminItem): AdminItem {
  const kind = getProfessionItemKind(item);
  const professionId = getProfessionId(item);
  if (!kind && !professionId && item.professionItem !== true && !item.professionStats) {
    return item;
  }
  return {
    ...item,
    professionItem: item.professionItem === true || Boolean(kind && professionId),
    professionId: professionId ?? item.professionId,
    professionItemKind: kind ?? item.professionItemKind,
    professionStats: getProfessionStats(item),
  };
}

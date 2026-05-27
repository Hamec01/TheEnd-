import type { City } from '../../types/city';
import type { WorldLocation } from '../../types/location';
import type { NpcDefinition } from '../../types/npc';
import type { WorldMapZone } from '../../worldmap/zoneEditorTypes';

export type GroupingKey = 'place' | 'city' | 'location' | 'kingdom' | 'faction' | 'kind' | 'none';

export interface NpcGroupNode {
  id: string;
  label: string;
  npcs: NpcDefinition[];
  children?: NpcGroupNode[];
}

export interface NpcGroupingContext {
  cities: City[];
  locations: WorldLocation[];
  zones: WorldMapZone[];
}

export interface NpcResolvedPlaceInfo {
  label: string;
  kind: 'world_location' | 'city_location' | 'city' | 'zone_location' | 'unbound';
  category: 'city' | 'village' | 'academy' | 'magic_school' | 'camp' | 'mine' | 'mine_entrance' | 'ruins' | 'temple' | 'outpost' | 'cave' | 'sanctuary' | 'farmstead' | 'custom_location' | 'city_inner_location' | 'unbound';
  locationName?: string;
  cityName?: string;
  kingdomName?: string;
  regionName?: string;
  zoneName?: string;
  zoneSubtype?: string;
}

export interface NpcCardSummary {
  titleLine: string;
  metaLine: string;
  placeLine?: string;
  tooltip: string;
}

const UNBOUND_LABEL = 'Без привязки';

const LOCATION_SUBTYPE_LABELS: Record<string, string> = {
  village: 'Деревня',
  academy: 'Академия',
  magic_school: 'Магическая школа',
  camp: 'Лагерь',
  mine: 'Шахта',
  mine_entrance: 'Вход в шахту',
  ruins: 'Руины',
  temple: 'Храм',
  outpost: 'Форпост',
  cave: 'Пещера',
  sanctuary: 'Святилище',
  farmstead: 'Ферма',
  city: 'Город',
  custom: 'Локация',
};

function formatLabel(value: string | undefined | null): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

function startsWithIgnoreCase(value: string, prefix: string): boolean {
  return value.toLocaleLowerCase('ru').startsWith(prefix.toLocaleLowerCase('ru'));
}

function formatLocationDisplayName(name: string, subtype?: string | null): string {
  const normalizedName = normalizeText(name);
  if (!normalizedName) {
    return UNBOUND_LABEL;
  }

  const normalizedSubtype = normalizeText(subtype);
  const subtypeLabel = LOCATION_SUBTYPE_LABELS[normalizedSubtype] ?? (normalizedSubtype ? formatLabel(normalizedSubtype) : 'Локация');
  if (!subtypeLabel) {
    return normalizedName;
  }
  if (startsWithIgnoreCase(normalizedName, subtypeLabel)) {
    return normalizedName;
  }
  return `${subtypeLabel} ${normalizedName}`;
}

function buildCityLocationLabel(cityName: string, locationName: string): string {
  const safeLocationName = normalizeText(locationName) || 'Место в городе';
  const safeCityName = normalizeText(cityName);
  return safeCityName ? `${safeLocationName}, ${safeCityName}` : safeLocationName;
}

function stripTrailingCitySuffix(label: string, cityName: string): string {
  const normalizedLabel = normalizeText(label);
  const normalizedCityName = normalizeText(cityName);
  if (!normalizedLabel || !normalizedCityName) {
    return normalizedLabel;
  }

  const suffixPatterns = [
    `, ${normalizedCityName}`,
    ` ${normalizedCityName}`,
  ];

  for (const suffix of suffixPatterns) {
    if (normalizedLabel.toLocaleLowerCase('ru').endsWith(suffix.toLocaleLowerCase('ru'))) {
      return normalizedLabel.slice(0, normalizedLabel.length - suffix.length).trim();
    }
  }

  const ofCityPattern = new RegExp(`\\s+${normalizedCityName}$`, 'i');
  return normalizedLabel.replace(ofCityPattern, '').trim() || normalizedLabel;
}

function compactNestedPlaceLabel(placeLabel: string, cityName: string): string {
  const normalizedLabel = stripTrailingCitySuffix(placeLabel, cityName);
  return normalizedLabel || placeLabel;
}

function buildGroupId(...parts: Array<string | undefined>): string {
  return parts.map((part) => normalizeText(part)).filter(Boolean).join('::');
}

function toPlaceCategory(value: string | undefined | null): NpcResolvedPlaceInfo['category'] {
  switch (normalizeText(value)) {
    case 'city':
      return 'city';
    case 'village':
      return 'village';
    case 'academy':
      return 'academy';
    case 'magic_school':
      return 'magic_school';
    case 'camp':
      return 'camp';
    case 'mine':
      return 'mine';
    case 'mine_entrance':
      return 'mine_entrance';
    case 'ruins':
      return 'ruins';
    case 'temple':
      return 'temple';
    case 'outpost':
      return 'outpost';
    case 'cave':
      return 'cave';
    case 'sanctuary':
      return 'sanctuary';
    case 'farmstead':
      return 'farmstead';
    default:
      return 'custom_location';
  }
}

function findCityByAnyId(cities: City[], cityId: string | undefined): City | null {
  const normalizedCityId = normalizeText(cityId);
  if (!normalizedCityId) {
    return null;
  }
  return cities.find((city) => city.id === normalizedCityId) ?? null;
}

function findLocationById(locations: WorldLocation[], locationId: string | undefined): WorldLocation | null {
  const normalizedLocationId = normalizeText(locationId);
  if (!normalizedLocationId) {
    return null;
  }
  return locations.find((location) => location.id === normalizedLocationId) ?? null;
}

function findZoneById(zones: WorldMapZone[], zoneId: string | undefined): WorldMapZone | null {
  const normalizedZoneId = normalizeText(zoneId);
  if (!normalizedZoneId) {
    return null;
  }
  return zones.find((zone) => zone.id === normalizedZoneId) ?? null;
}

export function resolveNpcPlaceInfo(npc: NpcDefinition, context: NpcGroupingContext): NpcResolvedPlaceInfo {
  const locationById = findLocationById(context.locations, npc.locationId);
  if (locationById) {
    return {
      label: formatLocationDisplayName(locationById.name, locationById.subtype),
      kind: 'world_location',
      category: toPlaceCategory(locationById.subtype),
      locationName: locationById.name,
      kingdomName: normalizeText(locationById.kingdomId) || undefined,
      regionName: normalizeText(locationById.regionId) || undefined,
    };
  }

  const currentCity = findCityByAnyId(context.cities, npc.currentCityId);
  if (currentCity && normalizeText(npc.cityLocationId)) {
    const cityLocation = currentCity.locations.find((location) => location.id === normalizeText(npc.cityLocationId)) ?? null;
    if (cityLocation) {
      return {
        label: buildCityLocationLabel(currentCity.name, cityLocation.name),
        kind: 'city_location',
        category: 'city_inner_location',
        cityName: currentCity.name,
        locationName: cityLocation.name,
        kingdomName: normalizeText(currentCity.kingdomId) || undefined,
        regionName: normalizeText(currentCity.regionId) || undefined,
      };
    }
  }

  const city = findCityByAnyId(context.cities, npc.currentCityId)
    ?? findCityByAnyId(context.cities, npc.cityId)
    ?? findCityByAnyId(context.cities, npc.homeCityId);
  if (city) {
    return {
      label: city.name,
      kind: 'city',
      category: 'city',
      cityName: city.name,
      kingdomName: normalizeText(city.kingdomId) || undefined,
      regionName: normalizeText(city.regionId) || undefined,
    };
  }

  const primaryZone = npc.mapBindings[0] ?? null;
  const zone = findZoneById(context.zones, primaryZone?.zoneId);
  if (zone) {
    const linkedLocation = findLocationById(context.locations, zone.linkedLocationId ?? zone.linkedLocation ?? zone.id);
    if (linkedLocation) {
      return {
        label: formatLocationDisplayName(linkedLocation.name, linkedLocation.subtype ?? zone.subtype),
        kind: 'zone_location',
        category: toPlaceCategory(linkedLocation.subtype ?? zone.subtype),
        locationName: linkedLocation.name,
        zoneName: zone.name,
        zoneSubtype: normalizeText(zone.subtype) || undefined,
        kingdomName: normalizeText(linkedLocation.kingdomId) || normalizeText(zone.kingdomId) || undefined,
        regionName: normalizeText(linkedLocation.regionId) || normalizeText(zone.region) || undefined,
      };
    }

    if (zone.type === 'city') {
      return {
        label: zone.name,
        kind: 'zone_location',
        category: 'city',
        cityName: zone.name,
        zoneName: zone.name,
        zoneSubtype: normalizeText(zone.subtype) || undefined,
        kingdomName: normalizeText(zone.kingdomId) || undefined,
        regionName: normalizeText(zone.region) || undefined,
      };
    }

    return {
      label: formatLocationDisplayName(zone.name, zone.subtype),
      kind: 'zone_location',
      category: toPlaceCategory(zone.subtype),
      locationName: zone.name,
      zoneName: zone.name,
      zoneSubtype: normalizeText(zone.subtype) || undefined,
      kingdomName: normalizeText(zone.kingdomId) || undefined,
      regionName: normalizeText(zone.region) || undefined,
    };
  }

  return {
    label: UNBOUND_LABEL,
    kind: 'unbound',
    category: 'unbound',
  };
}

function sortNpcs(npcs: NpcDefinition[]): NpcDefinition[] {
  return [...npcs].sort((left, right) => (left.name || left.id).localeCompare(right.name || right.id, 'ru', { sensitivity: 'base' }));
}

function sortGroupNodes(groups: NpcGroupNode[]): NpcGroupNode[] {
  return [...groups]
    .map((group) => ({
      ...group,
      npcs: sortNpcs(group.npcs),
      children: group.children ? sortGroupNodes(group.children) : undefined,
    }))
    .sort((left, right) => {
      if (left.label === 'Все NPC') {
        return -1;
      }
      if (right.label === 'Все NPC') {
        return 1;
      }
      if (left.label === UNBOUND_LABEL) {
        return 1;
      }
      if (right.label === UNBOUND_LABEL) {
        return -1;
      }
      return left.label.localeCompare(right.label, 'ru', { sensitivity: 'base' });
    });
}

function getOrCreateGroup(map: Map<string, NpcGroupNode>, id: string, label: string): NpcGroupNode {
  const existing = map.get(id);
  if (existing) {
    return existing;
  }
  const created: NpcGroupNode = { id, label, npcs: [] };
  map.set(id, created);
  return created;
}

function buildPlaceGroups(npcs: NpcDefinition[], context: NpcGroupingContext): NpcGroupNode[] {
  const roots = new Map<string, NpcGroupNode>();

  for (const npc of npcs) {
    const place = resolveNpcPlaceInfo(npc, context);
    const resolvedCityName = place.cityName || (resolveNpcCityLabel(npc, context) !== UNBOUND_LABEL ? resolveNpcCityLabel(npc, context) : undefined);

    if (place.kind === 'city_location' && place.cityName) {
      const parentId = buildGroupId('city', place.cityName);
      const parent = getOrCreateGroup(roots, parentId, place.cityName);
      const childId = buildGroupId(parentId, 'place', place.locationName);
      const children = parent.children ?? [];
      let child = children.find((entry) => entry.id === childId);
      if (!child) {
        child = {
          id: childId,
          label: normalizeText(place.locationName) || 'Место в городе',
          npcs: [],
        };
        parent.children = [...children, child];
      }
      child.npcs.push(npc);
      continue;
    }

    if (resolvedCityName && place.label !== resolvedCityName && place.kind !== 'unbound') {
      const parentId = buildGroupId('city', resolvedCityName);
      const parent = getOrCreateGroup(roots, parentId, resolvedCityName);
      const childLabel = compactNestedPlaceLabel(place.locationName || place.label, resolvedCityName);
      const childId = buildGroupId(parentId, 'place', childLabel || place.label);
      const children = parent.children ?? [];
      let child = children.find((entry) => entry.id === childId);
      if (!child) {
        child = {
          id: childId,
          label: childLabel || place.label,
          npcs: [],
        };
        parent.children = [...children, child];
      }
      child.npcs.push(npc);
      continue;
    }

    if (place.kind === 'city' && place.cityName) {
      const parentId = buildGroupId('city', place.cityName);
      const parent = getOrCreateGroup(roots, parentId, place.cityName);
      parent.npcs.push(npc);
      continue;
    }

    const rootId = buildGroupId('place', place.label);
    const root = getOrCreateGroup(roots, rootId, place.label);
    root.npcs.push(npc);
  }

  return sortGroupNodes(Array.from(roots.values()));
}

function resolveNpcKingdomLabel(npc: NpcDefinition, context: NpcGroupingContext): string {
  const directKingdom = normalizeText(npc.kingdomId);
  if (directKingdom) {
    return `Королевство: ${directKingdom}`;
  }
  const place = resolveNpcPlaceInfo(npc, context);
  return place.kingdomName ? `Королевство: ${place.kingdomName}` : 'Без королевства';
}

function resolveNpcFactionLabel(npc: NpcDefinition): string {
  return npc.factionId ? `Фракция: ${npc.factionId}` : 'Без фракции';
}

function resolveNpcCityLabel(npc: NpcDefinition, context: NpcGroupingContext): string {
  const city = findCityByAnyId(context.cities, npc.currentCityId)
    ?? findCityByAnyId(context.cities, npc.cityId)
    ?? findCityByAnyId(context.cities, npc.homeCityId);
  return city ? city.name : UNBOUND_LABEL;
}

function resolveNpcLocationLabel(npc: NpcDefinition, context: NpcGroupingContext): string {
  const place = resolveNpcPlaceInfo(npc, context);
  if (place.kind === 'world_location' || place.kind === 'zone_location' || place.kind === 'city_location') {
    return place.label;
  }
  return UNBOUND_LABEL;
}

function resolveNpcTypeLabel(npc: NpcDefinition): string {
  return `Тип NPC: ${formatLabel(npc.kind)}`;
}

export function groupNpcsByKey(npcs: NpcDefinition[], key: GroupingKey, context: NpcGroupingContext): NpcGroupNode[] {
  if (key === 'place') {
    return buildPlaceGroups(npcs, context);
  }

  const grouped = new Map<string, NpcGroupNode>();

  for (const npc of npcs) {
    let groupName = UNBOUND_LABEL;

    switch (key) {
      case 'city':
        groupName = resolveNpcCityLabel(npc, context);
        break;
      case 'location':
        groupName = resolveNpcLocationLabel(npc, context);
        break;
      case 'kingdom':
        groupName = resolveNpcKingdomLabel(npc, context);
        break;
      case 'faction':
        groupName = resolveNpcFactionLabel(npc);
        break;
      case 'kind':
        groupName = resolveNpcTypeLabel(npc);
        break;
      case 'none':
        groupName = 'Все NPC';
        break;
    }

    const groupId = buildGroupId(key, groupName);
    const group = getOrCreateGroup(grouped, groupId, groupName);
    group.npcs.push(npc);
  }

  return sortGroupNodes(Array.from(grouped.values()));
}

export function getGroupingLabel(key: GroupingKey): string {
  const labels: Record<GroupingKey, string> = {
    place: 'По месту',
    city: 'По городу',
    location: 'По локации',
    kingdom: 'По королевству',
    faction: 'По фракции',
    kind: 'По типу NPC',
    none: 'Без группировки',
  };
  return labels[key];
}

export function buildNpcCardSummary(npc: NpcDefinition, context: NpcGroupingContext): NpcCardSummary {
  const place = resolveNpcPlaceInfo(npc, context);
  const metaParts = [normalizeText(npc.title), formatLabel(npc.kind), formatLabel(npc.race)].filter(Boolean);
  return {
    titleLine: normalizeText(npc.name) || '(без названия)',
    metaLine: metaParts.join(' • ') || 'NPC',
    placeLine: place.kind !== 'unbound' ? place.label : undefined,
    tooltip: `${normalizeText(npc.name) || '(без названия)'}\nID: ${npc.id}${place.label ? `\nМесто: ${place.label}` : ''}`,
  };
}

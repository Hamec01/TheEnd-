import { getWorldMapContent } from './content/contentApi';
import { validateEditorDataJson } from '../worldmap/zoneEditorStorage';
import { WORLD_MAP_ZONES } from '../worldmap/worldMapNodes';
import type { ZoneType, WorldMapZone } from '../worldmap/zoneEditorTypes';
import { normalizeWorldMapZone } from '../worldmap/zoneTaxonomy';

let zonesCache: WorldMapZone[] | null = null;

function cloneZone(zone: WorldMapZone): WorldMapZone {
  return {
    ...zone,
    points: zone.points ? zone.points.map((point) => [...point] as [number, number]) : undefined,
    randomQuestPoolIds: zone.randomQuestPoolIds ? [...zone.randomQuestPoolIds] : undefined,
  };
}

function cloneZones(zones: WorldMapZone[]): WorldMapZone[] {
  return zones.map(cloneZone);
}

function sortZones(zones: WorldMapZone[]): WorldMapZone[] {
  return [...zones].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
    if (nameOrder !== 0) {
      return nameOrder;
    }
    return left.id.localeCompare(right.id, 'ru', { sensitivity: 'base' });
  });
}

function normalizeZones(zones: WorldMapZone[]): WorldMapZone[] {
  const seen = new Set<string>();
  const result: WorldMapZone[] = [];

  for (const zone of zones) {
    if (!zone?.id?.trim()) {
      continue;
    }

    const rawId = zone.id.trim();
    const id = zone.type === 'city' && rawId === 'arklein' ? 'city_arklein' : rawId;
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(cloneZone(normalizeWorldMapZone({ ...zone, id })));
  }

  return sortZones(result);
}

function getFallbackZones(): WorldMapZone[] {
  return cloneZones(WORLD_MAP_ZONES);
}

function writeCachedZones(zones: WorldMapZone[]): WorldMapZone[] {
  const normalized = normalizeZones(zones);
  zonesCache = normalized;
  return normalized;
}

export function getAllZones(): WorldMapZone[] {
  return cloneZones(zonesCache ?? getFallbackZones());
}

export function getZoneById(id: string | undefined | null): WorldMapZone | null {
  if (!id?.trim()) {
    return null;
  }

  const zoneId = id.trim();
  return getAllZones().find((zone) => zone.id === zoneId) ?? null;
}

export function getZonesByType(type: ZoneType): WorldMapZone[] {
  return getAllZones().filter((zone) => zone.type === type);
}

export function getCityZones(): WorldMapZone[] {
  return getZonesByType('city');
}

export function replaceAllZones(zones: WorldMapZone[]): WorldMapZone[] {
  return cloneZones(writeCachedZones(zones));
}

export function saveZone(zone: WorldMapZone): WorldMapZone {
  const zones = getAllZones();
  const nextZones = [...zones.filter((entry) => entry.id !== zone.id), zone];
  return cloneZone(writeCachedZones(nextZones).find((entry) => entry.id === zone.id) ?? zone);
}

export function deleteZone(id: string): void {
  writeCachedZones(getAllZones().filter((zone) => zone.id !== id));
}

export function exportZonesJson(): string {
  return JSON.stringify(getAllZones(), null, 2);
}

export function importZonesJson(json: string): WorldMapZone[] {
  const result = validateEditorDataJson(json);
  if (!result.valid) {
    throw new Error(result.errors.join(', '));
  }

  return replaceAllZones(result.zones);
}

export async function refreshZonesFromBackend(): Promise<WorldMapZone[]> {
  try {
    const remote = await getWorldMapContent();
    if (remote.zones.length > 0) {
      return replaceAllZones(remote.zones);
    }
  } catch {
    return getAllZones();
  }

  return replaceAllZones(getFallbackZones());
}

export function buildWorldZoneLabel(zone: WorldMapZone): string {
  return `${zone.name} (${zone.id}) [${zone.type}]`;
}

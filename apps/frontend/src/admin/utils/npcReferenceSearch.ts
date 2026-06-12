import type { City, CityLocation } from "../../types/city";
import type { WorldLocation } from "../../types/location";
import type { NpcDefinition } from "../../types/npc";
import type { WorldMapZone } from "../../worldmap/zoneEditorTypes";
import { buildNpcCardSummary, resolveNpcPlaceInfo, type NpcGroupingContext } from "./npcGrouping";

export interface NpcReferenceContext {
  cityId?: string | null;
  cityLocationId?: string | null;
  worldLocationId?: string | null;
  zoneId?: string | null;
  markerId?: string | null;
  professionId?: string | null;
  workshopId?: string | null;
}

export interface RankedNpcReference {
  npc: NpcDefinition;
  score: number;
  summary: ReturnType<typeof buildNpcCardSummary>;
  detailLine: string;
}

export interface NpcReferenceSources extends NpcGroupingContext {}

const PROFESSION_KEYWORDS: Record<string, string[]> = {
  carpenter: ["carpenter", "плотник", "столяр", "wood", "дерев"],
  blacksmith: ["blacksmith", "smith", "кузнец", "forge", "ковк"],
  alchemy: ["alchemy", "alchemist", "алхим"],
  runecrafting: ["rune", "runecraft", "рун"],
  enchanting: ["enchant", "чара", "зачар"],
  leatherworking: ["leather", "кож", "шорн"],
  cooking: ["cook", "chef", "повар", "кух"],
  mining: ["miner", "mining", "шахт", "рудокоп"],
};

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function normalizeLower(value: string | null | undefined): string {
  return normalize(value).toLocaleLowerCase("ru");
}

function includesWorkshopId(location: WorldLocation, workshopId: string): boolean {
  return (location.workshopIds ?? []).some((entry) => normalize(entry) === workshopId);
}

function includesWorkshopIdInCityLocation(location: CityLocation, workshopId: string): boolean {
  return Array.isArray((location as CityLocation & { workshopIds?: string[] }).workshopIds)
    && ((location as CityLocation & { workshopIds?: string[] }).workshopIds ?? []).some((entry) => normalize(entry) === workshopId);
}

function scoreNpcAgainstContext(npc: NpcDefinition, context: NpcReferenceContext): number {
  let score = 0;

  const currentCityId = normalize(npc.currentCityId);
  const homeCityId = normalize(npc.homeCityId);
  const cityLocationId = normalize(npc.cityLocationId);
  const locationId = normalize(npc.locationId);
  const allowedCityIds = new Set((npc.allowedCityIds ?? []).map((entry) => normalize(entry)).filter(Boolean));
  const zoneIds = new Set((npc.mapBindings ?? []).map((entry) => normalize(entry.zoneId)).filter(Boolean));
  const markerIds = new Set((npc.mapBindings ?? []).map((entry) => normalize(entry.markerId)).filter(Boolean));

  if (context.cityId && currentCityId === normalize(context.cityId)) score += 500;
  if (context.cityId && homeCityId === normalize(context.cityId)) score += 400;
  if (context.cityId && allowedCityIds.has(normalize(context.cityId))) score += 300;
  if (context.cityLocationId && cityLocationId === normalize(context.cityLocationId)) score += 250;
  if (context.worldLocationId && locationId === normalize(context.worldLocationId)) score += 250;
  if (context.zoneId && zoneIds.has(normalize(context.zoneId))) score += 220;
  if (context.markerId && markerIds.has(normalize(context.markerId))) score += 180;

  const professionId = normalizeLower(context.professionId);
  if (professionId) {
    const keywords = PROFESSION_KEYWORDS[professionId] ?? [professionId];
    const haystack = [
      npc.id,
      npc.name,
      npc.title,
      npc.professionTrainer,
      npc.workshopId,
      npc.kind,
      npc.combat?.role,
      ...(npc.services ?? []),
    ].map((entry) => normalizeLower(typeof entry === "string" ? entry : String(entry ?? ""))).join(" ");

    if (normalizeLower(npc.professionTrainer) === professionId) score += 240;
    if (context.workshopId && normalize(npc.workshopId) === normalize(context.workshopId)) score += 220;
    if ((npc.services ?? []).some((entry) => normalizeLower(entry).includes(professionId))) score += 180;
    if (keywords.some((keyword) => haystack.includes(keyword))) score += 120;
  }

  return score;
}

function scoreNpcAgainstQuery(npc: NpcDefinition, query: string): number {
  const normalizedQuery = normalizeLower(query);
  if (!normalizedQuery) {
    return 0;
  }

  const id = normalizeLower(npc.id);
  const name = normalizeLower(npc.name);
  const title = normalizeLower(npc.title);

  let score = 0;
  if (id === normalizedQuery) score += 5000;
  else if (id.startsWith(normalizedQuery)) score += 2500;
  else if (id.includes(normalizedQuery)) score += 1500;

  if (name === normalizedQuery) score += 4500;
  else if (name.startsWith(normalizedQuery)) score += 2200;
  else if (name.includes(normalizedQuery)) score += 1400;

  if (title === normalizedQuery) score += 3200;
  else if (title.startsWith(normalizedQuery)) score += 1600;
  else if (title.includes(normalizedQuery)) score += 900;

  return score;
}

function buildDetailLine(npc: NpcDefinition, context: NpcGroupingContext): string {
  const place = resolveNpcPlaceInfo(npc, context);
  const details: string[] = [];
  if (npc.title?.trim()) details.push(npc.title.trim());
  details.push(`id: ${npc.id}`);
  if (npc.currentCityId?.trim()) details.push(`currentCity: ${npc.currentCityId.trim()}`);
  else if (npc.homeCityId?.trim()) details.push(`homeCity: ${npc.homeCityId.trim()}`);
  if (npc.cityLocationId?.trim()) details.push(`cityLocation: ${npc.cityLocationId.trim()}`);
  else if (npc.locationId?.trim()) details.push(`worldLocation: ${npc.locationId.trim()}`);
  else if (place.label?.trim()) details.push(place.label.trim());
  return details.join(" • ");
}

export function parseNpcReferenceList(rawValue: string): string[] {
  return rawValue
    .split(/\r?\n|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildWorkshopReferenceContexts(params: {
  workshopId: string;
  professionId?: string | null;
  locations: WorldLocation[];
  cities: City[];
}): NpcReferenceContext[] {
  const workshopId = normalize(params.workshopId);
  if (!workshopId) {
    return [];
  }

  const contexts: NpcReferenceContext[] = [];
  for (const location of params.locations) {
    if (includesWorkshopId(location, workshopId)) {
      contexts.push({
        worldLocationId: location.id,
        professionId: params.professionId,
        workshopId,
      });
    }
  }

  for (const city of params.cities) {
    for (const location of city.locations ?? []) {
      if (includesWorkshopIdInCityLocation(location, workshopId)) {
        contexts.push({
          cityId: city.id,
          cityLocationId: location.id,
          professionId: params.professionId,
          workshopId,
        });
      }
    }
  }

  if (contexts.length === 0) {
    contexts.push({
      professionId: params.professionId,
      workshopId,
    });
  }

  return contexts;
}

export function rankNpcReferences(params: {
  npcs: NpcDefinition[];
  query: string;
  context?: NpcReferenceContext | null;
  extraContexts?: NpcReferenceContext[];
  sources: NpcReferenceSources;
  excludeIds?: string[];
  limit?: number;
}): RankedNpcReference[] {
  const excludeIds = new Set((params.excludeIds ?? []).map((entry) => normalize(entry)).filter(Boolean));
  const contexts = [params.context, ...(params.extraContexts ?? [])].filter(Boolean) as NpcReferenceContext[];
  const groupingContext: NpcGroupingContext = {
    cities: params.sources.cities,
    locations: params.sources.locations,
    zones: params.sources.zones,
  };

  return params.npcs
    .filter((npc) => !excludeIds.has(normalize(npc.id)))
    .map((npc) => {
      const queryScore = scoreNpcAgainstQuery(npc, params.query);
      if (normalize(params.query) && queryScore <= 0) {
        return null;
      }

      const contextScore = contexts.length > 0
        ? Math.max(...contexts.map((context) => scoreNpcAgainstContext(npc, context)))
        : 0;
      const summary = buildNpcCardSummary(npc, groupingContext);
      return {
        npc,
        score: queryScore + contextScore,
        summary,
        detailLine: buildDetailLine(npc, groupingContext),
      } satisfies RankedNpcReference;
    })
    .filter((entry): entry is RankedNpcReference => Boolean(entry))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (left.npc.name || left.npc.id).localeCompare(right.npc.name || right.npc.id, "ru", { sensitivity: "base" });
    })
    .slice(0, Math.max(1, params.limit ?? 8));
}


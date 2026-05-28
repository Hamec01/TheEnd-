import { Race } from "@theend/rpg-domain";
import type { CharacterSavedWorldState, CharacterCreationProfile } from "./characterProfileStorage";
import type { WorldMapZone } from "../worldmap/zoneEditorTypes";
import { getZoneCenter } from "../worldmap/zoneGeometry";

export interface StartingLocationRule {
  race: string;
  kingdomId: string;
  regionId: string;
  locationId: string;
  zoneId: string;
  mapId: string;
  areaId?: string;
  introDialogueId?: string;
  introNpcId?: string;
}

export interface InitialSpawnResolution {
  rule: StartingLocationRule;
  zone: WorldMapZone;
  position: { x: number; y: number };
  worldState: CharacterSavedWorldState;
}

export interface InitialSpawnDraft {
  race?: string | null;
  raceId?: string | null;
  kingdomId?: string | null;
  citizenshipKingdomId?: string | null;
  originId?: string | null;
}

export interface NewCharacterSpawnResolution {
  locationId?: string;
  currentLocationId?: string;
  zoneId?: string;
  currentZoneId?: string;
  mapId?: string;
  currentMapId?: string;
  regionId?: string;
  kingdomId?: string;
  citizenshipKingdomId?: string;
  initialSpawnCompleted: boolean;
  introDialogueId?: string;
  introNpcId?: string;
  introDialoguePending?: boolean;
}

export const STARTING_LOCATION_RULES: StartingLocationRule[] = [
  {
    race: "human",
    kingdomId: "argos",
    regionId: "teramor",
    locationId: "loc_argos_klinogorie_start_village",
    zoneId: "loc_argos_klinogorie_start_village",
    mapId: "worldmap-main",
    areaId: "house_bran_kamysh",
    introDialogueId: "dlg_klinogorie_bran_intro",
    introNpcId: "npc_klinogorie_bran_legless_soldier",
  },
];

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeKingdom(value: string | null | undefined): string {
  const normalized = normalizeText(value)
    .replace(/^origin_/, "")
    .replace(/^kingdom_/, "")
    .replace(/_kingdom$/, "");

  if (normalized === "argos" || normalized === "аргос") {
    return "argos";
  }

  return normalized;
}

function normalizeRace(value: string | null | undefined): string {
  const normalized = normalizeText(value).replace(/^race_/, "");
  switch (normalized) {
    case Race.Human:
    case "human":
    case "humans":
    case "человек":
    case "человк":
      return "human";
    case Race.Dwarf:
    case "dwarf":
      return "dwarf";
    case Race.WoodElf:
    case "wood_elf":
    case "forest_elf":
      return "wood_elf";
    case Race.HighElf:
    case "high_elf":
      return "high_elf";
    default:
      return normalized;
  }
}

export function resolveInitialSpawnForNewCharacter(
  draft: InitialSpawnDraft,
): NewCharacterSpawnResolution {
  const rawRace = draft.raceId ?? draft.race ?? null;
  const rawKingdom = draft.citizenshipKingdomId ?? draft.kingdomId ?? draft.originId ?? null;
  const normalizedRace = normalizeRace(rawRace);
  const normalizedKingdom = normalizeKingdom(rawKingdom);

  console.info("[initialSpawn] draft values", {
    race: rawRace,
    kingdom: rawKingdom,
  });
  console.info("[initialSpawn] normalized values", {
    race: normalizedRace,
    kingdom: normalizedKingdom,
  });

  if (normalizedRace === "human" && normalizedKingdom === "argos") {
    console.info("[initialSpawn] matched rule", "human+argos");
    return {
      mapId: "worldmap-main",
      currentMapId: "worldmap-main",
      locationId: "loc_argos_klinogorie_start_village",
      currentLocationId: "loc_argos_klinogorie_start_village",
      zoneId: "loc_argos_klinogorie_start_village",
      currentZoneId: "loc_argos_klinogorie_start_village",
      regionId: "teramor",
      kingdomId: "argos",
      citizenshipKingdomId: "argos",
      initialSpawnCompleted: true,
      introDialogueId: "dlg_klinogorie_bran_intro",
      introNpcId: "npc_klinogorie_bran_legless_soldier",
      introDialoguePending: true,
    };
  }

  console.info("[initialSpawn] matched rule", "default");
  return {
    initialSpawnCompleted: false,
  };
}

export function toCharacterWorldStateFromInitialSpawn(
  spawn: NewCharacterSpawnResolution,
): CharacterSavedWorldState | null {
  const currentLocationId = String(spawn.currentLocationId ?? spawn.locationId ?? "").trim();
  const currentZoneId = String(spawn.currentZoneId ?? spawn.zoneId ?? "").trim();
  const currentMapId = String(spawn.currentMapId ?? spawn.mapId ?? "").trim();

  if (!currentLocationId && !currentZoneId && !currentMapId) {
    return null;
  }

  return {
    currentLocationId: currentLocationId || null,
    currentZoneId: currentZoneId || null,
    currentMapId: currentMapId || null,
    kingdomId: spawn.kingdomId ?? spawn.citizenshipKingdomId ?? null,
    regionId: spawn.regionId ?? null,
    areaId: null,
    locationView: "location",
    modalType: null,
    modalZoneId: null,
    modalLocationId: null,
    currentCityId: null,
  };
}

export function resolveStartingRule(profile: CharacterCreationProfile): StartingLocationRule | null {
  const race = normalizeRace(profile.raceId);
  const kingdomId = normalizeKingdom(
    profile.citizenshipKingdomId
    ?? profile.kingdomId
    ?? profile.originId,
  );

  return STARTING_LOCATION_RULES.find((rule) =>
    normalizeRace(rule.race) === race
    && normalizeKingdom(rule.kingdomId) === kingdomId,
  ) ?? null;
}

export function shouldResolveInitialSpawn(profile: CharacterCreationProfile | null): boolean {
  return profile?.initialSpawnCompleted === false;
}

export function getInitialSpawnWorldState(
  profile: CharacterCreationProfile,
): CharacterSavedWorldState | null {
  const spawn = resolveInitialSpawnForNewCharacter(profile);
  return toCharacterWorldStateFromInitialSpawn(spawn);
}

export function resolveInitialSpawn(
  profile: CharacterCreationProfile,
  zones: WorldMapZone[],
): InitialSpawnResolution | null {
  const rule = resolveStartingRule(profile);
  if (!rule) {
    return null;
  }

  const zone = zones.find((entry) =>
    entry.id === rule.zoneId
    || entry.linkedLocationId === rule.locationId
    || entry.linkedLocation === rule.locationId,
  );
  if (!zone) {
    return null;
  }

  const [x, y] = getZoneCenter(zone);
  return {
    rule,
    zone,
    position: { x, y },
    worldState: getInitialSpawnWorldState(profile) ?? {
      currentLocationId: rule.locationId,
      currentZoneId: rule.zoneId,
      currentMapId: rule.mapId,
      kingdomId: rule.kingdomId,
      regionId: rule.regionId,
      areaId: rule.areaId ?? null,
      locationView: "location",
      modalType: null,
      modalZoneId: null,
      modalLocationId: null,
      currentCityId: null,
    },
  };
}

export function markInitialSpawnCompleted(
  profile: CharacterCreationProfile,
  worldState?: CharacterSavedWorldState,
): CharacterCreationProfile {
  return {
    ...profile,
    initialSpawnCompleted: true,
    worldState: worldState ?? profile.worldState,
  };
}

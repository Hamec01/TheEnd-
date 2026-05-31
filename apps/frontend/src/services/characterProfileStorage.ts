import type { StatBlock } from "@theend/rpg-domain";
import type { CharacterGender } from "../config/characterCreation";

const CHARACTER_PROFILE_STORAGE_PREFIX = "theend.characterProfile";

export type SavedWorldLocationView = "map" | "city" | "location";
export type SavedWorldModalType = "zone" | "location";

export interface CharacterTutorialState {
  activeTutorialId: string | null;
  currentStepIndex: number;
  completedTutorialIds: string[];
}

export interface CharacterSavedWorldState {
  currentLocationId?: string | null;
  currentZoneId?: string | null;
  currentMapId?: string | null;
  currentCityId?: string | null;
  kingdomId?: string | null;
  regionId?: string | null;
  areaId?: string | null;
  locationView?: SavedWorldLocationView;
  modalType?: SavedWorldModalType | null;
  modalZoneId?: string | null;
  modalLocationId?: string | null;
}

export interface CharacterCreationProfile {
  id: string;
  name: string;
  gender: CharacterGender;
  raceId: string;
  originId: string | null;
  kingdomId?: string | null;
  citizenshipKingdomId?: string | null;
  avatarUrl: string;
  stats: StatBlock;
  elements: string[];
  skills: string[];
  traits: Record<string, number | boolean>;
  flags?: Record<string, unknown>;
  initialSpawnCompleted?: boolean;
  locationId?: string | null;
  currentLocationId?: string | null;
  zoneId?: string | null;
  currentZoneId?: string | null;
  mapId?: string | null;
  currentMapId?: string | null;
  regionId?: string | null;
  introDialogueId?: string | null;
  introNpcId?: string | null;
  introDialoguePending?: boolean;
  worldState?: CharacterSavedWorldState;
  tutorialState?: CharacterTutorialState;
  lastPlayedAt?: string;
}

export interface CharacterProfileDebugContext {
  currentX?: number | null;
  currentY?: number | null;
}

function getProfileDebugSnapshot(
  profile: CharacterCreationProfile | null | undefined,
  context: CharacterProfileDebugContext = {},
): Record<string, unknown> {
  return {
    characterId: profile?.id ?? null,
    name: profile?.name ?? null,
    race: profile?.raceId ?? null,
    kingdomId: profile?.kingdomId ?? null,
    locationId: profile?.locationId ?? null,
    currentLocationId: profile?.currentLocationId ?? profile?.worldState?.currentLocationId ?? null,
    zoneId: profile?.zoneId ?? null,
    currentZoneId: profile?.currentZoneId ?? profile?.worldState?.currentZoneId ?? null,
    currentX: context.currentX ?? null,
    currentY: context.currentY ?? null,
    initialSpawnCompleted: profile?.initialSpawnCompleted === true,
  };
}

const lastLoadFingerprintByCharacterId = new Map<string, string>();

function getProfileLoadFingerprint(profile: CharacterCreationProfile): string {
  const worldState = profile.worldState;
  return JSON.stringify({
    characterId: profile.id,
    locationId: worldState?.currentLocationId ?? profile.currentLocationId ?? profile.locationId ?? null,
    zoneId: worldState?.currentZoneId ?? profile.currentZoneId ?? profile.zoneId ?? null,
    mapId: worldState?.currentMapId ?? profile.currentMapId ?? profile.mapId ?? null,
    initialSpawnCompleted: profile.initialSpawnCompleted === true,
    introDialoguePending: profile.introDialoguePending === true,
    lastPlayedAt: profile.lastPlayedAt ?? null,
  });
}

function shouldPreserveCurrentWorldState(
  current: CharacterCreationProfile | null,
  next: CharacterCreationProfile,
): boolean {
  if (!current?.worldState || !next.worldState) {
    return false;
  }

  const currentLocationId = String(current.worldState.currentLocationId ?? '').trim();
  const currentZoneId = String(current.worldState.currentZoneId ?? '').trim();
  const nextLocationId = String(next.worldState.currentLocationId ?? '').trim();
  const nextZoneId = String(next.worldState.currentZoneId ?? '').trim();

  if (!currentLocationId && !currentZoneId) {
    return false;
  }

  if (nextLocationId || nextZoneId) {
    return false;
  }

  return current.initialSpawnCompleted === true && !current.lastPlayedAt;
}

function getCharacterProfileStorageKey(characterId: string): string {
  return `${CHARACTER_PROFILE_STORAGE_PREFIX}.${characterId}`;
}

export function saveCharacterProfile(profile: CharacterCreationProfile): void {
  console.info('[characterProfile] save', getProfileDebugSnapshot(profile));
  window.localStorage.setItem(getCharacterProfileStorageKey(profile.id), JSON.stringify(profile));
}

export function loadCharacterProfile(characterId: string): CharacterCreationProfile | null {
  const raw = window.localStorage.getItem(getCharacterProfileStorageKey(characterId));
  if (!raw) {
    console.info('[characterProfile] load miss', { characterId });
    return null;
  }
  try {
    const profile = JSON.parse(raw) as CharacterCreationProfile;
    const fingerprint = getProfileLoadFingerprint(profile);
    const previousFingerprint = lastLoadFingerprintByCharacterId.get(profile.id);
    if (previousFingerprint !== fingerprint) {
      console.info('[characterProfile] load hit', getProfileDebugSnapshot(profile));
      lastLoadFingerprintByCharacterId.set(profile.id, fingerprint);
    }
    return profile;
  } catch {
    console.warn('[characterProfile] load parse failed', { characterId });
    return null;
  }
}

export function updateCharacterProfile(
  characterId: string,
  updater: (profile: CharacterCreationProfile | null) => CharacterCreationProfile | null,
): CharacterCreationProfile | null {
  const current = loadCharacterProfile(characterId);
  const next = updater(current);
  if (!next) {
    console.info('[characterProfile] update skipped', { characterId });
    return current;
  }

  const effectiveNext = shouldPreserveCurrentWorldState(current, next)
    ? {
        ...next,
        worldState: current!.worldState,
      }
    : next;

  if (effectiveNext === current) {
    // Prevent noisy localStorage writes (and React update loops in callers that poll storage)
    // when the updater decides no changes are needed.
    return current;
  }

  if (effectiveNext !== next) {
    console.info('[characterProfile] preserved initial worldState', {
      characterId,
      current: getProfileDebugSnapshot(current),
      next: getProfileDebugSnapshot(next),
      effective: getProfileDebugSnapshot(effectiveNext),
    });
  }

  saveCharacterProfile(effectiveNext);
  return effectiveNext;
}

export function deleteCharacterProfile(characterId: string): void {
  window.localStorage.removeItem(getCharacterProfileStorageKey(characterId));
}

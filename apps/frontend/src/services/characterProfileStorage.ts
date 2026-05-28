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

function getCharacterProfileStorageKey(characterId: string): string {
  return `${CHARACTER_PROFILE_STORAGE_PREFIX}.${characterId}`;
}

export function saveCharacterProfile(profile: CharacterCreationProfile): void {
  window.localStorage.setItem(getCharacterProfileStorageKey(profile.id), JSON.stringify(profile));
}

export function loadCharacterProfile(characterId: string): CharacterCreationProfile | null {
  const raw = window.localStorage.getItem(getCharacterProfileStorageKey(characterId));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CharacterCreationProfile;
  } catch {
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
    return current;
  }
  saveCharacterProfile(next);
  return next;
}

export function deleteCharacterProfile(characterId: string): void {
  window.localStorage.removeItem(getCharacterProfileStorageKey(characterId));
}

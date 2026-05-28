import { describe, expect, it } from "vitest";
import {
  markInitialSpawnCompleted,
  resolveInitialSpawn,
  resolveInitialSpawnForNewCharacter,
  shouldResolveInitialSpawn,
} from "./initialSpawn";
import type { CharacterCreationProfile } from "./characterProfileStorage";
import type { WorldMapZone } from "../worldmap/zoneEditorTypes";

const klinogorieZone: WorldMapZone = {
  id: "loc_argos_klinogorie_start_village",
  name: "Klinogorie",
  type: "location",
  shape: "circle",
  x: 0.46,
  y: 0.63,
  radius: 0.01,
  description: "Start village",
  dangerLevel: 1,
  isDiscovered: true,
  isVisibleToPlayer: true,
  linkedLocationId: "loc_argos_klinogorie_start_village",
  kingdomId: "argos",
  createdAt: 1,
  updatedAt: 1,
};

function createProfile(overrides: Partial<CharacterCreationProfile> = {}): CharacterCreationProfile {
  return {
    id: "char_1",
    name: "Test",
    gender: "male",
    raceId: "human",
    originId: "origin_argos",
    avatarUrl: "",
    stats: {
      hp: 10,
      mp: 10,
      stamina: 10,
      strength: 1,
      constitution: 1,
      dexterity: 1,
      intelligence: 1,
      luck: 1,
      perception: 1,
      willpower: 1,
    },
    elements: [],
    skills: [],
    traits: {},
    ...overrides,
  };
}

describe("initial spawn", () => {
  it("runs only for newly created profiles with an explicit false flag", () => {
    expect(shouldResolveInitialSpawn(createProfile({ initialSpawnCompleted: false }))).toBe(true);
    expect(shouldResolveInitialSpawn(createProfile({ initialSpawnCompleted: true }))).toBe(false);
    expect(shouldResolveInitialSpawn(createProfile())).toBe(false);
  });

  it("resolves Klinogorie for human Argos", () => {
    const resolution = resolveInitialSpawn(
      createProfile({ initialSpawnCompleted: false }),
      [klinogorieZone],
    );

    expect(resolution?.rule.locationId).toBe("loc_argos_klinogorie_start_village");
    expect(resolution?.worldState.currentMapId).toBe("worldmap-main");
    expect(resolution?.worldState.locationView).toBe("location");
  });

  it("resolveInitialSpawnForNewCharacter resolves Klinogorie for human + argos", () => {
    const spawn = resolveInitialSpawnForNewCharacter({
      raceId: "human",
      originId: "origin_argos",
    });

    expect(spawn.currentLocationId).toBe("loc_argos_klinogorie_start_village");
    expect(spawn.currentZoneId).toBe("loc_argos_klinogorie_start_village");
    expect(spawn.currentMapId).toBe("worldmap-main");
    expect(spawn.initialSpawnCompleted).toBe(true);
  });

  it("resolveInitialSpawnForNewCharacter resolves Klinogorie for Human + Argos", () => {
    const spawn = resolveInitialSpawnForNewCharacter({
      raceId: "Human",
      citizenshipKingdomId: "Argos",
    });

    expect(spawn.currentLocationId).toBe("loc_argos_klinogorie_start_village");
    expect(spawn.initialSpawnCompleted).toBe(true);
  });

  it("resolveInitialSpawnForNewCharacter resolves Klinogorie for Russian labels", () => {
    const spawn = resolveInitialSpawnForNewCharacter({
      raceId: "Человек",
      citizenshipKingdomId: "Аргос",
    });

    expect(spawn.currentLocationId).toBe("loc_argos_klinogorie_start_village");
    expect(spawn.initialSpawnCompleted).toBe(true);
  });

  it("resolveInitialSpawnForNewCharacter resolves Klinogorie for argos_kingdom value", () => {
    const spawn = resolveInitialSpawnForNewCharacter({
      raceId: "human",
      citizenshipKingdomId: "argos_kingdom",
    });

    expect(spawn.currentLocationId).toBe("loc_argos_klinogorie_start_village");
    expect(spawn.initialSpawnCompleted).toBe(true);
  });

  it("resolveInitialSpawnForNewCharacter keeps default behavior for human + luminor", () => {
    const spawn = resolveInitialSpawnForNewCharacter({
      raceId: "human",
      citizenshipKingdomId: "luminor",
    });

    expect(spawn.currentLocationId).toBeUndefined();
    expect(spawn.initialSpawnCompleted).toBe(false);
  });

  it("resolveInitialSpawnForNewCharacter keeps default behavior for elf + argos", () => {
    const spawn = resolveInitialSpawnForNewCharacter({
      raceId: "wood_elf",
      citizenshipKingdomId: "argos",
    });

    expect(spawn.currentLocationId).toBeUndefined();
    expect(spawn.initialSpawnCompleted).toBe(false);
  });

  it("marks spawn as completed without changing existing characters by default", () => {
    const profile = createProfile({ initialSpawnCompleted: false });
    const next = markInitialSpawnCompleted(profile, {
      currentLocationId: "loc_argos_klinogorie_start_village",
    });

    expect(next.initialSpawnCompleted).toBe(true);
    expect(next.worldState?.currentLocationId).toBe("loc_argos_klinogorie_start_village");
  });
});

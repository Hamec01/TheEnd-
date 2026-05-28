import { beforeEach, describe, expect, it } from "vitest";
import { saveCharacterProfile, type CharacterCreationProfile } from "./characterProfileStorage";
import {
  ARGOS_INTRO_SEEN_FLAG,
  ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG,
  getCharacterFlag,
  isHumanArgosProfile,
  loadTutorialState,
  nextStep,
  setCharacterFlag,
  skipTutorial,
  startTutorial,
} from "./tutorialManager";
import { TUTORIAL_ARGOS_INTRO_ID } from "./tutorialDefinitions";

function installWindowStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
  };
  (globalThis as any).window = { localStorage: storage };
}

function createProfile(overrides: Partial<CharacterCreationProfile> = {}): CharacterCreationProfile {
  return {
    id: "char_tutorial",
    name: "Argos Hero",
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
    initialSpawnCompleted: true,
    ...overrides,
  };
}

describe("tutorialManager", () => {
  beforeEach(() => {
    installWindowStorage();
  });

  it("recognizes only new-style human Argos profiles", () => {
    expect(isHumanArgosProfile(createProfile())).toBe(true);
    expect(isHumanArgosProfile(createProfile({ initialSpawnCompleted: undefined }))).toBe(false);
    expect(isHumanArgosProfile(createProfile({ originId: "origin_luminor" }))).toBe(false);
  });

  it("starts and progresses Argos intro tutorial", () => {
    saveCharacterProfile(createProfile());
    setCharacterFlag("char_tutorial", ARGOS_INTRO_SEEN_FLAG, true);
    setCharacterFlag("char_tutorial", ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG, false);

    let state = startTutorial("char_tutorial", TUTORIAL_ARGOS_INTRO_ID);
    expect(state.activeTutorialId).toBe(TUTORIAL_ARGOS_INTRO_ID);
    expect(state.currentStepIndex).toBe(0);

    state = nextStep("char_tutorial");
    expect(state.currentStepIndex).toBe(1);
    expect(loadTutorialState("char_tutorial").currentStepIndex).toBe(1);
  });

  it("skip closes tutorial permanently", () => {
    saveCharacterProfile(createProfile());
    setCharacterFlag("char_tutorial", ARGOS_INTRO_SEEN_FLAG, true);
    setCharacterFlag("char_tutorial", ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG, false);
    startTutorial("char_tutorial", TUTORIAL_ARGOS_INTRO_ID);

    const state = skipTutorial("char_tutorial");
    expect(state.activeTutorialId).toBeNull();
    expect(state.completedTutorialIds).toContain(TUTORIAL_ARGOS_INTRO_ID);
    expect(getCharacterFlag("char_tutorial", ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG)).toBe(true);

    const restarted = startTutorial("char_tutorial", TUTORIAL_ARGOS_INTRO_ID);
    expect(restarted.activeTutorialId).toBeNull();
  });
});

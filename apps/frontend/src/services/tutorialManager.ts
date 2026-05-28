import {
  loadCharacterProfile,
  updateCharacterProfile,
  type CharacterCreationProfile,
  type CharacterTutorialState,
} from "./characterProfileStorage";
import { getTutorialDefinition } from "./tutorialDefinitions";

export const ARGOS_INTRO_SEEN_FLAG = "argos_intro_seen";
export const ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG = "argos_intro_tutorial_completed";

const DEFAULT_TUTORIAL_STATE: CharacterTutorialState = {
  activeTutorialId: null,
  currentStepIndex: 0,
  completedTutorialIds: [],
};

function normalizeRaceId(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^race_/, "");
}

function normalizeTutorialState(raw: CharacterCreationProfile["tutorialState"]): CharacterTutorialState {
  return {
    activeTutorialId: typeof raw?.activeTutorialId === "string" && raw.activeTutorialId.trim()
      ? raw.activeTutorialId
      : DEFAULT_TUTORIAL_STATE.activeTutorialId,
    currentStepIndex: Number.isFinite(Number(raw?.currentStepIndex))
      ? Math.max(0, Math.floor(Number(raw?.currentStepIndex)))
      : DEFAULT_TUTORIAL_STATE.currentStepIndex,
    completedTutorialIds: Array.isArray(raw?.completedTutorialIds)
      ? raw.completedTutorialIds.map((entry) => String(entry ?? "").trim()).filter(Boolean)
      : [],
  };
}

function normalizeFlags(raw: CharacterCreationProfile["flags"]): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...raw }
    : {};
}

function completeTutorialProfile(
  profile: CharacterCreationProfile,
  tutorialId: string,
): CharacterCreationProfile {
  const tutorialState = normalizeTutorialState(profile.tutorialState);
  const completedTutorialIds = Array.from(new Set([...tutorialState.completedTutorialIds, tutorialId]));
  return {
    ...profile,
    flags: {
      ...normalizeFlags(profile.flags),
      [ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG]: true,
    },
    tutorialState: {
      activeTutorialId: null,
      currentStepIndex: 0,
      completedTutorialIds,
    },
  };
}

function updateTutorialProfile(
  characterId: string,
  updater: (profile: CharacterCreationProfile) => CharacterCreationProfile,
): CharacterCreationProfile | null {
  return updateCharacterProfile(characterId, (profile) => {
    if (!profile) {
      return profile;
    }
    return updater(profile);
  });
}

export function loadTutorialState(characterId: string): CharacterTutorialState {
  return normalizeTutorialState(loadCharacterProfile(characterId)?.tutorialState);
}

export function getCharacterFlag(characterId: string, flagKey: string): unknown {
  return loadCharacterProfile(characterId)?.flags?.[flagKey];
}

export function setCharacterFlag(characterId: string, flagKey: string, value: unknown): CharacterCreationProfile | null {
  return updateTutorialProfile(characterId, (profile) => ({
    ...profile,
    flags: {
      ...normalizeFlags(profile.flags),
      [flagKey]: value,
    },
  }));
}

export function isHumanArgosProfile(profile: CharacterCreationProfile | null | undefined): boolean {
  if (!profile || profile.initialSpawnCompleted !== true) {
    return false;
  }

  return normalizeRaceId(profile.raceId) === "human"
    && String(profile.originId ?? "").trim().toLowerCase() === "origin_argos";
}

export function startTutorial(characterId: string, tutorialId: string): CharacterTutorialState {
  const profile = updateTutorialProfile(characterId, (current) => {
    const tutorialState = normalizeTutorialState(current.tutorialState);
    const completed = tutorialState.completedTutorialIds.includes(tutorialId)
      || current.flags?.[ARGOS_INTRO_TUTORIAL_COMPLETED_FLAG] === true;
    if (completed) {
      return current;
    }

    return {
      ...current,
      tutorialState: {
        ...tutorialState,
        activeTutorialId: tutorialId,
        currentStepIndex: tutorialState.activeTutorialId === tutorialId ? tutorialState.currentStepIndex : 0,
      },
    };
  });

  return normalizeTutorialState(profile?.tutorialState);
}

export function nextStep(characterId: string): CharacterTutorialState {
  const profile = updateTutorialProfile(characterId, (current) => {
    const tutorialState = normalizeTutorialState(current.tutorialState);
    const tutorial = getTutorialDefinition(tutorialState.activeTutorialId);
    if (!tutorial) {
      return current;
    }

    const nextIndex = tutorialState.currentStepIndex + 1;
    if (nextIndex >= tutorial.steps.length) {
      return completeTutorialProfile(current, tutorial.id);
    }

    return {
      ...current,
      tutorialState: {
        ...tutorialState,
        currentStepIndex: nextIndex,
      },
    };
  });

  return normalizeTutorialState(profile?.tutorialState);
}

export function skipTutorial(characterId: string): CharacterTutorialState {
  const profile = updateTutorialProfile(characterId, (current) => {
    const tutorialState = normalizeTutorialState(current.tutorialState);
    if (!tutorialState.activeTutorialId) {
      return current;
    }
    return completeTutorialProfile(current, tutorialState.activeTutorialId);
  });

  return normalizeTutorialState(profile?.tutorialState);
}

export function completeTutorial(characterId: string): CharacterTutorialState {
  return skipTutorial(characterId);
}

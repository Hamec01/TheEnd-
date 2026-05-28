import type { StoredImage } from '../services/content/models';
import { resolveStoredImageSource } from '../services/content/runtimeImageService';
import type { PlayerQuestState, QuestDefinition, QuestMarkerDefinition, QuestObjective, QuestStep } from '../types/quest';

const DIRECT_IMAGE_SOURCE = /^(\/|data:|https?:\/\/)/i;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveQuestImageRef(raw: string | null, runtimeImages: StoredImage[]): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (DIRECT_IMAGE_SOURCE.test(raw)) {
    return raw;
  }

  const resolved = resolveStoredImageSource(raw, runtimeImages);
  if (resolved) {
    return resolved;
  }

  return undefined;
}

function pickFirstQuestImage(
  quest: QuestDefinition | null | undefined,
  runtimeImages: StoredImage[],
  fields: string[],
): string | undefined {
  if (!quest) {
    return undefined;
  }

  const rawQuest = quest as unknown as Record<string, unknown>;
  for (const field of fields) {
    const raw = asNonEmptyString(rawQuest[field]);
    const resolved = resolveQuestImageRef(raw, runtimeImages);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

export function resolveQuestPortrait(
  quest: QuestDefinition | null | undefined,
  runtimeImages: StoredImage[],
): string | undefined {
  return pickFirstQuestImage(quest, runtimeImages, [
    'portraitImageId',
    'portraitUrl',
    'portraitId',
    'imageId',
    'imageUrl',
    'questImageId',
    'iconImageId',
    'iconUrl',
  ]);
}

export function resolveQuestIcon(
  quest: QuestDefinition | null | undefined,
  runtimeImages: StoredImage[],
): string | undefined {
  return pickFirstQuestImage(quest, runtimeImages, [
    'iconImageId',
    'iconUrl',
    'imageId',
    'imageUrl',
    'questImageId',
    'portraitImageId',
    'portraitUrl',
  ]);
}

export function resolveQuestBanner(
  quest: QuestDefinition | null | undefined,
  runtimeImages: StoredImage[],
): string | undefined {
  return pickFirstQuestImage(quest, runtimeImages, [
    'bannerImageId',
    'bannerUrl',
    'questBannerId',
    'bannerId',
  ]);
}

function getCurrentStep(quest: QuestDefinition | null | undefined, state: PlayerQuestState | null | undefined): QuestStep | null {
  if (!quest) {
    return null;
  }

  const steps = Array.isArray(quest.steps) ? quest.steps : [];
  if (steps.length === 0) {
    return null;
  }

  if (state?.currentStepId) {
    const current = steps.find((step) => step.id === state.currentStepId);
    if (current) {
      return current;
    }
  }

  return steps[0] ?? null;
}

function getFirstIncompleteObjective(step: QuestStep | null, state: PlayerQuestState | null | undefined): QuestObjective | null {
  if (!step) {
    return null;
  }

  const objectives = Array.isArray(step.objectives) ? step.objectives : [];
  if (objectives.length === 0) {
    return null;
  }

  const completed = new Set(state?.completedObjectiveIds ?? []);
  return objectives.find((objective) => !objective.isOptional && !completed.has(objective.id))
    ?? objectives.find((objective) => !completed.has(objective.id))
    ?? objectives[0]
    ?? null;
}

export function resolveQuestMarkerObjectiveText(
  marker: QuestMarkerDefinition,
  quest: QuestDefinition | null | undefined,
  state: PlayerQuestState | null | undefined,
): string | undefined {
  const markerObjectiveId = asNonEmptyString(marker.linkedObjectiveId ?? marker.objectiveId);
  const steps = Array.isArray(quest?.steps) ? quest.steps : [];
  if (markerObjectiveId) {
    for (const step of steps) {
      const objective = (Array.isArray(step.objectives) ? step.objectives : [])
        .find((entry) => entry.id === markerObjectiveId);
      if (objective?.description?.trim()) {
        return objective.description.trim();
      }
    }
  }

  const currentStep = getCurrentStep(quest, state);
  const nextObjective = getFirstIncompleteObjective(currentStep, state);
  return nextObjective?.description?.trim() || currentStep?.journalText?.trim() || undefined;
}

export type QuestMarkerRuntimeMeta = {
  runtimeQuestTitle?: string;
  runtimeQuestIconUrl?: string;
  runtimeQuestObjectiveText?: string;
};

export function getQuestMarkerRuntimeMeta(marker: QuestMarkerDefinition): QuestMarkerRuntimeMeta {
  const raw = marker as unknown as QuestMarkerRuntimeMeta;
  return {
    runtimeQuestTitle: asNonEmptyString(raw.runtimeQuestTitle) ?? undefined,
    runtimeQuestIconUrl: asNonEmptyString(raw.runtimeQuestIconUrl) ?? undefined,
    runtimeQuestObjectiveText: asNonEmptyString(raw.runtimeQuestObjectiveText) ?? undefined,
  };
}

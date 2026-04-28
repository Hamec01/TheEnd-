function normalizeLevel(level: number): number {
  return Math.max(0, Math.floor(level));
}

const LEVEL_EXP_THRESHOLDS = [100, 500, 2000, 5000] as const;
const POST_TABLE_STEP = 5000;

export function getRequiredExpForLevel(level: number): number {
  const normalizedLevel = normalizeLevel(level);
  if (normalizedLevel <= 0) {
    return 0;
  }

  const presetThreshold = LEVEL_EXP_THRESHOLDS[normalizedLevel - 1];
  if (typeof presetThreshold === 'number') {
    return presetThreshold;
  }

  const extraLevels = normalizedLevel - LEVEL_EXP_THRESHOLDS.length;
  return LEVEL_EXP_THRESHOLDS[LEVEL_EXP_THRESHOLDS.length - 1] + extraLevels * POST_TABLE_STEP;
}

export function getRequiredExpForNextLevel(currentLevel: number): number {
  return getRequiredExpForLevel(normalizeLevel(currentLevel) + 1);
}

export function getCurrentLevelExpFloor(currentLevel: number): number {
  return getRequiredExpForLevel(normalizeLevel(currentLevel));
}

export function getLevelProgress(currentLevel: number, currentExp: number): {
  floor: number;
  next: number;
  gainedInsideLevel: number;
  totalInsideLevel: number;
  ratio: number;
} {
  const floor = getCurrentLevelExpFloor(currentLevel);
  const next = getRequiredExpForNextLevel(currentLevel);
  const totalInsideLevel = Math.max(1, next - floor);
  const gainedInsideLevel = Math.max(0, Math.min(totalInsideLevel, Math.floor(currentExp) - floor));
  const ratio = Math.max(0, Math.min(1, gainedInsideLevel / totalInsideLevel));

  return {
    floor,
    next,
    gainedInsideLevel,
    totalInsideLevel,
    ratio,
  };
}

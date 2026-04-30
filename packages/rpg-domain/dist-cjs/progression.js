"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequiredExpForLevel = getRequiredExpForLevel;
exports.getRequiredExpForNextLevel = getRequiredExpForNextLevel;
exports.getCurrentLevelExpFloor = getCurrentLevelExpFloor;
exports.getLevelProgress = getLevelProgress;
function normalizeLevel(level) {
    return Math.max(0, Math.floor(level));
}
const LEVEL_EXP_THRESHOLDS = [100, 500, 2000, 5000];
const POST_TABLE_STEP = 5000;
function getRequiredExpForLevel(level) {
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
function getRequiredExpForNextLevel(currentLevel) {
    return getRequiredExpForLevel(normalizeLevel(currentLevel) + 1);
}
function getCurrentLevelExpFloor(currentLevel) {
    return getRequiredExpForLevel(normalizeLevel(currentLevel));
}
function getLevelProgress(currentLevel, currentExp) {
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

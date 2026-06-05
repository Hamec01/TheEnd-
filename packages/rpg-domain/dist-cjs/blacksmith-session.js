"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBlacksmithSession = createBlacksmithSession;
exports.applyBlacksmithAction = applyBlacksmithAction;
exports.finalizeBlacksmithScore = finalizeBlacksmithScore;
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function randomId() {
    return `forge_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
}
function createBlacksmithSession(seed, bonuses = {}) {
    const difficulty = clamp(Math.round(seed.baseDifficulty || 40), 1, 100);
    return {
        id: randomId(),
        recipeId: seed.recipeId,
        recipeType: seed.recipeType,
        materialTier: seed.materialTier,
        stage: 'prep',
        heat: clamp(22 + Math.round((bonuses.heatControlBonus ?? 0) / 3), 0, 100),
        progress: 0,
        qualityScore: clamp(50 - Math.round(difficulty / 3) + Math.round(bonuses.qualityBonus ?? 0), 0, 100),
        defectScore: clamp(Math.round(difficulty / 4) - Math.round((bonuses.defectChanceReduction ?? 0) / 2), 0, 100),
        turnsUsed: 0,
        completed: false,
        mode: seed.mode ?? 'recipe',
        customForgePlanId: seed.customForgePlanId,
        targetItemId: seed.targetItemId,
        itemWorkActionId: seed.itemWorkActionId,
    };
}
function applyBlacksmithAction(state, action, bonuses = {}) {
    if (state.completed) {
        return { state, stageChanged: false };
    }
    let next = { ...state, turnsUsed: state.turnsUsed + 1 };
    const beforeStage = state.stage;
    const precision = Math.round(bonuses.strikePrecisionBonus ?? 0);
    const heatControl = Math.round(bonuses.heatControlBonus ?? 0);
    const quenchControl = Math.round(bonuses.quenchControlBonus ?? 0);
    if (action === 'prepare_blank') {
        next.stage = 'heat';
        next.progress = clamp(next.progress + 6, 0, 100);
        next.qualityScore = clamp(next.qualityScore + 2, 0, 100);
        next.heat = clamp(next.heat + 8 + Math.round(heatControl / 4), 0, 100);
    }
    if (action === 'add_heat') {
        next.heat = clamp(next.heat + 12 + Math.round(heatControl / 3), 0, 100);
        next.qualityScore = clamp(next.qualityScore + 1, 0, 100);
        if (next.heat >= 55 && next.stage !== 'prep') {
            next.stage = 'strike';
        }
    }
    if (action === 'stabilize_heat') {
        const optimalTarget = 64;
        const drift = next.heat - optimalTarget;
        const correction = Math.sign(drift) * Math.min(Math.abs(drift), 8 + Math.max(0, Math.round(heatControl / 4)));
        next.heat = clamp(next.heat - correction, 0, 100);
        next.defectScore = clamp(next.defectScore - 4 - Math.max(0, Math.round((bonuses.defectChanceReduction ?? 0) / 6)), 0, 100);
        if (next.heat >= 55 && next.stage !== 'prep') {
            next.stage = 'strike';
        }
    }
    if (action === 'light_strike') {
        next.progress = clamp(next.progress + 10 + Math.round(precision / 3), 0, 100);
        next.qualityScore = clamp(next.qualityScore + 3 + Math.round(precision / 5), 0, 100);
        next.heat = clamp(next.heat - 6, 0, 100);
        if (next.progress >= 60) {
            next.stage = 'quench';
        }
    }
    if (action === 'medium_strike') {
        next.progress = clamp(next.progress + 14 + Math.round(precision / 3), 0, 100);
        next.qualityScore = clamp(next.qualityScore + 2 + Math.round(precision / 8), 0, 100);
        next.defectScore = clamp(next.defectScore + Math.max(0, 2 - Math.round((bonuses.defectChanceReduction ?? 0) / 8)), 0, 100);
        next.heat = clamp(next.heat - 8, 0, 100);
        if (next.progress >= 60) {
            next.stage = 'quench';
        }
    }
    if (action === 'heavy_strike') {
        next.progress = clamp(next.progress + 18 + Math.round(precision / 4), 0, 100);
        next.qualityScore = clamp(next.qualityScore + 1 + Math.round(precision / 6), 0, 100);
        next.defectScore = clamp(next.defectScore + Math.max(0, 5 - Math.round((bonuses.defectChanceReduction ?? 0) / 5)), 0, 100);
        next.heat = clamp(next.heat - 10, 0, 100);
        if (next.progress >= 60) {
            next.stage = 'quench';
        }
    }
    if (action === 'quench_water' || action === 'quench_oil') {
        next.stage = 'finish';
        const baseQuality = action === 'quench_oil' ? 7 : 4;
        const baseDefect = action === 'quench_oil' ? 3 : 6;
        next.qualityScore = clamp(next.qualityScore + baseQuality + Math.round(quenchControl / 4), 0, 100);
        next.defectScore = clamp(next.defectScore + baseDefect - Math.round((bonuses.defectChanceReduction ?? 0) / 4), 0, 100);
        next.heat = clamp(next.heat - 30, 0, 100);
    }
    if (action === 'finish_polish') {
        const heatPenalty = next.heat < 50 ? 3 : next.heat > 78 ? 4 : 0;
        const qualityGain = Math.max(1, 4 + Math.round((bonuses.qualityBonus ?? 0) / 4) - heatPenalty);
        const alreadyRefined = state.qualityScore >= 70;
        next.qualityScore = clamp(next.qualityScore + qualityGain, 0, 100);
        if (alreadyRefined) {
            next.defectScore = clamp(next.defectScore + Math.max(2, 6 - Math.round((bonuses.defectChanceReduction ?? 0) / 6)), 0, 100);
        }
        else {
            next.defectScore = clamp(next.defectScore - 2, 0, 100);
        }
        next.stage = 'finish';
    }
    return {
        state: next,
        stageChanged: beforeStage !== next.stage,
    };
}
function finalizeBlacksmithScore(state, bonuses = {}) {
    const raw = Math.round(state.qualityScore
        + (bonuses.qualityBonus ?? 0)
        + (bonuses.minResultFloor ?? 0) / 4
        - state.defectScore
        - Math.max(0, state.turnsUsed - 8) * 2);
    const floor = Math.max(0, Math.round(bonuses.minResultFloor ?? 0));
    return clamp(Math.max(raw, floor), 0, 100);
}

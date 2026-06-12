import { resolveCarpenterTemplateBaseDifficulty, resolveCarpenterTemplateBaseRisk } from '../carpenterTemplateAccess';
import { getCarpenterWorkshopStageDefinition } from './carpenterWorkshopGameStages';
import type {
  CarpenterWorkshopRiskLevel,
  CarpenterWorkshopRunConfig,
  CarpenterWorkshopStageResult,
  CarpenterWorkshopToolOption,
} from './carpenterWorkshopGame.types';
import type { CarpenterItemTemplate } from '../../../services/content/models';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildCarpenterWorkshopRunConfig(params: {
  template: CarpenterItemTemplate;
  riskLevel: CarpenterWorkshopRiskLevel;
  carpenterLevel: number;
  tool: CarpenterWorkshopToolOption | null;
}): CarpenterWorkshopRunConfig {
  const stage = getCarpenterWorkshopStageDefinition(params.template.stationType);
  const toolEfficiency = params.tool?.efficiency ?? 1;
  const toolTier = params.tool?.tier ?? 1;
  const riskDifficultyModifier = params.riskLevel === 'reckless'
    ? 7
    : params.riskLevel === 'steady'
      ? -3
      : 0;
  const riskStageModifier = params.riskLevel === 'reckless'
    ? 1.12
    : params.riskLevel === 'steady'
      ? 0.92
      : 1;

  return {
    workshopId: '',
    templateId: params.template.id,
    templateName: params.template.name,
    stationType: params.template.stationType,
    stageTitle: stage.title,
    instruction: stage.instruction,
    laneCount: stage.laneCount,
    totalSteps: Math.max(4, Math.round(stage.totalSteps * (params.riskLevel === 'steady' ? 0.92 : params.riskLevel === 'reckless' ? 1.08 : 1))),
    stepDurationMs: Math.max(1100, Math.round(stage.stepDurationMs / Math.max(0.7, toolEfficiency) / riskStageModifier)),
    cursorSpeed: stage.cursorSpeed * riskStageModifier * clamp(1 + resolveCarpenterTemplateBaseRisk(params.template) / 50, 1, 1.45),
    targetWidth: clamp(stage.targetWidth / riskStageModifier / clamp(toolEfficiency, 0.75, 1.4), 0.09, 0.3),
    maxMistakes: Math.max(1, Math.round(stage.maxMistakes + (params.riskLevel === 'steady' ? 1 : params.riskLevel === 'reckless' ? -1 : 0))),
    integrityStart: Math.max(40, Math.round(stage.integrityStart + toolTier * 2 + (params.riskLevel === 'steady' ? 8 : params.riskLevel === 'reckless' ? -6 : 0))),
    baseDifficulty: Math.max(1, resolveCarpenterTemplateBaseDifficulty(params.template) + riskDifficultyModifier),
    baseRisk: Math.max(0, resolveCarpenterTemplateBaseRisk(params.template) + (params.riskLevel === 'reckless' ? 3 : params.riskLevel === 'steady' ? -1 : 0)),
    riskLevel: params.riskLevel,
    toolEfficiency,
    toolTier,
    carpenterLevel: Math.max(1, Math.floor(params.carpenterLevel)),
  };
}

export function resolveCarpenterWorkshopQualityScore(params: {
  config: CarpenterWorkshopRunConfig;
  result: CarpenterWorkshopStageResult;
}): number {
  const successRatio = params.result.totalSteps > 0 ? params.result.completedSteps / params.result.totalSteps : 0;
  const comboBonus = Math.min(12, params.result.maxCombo * 2);
  const integrityBonus = Math.round(params.result.integrityLeft / 8);
  const skillBonus = Math.round(params.config.carpenterLevel * 1.4 + params.config.toolTier * 2);
  const toolBonus = Math.round((params.config.toolEfficiency - 1) * 12);
  const difficultyPenalty = Math.round(params.config.baseDifficulty * 0.55);
  const riskPenalty = Math.round(params.config.baseRisk * 1.1 + params.result.mistakes * 6);
  const raw = 42
    + Math.round(successRatio * 32)
    + comboBonus
    + integrityBonus
    + skillBonus
    + toolBonus
    - difficultyPenalty
    - riskPenalty;
  return clamp(raw, 1, 100);
}

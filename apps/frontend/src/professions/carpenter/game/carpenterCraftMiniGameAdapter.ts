import type { ProfessionWorkshopDefinition } from '../../../services/content/models';
import type { CarpenterGameInput, CarpenterGameResult, CarpenterRiskLevel } from './craftMiniGame/carpenterGameTypes';
import type {
  CarpenterWorkshopRiskLevel,
  CarpenterWorkshopRunConfig,
  CarpenterWorkshopStageResult,
} from './carpenterWorkshopGame.types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapRiskLevel(riskLevel: CarpenterWorkshopRiskLevel, baseRisk: number): CarpenterRiskLevel {
  if (riskLevel === 'steady') {
    return 'safe';
  }
  if (riskLevel === 'reckless') {
    return baseRisk >= 12 ? 'dangerous' : 'bold';
  }
  return baseRisk >= 16 ? 'dangerous' : 'normal';
}

function resolveWorkshopImagePath(workshop: ProfessionWorkshopDefinition): string | undefined {
  const imagePath = String(workshop.imagePath ?? '').trim();
  if (imagePath) {
    return imagePath;
  }
  const imageRef = workshop.imageRef;
  if (imageRef && typeof imageRef === 'object' && 'src' in imageRef) {
    const src = String(imageRef.src ?? '').trim();
    return src || undefined;
  }
  return undefined;
}

export function buildCarpenterCraftGameInput(params: {
  config: CarpenterWorkshopRunConfig;
  materialId: string;
  materialName: string;
  toolId: string;
  toolName: string;
  workshop: ProfessionWorkshopDefinition;
}): CarpenterGameInput {
  return {
    templateId: params.config.templateId,
    templateName: params.config.templateName,
    materialId: params.materialId,
    materialName: params.materialName,
    toolId: params.toolId,
    toolName: params.toolName,
    riskLevel: mapRiskLevel(params.config.riskLevel, params.config.baseRisk),
    workshopName: params.workshop.name,
    workshopBackgroundUrl: resolveWorkshopImagePath(params.workshop),
    visualKey: 'wood_blank',
    baseDifficulty: params.config.baseDifficulty,
    baseRisk: params.config.baseRisk,
    maxPasses: clamp(3 + Math.floor(params.config.totalSteps / 4), 3, 5),
  };
}

export function mapCarpenterCraftGameResult(result: CarpenterGameResult): CarpenterWorkshopStageResult {
  const completedSteps = clamp(Math.round(result.progress), 0, 100);
  const normalizedReason = result.reason === 'material_broken'
    ? 'material_broken'
    : result.reason === 'cancelled'
      ? 'cancelled'
      : result.reason === 'too_many_mistakes'
        ? 'too_many_mistakes'
        : result.success
          ? undefined
          : 'mistakes';

  return {
    success: result.success,
    qualityScore: clamp(Math.round(result.qualityScore), 1, 100),
    mistakes: Math.max(0, Math.floor(result.mistakes)),
    completedSteps,
    totalSteps: 100,
    maxCombo: Math.max(0, Math.floor(result.perfectHits + result.goodHits)),
    integrityLeft: clamp(Math.round(result.integrityRemaining), 0, 100),
    reason: normalizedReason,
    resultGrade: result.resultGrade,
    traitRetentionPercent: clamp(Math.round(result.traitRetentionPercent), 0, 100),
  };
}

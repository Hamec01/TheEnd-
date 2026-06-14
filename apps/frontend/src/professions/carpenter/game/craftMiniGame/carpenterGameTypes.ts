export type CarpenterRiskLevel = 'safe' | 'normal' | 'bold' | 'dangerous' | 'insane';

export interface CarpenterGameInput {
  templateId: string;
  templateName: string;
  materialId: string;
  materialName: string;
  toolId: string;
  toolName: string;
  riskLevel: CarpenterRiskLevel;
  workshopName?: string;
  workshopBackgroundUrl?: string;
  visualKey?: string;
  baseDifficulty: number;
  baseRisk: number;
  maxPasses?: number;
}

export interface CarpenterGameResult {
  success: boolean;
  reason?: 'completed' | 'material_broken' | 'cancelled' | 'too_many_mistakes';
  templateId: string;
  materialId: string;
  toolId: string;
  riskLevel: CarpenterRiskLevel;
  qualityScore: number;
  integrityRemaining: number;
  progress: number;
  masteryChance: number;
  passesCompleted: number;
  mistakes: number;
  perfectHits: number;
  goodHits: number;
  badHits: number;
  resultGrade: 'broken' | 'poor' | 'common' | 'good' | 'excellent' | 'masterwork' | 'masterpiece';
  traitRetentionPercent: number;
}

export type HitGrade = 'perfect' | 'good' | 'normal' | 'bad' | 'critical_bad';

export type TimingZone = 'gold' | 'green' | 'yellow' | 'red';
export type PressureZone = 'low' | 'ideal' | 'high' | 'overpressure';

export interface PassStats {
  passNumber: number;
  hitsScored: number;
  perfectHits: number;
  goodHits: number;
  badHits: number;
  qualityScore: number;
  integrityRemaining: number;
  progress: number;
  masteryChance: number;
  mistakes: number;
  broken: boolean;
}

export interface SceneCallbacks {
  onPassComplete: (stats: PassStats) => void;
  onGameOver: (result: CarpenterGameResult) => void;
}

export const DEFAULT_CONFIG: CarpenterGameInput = {
  templateId: 'template_sword_handle',
  templateName: 'Рукоять меча',
  materialId: 'wood_plank_common',
  materialName: 'Обычная доска',
  toolId: 'tool_chisel_basic',
  toolName: 'Стамеска',
  riskLevel: 'normal',
  workshopName: 'Простая плотницкая мастерская',
  visualKey: 'wood_blank',
  baseDifficulty: 20,
  baseRisk: 5,
  maxPasses: 5,
};

import type { CarpenterGameResult, CarpenterRiskLevel, HitGrade, TimingZone, PressureZone } from './carpenterGameTypes';

export interface RiskConfig {
  markerBaseSpeed: number;
  goldZoneWidth: number;
  greenZoneWidth: number;
  yellowZoneWidth: number;
  integrityDamageOnBad: number;
  integrityDamageOnCritical: number;
  masteryGainMultiplier: number;
  qualityGainMultiplier: number;
}

export const RISK_CONFIGS: Record<CarpenterRiskLevel, RiskConfig> = {
  safe: {
    markerBaseSpeed: 180,
    goldZoneWidth: 0.14,
    greenZoneWidth: 0.20,
    yellowZoneWidth: 0.20,
    integrityDamageOnBad: 6,
    integrityDamageOnCritical: 12,
    masteryGainMultiplier: 0.5,
    qualityGainMultiplier: 0.8,
  },
  normal: {
    markerBaseSpeed: 260,
    goldZoneWidth: 0.10,
    greenZoneWidth: 0.16,
    yellowZoneWidth: 0.18,
    integrityDamageOnBad: 10,
    integrityDamageOnCritical: 18,
    masteryGainMultiplier: 1.0,
    qualityGainMultiplier: 1.0,
  },
  bold: {
    markerBaseSpeed: 350,
    goldZoneWidth: 0.08,
    greenZoneWidth: 0.14,
    yellowZoneWidth: 0.16,
    integrityDamageOnBad: 14,
    integrityDamageOnCritical: 24,
    masteryGainMultiplier: 1.4,
    qualityGainMultiplier: 1.3,
  },
  dangerous: {
    markerBaseSpeed: 460,
    goldZoneWidth: 0.06,
    greenZoneWidth: 0.10,
    yellowZoneWidth: 0.14,
    integrityDamageOnBad: 18,
    integrityDamageOnCritical: 32,
    masteryGainMultiplier: 1.8,
    qualityGainMultiplier: 1.6,
  },
  insane: {
    markerBaseSpeed: 600,
    goldZoneWidth: 0.04,
    greenZoneWidth: 0.08,
    yellowZoneWidth: 0.14,
    integrityDamageOnBad: 25,
    integrityDamageOnCritical: 45,
    masteryGainMultiplier: 2.5,
    qualityGainMultiplier: 2.0,
  },
};

export const PASS_SPEED_MULTIPLIERS = [1.0, 1.15, 1.35, 1.6, 2.0];

export const PRESSURE_RISE_RATE = 55;
export const PRESSURE_FALL_RATE = 40;

export function getPressureZone(pressure: number): PressureZone {
  if (pressure < 22) return 'low';
  if (pressure < 65) return 'ideal';
  if (pressure < 82) return 'high';
  return 'overpressure';
}

export function getTimingZone(
  markerNorm: number,
  riskLevel: CarpenterRiskLevel,
): TimingZone {
  const cfg = RISK_CONFIGS[riskLevel];
  const center = 0.5;
  const dist = Math.abs(markerNorm - center);
  const halfGold = cfg.goldZoneWidth / 2;
  const halfGreen = halfGold + cfg.greenZoneWidth / 2;
  const halfYellow = halfGreen + cfg.yellowZoneWidth / 2;

  if (dist <= halfGold) return 'gold';
  if (dist <= halfGreen) return 'green';
  if (dist <= halfYellow) return 'yellow';
  return 'red';
}

export function gradeHit(timing: TimingZone, pressure: PressureZone): HitGrade {
  if (pressure === 'overpressure') return 'critical_bad';
  if (timing === 'gold' && (pressure === 'ideal' || pressure === 'high')) return 'perfect';
  if (timing === 'green' && pressure === 'ideal') return 'good';
  if (timing === 'green' && pressure === 'low') return 'normal';
  if (timing === 'gold' && pressure === 'low') return 'normal';
  if (timing === 'yellow') return 'normal';
  return 'bad';
}

export interface HitEffects {
  qualityGain: number;
  progressGain: number;
  masteryGain: number;
  integrityLoss: number;
  isMistake: boolean;
}

export function computeHitEffects(
  grade: HitGrade,
  riskLevel: CarpenterRiskLevel,
  passNumber: number,
): HitEffects {
  const cfg = RISK_CONFIGS[riskLevel];
  const passIdx = Math.min(passNumber - 1, PASS_SPEED_MULTIPLIERS.length - 1);
  const passMult = 1 + passIdx * 0.2;

  switch (grade) {
    case 'perfect':
      return {
        qualityGain: Math.round(12 * cfg.qualityGainMultiplier * passMult),
        progressGain: Math.round(8 * passMult),
        masteryGain: Math.round(15 * cfg.masteryGainMultiplier * passMult),
        integrityLoss: 1,
        isMistake: false,
      };
    case 'good':
      return {
        qualityGain: Math.round(7 * cfg.qualityGainMultiplier * passMult),
        progressGain: Math.round(6 * passMult),
        masteryGain: Math.round(6 * cfg.masteryGainMultiplier * passMult),
        integrityLoss: 2,
        isMistake: false,
      };
    case 'normal':
      return {
        qualityGain: Math.round(3 * cfg.qualityGainMultiplier * passMult),
        progressGain: Math.round(4 * passMult),
        masteryGain: Math.round(2 * cfg.masteryGainMultiplier * passMult),
        integrityLoss: 3,
        isMistake: false,
      };
    case 'bad':
      return {
        qualityGain: 0,
        progressGain: 0,
        masteryGain: 0,
        integrityLoss: cfg.integrityDamageOnBad,
        isMistake: true,
      };
    case 'critical_bad':
      return {
        qualityGain: 0,
        progressGain: 0,
        masteryGain: 0,
        integrityLoss: cfg.integrityDamageOnCritical,
        isMistake: true,
      };
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeGrade(
  quality: number,
  integrity: number,
  progress: number,
): CarpenterGameResult['resultGrade'] {
  if (integrity <= 0) return 'broken';
  if (progress < 40) return 'poor';
  if (quality < 25) return 'poor';
  if (quality < 45) return 'poor';
  if (quality < 65) return 'common';
  if (quality < 80) return 'good';
  if (quality < 92) return 'excellent';
  if (quality < 98) return 'masterwork';
  return 'masterpiece';
}

export function computeTraitRetention(
  qualityScore: number,
  masteryChance: number,
  mistakes: number,
): number {
  return clamp(35 + qualityScore * 0.45 + masteryChance * 0.15 - mistakes * 3, 10, 100);
}

export function getMarkerSpeed(
  riskLevel: CarpenterRiskLevel,
  passNumber: number,
  baseDifficulty: number,
): number {
  const cfg = RISK_CONFIGS[riskLevel];
  const passIdx = Math.min(passNumber - 1, PASS_SPEED_MULTIPLIERS.length - 1);
  const passMult = PASS_SPEED_MULTIPLIERS[passIdx];
  const diffMult = 1 + baseDifficulty / 100;
  return cfg.markerBaseSpeed * passMult * diffMult;
}

export const PASS_DURATION_MS = 7000;
export const HITS_PER_PASS = 4;

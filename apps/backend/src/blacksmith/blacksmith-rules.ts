/**
 * blacksmith-rules.ts
 *
 * Pure (no-DB, no-NestJS) helper functions extracted from BlacksmithService.
 * Exported for unit testing.
 */

import type { SlotUpgradeRules } from '../content/content.types';
import type { SlotUpgradeFailureMode } from './blacksmith.service';

export interface NormalizedUpgradeRules {
  minBlacksmithTier: number;
  goldCost: number;
  materialCosts: Array<{ itemId: string; quantity: number }>;
  successChancePercent: number;
  failureModes: SlotUpgradeFailureMode[];
}

export function normalizeUpgradeRules(rules: SlotUpgradeRules | undefined): NormalizedUpgradeRules {
  return {
    minBlacksmithTier: Math.max(
      1,
      Number.isFinite(rules?.minBlacksmithTier ?? NaN) ? Math.floor(rules?.minBlacksmithTier ?? 1) : 1,
    ),
    goldCost: Math.max(
      0,
      Number.isFinite(rules?.goldCost ?? NaN) ? Math.floor(rules?.goldCost ?? 0) : 0,
    ),
    materialCosts: Array.isArray(rules?.materialCosts)
      ? rules!.materialCosts
          .map((entry) => ({
            itemId: String(entry?.itemId ?? '').trim(),
            quantity: Math.max(
              1,
              Number.isFinite(entry?.quantity ?? NaN) ? Math.floor(entry?.quantity ?? 1) : 1,
            ),
          }))
          .filter((entry) => entry.itemId.length > 0)
      : [],
    successChancePercent: Math.max(
      0,
      Math.min(
        100,
        Number.isFinite(rules?.successChancePercent ?? NaN) ? Number(rules?.successChancePercent) : 100,
      ),
    ),
    failureModes: normalizeFailureModes(rules?.failureModes),
  };
}

export function normalizeFailureModes(value: SlotUpgradeRules['failureModes']): SlotUpgradeFailureMode[] {
  const modes = Array.isArray(value)
    ? value.filter(
        (entry): entry is SlotUpgradeFailureMode =>
          entry === 'none' ||
          entry === 'material_lost' ||
          entry === 'item_damaged' ||
          entry === 'slot_locked',
      )
    : [];
  return modes.length > 0 ? modes : ['none'];
}

export function normalizeRoll(value?: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.floor(value)));
  }
  return Math.floor(Math.random() * 101);
}

export function pickFailureMode(modes: SlotUpgradeFailureMode[], roll?: number): SlotUpgradeFailureMode {
  if (modes.length === 0) {
    return 'none';
  }
  if (modes.length === 1) {
    return modes[0];
  }
  const normalizedRoll = normalizeRoll(roll);
  const index = Math.min(modes.length - 1, Math.floor((normalizedRoll / 100) * modes.length));
  return modes[index] ?? 'none';
}

export function resolveUpgradeOutcome(
  rules: Pick<NormalizedUpgradeRules, 'successChancePercent' | 'failureModes'>,
  options?: { successRollPercent?: number; failureRollPercent?: number },
): {
  success: boolean;
  failureMode: SlotUpgradeFailureMode;
  successChancePercent: number;
  rollPercent: number;
} {
  const rollPercent = normalizeRoll(options?.successRollPercent);
  const success = rollPercent < rules.successChancePercent;
  if (success) {
    return {
      success: true,
      failureMode: 'none',
      successChancePercent: rules.successChancePercent,
      rollPercent,
    };
  }

  const failureMode = pickFailureMode(rules.failureModes, options?.failureRollPercent);
  return {
    success: false,
    failureMode,
    successChancePercent: rules.successChancePercent,
    rollPercent,
  };
}

export function checkMaxAugmentSlots(currentSlotCount: number, maxAugmentSlots: number | undefined, definitionSlotCount: number): boolean {
  const max = typeof maxAugmentSlots === 'number' && Number.isFinite(maxAugmentSlots)
    ? Math.max(0, Math.floor(maxAugmentSlots))
    : definitionSlotCount;
  return currentSlotCount < max;
}

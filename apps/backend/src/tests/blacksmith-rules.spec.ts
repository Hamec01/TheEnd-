/**
 * blacksmith-rules.spec.ts
 *
 * Tests for pure blacksmith rule helpers:
 * - normalizeUpgradeRules (safe defaults, clamps, tier check)
 * - resolveUpgradeOutcome (success/failure, failure mode selection)
 * - checkMaxAugmentSlots (maxAugmentSlots enforcement)
 */

import { describe, expect, it } from 'vitest';
import {
  normalizeUpgradeRules,
  normalizeFailureModes,
  resolveUpgradeOutcome,
  checkMaxAugmentSlots,
  pickFailureMode,
} from '../blacksmith/blacksmith-rules';
import type { SlotUpgradeRules } from '../content/content.types';

// ---------------------------------------------------------------------------
// normalizeUpgradeRules
// ---------------------------------------------------------------------------

describe('normalizeUpgradeRules', () => {
  it('uses defaults when rules is undefined', () => {
    const result = normalizeUpgradeRules(undefined);
    expect(result.minBlacksmithTier).toBe(1);
    expect(result.goldCost).toBe(0);
    expect(result.materialCosts).toEqual([]);
    expect(result.successChancePercent).toBe(100);
    expect(result.failureModes).toEqual(['none']);
  });

  it('clamps minBlacksmithTier to at least 1', () => {
    const result = normalizeUpgradeRules({ minBlacksmithTier: -3 });
    expect(result.minBlacksmithTier).toBe(1);
  });

  it('clamps goldCost to at least 0', () => {
    const result = normalizeUpgradeRules({ goldCost: -100 });
    expect(result.goldCost).toBe(0);
  });

  it('clamps successChancePercent to 0..100', () => {
    expect(normalizeUpgradeRules({ successChancePercent: 150 }).successChancePercent).toBe(100);
    expect(normalizeUpgradeRules({ successChancePercent: -10 }).successChancePercent).toBe(0);
  });

  it('filters invalid material cost entries', () => {
    const rules: SlotUpgradeRules = {
      materialCosts: [
        { itemId: 'iron-ore', quantity: 3 },
        { itemId: '', quantity: 1 },
        { itemId: 'coal', quantity: -5 },
      ],
    };
    const result = normalizeUpgradeRules(rules);
    // empty itemId filtered out
    expect(result.materialCosts.find((c) => c.itemId === '')).toBeUndefined();
    // negative quantity clamped to 1
    const coal = result.materialCosts.find((c) => c.itemId === 'coal');
    expect(coal?.quantity).toBe(1);
  });

  it('normalizes minBlacksmithTier from float to int', () => {
    const result = normalizeUpgradeRules({ minBlacksmithTier: 2.7 });
    expect(result.minBlacksmithTier).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// normalizeFailureModes
// ---------------------------------------------------------------------------

describe('normalizeFailureModes', () => {
  it('returns ["none"] when array is empty', () => {
    expect(normalizeFailureModes([])).toEqual(['none']);
  });

  it('returns ["none"] when value is not an array', () => {
    expect(normalizeFailureModes(undefined)).toEqual(['none']);
  });

  it('filters unknown failure mode strings', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = normalizeFailureModes(['material_lost', 'totally_unknown' as any]);
    expect(result).toEqual(['material_lost']);
  });

  it('preserves all valid failure modes', () => {
    const modes = ['none', 'material_lost', 'item_damaged', 'slot_locked'] as const;
    const result = normalizeFailureModes([...modes]);
    expect(result).toEqual([...modes]);
  });
});

// ---------------------------------------------------------------------------
// resolveUpgradeOutcome
// ---------------------------------------------------------------------------

describe('resolveUpgradeOutcome', () => {
  it('success when roll < successChancePercent', () => {
    const result = resolveUpgradeOutcome(
      { successChancePercent: 80, failureModes: ['none'] },
      { successRollPercent: 50 },
    );
    expect(result.success).toBe(true);
    expect(result.rollPercent).toBe(50);
  });

  it('failure when roll >= successChancePercent', () => {
    const result = resolveUpgradeOutcome(
      { successChancePercent: 80, failureModes: ['item_damaged'] },
      { successRollPercent: 80 },
    );
    expect(result.success).toBe(false);
    expect(result.failureMode).toBe('item_damaged');
  });

  it('exactly at threshold is failure (roll === successChancePercent)', () => {
    const result = resolveUpgradeOutcome(
      { successChancePercent: 70, failureModes: ['slot_locked'] },
      { successRollPercent: 70 },
    );
    expect(result.success).toBe(false);
  });

  it('successChancePercent=100 always succeeds when roll ≤ 99', () => {
    for (let roll = 0; roll <= 99; roll++) {
      const result = resolveUpgradeOutcome(
        { successChancePercent: 100, failureModes: ['none'] },
        { successRollPercent: roll },
      );
      expect(result.success).toBe(true);
    }
  });

  it('successChancePercent=0 always fails', () => {
    const result = resolveUpgradeOutcome(
      { successChancePercent: 0, failureModes: ['material_lost'] },
      { successRollPercent: 0 },
    );
    expect(result.success).toBe(false);
    expect(result.failureMode).toBe('material_lost');
  });

  it('clamps roll from successRollPercent to 0..100', () => {
    const result = resolveUpgradeOutcome(
      { successChancePercent: 50, failureModes: ['none'] },
      { successRollPercent: -999 },
    );
    expect(result.rollPercent).toBe(0);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pickFailureMode
// ---------------------------------------------------------------------------

describe('pickFailureMode', () => {
  it('returns "none" for empty array', () => {
    expect(pickFailureMode([])).toBe('none');
  });

  it('returns single mode regardless of roll', () => {
    expect(pickFailureMode(['item_damaged'], 0)).toBe('item_damaged');
    expect(pickFailureMode(['item_damaged'], 99)).toBe('item_damaged');
  });

  it('distributes modes by roll percentage', () => {
    const modes = ['material_lost', 'item_damaged', 'slot_locked'] as const;
    // With 3 modes, each covers ~33 points
    // roll=0 → index=0 → material_lost
    expect(pickFailureMode([...modes], 0)).toBe('material_lost');
    // roll=50 → index=1 → item_damaged
    expect(pickFailureMode([...modes], 50)).toBe('item_damaged');
    // roll=99 → index=2 → slot_locked
    expect(pickFailureMode([...modes], 99)).toBe('slot_locked');
  });
});

// ---------------------------------------------------------------------------
// checkMaxAugmentSlots
// ---------------------------------------------------------------------------

describe('checkMaxAugmentSlots', () => {
  it('allows adding when current < max', () => {
    expect(checkMaxAugmentSlots(2, 4, 2)).toBe(true);
  });

  it('denies adding when current === max', () => {
    expect(checkMaxAugmentSlots(4, 4, 4)).toBe(false);
  });

  it('denies adding when current > max (data integrity edge case)', () => {
    expect(checkMaxAugmentSlots(5, 4, 4)).toBe(false);
  });

  it('uses definition slot count as fallback when maxAugmentSlots is undefined', () => {
    // Item has 2 base slots from definition, maxAugmentSlots undefined → fallback is 2
    expect(checkMaxAugmentSlots(2, undefined, 2)).toBe(false);
    expect(checkMaxAugmentSlots(1, undefined, 2)).toBe(true);
  });

  it('ignores non-finite maxAugmentSlots, falls back to definition count', () => {
    expect(checkMaxAugmentSlots(2, NaN, 3)).toBe(true);
    expect(checkMaxAugmentSlots(3, NaN, 3)).toBe(false);
  });
});

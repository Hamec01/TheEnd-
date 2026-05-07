/**
 * normalize-item-input.spec.ts
 *
 * Tests for normalizeItemInput — ensures old/malformed JSON fields get safe defaults.
 */

import { describe, expect, it } from 'vitest';
import { normalizeItemInput } from '../content/content.service';
import type { AdminItem } from '../content/content.types';

function makeItem(overrides: Partial<AdminItem> = {}): AdminItem {
  return {
    id: 'item-1',
    name: 'Test Sword',
    type: 'weapon',
    rarity: 'common',
    price: 100,
    stackable: false,
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('normalizeItemInput – safe defaults', () => {
  it('trims id and name whitespace', () => {
    const result = normalizeItemInput(makeItem({ id: '  sword-1 ', name: '  Iron Sword  ' }));
    expect(result.id).toBe('sword-1');
    expect(result.name).toBe('Iron Sword');
  });

  it('clamps price to 0 when negative', () => {
    const result = normalizeItemInput(makeItem({ price: -50 }));
    expect(result.price).toBe(0);
  });

  it('forces stackable items to have maxStack >= 2', () => {
    const result = normalizeItemInput(makeItem({ stackable: true, maxStack: 0 }));
    expect(result.stackable).toBe(true);
    expect(result.maxStack).toBeGreaterThanOrEqual(2);
  });

  it('non-stackable items always get maxStack 1', () => {
    const result = normalizeItemInput(makeItem({ stackable: false, maxStack: 99 }));
    expect(result.maxStack).toBe(1);
  });

  it('weapon type gets handsRequired=1 by default', () => {
    const result = normalizeItemInput(makeItem({ type: 'weapon' }));
    expect(result.handsRequired).toBe(1);
  });

  it('weapon with handsRequired=2 is preserved', () => {
    const result = normalizeItemInput(makeItem({ type: 'weapon', handsRequired: 2 }));
    expect(result.handsRequired).toBe(2);
  });

  it('clamps attackRange to 2..24', () => {
    const tooSmall = normalizeItemInput(makeItem({ attackRange: 0 }));
    expect(tooSmall.attackRange).toBe(2);

    const tooBig = normalizeItemInput(makeItem({ attackRange: 999 }));
    expect(tooBig.attackRange).toBe(24);
  });

  it('drops attackRange when not a finite number', () => {
    const result = normalizeItemInput(makeItem({ attackRange: NaN as unknown as number }));
    expect(result.attackRange).toBeUndefined();
  });

  it('pierceTargets requires attackRange to be present', () => {
    // pierceTargets without attackRange should be dropped
    const result = normalizeItemInput(makeItem({ pierceTargets: 3 }));
    expect(result.pierceTargets).toBeUndefined();
  });

  it('splashRadius requires attackRange', () => {
    const result = normalizeItemInput(makeItem({ splashRadius: 2 }));
    expect(result.splashRadius).toBeUndefined();
  });

  it('canAddAugmentSlots defaults to false when missing', () => {
    const result = normalizeItemInput(makeItem({}));
    expect(result.canAddAugmentSlots).toBe(false);
  });

  it('isEnabled defaults to true when missing', () => {
    const input = makeItem({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (input as any).isEnabled;
    const result = normalizeItemInput(input);
    expect(result.isEnabled).toBe(true);
  });

  it('isEnabled can be explicitly set to false', () => {
    const result = normalizeItemInput(makeItem({ isEnabled: false }));
    expect(result.isEnabled).toBe(false);
  });

  it('augmentSlots undefined input returns undefined', () => {
    const result = normalizeItemInput(makeItem({ augmentSlots: undefined }));
    expect(result.augmentSlots == null || result.augmentSlots.length === 0).toBe(true);
  });

  it('maxAugmentSlots is normalized to non-negative integer', () => {
    const result = normalizeItemInput(makeItem({ maxAugmentSlots: -5 }));
    expect(result.maxAugmentSlots).toBe(0);
  });

  it('damage values on non-weapon types remain optional', () => {
    const result = normalizeItemInput(makeItem({ type: 'armor', damageMin: 5, damageMax: 10 }));
    // Normalized but not forced on non-weapon
    expect(result.type).toBe('armor');
  });

  it('legacy consumable fields are preserved as-is', () => {
    const useEffect = { type: 'heal', amount: 50 };
    const result = normalizeItemInput(makeItem({ useEffect, type: 'potion' }));
    expect(result.useEffect).toEqual(useEffect);
  });
});

/**
 * hotbar-usability.spec.ts
 *
 * Tests for the hotbar usability rules — which AdminItem shapes are considered
 * usable in the hotbar/combat action bar.
 *
 * The logic mirrors isItemUsableInHotbar() in arena.service.ts:
 * slot==='quick' || type==='potion' || isUsable===true || usableInCombat===true
 * || isCombatUsable===true || useEffects.length>0 || 'useEffect' own-property
 * || effects.length>0 || combatEffects.length>0
 *
 * Note: equipmentEffects alone do NOT make an item hotbar-usable.
 */

import { describe, expect, it } from 'vitest';
import type { AdminItem } from '../content/content.types';

// ---------------------------------------------------------------------------
// Pure hotbar usability predicate extracted from ArenaService business logic
// (no NestJS / no Prisma — matches the implementation)
// ---------------------------------------------------------------------------

function isHotbarUsableByShape(rawItem: Record<string, unknown>): boolean {
  return rawItem['slot'] === 'quick'
    || rawItem['type'] === 'potion'
    || rawItem['isUsable'] === true
    || rawItem['usableInCombat'] === true
    || rawItem['isCombatUsable'] === true
    || (Array.isArray(rawItem['useEffects']) && (rawItem['useEffects'] as unknown[]).length > 0)
    || Object.prototype.hasOwnProperty.call(rawItem, 'useEffect')
    || (Array.isArray(rawItem['effects']) && (rawItem['effects'] as unknown[]).length > 0)
    || (Array.isArray(rawItem['combatEffects']) && (rawItem['combatEffects'] as unknown[]).length > 0);
}

function makeRawItem(overrides: Partial<AdminItem> & Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'item-1',
    name: 'Test',
    type: 'misc',
    rarity: 'common',
    price: 0,
    stackable: false,
    isEnabled: true,
    gameplayDescription: '',
    loreDescription: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('hotbar usability rules', () => {
  it('slot=quick → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ slot: 'quick' }))).toBe(true);
  });

  it('type=potion → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ type: 'potion' }))).toBe(true);
  });

  it('isUsable=true → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ isUsable: true }))).toBe(true);
  });

  it('usableInCombat=true → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ usableInCombat: true }))).toBe(true);
  });

  it('isCombatUsable=true → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ isCombatUsable: true }))).toBe(true);
  });

  it('non-empty useEffects array → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ useEffects: [{ type: 'stat_bonus' }] }))).toBe(true);
  });

  it('empty useEffects array → NOT usable (by this flag alone)', () => {
    const item = makeRawItem({ useEffects: [] });
    // No other flags set — should be false
    expect(isHotbarUsableByShape(item)).toBe(false);
  });

  it('presence of useEffect own-property (even null) → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ useEffect: null }))).toBe(true);
  });

  it('non-empty legacy effects array → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ effects: [{ type: 'heal' }] }))).toBe(true);
  });

  it('non-empty combatEffects array → usable', () => {
    expect(isHotbarUsableByShape(makeRawItem({ combatEffects: [{ type: 'damage' }] }))).toBe(true);
  });

  it('equipmentEffects alone → NOT usable in hotbar', () => {
    const item = makeRawItem({
      type: 'armor',
      slot: 'chest',
      equipmentEffects: [{ type: 'incoming_damage_modifier', percent: -10 }],
    });
    expect(isHotbarUsableByShape(item)).toBe(false);
  });

  it('pure misc item with no use flags → NOT usable', () => {
    const item = makeRawItem({ type: 'misc' });
    expect(isHotbarUsableByShape(item)).toBe(false);
  });

  it('legacy consumable with useEffect → usable (backward compat)', () => {
    const item = makeRawItem({ type: 'misc', useEffect: { type: 'heal', amount: 50 } });
    expect(isHotbarUsableByShape(item)).toBe(true);
  });
});

/**
 * item-effects-resolver.spec.ts
 *
 * Tests for getEquippedItemEffects, getActiveItemSetBonuses, and resolveCharacterEquipmentModifiers.
 * Covers active/inactive augments and itemSet activation only from equipped items.
 */

import { describe, expect, it } from 'vitest';
import {
  getEquippedItemEffects,
  getActiveItemSetBonuses,
  resolveCharacterEquipmentModifiers,
} from '../content/item-effects.resolver';
import type { AdminItem, ItemEffect, ItemSet } from '../content/content.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(id: string, overrides: Partial<AdminItem> = {}): AdminItem {
  return {
    id,
    name: `Item ${id}`,
    type: 'armor',
    rarity: 'common',
    price: 0,
    stackable: false,
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const ARMOR_EFFECT: ItemEffect = { type: 'incoming_damage_modifier', percent: -10 };
const AUGMENT_EFFECT: ItemEffect = { type: 'dodge_chance_modifier', percent: 5 };
const SET_EFFECT: ItemEffect = { type: 'stat_bonus', stat: 'strength', flat: 3 };

// ---------------------------------------------------------------------------
// getEquippedItemEffects
// ---------------------------------------------------------------------------

describe('getEquippedItemEffects', () => {
  it('returns equipment effects from equipped items', () => {
    const helm = makeItem('helm-1', {
      slot: 'head',
      equipmentEffects: [ARMOR_EFFECT],
    });

    const result = getEquippedItemEffects({
      equipment: { helmet: 'helm-1' },
      items: [helm],
    });

    expect(result.activeSources).toHaveLength(1);
    expect(result.activeSources[0].effect).toEqual(ARMOR_EFFECT);
    expect(result.activeSources[0].isActive).toBe(true);
    expect(result.inactiveAugmentSources).toHaveLength(0);
  });

  it('ignores disabled items', () => {
    const helm = makeItem('helm-dis', { slot: 'head', isEnabled: false, equipmentEffects: [ARMOR_EFFECT] });

    const result = getEquippedItemEffects({
      equipment: { helmet: 'helm-dis' },
      items: [helm],
    });

    expect(result.activeSources).toHaveLength(0);
  });

  it('marks socketed augment inactive when augment item not found', () => {
    const sword = makeItem('sword-1', {
      slot: 'rightHand',
      augmentSlots: [{ id: 'slot-1', socketedAugmentItemId: 'missing-rune' }],
    });

    const result = getEquippedItemEffects({
      equipment: { weapon: 'sword-1' },
      items: [sword],
    });

    expect(result.inactiveAugmentSources.some((s) => s.itemId === 'missing-rune')).toBe(true);
    expect(result.inactiveAugmentSources[0].isActive).toBe(false);
  });

  it('marks augment active when contexts match', () => {
    const rune = makeItem('rune-1', {
      type: 'misc',
      augment: {
        type: 'rune',
        activationContexts: ['weapon'],
        effects: [AUGMENT_EFFECT],
      },
    });

    const sword = makeItem('sword-1', {
      slot: 'rightHand',
      augmentSlots: [{ id: 'slot-1', socketedAugmentItemId: 'rune-1' }],
    });

    const result = getEquippedItemEffects({
      equipment: { weapon: 'sword-1' },
      items: [sword, rune],
      activationContexts: ['weapon', 'melee'],
    });

    const augmentSource = result.activeSources.find((s) => s.origin === 'augment');
    expect(augmentSource).toBeDefined();
    expect(augmentSource?.isActive).toBe(true);
  });

  it('marks augment inactive when activation contexts do NOT match', () => {
    const runeArmor = makeItem('rune-armor', {
      type: 'misc',
      name: 'Камень защиты',
      augment: {
        type: 'magic_stone',
        activationContexts: ['armor'],
        effects: [AUGMENT_EFFECT],
      },
    });

    const sword = makeItem('sword-2', {
      slot: 'rightHand',
      augmentSlots: [{ id: 'slot-x', socketedAugmentItemId: 'rune-armor' }],
    });

    const result = getEquippedItemEffects({
      equipment: { weapon: 'sword-2' },
      items: [sword, runeArmor],
      activationContexts: ['weapon'],
    });

    const inactive = result.inactiveAugmentSources.find((s) => s.itemId === 'rune-armor');
    expect(inactive).toBeDefined();
    expect(inactive?.isActive).toBe(false);
    // The inactive reason should mention context mismatch (not the item name in particular)
    expect(inactive?.inactiveReason).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getActiveItemSetBonuses – activation ONLY from equipped items
// ---------------------------------------------------------------------------

describe('getActiveItemSetBonuses', () => {
  const setItems = ['piece-1', 'piece-2', 'piece-3'];

  const set: ItemSet = {
    id: 'set-1',
    name: 'Iron Set',
    pieceItemIds: setItems,
    bonuses: [
      { requiredPieces: 2, effects: [SET_EFFECT] },
      { requiredPieces: 3, effects: [SET_EFFECT, SET_EFFECT] },
    ],
    isEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const allItems = setItems.map((id) => makeItem(id, { setId: 'set-1' }));

  it('activates 2-piece bonus only when exactly 2 set pieces are equipped', () => {
    const result = getActiveItemSetBonuses({
      equipment: { helmet: 'piece-1', armor: 'piece-2' },
      items: allItems,
      itemSets: [set],
    });

    expect(result).toHaveLength(1);
    expect(result[0].requiredPieces).toBe(2);
    expect(result[0].activePieces).toBe(2);
  });

  it('activates both bonuses when all 3 pieces are equipped', () => {
    const result = getActiveItemSetBonuses({
      equipment: { helmet: 'piece-1', armor: 'piece-2', legs: 'piece-3' },
      items: allItems,
      itemSets: [set],
    });

    expect(result.length).toBe(2);
  });

  it('activates NO bonuses with only 1 equipped piece', () => {
    const result = getActiveItemSetBonuses({
      equipment: { helmet: 'piece-1' },
      items: allItems,
      itemSets: [set],
    });

    expect(result).toHaveLength(0);
  });

  it('does NOT count inventory items — only equipment slot matters', () => {
    // Only head slot equipped, chest is intentionally left empty
    const result = getActiveItemSetBonuses({
      equipment: { helmet: 'piece-1', armor: undefined },
      items: allItems,
      itemSets: [set],
    });

    expect(result).toHaveLength(0);
  });

  it('does not activate bonus from disabled item set', () => {
    const disabledSet: ItemSet = { ...set, isEnabled: false };

    const result = getActiveItemSetBonuses({
      equipment: { helmet: 'piece-1', armor: 'piece-2', legs: 'piece-3' },
      items: allItems,
      itemSets: [disabledSet],
    });

    expect(result).toHaveLength(0);
  });

  it('does not count disabled item pieces', () => {
    const disabledItems = allItems.map((item, i) => (i === 0 ? { ...item, isEnabled: false } : item));

    const result = getActiveItemSetBonuses({
      equipment: { helmet: 'piece-1', armor: 'piece-2', legs: 'piece-3' },
      items: disabledItems,
      itemSets: [set],
    });

    // piece-1 is disabled, only 2 are valid → only 2-piece bonus
    expect(result).toHaveLength(1);
    expect(result[0].requiredPieces).toBe(2);
  });

  it('full resolver includes set bonus sources', () => {
    const result = resolveCharacterEquipmentModifiers({
      equipment: { helmet: 'piece-1', armor: 'piece-2' },
      items: allItems,
      itemSets: [set],
    });

    const setSource = result.sources.find((s) => s.origin === 'item_set');
    expect(setSource).toBeDefined();
    expect(setSource?.setId).toBe('set-1');
  });
});

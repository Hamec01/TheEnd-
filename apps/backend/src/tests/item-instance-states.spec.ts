/**
 * item-instance-states.spec.ts
 *
 * Tests for:
 * - normalizeCharacterItemInstanceState — safe parsing from DB JSONB
 * - Two identical swords with different instance states (sockets, locks)
 * - buildItemPreview with instanceSocketState override
 */

import { describe, expect, it } from 'vitest';
import { normalizeCharacterItemInstanceState } from '../characters/character-item-instance.types';
import { buildItemPreview } from '../content/admin-preview.builder';
import type { AdminItem } from '../content/content.types';

// ---------------------------------------------------------------------------
// normalizeCharacterItemInstanceState
// ---------------------------------------------------------------------------

describe('normalizeCharacterItemInstanceState', () => {
  it('returns null for null input', () => {
    expect(normalizeCharacterItemInstanceState(null)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizeCharacterItemInstanceState('bad')).toBeNull();
    expect(normalizeCharacterItemInstanceState(42)).toBeNull();
  });

  it('returns version=1 state from well-formed object', () => {
    const state = normalizeCharacterItemInstanceState({ version: 1, augmentSlots: [] });
    expect(state?.version).toBe(1);
    expect(state?.augmentSlots).toEqual([]);
  });

  it('preserves augmentSlots with socketedAugmentItemId', () => {
    const raw = {
      version: 1,
      augmentSlots: [
        { socketId: 'slot-1', socketedAugmentItemId: 'rune-fire', isLocked: false, source: 'base' },
      ],
    };
    const state = normalizeCharacterItemInstanceState(raw);
    expect(state?.augmentSlots).toHaveLength(1);
    expect(state?.augmentSlots?.[0].socketId).toBe('slot-1');
    expect(state?.augmentSlots?.[0].socketedAugmentItemId).toBe('rune-fire');
  });

  it('filters out null augmentSlots entries', () => {
    const raw = {
      version: 1,
      augmentSlots: [null, { socketId: 'slot-ok', isLocked: false }, undefined],
    };
    const state = normalizeCharacterItemInstanceState(raw);
    expect(state?.augmentSlots).toHaveLength(1);
    expect(state?.augmentSlots?.[0].socketId).toBe('slot-ok');
  });

  it('handles missing optional fields gracefully', () => {
    const raw = { version: 1 };
    const state = normalizeCharacterItemInstanceState(raw);
    expect(state?.augmentSlots).toBeUndefined();
    expect(state?.qualityTier).toBeUndefined();
    expect(state?.metadata).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Two identical swords with different instance states
// ---------------------------------------------------------------------------

describe('two identical swords with different instance states', () => {
  const runeItem: AdminItem = {
    id: 'rune-fire',
    name: 'Руна огня',
    type: 'misc',
    rarity: 'rare',
    price: 200,
    stackable: false,
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
    augment: {
      type: 'rune',
      effects: [{ type: 'outgoing_damage_modifier', percent: 15, elementType: 'fire' }],
    },
  };

  const baseSword: AdminItem = {
    id: 'sword-template',
    name: 'Iron Sword',
    type: 'weapon',
    rarity: 'uncommon',
    price: 150,
    stackable: false,
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
    equipmentEffects: [{ type: 'outgoing_damage_modifier', percent: 5 }],
    augmentSlots: [{ id: 'slot-base', isLocked: false }],
  };

  const allItems = [baseSword, runeItem];

  it('instance A — empty slot, no augment effects in humanReadable', () => {
    const preview = buildItemPreview(baseSword, allItems, [], {
      instanceSocketState: [{ socketId: 'slot-base' }],
    });
    expect(preview.socketsPreview[0].status).toBe('empty');
    // Only the base equipmentEffect
    expect(preview.humanReadableEffects).toHaveLength(1);
  });

  it('instance B — rune inserted and active (no context restriction)', () => {
    const preview = buildItemPreview(baseSword, allItems, [], {
      instanceSocketState: [{ socketId: 'slot-base', socketedAugmentItemId: 'rune-fire' }],
    });
    expect(preview.socketsPreview[0].status).toBe('occupied_active');
    // equipmentEffect + rune effect
    expect(preview.humanReadableEffects).toHaveLength(2);
    expect(preview.inactiveAugments).toHaveLength(0);
  });

  it('instance C — rune inserted but locked socket', () => {
    const preview = buildItemPreview(baseSword, allItems, [], {
      instanceSocketState: [{ socketId: 'slot-base', socketedAugmentItemId: 'rune-fire', isLocked: true }],
    });
    expect(preview.socketsPreview[0].status).toBe('locked');
  });

  it('instance D — rune inactive (context mismatch: weapon-only rune on armor context)', () => {
    const armorRune: AdminItem = {
      ...runeItem,
      id: 'rune-armor',
      name: 'Камень защиты',
      augment: {
        type: 'magic_stone',
        activationContexts: ['armor'],
        effects: [{ type: 'incoming_damage_modifier', percent: -10 }],
      },
    };

    const preview = buildItemPreview(baseSword, [baseSword, armorRune], [], {
      activationContexts: ['weapon'],
      instanceSocketState: [{ socketId: 'slot-base', socketedAugmentItemId: 'rune-armor' }],
    });
    expect(preview.socketsPreview[0].status).toBe('occupied_inactive');
    expect(preview.inactiveAugments).toHaveLength(1);
    expect(preview.inactiveAugments[0].inactiveReason).toContain('armor');
  });

  it('two swords: same template, different instance states are independent', () => {
    const swordA = buildItemPreview(baseSword, allItems, [], {
      instanceSocketState: [],
    });
    const swordB = buildItemPreview(baseSword, allItems, [], {
      instanceSocketState: [{ socketId: 'slot-base', socketedAugmentItemId: 'rune-fire' }],
    });

    expect(swordA.socketsPreview[0].status).toBe('empty');
    expect(swordB.socketsPreview[0].status).toBe('occupied_active');
    // They share the same itemId but have different preview results
    expect(swordA.humanReadableEffects).not.toEqual(swordB.humanReadableEffects);
  });
});

// ---------------------------------------------------------------------------
// Legacy consumables unaffected
// ---------------------------------------------------------------------------

describe('legacy consumables — normalizeItemInput preserves useEffect', () => {
  it('normalizeCharacterItemInstanceState — consumable state without augmentSlots', () => {
    // A legacy potion that was stored without any augment state
    const raw = { version: 1, qualityTier: undefined, metadata: { source: 'loot' } };
    const state = normalizeCharacterItemInstanceState(raw);
    expect(state?.augmentSlots).toBeUndefined();
    expect(state?.metadata?.['source']).toBe('loot');
  });
});

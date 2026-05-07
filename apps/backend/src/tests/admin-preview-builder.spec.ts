/**
 * admin-preview-builder.spec.ts
 *
 * Tests for buildItemPreview, buildItemSetPreview, buildRuneComplexPreview.
 */

import { describe, expect, it } from 'vitest';
import {
  buildItemPreview,
  buildItemSetPreview,
  buildRuneComplexPreview,
} from '../content/admin-preview.builder';
import type { AdminItem, ItemSet, RuneComplex } from '../content/content.types';

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
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeSet(id: string, pieceIds: string[], overrides: Partial<ItemSet> = {}): ItemSet {
  return {
    id,
    name: `Set ${id}`,
    pieceItemIds: pieceIds,
    bonuses: [],
    isEnabled: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildItemPreview
// ---------------------------------------------------------------------------

describe('buildItemPreview', () => {
  it('returns itemId and itemName', () => {
    const item = makeItem('sword-1', { name: 'Ancient Sword' });
    const preview = buildItemPreview(item, [item], []);
    expect(preview.itemId).toBe('sword-1');
    expect(preview.itemName).toBe('Ancient Sword');
  });

  it('humanReadableEffects includes equipment effects', () => {
    const item = makeItem('sword-1', {
      equipmentEffects: [{ type: 'outgoing_damage_modifier', percent: 10 }],
    });
    const preview = buildItemPreview(item, [item], []);
    expect(preview.humanReadableEffects.length).toBeGreaterThan(0);
    expect(preview.humanReadableEffects[0]).toContain('%');
  });

  it('socketsPreview has an entry for each augmentSlot', () => {
    const item = makeItem('sword-1', {
      augmentSlots: [
        { id: 'slot-1' },
        { id: 'slot-2' },
      ],
    });
    const preview = buildItemPreview(item, [item], []);
    expect(preview.socketsPreview).toHaveLength(2);
  });

  it('empty socket has status "empty"', () => {
    const item = makeItem('sword-1', { augmentSlots: [{ id: 'slot-empty' }] });
    const preview = buildItemPreview(item, [item], []);
    expect(preview.socketsPreview[0].status).toBe('empty');
  });

  it('locked socket has status "locked"', () => {
    const item = makeItem('sword-1', { augmentSlots: [{ id: 'slot-lock', isLocked: true }] });
    const preview = buildItemPreview(item, [item], []);
    expect(preview.socketsPreview[0].status).toBe('locked');
  });

  it('sets setPreview when item has setId', () => {
    const item = makeItem('piece-1', { setId: 'set-a' });
    const set = makeSet('set-a', ['piece-1']);
    const preview = buildItemPreview(item, [item], [set]);
    expect(preview.setPreview).toBeDefined();
    expect(preview.setPreview?.setId).toBe('set-a');
  });

  it('no setPreview when item has no setId', () => {
    const item = makeItem('misc-1');
    const preview = buildItemPreview(item, [item], []);
    expect(preview.setPreview).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildItemSetPreview
// ---------------------------------------------------------------------------

describe('buildItemSetPreview', () => {
  it('maps piece names from allItems', () => {
    const piece1 = makeItem('p1', { name: 'Iron Helm' });
    const piece2 = makeItem('p2', { name: 'Iron Chest' });
    const set = makeSet('set-iron', ['p1', 'p2'], {
      name: 'Iron Set',
      bonuses: [
        { requiredPieces: 2, effects: [{ type: 'stat_bonus', stat: 'constitution', flat: 5 }] },
      ],
    });

    const preview = buildItemSetPreview(set, [piece1, piece2]);
    expect(preview.setName).toBe('Iron Set');
    expect(preview.pieces.map((p) => p.itemName)).toEqual(['Iron Helm', 'Iron Chest']);
    expect(preview.bonuses[0].effects.length).toBeGreaterThan(0);
  });

  it('uses itemId as fallback name when item not found', () => {
    const set = makeSet('set-orphan', ['unknown-piece']);
    const preview = buildItemSetPreview(set, []);
    expect(preview.pieces[0].itemName).toBe('unknown-piece');
    expect(preview.pieces[0].isEnabled).toBe(false);
  });

  it('bonuses list effects in Russian', () => {
    const set = makeSet('set-def', ['p1'], {
      bonuses: [
        {
          requiredPieces: 1,
          description: 'Bonus!',
          effects: [{ type: 'incoming_damage_modifier', percent: -20, physicalType: 'slash' }],
        },
      ],
    });
    const preview = buildItemSetPreview(set, [makeItem('p1')]);
    expect(preview.bonuses[0].description).toBe('Bonus!');
    expect(preview.bonuses[0].effects[0]).toContain('рубящего');
  });
});

// ---------------------------------------------------------------------------
// buildRuneComplexPreview
// ---------------------------------------------------------------------------

describe('buildRuneComplexPreview', () => {
  it('maps rune names and effects', () => {
    const rune = makeItem('rune-1', {
      name: 'Fire Rune',
      augment: {
        type: 'rune',
        effects: [{ type: 'outgoing_damage_modifier', percent: 10, elementType: 'fire' }],
      },
    });

    const complex: RuneComplex = {
      id: 'complex-fire',
      name: 'Fire Complex',
      runeItemIds: ['rune-1'],
      gameplayDescription: 'Powers of fire',
      isEnabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const preview = buildRuneComplexPreview(complex, [rune]);
    expect(preview.complexId).toBe('complex-fire');
    expect(preview.complexName).toBe('Fire Complex');
    expect(preview.gameplayDescription).toBe('Powers of fire');
    expect(preview.runes[0].itemName).toBe('Fire Rune');
    expect(preview.runes[0].effects[0]).toContain('огненного');
  });

  it('falls back to itemId when rune not found', () => {
    const complex: RuneComplex = {
      id: 'c',
      name: 'C',
      runeItemIds: ['missing-rune'],
      isEnabled: true,
      createdAt: '',
      updatedAt: '',
    };

    const preview = buildRuneComplexPreview(complex, []);
    expect(preview.runes[0].itemName).toBe('missing-rune');
    expect(preview.runes[0].effects).toEqual([]);
  });
});

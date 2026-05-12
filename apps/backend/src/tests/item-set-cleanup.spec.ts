import { describe, expect, it } from 'vitest';
import { collectMissingItemSetReferenceWarnings, removeDeletedItemIdFromItemSets } from '../content/content.service';
import type { AdminItem, ContentDatabase, ItemSet } from '../content/content.types';

function makeItem(id: string): AdminItem {
  return {
    id,
    name: id,
    type: 'weapon',
    rarity: 'common',
    price: 0,
    stackable: false,
    gameplayDescription: '',
    loreDescription: '',
    isEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeItemSet(id: string, pieceItemIds: string[]): ItemSet {
  return {
    id,
    name: id,
    pieceItemIds,
    bonuses: [],
    isEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeDatabase(overrides: Partial<ContentDatabase> = {}): ContentDatabase {
  return {
    version: 1,
    items: [],
    skills: [],
    merchants: [],
    cities: [],
    materials: [],
    lootTables: [],
    images: [],
    dialogues: [],
    npcs: [],
    quests: [],
    questInteractions: [],
    questItems: [],
    questMarkers: [],
    battleMaps: [],
    itemSets: [],
    runeComplexes: [],
    worldMap: {
      zones: [],
      regions: [],
      questMarkers: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('item set cleanup helpers', () => {
  it('removes a deleted item id from every item set and updates touched timestamps only', () => {
    const timestamp = '2026-05-12T12:00:00.000Z';
    const itemSets = [
      makeItemSet('set_a', ['item_test_01', 'item_other']),
      makeItemSet('set_b', ['item_test_01']),
      makeItemSet('set_c', ['item_other']),
    ];

    const result = removeDeletedItemIdFromItemSets(itemSets, 'item_test_01', timestamp);

    expect(result[0]?.pieceItemIds).toEqual(['item_other']);
    expect(result[1]?.pieceItemIds).toEqual([]);
    expect(result[2]?.pieceItemIds).toEqual(['item_other']);
    expect(result[0]?.updatedAt).toBe(timestamp);
    expect(result[1]?.updatedAt).toBe(timestamp);
    expect(result[2]?.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('aggregates missing piece warnings once per set with all missing ids', () => {
    const db = makeDatabase({
      items: [makeItem('item_existing')],
      itemSets: [
        makeItemSet('set_valid', ['item_existing']),
        makeItemSet('irigon_set', ['missing_item_01', 'missing_item_01', 'missing_item_02']),
      ],
    });

    const warnings = collectMissingItemSetReferenceWarnings(db);

    expect(warnings).toEqual([
      "Item set 'irigon_set' has 2 missing item references: missing_item_01, missing_item_02",
    ]);
  });
});
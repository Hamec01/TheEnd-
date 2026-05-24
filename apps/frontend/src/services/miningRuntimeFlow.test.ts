import { beforeEach, describe, expect, it } from 'vitest';
import type { MineDefinition, MineDepth, MineHazard, MineHazardTable, MineLootTable, MineBlockTable } from '../types/mining';
import {
  saveMinesToStorage,
  saveMineDepthsToStorage,
  saveMineBlockTablesToStorage,
  saveMineHazardsToStorage,
  saveMineHazardTablesToStorage,
  saveMineLootTablesToStorage,
} from './miningRepository';
import {
  escapeMineRun,
  hitMineBlock,
  forceMineRunOutcome,
  percentMiningEffect,
  retreatMineRun,
  startMineRun,
} from './miningRuntime';
import { PLAYER_ITEMS_STORAGE_KEY, readStringArrayStorage, writeStringArrayStorage } from '../utils/playerInventory';
import type { ActiveMiningEffect } from '../types/mining';

type StorageMap = Map<string, string>;

function installWindowStorage(): void {
  const map: StorageMap = new Map();
  const storage = {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
  };
  (globalThis as any).window = { localStorage: storage };
}

function seedMineForPayload(payloadType: 'loot_item' | 'gold' | 'hazard_ref'): void {
  const mineId = 'mine_test';
  const depthId = 'mine_test_depth_1';
  const blockTableId = 'mine_test_blocks';
  const lootTableId = 'mine_test_loot';
  const hazardTableId = 'mine_test_hazards';
  const hazardId = 'hazard_test_deadly';

  const mines: MineDefinition[] = [{
    id: mineId,
    name: 'Test mine',
    description: 'test',
    requiredProfessionId: 'mining',
    requiredMiningLevel: 1,
    dangerLevel: 'low',
    visualTheme: 'teramor_stone',
    depthIds: [depthId],
    knownResources: [],
    isEnabled: true,
  }];
  const depths: MineDepth[] = [{
    id: depthId,
    mineId,
    depthLevel: 1,
    name: 'Depth 1',
    rows: 1,
    columns: 1,
    baseHits: 3,
    staminaCostPerHit: 1,
    baseCollapseRisk: 0,
    riskIncreasePerHit: 0,
    lootTableId,
    blockTableId,
    hazardTableId,
    guaranteedExit: false,
    canSpawnPassage: false,
    isFinalDepth: true,
    requiredMiningLevel: 1,
    isEnabled: true,
  }];

  const entries: MineBlockTable['entries'] = payloadType === 'loot_item'
    ? [{ type: 'stone', weight: 100, payloads: [{ type: 'loot_item', weight: 100, itemId: 'item_iron_ore', minQuantity: 1, maxQuantity: 1 }] }]
    : payloadType === 'gold'
      ? [{ type: 'stone', weight: 100, payloads: [{ type: 'gold', weight: 100, goldMin: 7, goldMax: 7 }] }]
      : [{ type: 'hazard', weight: 100, payloads: [{ type: 'hazard_ref', weight: 100, hazardId }] }];

  const blockTables: MineBlockTable[] = [{ id: blockTableId, name: 'Blocks', entries }];
  const lootTables: MineLootTable[] = [{ id: lootTableId, name: 'Loot', entries: [{ itemId: 'item_iron_ore', weight: 1, minQuantity: 1, maxQuantity: 1 }] }];
  const hazards: MineHazard[] = [{
    id: hazardId,
    name: 'Deadly',
    type: 'deadly_collapse',
    description: 'boom',
    hpDamageMin: 999,
    hpDamageMax: 999,
    staminaDamageMin: 0,
    staminaDamageMax: 0,
    lootLossChance: 0,
    lootLossPercent: 0,
    canBeReducedByConstitution: false,
    canBeDodgedByDexterity: false,
    isDeadly: true,
    isEnabled: true,
  }];
  const hazardTables: MineHazardTable[] = [{ id: hazardTableId, name: 'Haz', entries: [{ hazardId, weight: 1 }] }];

  saveMinesToStorage(mines);
  saveMineDepthsToStorage(depths);
  saveMineBlockTablesToStorage(blockTables);
  saveMineLootTablesToStorage(lootTables);
  saveMineHazardsToStorage(hazards);
  saveMineHazardTablesToStorage(hazardTables);
}

function seedCustomMine(params: {
  blockType: MineBlockTable['entries'][number]['type'];
  payloads?: MineBlockTable['entries'][number]['payloads'];
  hazard?: MineHazard;
}): void {
  const mineId = 'mine_custom';
  const depthId = 'mine_custom_depth_1';
  const blockTableId = 'mine_custom_blocks';
  const lootTableId = 'mine_custom_loot';
  const hazardTableId = 'mine_custom_hazards';
  const hazard = params.hazard ?? {
    id: 'hazard_custom',
    name: 'Custom',
    type: 'gas',
    description: 'custom',
    hpDamageMin: 10,
    hpDamageMax: 10,
    staminaDamageMin: 10,
    staminaDamageMax: 10,
    lootLossChance: 0,
    lootLossPercent: 0,
    canBeReducedByConstitution: false,
    canBeDodgedByDexterity: false,
    isDeadly: false,
    isEnabled: true,
  };

  saveMinesToStorage([{
    id: mineId,
    name: 'Custom mine',
    description: 'custom',
    requiredProfessionId: 'mining',
    requiredMiningLevel: 1,
    dangerLevel: 'low',
    visualTheme: 'teramor_stone',
    depthIds: [depthId],
    knownResources: [],
    isEnabled: true,
  }]);
  saveMineDepthsToStorage([{
    id: depthId,
    mineId,
    depthLevel: 3,
    name: 'Depth 3',
    rows: 1,
    columns: 1,
    baseHits: 3,
    staminaCostPerHit: 1,
    baseCollapseRisk: 0,
    riskIncreasePerHit: 0,
    lootTableId,
    blockTableId,
    hazardTableId,
    guaranteedExit: false,
    canSpawnPassage: false,
    isFinalDepth: true,
    requiredMiningLevel: 1,
    isEnabled: true,
  }]);
  saveMineBlockTablesToStorage([{
    id: blockTableId,
    name: 'Custom blocks',
    entries: [{
      type: params.blockType,
      weight: 100,
      payloads: params.payloads,
    }],
  }]);
  saveMineLootTablesToStorage([{
    id: lootTableId,
    name: 'Custom loot',
    entries: [
      { itemId: 'item_cracked_crystal', weight: 1, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
      { itemId: 'item_rune_fragment_weak', weight: 1, minQuantity: 1, maxQuantity: 1, rarity: 'rare' },
    ],
  }]);
  saveMineHazardsToStorage([hazard]);
  saveMineHazardTablesToStorage([{ id: hazardTableId, name: 'Custom hazards', entries: [{ hazardId: hazard.id, weight: 1 }] }]);
}

function effect(type: string, extra: Partial<ActiveMiningEffect> = {}): ActiveMiningEffect {
  return {
    id: `${type}-id`,
    type,
    skillId: `${type}-skill`,
    skillName: `Skill ${type}`,
    runtimeKey: `${type}-runtime`,
    valueType: 'percent',
    value: 0,
    ...extra,
  };
}

describe('mining runtime flow', () => {
  beforeEach(() => {
    installWindowStorage();
    writeStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY, []);
  });

  it('puts mined loot into temporary bag only during run', () => {
    seedMineForPayload('loot_item');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const result = hitMineBlock(run, 0, [], () => 0.5);

    expect(result.changed).toBe(true);
    expect(result.run.temporaryLoot.length).toBe(1);
    expect(result.run.temporaryLoot[0]?.itemId).toBe('item_iron_ore');
    expect(readStringArrayStorage(PLAYER_ITEMS_STORAGE_KEY)).toHaveLength(0);
  });

  it('safe exit keeps 100% temporary loot in awarded loot', () => {
    seedMineForPayload('loot_item');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const hit = hitMineBlock(run, 0, [], () => 0.5).run;
    hit.foundExit = true;
    const escaped = escapeMineRun(hit);

    expect(escaped.status).toBe('escaped');
    expect(escaped.awardedLoot).toEqual(hit.temporaryLoot);
  });

  it('retreat on depth 2 keeps 60% loot', () => {
    seedMineForPayload('loot_item');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    run.currentDepthLevel = 2;
    run.temporaryLoot = [{ itemId: 'item_iron_ore', quantity: 10 }];

    const retreated = retreatMineRun(run, []);
    expect(retreated.status).toBe('retreated');
    expect(retreated.awardedLoot?.[0]?.quantity).toBe(6);
  });

  it('cannot use safe exit before finding exit block', () => {
    seedMineForPayload('loot_item');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const escaped = escapeMineRun(run);
    expect(escaped.status).toBe('active');
  });

  it('hazard death loses loot by default', () => {
    seedMineForPayload('hazard_ref');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 10, playerStamina: 50, rng: () => 0 });
    run.temporaryLoot = [{ itemId: 'item_iron_ore', quantity: 3 }];

    const dead = hitMineBlock(run, 0, [], () => 0).run;
    expect(dead.status).toBe('dead');
    expect(dead.awardedLoot ?? []).toHaveLength(0);
    expect(dead.lostLoot?.[0]?.quantity).toBe(3);
  });

  it('gold payload goes into temporaryGold during run and awardedGold on exit', () => {
    seedMineForPayload('gold');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const hit = hitMineBlock(run, 0, [], () => 0.5).run;
    expect(hit.temporaryGold).toBe(7);
    hit.foundExit = true;

    const escaped = escapeMineRun(hit);
    expect(escaped.awardedGold).toBe(7);
  });

  it('can force a failure outcome for GODMODE testing', () => {
    seedMineForPayload('loot_item');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    run.temporaryLoot = [{ itemId: 'item_iron_ore', quantity: 4 }];

    const failed = forceMineRunOutcome(run, 'failed', []);

    expect(failed.status).toBe('failed');
    expect(failed.resultSummary).toBeDefined();
    expect(failed.awardedLoot ?? []).toHaveLength(0);
  });

  it('fragile loot can break and skill can reduce the break chance', () => {
    seedCustomMine({
      blockType: 'crystal',
      payloads: [{ type: 'loot_item', weight: 100, itemId: 'item_cracked_crystal', minQuantity: 1, maxQuantity: 1, rarity: 'rare' }],
    });
    const run = startMineRun({ mineId: 'mine_custom', playerHp: 100, playerStamina: 50, rng: () => 0 });
    const broken = hitMineBlock(run, 0, [], () => 0).run;
    expect(broken.temporaryLoot).toHaveLength(0);

    const protectedRun = startMineRun({ mineId: 'mine_custom', playerHp: 100, playerStamina: 50, rng: () => 0.99 });
    const reduced = hitMineBlock(protectedRun, 0, [effect('mine_fragile_loot_break_chance_modifier', { value: -100 })], () => 0.99).run;
    expect(reduced.temporaryLoot[0]?.itemId).toBe('item_cracked_crystal');
  });

  it('sell value effect adds bonus gold on escape', () => {
    seedMineForPayload('loot_item');
    const run = startMineRun({ mineId: 'mine_test', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const hit = hitMineBlock(run, 0, [], () => 0.5).run;
    hit.foundExit = true;
    const escaped = escapeMineRun(hit, [effect('mine_loot_sell_value_modifier', { value: 100 })]);
    expect(escaped.bonusGoldFromSellValue).toBeGreaterThan(0);
    expect(escaped.resultSummary?.bonusGoldFromSellValue).toBeGreaterThan(0);
  });

  it('special property can be attached to crystal loot', () => {
    seedCustomMine({
      blockType: 'crystal',
      payloads: [{ type: 'loot_item', weight: 100, itemId: 'item_cracked_crystal', minQuantity: 1, maxQuantity: 1, rarity: 'rare' }],
    });
    const run = startMineRun({ mineId: 'mine_custom', playerHp: 100, playerStamina: 50, rng: () => 0.99 });
    const next = hitMineBlock(run, 0, [effect('mine_loot_special_property_chance', { value: 100 })], () => 0.99).run;
    expect(next.specialFinds?.length).toBeGreaterThan(0);
  });

  it('rune trace payload can drop rune fragment and modifier affects it', () => {
    seedCustomMine({
      blockType: 'rich_ore',
      payloads: [{ type: 'rune_trace', weight: 100, itemId: 'item_rune_fragment_weak', minQuantity: 1, maxQuantity: 1, rarity: 'rare' }],
    });
    const run = startMineRun({ mineId: 'mine_custom', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const next = hitMineBlock(run, 0, [effect('mine_rune_fragment_chance_modifier', { value: 50 })], () => 0.5).run;
    expect(next.temporaryLoot.some((entry) => entry.itemId === 'item_rune_fragment_weak')).toBe(true);
  });

  it('event block resolves a visible event', () => {
    seedCustomMine({
      blockType: 'event',
      payloads: [{ type: 'event_ref', weight: 100, eventId: 'ancient_tablet' }],
    });
    const run = startMineRun({ mineId: 'mine_custom', playerHp: 100, playerStamina: 50, rng: () => 0.5 });
    const next = hitMineBlock(run, 0, [effect('mine_event_chance_modifier', { value: 100 })], () => 0.5).run;
    expect(next.earnedXp).toBeGreaterThan(0);
    expect(next.skillEffectLog?.length).toBeGreaterThan(0);
  });

  it('hazard resistance effects match lava and gas contexts', () => {
    expect(percentMiningEffect([effect('mine_lava_resistance', { value: 25 })], 'mine_lava_resistance', { hazardType: 'lava_crack' })).toBe(25);
    expect(percentMiningEffect([effect('mine_gas_resistance', { value: 20 })], 'mine_gas_resistance', { hazardType: 'poison_gas' })).toBe(20);
  });
});

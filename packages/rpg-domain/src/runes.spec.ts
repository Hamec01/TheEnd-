import { describe, expect, it } from 'vitest';
import { Race } from './races';
import {
  RUNE_DEFINITIONS,
  applyRuneCost,
  calculateRuneBacklashChance,
  calculateRuneComplex,
  canCharacterCreateRuneComplex,
  ensureRuneDesignSafety,
  getDefaultRunePermissionsForRace,
  type CharacterLike,
} from './runes';

const EXPECTED_RUNE_IDS = [
  'hald',
  'rung',
  'farn',
  'gort',
  'skragg',
  'ilm',
  'tarn',
  'vorr',
  'hemr',
  'elgar',
  'kragnor',
  'morrg',
  'uragg',
  'drakn',
  'skharn',
  'varkh',
  'olgr',
  'zrung',
  'kregg',
  'tulg',
  'orn',
  'garuk',
  'mordr',
  'zagrann',
  'harrok',
  'varnhul',
  'suggrat',
  'trogg',
  'irn',
  'faragg',
  'lurn',
  'dorgul',
  'eshtar',
  'grimr',
  'okr',
  'skharug',
  'drognar',
  'kulg',
  'turhan',
  'falgort',
  'nurrak',
  'galmor',
  'shorrg',
  'feldr',
  'orkann',
  'drung',
  'kavragg',
  'zulhet',
  'morhunn',
  'harran',
];

function createCharacter(overrides: Partial<CharacterLike> = {}): CharacterLike {
  return {
    race: Race.Human,
    currentHp: 120,
    currentStamina: 100,
    currentMp: 80,
    willpower: 10,
    knowsRuneCraft: false,
    canCarveRunes: false,
    canUseRuneItems: true,
    ...overrides,
  };
}

describe('rune system foundation', () => {
  it('contains all expected rune ids and ids are unique', () => {
    const ids = Object.keys(RUNE_DEFINITIONS);
    const unique = new Set(ids);

    expect(unique.size).toBe(ids.length);
    expect(ids.sort()).toEqual([...EXPECTED_RUNE_IDS].sort());
  });

  it('all runes have required fields and cost object', () => {
    for (const rune of Object.values(RUNE_DEFINITIONS)) {
      expect(rune.name.trim().length).toBeGreaterThan(0);
      expect(rune.category).toBeDefined();
      expect(rune.description.trim().length).toBeGreaterThan(0);
      expect(rune.cost).toBeDefined();
    }
  });

  it('forbidden runes are unstable without binding runes', () => {
    const forbiddenRunes = Object.values(RUNE_DEFINITIONS).filter((rune) => rune.category === 'forbidden' || rune.forbidden);

    for (const rune of forbiddenRunes) {
      const complex = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), [rune.id]);
      expect(complex.isUnstable).toBe(true);
    }
  });

  it('binding runes reduce complex risk', () => {
    const noBinding = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['zagrann']);
    const withBinding = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['zagrann', 'hald']);

    expect(withBinding.riskChance).toBeLessThan(noBinding.riskChance);
  });

  it('amplifier rune increases power and risk', () => {
    const base = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['drakn']);
    const amplified = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['drakn', 'orkann']);

    const basePower = base.combinedEffects.reduce((sum, effect) => sum + (effect.value ?? 0), 0);
    const amplifiedPower = amplified.combinedEffects.reduce((sum, effect) => sum + (effect.value ?? 0), 0);

    expect(amplified.riskChance).toBeGreaterThan(base.riskChance);
    expect(amplifiedPower).toBeGreaterThan(basePower);
  });

  it('dwarf can carve runes but cannot create rune knowledge by default', () => {
    const permissions = getDefaultRunePermissionsForRace(Race.Dwarf);

    expect(permissions.canCarveRunes).toBe(true);
    expect(permissions.knowsRuneCraft).toBe(false);
  });

  it('playable races cannot naturally create rune complexes without knowsRuneCraft', () => {
    const races = [Race.Human, Race.HighElf, Race.WoodElf, Race.Dwarf];

    for (const race of races) {
      const permissions = getDefaultRunePermissionsForRace(race);
      const canCreate = canCharacterCreateRuneComplex(
        createCharacter({
          race,
          ...permissions,
        }),
      );

      expect(canCreate).toBe(false);
    }
  });

  it('forbidden complex without binding has high risk, with binding has lower risk', () => {
    const noBinding = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['zagrann', 'grimr']);
    const withBinding = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['zagrann', 'grimr', 'harran']);

    expect(noBinding.riskChance).toBeGreaterThanOrEqual(0.6);
    expect(withBinding.riskChance).toBeLessThan(noBinding.riskChance);
  });

  it('applyRuneCost reduces hp and stamina correctly', () => {
    const character = createCharacter({ currentHp: 50, currentStamina: 40, currentMp: 30 });

    const updated = applyRuneCost(character, {
      hp: 7,
      stamina: 9,
      mp: 5,
    });

    expect(updated.currentHp).toBe(43);
    expect(updated.currentStamina).toBe(31);
    expect(updated.currentMp).toBe(25);
  });

  it('rune backlash chance is reduced by willpower', () => {
    const complex = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['zagrann', 'grimr']);
    const lowWillpowerChance = calculateRuneBacklashChance(complex, 5);
    const highWillpowerChance = calculateRuneBacklashChance(complex, 90);

    expect(highWillpowerChance).toBeLessThan(lowWillpowerChance);
  });

  it('powerful runes always have sacrifice or risk price', () => {
    expect(() => ensureRuneDesignSafety(RUNE_DEFINITIONS)).not.toThrow();
  });

  it('complex rune systems without binding runes are unstable and very risky', () => {
    const complex = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['uragg', 'drakn', 'skragg']);
    expect(complex.isUnstable).toBe(true);
    expect(complex.riskChance).toBeGreaterThanOrEqual(0.75);
  });

  it('forbidden rune complexes always retain meaningful risk even with binding', () => {
    const complex = calculateRuneComplex(Object.values(RUNE_DEFINITIONS), ['zagrann', 'harran']);
    expect(complex.riskChance).toBeGreaterThanOrEqual(0.28);
  });
});

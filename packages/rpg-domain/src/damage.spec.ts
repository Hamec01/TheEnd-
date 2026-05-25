import { describe, expect, it } from 'vitest';
import {
  DAMAGE_CATEGORIES,
  ELEMENT_TYPES,
  applyElementEffect,
  calculateFinalDamage,
  checkElementCombo,
  getElementMultiplier,
  isEffectBlockedByRace,
} from './damage';
import {
  applyCitizenshipChange,
  canAccessAcademy,
  canRaceUseSkillDefinition,
  createInitialCitizenshipState,
  getCityAccessOutcome,
  getMerchantPriceModifiers,
  getStartingFreePoints,
} from './character-rules';
import { applySkillCost, canUseSkill, type SkillDefinition, type SkillUser } from './skills';
import { MagicSchoolType, SkillType } from './skills/index';
import { RACE_DEFINITIONS, Race } from './races';
import type { StatBlock } from './stats';

function createStats(overrides: Partial<StatBlock> = {}): StatBlock {
  return {
    hp: 100,
    mp: 100,
    stamina: 100,
    strength: 0,
    constitution: 0,
    dexterity: 0,
    intelligence: 0,
    luck: 0,
    perception: 0,
    willpower: 0,
    ...overrides,
  };
}

function createSkillUser(race: Race): SkillUser {
  return {
    race,
    raceModifiers: RACE_DEFINITIONS[race].modifiers,
    currentHp: 100,
    currentMp: 100,
    currentStamina: 100,
    currentSpirit: 10,
    stats: createStats(),
  };
}

describe('damage and skill category system', () => {
  it('contains all required damage categories', () => {
    expect(DAMAGE_CATEGORIES).toEqual([
      'physical',
      'elemental',
      'magic',
      'shamanic',
      'runic',
      'bleed',
      'poison',
      'true',
    ]);
  });

  it('contains all six elements', () => {
    expect(ELEMENT_TYPES).toEqual(['fire', 'water', 'earth', 'air', 'light', 'dark']);
  });

  it('applies elemental counters with expected multipliers', () => {
    expect(getElementMultiplier('fire', 'earth')).toBe(1.25);
    expect(getElementMultiplier('fire', 'dark')).toBe(1.25);
    expect(getElementMultiplier('fire', 'water')).toBe(0.75);
    expect(getElementMultiplier('light', 'dark')).toBe(1.25);
    expect(getElementMultiplier('dark', 'light')).toBe(1.25);
    expect(getElementMultiplier('water', 'earth')).toBe(1);
  });

  it('applies elemental status effects map', () => {
    expect(applyElementEffect({ activeEffects: [] }, 'fire').effect.statusEffectId).toBe('burning');
    expect(applyElementEffect({ activeEffects: [] }, 'water').effect.statusEffectId).toBe('wet');
    expect(applyElementEffect({ activeEffects: [] }, 'earth').effect.statusEffectId).toBe('slow');
    expect(applyElementEffect({ activeEffects: [] }, 'air').effect.statusEffectId).toBe('rupture');
    expect(applyElementEffect({ activeEffects: [] }, 'light').effect.statusEffectId).toBe('cleanse');
    expect(applyElementEffect({ activeEffects: [] }, 'dark').effect.statusEffectId).toBe('corruption');
  });

  it('detects core elemental combos', () => {
    expect(checkElementCombo('water', 'air')?.id).toBe('storm');
    expect(checkElementCombo('fire', 'earth')?.id).toBe('lava');
    expect(checkElementCombo('light', 'fire')?.id).toBe('solar_burst');
    expect(checkElementCombo('dark', 'fire')?.id).toBe('cursed_flame');
    expect(checkElementCombo('fire', 'water')).toBeNull();
  });

  it('physical skill consumes stamina', () => {
    const user = createSkillUser(Race.Human);
    const skill: SkillDefinition = {
      id: 'power_strike',
      name: 'Power Strike',
      description: 'Heavy melee strike',
      category: 'physical',
      cost: { stamina: 15 },
    };

    const next = applySkillCost(user, skill);
    expect(next.currentStamina).toBe(85);
    expect(next.currentMp).toBe(100);
  });

  it('magic skill consumes MP', () => {
    const user = createSkillUser(Race.Human);
    const skill: SkillDefinition = {
      id: 'arcane_bolt',
      name: 'Arcane Bolt',
      description: 'Magic projectile',
      category: 'magic',
      cost: { mp: 10 },
    };

    const next = applySkillCost(user, skill);
    expect(next.currentMp).toBe(90);
    expect(next.currentStamina).toBe(100);
  });

  it('elemental skill consumes MP', () => {
    const user = createSkillUser(Race.HighElf);
    const skill: SkillDefinition = {
      id: 'fire_bolt',
      name: 'Fire Bolt',
      description: 'Elemental fire cast',
      category: 'elemental',
      cost: { mp: 12 },
    };

    const next = applySkillCost(user, skill);
    expect(next.currentMp).toBe(88);
  });

  it('Human elemental MP cost stays normal', () => {
    const user = createSkillUser(Race.Human);
    const skill: SkillDefinition = {
      id: 'fire_wave',
      name: 'Fire Wave',
      description: 'Elemental wave',
      category: 'elemental',
      cost: { mp: 10 },
    };

    const next = applySkillCost(user, skill);
    expect(next.currentMp).toBe(90);
  });

  it('HighElf and WoodElf cannot use non-elemental magic', () => {
    const magicSkill: SkillDefinition = {
      id: 'mind_spike',
      name: 'Mind Spike',
      description: 'Pure magic attack',
      category: 'magic',
      cost: { mp: 10 },
    };

    expect(canUseSkill(createSkillUser(Race.HighElf), magicSkill).ok).toBe(false);
    expect(canUseSkill(createSkillUser(Race.WoodElf), magicSkill).ok).toBe(false);
  });

  it('Dwarf cannot cast magic', () => {
    const dwarf = createSkillUser(Race.Dwarf);
    const magicSkill: SkillDefinition = {
      id: 'arcane_wave',
      name: 'Arcane Wave',
      description: 'Magic burst',
      category: 'magic',
      cost: { mp: 5 },
    };

    const check = canUseSkill(dwarf, magicSkill);
    expect(check.ok).toBe(false);
  });

  it('Dwarf cannot use elements', () => {
    const dwarf = createSkillUser(Race.Dwarf);
    const elementalSkill: SkillDefinition = {
      id: 'water_shard',
      name: 'Water Shard',
      description: 'Elemental cast',
      category: 'elemental',
      cost: { mp: 5 },
    };

    const check = canUseSkill(dwarf, elementalSkill);
    expect(check.ok).toBe(false);
  });

  it('Dwarf takes 50% magic damage', () => {
    const result = calculateFinalDamage({
      attacker: { stats: createStats() },
      defender: { stats: createStats(), raceModifiers: RACE_DEFINITIONS[Race.Dwarf].modifiers },
      damagePayload: {
        category: 'magic',
        amount: 100,
      },
    });

    expect(result.finalDamage).toBe(50);
  });

  it('Dwarf takes 50% elemental damage', () => {
    const result = calculateFinalDamage({
      attacker: { stats: createStats() },
      defender: { stats: createStats(), raceModifiers: RACE_DEFINITIONS[Race.Dwarf].modifiers },
      damagePayload: {
        category: 'elemental',
        amount: 100,
        elementType: 'fire',
      },
    });

    expect(result.finalDamage).toBe(100);
  });

  it('Dwarf takes full runic damage', () => {
    const result = calculateFinalDamage({
      attacker: { stats: createStats() },
      defender: { stats: createStats(), raceModifiers: RACE_DEFINITIONS[Race.Dwarf].modifiers },
      damagePayload: {
        category: 'runic',
        amount: 100,
        runicType: 'binding',
      },
    });

    expect(result.finalDamage).toBe(60);
  });

  it('Dwarf is immune to magical curse, silence, stun, and blind', () => {
    const defender = { raceModifiers: RACE_DEFINITIONS[Race.Dwarf].modifiers };

    expect(isEffectBlockedByRace(defender, 'curse', 'magic')).toBe(true);
    expect(isEffectBlockedByRace(defender, 'silence', 'magic')).toBe(true);
    expect(isEffectBlockedByRace(defender, 'stun', 'magic')).toBe(true);
    expect(isEffectBlockedByRace(defender, 'blind', 'magic')).toBe(true);
  });

  it('Dwarf can still be stunned by physical shield bash', () => {
    const defender = { raceModifiers: RACE_DEFINITIONS[Race.Dwarf].modifiers };
    expect(isEffectBlockedByRace(defender, 'stun', 'physical')).toBe(false);
  });

  it('uses race-based starting free points', () => {
    expect(getStartingFreePoints(Race.Human)).toBe(10);
    expect(getStartingFreePoints(Race.Dwarf)).toBe(5);
    expect(getStartingFreePoints(Race.WoodElf)).toBe(5);
    expect(getStartingFreePoints(Race.HighElf)).toBe(5);
  });

  it('blocks non-elemental elven magic learning', () => {
    expect(canRaceUseSkillDefinition(Race.WoodElf, {
      type: SkillType.ELEMENTAL_MAGIC,
      requirements: { requiredMagicSchools: [MagicSchoolType.ELEMENTAL] },
      damage: [],
      tags: [],
    } as any)).toBe(true);

    expect(canRaceUseSkillDefinition(Race.WoodElf, {
      type: SkillType.NORMAL_MAGIC,
      requirements: { requiredMagicSchools: [MagicSchoolType.ILLUSION] },
      damage: [],
      tags: ['illusion'],
    } as any)).toBe(false);
  });

  it('applies extra high elf ice damage only to ice-tagged elemental skills', () => {
    const ice = calculateFinalDamage({
      attacker: { stats: createStats(), race: Race.HighElf },
      defender: { stats: createStats() },
      damagePayload: {
        category: 'elemental',
        amount: 10,
        elementType: 'water',
        tags: ['ice'],
      },
    });
    const fire = calculateFinalDamage({
      attacker: { stats: createStats(), race: Race.HighElf },
      defender: { stats: createStats() },
      damagePayload: {
        category: 'elemental',
        amount: 10,
        elementType: 'fire',
      },
    });

    expect(ice.finalDamage).toBe(23);
    expect(fire.finalDamage).toBe(15);
  });

  it('applies citizenship changes and academy bypasses', () => {
    const luminorStart = createInitialCitizenshipState('luminor');
    expect(luminorStart.kingdomReputation.luminor).toBe(20);
    expect(luminorStart.kingdomReputation.artalon).toBe(10);
    expect(luminorStart.kingdomReputation.terimia).toBe(10);

    const updated = applyCitizenshipChange({
      citizenshipKingdomId: 'artalon',
      kingdomReputation: { luminor: 0, artalon: 20, kriantar: 0, terimia: 0, argos: 0 },
    }, 'luminor');

    expect(updated.citizenshipKingdomId).toBe('luminor');
    expect(updated.kingdomReputation.artalon).toBe(-30);
    expect(updated.kingdomReputation.luminor).toBe(20);

    expect(canAccessAcademy({
      race: Race.Human,
      academyId: 'academy_black_rite',
      citizenshipKingdomId: 'terimia',
    })).toEqual({ allowed: true, bypassIntroQuest: true });
  });

  it('derives merchant and city reputation outcomes', () => {
    const modifiers = getMerchantPriceModifiers({
      kingdomReputation: 80,
      playerKingdomId: 'luminor',
    });
    expect(modifiers.tradeBlocked).toBe(false);
    expect(modifiers.buyMultiplier).toBe(0.8);
    expect(modifiers.sellMultiplier).toBe(1.38);

    expect(getCityAccessOutcome(-90)).toMatchObject({ allowed: false, hostile: true });
  });
});

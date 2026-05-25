"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const damage_1 = require("./damage");
const character_rules_1 = require("./character-rules");
const skills_1 = require("./skills");
const index_1 = require("./skills/index");
const races_1 = require("./races");
function createStats(overrides = {}) {
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
function createSkillUser(race) {
    return {
        race,
        raceModifiers: races_1.RACE_DEFINITIONS[race].modifiers,
        currentHp: 100,
        currentMp: 100,
        currentStamina: 100,
        currentSpirit: 10,
        stats: createStats(),
    };
}
(0, vitest_1.describe)('damage and skill category system', () => {
    (0, vitest_1.it)('contains all required damage categories', () => {
        (0, vitest_1.expect)(damage_1.DAMAGE_CATEGORIES).toEqual([
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
    (0, vitest_1.it)('contains all six elements', () => {
        (0, vitest_1.expect)(damage_1.ELEMENT_TYPES).toEqual(['fire', 'water', 'earth', 'air', 'light', 'dark']);
    });
    (0, vitest_1.it)('applies elemental counters with expected multipliers', () => {
        (0, vitest_1.expect)((0, damage_1.getElementMultiplier)('fire', 'earth')).toBe(1.25);
        (0, vitest_1.expect)((0, damage_1.getElementMultiplier)('fire', 'dark')).toBe(1.25);
        (0, vitest_1.expect)((0, damage_1.getElementMultiplier)('fire', 'water')).toBe(0.75);
        (0, vitest_1.expect)((0, damage_1.getElementMultiplier)('light', 'dark')).toBe(1.25);
        (0, vitest_1.expect)((0, damage_1.getElementMultiplier)('dark', 'light')).toBe(1.25);
        (0, vitest_1.expect)((0, damage_1.getElementMultiplier)('water', 'earth')).toBe(1);
    });
    (0, vitest_1.it)('applies elemental status effects map', () => {
        (0, vitest_1.expect)((0, damage_1.applyElementEffect)({ activeEffects: [] }, 'fire').effect.statusEffectId).toBe('burning');
        (0, vitest_1.expect)((0, damage_1.applyElementEffect)({ activeEffects: [] }, 'water').effect.statusEffectId).toBe('wet');
        (0, vitest_1.expect)((0, damage_1.applyElementEffect)({ activeEffects: [] }, 'earth').effect.statusEffectId).toBe('slow');
        (0, vitest_1.expect)((0, damage_1.applyElementEffect)({ activeEffects: [] }, 'air').effect.statusEffectId).toBe('rupture');
        (0, vitest_1.expect)((0, damage_1.applyElementEffect)({ activeEffects: [] }, 'light').effect.statusEffectId).toBe('cleanse');
        (0, vitest_1.expect)((0, damage_1.applyElementEffect)({ activeEffects: [] }, 'dark').effect.statusEffectId).toBe('corruption');
    });
    (0, vitest_1.it)('detects core elemental combos', () => {
        (0, vitest_1.expect)((0, damage_1.checkElementCombo)('water', 'air')?.id).toBe('storm');
        (0, vitest_1.expect)((0, damage_1.checkElementCombo)('fire', 'earth')?.id).toBe('lava');
        (0, vitest_1.expect)((0, damage_1.checkElementCombo)('light', 'fire')?.id).toBe('solar_burst');
        (0, vitest_1.expect)((0, damage_1.checkElementCombo)('dark', 'fire')?.id).toBe('cursed_flame');
        (0, vitest_1.expect)((0, damage_1.checkElementCombo)('fire', 'water')).toBeNull();
    });
    (0, vitest_1.it)('physical skill consumes stamina', () => {
        const user = createSkillUser(races_1.Race.Human);
        const skill = {
            id: 'power_strike',
            name: 'Power Strike',
            description: 'Heavy melee strike',
            category: 'physical',
            cost: { stamina: 15 },
        };
        const next = (0, skills_1.applySkillCost)(user, skill);
        (0, vitest_1.expect)(next.currentStamina).toBe(85);
        (0, vitest_1.expect)(next.currentMp).toBe(100);
    });
    (0, vitest_1.it)('magic skill consumes MP', () => {
        const user = createSkillUser(races_1.Race.Human);
        const skill = {
            id: 'arcane_bolt',
            name: 'Arcane Bolt',
            description: 'Magic projectile',
            category: 'magic',
            cost: { mp: 10 },
        };
        const next = (0, skills_1.applySkillCost)(user, skill);
        (0, vitest_1.expect)(next.currentMp).toBe(90);
        (0, vitest_1.expect)(next.currentStamina).toBe(100);
    });
    (0, vitest_1.it)('elemental skill consumes MP', () => {
        const user = createSkillUser(races_1.Race.HighElf);
        const skill = {
            id: 'fire_bolt',
            name: 'Fire Bolt',
            description: 'Elemental fire cast',
            category: 'elemental',
            cost: { mp: 12 },
        };
        const next = (0, skills_1.applySkillCost)(user, skill);
        (0, vitest_1.expect)(next.currentMp).toBe(88);
    });
    (0, vitest_1.it)('Human elemental MP cost stays normal', () => {
        const user = createSkillUser(races_1.Race.Human);
        const skill = {
            id: 'fire_wave',
            name: 'Fire Wave',
            description: 'Elemental wave',
            category: 'elemental',
            cost: { mp: 10 },
        };
        const next = (0, skills_1.applySkillCost)(user, skill);
        (0, vitest_1.expect)(next.currentMp).toBe(90);
    });
    (0, vitest_1.it)('HighElf and WoodElf cannot use non-elemental magic', () => {
        const magicSkill = {
            id: 'mind_spike',
            name: 'Mind Spike',
            description: 'Pure magic attack',
            category: 'magic',
            cost: { mp: 10 },
        };
        (0, vitest_1.expect)((0, skills_1.canUseSkill)(createSkillUser(races_1.Race.HighElf), magicSkill).ok).toBe(false);
        (0, vitest_1.expect)((0, skills_1.canUseSkill)(createSkillUser(races_1.Race.WoodElf), magicSkill).ok).toBe(false);
    });
    (0, vitest_1.it)('Dwarf cannot cast magic', () => {
        const dwarf = createSkillUser(races_1.Race.Dwarf);
        const magicSkill = {
            id: 'arcane_wave',
            name: 'Arcane Wave',
            description: 'Magic burst',
            category: 'magic',
            cost: { mp: 5 },
        };
        const check = (0, skills_1.canUseSkill)(dwarf, magicSkill);
        (0, vitest_1.expect)(check.ok).toBe(false);
    });
    (0, vitest_1.it)('Dwarf cannot use elements', () => {
        const dwarf = createSkillUser(races_1.Race.Dwarf);
        const elementalSkill = {
            id: 'water_shard',
            name: 'Water Shard',
            description: 'Elemental cast',
            category: 'elemental',
            cost: { mp: 5 },
        };
        const check = (0, skills_1.canUseSkill)(dwarf, elementalSkill);
        (0, vitest_1.expect)(check.ok).toBe(false);
    });
    (0, vitest_1.it)('Dwarf takes 50% magic damage', () => {
        const result = (0, damage_1.calculateFinalDamage)({
            attacker: { stats: createStats() },
            defender: { stats: createStats(), raceModifiers: races_1.RACE_DEFINITIONS[races_1.Race.Dwarf].modifiers },
            damagePayload: {
                category: 'magic',
                amount: 100,
            },
        });
        (0, vitest_1.expect)(result.finalDamage).toBe(50);
    });
    (0, vitest_1.it)('Dwarf takes 50% elemental damage', () => {
        const result = (0, damage_1.calculateFinalDamage)({
            attacker: { stats: createStats() },
            defender: { stats: createStats(), raceModifiers: races_1.RACE_DEFINITIONS[races_1.Race.Dwarf].modifiers },
            damagePayload: {
                category: 'elemental',
                amount: 100,
                elementType: 'fire',
            },
        });
        (0, vitest_1.expect)(result.finalDamage).toBe(100);
    });
    (0, vitest_1.it)('Dwarf takes full runic damage', () => {
        const result = (0, damage_1.calculateFinalDamage)({
            attacker: { stats: createStats() },
            defender: { stats: createStats(), raceModifiers: races_1.RACE_DEFINITIONS[races_1.Race.Dwarf].modifiers },
            damagePayload: {
                category: 'runic',
                amount: 100,
                runicType: 'binding',
            },
        });
        (0, vitest_1.expect)(result.finalDamage).toBe(60);
    });
    (0, vitest_1.it)('Dwarf is immune to magical curse, silence, stun, and blind', () => {
        const defender = { raceModifiers: races_1.RACE_DEFINITIONS[races_1.Race.Dwarf].modifiers };
        (0, vitest_1.expect)((0, damage_1.isEffectBlockedByRace)(defender, 'curse', 'magic')).toBe(true);
        (0, vitest_1.expect)((0, damage_1.isEffectBlockedByRace)(defender, 'silence', 'magic')).toBe(true);
        (0, vitest_1.expect)((0, damage_1.isEffectBlockedByRace)(defender, 'stun', 'magic')).toBe(true);
        (0, vitest_1.expect)((0, damage_1.isEffectBlockedByRace)(defender, 'blind', 'magic')).toBe(true);
    });
    (0, vitest_1.it)('Dwarf can still be stunned by physical shield bash', () => {
        const defender = { raceModifiers: races_1.RACE_DEFINITIONS[races_1.Race.Dwarf].modifiers };
        (0, vitest_1.expect)((0, damage_1.isEffectBlockedByRace)(defender, 'stun', 'physical')).toBe(false);
    });
    (0, vitest_1.it)('uses race-based starting free points', () => {
        (0, vitest_1.expect)((0, character_rules_1.getStartingFreePoints)(races_1.Race.Human)).toBe(10);
        (0, vitest_1.expect)((0, character_rules_1.getStartingFreePoints)(races_1.Race.Dwarf)).toBe(5);
        (0, vitest_1.expect)((0, character_rules_1.getStartingFreePoints)(races_1.Race.WoodElf)).toBe(5);
        (0, vitest_1.expect)((0, character_rules_1.getStartingFreePoints)(races_1.Race.HighElf)).toBe(5);
    });
    (0, vitest_1.it)('blocks non-elemental elven magic learning', () => {
        (0, vitest_1.expect)((0, character_rules_1.canRaceUseSkillDefinition)(races_1.Race.WoodElf, {
            type: index_1.SkillType.ELEMENTAL_MAGIC,
            requirements: { requiredMagicSchools: [index_1.MagicSchoolType.ELEMENTAL] },
            damage: [],
            tags: [],
        })).toBe(true);
        (0, vitest_1.expect)((0, character_rules_1.canRaceUseSkillDefinition)(races_1.Race.WoodElf, {
            type: index_1.SkillType.NORMAL_MAGIC,
            requirements: { requiredMagicSchools: [index_1.MagicSchoolType.ILLUSION] },
            damage: [],
            tags: ['illusion'],
        })).toBe(false);
    });
    (0, vitest_1.it)('applies extra high elf ice damage only to ice-tagged elemental skills', () => {
        const ice = (0, damage_1.calculateFinalDamage)({
            attacker: { stats: createStats(), race: races_1.Race.HighElf },
            defender: { stats: createStats() },
            damagePayload: {
                category: 'elemental',
                amount: 10,
                elementType: 'water',
                tags: ['ice'],
            },
        });
        const fire = (0, damage_1.calculateFinalDamage)({
            attacker: { stats: createStats(), race: races_1.Race.HighElf },
            defender: { stats: createStats() },
            damagePayload: {
                category: 'elemental',
                amount: 10,
                elementType: 'fire',
            },
        });
        (0, vitest_1.expect)(ice.finalDamage).toBe(23);
        (0, vitest_1.expect)(fire.finalDamage).toBe(15);
    });
    (0, vitest_1.it)('applies citizenship changes and academy bypasses', () => {
        const luminorStart = (0, character_rules_1.createInitialCitizenshipState)('luminor');
        (0, vitest_1.expect)(luminorStart.kingdomReputation.luminor).toBe(20);
        (0, vitest_1.expect)(luminorStart.kingdomReputation.artalon).toBe(10);
        (0, vitest_1.expect)(luminorStart.kingdomReputation.terimia).toBe(10);
        const updated = (0, character_rules_1.applyCitizenshipChange)({
            citizenshipKingdomId: 'artalon',
            kingdomReputation: { luminor: 0, artalon: 20, kriantar: 0, terimia: 0, argos: 0 },
        }, 'luminor');
        (0, vitest_1.expect)(updated.citizenshipKingdomId).toBe('luminor');
        (0, vitest_1.expect)(updated.kingdomReputation.artalon).toBe(-30);
        (0, vitest_1.expect)(updated.kingdomReputation.luminor).toBe(20);
        (0, vitest_1.expect)((0, character_rules_1.canAccessAcademy)({
            race: races_1.Race.Human,
            academyId: 'academy_black_rite',
            citizenshipKingdomId: 'terimia',
        })).toEqual({ allowed: true, bypassIntroQuest: true });
    });
    (0, vitest_1.it)('derives merchant and city reputation outcomes', () => {
        const modifiers = (0, character_rules_1.getMerchantPriceModifiers)({
            kingdomReputation: 80,
            playerKingdomId: 'luminor',
        });
        (0, vitest_1.expect)(modifiers.tradeBlocked).toBe(false);
        (0, vitest_1.expect)(modifiers.buyMultiplier).toBe(0.8);
        (0, vitest_1.expect)(modifiers.sellMultiplier).toBe(1.38);
        (0, vitest_1.expect)((0, character_rules_1.getCityAccessOutcome)(-90)).toMatchObject({ allowed: false, hostile: true });
    });
});

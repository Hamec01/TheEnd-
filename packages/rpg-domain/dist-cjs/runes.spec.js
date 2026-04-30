"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const races_1 = require("./races");
const runes_1 = require("./runes");
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
function createCharacter(overrides = {}) {
    return {
        race: races_1.Race.Human,
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
(0, vitest_1.describe)('rune system foundation', () => {
    (0, vitest_1.it)('contains all expected rune ids and ids are unique', () => {
        const ids = Object.keys(runes_1.RUNE_DEFINITIONS);
        const unique = new Set(ids);
        (0, vitest_1.expect)(unique.size).toBe(ids.length);
        (0, vitest_1.expect)(ids.sort()).toEqual([...EXPECTED_RUNE_IDS].sort());
    });
    (0, vitest_1.it)('all runes have required fields and cost object', () => {
        for (const rune of Object.values(runes_1.RUNE_DEFINITIONS)) {
            (0, vitest_1.expect)(rune.name.trim().length).toBeGreaterThan(0);
            (0, vitest_1.expect)(rune.category).toBeDefined();
            (0, vitest_1.expect)(rune.description.trim().length).toBeGreaterThan(0);
            (0, vitest_1.expect)(rune.cost).toBeDefined();
        }
    });
    (0, vitest_1.it)('forbidden runes are unstable without binding runes', () => {
        const forbiddenRunes = Object.values(runes_1.RUNE_DEFINITIONS).filter((rune) => rune.category === 'forbidden' || rune.forbidden);
        for (const rune of forbiddenRunes) {
            const complex = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), [rune.id]);
            (0, vitest_1.expect)(complex.isUnstable).toBe(true);
        }
    });
    (0, vitest_1.it)('binding runes reduce complex risk', () => {
        const noBinding = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['zagrann']);
        const withBinding = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['zagrann', 'hald']);
        (0, vitest_1.expect)(withBinding.riskChance).toBeLessThan(noBinding.riskChance);
    });
    (0, vitest_1.it)('amplifier rune increases power and risk', () => {
        const base = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['drakn']);
        const amplified = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['drakn', 'orkann']);
        const basePower = base.combinedEffects.reduce((sum, effect) => sum + (effect.value ?? 0), 0);
        const amplifiedPower = amplified.combinedEffects.reduce((sum, effect) => sum + (effect.value ?? 0), 0);
        (0, vitest_1.expect)(amplified.riskChance).toBeGreaterThan(base.riskChance);
        (0, vitest_1.expect)(amplifiedPower).toBeGreaterThan(basePower);
    });
    (0, vitest_1.it)('dwarf can carve runes but cannot create rune knowledge by default', () => {
        const permissions = (0, runes_1.getDefaultRunePermissionsForRace)(races_1.Race.Dwarf);
        (0, vitest_1.expect)(permissions.canCarveRunes).toBe(true);
        (0, vitest_1.expect)(permissions.knowsRuneCraft).toBe(false);
    });
    (0, vitest_1.it)('playable races cannot naturally create rune complexes without knowsRuneCraft', () => {
        const races = [races_1.Race.Human, races_1.Race.HighElf, races_1.Race.WoodElf, races_1.Race.Dwarf];
        for (const race of races) {
            const permissions = (0, runes_1.getDefaultRunePermissionsForRace)(race);
            const canCreate = (0, runes_1.canCharacterCreateRuneComplex)(createCharacter({
                race,
                ...permissions,
            }));
            (0, vitest_1.expect)(canCreate).toBe(false);
        }
    });
    (0, vitest_1.it)('forbidden complex without binding has high risk, with binding has lower risk', () => {
        const noBinding = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['zagrann', 'grimr']);
        const withBinding = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['zagrann', 'grimr', 'harran']);
        (0, vitest_1.expect)(noBinding.riskChance).toBeGreaterThanOrEqual(0.6);
        (0, vitest_1.expect)(withBinding.riskChance).toBeLessThan(noBinding.riskChance);
    });
    (0, vitest_1.it)('applyRuneCost reduces hp and stamina correctly', () => {
        const character = createCharacter({ currentHp: 50, currentStamina: 40, currentMp: 30 });
        const updated = (0, runes_1.applyRuneCost)(character, {
            hp: 7,
            stamina: 9,
            mp: 5,
        });
        (0, vitest_1.expect)(updated.currentHp).toBe(43);
        (0, vitest_1.expect)(updated.currentStamina).toBe(31);
        (0, vitest_1.expect)(updated.currentMp).toBe(25);
    });
    (0, vitest_1.it)('rune backlash chance is reduced by willpower', () => {
        const complex = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['zagrann', 'grimr']);
        const lowWillpowerChance = (0, runes_1.calculateRuneBacklashChance)(complex, 5);
        const highWillpowerChance = (0, runes_1.calculateRuneBacklashChance)(complex, 90);
        (0, vitest_1.expect)(highWillpowerChance).toBeLessThan(lowWillpowerChance);
    });
    (0, vitest_1.it)('powerful runes always have sacrifice or risk price', () => {
        (0, vitest_1.expect)(() => (0, runes_1.ensureRuneDesignSafety)(runes_1.RUNE_DEFINITIONS)).not.toThrow();
    });
    (0, vitest_1.it)('complex rune systems without binding runes are unstable and very risky', () => {
        const complex = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['uragg', 'drakn', 'skragg']);
        (0, vitest_1.expect)(complex.isUnstable).toBe(true);
        (0, vitest_1.expect)(complex.riskChance).toBeGreaterThanOrEqual(0.75);
    });
    (0, vitest_1.it)('forbidden rune complexes always retain meaningful risk even with binding', () => {
        const complex = (0, runes_1.calculateRuneComplex)(Object.values(runes_1.RUNE_DEFINITIONS), ['zagrann', 'harran']);
        (0, vitest_1.expect)(complex.riskChance).toBeGreaterThanOrEqual(0.28);
    });
});

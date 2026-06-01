"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DerivedStatsCalculator = void 0;
exports.toCombatReadyEntity = toCombatReadyEntity;
const races_1 = require("./races");
class DerivedStatsCalculator {
    static calculate(stats) {
        return {
            maxHp: stats.hp,
            maxMp: stats.mp,
            maxStamina: stats.stamina,
            physicalDamage: Math.round(stats.strength * 1.55 + stats.dexterity * 0.25),
            initiative: Math.round(stats.perception * 0.7 + stats.dexterity * 0.8),
            hitChance: Math.round(58 + stats.perception * 1.1 + stats.dexterity * 0.6 + stats.luck * 0.3),
            dodgeChance: Math.round(stats.dexterity * 1 + stats.luck * 0.35),
            magicPower: Math.round(stats.intelligence * 2),
            physicalResistance: Math.round(stats.constitution * 0.95),
            magicResistance: Math.round(stats.willpower * 1.1),
            controlResistance: Math.round(stats.willpower * 1.1 + stats.constitution * 0.7),
        };
    }
}
exports.DerivedStatsCalculator = DerivedStatsCalculator;
function toCombatReadyEntity(character) {
    const derived = DerivedStatsCalculator.calculate(character.stats);
    const raceModifiers = (0, races_1.getRaceDefinition)(character.race).modifiers;
    return {
        id: character.id,
        name: character.name,
        race: character.race,
        currentHp: derived.maxHp,
        currentMp: derived.maxMp,
        currentStamina: derived.maxStamina,
        maxHp: derived.maxHp,
        maxMp: derived.maxMp,
        maxStamina: derived.maxStamina,
        stats: character.stats,
        derived,
        raceModifiers,
        activeEffects: [],
        isAlive: true,
    };
}

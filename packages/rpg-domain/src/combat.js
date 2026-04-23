import { getRaceDefinition } from './races';
export class DerivedStatsCalculator {
    static calculate(stats) {
        return {
            maxHp: stats.hp,
            maxMp: stats.mp,
            maxStamina: stats.stamina,
            physicalDamage: Math.round(stats.strength * 1.8),
            initiative: Math.round(stats.perception * 1.2 + stats.dexterity),
            hitChance: Math.round(60 + stats.perception * 1.7),
            dodgeChance: Math.round(stats.dexterity * 1.2),
            magicPower: Math.round(stats.intelligence * 2),
            physicalResistance: Math.round(stats.constitution * 1.4),
            magicResistance: Math.round(stats.willpower * 1.4),
            controlResistance: Math.round(stats.willpower * 1.1 + stats.constitution * 0.7),
        };
    }
}
export function toCombatReadyEntity(character) {
    const derived = DerivedStatsCalculator.calculate(character.stats);
    const raceModifiers = getRaceDefinition(character.race).modifiers;
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

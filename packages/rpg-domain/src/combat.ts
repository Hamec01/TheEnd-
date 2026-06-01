import type { Race, RaceModifiers } from './races';
import { getRaceDefinition } from './races';
import type { StatBlock } from './stats';

export interface CharacterData {
  id: string;
  name: string;
  race: Race;
  level: number;
  exp: number;
  stats: StatBlock;
}

export interface CombatStatsSnapshot {
  maxHp: number;
  maxMp: number;
  maxStamina: number;
  physicalDamage: number;
  initiative: number;
  hitChance: number;
  dodgeChance: number;
  magicPower: number;
  physicalResistance: number;
  magicResistance: number;
  controlResistance: number;
}

export interface CombatReadyEntity {
  id: string;
  name: string;
  race: Race;
  currentHp: number;
  currentMp: number;
  currentStamina: number;
  maxHp: number;
  maxMp: number;
  maxStamina: number;
  stats: StatBlock;
  derived: CombatStatsSnapshot;
  raceModifiers: RaceModifiers;
  activeEffects: string[];
  isAlive: boolean;
}

export class DerivedStatsCalculator {
  static calculate(stats: StatBlock): CombatStatsSnapshot {
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

export function toCombatReadyEntity(character: CharacterData): CombatReadyEntity {
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

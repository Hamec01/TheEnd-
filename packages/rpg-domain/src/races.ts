import { PRIMARY_STATS, type StatBlock } from './stats';

export enum Race {
  Human = 'HUMAN',
  Dwarf = 'DWARF',
  HighElf = 'HIGH_ELF',
  WoodElf = 'WOOD_ELF',
}

export interface RaceModifiers {
  expGainMultiplier: number;
  canUseMagic: boolean;
  canUseElements: boolean;
  magicDamageTakenMultiplier: number;
  elementDamageTakenMultiplier: number;
  magicMpCostMultiplier: number;
  elementMpCostMultiplier: number;
  immuneToMagicalCurses?: boolean;
  immuneToMagicalSilence?: boolean;
  immuneToMagicalStun?: boolean;
  immuneToMagicalBlind?: boolean;
}

export interface RaceDefinition {
  race: Race;
  label: string;
  description: string;
  bonuses: string[];
  restrictions: string[];
  baseStats: StatBlock;
  modifiers: RaceModifiers;
}

export const RACE_DEFINITIONS: Record<Race, RaceDefinition> = {
  [Race.Human]: {
    race: Race.Human,
    label: 'Люди',
    description: 'Универсальная раса. Люди хорошо изучают обычную магию, но стихии даются им тяжелее.',
    bonuses: ['+10% к опыту', 'Обычная магия без штрафа', 'Гибкое развитие'],
    restrictions: ['Стихийные навыки стоят x2 MP'],
    baseStats: {
      hp: 70,
      mp: 60,
      stamina: 65,
      strength: 5,
      constitution: 5,
      dexterity: 5,
      intelligence: 6,
      luck: 5,
      perception: 5,
      willpower: 5,
    },
    modifiers: {
      expGainMultiplier: 1.1,
      canUseMagic: true,
      canUseElements: true,
      magicDamageTakenMultiplier: 1,
      elementDamageTakenMultiplier: 1,
      magicMpCostMultiplier: 1,
      elementMpCostMultiplier: 2,
    },
  },
  [Race.Dwarf]: {
    race: Race.Dwarf,
    label: 'Гномы',
    description: 'Крепкая и выносливая раса, созданная без магии. Гномы не используют магию и стихии, но крайне устойчивы к ним.',
    bonuses: [
      '-50% входящего магического урона',
      '-50% входящего стихийного урона',
      'Иммунитет к магическим проклятиям',
      'Иммунитет к магическому онемению',
      'Иммунитет к магическому оглушению',
      'Иммунитет к магическому ослеплению',
    ],
    restrictions: ['Не может использовать магию', 'Не может использовать стихии'],
    baseStats: {
      hp: 85,
      mp: 20,
      stamina: 75,
      strength: 7,
      constitution: 8,
      dexterity: 4,
      intelligence: 4,
      luck: 5,
      perception: 4,
      willpower: 7,
    },
    modifiers: {
      expGainMultiplier: 1,
      canUseMagic: false,
      canUseElements: false,
      magicDamageTakenMultiplier: 0.5,
      elementDamageTakenMultiplier: 0.5,
      magicMpCostMultiplier: 999,
      elementMpCostMultiplier: 999,
      immuneToMagicalCurses: true,
      immuneToMagicalSilence: true,
      immuneToMagicalStun: true,
      immuneToMagicalBlind: true,
    },
  },
  [Race.HighElf]: {
    race: Race.HighElf,
    label: 'Высшие Эльфы',
    description: 'Высшие Эльфы - боевые эльфы, владеющие стихиями с рождения. Сильны в атакующих стихиях и магической мощи.',
    bonuses: ['Врождённая стихия', '2-3 случайных стихийных навыка при создании персонажа', 'Стихийные навыки без штрафа MP'],
    restrictions: ['Обычная магия стоит x2 MP'],
    baseStats: {
      hp: 65,
      mp: 80,
      stamina: 60,
      strength: 6,
      constitution: 4,
      dexterity: 6,
      intelligence: 8,
      luck: 5,
      perception: 6,
      willpower: 6,
    },
    modifiers: {
      expGainMultiplier: 1,
      canUseMagic: true,
      canUseElements: true,
      magicDamageTakenMultiplier: 1,
      elementDamageTakenMultiplier: 1,
      magicMpCostMultiplier: 2,
      elementMpCostMultiplier: 1,
    },
  },
  [Race.WoodElf]: {
    race: Race.WoodElf,
    label: 'Лесные Эльфы',
    description: 'Лесные Эльфы - ловкие охотники и мастера природных стихий. Сильны в мобильности, луках, контроле и выживании.',
    bonuses: ['Врождённая стихия', '2-3 случайных стихийных навыка при создании персонажа', 'Высокая ловкость и восприятие'],
    restrictions: ['Обычная магия стоит x2 MP'],
    baseStats: {
      hp: 65,
      mp: 70,
      stamina: 75,
      strength: 4,
      constitution: 4,
      dexterity: 8,
      intelligence: 6,
      luck: 5,
      perception: 8,
      willpower: 6,
    },
    modifiers: {
      expGainMultiplier: 1,
      canUseMagic: true,
      canUseElements: true,
      magicDamageTakenMultiplier: 1,
      elementDamageTakenMultiplier: 1,
      magicMpCostMultiplier: 2,
      elementMpCostMultiplier: 1,
    },
  },
};

export function ensureRaceBaseStatsAreValid(): void {
  for (const race of Object.values(Race)) {
    const definition = RACE_DEFINITIONS[race];
    if (!definition) {
      throw new Error(`Missing race definition for ${race}.`);
    }

    const { baseStats } = definition;
    if (baseStats.hp < 65) {
      throw new Error(`Race ${race} has invalid hp (${baseStats.hp}). Minimum is 65.`);
    }
    if (baseStats.mp < 0) {
      throw new Error(`Race ${race} has invalid mp (${baseStats.mp}). Minimum is 0.`);
    }
    if (baseStats.stamina < 0) {
      throw new Error(`Race ${race} has invalid stamina (${baseStats.stamina}). Minimum is 0.`);
    }

    for (const stat of PRIMARY_STATS) {
      if (typeof baseStats[stat] !== 'number' || Number.isNaN(baseStats[stat])) {
        throw new Error(`Race ${race} is missing numeric base stat: ${stat}.`);
      }
    }
  }
}

export function getRaceDefinition(race: Race): RaceDefinition {
  return RACE_DEFINITIONS[race];
}

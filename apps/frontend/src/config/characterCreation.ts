import { Race, type PrimaryStat, type StatBlock } from '@theend/rpg-domain';

export type CharacterGender = 'male' | 'female';

export interface CharacterTraitSet {
  experienceGainMultiplier?: number;
  elementalMagicCostMultiplier?: number;
  normalMagicCostMultiplier?: number;
  canUseMagic: boolean;
  canUseElementalMagic: boolean;
  randomStartingElements?: number;
  magicDamageTakenMultiplier?: number;
}

export interface CharacterCreationRaceConfig {
  race: Race;
  id: string;
  name: string;
  description: string;
  stats: StatBlock;
  traits: CharacterTraitSet;
  traitHighlights: string[];
}

export interface CharacterOrigin {
  id: string;
  name: string;
  bonuses: Partial<Record<PrimaryStat, number>>;
  description: string;
}

export interface CharacterElement {
  id: string;
  name: string;
}

export interface StartingElementSkill {
  elementId: string;
  skillId: string;
  name: string;
}

export const CHARACTER_CREATION_RACES: CharacterCreationRaceConfig[] = [
  {
    race: Race.Human,
    id: 'race_human',
    name: 'Человек',
    description: 'Люди - гибкая раса: +5% опыта, обычная магия без штрафа, стихийная магия стоит дороже.',
    stats: {
      hp: 100,
      mp: 100,
      stamina: 10,
      strength: 10,
      constitution: 10,
      dexterity: 10,
      intelligence: 10,
      luck: 10,
      perception: 10,
      willpower: 10,
    },
    traits: {
      experienceGainMultiplier: 1.05,
      elementalMagicCostMultiplier: 2.0,
      normalMagicCostMultiplier: 1.0,
      canUseMagic: true,
      canUseElementalMagic: true,
    },
    traitHighlights: [
      '+5% опыта',
      'Стихийная магия x2 MP',
      'Обычная магия без штрафа',
    ],
  },
  {
    race: Race.WoodElf,
    id: 'race_wood_elf',
    name: 'Лесной Эльф',
    description: 'Лесные эльфы сильны в ловкости и восприятии. Получают 1 случайную стихию на старте.',
    stats: {
      hp: 105,
      mp: 120,
      stamina: 10,
      strength: 10,
      constitution: 10,
      dexterity: 12,
      intelligence: 11,
      luck: 10,
      perception: 12,
      willpower: 11,
    },
    traits: {
      experienceGainMultiplier: 1.0,
      elementalMagicCostMultiplier: 0.5,
      normalMagicCostMultiplier: 2.0,
      canUseMagic: true,
      canUseElementalMagic: true,
      randomStartingElements: 1,
    },
    traitHighlights: [
      '1 случайная стихия',
      'Стихийная магия x0.5 MP',
      'Обычная магия x2 MP',
    ],
  },
  {
    race: Race.HighElf,
    id: 'race_high_elf',
    name: 'Высший Эльф',
    description: 'Высшие эльфы - мастера стихий. Получают 2 случайные стихии и высокий запас MP.',
    stats: {
      hp: 100,
      mp: 140,
      stamina: 9,
      strength: 10,
      constitution: 9,
      dexterity: 11,
      intelligence: 13,
      luck: 10,
      perception: 11,
      willpower: 13,
    },
    traits: {
      experienceGainMultiplier: 1.0,
      elementalMagicCostMultiplier: 0.5,
      normalMagicCostMultiplier: 2.0,
      canUseMagic: true,
      canUseElementalMagic: true,
      randomStartingElements: 2,
    },
    traitHighlights: [
      '2 случайные стихии',
      'Стихийная магия x0.5 MP',
      'Обычная магия x2 MP',
    ],
  },
  {
    race: Race.Dwarf,
    id: 'race_dwarf',
    name: 'Гном',
    description: 'Гномы не используют магию, но получают на 50% меньше магического урона.',
    stats: {
      hp: 130,
      mp: 0,
      stamina: 13,
      strength: 12,
      constitution: 14,
      dexterity: 8,
      intelligence: 10,
      luck: 10,
      perception: 9,
      willpower: 12,
    },
    traits: {
      experienceGainMultiplier: 1.0,
      canUseMagic: false,
      canUseElementalMagic: false,
      magicDamageTakenMultiplier: 0.5,
    },
    traitHighlights: [
      'Полный запрет магии',
      '-50% магического урона',
      'Максимальная выживаемость',
    ],
  },
];

export const HUMAN_ORIGINS: CharacterOrigin[] = [
  {
    id: 'origin_luminor',
    name: 'Луминор',
    bonuses: { luck: 1 },
    description: 'Королевство торговли, дипломатии и процветания.',
  },
  {
    id: 'origin_artalon',
    name: 'Арталон',
    bonuses: { strength: 1, stamina: 1 },
    description: 'Суровое военное королевство.',
  },
  {
    id: 'origin_kriantar',
    name: 'Криантар',
    bonuses: { intelligence: 1, willpower: 1 },
    description: 'Королевство знаний, культуры и союза с высшими эльфами.',
  },
  {
    id: 'origin_terimia',
    name: 'Теримия',
    bonuses: { willpower: 2 },
    description: 'Мрачное королевство дисциплины, смерти и некромантии.',
  },
  {
    id: 'origin_argos',
    name: 'Аргос',
    bonuses: { constitution: 1, strength: 1 },
    description: 'Жестокий край выживания, наемников и военной силы.',
  },
  {
    id: 'origin_free',
    name: 'Вольный',
    bonuses: {},
    description: 'Свободный странник без клятвы королю.',
  },
];

export const STARTING_ELEMENTS: CharacterElement[] = [
  { id: 'element_fire', name: 'Огонь' },
  { id: 'element_water', name: 'Вода' },
  { id: 'element_earth', name: 'Земля' },
  { id: 'element_air', name: 'Воздух' },
  { id: 'element_light', name: 'Свет' },
  { id: 'element_darkness', name: 'Тьма' },
];

export const STARTING_ELEMENT_SKILLS: Record<string, StartingElementSkill> = {
  element_fire: { elementId: 'element_fire', skillId: 'skill_fire_spark', name: 'Искра пламени' },
  element_water: { elementId: 'element_water', skillId: 'skill_water_arrow', name: 'Водяная стрела' },
  element_earth: { elementId: 'element_earth', skillId: 'skill_earth_grip', name: 'Хватка земли' },
  element_air: { elementId: 'element_air', skillId: 'skill_air_cut', name: 'Воздушный разрез' },
  element_light: { elementId: 'element_light', skillId: 'skill_light_flash', name: 'Вспышка света' },
  element_darkness: { elementId: 'element_darkness', skillId: 'skill_dark_shadow', name: 'Теневая метка' },
};

export const DEFAULT_AVATAR_BY_RACE_GENDER: Record<Race, Record<CharacterGender, string>> = {
  [Race.Human]: {
    male: '/art/races/human.png',
    female: '/art/races/human.png',
  },
  [Race.WoodElf]: {
    male: '/art/races/elf.png',
    female: '/art/races/elf.png',
  },
  [Race.HighElf]: {
    male: '/art/races/elf.png',
    female: '/art/races/elf.png',
  },
  [Race.Dwarf]: {
    male: '/art/races/dwarf.png',
    female: '/art/races/dwarf.png',
  },
};

export function getCharacterCreationRaceConfig(race: Race): CharacterCreationRaceConfig {
  const found = CHARACTER_CREATION_RACES.find((entry) => entry.race === race);
  if (!found) {
    return CHARACTER_CREATION_RACES[0];
  }
  return found;
}

export function getRandomStartingElements(count: number): CharacterElement[] {
  if (count <= 0) {
    return [];
  }
  const pool = [...STARTING_ELEMENTS];
  const picks: CharacterElement[] = [];
  while (pool.length > 0 && picks.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const [selected] = pool.splice(index, 1);
    picks.push(selected);
  }
  return picks;
}

export function getDefaultAvatarFor(race: Race, gender: CharacterGender): string {
  return DEFAULT_AVATAR_BY_RACE_GENDER[race][gender];
}

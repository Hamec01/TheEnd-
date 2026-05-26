import { Race, getStartingFreePoints, scaleResourceStat, type PrimaryStat, type StatBlock } from '@theend/rpg-domain';

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
  startingFreePoints: number;
  traits: CharacterTraitSet;
  traitHighlights: string[];
}

export interface CharacterOrigin {
  id: string;
  name: string;
  bonuses: Partial<Record<PrimaryStat, number>>;
  description: string;
  featureHighlights?: string[];
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

export interface CharacterAvatarPreset {
  id: string;
  name: string;
  imageUrl: string;
}

export interface CharacterCreationBanner {
  title: string;
  imageUrl: string;
}

export interface CharacterCreationLore {
  title: string;
  era: string;
  lead: string;
  paragraphs: string[];
}

export const CHARACTER_CREATION_RACES: CharacterCreationRaceConfig[] = [
  {
    race: Race.Human,
    id: 'race_human',
    name: 'Человек',
    description: 'Люди - гибкая раса: больше стартовых очков, доступ ко всем школам магии и сильная адаптивность.',
    stats: {
      hp: scaleResourceStat('hp', 10),
      mp: scaleResourceStat('mp', 10),
      stamina: scaleResourceStat('stamina', 10),
      strength: 10,
      constitution: 10,
      dexterity: 10,
      intelligence: 10,
      luck: 10,
      perception: 10,
      willpower: 10,
    },
    startingFreePoints: getStartingFreePoints(Race.Human),
    traits: {
      experienceGainMultiplier: 1.05,
      elementalMagicCostMultiplier: 1.0,
      normalMagicCostMultiplier: 1.0,
      canUseMagic: true,
      canUseElementalMagic: true,
    },
    traitHighlights: [
      '+5% опыта',
      '10 стартовых очков характеристик',
      'Доступ ко всем школам магии',
    ],
  },
  {
    race: Race.WoodElf,
    id: 'race_wood_elf',
    name: 'Лесной Эльф',
    description: 'Лесные эльфы сильны в ловкости и восприятии. Получают 1 случайную стихию на старте.',
    stats: {
      hp: scaleResourceStat('hp', 10.5),
      mp: scaleResourceStat('mp', 12),
      stamina: scaleResourceStat('stamina', 10),
      strength: 10,
      constitution: 10,
      dexterity: 12,
      intelligence: 11,
      luck: 10,
      perception: 12,
      willpower: 11,
    },
    startingFreePoints: getStartingFreePoints(Race.WoodElf),
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
      'Запрет на не-стихийную магию',
    ],
  },
  {
    race: Race.HighElf,
    id: 'race_high_elf',
    name: 'Высший Эльф',
    description: 'Высшие эльфы - мастера стихий. Получают 2 случайные стихии и высокий запас MP.',
    stats: {
      hp: scaleResourceStat('hp', 10),
      mp: scaleResourceStat('mp', 14),
      stamina: scaleResourceStat('stamina', 9),
      strength: 10,
      constitution: 9,
      dexterity: 11,
      intelligence: 13,
      luck: 10,
      perception: 11,
      willpower: 13,
    },
    startingFreePoints: getStartingFreePoints(Race.HighElf),
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
      'Запрет на не-стихийную магию',
    ],
  },
  {
    race: Race.Dwarf,
    id: 'race_dwarf',
    name: 'Гном',
    description: 'Гномы не используют магию, но получают на 50% меньше магического урона.',
    stats: {
      hp: scaleResourceStat('hp', 13),
      mp: 0,
      stamina: scaleResourceStat('stamina', 13),
      strength: 12,
      constitution: 14,
      dexterity: 8,
      intelligence: 10,
      luck: 10,
      perception: 9,
      willpower: 12,
    },
    startingFreePoints: getStartingFreePoints(Race.Dwarf),
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
    bonuses: {},
    featureHighlights: ['+80 starting gold', '+15% sell prices', '+10 base kingdom reputation'],
    description: 'Королевство торговли, дипломатии и процветания.',
  },
  {
    id: 'origin_artalon',
    name: 'Арталон',
    bonuses: {},
    description: 'Суровое военное королевство.',
  },
  {
    id: 'origin_kriantar',
    name: 'Криантар',
    bonuses: {},
    description: 'Королевство знаний, культуры и союза с высшими эльфами.',
  },
  {
    id: 'origin_terimia',
    name: 'Теремия',
    bonuses: {},
    description: 'Мрачное королевство дисциплины, смерти и некромантии.',
  },
  {
    id: 'origin_argos',
    name: 'Аргос',
    bonuses: {},
    description: 'Жестокий край выживания, наемников и военной силы.',
  },
  {
    id: 'origin_free',
    name: 'Вольный',
    bonuses: {},
    description: 'Свободный странник без клятвы королю.',
  },
];

const RACE_LORE_BY_RACE: Record<Race, CharacterCreationLore> = {
  [Race.Human]: {
    title: 'Люди Аталиона',
    era: '1452 год',
    lead: 'Люди остаются самым многочисленным и самым переменчивым народом известного мира.',
    paragraphs: [
      'Именно людские королевства в 1452 году ведут основную торговлю, заключают союзы, начинают войны и первыми тянутся к новым рудникам, границам и древним тайнам. Их сила не в чистоте крови, а в способности переживать бедствия и снова поднимать города там, где ещё недавно были пепел и руины.',
      'Человек в этом мире определяется не столько происхождением, сколько знаменем, под которым он вырос. Одни служат свету, другие стали, третьи знанию, а кто-то вообще отказывается клясться престолу. Поэтому путь человеческого героя всегда тесно связан с королевством или свободой, которую он выбирает.',
    ],
  },
  [Race.WoodElf]: {
    title: 'Лесные эльфы',
    era: '1452 год',
    lead: 'Лесные эльфы живут ближе всего к памяти лесов, ветров и старых троп, забытых остальными народами.',
    paragraphs: [
      'Их поселения редко находят случайно: они прячутся среди рощ, речных долин и пограничных лесов, где сама земля предупреждает о чужом шаге. Лесные эльфы ценят дозор, меткость и уважение к живому миру выше громкой славы и тяжёлых крепостных стен.',
      'В 1452 году многие их кланы держатся в стороне от больших тронов, но именно они остаются лучшими проводниками, следопытами и хранителями равновесия между цивилизацией и дикой землёй. Их магия естественна, почти бесшумна, и потому кажется древнее любых людских школ.',
    ],
  },
  [Race.HighElf]: {
    title: 'Высшие эльфы',
    era: '1452 год',
    lead: 'Высшие эльфы веками хранят традиции стихийных школ, магических архивов и дворов, где знание ценится выше спешки.',
    paragraphs: [
      'Их культура построена вокруг памяти, ритуала и понимания магии как языка мира, а не просто оружия. Высшие эльфы связаны с великими башнями, библиотеками и дворцами, где решения принимаются на десятилетия вперёд, а цена ошибки измеряется судьбой целых поколений.',
      'К 1452 году их влияние особенно сильно в землях Криантара и вокруг Аэл’арона. Они остаются советниками, магами и хранителями редкого знания, но платят за это отчуждением от более простого мира, где меч и голод иногда значат больше, чем самый изящный трактат о стихиях.',
    ],
  },
  [Race.Dwarf]: {
    title: 'Гномьи кланы',
    era: '1452 год',
    lead: 'Гномы пережили великие расколы мира благодаря камню, стали и ремеслу, а не милости магии.',
    paragraphs: [
      'После старых войн многие гномьи кланы ушли в глубины гор и превратили недра в крепости, шахты и города, где пламя кузниц заменяет солнце. Гранкор остаётся самым ярким символом этого пути: сердцем камня и стали, городом мастеров, легионов и древних механизмов.',
      'В 1452 году гномы по-прежнему с подозрением смотрят на магию и доверяют тому, что можно выкопать, выковать, взвесить и испытать ударом молота. Их уважают за прочность клятв, качество оружия и упрямство, которое часто переживает и правителей, и войны.',
    ],
  },
};

const ORIGIN_LORE_BY_ID: Record<string, CharacterCreationLore> = {
  origin_luminor: {
    title: 'Королевство Луминор',
    era: '1452 год',
    lead: 'Луминор остаётся землёй света, морской торговли, искусства и осторожной политической мудрости.',
    paragraphs: [
      'Солеймар, главный порт королевства, принимает купцов, послов и учёных со всего известного мира. Белый камень, золотые орнаменты, храмы и рынки сделали Луминор лицом цивилизованного мира для тех, кто впервые приходит в Аталион с моря.',
      'Но сила Луминора не только в столичном блеске. Элмора живёт ремеслом и лесами, Лоренхайм хранит библиотеки, театры и школы магии. В 1452 году королевство старается удержать мир и процветание, понимая, что даже самые светлые державы выживают лишь тогда, когда готовы защищать свои гавани и договоры.',
    ],
  },
  origin_artalon: {
    title: 'Королевство Арталон',
    era: '1452 год',
    lead: 'Арталон - суровая держава гарнизонов, укреплённых рубежей и людей, привыкших мерить цену словам по весу стали.',
    paragraphs: [
      'Среди гор, сухих земель и трудных дорог Тел’фарена Арталон выковал себя как военное государство. Здесь силу уважают не как прихоть, а как необходимость: стены должны стоять, солдат должен держать строй, а король - принимать решения быстрее, чем враг доберётся до ворот.',
      'В 1452 году Арталон ассоциируется с армией, дисциплиной и школой стихий. Под властью Элерида Железное Сердце королевство остаётся одним из самых жёстких и устойчивых оплотов людей, где слабость не прощают, но стойкость помнят очень долго.',
    ],
  },
  origin_kriantar: {
    title: 'Королевство Криантар',
    era: '1452 год',
    lead: 'Криантар называют землёй знания и союза, где магия, дипломатия и культура значат не меньше военной силы.',
    paragraphs: [
      'На северо-западе Аталиона Криантар вырос как королевство библиотек, башен, учёных дворов и союзов с высшими эльфами. Здесь влияние эльфийской культуры чувствуется в архитектуре, в школах разума и в самой манере править не только мечом, но и словом.',
      'В 1452 году Криантар остаётся интеллектуальным центром мира. Под властью Калдира Речного Льва королевство пытается сохранить равновесие между народами и не дать древнему знанию превратиться в новый источник раскола.',
    ],
  },
  origin_terimia: {
    title: 'Королевство Теремия',
    era: '1452 год',
    lead: 'Теремия живёт под знаком холодного порядка, силы воли и знаний, которых боятся в более мягких землях.',
    paragraphs: [
      'О Теремии редко говорят ласково, но почти всегда - с осторожностью. Это край строгих законов, мрачных дворов и власти, которая не отворачивается от смерти, а изучает её как часть миропорядка. Там, где другие королевства прячут самые тёмные искусства, Теремия подчиняет их дисциплине.',
      'В 1452 году теремийцы остаются символом суровой внутренней силы. Их боятся за некромантическую репутацию, но уважают за умение сохранять порядок там, где более “светлые” державы давно бы утонули в страхе, ереси и взаимной резне.',
    ],
  },
  origin_argos: {
    title: 'Королевство Аргос',
    era: '1452 год',
    lead: 'Аргос - земля крепостей, пепельных дорог и людей, для которых выживание давно стало ремеслом.',
    paragraphs: [
      'О воинах Аргоса судят по щитам, копьям и шрамам, а не по красоте доспеха. Здесь ценят выносливость, тяжёлую службу и способность стоять на границе тогда, когда другие уже ищут повод отступить. Города и гарнизоны Аргоса давно превратили его в жёсткий щит южных земель.',
      'К 1452 году Аргос остаётся королевством прагматиков, солдат и наёмников. Его лор не в золотых легендах, а в тяжёлой правде фронтира: хороший шлем должен пережить удар, хорошая броня - ещё один день, а хороший человек - не сломаться там, где ломается всё остальное.',
    ],
  },
  origin_free: {
    title: 'Вольные земли',
    era: '1452 год',
    lead: 'Не каждый человек желает родиться и умереть под чужим гербом.',
    paragraphs: [
      'Вольными зовут людей границы: тех, кто ушёл из-под клятвы, потерял дом, не признал чужой трон или просто вырос слишком далеко от столиц, чтобы считать себя чьим-то подданным. Их редко любят летописцы, зато именно среди них появляются проводники, искатели руды, наёмники и охотники за древними тайнами.',
      'В 1452 году путь вольного опаснее, чем жизнь при дворе, но он даёт то, чего не купишь за родословную: свободу выбирать своё имя, союз и судьбу без разрешения короны. Такой путь труднее, но и вся будущая слава будет принадлежать только тебе.',
    ],
  },
};

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

export const CHARACTER_CREATION_AVATAR_PRESETS: CharacterAvatarPreset[] = [
  {
    id: 'avatar_preset_1',
    name: 'Портрет I',
    imageUrl: '/assets/upload/images/library/img_1779696880875_81e0ef62-ChatGPT-Image-25-2026-.-11_14_24-1.png',
  },
  {
    id: 'avatar_preset_2',
    name: 'Портрет II',
    imageUrl: '/assets/upload/images/library/img_1779696903428_a5aeaffc-ChatGPT-Image-25-2026-.-11_14_24-2.png',
  },
  {
    id: 'avatar_preset_3',
    name: 'Портрет III',
    imageUrl: '/assets/upload/images/library/img_1779696916276_63ec420e-ChatGPT-Image-25-2026-.-11_14_25-3.png',
  },
  {
    id: 'avatar_preset_4',
    name: 'Портрет IV',
    imageUrl: '/assets/upload/images/library/img_1779697096518_af98e910-ChatGPT-Image-25-2026-.-11_17_16-3.png',
  },
  {
    id: 'avatar_preset_5',
    name: 'Портрет V',
    imageUrl: '/assets/upload/images/library/img_1779697109475_26142931-ChatGPT-Image-25-2026-.-11_17_16-1.png',
  },
  {
    id: 'avatar_preset_6',
    name: 'Портрет VI',
    imageUrl: '/assets/upload/images/library/img_1779697116151_54377bd3-ChatGPT-Image-25-2026-.-11_17_16-2.png',
  },
];

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

const CHARACTER_CREATION_RACE_BANNERS: Partial<Record<Race, CharacterCreationBanner>> = {
  [Race.WoodElf]: {
    title: 'Знамя лесных эльфов',
    imageUrl: '/assets/banners/forest_elfs.png',
  },
  [Race.HighElf]: {
    title: 'Знамя высших эльфов',
    imageUrl: '/assets/banners/hight_elfs.png',
  },
  [Race.Dwarf]: {
    title: 'Знамя гномов',
    imageUrl: '/assets/banners/dwarf.png',
  },
};

const CHARACTER_CREATION_ORIGIN_BANNERS: Record<string, CharacterCreationBanner> = {
  origin_luminor: {
    title: 'Знамя Луминора',
    imageUrl: '/assets/banners/luminor.png',
  },
  origin_artalon: {
    title: 'Знамя Арталона',
    imageUrl: '/assets/banners/atalion.png',
  },
  origin_kriantar: {
    title: 'Знамя Криантара',
    imageUrl: '/assets/banners/kriatar.png',
  },
  origin_terimia: {
    title: 'Знамя Теремии',
    imageUrl: '/assets/banners/terimia.png',
  },
  origin_argos: {
    title: 'Знамя Аргоса',
    imageUrl: '/assets/banners/argos.png',
  },
  origin_free: {
    title: 'Знамя вольных земель',
    imageUrl: '/assets/banners/feralas.png',
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

export function getCharacterCreationBanner(race: Race, originId?: string): CharacterCreationBanner | null {
  if (race === Race.Human) {
    if (!originId) {
      return null;
    }
    return CHARACTER_CREATION_ORIGIN_BANNERS[originId] ?? null;
  }
  return CHARACTER_CREATION_RACE_BANNERS[race] ?? null;
}

export function getCharacterCreationRaceLore(race: Race): CharacterCreationLore {
  return RACE_LORE_BY_RACE[race];
}

export function getCharacterCreationOriginLore(originId: string): CharacterCreationLore | null {
  return ORIGIN_LORE_BY_ID[originId] ?? null;
}

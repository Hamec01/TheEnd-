import type {
  MiningSkillEffectType,
  ProfessionSkill,
  ProfessionSkillEffect,
  ProfessionSkillEffectCondition,
  ProfessionSkillEffectValueType,
} from '../types/profession';

const STORAGE_KEY = 'theend.professionSkills.v2';

const DEFAULT_MINING_SKILL_ICON_BY_NAME: Record<string, string> = {
  'Крепкий замах': '/art/mining-skills/Крепкий замах.png',
  'Каменный слух': '/art/mining-skills/Каменный слух.png',
  'Рабочее дыхание': '/art/mining-skills/Рабочее дыхание.png',
  'Осторожный удар': '/art/mining-skills/Осторожный удар.png',
  'Рудная привычка': '/art/mining-skills/Рудная привычка.png',
  'Подпорки': '/art/mining-skills/Подпорки.png',
  'Страховочная верёвка': '/art/mining-skills/Страховочная верёвка_1.png',
  'Тёмный глаз': '/art/mining-skills/Тёмный глаз.png',
  'Тяжёлая каска': '/art/mining-skills/Тяжёлая каска.png',
  'Пыльные лёгкие': '/art/mining-skills/Пыльные лёгкие.png',
  'Чутьё прохода': '/art/mining-skills/Чутьё прохода.png',
  'Не смотреть назад': '/art/mining-skills/Не смотреть назад.png',
  'Глубокий вдох': '/art/mining-skills/Глубокий вдох.png',
  'Анкерная верёвка': '/art/mining-skills/Анкерная верёвка.png',
  'Жила под ногами': '/art/mining-skills/Жила под ногами.png',
  'Каменная выдержка': '/art/mining-skills/Каменная выдержка.png',
  'Гномий взгляд': '/art/mining-skills/Гномий взгляд.png',
  'Чтение трещин': '/art/mining-skills/Чтение трещин.png',
  'Распорка мастера': '/art/mining-skills/Распорка мастера.png',
  'Карта подземья': '/art/mining-skills/Карта подземья.png',
  'Сердце глубины': '/art/mining-skills/Сердце глубины.png',
  'Лавовая осторожность': '/art/mining-skills/Лавовая осторожность.png',
  'Последний удар': '/art/mining-skills/Последний удар.png',
  'Один шаг от смерти': '/art/mining-skills/Один шаг от смерти.png',
  'Блеск в камне': '/art/mining-skills/Блеск в камне.png',
  'Острый глаз': '/art/mining-skills/Острый глаз.png',
  'Чистая жила': '/art/mining-skills/Чистая жила.png',
  'Богатый мешок': '/art/mining-skills/Богатый мешок.png',
  'Мягкий удар': '/art/mining-skills/Мягкий удар.png',
  'Золотой нюх': '/art/mining-skills/Золотой нюх.png',
  'Камнерез': '/art/mining-skills/Камнерез.png',
  'Торговый глаз': '/art/mining-skills/Торговый глаз.png',
  'Синяя прожилка': '/art/mining-skills/Синяя прожилка.png',
  'Неповреждённый кристалл': '/art/mining-skills/Неповреждённый кристалл.png',
  'Память камня': '/art/mining-skills/Память камня.png',
  'Чистое сердце кристалла': '/art/mining-skills/Чистое сердце кристалла.png',
  'Следы древних': '/art/mining-skills/Следы древних.png',
  'Не трогай знак': '/art/mining-skills/Не трогай знак.png',
  'Шёпот камня': '/art/mining-skills/Шёпот камня.png',
  'Язык трещин': '/art/mining-skills/Язык трещин.png',
};

function createTimestamp(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = Array.from(new Set(
    value.map((entry) => String(entry ?? '').trim()).filter(Boolean),
  ));
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeCondition(value: unknown): ProfessionSkillEffectCondition | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const condition: ProfessionSkillEffectCondition = {};
  const minDepth = Number(raw.minDepth);
  const maxDepth = Number(raw.maxDepth);
  const remainingHitsMin = Number(raw.remainingHitsMin);
  const remainingHitsMax = Number(raw.remainingHitsMax);
  if (Number.isFinite(minDepth)) {
    condition.minDepth = Math.max(0, Math.floor(minDepth));
  }
  if (Number.isFinite(maxDepth)) {
    condition.maxDepth = Math.max(0, Math.floor(maxDepth));
  }
  if (Number.isFinite(remainingHitsMin)) {
    condition.remainingHitsMin = Math.max(0, Math.floor(remainingHitsMin));
  }
  if (Number.isFinite(remainingHitsMax)) {
    condition.remainingHitsMax = Math.max(0, Math.floor(remainingHitsMax));
  }
  const mineTheme = normalizeStringArray(raw.mineTheme);
  const mineDangerLevel = normalizeStringArray(raw.mineDangerLevel);
  const hazardType = normalizeStringArray(raw.hazardType);
  const blockType = normalizeStringArray(raw.blockType);
  const lootRarity = normalizeStringArray(raw.lootRarity);
  const itemTags = normalizeStringArray(raw.itemTags);
  if (mineTheme) {
    condition.mineTheme = mineTheme;
  }
  if (mineDangerLevel) {
    condition.mineDangerLevel = mineDangerLevel;
  }
  if (hazardType) {
    condition.hazardType = hazardType;
  }
  if (blockType) {
    condition.blockType = blockType;
  }
  if (lootRarity) {
    condition.lootRarity = lootRarity;
  }
  if (itemTags) {
    condition.itemTags = itemTags;
  }
  return Object.keys(condition).length > 0 ? condition : undefined;
}

function normalizeParams(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizeValueType(value: unknown): ProfessionSkillEffectValueType | undefined {
  return value === 'flat' || value === 'percent' || value === 'boolean'
    ? value
    : undefined;
}

function normalizeEffect(effect: unknown, index: number, skillId: string): ProfessionSkillEffect | null {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
    return null;
  }
  const raw = effect as Record<string, unknown>;
  const type = String(raw.type ?? '').trim();
  if (!type) {
    return null;
  }
  const value = raw.value === undefined ? undefined : Number(raw.value);
  const chance = raw.chance === undefined ? undefined : Number(raw.chance);
  const maxUsesPerRun = raw.maxUsesPerRun === undefined ? undefined : Number(raw.maxUsesPerRun);
  const maxUsesPerDepth = raw.maxUsesPerDepth === undefined ? undefined : Number(raw.maxUsesPerDepth);

  return {
    id: String(raw.id ?? `${skillId}-effect-${index + 1}`).trim(),
    type,
    value: Number.isFinite(value) ? value : undefined,
    valueType: normalizeValueType(raw.valueType) ?? 'flat',
    chance: typeof chance === 'number' && Number.isFinite(chance) ? Math.max(0, Math.min(1, chance)) : undefined,
    maxUsesPerRun: typeof maxUsesPerRun === 'number' && Number.isFinite(maxUsesPerRun)
      ? Math.max(0, Math.floor(maxUsesPerRun))
      : undefined,
    maxUsesPerDepth: typeof maxUsesPerDepth === 'number' && Number.isFinite(maxUsesPerDepth)
      ? Math.max(0, Math.floor(maxUsesPerDepth))
      : undefined,
    target: raw.target === undefined ? undefined : String(raw.target ?? '').trim() || undefined,
    condition: normalizeCondition(raw.condition),
    params: normalizeParams(raw.params),
  };
}

function normalizeSkill(skill: unknown): ProfessionSkill | null {
  if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
    return null;
  }
  const raw = skill as Record<string, unknown>;
  const id = String(raw.id ?? '').trim();
  const professionId = String(raw.professionId ?? '').trim();
  const name = String(raw.name ?? '').trim();
  if (!id || !professionId || !name) {
    return null;
  }
  const description = String(raw.description ?? '').trim();
  const requiredLevel = Math.max(1, Math.floor(Number(raw.requiredLevel ?? 1)));
  const skillPointCost = Math.max(0, Math.floor(Number(raw.skillPointCost ?? 1)));
  const requiredSkillIds = normalizeStringArray(raw.requiredSkillIds) ?? [];
  const requiredBranchIds = normalizeStringArray(raw.requiredBranchIds) ?? [];
  const effectsSource = Array.isArray(raw.effects) ? raw.effects : [];
  const effects = effectsSource
    .map((entry, index) => normalizeEffect(entry, index, id))
    .filter((entry): entry is ProfessionSkillEffect => Boolean(entry));

  return {
    id,
    professionId,
    name,
    description,
    requiredLevel,
    requiredSkillIds,
    requiredBranchIds,
    branchId: raw.branchId === undefined ? undefined : String(raw.branchId ?? '').trim() || undefined,
    skillPointCost,
    effects,
    icon: raw.icon === undefined ? undefined : String(raw.icon ?? '').trim() || undefined,
    positionX: Number.isFinite(Number(raw.positionX)) ? Number(raw.positionX) : undefined,
    positionY: Number.isFinite(Number(raw.positionY)) ? Number(raw.positionY) : undefined,
    isEnabled: raw.isEnabled !== false,
    createdAt: raw.createdAt === undefined ? undefined : String(raw.createdAt ?? '').trim() || undefined,
    updatedAt: raw.updatedAt === undefined ? undefined : String(raw.updatedAt ?? '').trim() || undefined,
  };
}

function effect(
  type: MiningSkillEffectType,
  value: number | undefined,
  valueType: ProfessionSkillEffectValueType,
  extra?: Partial<ProfessionSkillEffect>,
): ProfessionSkillEffect {
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    value,
    valueType,
    ...extra,
  };
}

function createDefaultProfessionSkills(): ProfessionSkill[] {
  const now = createTimestamp();
  const miningSkill = (params: {
    id: string;
    name: string;
    description: string;
    requiredLevel: number;
    skillPointCost: number;
    branchId?: string;
    requiredSkillIds?: string[];
    requiredBranchIds?: string[];
    effects: ProfessionSkillEffect[];
  }): ProfessionSkill => ({
    id: params.id,
    professionId: 'mining',
    name: params.name,
    description: params.description,
    requiredLevel: params.requiredLevel,
    requiredSkillIds: params.requiredSkillIds ?? [],
    requiredBranchIds: params.requiredBranchIds ?? [],
    branchId: params.branchId,
    skillPointCost: params.skillPointCost,
    effects: params.effects,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  const collapseHazards = ['minor_collapse', 'medium_collapse', 'major_collapse', 'deadly_collapse'];

  return [
    miningSkill({
      id: 'mining_firm_swing',
      name: 'Крепкий замах',
      branchId: 'mining_branch_common',
      requiredLevel: 1,
      skillPointCost: 1,
      description: 'Горняк учится вкладывать силу в удар без лишнего расхода дыхания. Удары киркой тратят меньше stamina.',
      effects: [effect('mine_stamina_cost_modifier', -5, 'percent')],
    }),
    miningSkill({
      id: 'mining_stone_hearing',
      name: 'Каменный слух',
      branchId: 'mining_branch_common',
      requiredLevel: 1,
      skillPointCost: 1,
      description: 'Опытный слух помогает различать пустую породу, жилу и опасную трещину до удара.',
      effects: [effect('mine_block_hint_chance', 0.12, 'flat')],
    }),
    miningSkill({
      id: 'mining_work_breathing',
      name: 'Рабочее дыхание',
      branchId: 'mining_branch_common',
      requiredLevel: 1,
      skillPointCost: 1,
      description: 'Горняк привыкает к тяжёлому воздуху шахты и получает дополнительную stamina во время спуска.',
      effects: [effect('mine_extra_stamina', 10, 'flat')],
    }),
    miningSkill({
      id: 'mining_careful_strike',
      name: 'Осторожный удар',
      branchId: 'mining_branch_common',
      requiredLevel: 2,
      skillPointCost: 1,
      description: 'Удар становится точнее и реже тревожит нестабильную породу. Снижает шанс обвала.',
      effects: [effect('mine_collapse_chance_modifier', -5, 'percent')],
    }),
    miningSkill({
      id: 'mining_ore_habit',
      name: 'Рудная привычка',
      branchId: 'mining_branch_common',
      requiredLevel: 2,
      skillPointCost: 1,
      description: 'Горняк лучше различает полезные прожилки и чаще находит руду вместо пустой породы.',
      effects: [effect('mine_ore_chance_modifier', 5, 'percent')],
    }),

    miningSkill({
      id: 'mining_support_beams',
      name: 'Подпорки',
      branchId: 'mining_branch_transition',
      requiredLevel: 3,
      skillPointCost: 1,
      requiredSkillIds: ['mining_firm_swing', 'mining_stone_hearing', 'mining_work_breathing', 'mining_careful_strike', 'mining_ore_habit'],
      description: 'Горняк умеет быстро укрепить опасный участок. Первый серьёзный обвал за спуск частично гасится.',
      effects: [
        effect('mine_ignore_first_hazard', 1, 'boolean', {
          maxUsesPerRun: 1,
          condition: { hazardType: collapseHazards },
          params: { damageMultiplier: 0.5 },
        }),
      ],
    }),
    miningSkill({
      id: 'mining_safety_rope',
      name: 'Страховочная верёвка',
      branchId: 'mining_branch_transition',
      requiredLevel: 3,
      skillPointCost: 1,
      requiredSkillIds: ['mining_firm_swing', 'mining_stone_hearing', 'mining_work_breathing', 'mining_careful_strike', 'mining_ore_habit'],
      description: 'Страховочная верёвка помогает выбраться при отступлении и сохранить больше добычи.',
      effects: [effect('mine_retreat_loot_save', 15, 'percent')],
    }),
    miningSkill({
      id: 'mining_dark_eye',
      name: 'Тёмный глаз',
      branchId: 'mining_branch_transition',
      requiredLevel: 4,
      skillPointCost: 1,
      requiredSkillIds: ['mining_firm_swing', 'mining_stone_hearing', 'mining_work_breathing', 'mining_careful_strike', 'mining_ore_habit'],
      description: 'Глаза привыкают к шахтной тьме. Иногда в начале глубины горняк чувствует направление скрытого прохода.',
      effects: [effect('mine_start_with_passage_hint', 1, 'boolean', { chance: 0.15 })],
    }),

    miningSkill({
      id: 'mining_heavy_helmet',
      name: 'Тяжёлая каска',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 5,
      skillPointCost: 1,
      description: 'Крепкая каска и привычка держать голову ниже спасают от падающих камней. Снижает урон от обвалов.',
      effects: [effect('mine_collapse_damage_modifier', -10, 'percent', { condition: { hazardType: collapseHazards } })],
    }),
    miningSkill({
      id: 'mining_dust_lungs',
      name: 'Пыльные лёгкие',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 5,
      skillPointCost: 1,
      description: 'Горняк учится дышать через ткань, не паниковать в пыли и быстрее выходить из газовых карманов.',
      effects: [
        effect('mine_dust_resistance', 30, 'percent', { condition: { hazardType: ['dust'] } }),
        effect('mine_gas_resistance', 20, 'percent', { condition: { hazardType: ['gas', 'poison_gas'] } }),
      ],
    }),
    miningSkill({
      id: 'mining_passage_sense',
      name: 'Чутьё прохода',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 6,
      skillPointCost: 1,
      description: 'Горняк лучше чувствует сквозняки и слабые места породы. Повышает шанс найти проход глубже.',
      effects: [effect('mine_passage_chance_modifier', 10, 'percent')],
    }),
    miningSkill({
      id: 'mining_do_not_look_back',
      name: 'Не смотреть назад',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 6,
      skillPointCost: 1,
      description: 'После спуска глубже горняк действует решительнее. При переходе на новую глубину получает дополнительный удар.',
      effects: [effect('mine_extra_hits_on_descend', 1, 'flat')],
    }),
    miningSkill({
      id: 'mining_deep_breath',
      name: 'Глубокий вдох',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 7,
      skillPointCost: 1,
      description: 'На опасной глубине горняк собирает остатки сил и получает дополнительную stamina.',
      effects: [effect('mine_extra_stamina', 10, 'flat', { condition: { minDepth: 2 } })],
    }),

    miningSkill({
      id: 'mining_anchor_rope',
      name: 'Анкерная верёвка',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 8,
      skillPointCost: 2,
      requiredSkillIds: ['mining_heavy_helmet', 'mining_dust_lungs', 'mining_passage_sense', 'mining_do_not_look_back', 'mining_deep_breath'],
      description: 'Один раз за спуск анкерная верёвка может спасти горняка от провала, если опасность не убила его мгновенно.',
      effects: [effect('mine_once_per_run_escape', 1, 'boolean', { maxUsesPerRun: 1 })],
    }),
    miningSkill({
      id: 'mining_vein_under_feet',
      name: 'Жила под ногами',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 8,
      skillPointCost: 2,
      requiredSkillIds: ['mining_heavy_helmet', 'mining_dust_lungs', 'mining_passage_sense', 'mining_do_not_look_back', 'mining_deep_breath'],
      description: 'Чем глубже спуск, тем лучше горняк чувствует тяжёлую руду под ногами. Повышает шанс редкой руды на глубине 2+.',
      effects: [effect('mine_rare_ore_chance_modifier', 10, 'percent', { condition: { minDepth: 2 } })],
    }),
    miningSkill({
      id: 'mining_stone_endurance',
      name: 'Каменная выдержка',
      branchId: 'mining_branch_deep_delver',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredLevel: 9,
      skillPointCost: 2,
      requiredSkillIds: ['mining_heavy_helmet', 'mining_dust_lungs', 'mining_passage_sense', 'mining_do_not_look_back', 'mining_deep_breath'],
      description: 'Горняк держится на ногах даже тогда, когда камень должен был сломить его. Один раз за спуск смертельный урон оставляет 1 HP.',
      effects: [effect('mine_once_per_run_survive_1hp', 1, 'boolean', { maxUsesPerRun: 1 })],
    }),

    miningSkill({
      id: 'mining_dwarf_sight',
      name: 'Гномий взгляд',
      branchId: 'mining_branch_dwarf_tunneler',
      requiredBranchIds: ['mining_branch_dwarf_tunneler'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Знание старых гномьих штреков помогает замечать скрытые ходы и слабые места породы.',
      effects: [effect('mine_start_with_passage_hint', 1, 'boolean', { chance: 0.35 })],
    }),
    miningSkill({
      id: 'mining_crack_reading',
      name: 'Чтение трещин',
      branchId: 'mining_branch_dwarf_tunneler',
      requiredBranchIds: ['mining_branch_dwarf_tunneler'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Горняк умеет читать трещины и иногда заранее понимает, где скрыта опасность.',
      effects: [effect('mine_block_hint_chance', 0.15, 'flat', { condition: { blockType: ['hazard'] } })],
    }),
    miningSkill({
      id: 'mining_master_brace',
      name: 'Распорка мастера',
      branchId: 'mining_branch_dwarf_tunneler',
      requiredBranchIds: ['mining_branch_dwarf_tunneler'],
      requiredLevel: 11,
      skillPointCost: 2,
      description: 'Мастерские распорки гасят силу обвала лучше обычных подпорок.',
      effects: [effect('mine_collapse_damage_modifier', -20, 'percent', { condition: { hazardType: collapseHazards } })],
    }),
    miningSkill({
      id: 'mining_underground_map',
      name: 'Карта подземья',
      branchId: 'mining_branch_dwarf_tunneler',
      requiredBranchIds: ['mining_branch_dwarf_tunneler'],
      requiredLevel: 12,
      skillPointCost: 3,
      requiredSkillIds: ['mining_dwarf_sight', 'mining_crack_reading', 'mining_master_brace'],
      description: 'Горняк ведёт карту старых ходов и в начале глубины получает больше подсказок о проходах и опасностях.',
      effects: [
        effect('mine_start_with_passage_hint', 1, 'boolean'),
        effect('mine_block_hint_chance', 0.1, 'flat'),
      ],
    }),

    miningSkill({
      id: 'mining_heart_of_depth',
      name: 'Сердце глубины',
      branchId: 'mining_branch_dwarf_tunneler',
      requiredBranchIds: ['mining_branch_dwarf_tunneler'],
      requiredLevel: 12,
      skillPointCost: 3,
      requiredSkillIds: ['mining_dwarf_sight', 'mining_crack_reading', 'mining_master_brace', 'mining_underground_map'],
      description: 'На большой глубине горняк ищет не безопасную породу, а сердце жилы. Повышает шанс редкой руды на глубине 3+.',
      effects: [effect('mine_rare_ore_chance_modifier', 15, 'percent', { condition: { minDepth: 3 } })],
    }),
    miningSkill({
      id: 'mining_lava_caution',
      name: 'Лавовая осторожность',
      branchId: 'mining_branch_abyss_conqueror',
      requiredBranchIds: ['mining_branch_abyss_conqueror'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Горняк учится распознавать жар породы и уходить от лавовых трещин.',
      effects: [
        effect('mine_lava_resistance', 25, 'percent', { condition: { hazardType: ['lava_crack'] } }),
        effect('mine_fire_resistance', 20, 'percent', { condition: { hazardType: ['fire_burst'] } }),
      ],
    }),
    miningSkill({
      id: 'mining_last_strike',
      name: 'Последний удар',
      branchId: 'mining_branch_abyss_conqueror',
      requiredBranchIds: ['mining_branch_abyss_conqueror'],
      requiredLevel: 11,
      skillPointCost: 2,
      description: 'Когда сил почти не осталось, горняк бьёт особенно точно. Последний удар имеет повышенный шанс редкой находки.',
      effects: [effect('mine_rare_ore_chance_modifier', 10, 'percent', { condition: { remainingHitsMax: 1 } })],
    }),
    miningSkill({
      id: 'mining_one_step_from_death',
      name: 'Один шаг от смерти',
      branchId: 'mining_branch_abyss_conqueror',
      requiredBranchIds: ['mining_branch_abyss_conqueror'],
      requiredLevel: 12,
      skillPointCost: 3,
      requiredSkillIds: ['mining_lava_caution', 'mining_last_strike'],
      description: 'Покоритель бездн умеет выбраться из гибели, но платит добычей. Один раз за спуск смертельная опасность не убивает и часть добычи сохраняется.',
      effects: [
        effect('mine_once_per_run_survive_1hp', 1, 'boolean', { maxUsesPerRun: 1 }),
        effect('mine_death_loot_save_modifier', 25, 'percent', { maxUsesPerRun: 1 }),
      ],
    }),

    miningSkill({
      id: 'mining_glimmer_in_stone',
      name: 'Блеск в камне',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 5,
      skillPointCost: 1,
      description: 'Старатель замечает золотой отблеск там, где другой увидит только грязный камень.',
      effects: [effect('mine_gold_chance_modifier', 10, 'percent')],
    }),
    miningSkill({
      id: 'mining_sharp_eye',
      name: 'Острый глаз',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 5,
      skillPointCost: 1,
      description: 'Старатель лучше замечает самоцветы и блеск редких камней.',
      effects: [effect('mine_gem_chance_modifier', 10, 'percent')],
    }),
    miningSkill({
      id: 'mining_clean_vein',
      name: 'Чистая жила',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 6,
      skillPointCost: 1,
      description: 'Старатель берёт материал аккуратнее и чаще получает добычу лучшего качества.',
      effects: [effect('mine_loot_quality_modifier', 10, 'percent')],
    }),
    miningSkill({
      id: 'mining_rich_bag',
      name: 'Богатый мешок',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 6,
      skillPointCost: 1,
      description: 'Старатель умеет складывать добычу так, чтобы унести больше обычных материалов.',
      effects: [effect('mine_loot_quantity_modifier', 10, 'percent')],
    }),
    miningSkill({
      id: 'mining_soft_strike',
      name: 'Мягкий удар',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 7,
      skillPointCost: 1,
      description: 'Аккуратный удар снижает шанс повредить хрупкие кристаллы и самоцветы.',
      effects: [effect('mine_fragile_loot_break_chance_modifier', -20, 'percent', { condition: { blockType: ['gem', 'crystal'] } })],
    }),

    miningSkill({
      id: 'mining_gold_scent',
      name: 'Золотой нюх',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 8,
      skillPointCost: 2,
      requiredSkillIds: ['mining_glimmer_in_stone', 'mining_sharp_eye', 'mining_clean_vein', 'mining_rich_bag', 'mining_soft_strike'],
      description: 'На глубине старатель буквально чувствует золото. Повышает шанс золота на глубине 2+.',
      effects: [effect('mine_gold_chance_modifier', 15, 'percent', { condition: { minDepth: 2 } })],
    }),
    miningSkill({
      id: 'mining_stonecutter',
      name: 'Камнерез',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 8,
      skillPointCost: 2,
      requiredSkillIds: ['mining_glimmer_in_stone', 'mining_sharp_eye', 'mining_clean_vein', 'mining_rich_bag', 'mining_soft_strike'],
      description: 'Камнерез умеет отделить камень от породы так, чтобы он чаще был пригоден для ремесла.',
      effects: [
        effect('mine_gem_chance_modifier', 15, 'percent'),
        effect('mine_fragile_loot_break_chance_modifier', -10, 'percent', { condition: { blockType: ['gem', 'crystal'] } }),
      ],
    }),
    miningSkill({
      id: 'mining_trader_eye',
      name: 'Торговый глаз',
      branchId: 'mining_branch_prospector',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredLevel: 9,
      skillPointCost: 2,
      requiredSkillIds: ['mining_glimmer_in_stone', 'mining_sharp_eye', 'mining_clean_vein', 'mining_rich_bag', 'mining_soft_strike'],
      description: 'Старатель лучше оценивает добычу и получает больше выгоды от продажи материалов.',
      effects: [effect('mine_loot_sell_value_modifier', 10, 'percent')],
    }),

    miningSkill({
      id: 'mining_blue_vein',
      name: 'Синяя прожилка',
      branchId: 'mining_branch_gem_seeker',
      requiredBranchIds: ['mining_branch_gem_seeker'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Искатель самоцветов замечает светящиеся прожилки кристаллов в породе.',
      effects: [effect('mine_crystal_chance_modifier', 15, 'percent')],
    }),
    miningSkill({
      id: 'mining_unbroken_crystal',
      name: 'Неповреждённый кристалл',
      branchId: 'mining_branch_gem_seeker',
      requiredBranchIds: ['mining_branch_gem_seeker'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Аккуратная добыча снижает шанс испортить кристалл или самоцвет.',
      effects: [effect('mine_fragile_loot_break_chance_modifier', -30, 'percent', { condition: { blockType: ['crystal', 'gem'] } })],
    }),
    miningSkill({
      id: 'mining_pure_crystal_heart',
      name: 'Чистое сердце кристалла',
      branchId: 'mining_branch_gem_seeker',
      requiredBranchIds: ['mining_branch_gem_seeker'],
      requiredLevel: 12,
      skillPointCost: 3,
      requiredSkillIds: ['mining_blue_vein', 'mining_unbroken_crystal'],
      description: 'Искатель самоцветов умеет раскрывать настоящую ценность кристаллов. Повышает шанс кристаллов и их скрытых свойств.',
      effects: [
        effect('mine_crystal_chance_modifier', 20, 'percent'),
        effect('mine_loot_special_property_chance', 10, 'percent', { condition: { blockType: ['crystal', 'gem'] } }),
      ],
    }),

    miningSkill({
      id: 'mining_stone_memory',
      name: 'Память камня',
      branchId: 'mining_branch_rune_seeker',
      requiredBranchIds: ['mining_branch_rune_seeker'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Редкие камни иногда сохраняют след региона, где были найдены, и получают дополнительное скрытое свойство.',
      effects: [effect('mine_loot_special_property_chance', 5, 'percent', { condition: { blockType: ['crystal', 'gem'] } })],
    }),

    miningSkill({
      id: 'mining_ancient_traces',
      name: 'Следы древних',
      branchId: 'mining_branch_rune_seeker',
      requiredBranchIds: ['mining_branch_rune_seeker'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Искатель рун замечает древние насечки и следы формул на камне. Повышает шанс рунных осколков на глубине 2+.',
      effects: [effect('mine_rune_fragment_chance_modifier', 8, 'percent', { condition: { minDepth: 2 } })],
    }),
    miningSkill({
      id: 'mining_do_not_touch_the_sign',
      name: 'Не трогай знак',
      branchId: 'mining_branch_rune_seeker',
      requiredBranchIds: ['mining_branch_rune_seeker'],
      requiredLevel: 10,
      skillPointCost: 2,
      description: 'Рунные знаки опасны. Горняк учится не нарушать древние черты и получает сопротивление проклятиям и духам.',
      effects: [
        effect('mine_curse_resistance', 30, 'percent', { condition: { hazardType: ['curse'] } }),
        effect('mine_spirit_resistance', 15, 'percent', { condition: { hazardType: ['spirit_attack'] } }),
      ],
    }),
    miningSkill({
      id: 'mining_stone_whisper',
      name: 'Шёпот камня',
      branchId: 'mining_branch_rune_seeker',
      requiredBranchIds: ['mining_branch_rune_seeker'],
      requiredLevel: 11,
      skillPointCost: 2,
      requiredSkillIds: ['mining_stone_memory', 'mining_ancient_traces'],
      description: 'Камень словно предупреждает горняка о древних плитах, духах и опасных знаках.',
      effects: [effect('mine_block_hint_chance', 0.2, 'flat', { condition: { blockType: ['event', 'hazard'] } })],
    }),
    miningSkill({
      id: 'mining_language_of_cracks',
      name: 'Язык трещин',
      branchId: 'mining_branch_rune_seeker',
      requiredBranchIds: ['mining_branch_rune_seeker'],
      requiredLevel: 12,
      skillPointCost: 3,
      requiredSkillIds: ['mining_stone_whisper', 'mining_do_not_touch_the_sign'],
      description: 'Искатель рун понимает язык древних трещин. Повышает шанс рунных следов, событий и защищает от проклятий.',
      effects: [
        effect('mine_rune_fragment_chance_modifier', 12, 'percent'),
        effect('mine_event_chance_modifier', 10, 'percent'),
        effect('mine_curse_resistance', 20, 'percent', { condition: { hazardType: ['curse'] } }),
      ],
    }),
  ];
}

function createDefaultBlacksmithSkills(): ProfessionSkill[] {
  const now = createTimestamp();
  const skill = (params: {
    id: string;
    name: string;
    description: string;
    requiredLevel: number;
    skillPointCost: number;
    branchId?: string;
    requiredSkillIds?: string[];
    requiredBranchIds?: string[];
    positionX: number;
    positionY: number;
  }): ProfessionSkill => ({
    id: params.id,
    professionId: 'blacksmithing',
    name: params.name,
    description: params.description,
    requiredLevel: params.requiredLevel,
    requiredSkillIds: params.requiredSkillIds ?? [],
    requiredBranchIds: params.requiredBranchIds ?? [],
    branchId: params.branchId,
    skillPointCost: params.skillPointCost,
    effects: [],
    positionX: params.positionX,
    positionY: params.positionY,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  return [
    skill({ id: 'blacksmith_basic_forging', name: 'Основы ковки', description: 'Кузнец учится работать с горном, молотом и наковальней. Открывает базовые кузнечные действия и простые рецепты ковки.', requiredLevel: 1, skillPointCost: 1, positionX: 120, positionY: 40 }),
    skill({ id: 'blacksmith_metal_knowledge', name: 'Знание металла', description: 'Даёт понимание разницы между рудой, слитком, пластиной, заготовкой и готовым изделием. Это фундамент всей кузнечной профессии.', requiredLevel: 1, skillPointCost: 1, positionX: 330, positionY: 40 }),
    skill({ id: 'blacksmith_even_blank', name: 'Ровная заготовка', description: 'Позволяет делать стабильные заготовки для оружия, брони и щитов. Снижает шанс брака на ранних компонентах.', requiredLevel: 2, skillPointCost: 1, positionX: 540, positionY: 40 }),
    skill({ id: 'blacksmith_simple_tempering', name: 'Простая закалка', description: 'Открывает первые временные кузнечные баффы для оружия и брони через нагрев, охлаждение и простую обработку металла.', requiredLevel: 2, skillPointCost: 1, positionX: 750, positionY: 40 }),
    skill({ id: 'blacksmith_rough_socket', name: 'Грубое гнездо', description: 'Даёт возможность добавить первый обычный слот в простой предмет, если сам предмет поддерживает сокеты.', requiredLevel: 3, skillPointCost: 1, positionX: 960, positionY: 40 }),

    skill({ id: 'blacksmith_weapon_blades', name: 'Ковка клинков', description: 'Открывает простые мечи, топоры, копья и базовые оружейные заготовки для ветки Оружейника.', requiredLevel: 4, skillPointCost: 1, branchId: 'blacksmith_branch_weaponsmith', requiredBranchIds: ['blacksmith_branch_weaponsmith'], positionX: 90, positionY: 260 }),
    skill({ id: 'blacksmith_weapon_balance', name: 'Баланс оружия', description: 'Позволяет делать более удобное и стабильное оружие, улучшая баланс, точность и выносливость при обращении.', requiredLevel: 4, skillPointCost: 1, branchId: 'blacksmith_branch_weaponsmith', requiredBranchIds: ['blacksmith_branch_weaponsmith'], positionX: 260, positionY: 260 }),
    skill({ id: 'blacksmith_sharp_edge', name: 'Острая кромка', description: 'Усиливает режущие баффы и открывает более сильную заточку оружия на ограниченное время.', requiredLevel: 5, skillPointCost: 1, branchId: 'blacksmith_branch_weaponsmith', requiredBranchIds: ['blacksmith_branch_weaponsmith'], positionX: 430, positionY: 260 }),
    skill({ id: 'blacksmith_combat_grip', name: 'Боевой хват', description: 'Даёт доступ к рукоятям, гардам и подгонке оружия под конкретный стиль боя.', requiredLevel: 5, skillPointCost: 1, branchId: 'blacksmith_branch_weaponsmith', requiredBranchIds: ['blacksmith_branch_weaponsmith'], positionX: 600, positionY: 260 }),
    skill({ id: 'blacksmith_weapon_socket', name: 'Гнездо оружия', description: 'Позволяет уверенно добавлять слот в оружие и подготавливать клинок под будущие вставки.', requiredLevel: 6, skillPointCost: 1, branchId: 'blacksmith_branch_weaponsmith', requiredBranchIds: ['blacksmith_branch_weaponsmith'], positionX: 770, positionY: 260 }),

    skill({ id: 'blacksmith_armor_forging', name: 'Ковка доспехов', description: 'Открывает базовую броню, щиты и защитные заготовки для ветки Бронника.', requiredLevel: 4, skillPointCost: 1, branchId: 'blacksmith_branch_armorer', requiredBranchIds: ['blacksmith_branch_armorer'], positionX: 90, positionY: 560 }),
    skill({ id: 'blacksmith_reinforced_plates', name: 'Усиленные пластины', description: 'Даёт доступ к более крепким пластинам и временным баффам защиты через усиленную сборку доспеха.', requiredLevel: 4, skillPointCost: 1, branchId: 'blacksmith_branch_armorer', requiredBranchIds: ['blacksmith_branch_armorer'], positionX: 260, positionY: 560 }),
    skill({ id: 'blacksmith_shield_brace', name: 'Щитовой упор', description: 'Улучшает щиты, ремни и крепления, позволяя увереннее держать удар и повышать шанс блока.', requiredLevel: 5, skillPointCost: 1, branchId: 'blacksmith_branch_armorer', requiredBranchIds: ['blacksmith_branch_armorer'], positionX: 430, positionY: 560 }),
    skill({ id: 'blacksmith_armor_fitting', name: 'Подгонка брони', description: 'Позволяет лучше подгонять броню под носителя и вытаскивать из неё больше stamina и удобства.', requiredLevel: 5, skillPointCost: 1, branchId: 'blacksmith_branch_armorer', requiredBranchIds: ['blacksmith_branch_armorer'], positionX: 600, positionY: 560 }),
    skill({ id: 'blacksmith_armor_socket', name: 'Гнездо защиты', description: 'Открывает уверенное добавление сокета в броню и щиты без попытки менять тип самого слота.', requiredLevel: 6, skillPointCost: 1, branchId: 'blacksmith_branch_armorer', requiredBranchIds: ['blacksmith_branch_armorer'], positionX: 770, positionY: 560 }),

    skill({ id: 'blacksmith_fine_work', name: 'Тонкая работа', description: 'Открывает точную ковку, мелкие детали, чистые посадки и первые аккуратные оправы.', requiredLevel: 4, skillPointCost: 1, branchId: 'blacksmith_branch_precision_smith', requiredBranchIds: ['blacksmith_branch_precision_smith'], positionX: 90, positionY: 860 }),
    skill({ id: 'blacksmith_metal_setting', name: 'Оправа металла', description: 'Даёт доступ к базовым оправам и подготовке металла под будущие вставки и магические камни.', requiredLevel: 4, skillPointCost: 1, branchId: 'blacksmith_branch_precision_smith', requiredBranchIds: ['blacksmith_branch_precision_smith'], positionX: 260, positionY: 860 }),
    skill({ id: 'blacksmith_insert_mounting', name: 'Посадка вставки', description: 'Позволяет крепить заготовленные оправы и собирать элементы для будущих ювелирных и рунных веток.', requiredLevel: 5, skillPointCost: 1, branchId: 'blacksmith_branch_precision_smith', requiredBranchIds: ['blacksmith_branch_precision_smith'], positionX: 430, positionY: 860 }),
    skill({ id: 'blacksmith_minor_rune_surface', name: 'Малая рунная поверхность', description: 'Подготавливает металл под первые рунные знаки, но не создаёт саму руну и не делает магический камень.', requiredLevel: 5, skillPointCost: 1, branchId: 'blacksmith_branch_precision_smith', requiredBranchIds: ['blacksmith_branch_precision_smith'], positionX: 600, positionY: 860 }),
    skill({ id: 'blacksmith_clean_setting', name: 'Чистая посадка', description: 'Улучшает стабильность оправы и уменьшает риск брака при точной работе по металлу.', requiredLevel: 6, skillPointCost: 1, branchId: 'blacksmith_branch_precision_smith', requiredBranchIds: ['blacksmith_branch_precision_smith'], positionX: 770, positionY: 860 }),

    skill({ id: 'blacksmith_razor_steel', name: 'Бритвенная сталь', description: 'Вторая ступень оружейной ветки: сильная заточка, более точный профиль и заметно более опасное оружие.', requiredLevel: 7, skillPointCost: 2, branchId: 'blacksmith_branch_weapon_master', requiredBranchIds: ['blacksmith_branch_weapon_master'], requiredSkillIds: ['blacksmith_weapon_blades', 'blacksmith_weapon_balance', 'blacksmith_sharp_edge'], positionX: 120, positionY: 1180 }),
    skill({ id: 'blacksmith_heavy_impact', name: 'Тяжёлый удар', description: 'Даёт доступ к оружию с мощным пробитием, тяжёлым ударом и более грубой, но страшной формой.', requiredLevel: 8, skillPointCost: 2, branchId: 'blacksmith_branch_weapon_master', requiredBranchIds: ['blacksmith_branch_weapon_master'], requiredSkillIds: ['blacksmith_weapon_blades', 'blacksmith_weapon_balance', 'blacksmith_sharp_edge'], positionX: 340, positionY: 1180 }),
    skill({ id: 'blacksmith_personal_weapon_fit', name: 'Личная подгонка оружия', description: 'Позволяет сильнее подгонять оружие под конкретного носителя, повышая удобство и расход stamina в его пользу.', requiredLevel: 8, skillPointCost: 2, branchId: 'blacksmith_branch_weapon_master', requiredBranchIds: ['blacksmith_branch_weapon_master'], requiredSkillIds: ['blacksmith_weapon_blades', 'blacksmith_weapon_balance', 'blacksmith_sharp_edge'], positionX: 560, positionY: 1180 }),
    skill({ id: 'blacksmith_clean_weapon_profile', name: 'Чистый профиль оружия', description: 'Даёт кузнецу более аккуратную форму клинка и снижает риск брака при серьёзной оружейной работе.', requiredLevel: 9, skillPointCost: 2, branchId: 'blacksmith_branch_weapon_master', requiredBranchIds: ['blacksmith_branch_weapon_master'], requiredSkillIds: ['blacksmith_weapon_blades', 'blacksmith_weapon_balance', 'blacksmith_sharp_edge'], positionX: 780, positionY: 1180 }),
    skill({ id: 'blacksmith_second_weapon_socket', name: 'Второе оружейное гнездо', description: 'Открывает добавление второго сокета в оружие, если предмет допускает ещё один слот.', requiredLevel: 10, skillPointCost: 2, branchId: 'blacksmith_branch_weapon_master', requiredBranchIds: ['blacksmith_branch_weapon_master'], requiredSkillIds: ['blacksmith_weapon_blades', 'blacksmith_weapon_balance', 'blacksmith_sharp_edge'], positionX: 1000, positionY: 1180 }),

    skill({ id: 'blacksmith_firm_armor_fit', name: 'Жёсткая подгонка брони', description: 'Вторая ступень защитной ветки: крепче посадка, выше стойкость и лучшее распределение веса доспеха.', requiredLevel: 7, skillPointCost: 2, branchId: 'blacksmith_branch_armor_master', requiredBranchIds: ['blacksmith_branch_armor_master'], requiredSkillIds: ['blacksmith_armor_forging', 'blacksmith_reinforced_plates', 'blacksmith_shield_brace'], positionX: 120, positionY: 1480 }),
    skill({ id: 'blacksmith_dampening_layer', name: 'Гасительный слой', description: 'Позволяет лучше принимать тяжёлые удары и смягчать часть оглушающего давления по броне.', requiredLevel: 8, skillPointCost: 2, branchId: 'blacksmith_branch_armor_master', requiredBranchIds: ['blacksmith_branch_armor_master'], requiredSkillIds: ['blacksmith_armor_forging', 'blacksmith_reinforced_plates', 'blacksmith_shield_brace'], positionX: 340, positionY: 1480 }),
    skill({ id: 'blacksmith_iron_stance', name: 'Железная стойка', description: 'Укрепляет стойку носителя, повышает уверенность блока и делает защитную сборку более надёжной.', requiredLevel: 8, skillPointCost: 2, branchId: 'blacksmith_branch_armor_master', requiredBranchIds: ['blacksmith_branch_armor_master'], requiredSkillIds: ['blacksmith_armor_forging', 'blacksmith_reinforced_plates', 'blacksmith_shield_brace'], positionX: 560, positionY: 1480 }),
    skill({ id: 'blacksmith_anti_stun_assembly', name: 'Противоударная сборка', description: 'Уменьшает риск тяжёлой раскачки и краткого оглушения при хорошем защитном комплекте.', requiredLevel: 9, skillPointCost: 2, branchId: 'blacksmith_branch_armor_master', requiredBranchIds: ['blacksmith_branch_armor_master'], requiredSkillIds: ['blacksmith_armor_forging', 'blacksmith_reinforced_plates', 'blacksmith_shield_brace'], positionX: 780, positionY: 1480 }),
    skill({ id: 'blacksmith_second_defense_socket', name: 'Второе защитное гнездо', description: 'Открывает добавление второго сокета в броню или щит, если предмет допускает расширение.', requiredLevel: 10, skillPointCost: 2, branchId: 'blacksmith_branch_armor_master', requiredBranchIds: ['blacksmith_branch_armor_master'], requiredSkillIds: ['blacksmith_armor_forging', 'blacksmith_reinforced_plates', 'blacksmith_shield_brace'], positionX: 1000, positionY: 1480 }),

    skill({ id: 'blacksmith_gem_settings', name: 'Ювелирные оправы', description: 'Вторая ступень точной ветки: открывает прочные оправы под камни и аккуратную работу с малыми вставками.', requiredLevel: 7, skillPointCost: 2, branchId: 'blacksmith_branch_setting_master', requiredBranchIds: ['blacksmith_branch_setting_master'], requiredSkillIds: ['blacksmith_fine_work', 'blacksmith_metal_setting', 'blacksmith_insert_mounting'], positionX: 120, positionY: 1780 }),
    skill({ id: 'blacksmith_rune_marking', name: 'Рунная разметка', description: 'Даёт чистую разметку под будущую резьбу и подготавливает металл для работы Рунореза.', requiredLevel: 8, skillPointCost: 2, branchId: 'blacksmith_branch_setting_master', requiredBranchIds: ['blacksmith_branch_setting_master'], requiredSkillIds: ['blacksmith_fine_work', 'blacksmith_metal_setting', 'blacksmith_insert_mounting'], positionX: 340, positionY: 1780 }),
    skill({ id: 'blacksmith_stable_mount', name: 'Стабильная посадка', description: 'Улучшает надёжность крепления вставок и уменьшает шанс ошибки при тонкой работе.', requiredLevel: 8, skillPointCost: 2, branchId: 'blacksmith_branch_setting_master', requiredBranchIds: ['blacksmith_branch_setting_master'], requiredSkillIds: ['blacksmith_fine_work', 'blacksmith_metal_setting', 'blacksmith_insert_mounting'], positionX: 560, positionY: 1780 }),
    skill({ id: 'blacksmith_thin_metalwork', name: 'Тонкая металлика', description: 'Позволяет делать более лёгкие и чистые оправы без потери формы для поздних вставок и украшений.', requiredLevel: 9, skillPointCost: 2, branchId: 'blacksmith_branch_setting_master', requiredBranchIds: ['blacksmith_branch_setting_master'], requiredSkillIds: ['blacksmith_fine_work', 'blacksmith_metal_setting', 'blacksmith_insert_mounting'], positionX: 780, positionY: 1780 }),
    skill({ id: 'blacksmith_base_seal', name: 'Базовая герметизация', description: 'Укрепляет тонкие крепления и завершает мастерскую подготовку предмета под магические ветки.', requiredLevel: 10, skillPointCost: 2, branchId: 'blacksmith_branch_setting_master', requiredBranchIds: ['blacksmith_branch_setting_master'], requiredSkillIds: ['blacksmith_fine_work', 'blacksmith_metal_setting', 'blacksmith_insert_mounting'], positionX: 1000, positionY: 1780 }),

    skill({ id: 'jewelcrafter_crystal_cutting', name: 'Огранка кристалла', description: 'Открывает финальный путь Ювелира: огранку камней, чистые поверхности и стабильные вставки.', requiredLevel: 11, skillPointCost: 3, branchId: 'blacksmith_branch_jewelcrafter', requiredBranchIds: ['blacksmith_branch_jewelcrafter'], positionX: 120, positionY: 2140 }),
    skill({ id: 'jewelcrafter_rings_of_power', name: 'Кольца силы', description: 'Позволяет создавать более сильные кольца с устойчивыми пассивными бонусами.', requiredLevel: 11, skillPointCost: 3, branchId: 'blacksmith_branch_jewelcrafter', requiredBranchIds: ['blacksmith_branch_jewelcrafter'], positionX: 340, positionY: 2140 }),
    skill({ id: 'jewelcrafter_amulet_setting', name: 'Посадка амулета', description: 'Даёт доступ к амулетам, сложным оправам и более ценным вариантам ювелирной сборки.', requiredLevel: 12, skillPointCost: 3, branchId: 'blacksmith_branch_jewelcrafter', requiredBranchIds: ['blacksmith_branch_jewelcrafter'], positionX: 560, positionY: 2140 }),
    skill({ id: 'jewelcrafter_pure_stone', name: 'Чистый камень', description: 'Позволяет лучше работать с редкими камнями и сохранять в них больше полезной силы.', requiredLevel: 12, skillPointCost: 3, branchId: 'blacksmith_branch_jewelcrafter', requiredBranchIds: ['blacksmith_branch_jewelcrafter'], positionX: 780, positionY: 2140 }),
    skill({ id: 'jewelcrafter_jewel_seal', name: 'Печать ювелира', description: 'Финализирует путь Ювелира и закрепляет силу украшений, камней и пассивных вставок.', requiredLevel: 13, skillPointCost: 3, branchId: 'blacksmith_branch_jewelcrafter', requiredBranchIds: ['blacksmith_branch_jewelcrafter'], positionX: 1000, positionY: 2140 }),

    skill({ id: 'runecrafter_rune_reading', name: 'Чтение рун', description: 'Открывает финальный путь Рунореза: понимание знаков, чтение символов и работу с рунными следами.', requiredLevel: 11, skillPointCost: 3, branchId: 'blacksmith_branch_runecrafter', requiredBranchIds: ['blacksmith_branch_runecrafter'], positionX: 120, positionY: 2440 }),
    skill({ id: 'runecrafter_rune_identification', name: 'Опознание руны', description: 'Позволяет безопаснее разбирать найденные рунные камни и лучше понимать их класс.', requiredLevel: 11, skillPointCost: 3, branchId: 'blacksmith_branch_runecrafter', requiredBranchIds: ['blacksmith_branch_runecrafter'], positionX: 340, positionY: 2440 }),
    skill({ id: 'runecrafter_rune_carving', name: 'Резьба руны', description: 'Даёт доступ к созданию простых рунных знаков и базовых рунных форм.', requiredLevel: 12, skillPointCost: 3, branchId: 'blacksmith_branch_runecrafter', requiredBranchIds: ['blacksmith_branch_runecrafter'], positionX: 560, positionY: 2440 }),
    skill({ id: 'runecrafter_binding_line', name: 'Связующая линия', description: 'Улучшает стабильность рунной формы и помогает безопаснее закреплять знак на носителе.', requiredLevel: 12, skillPointCost: 3, branchId: 'blacksmith_branch_runecrafter', requiredBranchIds: ['blacksmith_branch_runecrafter'], positionX: 780, positionY: 2440 }),
    skill({ id: 'runecrafter_minor_rune_complex', name: 'Малый рунный комплекс', description: 'Финализирует путь Рунореза и открывает составные рунные схемы малой силы.', requiredLevel: 13, skillPointCost: 3, branchId: 'blacksmith_branch_runecrafter', requiredBranchIds: ['blacksmith_branch_runecrafter'], positionX: 1000, positionY: 2440 }),

    skill({ id: 'forge_master_pure_steel', name: 'Чистая сталь', description: 'Открывает финальный путь Мастера Горна: лучшая сталь, меньше брака и более сильная обычная ковка.', requiredLevel: 11, skillPointCost: 3, branchId: 'blacksmith_branch_forge_master', requiredBranchIds: ['blacksmith_branch_forge_master'], positionX: 120, positionY: 2740 }),
    skill({ id: 'forge_master_perfect_tempering', name: 'Совершенная закалка', description: 'Усиливает временные кузнечные баффы и делает оружейные и защитные улучшения заметно сильнее.', requiredLevel: 11, skillPointCost: 3, branchId: 'blacksmith_branch_forge_master', requiredBranchIds: ['blacksmith_branch_forge_master'], positionX: 340, positionY: 2740 }),
    skill({ id: 'forge_master_flawless_shape', name: 'Безупречная форма', description: 'Повышает качество постоянных улучшений и уменьшает риск неудачи при серьёзной ковке.', requiredLevel: 12, skillPointCost: 3, branchId: 'blacksmith_branch_forge_master', requiredBranchIds: ['blacksmith_branch_forge_master'], positionX: 560, positionY: 2740 }),
    skill({ id: 'forge_master_material_saving', name: 'Экономия мастера', description: 'Снижает расход материалов и иногда позволяет сохранить часть редких компонентов при успешной работе.', requiredLevel: 12, skillPointCost: 3, branchId: 'blacksmith_branch_forge_master', requiredBranchIds: ['blacksmith_branch_forge_master'], positionX: 780, positionY: 2740 }),
    skill({ id: 'forge_master_legendary_forging', name: 'Легендарная ковка', description: 'Финализирует путь Мастера Горна и открывает лучшие немагические предметы из редких металлов.', requiredLevel: 13, skillPointCost: 3, branchId: 'blacksmith_branch_forge_master', requiredBranchIds: ['blacksmith_branch_forge_master'], positionX: 1000, positionY: 2740 }),
  ];
}

function mergeWithMiningDefaults(skills: ProfessionSkill[]): ProfessionSkill[] {
  const defaults = [
    ...createDefaultProfessionSkills(),
    ...createDefaultBlacksmithSkills(),
  ];
  const defaultIds = new Set(defaults.map((entry) => entry.id));
  const existingById = new Map(skills.map((entry) => [entry.id, entry]));
  const preserved = skills.filter((entry) => !defaultIds.has(entry.id));
  const mergedDefaults = defaults.map((entry) => {
    const existing = existingById.get(entry.id);
    const defaultIcon = DEFAULT_MINING_SKILL_ICON_BY_NAME[entry.name];
    if (!existing) {
      return {
        ...entry,
        icon: entry.icon?.trim() ? entry.icon : defaultIcon,
      };
    }
    return {
      ...existing,
      ...entry,
      icon: existing.icon?.trim() ? existing.icon : (entry.icon?.trim() ? entry.icon : defaultIcon),
      positionX: existing.positionX ?? entry.positionX,
      positionY: existing.positionY ?? entry.positionY,
      createdAt: existing.createdAt ?? entry.createdAt,
      updatedAt: entry.updatedAt ?? existing.updatedAt,
    };
  });
  return [...preserved, ...mergedDefaults];
}

function readStorage(): ProfessionSkill[] {
  const defaults = [
    ...createDefaultProfessionSkills(),
    ...createDefaultBlacksmithSkills(),
  ];
  if (typeof window === 'undefined') {
    return defaults;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    writeStorage(defaults);
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw);
    const skills = Array.isArray(parsed)
      ? parsed.map(normalizeSkill).filter((entry): entry is ProfessionSkill => Boolean(entry))
      : [];
    const merged = mergeWithMiningDefaults(skills);
    writeStorage(merged);
    return merged;
  } catch {
    writeStorage(defaults);
    return defaults;
  }
}

function writeStorage(skills: ProfessionSkill[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(skills));
}

export function loadProfessionSkillsFromStorage(): ProfessionSkill[] {
  return clone(readStorage());
}

export function saveProfessionSkillsToStorage(skills: ProfessionSkill[]): ProfessionSkill[] {
  const normalized = mergeWithMiningDefaults(
    skills.map(normalizeSkill).filter((entry): entry is ProfessionSkill => Boolean(entry)),
  );
  writeStorage(normalized);
  return clone(normalized);
}

export function getProfessionSkillsByProfessionId(professionId: string): ProfessionSkill[] {
  return loadProfessionSkillsFromStorage().filter((entry) => entry.professionId === professionId);
}

export function getProfessionSkillById(skillId: string): ProfessionSkill | null {
  return loadProfessionSkillsFromStorage().find((entry) => entry.id === skillId) ?? null;
}

export function resetProfessionSkillsToDefaults(): ProfessionSkill[] {
  const defaults = [
    ...createDefaultProfessionSkills(),
    ...createDefaultBlacksmithSkills(),
  ];
  writeStorage(defaults);
  return clone(defaults);
}

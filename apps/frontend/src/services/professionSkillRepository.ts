import type {
  MiningSkillEffectType,
  ProfessionSkill,
  ProfessionSkillEffect,
  ProfessionSkillEffectCondition,
  ProfessionSkillEffectValueType,
} from '../types/profession';
import type { GameImageRef } from './content/models';
import { loadProfessionSkillsFromBackend, syncProfessionSkillsToBackend } from './professionSkillsService';

const STORAGE_KEY = 'theend.professionSkills.v2';

const CARPENTRY_SKILL_IDS = [
  'carpentry_skill_firm_swing',
  'carpentry_skill_tree_reading',
  'carpentry_skill_lumberjack_wedge',
  'carpentry_skill_silent_felling',
  'carpentry_skill_clean_cut',
  'carpentry_skill_master_hand',
  'carpentry_skill_even_sawing',
  'carpentry_skill_gentle_saw',
  'carpentry_skill_plank_marking',
  'carpentry_skill_dry_core',
  'carpentry_skill_sawmill_eye',
  'carpentry_skill_basic_handle',
  'carpentry_skill_apprentice_shaft',
  'carpentry_skill_dry_plank',
  'carpentry_skill_master_frame',
  'carpentry_skill_ladder_maker',
  'carpentry_skill_enchanting_base',
] as const;

function buildCarpentrySkillIconPath(skillId: string): string {
  return `/assets/upload/images/skills/${skillId}/${skillId}-icon-${skillId}-icon.png`;
}

function buildCarpentrySkillIconRef(skillId: string): GameImageRef {
  return { type: 'image', src: buildCarpentrySkillIconPath(skillId) };
}

const DEFAULT_CARPENTRY_SKILL_ICON_BY_ID: Record<string, string> = Object.fromEntries(
  CARPENTRY_SKILL_IDS.map((skillId) => [skillId, buildCarpentrySkillIconPath(skillId)]),
);

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
    exclusiveSkillGroupId: raw.exclusiveSkillGroupId === undefined
      ? undefined
      : String(raw.exclusiveSkillGroupId ?? '').trim() || undefined,
    skillPointCost,
    effects,
    icon: raw.icon === undefined ? undefined : String(raw.icon ?? '').trim() || undefined,
    iconImageRef: raw.iconImageRef && typeof raw.iconImageRef === 'object' ? raw.iconImageRef as GameImageRef : undefined,
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
    exclusiveSkillGroupId?: string;
    requiredSkillIds?: string[];
    requiredBranchIds?: string[];
    effects?: ProfessionSkillEffect[];
    positionX: number;
    positionY: number;
  }): ProfessionSkill => ({
    id: params.id,
    professionId: 'blacksmithing',
    name: params.name,
    description: params.description,
    requiredLevel: params.requiredLevel,
    exclusiveSkillGroupId: params.exclusiveSkillGroupId,
    requiredSkillIds: params.requiredSkillIds ?? [],
    requiredBranchIds: params.requiredBranchIds ?? [],
    branchId: params.branchId,
    skillPointCost: params.skillPointCost,
    effects: params.effects ?? [],
    positionX: params.positionX,
    positionY: params.positionY,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  const fx = (id: string, type: string, value?: number, valueType: ProfessionSkillEffectValueType = 'flat', params?: Record<string, unknown>): ProfessionSkillEffect => ({
    id,
    type,
    value,
    valueType,
    params,
  });

  return [
    skill({
      id: 'blacksmith_basic_forging',
      name: 'Основы ковки',
      description: 'Базовая работа с молотом, горном и раскалённой заготовкой.',
      requiredLevel: 1,
      skillPointCost: 1,
      branchId: 'blacksmith_start',
      requiredBranchIds: ['blacksmith_start'],
      effects: [
        fx('blacksmith_basic_forging_unlock', 'unlock_forge_action', undefined, 'boolean', { action: 'basic_forging' }),
        fx('blacksmith_basic_forging_success', 'craft_success_bonus', 3, 'percent', { appliesToRecipeTypes: ['smelting', 'blacksmith_craft'] }),
      ],
      positionX: 220,
      positionY: 1240,
    }),
    skill({
      id: 'blacksmith_metal_knowledge',
      name: 'Знание металла',
      description: 'Кузнец лучше понимает руду, слитки, заготовки и свойства металлов.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'blacksmith_start',
      requiredBranchIds: ['blacksmith_start'],
      effects: [
        fx('blacksmith_metal_knowledge_tier', 'unlock_material_tier', undefined, 'boolean', { tier: 'common_metals' }),
        fx('blacksmith_metal_knowledge_success', 'material_processing_success_bonus', 5, 'percent', { appliesToMaterialTags: ['metal', 'ore', 'ingot'] }),
      ],
      positionX: 430,
      positionY: 1240,
    }),
    skill({
      id: 'blacksmith_even_blank',
      name: 'Ровная заготовка',
      description: 'Кузнец умеет делать ровные заготовки клинков и бронных пластин.',
      requiredLevel: 3,
      skillPointCost: 1,
      branchId: 'blacksmith_start',
      requiredBranchIds: ['blacksmith_start'],
      effects: [
        fx('blacksmith_even_blank_unlock', 'unlock_forge_action', undefined, 'boolean', { action: 'create_basic_blank' }),
        fx('blacksmith_even_blank_failure', 'failure_chance_reduction', 5, 'percent', { appliesToRecipeTypes: ['material_processing', 'blacksmith_craft'] }),
      ],
      positionX: 640,
      positionY: 1240,
    }),
    skill({
      id: 'blacksmith_simple_tempering',
      name: 'Простая закалка',
      description: 'Базовая закалка металла водой и паром.',
      requiredLevel: 4,
      skillPointCost: 1,
      branchId: 'blacksmith_start',
      requiredBranchIds: ['blacksmith_start'],
      effects: [
        fx('blacksmith_simple_tempering_action', 'unlock_forge_action', undefined, 'boolean', { action: 'temporary_item_buff' }),
        fx('blacksmith_simple_tempering_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'simple_tempering', temporaryBuffDurationHours: 24 }),
      ],
      positionX: 850,
      positionY: 1240,
    }),
    skill({
      id: 'blacksmith_rough_socket',
      name: 'Грубое гнездо',
      description: 'Кузнец умеет сделать первое грубое место под вставку.',
      requiredLevel: 5,
      skillPointCost: 1,
      branchId: 'blacksmith_start',
      requiredBranchIds: ['blacksmith_start'],
      effects: [
        fx('blacksmith_rough_socket_action', 'unlock_forge_action', undefined, 'boolean', { action: 'add_socket' }),
        fx('blacksmith_rough_socket_cap', 'max_socket_unlock', 1, 'flat', { allowedItemGroups: ['weapon', 'armor', 'shield'] }),
      ],
      positionX: 1060,
      positionY: 1240,
    }),

    skill({ id: 'blacksmith_weapon_blades', name: 'Ковка клинков', description: 'Оружейная ковка базового оружия.', requiredLevel: 6, skillPointCost: 1, branchId: 'blacksmith_weapon_path', requiredBranchIds: ['blacksmith_weapon_path'], effects: [fx('blacksmith_weapon_blades_group', 'unlock_recipe_group', undefined, 'boolean', { group: 'basic_weapons' }), fx('blacksmith_weapon_blades_success', 'craft_success_bonus', 5, 'percent', { allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 920 }),
    skill({ id: 'blacksmith_weapon_balance', name: 'Баланс оружия', description: 'Баланс и удобство оружия.', requiredLevel: 7, skillPointCost: 1, branchId: 'blacksmith_weapon_path', requiredBranchIds: ['blacksmith_weapon_path'], effects: [fx('blacksmith_weapon_balance_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'weapon_balance', durationHours: 24, temporaryItemBuff: [{ stat: 'hit_chance', value: 5 }, { stat: 'stamina_cost_modifier', value: -3, valueType: 'percent' }], allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 860 }),
    skill({ id: 'blacksmith_sharp_edge', name: 'Острая кромка', description: 'Усиленная режущая обработка.', requiredLevel: 8, skillPointCost: 1, branchId: 'blacksmith_weapon_path', requiredBranchIds: ['blacksmith_weapon_path'], effects: [fx('blacksmith_sharp_edge_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'sharp_edge', durationHours: 24, temporaryItemBuff: [{ stat: 'slash_damage', value: 10 }], allowedItemGroups: ['sword', 'dagger', 'axe', 'spear'] })], positionX: 280, positionY: 800 }),
    skill({ id: 'blacksmith_combat_grip', name: 'Боевой хват', description: 'Подгонка хвата и рукояти.', requiredLevel: 9, skillPointCost: 1, branchId: 'blacksmith_weapon_path', requiredBranchIds: ['blacksmith_weapon_path'], effects: [fx('blacksmith_combat_grip_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'combat_grip', durationHours: 24, temporaryItemBuff: [{ stat: 'agility', value: 5 }, { stat: 'hit_chance', value: 3 }], allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 740 }),
    skill({ id: 'blacksmith_weapon_socket', name: 'Гнездо оружия', description: 'Первое оружейное гнездо.', requiredLevel: 10, skillPointCost: 1, branchId: 'blacksmith_weapon_path', requiredBranchIds: ['blacksmith_weapon_path'], effects: [fx('blacksmith_weapon_socket_action', 'unlock_forge_action', undefined, 'boolean', { action: 'add_weapon_socket' }), fx('blacksmith_weapon_socket_cap', 'max_weapon_socket_unlock', 1, 'flat', { allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 680 }),

    skill({ id: 'blacksmith_razor_steel', name: 'Бритвенная сталь', description: 'Продвинутая режущая обработка.', requiredLevel: 11, skillPointCost: 2, branchId: 'blacksmith_weapon_master_path', requiredBranchIds: ['blacksmith_weapon_master_path'], effects: [fx('blacksmith_razor_steel_upgrade', 'upgrade_temporary_buff', undefined, 'boolean', { buffId: 'sharp_edge', durationHours: 24, temporaryItemBuffBonus: [{ stat: 'slash_damage', value: 20 }, { stat: 'crit_chance', value: 3 }], allowedItemGroups: ['sword', 'dagger', 'axe'] })], positionX: 280, positionY: 600 }),
    skill({ id: 'blacksmith_heavy_impact', name: 'Тяжёлый удар', description: 'Сильный пробивной стиль ковки.', requiredLevel: 11, skillPointCost: 2, branchId: 'blacksmith_weapon_master_path', requiredBranchIds: ['blacksmith_weapon_master_path'], effects: [fx('blacksmith_heavy_impact_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'heavy_impact', durationHours: 24, temporaryItemBuff: [{ stat: 'armor_penetration', value: 5 }, { stat: 'blunt_damage', value: 10 }], allowedItemGroups: ['hammer', 'axe', 'two_handed_weapon'] })], positionX: 280, positionY: 540 }),
    skill({ id: 'blacksmith_personal_weapon_fit', name: 'Личная подгонка оружия', description: 'Точная персональная настройка оружия.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_weapon_master_path', requiredBranchIds: ['blacksmith_weapon_master_path'], effects: [fx('blacksmith_personal_weapon_fit_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'personal_weapon_fit', durationHours: 24, temporaryItemBuff: [{ stat: 'stamina_cost_modifier', value: -8, valueType: 'percent' }, { stat: 'hit_chance', value: 5 }], allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 480 }),
    skill({ id: 'blacksmith_clean_weapon_profile', name: 'Чистый профиль оружия', description: 'Постоянная точность формы оружия.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_weapon_master_path', requiredBranchIds: ['blacksmith_weapon_master_path'], effects: [fx('blacksmith_clean_weapon_profile_success', 'permanent_upgrade_success_bonus', 5, 'percent', { allowedItemGroups: ['weapon'] }), fx('blacksmith_clean_weapon_profile_quality', 'quality_bonus', 1, 'flat', { allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 420 }),
    skill({ id: 'blacksmith_second_weapon_socket', name: 'Второе оружейное гнездо', description: 'Второй слот для оружия.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_weapon_master_path', requiredBranchIds: ['blacksmith_weapon_master_path'], effects: [fx('blacksmith_second_weapon_socket_action', 'unlock_forge_action', undefined, 'boolean', { action: 'add_second_weapon_socket' }), fx('blacksmith_second_weapon_socket_cap', 'max_weapon_socket_unlock', 2, 'flat', { allowedItemGroups: ['weapon'] })], positionX: 280, positionY: 360 }),

    skill({ id: 'blacksmith_armor_forging', name: 'Ковка доспехов', description: 'Базовая ковка брони и щитов.', requiredLevel: 6, skillPointCost: 1, branchId: 'blacksmith_armor_path', requiredBranchIds: ['blacksmith_armor_path'], effects: [fx('blacksmith_armor_forging_group', 'unlock_recipe_group', undefined, 'boolean', { group: 'basic_armor' }), fx('blacksmith_armor_forging_success', 'craft_success_bonus', 5, 'percent', { allowedItemGroups: ['armor'] })], positionX: 640, positionY: 920 }),
    skill({ id: 'blacksmith_reinforced_plates', name: 'Усиленные пластины', description: 'Усиление пластин и щитов.', requiredLevel: 7, skillPointCost: 1, branchId: 'blacksmith_armor_path', requiredBranchIds: ['blacksmith_armor_path'], effects: [fx('blacksmith_reinforced_plates_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'reinforced_plates', durationHours: 24, temporaryItemBuff: [{ stat: 'armor', value: 10 }], allowedItemGroups: ['armor', 'shield'] })], positionX: 640, positionY: 860 }),
    skill({ id: 'blacksmith_shield_brace', name: 'Щитовой упор', description: 'Усиление работы щитом.', requiredLevel: 8, skillPointCost: 1, branchId: 'blacksmith_armor_path', requiredBranchIds: ['blacksmith_armor_path'], effects: [fx('blacksmith_shield_brace_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'shield_brace', durationHours: 24, temporaryItemBuff: [{ stat: 'block_chance', value: 5 }], allowedItemGroups: ['shield'] })], positionX: 640, positionY: 800 }),
    skill({ id: 'blacksmith_armor_fitting', name: 'Подгонка брони', description: 'Подгонка брони под носителя.', requiredLevel: 9, skillPointCost: 1, branchId: 'blacksmith_armor_path', requiredBranchIds: ['blacksmith_armor_path'], effects: [fx('blacksmith_armor_fitting_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'armor_fitting', durationHours: 24, temporaryItemBuff: [{ stat: 'endurance', value: 5 }, { stat: 'stamina', value: 10 }], allowedItemGroups: ['armor'] })], positionX: 640, positionY: 740 }),
    skill({ id: 'blacksmith_armor_socket', name: 'Гнездо защиты', description: 'Первое защитное гнездо.', requiredLevel: 10, skillPointCost: 1, branchId: 'blacksmith_armor_path', requiredBranchIds: ['blacksmith_armor_path'], effects: [fx('blacksmith_armor_socket_action', 'unlock_forge_action', undefined, 'boolean', { action: 'add_defense_socket' }), fx('blacksmith_armor_socket_cap', 'max_defense_socket_unlock', 1, 'flat', { allowedItemGroups: ['armor', 'shield'] })], positionX: 640, positionY: 680 }),

    skill({ id: 'blacksmith_firm_armor_fit', name: 'Жёсткая подгонка брони', description: 'Продвинутая подгонка брони.', requiredLevel: 11, skillPointCost: 2, branchId: 'blacksmith_armor_master_path', requiredBranchIds: ['blacksmith_armor_master_path'], effects: [fx('blacksmith_firm_armor_fit_upgrade', 'upgrade_temporary_buff', undefined, 'boolean', { buffId: 'armor_fitting', durationHours: 24, temporaryItemBuffBonus: [{ stat: 'endurance', value: 10 }, { stat: 'stamina', value: 15 }], allowedItemGroups: ['armor'] })], positionX: 640, positionY: 600 }),
    skill({ id: 'blacksmith_dampening_layer', name: 'Гасительный слой', description: 'Снижение тупого входящего урона.', requiredLevel: 11, skillPointCost: 2, branchId: 'blacksmith_armor_master_path', requiredBranchIds: ['blacksmith_armor_master_path'], effects: [fx('blacksmith_dampening_layer_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'dampening_layer', durationHours: 24, temporaryItemBuff: [{ stat: 'incoming_blunt_damage_modifier', value: -10, valueType: 'percent' }], allowedItemGroups: ['armor', 'shield'] })], positionX: 640, positionY: 540 }),
    skill({ id: 'blacksmith_iron_stance', name: 'Железная стойка', description: 'Усиленная защитная стойка.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_armor_master_path', requiredBranchIds: ['blacksmith_armor_master_path'], effects: [fx('blacksmith_iron_stance_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'iron_stance', durationHours: 24, temporaryItemBuff: [{ stat: 'block_chance', value: 8 }, { stat: 'endurance', value: 10 }], allowedItemGroups: ['shield', 'heavy_armor'] })], positionX: 640, positionY: 480 }),
    skill({ id: 'blacksmith_anti_stun_assembly', name: 'Противоударная сборка', description: 'Защита от оглушения и контузии.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_armor_master_path', requiredBranchIds: ['blacksmith_armor_master_path'], effects: [fx('blacksmith_anti_stun_assembly_buff', 'unlock_temporary_buff', undefined, 'boolean', { buffId: 'anti_stun_assembly', durationHours: 24, temporaryItemBuff: [{ stat: 'status_resistance_stunned', value: 15 }, { stat: 'status_resistance_concussed', value: 15 }], allowedItemGroups: ['helmet', 'armor', 'shield'] })], positionX: 640, positionY: 420 }),
    skill({ id: 'blacksmith_second_defense_socket', name: 'Второе защитное гнездо', description: 'Второй слот защиты.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_armor_master_path', requiredBranchIds: ['blacksmith_armor_master_path'], effects: [fx('blacksmith_second_defense_socket_action', 'unlock_forge_action', undefined, 'boolean', { action: 'add_second_defense_socket' }), fx('blacksmith_second_defense_socket_cap', 'max_defense_socket_unlock', 2, 'flat', { allowedItemGroups: ['armor', 'shield'] })], positionX: 640, positionY: 360 }),

    skill({ id: 'blacksmith_fine_work', name: 'Тонкая работа', description: 'Точная кузнечная обработка.', requiredLevel: 6, skillPointCost: 1, branchId: 'blacksmith_precision_path', requiredBranchIds: ['blacksmith_precision_path'], effects: [fx('blacksmith_fine_work_success', 'fine_work_success_bonus', 5, 'percent', { allowedRecipeGroups: ['settings', 'socket_preparation', 'rune_surface'] }), fx('blacksmith_fine_work_failure', 'failure_chance_reduction', 5, 'percent', { allowedRecipeGroups: ['settings', 'socket_preparation', 'rune_surface'] })], positionX: 1000, positionY: 920 }),
    skill({ id: 'blacksmith_metal_setting', name: 'Оправа металла', description: 'Создание базовых металлических оправ.', requiredLevel: 7, skillPointCost: 1, branchId: 'blacksmith_precision_path', requiredBranchIds: ['blacksmith_precision_path'], effects: [fx('blacksmith_metal_setting_group', 'unlock_recipe_group', undefined, 'boolean', { group: 'basic_settings' }), fx('blacksmith_metal_setting_action', 'unlock_forge_action', undefined, 'boolean', { action: 'create_metal_setting', allowedItemGroups: ['jewelry_base', 'socket_base'] })], positionX: 1000, positionY: 860 }),
    skill({ id: 'blacksmith_insert_mounting', name: 'Посадка вставки', description: 'Стабильная посадка вставок.', requiredLevel: 8, skillPointCost: 1, branchId: 'blacksmith_precision_path', requiredBranchIds: ['blacksmith_precision_path'], effects: [fx('blacksmith_insert_mounting_stability', 'insert_stability_bonus', 5, 'percent', { allowedItemGroups: ['jewelry', 'weapon', 'armor', 'shield'] }), fx('blacksmith_insert_mounting_socket', 'socket_preparation_success_bonus', 5, 'percent', { allowedItemGroups: ['jewelry', 'weapon', 'armor', 'shield'] })], positionX: 1000, positionY: 800 }),
    skill({ id: 'blacksmith_minor_rune_surface', name: 'Малая рунная поверхность', description: 'Подготовка поверхности под руну.', requiredLevel: 9, skillPointCost: 1, branchId: 'blacksmith_precision_path', requiredBranchIds: ['blacksmith_precision_path'], effects: [fx('blacksmith_minor_rune_surface_action', 'unlock_forge_action', undefined, 'boolean', { action: 'prepare_minor_rune_surface', allowedAugmentKind: 'rune' }), fx('blacksmith_minor_rune_surface_success', 'rune_preparation_success_bonus', 5, 'percent')], positionX: 1000, positionY: 740 }),
    skill({ id: 'blacksmith_clean_setting', name: 'Чистая посадка', description: 'Чистая и безопасная посадка.', requiredLevel: 10, skillPointCost: 1, branchId: 'blacksmith_precision_path', requiredBranchIds: ['blacksmith_precision_path'], effects: [fx('blacksmith_clean_setting_socket', 'socket_preparation_success_bonus', 8, 'percent', { allowedItemGroups: ['jewelry', 'weapon', 'armor', 'shield'] }), fx('blacksmith_clean_setting_failure', 'failure_chance_reduction', 5, 'percent', { allowedItemGroups: ['jewelry', 'weapon', 'armor', 'shield'] })], positionX: 1000, positionY: 680 }),

    skill({ id: 'blacksmith_gem_settings', name: 'Ювелирные оправы', description: 'Продвинутые оправы для украшений.', requiredLevel: 11, skillPointCost: 2, branchId: 'blacksmith_setting_master_path', requiredBranchIds: ['blacksmith_setting_master_path'], effects: [fx('blacksmith_gem_settings_path', 'unlock_path_requirement', undefined, 'boolean', { profession: 'jewelcrafting' }), fx('blacksmith_gem_settings_group', 'unlock_recipe_group', undefined, 'boolean', { group: 'advanced_gem_settings', allowedItemGroups: ['ring', 'amulet', 'jewelry'] })], positionX: 1000, positionY: 600 }),
    skill({ id: 'blacksmith_rune_marking', name: 'Рунная разметка', description: 'Точная разметка под руны.', requiredLevel: 11, skillPointCost: 2, branchId: 'blacksmith_setting_master_path', requiredBranchIds: ['blacksmith_setting_master_path'], effects: [fx('blacksmith_rune_marking_path', 'unlock_path_requirement', undefined, 'boolean', { profession: 'runecrafting' }), fx('blacksmith_rune_marking_action', 'unlock_forge_action', undefined, 'boolean', { action: 'rune_marking' }), fx('blacksmith_rune_marking_bonus', 'rune_preparation_success_bonus', 10, 'percent')], positionX: 1000, positionY: 540 }),
    skill({ id: 'blacksmith_stable_mount', name: 'Стабильная посадка', description: 'Продвинутая стабильность вставки.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_setting_master_path', requiredBranchIds: ['blacksmith_setting_master_path'], effects: [fx('blacksmith_stable_mount_insert', 'insert_stability_bonus', 10, 'percent'), fx('blacksmith_stable_mount_socket', 'socket_failure_chance_reduction', 10, 'percent')], positionX: 1000, positionY: 480 }),
    skill({ id: 'blacksmith_thin_metalwork', name: 'Тонкая металлика', description: 'Работа с тонкими и драгоценными металлами.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_setting_master_path', requiredBranchIds: ['blacksmith_setting_master_path'], effects: [fx('blacksmith_thin_metalwork_unlock', 'unlock_material_work', undefined, 'boolean', { materials: ['thin_metal', 'precious_metal'] }), fx('blacksmith_thin_metalwork_success', 'fine_work_success_bonus', 10, 'percent', { allowedRecipeGroups: ['jewelry_base', 'rune_base'] })], positionX: 1000, positionY: 420 }),
    skill({ id: 'blacksmith_base_seal', name: 'Базовая герметизация', description: 'Финальная герметизация посадки.', requiredLevel: 12, skillPointCost: 2, branchId: 'blacksmith_setting_master_path', requiredBranchIds: ['blacksmith_setting_master_path'], effects: [fx('blacksmith_base_seal_action', 'unlock_forge_action', undefined, 'boolean', { action: 'base_seal' }), fx('blacksmith_base_seal_socket', 'socket_preparation_success_bonus', 10, 'percent'), fx('blacksmith_base_seal_rune', 'rune_preparation_success_bonus', 10, 'percent')], positionX: 1000, positionY: 360 }),

    skill({
      id: 'blacksmith_unlock_jewelcrafting',
      name: 'Ювелир',
      description: 'Кузнец завершает путь точной работы и получает право открыть профессию Ювелира.',
      requiredLevel: 20,
      skillPointCost: 3,
      exclusiveSkillGroupId: 'blacksmith_final_profession',
      branchId: 'final_blacksmith_trial',
      requiredBranchIds: ['final_blacksmith_trial'],
      requiredSkillIds: [
        'blacksmith_gem_settings',
        'blacksmith_stable_mount',
        'blacksmith_thin_metalwork',
        'blacksmith_base_seal',
      ],
      effects: [fx('blacksmith_unlock_jewelcrafting_prof', 'unlock_profession', undefined, 'boolean', { professionId: 'jewelcrafting', requiredQuestId: 'quest_unlock_jewelcrafting' })],
      positionX: 460,
      positionY: 120,
    }),
    skill({
      id: 'blacksmith_unlock_runecrafting',
      name: 'Рунорез',
      description: 'Кузнец завершает путь рунной основы и получает право открыть профессию Рунореза.',
      requiredLevel: 20,
      skillPointCost: 3,
      exclusiveSkillGroupId: 'blacksmith_final_profession',
      branchId: 'final_blacksmith_trial',
      requiredBranchIds: ['final_blacksmith_trial'],
      requiredSkillIds: [
        'blacksmith_rune_marking',
        'blacksmith_minor_rune_surface',
        'blacksmith_stable_mount',
        'blacksmith_base_seal',
      ],
      effects: [fx('blacksmith_unlock_runecrafting_prof', 'unlock_profession', undefined, 'boolean', { professionId: 'runecrafting', requiredQuestId: 'quest_unlock_runecrafting' })],
      positionX: 640,
      positionY: 120,
    }),
    skill({
      id: 'blacksmith_unlock_forge_engineering',
      name: 'Инженер Горна',
      description: 'Кузнец завершает путь тяжёлой конструкции и получает право открыть профессию Инженера Горна.',
      requiredLevel: 20,
      skillPointCost: 3,
      exclusiveSkillGroupId: 'blacksmith_final_profession',
      branchId: 'final_blacksmith_trial',
      requiredBranchIds: ['final_blacksmith_trial'],
      requiredSkillIds: [
        'blacksmith_razor_steel',
        'blacksmith_heavy_impact',
        'blacksmith_clean_weapon_profile',
        'blacksmith_second_weapon_socket',
        'blacksmith_firm_armor_fit',
        'blacksmith_iron_stance',
        'blacksmith_anti_stun_assembly',
        'blacksmith_second_defense_socket',
      ],
      effects: [fx('blacksmith_unlock_forge_engineering_prof', 'unlock_profession', undefined, 'boolean', {
        professionId: 'forge_engineering',
        requiredQuestId: 'quest_unlock_forge_engineering',
        requiredAnySkillPath: {
          path_1: ['blacksmith_razor_steel', 'blacksmith_heavy_impact', 'blacksmith_clean_weapon_profile', 'blacksmith_second_weapon_socket'],
          path_2: ['blacksmith_firm_armor_fit', 'blacksmith_iron_stance', 'blacksmith_anti_stun_assembly', 'blacksmith_second_defense_socket'],
        },
      })],
      positionX: 820,
      positionY: 120,
    }),
  ];
}

function createDefaultCarpentrySkills(): ProfessionSkill[] {
  const now = createTimestamp();
  const skill = (params: {
    id: string;
    name: string;
    description: string;
    requiredLevel: number;
    skillPointCost: number;
    branchId: string;
    requiredSkillIds?: string[];
    requiredBranchIds?: string[];
    effects?: ProfessionSkillEffect[];
    positionX: number;
    positionY: number;
  }): ProfessionSkill => ({
    id: params.id,
    professionId: 'carpenter',
    name: params.name,
    description: params.description,
    requiredLevel: params.requiredLevel,
    requiredSkillIds: params.requiredSkillIds ?? [],
    requiredBranchIds: params.requiredBranchIds ?? [],
    branchId: params.branchId,
    skillPointCost: params.skillPointCost,
    effects: params.effects ?? [],
    positionX: params.positionX,
    positionY: params.positionY,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  const fx = (id: string, type: string, value?: number, valueType: ProfessionSkillEffectValueType = 'flat', params?: Record<string, unknown>): ProfessionSkillEffect => ({
    id,
    type,
    value,
    valueType,
    params,
  });

  const skills = [
    // 1. Logging Branch (X = 200)
    skill({
      id: 'carpentry_skill_firm_swing',
      name: 'Верный замах',
      description: 'Плотник учится бить не силой, а правильным углом. Снижает затраты stamina при рубке на 20% и уменьшает износ топора.',
      requiredLevel: 1,
      skillPointCost: 1,
      branchId: 'carpentry_branch_woodcutting',
      effects: [
        fx('carpentry_firm_swing_stamina', 'woodcutting_stamina_cost_modifier', -20, 'percent'),
        fx('carpentry_firm_swing_durability', 'axe_durability_loss_modifier', -10, 'percent')
      ],
      positionX: 200,
      positionY: 900
    }),
    skill({
      id: 'carpentry_skill_tree_reading',
      name: 'Чтение ствола',
      description: 'По наклону ствола, трещинам коры и ветру мастер понимает, куда дерево хочет лечь. Снижает шанс опасного падения на 10%.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'carpentry_branch_woodcutting',
      requiredSkillIds: ['carpentry_skill_firm_swing'],
      effects: [
        fx('carpentry_tree_reading_risk', 'fall_risk_modifier', -10, 'percent')
      ],
      positionX: 200,
      positionY: 800
    }),
    skill({
      id: 'carpentry_skill_lumberjack_wedge',
      name: 'Клин лесоруба',
      description: 'Позволяет использовать клинья. Снижает риск потери части древесины и помогает валить крупные деревья.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'carpentry_branch_woodcutting',
      requiredSkillIds: ['carpentry_skill_firm_swing'],
      effects: [
        fx('carpentry_lumberjack_wedge_efficiency', 'woodcutting_efficiency_bonus', 15, 'percent')
      ],
      positionX: 200,
      positionY: 700
    }),
    skill({
      id: 'carpentry_skill_silent_felling',
      name: 'Тихая валка',
      description: 'Снижает шанс привлечь монстров и диких зверей шумом валки леса.',
      requiredLevel: 3,
      skillPointCost: 1,
      branchId: 'carpentry_branch_woodcutting',
      requiredSkillIds: ['carpentry_skill_tree_reading'],
      effects: [
        fx('carpentry_silent_felling_noise', 'felling_noise_reduction', 25, 'percent')
      ],
      positionX: 200,
      positionY: 600
    }),
    skill({
      id: 'carpentry_skill_clean_cut',
      name: 'Чистый сруб',
      description: '+10% шанс получить качественное бревно и -10% шанс получить повреждённую древесину.',
      requiredLevel: 4,
      skillPointCost: 1,
      branchId: 'carpentry_branch_woodcutting',
      requiredSkillIds: ['carpentry_skill_silent_felling'],
      effects: [
        fx('carpentry_clean_cut_quality', 'log_quality_bonus', 10, 'percent')
      ],
      positionX: 200,
      positionY: 500
    }),
    skill({
      id: 'carpentry_skill_master_hand',
      name: 'Рука мастера',
      description: 'Топор теряет на 15% меньше прочности при рубке, а сама рубка занимает меньше действий.',
      requiredLevel: 5,
      skillPointCost: 2,
      branchId: 'carpentry_branch_woodcutting',
      requiredSkillIds: ['carpentry_skill_clean_cut'],
      effects: [
        fx('carpentry_master_hand_durability', 'axe_durability_save_chance', 15, 'percent')
      ],
      positionX: 200,
      positionY: 400
    }),

    // 2. Sawing Branch (X = 500)
    skill({
      id: 'carpentry_skill_even_sawing',
      name: 'Ровный распил',
      description: 'Позволяет получать на 1 дополнительную доску больше с некоторых брёвен.',
      requiredLevel: 1,
      skillPointCost: 1,
      branchId: 'carpentry_branch_sawing',
      effects: [
        fx('carpentry_even_sawing_yield', 'sawing_extra_plank_chance', 20, 'percent')
      ],
      positionX: 500,
      positionY: 900
    }),
    skill({
      id: 'carpentry_skill_gentle_saw',
      name: 'Бережная пила',
      description: 'Пила теряет на 10% меньше прочности при распиле.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'carpentry_branch_sawing',
      requiredSkillIds: ['carpentry_skill_even_sawing'],
      effects: [
        fx('carpentry_gentle_saw_save', 'saw_durability_save_chance', 10, 'percent')
      ],
      positionX: 500,
      positionY: 800
    }),
    skill({
      id: 'carpentry_skill_plank_marking',
      name: 'Разметка доски',
      description: 'Точная разметка перед распилом повышает количество получаемых материалов.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'carpentry_branch_sawing',
      requiredSkillIds: ['carpentry_skill_even_sawing'],
      effects: [
        fx('carpentry_plank_marking_yield', 'sawing_yield_bonus', 10, 'percent')
      ],
      positionX: 500,
      positionY: 700
    }),
    skill({
      id: 'carpentry_skill_dry_core',
      name: 'Сухая сердцевина',
      description: 'Повышает шанс получить качественную древесину при распиле брёвен.',
      requiredLevel: 3,
      skillPointCost: 1,
      branchId: 'carpentry_branch_sawing',
      requiredSkillIds: ['carpentry_skill_gentle_saw'],
      effects: [
        fx('carpentry_dry_core_quality', 'sawing_quality_bonus', 15, 'percent')
      ],
      positionX: 500,
      positionY: 600
    }),
    skill({
      id: 'carpentry_skill_sawmill_eye',
      name: 'Лесопильный глаз',
      description: 'Мастер видит, какое бревно лучше пустить на доски, а какое — на строительные балки.',
      requiredLevel: 4,
      skillPointCost: 2,
      branchId: 'carpentry_branch_sawing',
      requiredSkillIds: ['carpentry_skill_dry_core'],
      effects: [
        fx('carpentry_sawmill_eye_hint', 'sawing_optimal_hint', 1, 'boolean')
      ],
      positionX: 500,
      positionY: 500
    }),

    // 3. Joinery Branch (X = 800)
    skill({
      id: 'carpentry_skill_basic_handle',
      name: 'Простая рукоять',
      description: 'Открывает создание базовых деревянных рукоятей для ножей, топоров, молотов и древков копий.',
      requiredLevel: 1,
      skillPointCost: 1,
      branchId: 'carpentry_branch_joinery',
      effects: [
        fx('carpentry_basic_handle_unlock', 'unlock_recipe_group', undefined, 'boolean', { group: 'basic_handles' })
      ],
      positionX: 800,
      positionY: 900
    }),
    skill({
      id: 'carpentry_skill_apprentice_shaft',
      name: 'Древко ученика',
      description: 'Открывает создание простых магических палочек и древков для учебных посохов без магии.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'carpentry_branch_joinery',
      requiredSkillIds: ['carpentry_skill_basic_handle'],
      effects: [
        fx('carpentry_apprentice_shaft_unlock', 'unlock_recipe_group', undefined, 'boolean', { group: 'apprentice_shafts' })
      ],
      positionX: 800,
      positionY: 800
    }),
    skill({
      id: 'carpentry_skill_dry_plank',
      name: 'Сухая доска',
      description: 'Снижает шанс брака при создании мебели и открывает сушку древесины.',
      requiredLevel: 2,
      skillPointCost: 1,
      branchId: 'carpentry_branch_joinery',
      requiredSkillIds: ['carpentry_skill_basic_handle'],
      effects: [
        fx('carpentry_dry_plank_save', 'joinery_failure_reduction', 10, 'percent')
      ],
      positionX: 800,
      positionY: 700
    }),
    skill({
      id: 'carpentry_skill_master_frame',
      name: 'Каркас мастера',
      description: 'Открывает создание качественных каркасов для сундуков, кроватей, столов и дверей.',
      requiredLevel: 3,
      skillPointCost: 1,
      branchId: 'carpentry_branch_joinery',
      requiredSkillIds: ['carpentry_skill_apprentice_shaft'],
      effects: [
        fx('carpentry_master_frame_unlock', 'unlock_recipe_group', undefined, 'boolean', { group: 'master_frames' })
      ],
      positionX: 800,
      positionY: 600
    }),
    skill({
      id: 'carpentry_skill_ladder_maker',
      name: 'Лестничий',
      description: 'Открывает создание укреплённых строительных балок, перекрытий, мостков и шахтных подпорок.',
      requiredLevel: 4,
      skillPointCost: 2,
      branchId: 'carpentry_branch_joinery',
      requiredSkillIds: ['carpentry_skill_master_frame'],
      effects: [
        fx('carpentry_ladder_maker_unlock', 'unlock_recipe_group', undefined, 'boolean', { group: 'ladders_and_beams' })
      ],
      positionX: 800,
      positionY: 500
    }),
    skill({
      id: 'carpentry_skill_enchanting_base',
      name: 'Основа для чар',
      description: 'Открывает создание элитных деревянных основ посохов и жезлов для зачарования магами.',
      requiredLevel: 5,
      skillPointCost: 2,
      branchId: 'carpentry_branch_joinery',
      requiredSkillIds: ['carpentry_skill_ladder_maker'],
      effects: [
        fx('carpentry_enchanting_base_unlock', 'unlock_recipe_group', undefined, 'boolean', { group: 'enchanting_bases' })
      ],
      positionX: 800,
      positionY: 400
    })
  ];

  return skills.map((entry) => {
    const icon = DEFAULT_CARPENTRY_SKILL_ICON_BY_ID[entry.id];
    if (!icon) {
      return entry;
    }
    return {
      ...entry,
      icon,
      iconImageRef: buildCarpentrySkillIconRef(entry.id),
    };
  });
}

function resolveDefaultSkillIcon(skill: ProfessionSkill): string | undefined {
  return DEFAULT_MINING_SKILL_ICON_BY_NAME[skill.name]
    ?? DEFAULT_CARPENTRY_SKILL_ICON_BY_ID[skill.id];
}

function resolveDefaultSkillIconRef(skill: ProfessionSkill): GameImageRef | undefined {
  const carpentryPath = DEFAULT_CARPENTRY_SKILL_ICON_BY_ID[skill.id];
  if (carpentryPath) {
    return buildCarpentrySkillIconRef(skill.id);
  }
  return undefined;
}

function applyDefaultSkillIcons(skills: ProfessionSkill[]): ProfessionSkill[] {
  return skills.map((skill) => {
    const defaultIcon = resolveDefaultSkillIcon(skill);
    const defaultIconRef = resolveDefaultSkillIconRef(skill);
    if (!defaultIcon && !defaultIconRef) {
      return skill;
    }
    return {
      ...skill,
      icon: skill.icon?.trim() ? skill.icon : defaultIcon,
      iconImageRef: skill.iconImageRef ?? defaultIconRef,
    };
  });
}

function mergeWithMiningDefaults(skills: ProfessionSkill[]): ProfessionSkill[] {
  const defaults = [
    ...createDefaultProfessionSkills(),
    ...createDefaultBlacksmithSkills(),
    ...createDefaultCarpentrySkills(),
  ];
  const defaultIds = new Set(defaults.map((entry) => entry.id));
  const existingById = new Map(skills.map((entry) => [entry.id, entry]));
  const preserved = skills.filter((entry) => !defaultIds.has(entry.id) && entry.professionId !== 'blacksmithing' && entry.professionId !== 'carpenter');
  const mergedDefaults = defaults.map((entry) => {
    const existing = existingById.get(entry.id);
    const defaultIcon = resolveDefaultSkillIcon(entry);
    const defaultIconRef = resolveDefaultSkillIconRef(entry);
    if (!existing) {
      return applyDefaultSkillIcons([{
        ...entry,
        icon: entry.icon?.trim() ? entry.icon : defaultIcon,
        iconImageRef: entry.iconImageRef ?? defaultIconRef,
      }])[0];
    }
    return applyDefaultSkillIcons([{
      ...entry,
      ...existing,
      icon: existing.icon?.trim() ? existing.icon : (entry.icon?.trim() ? entry.icon : defaultIcon),
      iconImageRef: existing.iconImageRef ?? entry.iconImageRef ?? defaultIconRef,
      positionX: existing.positionX ?? entry.positionX,
      positionY: existing.positionY ?? entry.positionY,
      requiredSkillIds: existing.requiredSkillIds ?? entry.requiredSkillIds,
      requiredBranchIds: existing.requiredBranchIds ?? entry.requiredBranchIds,
      effects: existing.effects ?? entry.effects,
      createdAt: existing.createdAt ?? entry.createdAt,
      updatedAt: existing.updatedAt ?? entry.updatedAt,
    }])[0];
  });
  return applyDefaultSkillIcons([...preserved, ...mergedDefaults]);
}

function readStorage(): ProfessionSkill[] {
  const defaults = [
    ...createDefaultProfessionSkills(),
    ...createDefaultBlacksmithSkills(),
    ...createDefaultCarpentrySkills(),
  ];
  if (typeof window === 'undefined') {
    return defaults;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    writeStorage(defaults);
    return clone(defaults);
  }
  try {
    const parsed = JSON.parse(raw);
    const skills = Array.isArray(parsed)
      ? parsed.map(normalizeSkill).filter((entry): entry is ProfessionSkill => Boolean(entry))
      : [];
    const merged = mergeWithMiningDefaults(skills);
    writeStorage(merged);
    return clone(merged);
  } catch {
    writeStorage(defaults);
    return clone(defaults);
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

export async function reloadProfessionSkillsFromContent(): Promise<ProfessionSkill[]> {
  try {
    const remote = await loadProfessionSkillsFromBackend();
    return hydrateProfessionSkillsFromBackend(remote);
  } catch {
    return loadProfessionSkillsFromStorage();
  }
}

function mergeRemoteProfessionSkills(local: ProfessionSkill[], remote: ProfessionSkill[]): ProfessionSkill[] {
  if (remote.length === 0) {
    return local;
  }
  const remoteById = new Map(remote.map((entry) => [entry.id, entry]));
  return local.map((entry) => {
    const fromRemote = remoteById.get(entry.id);
    if (!fromRemote) {
      return entry;
    }
    const remoteUpdatedAt = Date.parse(fromRemote.updatedAt ?? '');
    const localUpdatedAt = Date.parse(entry.updatedAt ?? '');
    const remoteIsNewer = Number.isFinite(remoteUpdatedAt)
      && (!Number.isFinite(localUpdatedAt) || remoteUpdatedAt >= localUpdatedAt);
    if (!remoteIsNewer) {
      return entry;
    }
    return {
      ...entry,
      ...fromRemote,
      icon: fromRemote.icon?.trim() ? fromRemote.icon : entry.icon,
      iconImageRef: fromRemote.iconImageRef ?? entry.iconImageRef,
      positionX: fromRemote.positionX ?? entry.positionX,
      positionY: fromRemote.positionY ?? entry.positionY,
      effects: fromRemote.effects ?? entry.effects,
    };
  });
}

export function saveProfessionSkillsToStorage(skills: ProfessionSkill[]): ProfessionSkill[] {
  const normalized = mergeWithMiningDefaults(
    skills.map(normalizeSkill).filter((entry): entry is ProfessionSkill => Boolean(entry)),
  );
  writeStorage(normalized);
  if (typeof window !== 'undefined') {
    void syncProfessionSkillsToBackend(normalized).catch((error) => {
      console.warn('[professionSkills] Failed to sync skills to backend content:', error);
    });
  }
  return clone(normalized);
}

export function hydrateProfessionSkillsFromBackend(remoteSkills: ProfessionSkill[]): ProfessionSkill[] {
  const normalizedRemote = mergeWithMiningDefaults(
    remoteSkills.map(normalizeSkill).filter((entry): entry is ProfessionSkill => Boolean(entry)),
  );
  const local = readStorage();
  const merged = normalizedRemote.length === 0
    ? local
    : mergeWithMiningDefaults(mergeRemoteProfessionSkills(local, normalizedRemote));
  writeStorage(merged);
  if (typeof window !== 'undefined') {
    void syncProfessionSkillsToBackend(merged).catch((error) => {
      console.warn('[professionSkills] Failed to hydrate skills into backend content:', error);
    });
  }
  return clone(merged);
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
    ...createDefaultCarpentrySkills(),
  ];
  writeStorage(defaults);
  return clone(defaults);
}

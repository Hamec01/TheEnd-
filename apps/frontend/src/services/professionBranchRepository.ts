import type { ProfessionBranch } from '../types/profession';

const STORAGE_KEY = 'theend.professionBranches.v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = Array.from(new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean)));
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeBranch(value: unknown): ProfessionBranch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = String(raw.id ?? '').trim();
  const professionId = String(raw.professionId ?? '').trim();
  const name = String(raw.name ?? '').trim();
  if (!id || !professionId || !name) {
    return null;
  }
  return {
    id,
    professionId,
    name,
    description: String(raw.description ?? '').trim(),
    exclusiveGroupId: String(raw.exclusiveGroupId ?? '').trim() || undefined,
    exclusiveGroupMax: Number.isFinite(Number(raw.exclusiveGroupMax)) && Number(raw.exclusiveGroupMax) > 0
      ? Math.floor(Number(raw.exclusiveGroupMax))
      : undefined,
    requiredSkillIds: normalizeStringArray(raw.requiredSkillIds),
    requiredBranchIds: normalizeStringArray(raw.requiredBranchIds),
    locksBranchIds: normalizeStringArray(raw.locksBranchIds),
    isFinalBranch: raw.isFinalBranch === true,
    isEnabled: raw.isEnabled !== false,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function createDefaultMiningBranches(): ProfessionBranch[] {
  const now = new Date().toISOString();
  const branch = (params: {
    id: string;
    name: string;
    description?: string;
    exclusiveGroupId?: string;
    requiredSkillIds?: string[];
    requiredBranchIds?: string[];
    locksBranchIds?: string[];
    isFinalBranch?: boolean;
  }): ProfessionBranch => ({
    id: params.id,
    professionId: 'mining',
    name: params.name,
    description: params.description ?? params.name,
    exclusiveGroupId: params.exclusiveGroupId,
    requiredSkillIds: params.requiredSkillIds ?? [],
    requiredBranchIds: params.requiredBranchIds ?? [],
    locksBranchIds: params.locksBranchIds ?? [],
    isFinalBranch: params.isFinalBranch ?? false,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  return [
    branch({
      id: 'mining_branch_common',
      name: 'Общая ветка',
      description: 'Базовые навыки работы в шахте.',
    }),
    branch({
      id: 'mining_branch_transition',
      name: 'Переходные навыки',
      description: 'Навыки, ведущие к специализации Горняка.',
      requiredSkillIds: ['mining_firm_swing', 'mining_stone_hearing', 'mining_work_breathing', 'mining_careful_strike', 'mining_ore_habit'],
    }),
    branch({
      id: 'mining_branch_deep_delver',
      name: 'Глубинник',
      description: 'Путь тех, кто идёт вниз ради выживания и глубины.',
      exclusiveGroupId: 'mining_first_path',
      requiredSkillIds: ['mining_support_beams', 'mining_safety_rope', 'mining_dark_eye'],
      locksBranchIds: ['mining_branch_prospector'],
    }),
    branch({
      id: 'mining_branch_prospector',
      name: 'Старатель',
      description: 'Путь тех, кто идёт за выгодной и редкой добычей.',
      exclusiveGroupId: 'mining_first_path',
      requiredSkillIds: ['mining_support_beams', 'mining_safety_rope', 'mining_dark_eye'],
      locksBranchIds: ['mining_branch_deep_delver'],
    }),
    branch({
      id: 'mining_branch_dwarf_tunneler',
      name: 'Гномий проходчик',
      description: 'Финальный путь глубинника, читающего трещины и старые тоннели.',
      exclusiveGroupId: 'mining_deep_final',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredSkillIds: ['mining_anchor_rope', 'mining_vein_under_feet', 'mining_stone_endurance'],
      locksBranchIds: ['mining_branch_abyss_conqueror'],
      isFinalBranch: true,
    }),
    branch({
      id: 'mining_branch_abyss_conqueror',
      name: 'Покоритель бездн',
      description: 'Финальный путь глубинника, выживающего там, где другие гибнут.',
      exclusiveGroupId: 'mining_deep_final',
      requiredBranchIds: ['mining_branch_deep_delver'],
      requiredSkillIds: ['mining_anchor_rope', 'mining_vein_under_feet', 'mining_stone_endurance'],
      locksBranchIds: ['mining_branch_dwarf_tunneler'],
      isFinalBranch: true,
    }),
    branch({
      id: 'mining_branch_gem_seeker',
      name: 'Искатель самоцветов',
      description: 'Финальный путь старателя, ведущий к чистым камням и кристаллам.',
      exclusiveGroupId: 'mining_prospector_final',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredSkillIds: ['mining_gold_scent', 'mining_stonecutter', 'mining_trader_eye'],
      locksBranchIds: ['mining_branch_rune_seeker'],
      isFinalBranch: true,
    }),
    branch({
      id: 'mining_branch_rune_seeker',
      name: 'Искатель рун',
      description: 'Финальный путь старателя, который ищет древние следы и руны в камне.',
      exclusiveGroupId: 'mining_prospector_final',
      requiredBranchIds: ['mining_branch_prospector'],
      requiredSkillIds: ['mining_gold_scent', 'mining_stonecutter', 'mining_trader_eye'],
      locksBranchIds: ['mining_branch_gem_seeker'],
      isFinalBranch: true,
    }),
  ];
}

function createDefaultBlacksmithBranches(): ProfessionBranch[] {
  const now = new Date().toISOString();
  const branch = (params: {
    id: string;
    name: string;
    description?: string;
    exclusiveGroupId?: string;
    exclusiveGroupMax?: number;
    requiredSkillIds?: string[];
    requiredBranchIds?: string[];
    locksBranchIds?: string[];
    isFinalBranch?: boolean;
  }): ProfessionBranch => ({
    id: params.id,
    professionId: 'blacksmithing',
    name: params.name,
    description: params.description ?? params.name,
    exclusiveGroupId: params.exclusiveGroupId,
    exclusiveGroupMax: params.exclusiveGroupMax,
    requiredSkillIds: params.requiredSkillIds ?? [],
    requiredBranchIds: params.requiredBranchIds ?? [],
    locksBranchIds: params.locksBranchIds ?? [],
    isFinalBranch: params.isFinalBranch ?? false,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
  });

  return [
    branch({
      id: 'blacksmith_start',
      name: 'Кузня',
      description: 'Начальная кузнечная ветка: основа работы с горном, заготовками и первичной сборкой.',
    }),
    branch({
      id: 'blacksmith_weapon_path',
      name: 'Оружейник',
      description: 'Путь ковки оружия: клинки, баланс, рукояти и оружейные гнезда.',
      exclusiveGroupId: 'blacksmith_specialization_path',
      exclusiveGroupMax: 2,
      requiredBranchIds: ['blacksmith_start'],
      requiredSkillIds: [
        'blacksmith_basic_forging',
        'blacksmith_metal_knowledge',
        'blacksmith_even_blank',
        'blacksmith_simple_tempering',
        'blacksmith_rough_socket',
      ],
    }),
    branch({
      id: 'blacksmith_armor_path',
      name: 'Бронник',
      description: 'Путь ковки брони и щитов: пластины, усиление защиты и подгонка доспехов.',
      exclusiveGroupId: 'blacksmith_specialization_path',
      exclusiveGroupMax: 2,
      requiredBranchIds: ['blacksmith_start'],
      requiredSkillIds: [
        'blacksmith_basic_forging',
        'blacksmith_metal_knowledge',
        'blacksmith_even_blank',
        'blacksmith_simple_tempering',
        'blacksmith_rough_socket',
      ],
    }),
    branch({
      id: 'blacksmith_precision_path',
      name: 'Точный кузнец',
      description: 'Путь точной работы: оправы, посадка вставок и подготовка поверхности под руны.',
      exclusiveGroupId: 'blacksmith_specialization_path',
      exclusiveGroupMax: 2,
      requiredBranchIds: ['blacksmith_start'],
      requiredSkillIds: [
        'blacksmith_basic_forging',
        'blacksmith_metal_knowledge',
        'blacksmith_even_blank',
        'blacksmith_simple_tempering',
        'blacksmith_rough_socket',
      ],
    }),
    branch({
      id: 'blacksmith_weapon_master_path',
      name: 'Мастер оружия',
      description: 'Верхняя ступень оружейного пути: точная форма, усиленная режущая кромка и глубокая подгонка оружия.',
      exclusiveGroupId: 'blacksmith_master_specialization',
      exclusiveGroupMax: 2,
      requiredBranchIds: ['blacksmith_weapon_path'],
      requiredSkillIds: [
        'blacksmith_weapon_blades',
        'blacksmith_weapon_balance',
        'blacksmith_sharp_edge',
        'blacksmith_combat_grip',
        'blacksmith_weapon_socket',
      ],
    }),
    branch({
      id: 'blacksmith_armor_master_path',
      name: 'Мастер брони',
      description: 'Верхняя ступень защитного пути: стойкость, противоударная сборка и продвинутая работа по броне.',
      exclusiveGroupId: 'blacksmith_master_specialization',
      exclusiveGroupMax: 2,
      requiredBranchIds: ['blacksmith_armor_path'],
      requiredSkillIds: [
        'blacksmith_armor_forging',
        'blacksmith_reinforced_plates',
        'blacksmith_shield_brace',
        'blacksmith_armor_fitting',
        'blacksmith_armor_socket',
      ],
    }),
    branch({
      id: 'blacksmith_setting_master_path',
      name: 'Мастер оправы',
      description: 'Верхняя ступень точной ветки: стабильные оправы, рунная подготовка и герметизация посадок.',
      exclusiveGroupId: 'blacksmith_master_specialization',
      exclusiveGroupMax: 2,
      requiredBranchIds: ['blacksmith_precision_path'],
      requiredSkillIds: [
        'blacksmith_fine_work',
        'blacksmith_metal_setting',
        'blacksmith_insert_mounting',
        'blacksmith_minor_rune_surface',
        'blacksmith_clean_setting',
      ],
    }),
    branch({
      id: 'final_blacksmith_trial',
      name: 'Финальное испытание кузнеца',
      description: 'Узел перехода к отдельным профессиям после завершения двух мастерских ветвей.',
      requiredBranchIds: ['blacksmith_start'],
      requiredSkillIds: [],
      isFinalBranch: true,
    }),
  ];
}

function mergeWithMiningDefaults(branches: ProfessionBranch[]): ProfessionBranch[] {
  const defaults = [
    ...createDefaultMiningBranches(),
    ...createDefaultBlacksmithBranches(),
  ];
  const defaultIds = new Set(defaults.map((entry) => entry.id));
  const existingById = new Map(branches.map((entry) => [entry.id, entry]));
  const preserved = branches.filter((entry) => !defaultIds.has(entry.id) && entry.professionId !== 'blacksmithing');
  const mergedDefaults = defaults.map((entry) => {
    const existing = existingById.get(entry.id);
    if (!existing) {
      return entry;
    }
    return {
      ...existing,
      ...entry,
      createdAt: existing.createdAt ?? entry.createdAt,
      updatedAt: entry.updatedAt ?? existing.updatedAt,
    };
  });
  return [...preserved, ...mergedDefaults];
}

function readStorage(): ProfessionBranch[] {
  const defaults = [
    ...createDefaultMiningBranches(),
    ...createDefaultBlacksmithBranches(),
  ];
  if (typeof window === 'undefined') {
    return defaults;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw);
    const branches = Array.isArray(parsed)
      ? parsed.map((entry) => normalizeBranch(entry)).filter((entry): entry is ProfessionBranch => Boolean(entry))
      : [];
    const merged = mergeWithMiningDefaults(branches);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

function writeStorage(branches: ProfessionBranch[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branches));
}

export function loadProfessionBranchesFromStorage(): ProfessionBranch[] {
  return clone(readStorage());
}

export function saveProfessionBranchesToStorage(branches: ProfessionBranch[]): ProfessionBranch[] {
  const normalized = mergeWithMiningDefaults(
    branches.map((entry) => normalizeBranch(entry)).filter((entry): entry is ProfessionBranch => Boolean(entry)),
  );
  writeStorage(normalized);
  return clone(normalized);
}

export function getProfessionBranchesByProfessionId(professionId: string): ProfessionBranch[] {
  return loadProfessionBranchesFromStorage().filter((entry) => entry.professionId === professionId);
}

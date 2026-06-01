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
      id: 'blacksmith_branch_weaponsmith',
      name: 'Оружейник',
      description: 'Путь кузнеца, который сосредоточен на клинках, рукоятях, балансе оружия и боевых заготовках.',
      exclusiveGroupId: 'blacksmith_first_path',
      requiredSkillIds: [
        'blacksmith_basic_forging',
        'blacksmith_metal_knowledge',
        'blacksmith_even_blank',
      ],
      locksBranchIds: [
        'blacksmith_branch_armorer',
        'blacksmith_branch_precision_smith',
      ],
    }),
    branch({
      id: 'blacksmith_branch_armorer',
      name: 'Бронник',
      description: 'Путь кузнеца, который работает с пластинами, щитами, сборкой доспехов и выверенной защитой.',
      exclusiveGroupId: 'blacksmith_first_path',
      requiredSkillIds: [
        'blacksmith_basic_forging',
        'blacksmith_metal_knowledge',
        'blacksmith_even_blank',
      ],
      locksBranchIds: [
        'blacksmith_branch_weaponsmith',
        'blacksmith_branch_precision_smith',
      ],
    }),
    branch({
      id: 'blacksmith_branch_precision_smith',
      name: 'Точный кузнец',
      description: 'Путь кузнеца точной работы: оправы, посадка вставок, подготовка металла под будущие камни и руны.',
      exclusiveGroupId: 'blacksmith_first_path',
      requiredSkillIds: [
        'blacksmith_basic_forging',
        'blacksmith_metal_knowledge',
        'blacksmith_even_blank',
      ],
      locksBranchIds: [
        'blacksmith_branch_weaponsmith',
        'blacksmith_branch_armorer',
      ],
    }),
    branch({
      id: 'blacksmith_branch_weapon_master',
      name: 'Мастер оружия',
      description: 'Вторая ступень оружейной ветки: сильная заточка, ударные формы, подгонка под бойца и второй оружейный слот.',
      requiredBranchIds: ['blacksmith_branch_weaponsmith'],
      requiredSkillIds: [
        'blacksmith_weapon_blades',
        'blacksmith_weapon_balance',
        'blacksmith_sharp_edge',
      ],
    }),
    branch({
      id: 'blacksmith_branch_armor_master',
      name: 'Мастер брони',
      description: 'Вторая ступень защитной ветки: усиленная сборка, гашение удара, стойка железа и второй защитный слот.',
      requiredBranchIds: ['blacksmith_branch_armorer'],
      requiredSkillIds: [
        'blacksmith_armor_forging',
        'blacksmith_reinforced_plates',
        'blacksmith_shield_brace',
      ],
    }),
    branch({
      id: 'blacksmith_branch_setting_master',
      name: 'Мастер оправы',
      description: 'Вторая ступень точной ветки: крепкие оправы, рунная разметка, тонкая работа и базовая герметизация.',
      requiredBranchIds: ['blacksmith_branch_precision_smith'],
      requiredSkillIds: [
        'blacksmith_fine_work',
        'blacksmith_metal_setting',
        'blacksmith_insert_mounting',
      ],
    }),
    branch({
      id: 'blacksmith_branch_jewelcrafter',
      name: 'Ювелир',
      description: 'Финальная специализация на кольцах, амулетах, огранке камней и пассивной силе украшений.',
      exclusiveGroupId: 'blacksmith_final_path',
      requiredSkillIds: [
        'blacksmith_razor_steel',
        'blacksmith_firm_armor_fit',
        'blacksmith_gem_settings',
      ],
      locksBranchIds: [
        'blacksmith_branch_runecrafter',
        'blacksmith_branch_forge_master',
      ],
      isFinalBranch: true,
    }),
    branch({
      id: 'blacksmith_branch_runecrafter',
      name: 'Рунорез',
      description: 'Финальная специализация на рунах, рунных камнях, чтении знаков и рунных комплексах.',
      exclusiveGroupId: 'blacksmith_final_path',
      requiredSkillIds: [
        'blacksmith_razor_steel',
        'blacksmith_firm_armor_fit',
        'blacksmith_gem_settings',
      ],
      locksBranchIds: [
        'blacksmith_branch_jewelcrafter',
        'blacksmith_branch_forge_master',
      ],
      isFinalBranch: true,
    }),
    branch({
      id: 'blacksmith_branch_forge_master',
      name: 'Мастер Горна',
      description: 'Финальная специализация чистой ковки: лучшая немагическая сталь, баффы, форма и легендарные изделия.',
      exclusiveGroupId: 'blacksmith_final_path',
      requiredSkillIds: [
        'blacksmith_razor_steel',
        'blacksmith_firm_armor_fit',
        'blacksmith_gem_settings',
      ],
      locksBranchIds: [
        'blacksmith_branch_jewelcrafter',
        'blacksmith_branch_runecrafter',
      ],
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
  const preserved = branches.filter((entry) => !defaultIds.has(entry.id));
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

import type { AdminItem, CarpenterItemTemplate, ProfessionWorkshopDefinition } from '../../services/content/models';
import { getProfessionId, getProfessionItemKind, getToolKind } from '../../services/professionItemModule';
import { hasWorkshopAccessUnlock } from '../workshops/workshopAccessState';
import { getWorkshopRentalAccess } from '../workshops/workshopRentalState';

export interface CarpenterTemplateAccessResult {
  isUnlocked: boolean;
  missingSkillIds: string[];
  missingSkillNames: string[];
  requiredSkillIds: string[];
  reason?: string;
}

export interface CarpenterWorkshopAccessResult {
  isAllowed: boolean;
  reason?: string;
}

export interface CarpenterWorkshopAccessContext {
  reputation?: number;
  completedQuestIds?: string[];
  factionIds?: string[];
}

export interface CarpenterMiniGameAccessResult {
  allowed: boolean;
  reason?: string;
  missingSkillIds: string[];
  missingSkillNames: string[];
  requiredWorkshopTier: number;
  templateGroup: string;
  requiredToolKinds: string[];
}

const BASE_CARPENTER_TEMPLATE_IDS = new Set<string>([
  'template_carpenter_clean_log',
  'template_carpenter_plank_basic',
  'template_carpenter_beam_basic',
  'template_carpenter_split_log',
  'template_carpenter_charcoal_basic',
  'template_carpenter_wood_glue_basic',
  'template_carpenter_treated_bark',
]);

const CARPENTER_SKILL_ALIASES: Record<string, string[]> = {
  carpentry_skill_basic_handle: [
    'carpentry_skill_basic_handle',
    'carp_simple_handle',
    'carpenter_simple_handle',
    'simple_handle',
  ],
  carpentry_skill_apprentice_shaft: [
    'carpentry_skill_apprentice_shaft',
    'carp_apprentice_shaft',
    'carpenter_apprentice_shaft',
    'apprentice_shaft',
  ],
  carpentry_skill_plank_marking: [
    'carpentry_skill_plank_marking',
    'carp_board_marking',
    'board_marking',
  ],
  carpentry_skill_dry_plank: [
    'carpentry_skill_dry_plank',
    'carp_dry_plank',
    'dry_plank',
  ],
  carpentry_skill_master_frame: [
    'carpentry_skill_master_frame',
    'carp_master_frame',
    'master_frame',
  ],
  carpentry_skill_ladder_maker: [
    'carpentry_skill_ladder_maker',
    'carp_ladderman',
    'ladderman',
  ],
  carpentry_skill_shield_core_basics: [
    'carpentry_skill_shield_core_basics',
    'carp_shield_core_basics',
    'carpenter_shield_core_basics',
    'shield_core_basics',
  ],
  carpentry_skill_tower_shield_frame: [
    'carpentry_skill_tower_shield_frame',
    'carp_tower_shield_frame',
    'carpenter_tower_shield_frame',
    'tower_shield_frame',
  ],
  carpentry_skill_staff_core_basics: [
    'carpentry_skill_staff_core_basics',
    'carp_staff_core_basics',
    'carpenter_staff_core_basics',
    'staff_core_basics',
  ],
  carpentry_skill_wand_carving: [
    'carpentry_skill_wand_carving',
    'carp_wand_carving',
    'carpenter_wand_carving',
    'wand_carving',
  ],
  carpentry_skill_rune_staff_preparation: [
    'carpentry_skill_rune_staff_preparation',
    'carp_rune_staff_preparation',
    'carpenter_rune_staff_preparation',
    'rune_staff_preparation',
  ],
  carpentry_skill_ritual_wood_carving: [
    'carpentry_skill_ritual_wood_carving',
    'carp_ritual_wood_carving',
    'carpenter_ritual_wood_carving',
    'ritual_wood_carving',
  ],
  carpentry_skill_bow_stave_basics: [
    'carpentry_skill_bow_stave_basics',
    'carp_bow_stave_basics',
    'carpenter_bow_stave_basics',
    'bow_stave_basics',
  ],
  carpentry_skill_bowyer_hand: [
    'carpentry_skill_bowyer_hand',
    'carp_bowyer_hand',
    'carpenter_bowyer_hand',
    'bowyer_hand',
  ],
  carpentry_skill_war_bow_shape: [
    'carpentry_skill_war_bow_shape',
    'carp_war_bow_shape',
    'carpenter_war_bow_shape',
    'war_bow_shape',
  ],
  carpentry_skill_longbow_mastery: [
    'carpentry_skill_longbow_mastery',
    'carp_longbow_mastery',
    'carpenter_longbow_mastery',
    'longbow_mastery',
  ],
  carpentry_skill_crossbow_stock: [
    'carpentry_skill_crossbow_stock',
    'carp_crossbow_stock',
    'carpenter_crossbow_stock',
    'crossbow_stock',
  ],
  carpentry_skill_crossbow_body: [
    'carpentry_skill_crossbow_body',
    'carp_crossbow_body',
    'carpenter_crossbow_body',
    'crossbow_body',
  ],
};

const CARPENTER_SKILL_FALLBACK_NAMES: Record<string, string> = {
  carpentry_skill_basic_handle: 'Простая рукоять',
  carpentry_skill_apprentice_shaft: 'Древко ученика',
  carpentry_skill_plank_marking: 'Разметка доски',
  carpentry_skill_dry_plank: 'Сухая доска',
  carpentry_skill_master_frame: 'Каркас мастера',
  carpentry_skill_ladder_maker: 'Лестничий',
  carpentry_skill_shield_core_basics: 'Щитовая основа',
  carpentry_skill_tower_shield_frame: 'Башенный каркас',
  carpentry_skill_staff_core_basics: 'Основа посоха',
  carpentry_skill_wand_carving: 'Резьба жезла',
  carpentry_skill_rune_staff_preparation: 'Подготовка под руны',
  carpentry_skill_ritual_wood_carving: 'Ритуальная резьба',
  carpentry_skill_bow_stave_basics: 'Заготовка лучника',
  carpentry_skill_bowyer_hand: 'Рука лучника',
  carpentry_skill_war_bow_shape: 'Боевой изгиб',
  carpentry_skill_longbow_mastery: 'Длинная тетива',
  carpentry_skill_crossbow_stock: 'Ложе арбалета',
  carpentry_skill_crossbow_body: 'Корпус арбалета',
};

const TEMPLATE_REQUIRED_SKILLS: Record<string, string[]> = {
  template_carpenter_thin_plank: ['carpentry_skill_plank_marking'],
  template_carpenter_planed_plank: ['carpentry_skill_plank_marking'],
  template_carpenter_polished_plank: ['carpentry_skill_plank_marking'],
  template_carpenter_generic_handle: ['carpentry_skill_basic_handle'],
  template_carpenter_sword_handle: ['carpentry_skill_basic_handle'],
  template_carpenter_dagger_handle: ['carpentry_skill_basic_handle'],
  template_carpenter_axe_haft: ['carpentry_skill_basic_handle'],
  template_carpenter_hammer_handle: ['carpentry_skill_basic_handle'],
  template_carpenter_mace_handle: ['carpentry_skill_basic_handle'],
  template_carpenter_spear_shaft: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_javelin_shaft: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_polearm_shaft: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_halberd_shaft: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_arrow_shaft: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_arrow_shaft_bundle: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_bolt_shaft: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_bolt_shaft_bundle: ['carpentry_skill_apprentice_shaft'],
  template_carpenter_staff_core_basic: ['carpentry_skill_staff_core_basics'],
  template_carpenter_staff_core_balanced: ['carpentry_skill_staff_core_basics'],
  template_carpenter_wand_core_basic: ['carpentry_skill_wand_carving'],
  template_carpenter_rune_staff_core: ['carpentry_skill_rune_staff_preparation'],
  template_carpenter_rune_wood_plate: ['carpentry_skill_rune_staff_preparation'],
  template_carpenter_magic_focus_frame: ['carpentry_skill_rune_staff_preparation'],
  template_carpenter_enchanting_frame: ['carpentry_skill_rune_staff_preparation'],
  template_carpenter_ritual_staff_core: ['carpentry_skill_ritual_wood_carving'],
  template_carpenter_ritual_board: ['carpentry_skill_ritual_wood_carving'],
  template_carpenter_totem_core: ['carpentry_skill_ritual_wood_carving'],
  template_carpenter_shamanic_frame: ['carpentry_skill_ritual_wood_carving'],
  template_carpenter_bow_stave: ['carpentry_skill_bow_stave_basics'],
  template_carpenter_simple_bow_body: ['carpentry_skill_bow_stave_basics'],
  template_carpenter_hunting_bow_body: ['carpentry_skill_bowyer_hand'],
  template_carpenter_hunting_arrow: ['carpentry_skill_bowyer_hand'],
  template_carpenter_war_bow_body: ['carpentry_skill_war_bow_shape'],
  template_carpenter_war_arrow: ['carpentry_skill_war_bow_shape'],
  template_carpenter_longbow_body: ['carpentry_skill_longbow_mastery'],
  template_carpenter_composite_bow_core: ['carpentry_skill_longbow_mastery'],
  template_carpenter_crossbow_stock: ['carpentry_skill_crossbow_stock'],
  template_carpenter_crossbow_body: ['carpentry_skill_crossbow_body'],
  template_carpenter_crossbow_channel: ['carpentry_skill_crossbow_body'],
  template_carpenter_crossbow_grip: ['carpentry_skill_crossbow_body'],
  template_carpenter_crossbow_reinforced_stock: ['carpentry_skill_crossbow_body'],
  template_carpenter_simple_crossbow_body: ['carpentry_skill_crossbow_body'],
  template_carpenter_shield_core_round: ['carpentry_skill_shield_core_basics'],
  template_carpenter_shield_board: ['carpentry_skill_shield_core_basics'],
  template_carpenter_shield_frame: ['carpentry_skill_shield_core_basics'],
  template_carpenter_shield_grip: ['carpentry_skill_shield_core_basics'],
  template_carpenter_wooden_shield_basic: ['carpentry_skill_shield_core_basics'],
  template_carpenter_shield_core_kite: ['carpentry_skill_tower_shield_frame'],
  template_carpenter_shield_core_tower: ['carpentry_skill_tower_shield_frame'],
  template_carpenter_chair_frame: ['carpentry_skill_ladder_maker'],
  template_carpenter_table_frame: ['carpentry_skill_ladder_maker'],
  template_carpenter_bed_frame: ['carpentry_skill_ladder_maker'],
  template_carpenter_shelf_frame: ['carpentry_skill_ladder_maker'],
  template_carpenter_chest_body: ['carpentry_skill_ladder_maker'],
  template_carpenter_wardrobe_body: ['carpentry_skill_ladder_maker'],
  template_carpenter_door_panel: ['carpentry_skill_ladder_maker'],
  template_carpenter_ladder_part: ['carpentry_skill_ladder_maker'],
  template_carpenter_barrel_body: ['carpentry_skill_ladder_maker'],
  template_carpenter_ship_plank: ['carpentry_skill_ladder_maker'],
  template_carpenter_weapon_rack: ['carpentry_skill_master_frame'],
  template_carpenter_armor_stand: ['carpentry_skill_master_frame'],
  template_carpenter_training_dummy: ['carpentry_skill_master_frame'],
  template_carpenter_cart_wheel: ['carpentry_skill_master_frame'],
};

const TEMPLATE_GROUP_TIER_FALLBACKS: Record<string, number> = {
  wood_processing: 1,
  weapon_components: 1,
  arrows_and_bolts: 1,
  shields: 2,
  bows: 2,
  crossbows: 2,
  furniture: 2,
  building_parts: 2,
  staffs_and_wands: 3,
  ritual_woodwork: 3,
};

const STATION_TIER_FALLBACKS: Partial<Record<CarpenterItemTemplate['stationType'], number>> = {
  workbench: 1,
  sawmill: 1,
  drying_rack: 1,
  carving_table: 1,
  carving_bench: 1,
  assembly_table: 2,
  finishing_table: 2,
  bowyer_bench: 2,
  rune_carving_table: 3,
};

const STATION_TOOL_KIND_MAP: Partial<Record<CarpenterItemTemplate['stationType'], string[]>> = {
  none: ['workbench'],
  workbench: ['workbench', 'planer', 'hammer', 'chisel'],
  sawmill: ['saw'],
  drying_rack: ['drying_rack'],
  carving_table: ['chisel', 'carving_knife'],
  carving_bench: ['chisel', 'carving_knife', 'planer'],
  assembly_table: ['hammer', 'workbench'],
  finishing_table: ['planer', 'carving_knife', 'chisel'],
  bowyer_bench: ['carving_knife', 'planer'],
  rune_carving_table: ['chisel', 'carving_knife'],
};

const CANONICAL_SKILL_BY_ALIAS = Object.entries(CARPENTER_SKILL_ALIASES).reduce<Record<string, string>>((acc, [canonicalId, aliases]) => {
  for (const rawAlias of aliases) {
    const alias = normalizeSkillId(rawAlias);
    if (alias) {
      acc[alias] = canonicalId;
    }
  }
  return acc;
}, {});

function normalizeSkillId(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function canonicalizeSkillId(skillId: string): string {
  const normalized = normalizeSkillId(skillId);
  return CANONICAL_SKILL_BY_ALIAS[normalized] ?? normalized;
}

function uniqueSkillIds(skillIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawSkillId of skillIds) {
    const canonicalId = canonicalizeSkillId(rawSkillId);
    if (!canonicalId || seen.has(canonicalId)) {
      continue;
    }
    seen.add(canonicalId);
    result.push(canonicalId);
  }
  return result;
}

function isSkillLearned(requiredSkillId: string, learnedSkillIds: Set<string>): boolean {
  const canonicalId = canonicalizeSkillId(requiredSkillId);
  const aliases = CARPENTER_SKILL_ALIASES[canonicalId] ?? [canonicalId];
  return aliases.some((alias) => learnedSkillIds.has(normalizeSkillId(alias)));
}

function resolveSkillName(skillId: string, skillNameById?: Record<string, string>): string {
  const canonicalId = canonicalizeSkillId(skillId);
  const aliases = CARPENTER_SKILL_ALIASES[canonicalId] ?? [canonicalId];
  for (const alias of aliases) {
    const name = skillNameById?.[alias];
    if (name) {
      return name;
    }
  }
  return skillNameById?.[canonicalId] ?? CARPENTER_SKILL_FALLBACK_NAMES[canonicalId] ?? canonicalId;
}

export function resolveCarpenterTemplateRequiredSkillIds(template: CarpenterItemTemplate): string[] {
  const directSkillIds = uniqueSkillIds((template.requiredSkillIds ?? []).map(normalizeSkillId).filter(Boolean));
  if (directSkillIds.length > 0) {
    return directSkillIds;
  }
  if (BASE_CARPENTER_TEMPLATE_IDS.has(template.id)) {
    return [];
  }
  return uniqueSkillIds(TEMPLATE_REQUIRED_SKILLS[template.id] ?? []);
}

export function resolveCarpenterTemplateGroup(template: CarpenterItemTemplate): string {
  return String(template.group ?? template.recipeGroup ?? '').trim();
}

export function resolveCarpenterTemplateRequiredWorkshopTier(template: CarpenterItemTemplate): number {
  if (typeof template.requiredWorkshopTier === 'number' && Number.isFinite(template.requiredWorkshopTier) && template.requiredWorkshopTier > 0) {
    return Math.max(1, Math.round(template.requiredWorkshopTier));
  }

  const templateGroup = resolveCarpenterTemplateGroup(template);
  if (templateGroup === 'arrows_and_bolts') {
    const byLevel = typeof template.requiredCarpenterLevel === 'number' && template.requiredCarpenterLevel >= 4 ? 2 : 1;
    return Math.max(byLevel, STATION_TIER_FALLBACKS[template.stationType] ?? 1);
  }
  if (templateGroup && TEMPLATE_GROUP_TIER_FALLBACKS[templateGroup]) {
    return Math.max(TEMPLATE_GROUP_TIER_FALLBACKS[templateGroup]!, STATION_TIER_FALLBACKS[template.stationType] ?? 1);
  }
  if (template.stationType === 'rune_carving_table') {
    return 3;
  }
  if (typeof template.requiredCarpenterLevel === 'number' && template.requiredCarpenterLevel >= 7) {
    return 3;
  }
  if (typeof template.requiredCarpenterLevel === 'number' && template.requiredCarpenterLevel >= 3) {
    return 2;
  }
  return STATION_TIER_FALLBACKS[template.stationType] ?? 1;
}

export function resolveCarpenterTemplateBaseDifficulty(template: CarpenterItemTemplate): number {
  if (typeof template.baseDifficulty === 'number' && Number.isFinite(template.baseDifficulty) && template.baseDifficulty > 0) {
    return Math.max(1, Math.round(template.baseDifficulty));
  }
  return template.difficulty === 'master'
    ? 40
    : template.difficulty === 'advanced'
      ? 28
      : template.difficulty === 'standard'
        ? 18
        : 10;
}

export function resolveCarpenterTemplateBaseRisk(template: CarpenterItemTemplate): number {
  if (typeof template.baseRisk === 'number' && Number.isFinite(template.baseRisk) && template.baseRisk >= 0) {
    return Math.max(0, Math.round(template.baseRisk));
  }
  return template.difficulty === 'master'
    ? 12
    : template.difficulty === 'advanced'
      ? 8
      : template.difficulty === 'standard'
        ? 4
        : 2;
}

export function resolveCarpenterStationRequiredToolKinds(stationType: CarpenterItemTemplate['stationType'] | string | null | undefined): string[] {
  const normalizedStationType = String(stationType ?? '').trim() as CarpenterItemTemplate['stationType'];
  return [...(STATION_TOOL_KIND_MAP[normalizedStationType] ?? ['workbench'])];
}

export function canUseCarpenterTemplate(params: {
  template: CarpenterItemTemplate;
  learnedSkillIds: string[];
  skillNameById?: Record<string, string>;
}): CarpenterTemplateAccessResult {
  const requiredSkillIds = resolveCarpenterTemplateRequiredSkillIds(params.template);
  if (requiredSkillIds.length === 0) {
    return {
      isUnlocked: true,
      missingSkillIds: [],
      missingSkillNames: [],
      requiredSkillIds: [],
    };
  }

  const learned = new Set((params.learnedSkillIds ?? []).map(normalizeSkillId).filter(Boolean));
  const missingSkillIds = requiredSkillIds.filter((skillId) => !isSkillLearned(skillId, learned));
  const missingSkillNames = missingSkillIds.map((skillId) => resolveSkillName(skillId, params.skillNameById));
  const reason = missingSkillNames.length <= 1
    ? `Требуется навык: ${missingSkillNames[0] ?? resolveSkillName(requiredSkillIds[0]!, params.skillNameById)}`
    : `Требуются навыки: ${missingSkillNames.join(', ')}`;

  return {
    isUnlocked: missingSkillIds.length === 0,
    missingSkillIds,
    missingSkillNames,
    requiredSkillIds,
    reason: missingSkillIds.length > 0 ? reason : undefined,
  };
}

export function canUseCarpenterTemplateInWorkshop(params: {
  template: CarpenterItemTemplate;
  activeWorkshop?: ProfessionWorkshopDefinition | null;
}): CarpenterWorkshopAccessResult {
  const workshop = params.activeWorkshop ?? null;
  if (!workshop) {
    return { isAllowed: true };
  }

  if (workshop.status !== 'active') {
    return {
      isAllowed: false,
      reason: 'Эта мастерская сейчас недоступна.',
    };
  }

  const stationType = String(params.template.stationType ?? '').trim();
  const stationTypes = (workshop.stationTypes ?? []).map((entry) => String(entry).trim()).filter(Boolean);
  if (stationTypes.length > 0 && stationType && !stationTypes.includes(stationType)) {
    return {
      isAllowed: false,
      reason: `Эта мастерская не поддерживает станок ${stationType}.`,
    };
  }

  const requiredWorkshopTier = resolveCarpenterTemplateRequiredWorkshopTier(params.template);
  if (requiredWorkshopTier > Math.max(0, Math.floor(Number(workshop.tier ?? 0) || 0))) {
    return {
      isAllowed: false,
      reason: `Нужна мастерская выше уровнем. Требуется tier ${requiredWorkshopTier}.`,
    };
  }

  const templateId = String(params.template.id ?? '').trim();
  const allowedTemplateIds = (workshop.allowedTemplateIds ?? []).map((entry) => String(entry).trim()).filter(Boolean);
  if (allowedTemplateIds.length > 0 && !allowedTemplateIds.includes(templateId)) {
    return {
      isAllowed: false,
      reason: `Шаблон ${templateId} не разрешён в мастерской ${workshop.name}.`,
    };
  }

  const forbiddenTemplateIds = new Set((workshop.forbiddenTemplateIds ?? []).map((entry) => String(entry).trim()).filter(Boolean));
  if (forbiddenTemplateIds.has(templateId)) {
    return {
      isAllowed: false,
      reason: `Шаблон ${templateId} запрещён в мастерской ${workshop.name}.`,
    };
  }

  const normalizedGroup = resolveCarpenterTemplateGroup(params.template);
  const allowedTemplateGroups = (workshop.allowedTemplateGroups ?? []).map((entry) => String(entry).trim()).filter(Boolean);
  if (allowedTemplateGroups.length > 0 && (!normalizedGroup || !allowedTemplateGroups.includes(normalizedGroup))) {
    return {
      isAllowed: false,
      reason: normalizedGroup
        ? `Группа ${normalizedGroup} не открыта в мастерской ${workshop.name}.`
        : `У шаблона нет группы, разрешённой в мастерской ${workshop.name}.`,
    };
  }

  const forbiddenTemplateGroups = new Set((workshop.forbiddenTemplateGroups ?? []).map((entry) => String(entry).trim()).filter(Boolean));
  if (normalizedGroup && forbiddenTemplateGroups.has(normalizedGroup)) {
    return {
      isAllowed: false,
      reason: `Группа ${normalizedGroup} запрещена в мастерской ${workshop.name}.`,
    };
  }

  return { isAllowed: true };
}

export function validateCarpenterMiniGameAccess(params: {
  characterId: string;
  template: CarpenterItemTemplate;
  activeWorkshop?: ProfessionWorkshopDefinition | null;
  activeStationType?: string | null;
  learnedSkillIds?: string[];
  skillNameById?: Record<string, string>;
  selectedMaterialItemIds?: string[];
  selectedTool?: AdminItem | null;
  selectedToolDurability?: number | null;
  workshopAccessContext?: CarpenterWorkshopAccessContext;
  skipMaterialCheck?: boolean;
  skipToolCheck?: boolean;
}): CarpenterMiniGameAccessResult {
  const templateAccess = canUseCarpenterTemplate({
    template: params.template,
    learnedSkillIds: params.learnedSkillIds ?? [],
    skillNameById: params.skillNameById,
  });
  const requiredWorkshopTier = resolveCarpenterTemplateRequiredWorkshopTier(params.template);
  const templateGroup = resolveCarpenterTemplateGroup(params.template);
  const requiredToolKinds = resolveCarpenterStationRequiredToolKinds(params.template.stationType);

  const resultBase = {
    missingSkillIds: templateAccess.missingSkillIds,
    missingSkillNames: templateAccess.missingSkillNames,
    requiredWorkshopTier,
    templateGroup,
    requiredToolKinds,
  };

  if (!params.activeWorkshop) {
    return {
      allowed: false,
      reason: 'Сначала открой мастерскую.',
      ...resultBase,
    };
  }

  if (params.activeWorkshop.status !== 'active') {
    return {
      allowed: false,
      reason: 'Эта мастерская сейчас недоступна.',
      ...resultBase,
    };
  }

  const rentalAccess = getWorkshopRentalAccess({
    characterId: params.characterId,
    workshop: params.activeWorkshop,
  });
  if (params.activeWorkshop.rental?.enabled === true && !rentalAccess.canUse) {
    return {
      allowed: false,
      reason: rentalAccess.status === 'expired'
        ? 'Срок аренды мастерской истёк.'
        : 'Сначала арендуй мастерскую.',
      ...resultBase,
    };
  }

  if (
    params.activeWorkshop.rental?.requiresNpcDialogue === true
    && !hasWorkshopAccessUnlock(params.characterId, params.activeWorkshop.id)
  ) {
    return {
      allowed: false,
      reason: 'Сначала поговори с владельцем мастерской.',
      ...resultBase,
    };
  }

  const workshopAccess = canUseCarpenterTemplateInWorkshop({
    template: params.template,
    activeWorkshop: params.activeWorkshop,
  });
  if (!workshopAccess.isAllowed) {
    return {
      allowed: false,
      reason: workshopAccess.reason ?? 'Этот шаблон недоступен в текущей мастерской.',
      ...resultBase,
    };
  }

  const normalizedActiveStationType = String(params.activeStationType ?? '').trim();
  if (normalizedActiveStationType && params.template.stationType !== normalizedActiveStationType) {
    return {
      allowed: false,
      reason: `Требуется станок: ${normalizedActiveStationType}.`,
      ...resultBase,
    };
  }

  if (!templateAccess.isUnlocked) {
    return {
      allowed: false,
      reason: templateAccess.reason ?? 'Не хватает навыков плотника.',
      ...resultBase,
    };
  }

  const context = params.workshopAccessContext;
  const requiredReputation = typeof params.activeWorkshop.requiredReputation === 'number'
    ? Math.max(0, params.activeWorkshop.requiredReputation)
    : 0;
  if (requiredReputation > 0) {
    if (typeof context?.reputation !== 'number') {
      return {
        allowed: false,
        reason: `Требуется репутация ${requiredReputation}, но runtime-контекст репутации сейчас не подключён.`,
        ...resultBase,
      };
    }
    if (context.reputation < requiredReputation) {
      return {
        allowed: false,
        reason: `Требуется репутация ${requiredReputation}.`,
        ...resultBase,
      };
    }
  }

  if (params.activeWorkshop.requiredQuestId?.trim()) {
    const questId = params.activeWorkshop.requiredQuestId.trim();
    if (!context?.completedQuestIds) {
      return {
        allowed: false,
        reason: `Требуется квест ${questId}, но quest-контекст сейчас не подключён.`,
        ...resultBase,
      };
    }
    if (!context.completedQuestIds.includes(questId)) {
      return {
        allowed: false,
        reason: `Требуется квест: ${questId}.`,
        ...resultBase,
      };
    }
  }

  if (params.activeWorkshop.requiredFactionId?.trim()) {
    const factionId = params.activeWorkshop.requiredFactionId.trim();
    if (!context?.factionIds) {
      return {
        allowed: false,
        reason: `Требуется фракция ${factionId}, но faction-контекст сейчас не подключён.`,
        ...resultBase,
      };
    }
    if (!context.factionIds.includes(factionId)) {
      return {
        allowed: false,
        reason: `Требуется фракция: ${factionId}.`,
        ...resultBase,
      };
    }
  }

  if (!params.skipMaterialCheck && (params.selectedMaterialItemIds ?? []).filter(Boolean).length === 0) {
    return {
      allowed: false,
      reason: 'Сначала выбери материал.',
      ...resultBase,
    };
  }

  if (!params.skipToolCheck) {
    if (!params.selectedTool) {
      return {
        allowed: false,
        reason: 'Сначала выбери инструмент.',
        ...resultBase,
      };
    }

    const selectedToolProfessionId = getProfessionId(params.selectedTool);
    const selectedToolKind = String(getToolKind(params.selectedTool) ?? '').trim();
    if (selectedToolProfessionId && selectedToolProfessionId !== 'carpenter') {
      return {
        allowed: false,
        reason: 'Нужен инструмент плотника.',
        ...resultBase,
      };
    }
    if (getProfessionItemKind(params.selectedTool) !== 'tool') {
      return {
        allowed: false,
        reason: 'Выбранный предмет не является инструментом.',
        ...resultBase,
      };
    }
    if (!selectedToolKind || !requiredToolKinds.includes(selectedToolKind)) {
      return {
        allowed: false,
        reason: `Требуется инструмент: ${requiredToolKinds.join(', ')}.`,
        ...resultBase,
      };
    }
    if (typeof params.selectedToolDurability === 'number' && params.selectedToolDurability <= 0) {
      return {
        allowed: false,
        reason: 'Выбранный инструмент изношен.',
        ...resultBase,
      };
    }
  }

  return {
    allowed: true,
    ...resultBase,
  };
}

import type { CarpenterItemTemplate } from '../../services/content/models';

export interface CarpenterTemplateAccessResult {
  isUnlocked: boolean;
  missingSkillIds: string[];
  missingSkillNames: string[];
  requiredSkillIds: string[];
  reason?: string;
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

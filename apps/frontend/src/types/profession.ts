export type ProfessionCategory = 'gathering' | 'crafting' | 'survival' | 'alchemy' | 'other';

export function translateProfessionCategory(category: ProfessionCategory): string {
  const translations: Record<ProfessionCategory, string> = {
    'gathering': 'Добыча',
    'crafting': 'Ремесло',
    'survival': 'Выживание',
    'alchemy': 'Алхимия',
    'other': 'Другое',
  };
  return translations[category] || category;
}

export interface ProfessionDefinition {
  id: string;
  name: string;
  description: string;
  category: ProfessionCategory;
  icon?: string;
  maxLevel: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ProfessionSkillEffectValueType = 'flat' | 'percent' | 'boolean';

export type MiningSkillEffectType =
  | 'mine_stamina_cost_modifier'
  | 'mine_extra_stamina'
  | 'mine_extra_hits'
  | 'mine_extra_hits_on_descend'
  | 'mine_loot_quantity_modifier'
  | 'mine_loot_quality_modifier'
  | 'mine_block_hint_chance'
  | 'mine_ore_chance_modifier'
  | 'mine_rare_ore_chance_modifier'
  | 'mine_gold_chance_modifier'
  | 'mine_gem_chance_modifier'
  | 'mine_crystal_chance_modifier'
  | 'mine_rune_fragment_chance_modifier'
  | 'mine_passage_chance_modifier'
  | 'mine_exit_chance_modifier'
  | 'mine_collapse_chance_modifier'
  | 'mine_collapse_damage_modifier'
  | 'mine_hazard_resistance'
  | 'mine_gas_resistance'
  | 'mine_lava_resistance'
  | 'mine_fire_resistance'
  | 'mine_ice_resistance'
  | 'mine_dust_resistance'
  | 'mine_curse_resistance'
  | 'mine_spirit_resistance'
  | 'mine_once_per_run_escape'
  | 'mine_once_per_run_survive_1hp'
  | 'mine_death_loot_save_modifier'
  | 'mine_retreat_loot_save'
  | 'mine_area_break'
  | 'mine_area_break_chance'
  | 'mine_reveal_adjacent_blocks'
  | 'mine_free_adjacent_breaks'
  | 'mine_porters_unlock'
  | 'mine_porters_save_items_on_death'
  | 'mine_porters_save_items_on_retreat'
  | 'mine_porters_capacity_modifier'
  | 'mine_reduce_risk_increase_per_hit'
  | 'mine_start_with_exit_hint'
  | 'mine_start_with_passage_hint'
  | 'mine_ignore_first_hazard'
  | 'mine_fragile_loot_break_chance_modifier'
  | 'mine_loot_sell_value_modifier'
  | 'mine_loot_special_property_chance'
  | 'mine_event_chance_modifier'
  | 'mine_refund_hit_chance'
  | 'mine_refund_stamina_chance'
  | 'mine_hazard_type_resistance'
  | 'mine_block_type_yield_modifier'
  | 'mine_payload_type_chance_modifier'
  | 'mine_rune_trace_chance_modifier'
  | 'mine_block_weight_modifier'
  | 'mine_hazard_weight_modifier'
  | 'mine_event_weight_modifier';

export interface ProfessionSkillEffectCondition {
  minDepth?: number;
  maxDepth?: number;
  remainingHitsMax?: number;
  remainingHitsMin?: number;
  mineTheme?: string[];
  mineDangerLevel?: string[];
  hazardType?: string[];
  blockType?: string[];
  lootRarity?: string[];
  itemTags?: string[];
}

export interface ProfessionSkillEffect {
  id?: string;
  type: MiningSkillEffectType | string;
  value?: number;
  valueType?: ProfessionSkillEffectValueType;
  chance?: number;
  maxUsesPerRun?: number;
  maxUsesPerDepth?: number;
  target?: string;
  condition?: ProfessionSkillEffectCondition;
  params?: Record<string, unknown>;
}

export interface ProfessionSkill {
  id: string;
  professionId: string;
  name: string;
  description: string;
  requiredLevel: number;
  requiredSkillIds?: string[];
  requiredBranchIds?: string[];
  branchId?: string;
  skillPointCost: number;
  effects?: ProfessionSkillEffect[];
  icon?: string;
  positionX?: number;
  positionY?: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProfessionBranch {
  id: string;
  professionId: string;
  name: string;
  description: string;
  exclusiveGroupId?: string;
  requiredSkillIds?: string[];
  requiredBranchIds?: string[];
  locksBranchIds?: string[];
  isFinalBranch?: boolean;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

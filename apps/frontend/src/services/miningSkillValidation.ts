import type { MineBlockPayloadType, MineBlockType, MineHazardType } from '../types/mining';
import type { ProfessionBranch, ProfessionSkill } from '../types/profession';
import { getMiningContentSnapshot } from './miningRepository';
import { fixMojibake } from '../utils/fixMojibake';

export interface MiningSkillValidationWarning {
  skillId: string;
  skillName: string;
  effectType: string;
  message: string;
}

function toSet(values: (string | undefined)[] | undefined): Set<string> {
  return new Set((values ?? []).map((entry) => String(entry ?? '').trim()).filter(Boolean));
}

const SUPPORTED_EFFECT_TYPES = new Set<string>([
  'mine_stamina_cost_modifier',
  'mine_extra_stamina',
  'mine_extra_hits',
  'mine_extra_hits_on_descend',
  'mine_loot_quantity_modifier',
  'mine_loot_quality_modifier',
  'mine_block_hint_chance',
  'mine_ore_chance_modifier',
  'mine_rare_ore_chance_modifier',
  'mine_gold_chance_modifier',
  'mine_gem_chance_modifier',
  'mine_crystal_chance_modifier',
  'mine_passage_chance_modifier',
  'mine_exit_chance_modifier',
  'mine_collapse_chance_modifier',
  'mine_collapse_damage_modifier',
  'mine_hazard_resistance',
  'mine_gas_resistance',
  'mine_lava_resistance',
  'mine_fire_resistance',
  'mine_ice_resistance',
  'mine_dust_resistance',
  'mine_curse_resistance',
  'mine_spirit_resistance',
  'mine_once_per_run_escape',
  'mine_once_per_run_survive_1hp',
  'mine_death_loot_save_modifier',
  'mine_retreat_loot_save',
  'mine_area_break',
  'mine_area_break_chance',
  'mine_reveal_adjacent_blocks',
  'mine_free_adjacent_breaks',
  'mine_porters_unlock',
  'mine_porters_save_items_on_death',
  'mine_porters_save_items_on_retreat',
  'mine_porters_capacity_modifier',
  'mine_reduce_risk_increase_per_hit',
  'mine_start_with_exit_hint',
  'mine_start_with_passage_hint',
  'mine_ignore_first_hazard',
  'mine_fragile_loot_break_chance_modifier',
  'mine_loot_sell_value_modifier',
  'mine_loot_special_property_chance',
  'mine_rune_fragment_chance_modifier',
  'mine_event_chance_modifier',
  'mine_refund_hit_chance',
  'mine_refund_stamina_chance',
]);

const HAZARD_EFFECT_TYPES = new Set<string>([
  'mine_hazard_resistance',
  'mine_gas_resistance',
  'mine_lava_resistance',
  'mine_fire_resistance',
  'mine_ice_resistance',
  'mine_dust_resistance',
  'mine_curse_resistance',
  'mine_spirit_resistance',
  'mine_collapse_damage_modifier',
  'mine_ignore_first_hazard',
]);

const BLOCK_EFFECT_TYPES = new Set<string>([
  'mine_block_hint_chance',
  'mine_ore_chance_modifier',
  'mine_rare_ore_chance_modifier',
  'mine_gold_chance_modifier',
  'mine_gem_chance_modifier',
  'mine_crystal_chance_modifier',
  'mine_passage_chance_modifier',
  'mine_exit_chance_modifier',
  'mine_fragile_loot_break_chance_modifier',
  'mine_loot_special_property_chance',
]);

const PAYLOAD_EFFECT_TYPES = new Set<string>([
  'mine_rune_fragment_chance_modifier',
  'mine_event_chance_modifier',
]);

export function validateMiningSkillConnectivity(skills: ProfessionSkill[], branches: ProfessionBranch[] = []): MiningSkillValidationWarning[] {
  const warnings: MiningSkillValidationWarning[] = [];
  const miningSkills = skills.filter((entry) => entry.professionId === 'mining');
  const miningBranches = branches.filter((entry) => entry.professionId === 'mining');
  const snapshot = getMiningContentSnapshot();

  const activeMineIds = new Set(snapshot.mines.filter((entry) => entry.isEnabled).map((entry) => entry.id));
  const activeDepths = snapshot.depths.filter((entry) => entry.isEnabled && activeMineIds.has(entry.mineId));
  const activeBlockTableIds = new Set(activeDepths.map((entry) => entry.blockTableId));
  const activeHazardTableIds = new Set(activeDepths.map((entry) => entry.hazardTableId));

  const activeHazardIds = new Set<string>();
  for (const table of snapshot.hazardTables) {
    if (!activeHazardTableIds.has(table.id)) {
      continue;
    }
    for (const entry of table.entries) {
      activeHazardIds.add(entry.hazardId);
    }
  }

  const hazardTypes = new Set<string>(
    snapshot.hazards
      .filter((entry) => entry.isEnabled && activeHazardIds.has(entry.id))
      .map((entry) => entry.type),
  );

  const blockTypes = new Set<string>();
  const payloadTypes = new Set<string>();
  for (const table of snapshot.blockTables) {
    if (!activeBlockTableIds.has(table.id)) {
      continue;
    }
    for (const entry of table.entries) {
      blockTypes.add(entry.type);
      for (const payload of entry.payloads ?? []) {
        payloadTypes.add(payload.type);
      }
    }
  }

  const branchById = new Map(miningBranches.map((entry) => [entry.id, entry]));

  for (const skill of miningSkills) {
    if ((skill.effects ?? []).length === 0) {
      warnings.push({
        skillId: skill.id,
        skillName: skill.name,
        effectType: 'none',
        message: 'У навыка нет эффектов.',
      });
    }

    const branchId = skill.branchId?.trim();
    if (branchId) {
      const branch = branchById.get(branchId);
      if (!branch) {
        warnings.push({
          skillId: skill.id,
          skillName: skill.name,
          effectType: 'branch',
          message: `Навык ссылается на отсутствующую ветку: ${branchId}`,
        });
      }
      const missingRequiredBranch = (skill.requiredBranchIds ?? []).find((requiredBranchId) => !branchById.has(requiredBranchId));
      if (missingRequiredBranch) {
        warnings.push({
          skillId: skill.id,
          skillName: skill.name,
          effectType: 'branch',
          message: `Навык требует отсутствующую ветку: ${missingRequiredBranch}`,
        });
      }
      const conflictingRequiredBranch = (skill.requiredBranchIds ?? []).find((requiredBranchId) => {
        const requiredBranch = branchById.get(requiredBranchId);
        return Boolean(requiredBranch && (requiredBranch.locksBranchIds ?? []).includes(branchId));
      });
      if (conflictingRequiredBranch) {
        warnings.push({
          skillId: skill.id,
          skillName: skill.name,
          effectType: 'branch',
          message: `Навык привязан к недостижимой комбинации веток: ${branchId} + ${conflictingRequiredBranch}`,
        });
      }
    }

    if (skill.requiredLevel >= 12 && skill.skillPointCost >= 3 && (skill.requiredSkillIds ?? []).length === 0) {
      warnings.push({
        skillId: skill.id,
        skillName: skill.name,
        effectType: 'capstone',
        message: 'Финальный узел выглядит как capstone, но у него нет requiredSkillIds.',
      });
    }

    for (const effect of skill.effects ?? []) {
      if (!SUPPORTED_EFFECT_TYPES.has(effect.type)) {
        warnings.push({
          skillId: skill.id,
          skillName: skill.name,
          effectType: effect.type,
          message: 'Эффект не поддержан рантаймом полностью и будет безопасно проигнорирован.',
        });
      }

      const conditionHazards = toSet(effect.condition?.hazardType);
      if (HAZARD_EFFECT_TYPES.has(effect.type) && conditionHazards.size > 0) {
        const missing = Array.from(conditionHazards).filter((type) => !hazardTypes.has(type));
        if (missing.length > 0) {
          warnings.push({
            skillId: skill.id,
            skillName: skill.name,
            effectType: effect.type,
            message: `Указаны отсутствующие типы опасностей: ${missing.join(', ')}`,
          });
        }
      }

      const conditionBlocks = toSet(effect.condition?.blockType);
      if (BLOCK_EFFECT_TYPES.has(effect.type) && conditionBlocks.size > 0) {
        const missing = Array.from(conditionBlocks).filter((type) => !blockTypes.has(type));
        if (missing.length > 0) {
          warnings.push({
            skillId: skill.id,
            skillName: skill.name,
            effectType: effect.type,
            message: `Указаны отсутствующие типы блоков: ${missing.join(', ')}`,
          });
        }
      }

      if (PAYLOAD_EFFECT_TYPES.has(effect.type) && !payloadTypes.has('rune_trace') && effect.type === 'mine_rune_fragment_chance_modifier') {
        warnings.push({
          skillId: skill.id,
          skillName: skill.name,
          effectType: effect.type,
          message: 'Нет ни одного активного блока с payload type = rune_trace.',
        });
      }
      if (PAYLOAD_EFFECT_TYPES.has(effect.type) && !blockTypes.has('event') && !payloadTypes.has('event_ref') && effect.type === 'mine_event_chance_modifier') {
        warnings.push({
          skillId: skill.id,
          skillName: skill.name,
          effectType: effect.type,
          message: 'Нет ни одного активного event-блока или payload type = event_ref.',
        });
      }
    }
  }

  for (const branch of miningBranches) {
    if (branch.isFinalBranch && !String(branch.exclusiveGroupId ?? '').trim()) {
      warnings.push({
        skillId: branch.id,
        skillName: branch.name,
        effectType: 'branch',
        message: 'Финальная ветка не имеет exclusiveGroupId.',
      });
    }
    const missingRequiredBranch = (branch.requiredBranchIds ?? []).find((requiredBranchId) => !branchById.has(requiredBranchId));
    if (missingRequiredBranch) {
      warnings.push({
        skillId: branch.id,
        skillName: branch.name,
        effectType: 'branch',
        message: `Ветка требует отсутствующую ветку: ${missingRequiredBranch}`,
      });
    }
  }

  return warnings.map((warning) => ({
    ...warning,
    skillName: fixMojibake(warning.skillName),
    message: fixMojibake(warning.message),
  }));
}

export function getBlockedByExclusiveBranchReason(params: {
  skill: ProfessionSkill;
  learnedSkillIds: string[];
  allSkills: ProfessionSkill[];
  branches: ProfessionBranch[];
}): string | null {
  const branchId = params.skill.branchId?.trim();
  if (!branchId) {
    return null;
  }
  const branch = params.branches.find((entry) => entry.id === branchId && entry.isEnabled);
  if (!branch?.exclusiveGroupId) {
    return null;
  }

  const learned = new Set(params.learnedSkillIds);
  const branchById = new Map(params.branches.map((entry) => [entry.id, entry]));
  for (const learnedSkillId of learned) {
    if (learnedSkillId === params.skill.id) {
      continue;
    }
    const learnedSkill = params.allSkills.find((entry) => entry.id === learnedSkillId);
    if (!learnedSkill) {
      continue;
    }
    const learnedBranchId = learnedSkill.branchId?.trim();
    if (!learnedBranchId || learnedBranchId === branchId) {
      continue;
    }
    const learnedBranch = branchById.get(learnedBranchId);
    if (!learnedBranch?.isEnabled) {
      continue;
    }
    if (learnedBranch.exclusiveGroupId === branch.exclusiveGroupId) {
      return `Ветка ${branch.name} взаимоисключающая с уже изученной веткой ${learnedBranch.name}.`;
    }
  }

  return null;
}

export function getBlockedBySelectedExclusiveBranchReason(params: {
  skill: ProfessionSkill;
  branches: ProfessionBranch[];
  selectedBranchIds: string[];
}): string | null {
  const branchId = params.skill.branchId?.trim();
  if (!branchId) {
    return null;
  }

  const branch = params.branches.find((entry) => entry.id === branchId && entry.isEnabled);
  if (!branch?.exclusiveGroupId) {
    return null;
  }

  const selectedBranchIds = new Set(params.selectedBranchIds.map((entry) => String(entry ?? '').trim()).filter(Boolean));
  if (selectedBranchIds.has(branch.id)) {
    return null;
  }

  const conflictingSelectedBranch = params.branches.find((entry) => (
    entry.isEnabled
    && entry.id !== branch.id
    && entry.exclusiveGroupId === branch.exclusiveGroupId
    && selectedBranchIds.has(entry.id)
  ));

  if (conflictingSelectedBranch) {
    return `Сначала выберите ветку ${branch.name}. Сейчас активна другая ветка группы: ${conflictingSelectedBranch.name}.`;
  }

  return null;
}

export const MINING_HAZARD_TYPES: MineHazardType[] = [
  'minor_collapse',
  'medium_collapse',
  'major_collapse',
  'deadly_collapse',
  'rockfall',
  'cave_in',
  'gas',
  'toxic_gas',
  'dust',
  'silica_dust',
  'lava_crack',
  'steam_burst',
  'ice_crack',
  'frost_pocket',
  'spirit',
  'wraith',
  'curse',
  'rune_backlash',
  'lost_loot',
];

export const MINING_BLOCK_TYPES: MineBlockType[] = [
  'empty',
  'stone',
  'ore',
  'rich_ore',
  'gold',
  'gem',
  'crystal',
  'hazard',
  'passage',
  'exit',
  'event',
];

export const MINING_BLOCK_PAYLOAD_TYPES: MineBlockPayloadType[] = [
  'loot_item',
  'loot_material',
  'hazard_ref',
  'event_ref',
  'rune_trace',
  'gold',
];

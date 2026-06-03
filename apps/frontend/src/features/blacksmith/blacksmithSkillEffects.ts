import type { ProfessionSkill } from '../../types/profession';

export interface BlacksmithSkillBonuses {
  craftSuccessBonus: number;
  failureChanceReduction: number;
  qualityBonus: number;
  heatControlBonus: number;
  strikePrecisionBonus: number;
  quenchControlBonus: number;
  minResultFloor: number;
  unlockedActions: string[];
}

export function resolveBlacksmithSkillBonuses(learnedSkillIds: string[], skills: ProfessionSkill[]): BlacksmithSkillBonuses {
  const learned = new Set(learnedSkillIds);
  const bonuses: BlacksmithSkillBonuses = {
    craftSuccessBonus: 0,
    failureChanceReduction: 0,
    qualityBonus: 0,
    heatControlBonus: 0,
    strikePrecisionBonus: 0,
    quenchControlBonus: 0,
    minResultFloor: 0,
    unlockedActions: [],
  };

  for (const skill of skills) {
    if (skill.professionId !== 'blacksmithing' || !learned.has(skill.id)) {
      continue;
    }

    for (const effect of skill.effects ?? []) {
      const effectValue = Number(effect.value ?? 0);
      switch (effect.type) {
        case 'craft_success_bonus':
        case 'material_processing_success_bonus':
        case 'fine_work_success_bonus':
          bonuses.craftSuccessBonus += effectValue;
          break;
        case 'failure_chance_reduction':
        case 'socket_failure_chance_reduction':
          bonuses.failureChanceReduction += effectValue;
          break;
        case 'quality_bonus':
          bonuses.qualityBonus += effectValue;
          break;
        case 'insert_stability_bonus':
          bonuses.strikePrecisionBonus += effectValue;
          break;
        case 'rune_preparation_success_bonus':
        case 'socket_preparation_success_bonus':
          bonuses.quenchControlBonus += effectValue;
          break;
        case 'unlock_forge_action': {
          const action = typeof effect.params?.action === 'string' ? effect.params.action.trim() : '';
          if (action) {
            bonuses.unlockedActions.push(action);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  bonuses.unlockedActions = Array.from(new Set(bonuses.unlockedActions));
  bonuses.minResultFloor = Math.max(0, Math.round(bonuses.qualityBonus));
  return bonuses;
}

import type { AdminSkillDefinition } from '@theend/rpg-domain';

export interface BattleSkillEntry {
  skillId: string;
  level: number;
  label: string;
  definition: AdminSkillDefinition;
}

export function resolveBattleSkillEntry(
  availableSkills: BattleSkillEntry[],
  skillRef: string | null | undefined,
): BattleSkillEntry | null {
  if (!skillRef) {
    return null;
  }

  return availableSkills.find((entry) => entry.skillId === skillRef || entry.definition.id === skillRef) ?? null;
}

export function resolveBattleSkillId(
  availableSkills: BattleSkillEntry[],
  skillRef: string | null | undefined,
): string | null {
  return resolveBattleSkillEntry(availableSkills, skillRef)?.skillId ?? null;
}
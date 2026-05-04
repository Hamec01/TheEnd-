export type CharacterSkillSourceType = 'teacher' | 'academy' | 'quest' | 'book' | 'ritual' | 'admin';

export interface CharacterSkill {
  id: string;
  characterId: string;
  skillId: string;
  level: number;
  learnedAt: Date;
  sourceType: CharacterSkillSourceType;
  sourceId?: string | null;
}

export type CombatSlotType = 'ANY' | 'MAGIC' | 'PHYSICAL' | 'PASSIVE' | 'RUNE' | 'SHAMANIC';

export interface CombatSkillSlot {
  slotIndex: number;
  skillId: string | null;
  unlocked: boolean;
  slotType: CombatSlotType;
}

export interface CharacterSkillLoadout {
  characterId: string;
  slots: CombatSkillSlot[];
}

/** Slots unlocked per combat mastery level. */
export const COMBAT_MASTERY_SLOTS: Record<number, number> = {
  0: 2,
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 8,
  6: 10,
};

export function getUnlockedSlotCount(combatMastery: number): number {
  const levels = Object.keys(COMBAT_MASTERY_SLOTS)
    .map(Number)
    .sort((a, b) => b - a);
  for (const level of levels) {
    if (combatMastery >= level) {
      return COMBAT_MASTERY_SLOTS[level]!;
    }
  }
  return COMBAT_MASTERY_SLOTS[0]!;
}

export function createDefaultLoadout(combatMastery = 0): CombatSkillSlot[] {
  const total = 10;
  const unlocked = getUnlockedSlotCount(combatMastery);
  return Array.from({ length: total }, (_, index) => ({
    slotIndex: index,
    skillId: null,
    unlocked: index < unlocked,
    slotType: 'ANY' as CombatSlotType,
  }));
}

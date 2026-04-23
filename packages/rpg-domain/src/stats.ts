export const PRIMARY_STATS = [
  'hp',
  'mp',
  'stamina',
  'strength',
  'constitution',
  'dexterity',
  'intelligence',
  'luck',
  'perception',
  'willpower',
] as const;

export type PrimaryStat = (typeof PRIMARY_STATS)[number];

export type StatBlock = Record<PrimaryStat, number>;

export type StatAllocation = Partial<Record<PrimaryStat, number>>;

export const RESOURCE_STATS: PrimaryStat[] = ['hp', 'mp', 'stamina'];

export const STARTING_FREE_POINTS = 5;

export function getAllocationCost(allocation: StatAllocation): number {
  return Object.values(allocation).reduce((sum, value) => sum + Math.max(0, value ?? 0), 0);
}

export function validateAllocation(allocation: StatAllocation, freePoints = STARTING_FREE_POINTS): void {
  const values = Object.values(allocation);
  const hasNegative = values.some((value) => (value ?? 0) < 0);
  if (hasNegative) {
    throw new Error('Allocation values cannot be negative.');
  }

  const cost = getAllocationCost(allocation);
  if (cost > freePoints) {
    throw new Error(`Allocation exceeds available points (${freePoints}).`);
  }
}

export function applyAllocation(base: StatBlock, allocation: StatAllocation): StatBlock {
  validateAllocation(allocation);

  const next: StatBlock = { ...base };
  for (const stat of PRIMARY_STATS) {
    const points = allocation[stat] ?? 0;
    if (points <= 0) {
      continue;
    }

    if (stat === 'hp' || stat === 'mp' || stat === 'stamina') {
      next[stat] += points * 10;
    } else {
      next[stat] += points;
    }
  }

  return next;
}

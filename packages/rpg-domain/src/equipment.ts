import { getItemById, getItemHandsRequired, isTwoHandedItem } from './items';
import type { StatBlock } from './stats';

export interface Equipment {
  weapon: string | null;
  helmet: string | null;
  armor: string | null;
  boots: string | null;
  gloves: string | null;
  shield: string | null;
}

export const EMPTY_EQUIPMENT: Equipment = {
  weapon: null,
  helmet: null,
  armor: null,
  boots: null,
  gloves: null,
  shield: null,
};

const SLOT_BY_ITEM_TYPE: Record<string, keyof Equipment> = {
  weapon: 'weapon',
  helmet: 'helmet',
  armor: 'armor',
  boots: 'boots',
  gloves: 'gloves',
  shield: 'shield',
};

function getEquipConflictReason(equipment: Equipment, itemId: string): string | undefined {
  const item = getItemById(itemId);

  if (item.itemType === 'shield' && equipment.weapon) {
    const equippedWeapon = getItemById(equipment.weapon);
    if (isTwoHandedItem(equippedWeapon)) {
      return 'Левая рука занята двуручным оружием.';
    }
  }

  return undefined;
}

export function canEquipItem(
  baseStats: StatBlock,
  itemId: string,
  equipment?: Equipment,
): { ok: boolean; reason?: string } {
  const item = getItemById(itemId);
  if (item.itemType === 'consumable') {
    return { ok: false, reason: 'Consumables cannot be equipped.' };
  }

  for (const [stat, required] of Object.entries(item.requiredStats)) {
    const current = baseStats[stat as keyof StatBlock];
    if (required !== undefined && current < required) {
      return { ok: false, reason: `Недостаточно ${stat}: нужно ${required}` };
    }
  }

  if (equipment) {
    const conflictReason = getEquipConflictReason(equipment, itemId);
    if (conflictReason) {
      return { ok: false, reason: conflictReason };
    }
  }

  return { ok: true };
}

export function equipItem(equipment: Equipment, itemId: string): Equipment {
  const item = getItemById(itemId);
  if (item.itemType === 'consumable') {
    throw new Error('Consumables cannot be equipped.');
  }

  const conflictReason = getEquipConflictReason(equipment, itemId);
  if (conflictReason) {
    throw new Error(conflictReason);
  }

  const slot = SLOT_BY_ITEM_TYPE[item.itemType];
  if (item.itemType === 'weapon' && getItemHandsRequired(item) === 2) {
    return {
      ...equipment,
      weapon: itemId,
      shield: null,
    };
  }

  return {
    ...equipment,
    [slot]: itemId,
  };
}

export function calculateEquipmentBonuses(equipment: Equipment): Partial<StatBlock> {
  const bonus: Partial<StatBlock> = {};

  for (const itemId of Object.values(equipment)) {
    if (!itemId) {
      continue;
    }
    const item = getItemById(itemId);

    for (const [stat, value] of Object.entries(item.bonuses)) {
      const key = stat as keyof StatBlock;
      bonus[key] = (bonus[key] ?? 0) + (value ?? 0);
    }
  }

  return bonus;
}

export function getStatsWithEquipment(baseStats: StatBlock, equipment: Equipment): StatBlock {
  const bonus = calculateEquipmentBonuses(equipment);
  const next = { ...baseStats };

  for (const [stat, value] of Object.entries(bonus)) {
    const key = stat as keyof StatBlock;
    next[key] = (next[key] ?? 0) + (value ?? 0);
  }

  return next;
}

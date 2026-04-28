import { getItemById, getItemHandsRequired, isTwoHandedItem } from './items';
import type { StatBlock } from './stats';

export type EquipmentSlot = keyof Equipment;
export type HandSlot = 'weapon' | 'shield';
export type RingSlot = 'ring1' | 'ring2' | 'ring3';

export const RING_SLOTS: RingSlot[] = ['ring1', 'ring2', 'ring3'];

export interface Equipment {
  weapon: string | null;
  helmet: string | null;
  necklace: string | null;
  armor: string | null;
  outerwear: string | null;
  belt: string | null;
  ring1: string | null;
  ring2: string | null;
  ring3: string | null;
  legs: string | null;
  boots: string | null;
  gloves: string | null;
  shield: string | null;
}

export const EMPTY_EQUIPMENT: Equipment = {
  weapon: null,
  helmet: null,
  necklace: null,
  armor: null,
  outerwear: null,
  belt: null,
  ring1: null,
  ring2: null,
  ring3: null,
  legs: null,
  boots: null,
  gloves: null,
  shield: null,
};

const SLOT_BY_ITEM_TYPE: Record<string, EquipmentSlot> = {
  weapon: 'weapon',
  helmet: 'helmet',
  necklace: 'necklace',
  armor: 'armor',
  outerwear: 'outerwear',
  belt: 'belt',
  legs: 'legs',
  boots: 'boots',
  gloves: 'gloves',
  shield: 'shield',
};

function isRingSlot(slot: EquipmentSlot | undefined): slot is RingSlot {
  return slot === 'ring1' || slot === 'ring2' || slot === 'ring3';
}

function normalizeTargetSlot(itemId: string, equipment: Equipment, preferredSlot?: EquipmentSlot): EquipmentSlot | undefined {
  const item = getItemById(itemId);

  if (item.itemType === 'weapon') {
    if (getItemHandsRequired(item) === 2) {
      return 'weapon';
    }

    return preferredSlot === 'shield' ? 'shield' : 'weapon';
  }

  if (item.itemType === 'shield') {
    return 'shield';
  }

  if (item.itemType === 'ring') {
    if (isRingSlot(preferredSlot)) {
      return preferredSlot;
    }

    return RING_SLOTS.find((slot) => !equipment[slot]) ?? 'ring1';
  }

  return SLOT_BY_ITEM_TYPE[item.itemType];
}

function getEquipConflictReason(equipment: Equipment, itemId: string, preferredSlot?: EquipmentSlot): string | undefined {
  const item = getItemById(itemId);
  const targetSlot = normalizeTargetSlot(itemId, equipment, preferredSlot);

  if (!targetSlot) {
    return `Unsupported equipment slot for item type: ${item.itemType}`;
  }

  if (item.itemType === 'ring' && preferredSlot && !isRingSlot(preferredSlot)) {
    return 'Кольцо можно надеть только в один из слотов колец.';
  }

  if (item.itemType === 'weapon' && preferredSlot && preferredSlot !== 'weapon' && preferredSlot !== 'shield') {
    return 'Оружие можно надеть только в руку.';
  }

  if (item.itemType !== 'weapon' && item.itemType !== 'ring' && preferredSlot && preferredSlot !== targetSlot) {
    return 'Предмет нельзя надеть в выбранный слот.';
  }

  if (item.itemType === 'shield' && equipment.weapon) {
    const equippedWeapon = getItemById(equipment.weapon);
    if (isTwoHandedItem(equippedWeapon)) {
      return 'Левая рука занята двуручным оружием.';
    }
  }

  if (item.itemType === 'weapon' && targetSlot === 'shield' && equipment.weapon) {
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
  preferredSlot?: EquipmentSlot,
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
    const conflictReason = getEquipConflictReason(equipment, itemId, preferredSlot);
    if (conflictReason) {
      return { ok: false, reason: conflictReason };
    }
  }

  return { ok: true };
}

export function equipItem(equipment: Equipment, itemId: string, preferredHand?: HandSlot): Equipment {
  const item = getItemById(itemId);
  if (item.itemType === 'consumable') {
    throw new Error('Consumables cannot be equipped.');
  }

  const conflictReason = getEquipConflictReason(equipment, itemId, preferredHand);
  if (conflictReason) {
    throw new Error(conflictReason);
  }

  const slot = normalizeTargetSlot(itemId, equipment, preferredHand);
  if (!slot) {
    throw new Error(`Unsupported equipment slot for item type: ${item.itemType}`);
  }

  if (item.itemType === 'weapon' && getItemHandsRequired(item) === 2) {
    return {
      ...equipment,
      weapon: itemId,
      shield: null,
    };
  }

  if (item.itemType === 'ring') {
    return {
      ...equipment,
      [slot]: itemId,
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

import { getItemById, getItemHandsRequired, type Equipment, type EquipmentSlot, type ItemDefinition } from '@theend/rpg-domain';

const RING_SLOTS: Array<Extract<EquipmentSlot, 'ring1' | 'ring2' | 'ring3'>> = ['ring1', 'ring2', 'ring3'];

const DEFAULT_SLOT_BY_ITEM_TYPE: Partial<Record<ItemDefinition['itemType'], EquipmentSlot>> = {
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

export function findEquippedCoreSlot(equipment: Equipment, itemId: string): EquipmentSlot | null {
  const entry = (Object.entries(equipment) as Array<[EquipmentSlot, string | null]>).find(([, equippedItemId]) => equippedItemId === itemId);
  return entry?.[0] ?? null;
}

export function resolvePreferredEquipmentSlot(item: ItemDefinition, equipment: Equipment): EquipmentSlot | null {
  const equippedSlot = findEquippedCoreSlot(equipment, item.id);
  if (equippedSlot) {
    return equippedSlot;
  }

  if (item.itemType === 'consumable') {
    return null;
  }

  if (item.itemType === 'ring') {
    return RING_SLOTS.find((slot) => !equipment[slot]) ?? 'ring1';
  }

  if (item.itemType === 'weapon') {
    if (getItemHandsRequired(item) === 2) {
      return 'weapon';
    }

    const equippedWeapon = equipment.weapon ? getItemById(equipment.weapon) : null;
    const weaponOccupiesBothHands = Boolean(equippedWeapon && getItemHandsRequired(equippedWeapon) === 2);

    if (!equipment.weapon) {
      return 'weapon';
    }

    if (!equipment.shield && !weaponOccupiesBothHands) {
      return 'shield';
    }

    return 'weapon';
  }

  return DEFAULT_SLOT_BY_ITEM_TYPE[item.itemType] ?? null;
}
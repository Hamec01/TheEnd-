import type { Equipment } from './equipment';
import { getItemById } from './items';
import type { ItemDefinition } from './items';
import type { PrimaryStat, StatBlock } from './stats';

export interface DerivedStatLine {
  label: string;
  value: number;
}

export interface DerivedStatsResult {
  totalDefense: number;
  minDamage: number;
  maxDamage: number;
  critChance: number;
  initiative: number;
  hitChance: number;
  evasion: number;
  blockChance: number;
  physicalResistance: number;
  magicResistance: number;
  staminaLoad: number;
  defenseBreakdown: DerivedStatLine[];
  damageBreakdown: DerivedStatLine[];
  critBreakdown: DerivedStatLine[];
}

const DEFENSIVE_SLOTS: Array<keyof Equipment> = ['helmet', 'armor', 'shield', 'boots', 'gloves'];

function getSafeItemById(itemId: string): ItemDefinition | null {
  try {
    return getItemById(itemId);
  } catch {
    return null;
  }
}

function getEquippedItemIds(equipment: Equipment): string[] {
  return Object.values(equipment).filter((itemId): itemId is string => Boolean(itemId));
}

function getBonusFromEquipment(equipment: Equipment, stat: PrimaryStat): number {
  return getEquippedItemIds(equipment).reduce((sum, itemId) => {
    const item = getSafeItemById(itemId);
    if (!item) {
      return sum;
    }

    return sum + (item.bonuses[stat] ?? 0);
  }, 0);
}

function getArmorDefenseFromEquipment(equipment: Equipment): number {
  return DEFENSIVE_SLOTS.reduce((sum, slot) => {
    const itemId = equipment[slot];
    if (!itemId) {
      return sum;
    }

    const item = getSafeItemById(itemId);
    if (!item) {
      return sum;
    }

    const constitutionBonus = item.bonuses.constitution ?? 0;
    const hpBonus = item.bonuses.hp ?? 0;
    return sum + constitutionBonus + Math.floor(hpBonus / 10);
  }, 0);
}

function getShieldDefenseFromEquipment(equipment: Equipment): number {
  if (!equipment.shield) {
    return 0;
  }

  const shield = getSafeItemById(equipment.shield);
  if (!shield) {
    return 0;
  }

  return (shield.bonuses.constitution ?? 0) + Math.floor((shield.bonuses.hp ?? 0) / 10) + 1;
}

function getEquipmentDefenseBonus(equipment: Equipment): number {
  const bonusFromStats = getBonusFromEquipment(equipment, 'constitution');
  const staminaBonus = Math.floor(getBonusFromEquipment(equipment, 'stamina') / 10);
  return bonusFromStats + staminaBonus;
}

function getWeaponDamageRange(equipment: Equipment): { min: number; max: number } {
  if (!equipment.weapon) {
    return { min: 1, max: 2 };
  }

  const weapon = getSafeItemById(equipment.weapon);
  if (!weapon) {
    return { min: 1, max: 2 };
  }

  const strengthBonus = weapon.bonuses.strength ?? 0;
  const dexBonus = weapon.bonuses.dexterity ?? 0;
  const intBonus = weapon.bonuses.intelligence ?? 0;
  const baseByRarity = weapon.rarity === 'rare' ? 6 : weapon.rarity === 'uncommon' ? 4 : 3;
  const min = Math.max(1, baseByRarity + Math.floor((strengthBonus + dexBonus + intBonus) * 0.6));
  const max = Math.max(min + 1, min + 2 + Math.floor((strengthBonus + dexBonus + intBonus) * 0.4));
  return { min, max };
}

export function calculateTotalDefense(stats: StatBlock, equipment: Equipment): number {
  const constitutionPart = stats.constitution;
  const armorDefense = getArmorDefenseFromEquipment(equipment);
  const shieldDefense = getShieldDefenseFromEquipment(equipment);
  const equipmentDefense = getEquipmentDefenseBonus(equipment);
  return Math.floor(constitutionPart * 1 + armorDefense + shieldDefense + equipmentDefense);
}

export function calculateMinDamage(stats: StatBlock, equipment: Equipment): number {
  const weapon = getWeaponDamageRange(equipment);
  return Math.max(1, Math.floor(stats.strength * 0.5) + weapon.min);
}

export function calculateMaxDamage(stats: StatBlock, equipment: Equipment): number {
  const weapon = getWeaponDamageRange(equipment);
  return Math.max(calculateMinDamage(stats, equipment), Math.floor(stats.strength * 0.8) + weapon.max);
}

export function calculateCritChance(stats: StatBlock, equipment: Equipment): number {
  const luckPart = stats.luck * 0.3;
  const equipmentLuck = getBonusFromEquipment(equipment, 'luck') * 0.2;
  return Number((5 + luckPart + equipmentLuck).toFixed(1));
}

export function calculateInitiative(stats: StatBlock): number {
  return stats.perception + Math.floor(stats.dexterity * 0.5);
}

export function calculateDerivedStats(stats: StatBlock, equipment: Equipment): DerivedStatsResult {
  const totalDefense = calculateTotalDefense(stats, equipment);
  const minDamage = calculateMinDamage(stats, equipment);
  const maxDamage = calculateMaxDamage(stats, equipment);
  const critChance = calculateCritChance(stats, equipment);
  const initiative = calculateInitiative(stats);
  const hitChance = Number((65 + stats.perception * 0.9 + stats.dexterity * 0.35).toFixed(1));
  const evasion = Number((stats.dexterity * 0.85 + stats.luck * 0.25).toFixed(1));
  const blockChance = Number((stats.constitution * 0.35 + getShieldDefenseFromEquipment(equipment) * 1.8).toFixed(1));
  const physicalResistance = Number((stats.constitution * 1.2 + totalDefense * 0.35).toFixed(1));
  const magicResistance = Number((stats.willpower * 1.3 + getBonusFromEquipment(equipment, 'willpower') * 0.7).toFixed(1));
  const staminaLoad = Math.max(0, Math.round(stats.stamina * 0.15 + getArmorDefenseFromEquipment(equipment) * 0.7));

  return {
    totalDefense,
    minDamage,
    maxDamage,
    critChance,
    initiative,
    hitChance,
    evasion,
    blockChance,
    physicalResistance,
    magicResistance,
    staminaLoad,
    defenseBreakdown: [
      { label: 'Constitution', value: stats.constitution },
      { label: 'Armor', value: getArmorDefenseFromEquipment(equipment) },
      { label: 'Shield', value: getShieldDefenseFromEquipment(equipment) },
      { label: 'Equipment', value: getEquipmentDefenseBonus(equipment) },
    ],
    damageBreakdown: [
      { label: 'Strength scaling', value: Math.floor(stats.strength * 0.5) },
      { label: 'Weapon min', value: getWeaponDamageRange(equipment).min },
      { label: 'Weapon max', value: getWeaponDamageRange(equipment).max },
    ],
    critBreakdown: [
      { label: 'Base', value: 5 },
      { label: 'Luck', value: Number((stats.luck * 0.3).toFixed(1)) },
      { label: 'Equipment', value: Number((getBonusFromEquipment(equipment, 'luck') * 0.2).toFixed(1)) },
    ],
  };
}

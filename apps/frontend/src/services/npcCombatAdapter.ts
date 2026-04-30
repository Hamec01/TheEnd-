import { getNpcById } from './npcRepository';
import type { NpcDefinition } from '../types/npc';

export interface NpcCombatant {
  id: string;
  name: string;
  hp: number;
  mana: number;
  stamina: number;
  level: number;
  role: string;
  damageMin: number;
  damageMax: number;
  armor: number;
  magicResist: number;
  skillIds: string[];
  lootTableId?: string;
}

export function getNpcCombatStats(npc: NpcDefinition): NpcCombatant {
  return {
    id: npc.id,
    name: npc.name,
    hp: npc.combat?.hp ?? 100,
    mana: npc.combat?.mana ?? 0,
    stamina: npc.combat?.stamina ?? 0,
    level: npc.combat?.level ?? 1,
    role: npc.combat?.role ?? 'none',
    damageMin: npc.combat?.damageMin ?? 1,
    damageMax: npc.combat?.damageMax ?? 2,
    armor: npc.combat?.physicalArmor ?? 0,
    magicResist: npc.combat?.magicResist ?? 0,
    skillIds: npc.combat?.skillIds ?? [],
    lootTableId: npc.combat?.lootTableId ?? npc.inventory?.lootTableId,
  };
}

export function getNpcSkills(npc: NpcDefinition): string[] {
  return npc.combat?.skillIds ?? [];
}

export function getNpcLoot(npc: NpcDefinition): { itemIds: string[]; questItemIds: string[]; lootTableId?: string; goldMin?: number; goldMax?: number } {
  return {
    itemIds: npc.inventory?.itemIds ?? [],
    questItemIds: npc.inventory?.questItemIds ?? [],
    lootTableId: npc.inventory?.lootTableId ?? npc.combat?.lootTableId,
    goldMin: npc.inventory?.goldMin,
    goldMax: npc.inventory?.goldMax,
  };
}

export function createCombatantFromNpc(npcId: string): NpcCombatant {
  const npc = getNpcById(npcId);
  if (!npc) {
    throw new Error(`NPC not found: ${npcId}`);
  }
  if (!npc.canFight) {
    throw new Error(`NPC cannot fight: ${npcId}`);
  }
  return getNpcCombatStats(npc);
}

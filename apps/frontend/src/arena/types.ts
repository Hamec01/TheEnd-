import type { Equipment, InventoryState, Race, StatBlock } from '@theend/rpg-domain';

export interface ArenaCharacter {
  id: string;
  name: string;
  race: Race;
  level: number;
  exp: number;
  freePoints: number;
  baseStats: StatBlock;
  activeStats: StatBlock;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  currentStamina: number;
  maxStamina: number;
  hpRegenPerTurn?: number;
}

export interface ArenaPlayerState {
  character: ArenaCharacter;
  inventory: InventoryState;
  equipment: Equipment;
}

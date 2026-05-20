export interface MineDefinition {
  id: string;
  name: string;
  description: string;
  locationId: string;
  requiredProfessionId: string;
  requiredMiningLevel: number;
  depthCount: number;
  dangerLevel: number;
  visualTheme?: 'standard' | 'ice' | 'volcanic' | 'crystal' | 'dark';
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MineDepth {
  id: string;
  mineId: string;
  depthLevel: number;
  rows: number;
  columns: number;
  baseHits: number;
  staminaCostPerHit: number;
  lootTableId: string;
  hazardTableId: string;
  canSpawnExit: boolean;
  canSpawnPassage: boolean;
  isFinalDepth: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type BlockType = 'empty' | 'stone' | 'ore' | 'rich_ore' | 'gold' | 'gem' | 'crystal' | 'hazard' | 'passage' | 'exit' | 'event';

export interface BlockTableEntry {
  blockType: BlockType;
  weight: number;
  icon?: string;
  description?: string;
}

export interface MineBlockTable {
  id: string;
  mineId: string;
  depthLevel: number;
  entries: BlockTableEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MineHazard {
  id: string;
  name: string;
  type: 'trap' | 'collapse' | 'gas' | 'flood' | 'creature' | 'curse';
  description: string;
  hpDamageMin: number;
  hpDamageMax: number;
  staminaDamageMin: number;
  staminaDamageMax: number;
  lootLossChance: number; // 0-100%
  statusEffectIds?: string[];
  canBeReducedBySkill: boolean;
  isDeadly: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MineHazardTableEntry {
  hazardId: string;
  weight: number;
  minDepth: number;
  maxDepth: number;
}

export interface MineHazardTable {
  id: string;
  name: string;
  entries: MineHazardTableEntry[];
  createdAt?: string;
  updatedAt?: string;
}

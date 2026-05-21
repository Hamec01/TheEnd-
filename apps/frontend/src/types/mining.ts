import type { ProfessionSkillEffect } from './profession';

export type MineDangerLevel = 'low' | 'medium' | 'high' | 'deadly';

export type MineVisualTheme =
  | 'teramor_stone'
  | 'coal'
  | 'zeptyrite'
  | 'lava'
  | 'ice'
  | 'shadow'
  | 'crystal';

export interface MineDefinition {
  id: string;
  name: string;
  description: string;
  shortDescription?: string;
  requiredProfessionId: 'mining';
  requiredMiningLevel: number;
  dangerLevel: MineDangerLevel;
  visualTheme: MineVisualTheme;
  region?: string;
  depthIds: string[];
  knownResources: string[];
  entryText?: string;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MineDepth {
  id: string;
  mineId: string;
  depthLevel: number;
  name: string;
  description?: string;
  rows: number;
  columns: number;
  baseHits: number;
  staminaCostPerHit: number;
  baseCollapseRisk: number;
  riskIncreasePerHit: number;
  lootTableId: string;
  blockTableId: string;
  hazardTableId: string;
  guaranteedExit: boolean;
  canSpawnPassage: boolean;
  isFinalDepth: boolean;
  requiredMiningLevel: number;
  backgroundImage?: string;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MineBlockType =
  | 'empty'
  | 'stone'
  | 'ore'
  | 'rich_ore'
  | 'gold'
  | 'gem'
  | 'crystal'
  | 'hazard'
  | 'passage'
  | 'exit'
  | 'event';

export type MineBlockPayloadType =
  | 'loot_item'
  | 'loot_material'
  | 'hazard_ref'
  | 'event_ref'
  | 'rune_trace'
  | 'gold';

export interface MineBlockPayload {
  id?: string;
  type: MineBlockPayloadType;
  weight: number;
  itemId?: string;
  materialId?: string;
  hazardId?: string;
  eventId?: string;
  goldMin?: number;
  goldMax?: number;
  minQuantity?: number;
  maxQuantity?: number;
  minDepth?: number;
  maxDepth?: number;
  rarity?: string;
  tags?: string[];
  params?: Record<string, unknown>;
}

export interface MineBlockEntry {
  type: MineBlockType;
  weight: number;
  lootTableId?: string;
  hazardTableId?: string;
  label?: string;
  description?: string;
  payloads?: MineBlockPayload[];
}

export interface MineBlockTable {
  id: string;
  name: string;
  mineId?: string;
  depthLevel?: number;
  entries: MineBlockEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export type MineHazardType =
  | 'minor_collapse'
  | 'medium_collapse'
  | 'major_collapse'
  | 'deadly_collapse'
  | 'rockfall'
  | 'cave_in'
  | 'gas'
  | 'poison_gas'
  | 'toxic_gas'
  | 'dust'
  | 'silica_dust'
  | 'lava_crack'
  | 'fire_burst'
  | 'steam_burst'
  | 'ice_crack'
  | 'frost_pocket'
  | 'spirit'
  | 'spirit_attack'
  | 'wraith'
  | 'curse'
  | 'rune_backlash'
  | 'lost_loot';

export interface MineHazard {
  id: string;
  name: string;
  type: MineHazardType;
  description: string;
  hpDamageMin: number;
  hpDamageMax: number;
  staminaDamageMin: number;
  staminaDamageMax: number;
  lootLossChance: number;
  lootLossPercent: number;
  statusEffectIds?: string[];
  canBeReducedByConstitution: boolean;
  canBeDodgedByDexterity: boolean;
  isDeadly: boolean;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MineHazardTableEntry {
  hazardId: string;
  weight: number;
  minDepth?: number;
  maxDepth?: number;
}

export interface MineHazardTable {
  id: string;
  name: string;
  entries: MineHazardTableEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MineLootEntry {
  itemId: string;
  weight: number;
  minQuantity: number;
  maxQuantity: number;
  requiredDepth?: number;
  rarity?: string;
}

export interface MineLootTable {
  id: string;
  name: string;
  entries: MineLootEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MineLootStack {
  itemId: string;
  quantity: number;
}

export interface MineSpecialFind {
  itemId: string;
  quantity: number;
  propertyId: string;
  sourceSkillId?: string;
}

export interface MineBlockState {
  index: number;
  state: 'closed' | 'opened';
  visibleType?: MineBlockType | 'loot';
  label?: string;
  loot?: MineLootStack[];
  hazardId?: string;
}

export interface InternalMineBlockState extends MineBlockState {
  hiddenType: MineBlockType;
  hiddenLabel?: string;
  hiddenLootTableId?: string;
  hiddenHazardTableId?: string;
  hiddenPayloads?: MineBlockPayload[];
}

export interface MineRunState {
  runId: string;
  mineId: string;
  currentDepthId: string;
  currentDepthLevel: number;
  status: 'active' | 'escaped' | 'retreated' | 'failed' | 'dead';
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  remainingHits: number;
  collapseRisk: number;
  temporaryLoot: MineLootStack[];
  temporaryGold: number;
  blocks: MineBlockState[];
  foundExit: boolean;
  foundPassage: boolean;
  eventLog: string[];
  startedAt: string;
  collectedLoot?: MineLootStack[];
  awardedLoot?: MineLootStack[];
  awardedGold?: number;
  lostLoot?: MineLootStack[];
  savedBySkills?: MineLootStack[];
  savedByPorters?: MineLootStack[];
  specialFinds?: MineSpecialFind[];
  skillEffectLog?: string[];
  bonusGoldFromSellValue?: number;
  usedEffects?: Record<string, number>;
  porters?: MinePortersState;
  resultSummary?: MineRunResultSummary;
  resultLevelUp?: boolean;
}

export interface InternalMineRunState extends Omit<MineRunState, 'blocks'> {
  blocks: InternalMineBlockState[];
  earnedXp: number;
  usedEmergencyEscape: boolean;
}

export interface MinePortersState {
  enabled: boolean;
  capacityItems: number;
  capacityStacks: number;
  savedLoot: MineLootStack[];
  used: boolean;
}

export interface MineRunResultSummary {
  totalLoot: MineLootStack[];
  savedLoot: MineLootStack[];
  lostLoot: MineLootStack[];
  savedBySkills: MineLootStack[];
  savedByPorters: MineLootStack[];
  specialFinds: MineSpecialFind[];
  xpAwarded: number;
  goldAwarded: number;
  bonusGoldFromSellValue: number;
}

export interface MiningEffectContext {
  mineId?: string;
  depthLevel?: number;
  remainingHits?: number;
  mineTheme?: string;
  mineDangerLevel?: string;
  hazardType?: string;
  blockType?: string;
  lootRarity?: string;
  itemTags?: string[];
}

export interface ActiveMiningEffect extends ProfessionSkillEffect {
  skillId: string;
  skillName: string;
  runtimeKey: string;
}

export interface MiningContentBundle {
  mines: MineDefinition[];
  depths: MineDepth[];
  blockTables: MineBlockTable[];
  hazards: MineHazard[];
  hazardTables: MineHazardTable[];
  lootTables: MineLootTable[];
}

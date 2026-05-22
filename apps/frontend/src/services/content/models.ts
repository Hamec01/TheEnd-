import type { AdminSkillDefinition, PrimaryStat } from '@theend/rpg-domain';
import type { ActorBattleVisualConfig } from '@theend/rpg-domain';
import type { DialogueDefinition } from '../../types/dialogue';
import type { NpcDefinition } from '../../types/npc';
import type {
  QuestDefinition,
  QuestInteractionDefinition,
  QuestItemDefinition,
  QuestMarkerDefinition,
} from '../../types/quest';

export type StatKey = PrimaryStat;

export type ItemType = 'weapon' | 'armor' | 'potion' | 'material' | 'quest' | 'misc';

export type ItemSlot =
  | 'head'
  | 'necklace'
  | 'chest'
  | 'outerwear'
  | 'belt'
  | 'leftHand'
  | 'rightHand'
  | 'gloves'
  | 'legs'
  | 'boots'
  | 'ring'
  | 'trinket'
  | 'charm'
  | 'quick'
  | 'none';

export type HandsRequired = 1 | 2;

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'forbidden';

export type DamageCategory = 'physical' | 'elemental' | 'magic' | 'shamanic' | 'runic' | 'poison' | 'bleed' | 'true';

export type PhysicalType = 'slash' | 'pierce' | 'blunt' | 'cleave' | 'unarmed';

export type ElementType = 'fire' | 'water' | 'earth' | 'air' | 'light' | 'dark';

export type MagicSchool = 'blood' | 'death' | 'life' | 'mind' | 'illusion' | 'curse' | 'arcane';

export type ItemEffectType =
  | 'stat_bonus'
  | 'incoming_damage_modifier'
  | 'outgoing_damage_modifier'
  | 'armor_penetration'
  | 'crit_chance_modifier'
  | 'crit_damage_modifier'
  | 'crit_chance_taken_modifier'
  | 'lifesteal'
  | 'apply_status'
  | 'status_resistance'
  | 'status_immunity'
  | 'block_chance_modifier'
  | 'dodge_chance_modifier'
  | 'hit_chance_modifier'
  | 'extra_attack_chance';

export interface ItemEffect {
  type: ItemEffectType;
  stat?: StatKey;
  value?: number;
  percent?: number;
  flat?: number;
  damageCategory?: DamageCategory;
  physicalType?: PhysicalType;
  elementType?: ElementType;
  magicSchool?: MagicSchool;
  statusId?: string;
  chancePercent?: number;
  durationTurns?: number;
  trigger?: 'on_hit' | 'on_crit' | 'on_use' | 'on_turn_start' | 'on_turn_end' | 'always';
  activationContexts?: string[];
  condition?: string;
  data?: Record<string, unknown>;
}

export type ItemAugmentType = 'rune' | 'magic_stone' | 'enchantment' | 'other';

export interface ItemAugment {
  type: ItemAugmentType;
  activationContexts?: string[];
  effects?: ItemEffect[];
  tags?: string[];
}

export type ItemSocketSource = 'base' | 'blacksmith_added' | 'scripted';

export interface ItemSocket {
  id: string;
  source?: ItemSocketSource;
  isLocked?: boolean;
  allowedAugmentTypes?: ItemAugmentType[];
  activationContexts?: string[];
  socketedAugmentItemId?: string;
}

export interface SlotUpgradeCostItem {
  itemId: string;
  quantity: number;
}

export interface SlotUpgradeRules {
  minBlacksmithTier?: number;
  goldCost?: number;
  materialCosts?: SlotUpgradeCostItem[];
  successChancePercent?: number;
  failureModes?: Array<'none' | 'material_lost' | 'item_damaged' | 'slot_locked'>;
}

export interface ItemSetBonus {
  requiredPieces: number;
  effects: ItemEffect[];
  penaltyEffects?: ItemEffect[];
  description?: string;
}

export interface ItemSet {
  id: string;
  name: string;
  pieceItemIds: string[];
  bonuses: ItemSetBonus[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  imagePath?: string;
  gameplayDescription?: string;
  loreDescription?: string;
}

export interface RuneComplex {
  id: string;
  name: string;
  runeItemIds: string[];
  gameplayDescription?: string;
  loreDescription?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminItem {
  id: string;
  name: string;
  type: ItemType;
  subtype?: string;
  slot?: ItemSlot;
  handsRequired?: HandsRequired;
  rarity: ItemRarity;
  price: number;
  stackable: boolean;
  maxStack?: number;
  damageMin?: number;
  damageMax?: number;
  damageCategory?: DamageCategory;
  physicalType?: PhysicalType;
  elementType?: ElementType;
  magicSchool?: MagicSchool;
  armorValue?: number;
  /**
   * Grid-based combat targeting (cells).
   * When `attackRange` is set to > 1, the item can be used at range (bow, staff, bomb, thrown spear, etc).
   */
  attackRange?: number;
  /**
   * Optional line piercing for ranged attacks (e.g. thrown spear piercing two targets).
   */
  pierceTargets?: number;
  /**
   * Optional splash damage radius around the impact cell (e.g. bomb).
   */
  splashRadius?: number;
  /**
   * Damage multiplier for the impact cell when splash is enabled (>= 1).
   */
  splashCenterMultiplier?: number;
  /**
   * Damage multiplier for adjacent cells inside the splash radius (0..centerMultiplier).
   */
  splashOuterMultiplier?: number;
  requiredStats?: Partial<Record<StatKey, number>>;
  bonuses?: Partial<Record<StatKey, number>>;
  useEffect?: unknown;
  effects?: unknown[];
  combatEffects?: unknown[];
  equipmentEffects?: ItemEffect[];
  useEffects?: ItemEffect[];
  augment?: ItemAugment;
  augmentSlots?: ItemSocket[];
  canAddAugmentSlots?: boolean;
  maxAugmentSlots?: number;
  slotUpgradeRules?: SlotUpgradeRules;
  canHaveRuneComplex?: boolean;
  defaultRuneComplexId?: string;
  setId?: string;
  tags?: string[];
  gameplayDescription: string;
  loreDescription: string;
  imagePath?: string;
  battleVisuals?: ActorBattleVisualConfig;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MerchantType =
  | 'blacksmith'
  | 'alchemist'
  | 'general'
  | 'rune_master'
  | 'material_trader'
  | 'rare_goods'
  | 'other';

export interface MerchantItem {
  itemId: string;
  stock?: number;
  infiniteStock: boolean;
  priceOverride?: number;
  priceMultiplier?: number;
  isEnabled: boolean;
}

export interface MerchantMaterialTrade {
  materialId: string;
  buys: boolean;
  sells: boolean;
  isEnabled: boolean;
}

export interface AdminMerchant {
  id: string;
  name: string;
  city: string;
  location?: string;
  cityId?: string;
  cityLocationId?: string;
  placeType?: 'city' | 'location';
  placeId?: string;
  type: MerchantType;
  description?: string;
  portraitPath?: string;
  priceMultiplier: number;
  worldSimTrader?: boolean;
  materialTradingEnabled?: boolean;
  materialTrades?: MerchantMaterialTrade[];
  isEnabled: boolean;
  items: MerchantItem[];
  createdAt: string;
  updatedAt: string;
}

export type MaterialCategory = 'metal' | 'wood' | 'leather' | 'cloth' | 'herb' | 'stone' | 'crystal' | 'bone' | 'other';

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  region: string;
  rarity: ItemRarity;
  averageMarketPrice?: number;
  properties: string[];
  gameplayDescription: string;
  loreDescription: string;
  imagePath?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LootSourceType = 'npc' | 'monster' | 'chest' | 'region' | 'quest' | 'merchant_special';

export interface LootEntry {
  itemId: string;
  chance: number;
  minQuantity: number;
  maxQuantity: number;
  rarityWeight?: number;
  conditions?: string[];
  isEnabled: boolean;
}

export interface LootTable {
  id: string;
  name: string;
  sourceType: LootSourceType;
  sourceId?: string;
  entries: LootEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredImage {
  id: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  dataUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type AdminSkill = AdminSkillDefinition;
export type AdminDialogue = DialogueDefinition;
export type AdminNpc = NpcDefinition;
export type AdminQuest = QuestDefinition;
export type AdminQuestInteraction = QuestInteractionDefinition;
export type AdminQuestItem = QuestItemDefinition;
export type AdminQuestMarker = QuestMarkerDefinition;

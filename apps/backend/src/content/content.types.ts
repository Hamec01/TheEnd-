import type { ActorBattleVisualConfig, AdminSkillDefinition, BattleMapDefinition, PrimaryStat, VisualFxDefinition } from '@theend/rpg-domain';

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

export type ImageSheetCategory = 'materials' | 'items' | 'npcs' | 'quests' | 'ui' | 'other';

export interface ImageSheetDefinition {
  id: string;
  name: string;
  category: ImageSheetCategory;
  src: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
}

export type GameImageRef =
  | {
    type: 'image';
    src: string;
  }
  | {
    type: 'tileset';
    sheetId: string;
    frame: number;
  };

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
  /** Произвольные поля рантайма (tickDamage, damageCategory и т.д.). */
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
  /** Необязательные штрафы сета (тот же контракт ItemEffect, отдельно в UI). */
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
  imageRef?: GameImageRef;
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

export interface BlacksmithForgeTier {
  id: string;
  name: string;
  description?: string;
  tier: number;
  requiredBlacksmithLevel: number;
  requiredSkillIds: string[];
  allowedRecipeTypes: string[];
  allowedRecipeGroups: string[];
  allowedMaterialTiers: string[];
  heatControlBonus: number;
  qualityCapBonus: number;
  failureChanceReduction: number;
  moduleSlotLimits: Record<string, number>;
  visualPresetId?: string;
  isEnabled: boolean;
}

export interface BlacksmithModule {
  id: string;
  name: string;
  moduleType: string;
  tier: number;
  description?: string;
  bonuses: Record<string, number | boolean | string>;
  requiredBlacksmithLevel: number;
  requiredSkillIds: string[];
  compatibleForgeTierIds: string[];
  imageRef?: string;
  isEnabled: boolean;
}

export interface BlacksmithTool {
  id: string;
  name: string;
  toolType: string;
  tier: number;
  description?: string;
  bonuses: Record<string, number | boolean | string>;
  minResultFloor: number;
  specialRules: string[];
  imageRef?: string;
  isEnabled: boolean;
}

export interface BlacksmithQualityTier {
  id: string;
  name: string;
  minScore: number;
  maxScore: number;
  priceMultiplier: number;
  xpMultiplier: number;
  statMultiplier: number;
  frameImageRef?: string;
  isFailureTier: boolean;
}

export interface BlacksmithVisualPreset {
  id: string;
  name: string;
  backgroundImageRef?: string;
  anvilImageRef?: string;
  furnaceImageRef?: string;
  hammerImageRefs: string[];
  defectOverlayRefs: string[];
  blankImageRefs: string[];
  qualityFrameRefs: string[];
}

export interface BlacksmithBalance {
  id: string;
  baseXpByRecipeType: Record<string, number>;
  xpByMaterialTier: Record<string, number>;
  qualityBonuses: Record<string, number>;
  qualityPenalties: Record<string, number>;
  repeatCraftDiminishingReturns: {
    startAfter: number;
    floorMultiplier: number;
    decayPerCraft: number;
  };
  heatRanges: Record<string, { min: number; max: number }>;
  baseDefectChances: Record<string, number>;
  quenchProfiles: Record<string, Record<string, number>>;
  strikeProfiles: Record<string, Record<string, number>>;
  finishProfiles: Record<string, Record<string, number>>;
}

export interface BlacksmithTemplateMaterialSlot {
  id: string;
  label: string;
  role: MaterialCraftingRole;
  required: boolean;
  quantity: number;
}

export interface BlacksmithItemTemplate {
  id: string;
  name: string;
  description?: string;
  itemType: 'weapon' | 'armor';
  subtype?: string;
  slot?: ItemSlot;
  handsRequired?: 1 | 2;
  baseDamageMin?: number;
  baseDamageMax?: number;
  baseArmorValue?: number;
  damageCategory?: DamageCategory;
  physicalType?: PhysicalType;
  attackRange?: number;
  requiredRoles: BlacksmithTemplateMaterialSlot[];
  optionalRoles?: BlacksmithTemplateMaterialSlot[];
  allowedMainMaterialRoles?: MaterialCraftingRole[];
  allowedMaterialTiers?: string[];
  baseMaxAugmentSlots?: number;
  canAddAugmentSlots?: boolean;
  canHaveRuneComplex?: boolean;
  requiredBlacksmithLevel?: number;
  requiredSkillIds?: string[];
  tags?: string[];
  imageRef?: GameImageRef;
  isEnabled: boolean;
}

export interface BlacksmithItemWorkAction {
  id: string;
  name: string;
  description?: string;
  actionType:
    | 'improve_stats'
    | 'add_socket'
    | 'temporary_buff'
    | 'reforge'
    | 'rebalance'
    | 'reinforce'
    | 'dismantle'
    | 'prepare_for_rune'
    | 'prepare_for_magic_stone';
  allowedItemTypes: ItemType[];
  allowedSubtypes?: string[];
  requiredBlacksmithLevel?: number;
  requiredSkillIds?: string[];
  materialCosts?: CraftingMaterialStack[];
  itemCosts?: CraftingItemStack[];
  goldCost?: number;
  baseDifficulty: number;
  risk: number;
  effects?: ItemEffect[];
  statMultiplierDelta?: number;
  addSocketRules?: {
    allowedAugmentTypes?: ItemAugmentType[];
    source: 'blacksmith_added';
  };
  isEnabled: boolean;
}

export type RecipeVisualMaterialFamily =
  | 'metal'
  | 'wood'
  | 'cloth'
  | 'leather'
  | 'food'
  | 'alchemy'
  | 'rune'
  | 'alloy'
  | 'generic';

export type RecipeVisualStyle =
  | 'smelting'
  | 'processing'
  | 'forging'
  | 'cooking'
  | 'alchemy'
  | 'refinement';

export interface RecipeVisualProfile {
  id: string;
  name: string;
  description?: string;
  recipeTypes: string[];
  materialFamilies: RecipeVisualMaterialFamily[];
  coverImageRef?: string;
  iconImageRef?: string;
  animationImageRef?: string;
  backgroundStyle?: string;
  accentColor?: string;
  isEnabled: boolean;
}

export type CraftingRecipeStatus = 'draft' | 'active' | 'disabled' | 'archived';

export type CraftingRecipeType =
  | 'material_processing'
  | 'smelting'
  | 'grinding'
  | 'cutting'
  | 'tanning'
  | 'weaving'
  | 'cooking'
  | 'baking'
  | 'alchemy'
  | 'jewelcrafting'
  | 'blacksmith_craft'
  | 'carpentry_craft'
  | 'leatherworking_craft'
  | 'runecrafting'
  | 'rune_identification'
  | 'enchantment'
  | 'add_socket'
  | 'temporary_item_buff'
  | 'permanent_item_upgrade'
  | 'dismantling';

export type CraftingProfessionId =
  | 'mining'
  | 'blacksmithing'
  | 'carpentry'
  | 'leatherworking'
  | 'jewelcrafting'
  | 'runecrafting'
  | 'fishing'
  | 'cooking'
  | 'hunting'
  | 'alchemy'
  | 'herbalism';

export type CraftingStationType =
  | 'none'
  | 'forge'
  | 'furnace'
  | 'anvil'
  | 'workbench'
  | 'sawmill'
  | 'tanning_rack'
  | 'cooking_fire'
  | 'oven'
  | 'cauldron'
  | 'alchemy_table'
  | 'jewelcrafting_table'
  | 'rune_table'
  | 'enchanting_table'
  | 'drying_rack'
  | 'fishing_spot'
  | 'hunting_camp'
  | 'millstone';

export type CraftingFailureMode =
  | 'none'
  | 'lose_inputs'
  | 'lose_partial_inputs'
  | 'damaged_item'
  | 'cursed_result'
  | 'random_lower_quality';

export type CraftingRecipeResultMode = 'fixed' | 'random_from_pool';

export interface CraftingMaterialStack {
  materialId: string;
  quantity: number;
}

export interface CraftingItemStack {
  itemId: string;
  quantity: number;
  consume?: boolean;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description?: string;
  status: CraftingRecipeStatus;
  recipeType: CraftingRecipeType;
  professionId: CraftingProfessionId | string;
  stationType: CraftingStationType;
  requiredProfessionLevel?: number;
  requiredSkillIds?: string[];
  requiredBlueprintItemId?: string;
  requiredQuestId?: string;
  inputMaterials: CraftingMaterialStack[];
  inputItems: CraftingItemStack[];
  outputMaterials: CraftingMaterialStack[];
  outputItems: CraftingItemStack[];
  resultMode?: CraftingRecipeResultMode;
  resultPoolId?: string;
  goldCost?: number;
  staminaCost?: number;
  timeSeconds?: number;
  successChance?: number;
  failureMode?: CraftingFailureMode;
  isRepeatable?: boolean;
  isEnabled?: boolean;
  tags?: string[];
  visualProfileId?: string;
  visualImageRef?: string;
  visualIconRef?: string;
  visualAnimationRef?: string | null;
  visualMaterialFamily?: RecipeVisualMaterialFamily;
  visualStyle?: RecipeVisualStyle;
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
  // Legacy effect fields are kept as-is for backwards compatibility.
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
  isDroppable?: boolean;
  isQuestItem?: boolean;
  isBound?: boolean;
  isStarterItem?: boolean;
  dropOnPvpDeath?: boolean;
  gameplayDescription: string;
  loreDescription: string;
  imagePath?: string;
  imageRef?: GameImageRef;
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
  cityId?: string;
  cityLocationId?: string;
  location?: string;
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

export const MATERIAL_PROPERTY_TAGS = [
  'alchemy',
  'alloy',
  'alloy_component',
  'amplification',
  'amplifier',
  'ancient',
  'aquarion',
  'armor',
  'armor_part',
  'artifact',
  'ash',
  'astarion',
  'astarion_related',
  'baking',
  'basic',
  'bind',
  'black_flame',
  'blacksmithing',
  'blood',
  'blue',
  'blue_metal',
  'building',
  'chain',
  'caravan',
  'ceremonial',
  'coal',
  'construction',
  'cooking',
  'corrosion_resistant',
  'cracked',
  'crafting',
  'crystal',
  'curse',
  'dangerous',
  'dark',
  'death',
  'demon',
  'dense',
  'desert',
  'document',
  'dust',
  'dwarf',
  'dwarf_engineering',
  'earth',
  'engineering',
  'epic',
  'felendar',
  'feralas',
  'fire',
  'fire_core',
  'fire_resistant',
  'flint',
  'flux',
  'flour_source',
  'focus',
  'food',
  'forbidden',
  'forbidden_component',
  'fragment',
  'fuel',
  'full_rune',
  'gem',
  'glass_tree',
  'glowing',
  'gold',
  'golemcraft',
  'grain',
  'gravity',
  'gravity_core',
  'green',
  'green_metal',
  'healing',
  'heat',
  'heat_storage',
  'heavy',
  'heavy_metal',
  'herb',
  'hot_burning',
  'ice',
  'ice_core',
  'illusion',
  'ingot',
  'ingredient',
  'ink',
  'jewelcrafting',
  'kelerite',
  'leather',
  'legendary',
  'life',
  'light',
  'living_vein',
  'lumeare',
  'luminium',
  'lunaan',
  'magic_stone_raw',
  'magic_weapon',
  'mana_storage',
  'mechanism',
  'medicine',
  'metal',
  'meteor',
  'military_supply',
  'mining',
  'miridian',
  'moss_trace',
  'mythic',
  'nature',
  'night',
  'no_porter_save',
  'nocturna',
  'obsidian',
  'ocean',
  'oil',
  'orcish',
  'ore',
  'plate',
  'poison',
  'preservation',
  'preserved_food',
  'pure',
  'pure_core',
  'pure_vein',
  'purification',
  'quest',
  'rare',
  'rare_mineral',
  'rare_trade',
  'refined',
  'ration',
  'requires_identification',
  'resonance',
  'rich',
  'ritual',
  'rivet',
  'rune',
  'rune_candidate',
  'rune_complex',
  'rune_component',
  'rune_stabilizer',
  'runecrafting',
  'salt',
  'shadow',
  'shamanic',
  'shape_memory',
  'sharp',
  'silver',
  'slag',
  'soft',
  'solarite',
  'soul',
  'soulbound',
  'spirit',
  'stabilize',
  'stone',
  'sulfur',
  'sun',
  'support',
  'technology',
  'tempered',
  'terragons_trace',
  'textile',
  'tool',
  'tool_part',
  'trace',
  'trade',
  'trade_good',
  'transforming_weapon',
  'unidentified',
  'utility',
  'verdantin',
  'vintarion',
  'volatile',
  'volcanic',
  'water',
  'water_reflection',
  'weak',
  'weapon_part',
  'wind',
  'wire',
  'wood',
  'zeptyrite',
] as const;

export type MaterialPropertyTag = (typeof MATERIAL_PROPERTY_TAGS)[number];

export type MaterialPropertyKeyValuePrefix = 'origin' | 'demand' | 'depth' | 'recommended_mine';

export type MaterialProperty =
  | MaterialPropertyTag
  | `${MaterialPropertyKeyValuePrefix}:${string}`;

export type MaterialCraftingRole =
  | 'ore'
  | 'ingot'
  | 'main_metal'
  | 'alloy_component'
  | 'fuel'
  | 'flux'
  | 'wood'
  | 'handle'
  | 'leather'
  | 'cloth'
  | 'thread'
  | 'bone'
  | 'crystal'
  | 'gem'
  | 'herb'
  | 'mushroom'
  | 'liquid'
  | 'oil'
  | 'quench_liquid'
  | 'poison'
  | 'medicine'
  | 'food'
  | 'spice'
  | 'rune_dust'
  | 'rune_fragment'
  | 'rune_stone'
  | 'ritual_component'
  | 'monster_part'
  | 'demon_part'
  | 'essence'
  | 'ash'
  | 'salt'
  | 'ink'
  | 'wax'
  | 'resin';

export interface MaterialPhysicalProperties {
  hardness?: number;
  flexibility?: number;
  density?: number;
  weight?: number;
  sharpnessPotential?: number;
  durability?: number;
  corrosionResistance?: number;
  heatResistance?: number;
  coldResistance?: number;
  conductivity?: number;
  fragility?: number;
  elasticity?: number;
}

export interface MaterialElementalProperties {
  firePower?: number;
  waterPower?: number;
  earthPower?: number;
  airPower?: number;
  lightPower?: number;
  darkPower?: number;
}

export interface MaterialMagicalProperties {
  magicPower?: number;
  manaConductivity?: number;
  spellAmplification?: number;
  curseAffinity?: number;
  spiritAffinity?: number;
  demonAffinity?: number;
  necroticAffinity?: number;
  holyAffinity?: number;
}

export interface MaterialAlchemyProperties {
  healingPower?: number;
  poisonPower?: number;
  stimulantPower?: number;
  sedativePower?: number;
  painkillerPower?: number;
  regenerationPower?: number;
  visionPower?: number;
  manaPower?: number;
  bloodEffect?: number;
  toxicity?: number;
  addictionRisk?: number;
}

export interface MaterialBlacksmithProperties {
  canBeMainMaterial?: boolean;
  canBeAlloy?: boolean;
  canBeHandle?: boolean;
  canBeBinding?: boolean;
  canBeQuench?: boolean;
  canBeCatalyst?: boolean;
  damageMultiplier?: number;
  armorMultiplier?: number;
  valueMultiplier?: number;
  weightMultiplier?: number;
  heatDifficulty?: number;
  defectRisk?: number;
  qualityBonus?: number;
  maxQualityBonus?: number;
  allowedTemplateIds?: string[];
  preferredTemplateIds?: string[];
  bonusEffects?: ItemEffect[];
  tags?: string[];
}

export interface MaterialRunicProperties {
  runePower?: number;
  instability?: number;
  soulRisk?: number;
  bloodCost?: number;
  memoryCost?: number;
  corruptionRisk?: number;
  canContainSpirit?: boolean;
  canContainDemon?: boolean;
  canBindToItem?: boolean;
  compatibleRuneIds?: string[];
  forbiddenRuneIds?: string[];
}

export interface MaterialEconomicProperties {
  baseDemand?: number;
  militaryDemand?: number;
  foodDemand?: number;
  luxuryValue?: number;
  illegalValue?: number;
  exportValue?: number;
}

export interface MaterialCraftingProperties {
  roles?: MaterialCraftingRole[];
  professions?: string[];
  tier?: string;
  rarityPower?: number;
  tags?: string[];
  physical?: MaterialPhysicalProperties;
  elemental?: MaterialElementalProperties;
  magical?: MaterialMagicalProperties;
  alchemy?: MaterialAlchemyProperties;
  blacksmith?: MaterialBlacksmithProperties;
  runic?: MaterialRunicProperties;
  economic?: MaterialEconomicProperties;
}

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  region: string;
  rarity: ItemRarity;
  properties: MaterialProperty[];
  averageMarketPrice?: number;
  gameplayDescription: string;
  loreDescription: string;
  craftingProperties?: MaterialCraftingProperties;
  imagePath?: string;
  imageRef?: GameImageRef;
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

export interface DialogueDefinition {
  id: string;
  title: string;
  npcId?: string;
  status: 'draft' | 'active' | 'disabled';
  description?: string;
  startNodeId: string;
  introVoiceAssetId?: string;
  introMusicAssetId?: string;
  nodes: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  title?: string;
  status: 'draft' | 'active' | 'disabled' | 'archived';
  kind: string;
  race: string;
  description?: string;
  cityId?: string;
  locationId?: string;
  currentCityId?: string;
  homeCityId?: string;
  cityLocationId?: string;
  canTrade?: boolean;
  traderId?: string;
  dialogueId?: string;
  portraitUrl?: string;
  portraitImageRef?: GameImageRef;
  fullImageUrl?: string;
  fullImageRef?: GameImageRef;
  combatImageUrl?: string;
  combatImageRef?: GameImageRef;
  iconUrl?: string;
  iconImageRef?: GameImageRef;
  battleSpriteAssetId?: string;
  deathEffectId?: string;
  hitEffectPreset?: string;
  dialogueStartVoiceAssetId?: string;
  dialogueStartLine?: string;
  voiceProfileId?: string;
  worldSimTrader?: boolean;
  mapBindings?: unknown[];
  dialogues?: unknown[];
  questBindings?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestItemDefinition {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  iconImageRef?: GameImageRef;
  imageUrl?: string;
  imageRef?: GameImageRef;
  linkedQuestId?: string;
  canDrop: boolean;
  canSell: boolean;
  canTrade: boolean;
  removeOnQuestComplete: boolean;
  showInQuestInventory: boolean;
}

export interface QuestMarkerDefinition {
  id: string;
  mapId: string;
  x: number;
  y: number;
  type: string;
  title: string;
  linkedQuestId?: string;
  linkedStepId?: string;
  linkedObjectiveId?: string;
  linkedNpcId?: string;
  icon?: string;
  iconImageRef?: GameImageRef;
  visibleToPlayer: boolean;
  conditionIds: string[];
  imageUrl?: string;
  imageRef?: GameImageRef;
  isActive?: boolean;
  requirements?: QuestInteractionRequirement[];
  hideAfterQuestCompleted?: boolean;
  hideAfterObjectiveCompleted?: boolean;
  hideAfterStepCompleted?: boolean;
  showOnWorldMap?: boolean;
  showOnMiniMap?: boolean;
  worldMapVisibility?: 'always' | 'nearby' | 'selectedQuestOnly' | 'discoveredOnly' | 'hidden';
  miniMapVisibility?: 'always' | 'nearby' | 'selectedQuestOnly' | 'discoveredOnly' | 'hidden';
}

export type QuestInteractionRequirementType =
  | 'quest_not_started'
  | 'quest_active'
  | 'quest_completed'
  | 'quest_failed'
  | 'objective_completed'
  | 'objective_not_completed'
  | 'step_completed'
  | 'step_not_completed'
  | 'has_item'
  | 'missing_item'
  | 'has_quest_item'
  | 'missing_quest_item'
  | 'has_skill'
  | 'missing_skill'
  | 'has_flag'
  | 'flag_equals'
  | 'race_is'
  | 'class_is'
  | 'level_min'
  | 'level_max'
  | 'faction_relation_min';

export interface QuestInteractionRequirement {
  type: QuestInteractionRequirementType;
  questId?: string;
  objectiveId?: string;
  stepId?: string;
  itemId?: string;
  questItemId?: string;
  skillId?: string;
  flagKey?: string;
  value?: unknown;
  raceId?: string;
  classId?: string;
  factionId?: string;
  amount?: number;
}

export type QuestInteractionEffectType =
  | 'complete_objective'
  | 'complete_step'
  | 'complete_quest'
  | 'start_quest'
  | 'fail_quest'
  | 'give_rewards'
  | 'add_reputation'
  | 'change_citizenship'
  | 'give_item'
  | 'take_item'
  | 'give_quest_item'
  | 'take_quest_item'
  | 'give_skill'
  | 'give_gold'
  | 'give_experience'
  | 'set_flag'
  | 'unlock_location'
  | 'unlock_dialogue'
  | 'open_dialogue'
  | 'open_shop'
  | 'start_combat';

export interface QuestInteractionEffect {
  type: QuestInteractionEffectType;
  questId?: string;
  objectiveId?: string;
  stepId?: string;
  itemId?: string;
  questItemId?: string;
  skillId?: string;
  dialogueId?: string;
  locationId?: string;
  shopId?: string;
  enemyId?: string;
  flagKey?: string;
  value?: unknown;
  amount?: number;
  factionId?: string;
  kingdomId?: string;
  reputationChanges?: Array<{
    factionId?: string;
    kingdomId?: string;
    amount: number;
  }>;
}

export interface QuestInteractionChoice {
  id: string;
  text: string;
  resultText?: string;
  imageId?: string;
  requirements?: QuestInteractionRequirement[];
  effects?: QuestInteractionEffect[];
  close?: boolean;

  // Legacy compatibility fields.
  completeObjectiveId?: string;
  completeStepId?: string;
  completeQuest?: boolean;
  giveRewards?: boolean;
  nextQuestId?: string;
  startQuestId?: string;
  setFlag?: {
    key: string;
    value: unknown;
  };
}

export interface QuestInteractionDefinition {
  id: string;
  title: string;
  triggerType:
    | 'zone_inspect'
    | 'zone_enter'
    | 'marker_reached'
    | 'object_interact'
    | 'item_use'
    | 'npc_interact'
    | 'manual';
  zoneId?: string;
  markerId?: string;
  objectId?: string;
  itemId?: string;
  npcId?: string;
  questId?: string;
  stepId?: string;
  objectiveId?: string;
  text: string;
  imageId?: string;
  choices: QuestInteractionChoice[];
  isActive?: boolean;
  requirements?: QuestInteractionRequirement[];
  blockedEntryDialogueId?: string;
  blockedEntryNpcId?: string;
  blockedEntryMessage?: string;
  consumeOnUse?: boolean;
  hideAfterQuestCompleted?: boolean;
  hideAfterObjectiveCompleted?: boolean;
  hideAfterStepCompleted?: boolean;

  // Legacy compatibility fields.
  requiredQuestId?: string;
  requiredQuestStatus?: 'active' | 'completed' | 'failed';
  requiredObjectiveId?: string;
  requiredItemId?: string;
  requiredQuestItemId?: string;
}

export interface QuestDefinition {
  id: string;
  title: string;
  adminDescription?: string;
  playerDescription?: string;
  category: string;
  status: 'draft' | 'active' | 'disabled' | 'archived';
  kingdomId?: string;
  factionId?: string;
  cityId?: string;
  npcId?: string;
  recommendedLevel?: number;
  minLevel?: number;
  maxLevel?: number;
  isRepeatable: boolean;
  isHidden: boolean;
  portraitUrl?: string;
  portraitImageRef?: GameImageRef;
  imageUrl?: string;
  imageRef?: GameImageRef;
  bannerUrl?: string;
  steps: unknown[];
  triggers: unknown[];
  conditions: unknown[];
  rewards: unknown[];
  failureConsequences: unknown[];
  flags?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ZoneShape = 'circle' | 'polygon' | 'rect';

export type ZoneType =
  | 'city'
  | 'settlement'
  | 'quest'
  | 'quest_area'
  | 'random_event_area'
  | 'danger_area'
  | 'faction_area'
  | 'kingdom_area'
  | 'city_area'
  | 'resource_area'
  | 'hidden_area'
  | 'story'
  | 'landmark'
  | 'danger'
  | 'grind'
  | 'resource'
  | 'profession'
  | 'dungeon'
  | 'transition'
  | 'safe'
  | 'event'
  | 'faction'
  | 'locked'
  | 'fast_travel'
  | 'rest';

export type MapEditorLayer = 'areas' | 'locations' | 'quests' | 'resources' | 'zones';

export type ZoneInteractionMode =
  | 'none'
  | 'inspect'
  | 'enter'
  | 'quest'
  | 'resource'
  | 'battle'
  | 'random_event'
  | 'danger'
  | 'transition'
  | 'fast_travel'
  | 'rest'
  | 'locked';

export type RegionType = 'walkable' | 'blocked' | 'water' | 'swamp' | 'sand' | 'road' | 'danger' | 'trigger';

export interface RegionCell {
  x: number;
  y: number;
}

export interface PaintedRegion {
  id: string;
  name: string;
  type: RegionType;
  description?: string;
  cells: RegionCell[];
}

export interface WorldMapZone {
  id: string;
  name: string;
  type: ZoneType;
  shape: ZoneShape;
  x?: number;
  y?: number;
  radius?: number;
  points?: [number, number][];
  region?: string;
  faction?: string;
  description: string;
  tooltip?: string;
  dangerLevel: number;
  recommendedLevel?: number;
  requiredLevel?: number;
  requiredQuestId?: string;
  requiredItemId?: string;
  requiredQuestItemId?: string;
  requiredFaction?: string;
  blockedEntryDialogueId?: string;
  blockedEntryNpcId?: string;
  blockedEntryMessage?: string;
  targetScene?: string;
  isDiscovered: boolean;
  isVisibleToPlayer: boolean;
  isSafeZone?: boolean;
  allowPvP?: boolean;
  enemyTableId?: string;
  resourceTableId?: string;
  resourceKind?: 'mine' | 'grove' | 'herb_patch' | 'fishing_spot' | 'hunting_ground' | 'other';
  mineId?: string;
  professionId?: string;
  respawnSeconds?: number;
  cooldownSeconds?: number;
  editorLayer?: MapEditorLayer;
  interactionMode?: ZoneInteractionMode;
  playerClickable?: boolean;
  blocksClick?: boolean;
  passiveEffects?: boolean;
  color?: string;
  parentAreaId?: string;
  subtype?: string;
  currentState?: string;
  hidden?: boolean;
  requiresDiscovery?: boolean;
  linkedLocationId?: string;
  linkedLocation?: string;
  locationSprite?: {
    imageUrl: string;
    assetKey?: string;
    visibleOnWorldMap: boolean;
    visibleInLocationView: boolean;
    anchor: 'center' | 'bottom';
    offsetX: number;
    offsetY: number;
    scale: number;
    zIndex: number;
  };
  stateSprites?: Partial<Record<'active' | 'hidden' | 'destroyed' | 'restored' | 'captured' | 'locked', string>>;
  music?: AudioCueConfig;
  ambientSound?: AudioCueConfig;
  createdAt: number;
  updatedAt: number;
}

export interface WorldMapContent {
  zones: WorldMapZone[];
  regions: PaintedRegion[];
  questMarkers?: QuestMarkerDefinition[];
  updatedAt: string;
}

export type CityStatus = 'active' | 'ruined' | 'occupied' | 'hidden' | 'locked';

export type CityLocationType =
  | 'gate'
  | 'tavern'
  | 'market'
  | 'blacksmith'
  | 'castle'
  | 'temple'
  | 'arena'
  | 'guild'
  | 'district'
  | 'harbor'
  | 'barracks'
  | 'house'
  | 'dungeon'
  | 'custom';

export type CityLocationShapeType = 'circle' | 'rectangle' | 'polygon';

export interface CityLocationShape {
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
}

export type CityLocationEncounterKind = 'arena' | 'quest' | 'event' | 'dungeon' | 'ambush';

export interface CityLocationEncounterPreset {
  id: string;
  label: string;
  type: 'pve' | 'pvp' | 'random' | 'scripted';
  battleMapId?: string;
  enemyCount?: number;
  playerTurnSeconds?: number;
  notes?: string;
}

export interface CityLocationEncounterConfig {
  kind: CityLocationEncounterKind;
  arenaMasterNpcId?: string;
  battleMapIds?: string[];
  presets?: CityLocationEncounterPreset[];
  allowPvE?: boolean;
  allowPvP?: boolean;
  allowRandomEnemyGeneration?: boolean;
}

export interface CityLocationAutoTrigger {
  npcId: string;
  dialogueId: string;
  condition?: string;
  once?: boolean;
}

export interface CityRacePopulation {
  raceId: string;
  count?: number;
  percent?: number;
  role?: string;
}

export interface AudioCueConfig {
  assetId?: string;
  url?: string;
  volume?: number;
  loop?: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  subtitle?: string;
}

export interface CityLocation {
  id: string;
  cityId: string;
  name: string;
  type: CityLocationType;
  description?: string;
  imageId?: string;
  shapeType: CityLocationShapeType;
  shape: CityLocationShape;
  npcIds: string[];
  autoTriggers?: CityLocationAutoTrigger[];
  questIds: string[];
  shopIds: string[];
  isVisible: boolean;
  isUnlocked: boolean;
  unlockCondition?: string;
  markerIcon?: string;
  linkedBattleMapId?: string;
  encounter?: CityLocationEncounterConfig;
  music?: AudioCueConfig;
  ambientSound?: AudioCueConfig;
}

export interface City {
  id: string;
  name: string;
  slug?: string;
  kingdomId: string;
  regionId?: string;
  worldZoneId?: string;
  status: CityStatus;
  ownerFactionId?: string;
  hostileToPlayer?: boolean;
  entryRequirement?: string;
  shortDescription: string;
  fullDescription: string;
  history?: string;
  loreNotes?: string;
  populationTotal?: number;
  racePopulation: CityRacePopulation[];
  rulerNpcId?: string;
  rulerName?: string;
  rulerTitle?: string;
  governmentType?: string;
  economyTags: string[];
  cultureTags: string[];
  dangerLevel?: number;
  recommendedLevel?: number;
  climate?: string;
  visualTheme?: string;
  backgroundImageId?: string;
  backgroundImageUrl?: string;
  thumbnailImageId?: string;
  music?: AudioCueConfig;
  ambientSound?: AudioCueConfig;
  locations: CityLocation[];
  connectedCityIds?: string[];
  connectedZoneIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentDatabase {
  version: 1;
  items: AdminItem[];
  skills: AdminSkillDefinition[];
  visualFx: VisualFxDefinition[];
  merchants: AdminMerchant[];
  cities: City[];
  locations: WorldLocation[];
  materials: Material[];
  lootTables: LootTable[];
  images: StoredImage[];
  dialogues: DialogueDefinition[];
  npcs: NpcDefinition[];
  quests: QuestDefinition[];
  questInteractions: QuestInteractionDefinition[];
  questItems: QuestItemDefinition[];
  questMarkers: QuestMarkerDefinition[];
  battleMaps: BattleMapDefinition[];
  craftingRecipes?: CraftingRecipe[];
  recipeVisualProfiles?: RecipeVisualProfile[];
  itemSets?: ItemSet[];
  runeComplexes?: RuneComplex[];
  blacksmithForgeTiers?: BlacksmithForgeTier[];
  blacksmithModules?: BlacksmithModule[];
  blacksmithTools?: BlacksmithTool[];
  blacksmithQualityTiers?: BlacksmithQualityTier[];
  blacksmithVisualPresets?: BlacksmithVisualPreset[];
  blacksmithBalance?: BlacksmithBalance[];
  blacksmithItemTemplates?: BlacksmithItemTemplate[];
  blacksmithItemWorkActions?: BlacksmithItemWorkAction[];
  worldMap: WorldMapContent;
}

export type ContentImportMode = 'replace' | 'merge' | 'dryRun' | 'add_missing_only';

export interface ContentBackupMetadata {
  schemaVersion: number;
  game: 'TheEnd';
  exportedAt: string;
  exportedBy: 'admin';
  appEnv?: string;
  gitCommit?: string;
  contentCounts: Record<string, number>;
}

export interface ContentBackupEnvelope {
  schemaVersion: number;
  game: 'TheEnd';
  exportedAt: string;
  exportedBy: 'admin';
  appEnv?: string;
  gitCommit?: string;
  contentCounts: Record<string, number>;
  content: ContentDatabase;
}

export interface ContentImportResult {
  mode: ContentImportMode;
  dryRun: boolean;
  snapshot: ContentDatabase;
  warnings: string[];
  errors: string[];
  summary?: {
    created: number;
    updated: number;
    skippedExisting: number;
  };
  actions?: Record<string, {
    createMissing: string[];
    skippedExisting: string[];
  }>;
}

export interface ContentAutosaveFileInfo {
  slot: number;
  fileName: string;
  updatedAt?: string;
}

export interface ContentAutosaveStatus {
  enabled: boolean;
  intervalMs: number;
  slotCount: number;
  currentSlot: number;
  lastSavedAt?: string;
  nextScheduledAt?: string;
  lastError?: string;
  files: ContentAutosaveFileInfo[];
}

export type ContentCollectionName =
  | 'items'
  | 'skills'
  | 'visualFx'
  | 'merchants'
  | 'cities'
  | 'locations'
  | 'materials'
  | 'lootTables'
  | 'images'
  | 'dialogues'
  | 'npcs'
  | 'quests'
  | 'questInteractions'
  | 'questItems'
  | 'questMarkers'
  | 'battleMaps'
  | 'craftingRecipes'
  | 'recipeVisualProfiles'
  | 'itemSets'
  | 'runeComplexes'
  | 'blacksmithForgeTiers'
  | 'blacksmithModules'
  | 'blacksmithTools'
  | 'blacksmithQualityTiers'
  | 'blacksmithVisualPresets'
  | 'blacksmithBalance'
  | 'blacksmithItemTemplates'
  | 'blacksmithItemWorkActions';

export interface ContentCollectionMap {
  items: AdminItem;
  skills: AdminSkillDefinition;
  visualFx: VisualFxDefinition;
  merchants: AdminMerchant;
  cities: City;
  locations: WorldLocation;
  materials: Material;
  lootTables: LootTable;
  images: StoredImage;
  dialogues: DialogueDefinition;
  npcs: NpcDefinition;
  quests: QuestDefinition;
  questInteractions: QuestInteractionDefinition;
  questItems: QuestItemDefinition;
  questMarkers: QuestMarkerDefinition;
  battleMaps: BattleMapDefinition;
  craftingRecipes: CraftingRecipe;
  recipeVisualProfiles: RecipeVisualProfile;
  itemSets: ItemSet;
  runeComplexes: RuneComplex;
  blacksmithForgeTiers: BlacksmithForgeTier;
  blacksmithModules: BlacksmithModule;
  blacksmithTools: BlacksmithTool;
  blacksmithQualityTiers: BlacksmithQualityTier;
  blacksmithVisualPresets: BlacksmithVisualPreset;
  blacksmithBalance: BlacksmithBalance;
  blacksmithItemTemplates: BlacksmithItemTemplate;
  blacksmithItemWorkActions: BlacksmithItemWorkAction;
}

export type LocationStatus = 'draft' | 'active' | 'disabled' | 'archived';

export type LocationSubtype =
  | 'village'
  | 'academy'
  | 'magic_school'
  | 'mine_entrance'
  | 'camp'
  | 'cult_camp'
  | 'farmstead'
  | 'fort'
  | 'destroyed_village'
  | 'restored_village'
  | 'oasis'
  | 'market'
  | 'harbor'
  | 'sanctuary'
  | 'ruins'
  | 'cave'
  | 'mine'
  | 'outpost'
  | 'hideout'
  | 'temple'
  | 'tower'
  | 'forest'
  | 'grove'
  | 'graveyard'
  | 'battlefield'
  | 'ritual_place'
  | 'forge'
  | 'shrine'
  | 'farm'
  | 'crossroad'
  | 'custom';

export interface LocationStateVariant {
  stateKey: string;
  name: string;
  descriptionOverride?: string;
  imageId?: string;
  imagePath?: string;
  visibleOnMap?: boolean;
  canEnter?: boolean;
  ownerFactionId?: string;
  npcIds?: string[];
  merchantIds?: string[];
  questIds?: string[];
  dialogueIds?: string[];
  battleMapIds?: string[];
  tags?: string[];
}

export interface LocationEntryRequirements {
  minLevel?: number;
  requiredQuestId?: string;
  requiredCompletedQuestId?: string;
  requiredItemIds?: string[];
  requiredFactionId?: string;
  requiredFactionReputation?: number;
  requiredRace?: string[];
  requiredClass?: string[];
  requiredProfession?: string[];
  requiredFlag?: string;
}

export interface LocationEffect {
  type: string;
  value?: number;
  stat?: string;
  element?: string;
  description?: string;
}

export type LocationAreaShapeType = 'rectangle' | 'circle' | 'polygon' | 'none';

export interface LocationAreaShapePoint {
  x: number;
  y: number;
}

export interface LocationAreaShape {
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
  height?: number;
  points?: LocationAreaShapePoint[];
}

export interface LocationArea {
  id: string;
  name: string;
  type?: string;
  description?: string;
  imageId?: string;
  imagePath?: string;
  shapeType?: LocationAreaShapeType;
  shape?: LocationAreaShape;
  npcIds?: string[];
  merchantIds?: string[];
  questIds?: string[];
  dialogueIds?: string[];
  battleMapIds?: string[];
  visibleInStates?: string[];
  hiddenUntilQuestId?: string;
  hiddenAfterQuestId?: string;
  canEnter?: boolean;
  isHidden?: boolean;
  tags?: string[];
}

export interface WorldLocation {
  id: string;
  name: string;
  slug?: string;
  type: 'location';
  subtype?: LocationSubtype | string;
  status: LocationStatus;
  description?: string;
  shortDescription?: string;
  regionId?: string;
  parentLocationId?: string;
  kingdomId?: string;
  factionId?: string;
  clanId?: string;
  tribeId?: string;
  isHidden?: boolean;
  isDiscovered?: boolean;
  requiresDiscovery?: boolean;
  discoveryQuestId?: string;
  defaultImageId?: string;
  defaultImagePath?: string;
  currentState?: string;
  stateVariants?: LocationStateVariant[];
  npcIds?: string[];
  merchantIds?: string[];
  questIds?: string[];
  dialogueIds?: string[];
  battleMapIds?: string[];
  areas?: LocationArea[];
  entryRequirements?: LocationEntryRequirements;
  locationEffects?: LocationEffect[];
  tags?: string[];
  published?: boolean;
  hidden?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

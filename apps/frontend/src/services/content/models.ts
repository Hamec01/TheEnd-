import type { AdminSkillDefinition, PrimaryStat, VisualFxDefinition } from '@theend/rpg-domain';
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

export type ItemType = 'weapon' | 'armor' | 'potion' | 'material' | 'quest' | 'misc' | 'profession_tool' | 'profession_transport';

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

export type CarpenterComponentKind =
  | 'log'
  | 'plank'
  | 'beam'
  | 'board'
  | 'thin_plank'
  | 'planed_plank'
  | 'polished_plank'
  | 'shaft'
  | 'spear_shaft'
  | 'javelin_shaft'
  | 'polearm_shaft'
  | 'arrow_shaft'
  | 'bolt_shaft'
  | 'handle'
  | 'sword_handle'
  | 'dagger_handle'
  | 'axe_haft'
  | 'hammer_handle'
  | 'mace_handle'
  | 'frame'
  | 'crossbow_stock'
  | 'crossbow_body'
  | 'panel'
  | 'shield_core_round'
  | 'shield_core_kite'
  | 'shield_core_tower'
  | 'staff_core'
  | 'wand_core'
  | 'ritual_staff_core'
  | 'rune_staff_core'
  | 'binding'
  | 'resin_part'
  | 'bark_part'
  | 'charcoal_part'
  | 'ritual_board'
  | 'rune_wood_plate'
  | 'totem_core'
  | 'shamanic_frame'
  | 'composite'
  | 'unknown';

export type CarpenterRecipeGroup =
  | 'construction'
  | 'furniture'
  | 'weapon_parts'
  | 'armor_parts'
  | 'transport_parts'
  | 'tools'
  | 'household'
  | 'ritual'
  | 'misc';

export type CarpenterStationType =
  | 'none'
  | 'workbench'
  | 'sawmill'
  | 'drying_rack'
  | 'carving_table'
  | 'assembly_table'
  | 'carving_bench'
  | 'finishing_table'
  | 'rune_carving_table';

export type ProfessionWorkshopKind =
  | 'carpenter'
  | 'blacksmith'
  | 'alchemy'
  | 'runecrafting'
  | 'enchanting'
  | 'leatherworking'
  | 'cooking'
  | 'mining';

export interface ProfessionWorkshopRental {
  enabled: boolean;
  priceGold: number;
  durationHours?: number;
  requiresNpcDialogue?: boolean;
  ownerNpcId?: string;
  rentalDialogueId?: string;
}

export interface ProfessionWorkshopAccessRules {
  publicAccess?: boolean;
  kingdomId?: string;
  factionId?: string;
  onlyCitizens?: boolean;
}

export type ProfessionWorkshopInteractionType =
  | 'station'
  | 'npc'
  | 'dialog'
  | 'rental'
  | 'storage'
  | 'exit'
  | 'custom';

export interface ProfessionWorkshopInteractionPoint {
  id: string;
  label: string;
  type: ProfessionWorkshopInteractionType;
  x: number;
  y: number;
  stationType?: string;
  npcId?: string;
  dialogId?: string;
  serviceId?: string;
  requiredWorkshopTier?: number;
  requiredQuestId?: string;
  requiredSkillId?: string;
  isEnabled: boolean;
  description?: string;
}

export interface ProfessionWorkshopDefinition {
  id: string;
  name: string;
  description?: string;
  professionId: string;
  workshopKind: ProfessionWorkshopKind;
  status: 'active' | 'disabled' | 'draft';
  tier: number;
  stationTypes: string[];
  allowedTemplateGroups?: string[];
  forbiddenTemplateGroups?: string[];
  allowedTemplateIds?: string[];
  forbiddenTemplateIds?: string[];
  requiredReputation?: number;
  requiredQuestId?: string;
  requiredFactionId?: string;
  rental?: ProfessionWorkshopRental;
  accessRules?: ProfessionWorkshopAccessRules;
  imageRef?: GameImageRef;
  imagePath?: string;
  interactionPoints?: ProfessionWorkshopInteractionPoint[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type CarpenterTemplateDifficultyType = 'basic' | 'standard' | 'advanced' | 'master';

export interface CarpenterTemplateInputSlot {
  id: string;
  label: string;
  quantity: number;
  required: boolean;
  acceptedComponentKinds: CarpenterComponentKind[];
  acceptedItemIds?: string[];
  acceptedMaterialIds?: string[];
  notes?: string;
}

export interface CarpenterTraitTransferRule {
  sourceTraitTag: string;
  targetTraitTag?: string;
  transferPercent: number;
  notes?: string;
}

export interface CarpenterItemTemplate {
  id: string;
  name: string;
  description?: string;
  recipeGroup: CarpenterRecipeGroup;
  stationType: CarpenterStationType;
  difficulty: CarpenterTemplateDifficultyType;
  outputItemId?: string;
  outputComponentKind: CarpenterComponentKind;
  outputQuantity: number;
  requiredCarpenterLevel?: number;
  requiredSkillIds?: string[];
  inputSlots: CarpenterTemplateInputSlot[];
  traitTransferRules?: CarpenterTraitTransferRule[];
  tags?: string[];
  imageRef?: GameImageRef;
  isEnabled: boolean;
  notes?: string;
}

export interface CarpenterCraftedComponentSnapshot {
  sourceTreeId?: string;
  sourceTreeName?: string;
  sourceTreeRarity?: string;
  sourceTreeTier?: number;
  sourceWoodItemIds: string[];
  sourceWoodMaterialIds?: string[];
  templateId: string;
  templateName?: string;
  componentKind: CarpenterComponentKind;
  craftedByProfession: 'carpenter';
  craftedByCharacterId?: string;
  carpenterLevel?: number;
  qualityScore: number;
  traitRetentionPercent: number;
  inheritedTraitTags: WoodTraitTag[];
  inheritedWoodProfile?: TreeWoodProfile;
  inheritedEffects?: ItemEffect[];
  sourceLost?: boolean;
  sourceLostReason?: string;
  createdAtIso: string;
}

export interface BlacksmithUsedCarpenterComponentSnapshot {
  componentItemId: string;
  componentInstanceId?: string;
  componentKind: CarpenterComponentKind;
  templateId: string;
  templateName?: string;
  qualityScore: number;
  traitRetentionPercent: number;
  inheritedTraitTags: WoodTraitTag[];
  inheritedWoodProfile?: TreeWoodProfile;
  inheritedEffects?: ItemEffect[];
  sourceTreeId?: string;
  sourceTreeName?: string;
  sourceTreeRarity?: string;
  sourceTreeTier?: number;
  sourceWoodItemIds: string[];
  sourceWoodMaterialIds?: string[];
  sourceLost?: boolean;
  sourceLostReason?: string;
  componentCreatedAtIso?: string;
  consumedAtIso: string;
}

export interface BlacksmithCustomForgePlanMaterial {
  slotId: string;
  materialId: string;
  quantity: number;
}

export interface BlacksmithCustomForgePlan {
  id: string;
  mode: 'custom_forge';
  templateId: string;
  customName?: string;
  selectedMaterials: BlacksmithCustomForgePlanMaterial[];
  selectedCarpenterComponentItemId?: string;
  predictedDifficulty: number;
  predictedRisk: number;
  predictedPower: number;
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
  | 'carpenter'
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

export type ProfessionItemKind =
  | 'tool'
  | 'transport'
  | 'station'
  | 'consumable'
  | 'material'
  | 'blueprint'
  | 'upgrade'
  | 'service_item';

export interface ProfessionItemStats {
  toolKind?: string;
  transportKind?: string;
  stationKind?: string;
  tier?: number;
  requiredProfessionLevel?: number;
  durability?: number;
  maxDurability?: number;
  efficiency?: number;
  breakChanceModifier?: number;
  staminaCostModifier?: number;
  capacityLogs?: number;
  capacityWeight?: number;
  speedModifier?: number;
  rentPrice?: number;
  rentalDurationHours?: number;
  requiresHorse?: boolean;
  allowedActions?: string[];
  supportedResourceKinds?: string[];
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
  imageRef?: GameImageRef;
  battleVisuals?: ActorBattleVisualConfig;
  professionItem?: boolean;
  professionId?: string;
  professionItemKind?: ProfessionItemKind;
  professionStats?: ProfessionItemStats;
  profession?: string;
  toolKind?: string;
  durability?: number;
  maxDurability?: number;
  efficiency?: number;
  breakChanceModifier?: number;
  treeDamageBonus?: number;
  staminaCostModifier?: number;
  transportKind?: string;
  rentPrice?: number;
  rentDuration?: number;
  capacityWeight?: number;
  capacityLogs?: number;
  speed?: number;
  requiresHorse?: boolean;
  tier?: number;
  requiredLevel?: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemInstance {
  id: string;
  itemId: string;
  ownerId?: string;
  sourceItemId?: string;
  itemSnapshot?: AdminItem;
  customName?: string;
  statOverrides?: {
    damageMin?: number;
    damageMax?: number;
    armorValue?: number;
    price?: number;
    attackRange?: number;
    pierceTargets?: number;
    splashRadius?: number;
    splashCenterMultiplier?: number;
    splashOuterMultiplier?: number;
    bonuses?: Partial<Record<StatKey, number>>;
    equipmentEffects?: ItemEffect[];
    augmentSlots?: ItemSocket[];
    maxAugmentSlots?: number;
    canAddAugmentSlots?: boolean;
    canHaveRuneComplex?: boolean;
  };
  qualityTierId?: string;
  forgeScore?: number;
  craftedFromTemplateId?: string;
  craftedMaterialIds?: string[];
  craftedByProfession?: 'blacksmithing' | 'carpenter';
  carpenterComponent?: CarpenterCraftedComponentSnapshot;
  carpenterComponentsUsed?: BlacksmithUsedCarpenterComponentSnapshot[];
  tags?: string[];
  notes?: string;
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
  averageMarketPrice?: number;
  properties: MaterialProperty[];
  gameplayDescription: string;
  loreDescription: string;
  craftingProperties?: MaterialCraftingProperties;
  imagePath?: string;
  imageRef?: GameImageRef;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LootSourceType = 'npc' | 'monster' | 'chest' | 'region' | 'quest' | 'merchant_special' | 'tree' | 'plant' | 'beast' | 'fish' | 'event' | 'resource_node';

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
export type AdminVisualFx = VisualFxDefinition;
export type AdminDialogue = DialogueDefinition;
export type AdminNpc = NpcDefinition;
export type AdminQuest = QuestDefinition;
export type AdminQuestInteraction = QuestInteractionDefinition;
export type AdminQuestItem = QuestItemDefinition;
export type AdminQuestMarker = QuestMarkerDefinition;

export type SoundCategory =
  | 'ui'
  | 'footsteps'
  | 'combat'
  | 'weapons'
  | 'magic'
  | 'skills'
  | 'items'
  | 'inventory'
  | 'quests'
  | 'dialogues'
  | 'npc'
  | 'cities'
  | 'kingdoms'
  | 'locations'
  | 'battle_maps'
  | 'ambient'
  | 'weather'
  | 'resources'
  | 'professions'
  | 'events'
  | 'system';

export type SoundKind = 'sfx' | 'music' | 'ambient' | 'voice' | 'loop' | 'one_shot';

export interface SoundBinding {
  id: string;
  targetType:
    | 'global'
    | 'ui'
    | 'kingdom'
    | 'city'
    | 'location'
    | 'battle_map'
    | 'npc'
    | 'item'
    | 'weapon'
    | 'armor'
    | 'skill'
    | 'quest'
    | 'resource'
    | 'profession'
    | 'event'
    | 'terrain';
  targetId?: string;
  event:
    | 'click'
    | 'hover'
    | 'open'
    | 'close'
    | 'enter'
    | 'leave'
    | 'attack'
    | 'hit'
    | 'miss'
    | 'crit'
    | 'block'
    | 'dodge'
    | 'cast'
    | 'impact'
    | 'start'
    | 'complete'
    | 'fail'
    | 'loot'
    | 'equip'
    | 'unequip'
    | 'step'
    | 'idle'
    | 'ambient';
  priority?: number;
  conditions?: unknown[];
}

export interface SoundDefinition {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'disabled';
  category: SoundCategory;
  kind: SoundKind;
  description?: string;
  assetUrl: string;
  assetKey?: string;
  volume?: number;
  loop?: boolean;
  randomPitch?: boolean;
  pitchMin?: number;
  pitchMax?: number;
  cooldownMs?: number;
  tags?: string[];
  bindings?: SoundBinding[];
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TreeDrop {
  itemId: string;
  min: number;
  max: number;
  chance: number;
}

export type WoodTraitTag =
  | 'cold_resistant'
  | 'heat_resistant'
  | 'fire_affinity'
  | 'water_affinity'
  | 'earth_affinity'
  | 'air_affinity'
  | 'light_affinity'
  | 'dark_affinity'
  | 'life_affinity'
  | 'nature_affinity'
  | 'mana_conductive'
  | 'rune_friendly'
  | 'ritual_wood'
  | 'forbidden_wood'
  | 'volatile'
  | 'dense'
  | 'lightweight'
  | 'flexible'
  | 'brittle'
  | 'hard'
  | 'elastic'
  | 'resinous'
  | 'dry'
  | 'wet'
  | 'luxury'
  | 'building_grade'
  | 'weapon_grade'
  | 'bow_grade'
  | 'staff_grade'
  | 'shield_grade'
  | 'furniture_grade';

export interface TreeWoodPhysicalProfile extends MaterialPhysicalProperties {
  grainStability?: number;
  knotDensity?: number;
  crackRisk?: number;
  resinContent?: number;
  moistureRetention?: number;
  dryingDifficulty?: number;
  processingDifficulty?: number;
  splinterRisk?: number;
  polishPotential?: number;
  carvingPrecision?: number;
  bowTension?: number;
  shaftStraightness?: number;
  shieldIntegrity?: number;
  staffBalance?: number;
}

export type TreeWoodElementalProfile = MaterialElementalProperties;

export interface TreeWoodMagicalProfile extends MaterialMagicalProperties {
  natureAffinity?: number;
  illusionAffinity?: number;
  mindAffinity?: number;
}

export interface TreeWoodAlchemyProfile extends MaterialAlchemyProperties {
  resinAlchemyPower?: number;
  barkMedicinePower?: number;
}

export interface TreeWoodRunicProfile extends MaterialRunicProperties {
  runeCarvingPrecision?: number;
  socketStability?: number;
  magicStoneGrip?: number;
}

export interface TreeWoodEconomicProfile extends MaterialEconomicProperties {
  craftGuildValue?: number;
  kingdomDemand?: number;
  rarityPower?: number;
}

export interface TreeWoodProfile {
  materialTier?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  defaultMaterialCategory?: 'wood';
  traitTags?: WoodTraitTag[];
  physical?: TreeWoodPhysicalProfile;
  elemental?: TreeWoodElementalProfile;
  magical?: TreeWoodMagicalProfile;
  alchemy?: TreeWoodAlchemyProfile;
  runic?: TreeWoodRunicProfile;
  economic?: TreeWoodEconomicProfile;
  preferredComponentKinds?: string[];
  forbiddenComponentKinds?: string[];
  defaultInheritedEffects?: ItemEffect[];
  processingDifficultyBonus?: number;
  processingRiskBonus?: number;
  notes?: string;
}

export type WoodOutputKind =
  | 'log'
  | 'plank'
  | 'beam'
  | 'firewood'
  | 'bark'
  | 'resin'
  | 'charcoal'
  | 'wood_glue'
  | 'unknown';

export interface WoodMaterialInheritanceSnapshot {
  sourceTreeId: string;
  sourceTreeName?: string;
  sourceTreeRarity?: string;
  sourceTreeTier?: number;
  outputKind: WoodOutputKind;
  sourceItemId?: string;
  createdItemId?: string;
  traitRetentionPercent: number;
  inheritedTraitTags?: string[];
  inheritedWoodProfile?: TreeWoodProfile;
  inheritedEffects?: ItemEffect[];
  inheritedAtIso?: string;
  createdByProfession?: 'carpenter';
  createdByAction?: 'woodcutting' | 'sawing' | 'processing';
}

export interface TreeDefinition {
  id: string;
  name: string;
  description?: string;
  region: string;
  biomeIds: string[];
  tier: number;
  rarity: ItemRarity;
  hp: number;
  hardness: number;
  stability: number;
  fallRisk: number;
  requiredWoodcuttingTier: number;
  requiredToolTier: number;
  baseXp: number;
  weight: number;
  drops: TreeDrop[];
  enabled: boolean;
  imageRef?: GameImageRef;
  imagePath?: string;
  woodProfile?: TreeWoodProfile;
  sourceMaterialIds?: string[];
  defaultLogMaterialId?: string;
  defaultPlankMaterialId?: string;
  defaultBeamMaterialId?: string;
  defaultResinMaterialId?: string;
  defaultBarkMaterialId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type WaterType = 'river' | 'lake' | 'sea' | 'swamp' | 'pond' | 'underground_water';

export interface BiomeResourcePools {
  forest?: string[];
  herb?: string[];
  hunting?: string[];
  fishing?: string[];
  monster?: string[];
  event?: string[];
}

export interface BiomeDefinition {
  id: string;
  name: string;
  region: string;
  climate: string;
  dangerLevel: number;
  hasWater: boolean;
  waterTypes: WaterType[];
  defaultTreePool: string[];
  allowedResourceKinds: string[];
  resourcePools: BiomeResourcePools;
  description: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

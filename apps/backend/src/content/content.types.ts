import type { AdminSkillDefinition, BattleMapDefinition, PrimaryStat } from '@theend/rpg-domain';

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
  gameplayDescription: string;
  loreDescription: string;
  imagePath?: string;
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

export interface AdminMerchant {
  id: string;
  name: string;
  city: string;
  cityId?: string;
  cityLocationId?: string;
  location?: string;
  type: MerchantType;
  description?: string;
  portraitPath?: string;
  priceMultiplier: number;
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

export interface DialogueDefinition {
  id: string;
  title: string;
  npcId?: string;
  status: 'draft' | 'active' | 'disabled';
  description?: string;
  startNodeId: string;
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
  imageUrl?: string;
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
  visibleToPlayer: boolean;
  conditionIds: string[];
  imageUrl?: string;
  isActive?: boolean;
  requirements?: QuestInteractionRequirement[];
  hideAfterQuestCompleted?: boolean;
  hideAfterObjectiveCompleted?: boolean;
  hideAfterStepCompleted?: boolean;
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
  imageUrl?: string;
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

export type RegionType = 'walkable' | 'blocked' | 'water' | 'road' | 'danger' | 'trigger';

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
  requiredFaction?: string;
  targetScene?: string;
  isDiscovered: boolean;
  isVisibleToPlayer: boolean;
  isSafeZone?: boolean;
  allowPvP?: boolean;
  enemyTableId?: string;
  resourceTableId?: string;
  professionId?: string;
  respawnSeconds?: number;
  cooldownSeconds?: number;
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
  merchants: AdminMerchant[];
  cities: City[];
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
  itemSets?: ItemSet[];
  runeComplexes?: RuneComplex[];
  worldMap: WorldMapContent;
}

export type ContentImportMode = 'replace' | 'merge' | 'dryRun';

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
}

export type ContentCollectionName =
  | 'items'
  | 'skills'
  | 'merchants'
  | 'cities'
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
  | 'itemSets'
  | 'runeComplexes';

export interface ContentCollectionMap {
  items: AdminItem;
  skills: AdminSkillDefinition;
  merchants: AdminMerchant;
  cities: City;
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
  itemSets: ItemSet;
  runeComplexes: RuneComplex;
}

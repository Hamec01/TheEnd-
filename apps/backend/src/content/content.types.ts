import type { AdminSkillDefinition, PrimaryStat } from '@theend/rpg-domain';

export type StatKey = PrimaryStat;

export type ItemType = 'weapon' | 'armor' | 'potion' | 'material' | 'quest' | 'misc';

export type ItemSlot =
  | 'head'
  | 'necklace'
  | 'chest'
  | 'cloak'
  | 'belt'
  | 'leftHand'
  | 'rightHand'
  | 'gloves'
  | 'knees'
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
  requiredStats?: Partial<Record<StatKey, number>>;
  bonuses?: Partial<Record<StatKey, number>>;
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
  updatedAt: string;
}

export interface ContentDatabase {
  version: 1;
  items: AdminItem[];
  skills: AdminSkillDefinition[];
  merchants: AdminMerchant[];
  materials: Material[];
  lootTables: LootTable[];
  images: StoredImage[];
  dialogues: DialogueDefinition[];
  npcs: NpcDefinition[];
  quests: QuestDefinition[];
  questItems: QuestItemDefinition[];
  questMarkers: QuestMarkerDefinition[];
  worldMap: WorldMapContent;
}

export type ContentCollectionName =
  | 'items'
  | 'skills'
  | 'merchants'
  | 'materials'
  | 'lootTables'
  | 'images'
  | 'dialogues'
  | 'npcs'
  | 'quests'
  | 'questItems'
  | 'questMarkers';

export interface ContentCollectionMap {
  items: AdminItem;
  skills: AdminSkillDefinition;
  merchants: AdminMerchant;
  materials: Material;
  lootTables: LootTable;
  images: StoredImage;
  dialogues: DialogueDefinition;
  npcs: NpcDefinition;
  quests: QuestDefinition;
  questItems: QuestItemDefinition;
  questMarkers: QuestMarkerDefinition;
}

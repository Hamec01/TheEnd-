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

export interface LocationAreaShape {
  x?: number;
  y?: number;
  radius?: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
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
  workshopIds?: string[];
  services?: string[];
  areas?: LocationArea[];
  entryRequirements?: LocationEntryRequirements;
  locationEffects?: LocationEffect[];
  tags?: string[];
  published?: boolean;
  hidden?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

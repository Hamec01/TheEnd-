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
  questIds: string[];
  shopIds: string[];
  isVisible: boolean;
  isUnlocked: boolean;
  unlockCondition?: string;
  markerIcon?: string;
  linkedBattleMapId?: string;
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


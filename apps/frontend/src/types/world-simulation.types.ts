/**
 * Типы для живой симуляции мира (фронтенд).
 * Синхронизировать с backend/src/worldsim/types/world-simulation.types.ts
 */

export interface WorldNpcArchetype {
  id: string;
  name: string;
  kind: 'merchant' | 'guard' | 'bandit' | 'monk' | 'wanderer' | 'mage' | 'quest_giver' | 'warrior' | 'creature' | 'event';
  npcTemplateId?: string;
  merchantId?: string;
  sourceType?: 'npc' | 'merchant';
  sourceId?: string;
  economyProfile?: {
    homeCity: string;
    targetCities: string[];
    goodsCategories: string[];
    buyBias: number;
    sellBias: number;
  };
  escorts?: {
    npcTemplateId: string;
    count: number;
  };
  worldSpriteId: string;
  restingWorldSpriteId?: string;
  portraitId?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorldRoute {
  id: string;
  name: string;
  waypoints: {
    zoneId: string;
    cityId?: string;
    stopDurationMin?: number;
    stopDurationMax?: number;
  }[];
  travelTimingDevMinutes: number;
  travelTimingReleaseHours: number;
  dangerLevel: number;
  restChance: number;
  allowedArchetypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorldSpawnRule {
  id: string;
  name: string;
  spawnType: 'time_based' | 'event_based' | 'economy_based';
  spawnTimeDevMinutes?: number;
  spawnTimeReleaseHours?: number;
  archetypeIds: string[];
  minGroupSize: number;
  maxGroupSize: number;
  spawnWeight: number;
  conditions?: {
    minPrice?: number;
    maxPrice?: number;
    priceCategory?: string;
    cityId?: string;
    supplyDeficit?: boolean;
  };
  cooldownDev?: number;
  cooldownRelease?: number;
  lastSpawnTime?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveWorldEntity {
  id: string;
  archetypeId: string;
  routeId: string;
  state: 'traveling' | 'resting' | 'blocked_waiting' | 'in_city' | 'in_combat' | 'dead' | 'frozen' | 'respawning';
  routeProgress: number;
  routeWaypointIndex?: number;
  routePolyline?: Array<{ x: number; y: number }>;
  routePolylineIndex?: number;
  maxStamina?: number;
  currentStamina?: number;
  staminaRegenPerTick?: number;
  nextEventAt?: string;
  currentCityId?: string;
  members: string[];
  cargo?: {
    goodsId: string;
    quantity: number;
    buyPrice?: number;
  }[];
  visibility: {
    isVisibleToPlayer: boolean;
    anchorZoneId?: string;
    anchorCoordinates?: { x: number; y: number };
    lastSeenAt?: string;
  };
  interactions: {
    playerAttacked?: boolean;
    playerHelped?: boolean;
    playerTraded?: boolean;
  };
  frozenUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CityMarketState {
  id: string;
  cityId: string;
  goods: {
    goodsId: string;
    basePrice: number;
    currentPrice: number;
    supply: number;
    demand: number;
    trend: number;
    lastUpdatedAt: string;
  }[];
  updatedAt: string;
}

export interface EconomicEvent {
  id: string;
  type: 'merchant_arrival' | 'merchant_departure' | 'merchant_death' | 'price_update' | 'supply_shortage';
  entityId?: string;
  cityId: string;
  goodsId?: string;
  quantity?: number;
  priceImpact?: number;
  affectedUntil?: string;
  timestamp: string;
}

export interface WorldSimulationSnapshot {
  sourceTick: number;
  generatedAt: string;
  activeEntities: {
    id: string;
    archetypeId: string;
    kind?: WorldNpcArchetype['kind'];
    npcTemplateId?: string;
    merchantId?: string;
    sourceType?: WorldNpcArchetype['sourceType'];
    sourceId?: string;
    state: string;
    spriteId: string;
    portraitId?: string;
    cityId?: string;
    renderOnWorldMap?: boolean;
    renderInCityMap?: boolean;
    memberCount: number;
    zoneId: string;
    coordinates: { x: number; y: number };
    isHostile: boolean;
    hasQuest: boolean;
    updatedAt: string;
    sourceTick: number;
    maxStamina?: number;
    currentStamina?: number;
    staminaRegenPerTick?: number;
  }[];
  cityMarkets: CityMarketState[];
  events: EconomicEvent[];
}

/**
 * Persistent World-Sim configuration stored in ContentDatabase.
 * Only editor data — activeEntities are runtime and not persisted.
 */
export interface WorldSimConfig {
  version: 1;
  updatedAt?: string;
  npcArchetypes: WorldNpcArchetype[];
  routes: WorldRoute[];
  spawnRules: WorldSpawnRule[];
}

/** Result from import/validate config endpoints */
export interface WorldSimImportResult {
  ok: boolean;
  errors: string[];
  config: WorldSimConfig;
}

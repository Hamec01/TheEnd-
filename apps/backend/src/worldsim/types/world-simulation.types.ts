/**
 * Живая симуляция мира: экономика, караваны, НПЦ, события.
 * Используется для создания впечатления "живого" игрового мира.
 */

/**
 * Архетип NPC для использования в симуляции.
 * Определяет поведение, товары, боевые характеристики.
 */
export interface WorldNpcArchetype {
  id: string;
  name: string;
  kind: 'merchant' | 'guard' | 'bandit' | 'monk' | 'wanderer' | 'mage' | 'quest_giver' | 'warrior' | 'creature' | 'event';
  
  // Привязка к существующему NPC
  npcTemplateId?: string;
  merchantId?: string;
  sourceType?: 'npc' | 'merchant';
  sourceId?: string;
  
  // Экономический профиль
  economyProfile?: {
    homeCity: string;
    targetCities: string[];
    goodsCategories: string[]; // ['spices', 'cloth', 'weapons']
    buyBias: number; // 0.8 = покупаем на 20% дешевле базовой
    sellBias: number; // 1.3 = продаем на 30% дороже базовой
  };
  
  // Охранники (если торговец)
  escorts?: {
    npcTemplateId: string;
    count: number; // 1-3 охранников
  };
  
  // Спрайт на карте
  worldSpriteId: string; // 'trader_world_sprite', 'camp_world_sprite'
  restingWorldSpriteId?: string; // Optional sprite while the entity is resting/camping.
  
  // Визуальные параметры
  portraitId?: string; // actor/human_01.png
  
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Маршрут для движения групп NPC по миру.
 */
export interface WorldRoute {
  id: string;
  name: string;
  
  // Узлы маршрута (города/зоны)
  waypoints: {
    zoneId: string;
    cityId?: string;
    stopDurationMin?: number; // Минимум минут отдыха
    stopDurationMax?: number; // Максимум минут отдыха
  }[];
  
  // Время путешествия между узлами
  travelTimingDevMinutes: number;
  travelTimingReleaseHours: number;
  
  // Параметры маршрута
  dangerLevel: number; // 0-10
  restChance: number; // 0.25 = 25% шанс остановиться в пути
  
  // Какие архетипы могут использовать этот маршрут
  allowedArchetypes: string[]; // ['merchant_luminor', 'patrol_north']
  
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Правило появления групп NPC в мире.
 */
export interface WorldSpawnRule {
  id: string;
  name: string;
  
  // Триггер появления
  spawnType: 'time_based' | 'event_based' | 'economy_based';
  spawnTimeDevMinutes?: number; // Каждые N минут (для теста)
  spawnTimeReleaseHours?: number; // Каждые N часов (production)
  
  // Какие архетипы спавнить
  archetypeIds: string[];
  
  // Сколько одновременно
  minGroupSize: number;
  maxGroupSize: number;
  spawnWeight: number; // 0.0-1.0, вероятность появления
  
  // Условия появления
  conditions?: {
    minPrice?: number; // Спавнить, если цена > X
    maxPrice?: number;
    priceCategory?: string; // 'spices', 'cloth'
    cityId?: string; // Для какого города
    supplyDeficit?: boolean; // Спавнить при дефиците
  };
  
  // Перезарядка
  cooldownDev?: number; // Минут до следующего спавна (для теста)
  cooldownRelease?: number; // Часов (production)
  lastSpawnTime?: string;
  
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Активная сущность в мире (конкретный караван, патруль, бандиты).
 * Это СОСТОЯНИЕ, которое обновляется сервером каждый тик.
 */
export interface ActiveWorldEntity {
  id: string; // 'active_caravan_001'
  
  // Шаблон
  archetypeId: string;
  routeId: string;
  
  // Текущее состояние
  state: 'traveling' | 'resting' | 'blocked_waiting' | 'in_city' | 'in_combat' | 'dead' | 'frozen' | 'respawning';
  
  // Прогресс по маршруту (0.0 - 1.0)
  routeProgress: number;
  routeWaypointIndex?: number;
  routePolyline?: Array<{ x: number; y: number }>;
  routePolylineIndex?: number;

  maxStamina?: number;
  currentStamina?: number;
  staminaRegenPerTick?: number;
  
  // Когда будет следующее событие (например, прибытие в город)
  nextEventAt?: string; // ISO timestamp
  
  // Участники группы (NPC ID)
  members: string[]; // ['npc_merchant_01', 'npc_guard_arklein_01', ...]
  
  // Груз (если торговец)
  cargo?: {
    goodsId: string;
    quantity: number;
    buyPrice?: number; // По какой цене купили
  }[];
  
  // Привязка к видимости (когда спрайт на карте)
  visibility: {
    isVisibleToPlayer: boolean;
    anchorZoneId?: string; // В какой зоне сейчас спавнен спрайт
    anchorCoordinates?: { x: number; y: number }; // Координаты на карте
    lastSeenAt?: string; // Когда игрок в последний раз видел
  };
  
  // История взаимодействий
  interactions: {
    playerAttacked?: boolean;
    playerHelped?: boolean;
    playerTraded?: boolean;
  };
  
  // Для замороженных (после смерти)
  frozenUntil?: string;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Состояние цен в городе.
 */
export interface CityMarketState {
  id: string;
  cityId: string;
  
  goods: {
    goodsId: string; // 'spices', 'cloth', etc
    basePrice: number;
    currentPrice: number;
    supply: number;
    demand: number;
    trend: number; // -10 to +10, направление изменения
    lastUpdatedAt: string;
  }[];
  
  updatedAt: string;
}

/**
 * Событие в логе экономики (для отслеживания).
 */
export interface EconomicEvent {
  id: string;
  type: 'merchant_arrival' | 'merchant_departure' | 'merchant_death' | 'price_update' | 'supply_shortage';
  entityId?: string; // ID активной сущности
  cityId: string;
  goodsId?: string;
  quantity?: number;
  priceImpact?: number;
  affectedUntil?: string; // На какое время действует эффект
  timestamp: string;
}

/**
 * Снимок мира для отправки на фронтенд (игроку).
 */
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

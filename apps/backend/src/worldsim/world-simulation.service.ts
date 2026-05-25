import { Injectable, Logger } from '@nestjs/common';
import { ContentService } from '../content/content.service';
import type { RegionType } from '../content/content.types';
import type {
  ActiveWorldEntity,
  CityMarketState,
  EconomicEvent,
  WorldNpcArchetype,
  WorldRoute,
  WorldSpawnRule,
  WorldSimulationSnapshot,
} from './types/world-simulation.types';
import { applyWorldEntityStaminaTick, resolveWorldEntityStaminaDefaults } from './world-entity-stamina';
import { WorldRegionPathAdapter } from './world-region-path.adapter';

/**
 * Сервис симуляции живого мира.
 * Управляет активными сущностями, маршрутами, ценами, событиями.
 */
@Injectable()
export class WorldSimulationService {
  private readonly logger = new Logger(WorldSimulationService.name);
  private readonly zoneCoordinateIndex = new Map<string, { x: number; y: number }>();

  // In-memory storage (в реальном проекте это должно быть в БД)
  private archetypes: Map<string, WorldNpcArchetype> = new Map();
  private routes: Map<string, WorldRoute> = new Map();
  private spawnRules: Map<string, WorldSpawnRule> = new Map();
  private activeEntities: Map<string, ActiveWorldEntity> = new Map();
  private marketStates: Map<string, CityMarketState> = new Map();
  private economicEvents: EconomicEvent[] = [];

  // Симуляция время (для тестирования)
  private simulationTime: Date = new Date();
  private simulationTickCount = 0;
  private worldPathAdapter: WorldRegionPathAdapter | null = null;

  private readonly defaultEntityMaxStamina = 150;
  private readonly defaultEntityStaminaRegenPerTick = 6;
  private readonly entityMoveCostPerWorldUnit = 220;

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private hashToUnit(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    const normalized = (hash >>> 0) / 0xffffffff;
    return this.clamp01(normalized);
  }

  private rebuildZoneCoordinateIndex(): void {
    this.zoneCoordinateIndex.clear();

    const worldMap = this.contentService.getWorldMap();
    for (const zone of worldMap.zones ?? []) {
      if (typeof zone?.x !== 'number' || typeof zone?.y !== 'number') {
        continue;
      }

      const coordinate = { x: zone.x, y: zone.y };
      const keys = [
        String(zone.id ?? '').trim(),
        String((zone as any).cityId ?? '').trim(),
        String((zone as any).targetScene ?? '').trim(),
      ].filter(Boolean);

      for (const key of keys) {
        if (!this.zoneCoordinateIndex.has(key)) {
          this.zoneCoordinateIndex.set(key, coordinate);
        }
      }
    }
  }

  private refreshWorldPathAdapter(): void {
    const worldMap = this.contentService.getWorldMap();
    this.worldPathAdapter = new WorldRegionPathAdapter(worldMap);
  }

  private getZoneAnchorCoordinates(zoneId: string | undefined): { x: number; y: number } {
    const normalizedZoneId = String(zoneId ?? '').trim();
    if (normalizedZoneId) {
      let indexed = this.zoneCoordinateIndex.get(normalizedZoneId);
      if (!indexed) {
        this.rebuildZoneCoordinateIndex();
        indexed = this.zoneCoordinateIndex.get(normalizedZoneId);
      }
      if (indexed) {
        return indexed;
      }
    }

    const seed = normalizedZoneId || 'world_center';
    const x = 0.1 + this.hashToUnit(`${seed}_x`) * 0.8;
    const y = 0.1 + this.hashToUnit(`${seed}_y`) * 0.8;
    return { x, y };
  }

  private getRouteCoordinates(route: WorldRoute, progress: number): { x: number; y: number } {
    if (!route.waypoints.length) {
      return { x: 0.5, y: 0.5 };
    }

    if (route.waypoints.length === 1) {
      return this.getZoneAnchorCoordinates(route.waypoints[0]?.zoneId);
    }

    const clampedProgress = this.clamp01(progress);
    const segments = route.waypoints.length - 1;
    const scaled = clampedProgress * segments;
    const segmentIndex = Math.min(segments - 1, Math.floor(scaled));
    const localT = scaled - segmentIndex;

    const start = this.getZoneAnchorCoordinates(route.waypoints[segmentIndex]?.zoneId);
    const end = this.getZoneAnchorCoordinates(route.waypoints[segmentIndex + 1]?.zoneId);

    return {
      x: start.x + (end.x - start.x) * localT,
      y: start.y + (end.y - start.y) * localT,
    };
  }

  private resolveTravelTimeSeconds(route: WorldRoute): number {
    const isBuildDev = process.env.NODE_ENV !== 'production';
    return isBuildDev
      ? route.travelTimingDevMinutes * 60
      : route.travelTimingReleaseHours * 3600;
  }

  private resolveRouteLoopDistance(route: WorldRoute): number {
    if (route.waypoints.length <= 1) {
      return 0.001;
    }

    let distance = 0;
    for (let index = 0; index < route.waypoints.length - 1; index += 1) {
      const start = this.getZoneAnchorCoordinates(route.waypoints[index]?.zoneId);
      const end = this.getZoneAnchorCoordinates(route.waypoints[index + 1]?.zoneId);
      distance += Math.hypot(end.x - start.x, end.y - start.y);
    }

    // Keep loops moving even on degenerate routes.
    return Math.max(0.001, distance);
  }

  private resolveWaypointCursor(entity: ActiveWorldEntity, route: WorldRoute): { fromIndex: number; toIndex: number } {
    const waypointCount = route.waypoints.length;
    if (waypointCount <= 1) {
      return { fromIndex: 0, toIndex: 0 };
    }

    const fromIndex = Number.isFinite(entity.routeWaypointIndex)
      ? Math.max(0, Math.min(waypointCount - 1, Number(entity.routeWaypointIndex)))
      : 0;
    const toIndex = (fromIndex + 1) % waypointCount;
    return { fromIndex, toIndex };
  }

  private buildEntityRoutePolyline(
    route: WorldRoute,
    fromIndex: number,
    toIndex: number,
  ): Array<{ x: number; y: number }> | null {
    const start = this.getZoneAnchorCoordinates(route.waypoints[fromIndex]?.zoneId);
    const end = this.getZoneAnchorCoordinates(route.waypoints[toIndex]?.zoneId);

    if (!this.worldPathAdapter) {
      return [start, end];
    }

    const polyline = this.worldPathAdapter.buildPolyline(start, end);
    return polyline;
  }

  private resolveRegionTypeAtPoint(point: { x: number; y: number }): RegionType {
    if (!this.worldPathAdapter) {
      return 'walkable';
    }
    const cell = this.worldPathAdapter.worldToCell(point);
    return this.worldPathAdapter.getRegionTypeAt(cell);
  }

  private applyIdleRegen(entity: ActiveWorldEntity): void {
    const tick = applyWorldEntityStaminaTick(
      {
        state: {
          maxStamina: entity.maxStamina,
          currentStamina: entity.currentStamina,
          staminaRegenPerTick: entity.staminaRegenPerTick,
        },
        movementDistance: 0,
      },
      {
        maxStamina: this.defaultEntityMaxStamina,
        regenPerTick: this.defaultEntityStaminaRegenPerTick,
        moveCostPerWorldUnit: this.entityMoveCostPerWorldUnit,
      },
    );

    entity.maxStamina = tick.maxStamina;
    entity.currentStamina = tick.currentStamina;
    entity.staminaRegenPerTick = tick.staminaRegenPerTick;
  }

  private enterRestingState(
    entity: ActiveWorldEntity,
    waypoint: WorldRoute['waypoints'][number] | undefined,
    route: WorldRoute,
  ): void {
    const archetype = this.archetypes.get(entity.archetypeId);
    const isBandit = archetype?.kind === 'bandit';

    if (waypoint?.cityId && !isBandit) {
      if (entity.cargo && entity.cargo.length > 0) {
        this.addCargoToMarket(waypoint.cityId, entity.cargo);
      }
      this.addEconomicEvent({
        type: 'merchant_arrival',
        cityId: waypoint.cityId,
        entityId: entity.id,
        timestamp: this.simulationTime.toISOString(),
      } as EconomicEvent);
    }

    if (isBandit) {
      const campChance = Math.max(0.15, Math.min(0.9, Number(route.restChance ?? 0.35)));
      if (Math.random() >= campChance) {
        entity.state = 'traveling';
        entity.nextEventAt = undefined;
        return;
      }
    }

    const stopMin = waypoint?.stopDurationMin ?? 0;
    const stopMax = waypoint?.stopDurationMax ?? stopMin;
    if (stopMax <= 0) {
      entity.state = 'traveling';
      entity.nextEventAt = undefined;
      return;
    }

    const stopDuration = stopMin + Math.random() * Math.max(0, stopMax - stopMin);
    entity.state = 'resting';
    entity.nextEventAt = new Date(this.simulationTime.getTime() + stopDuration * 60 * 1000).toISOString();
  }

  private moveEntityAlongRoute(entity: ActiveWorldEntity, route: WorldRoute, deltaSeconds: number): void {
    const waypointCount = route.waypoints.length;
    if (waypointCount <= 1) {
      entity.state = 'resting';
      return;
    }

    const staminaState = resolveWorldEntityStaminaDefaults(
      {
        maxStamina: entity.maxStamina,
        currentStamina: entity.currentStamina,
        staminaRegenPerTick: entity.staminaRegenPerTick,
      },
      {
        maxStamina: this.defaultEntityMaxStamina,
        regenPerTick: this.defaultEntityStaminaRegenPerTick,
        moveCostPerWorldUnit: this.entityMoveCostPerWorldUnit,
      },
    );

    entity.maxStamina = staminaState.maxStamina;
    entity.currentStamina = staminaState.currentStamina;
    entity.staminaRegenPerTick = staminaState.staminaRegenPerTick;

    if ((entity.currentStamina ?? 0) <= 0) {
      entity.state = 'blocked_waiting';
      this.applyIdleRegen(entity);
      return;
    }

    const cursor = this.resolveWaypointCursor(entity, route);
    if (!entity.routePolyline || entity.routePolyline.length < 2) {
      const nextPolyline = this.buildEntityRoutePolyline(route, cursor.fromIndex, cursor.toIndex);
      if (!nextPolyline || nextPolyline.length < 2) {
        entity.state = 'blocked_waiting';
        return;
      }
      entity.routePolyline = nextPolyline;
      entity.routePolylineIndex = 0;
      entity.visibility.anchorCoordinates = {
        x: nextPolyline[0].x,
        y: nextPolyline[0].y,
      };
      entity.visibility.anchorZoneId = route.waypoints[cursor.fromIndex]?.zoneId;
    }

    const travelTimeSeconds = this.resolveTravelTimeSeconds(route);
    const routeDistance = this.resolveRouteLoopDistance(route);
    let remainingDistance = (routeDistance / Math.max(1, travelTimeSeconds)) * deltaSeconds;
    let traveledDistance = 0;
    let latestRegionType: RegionType = 'walkable';

    const polyline = entity.routePolyline;
    let nodeIndex = Math.max(0, Math.min(polyline.length - 2, Number(entity.routePolylineIndex ?? 0)));
    let current = entity.visibility.anchorCoordinates
      ? { ...entity.visibility.anchorCoordinates }
      : { ...polyline[0] };

    while (remainingDistance > 0.000001 && nodeIndex < polyline.length - 1) {
      const segmentEnd = polyline[nodeIndex + 1];
      const dx = segmentEnd.x - current.x;
      const dy = segmentEnd.y - current.y;
      const segmentDistance = Math.hypot(dx, dy);

      if (segmentDistance <= 0.000001) {
        current = { ...segmentEnd };
        nodeIndex += 1;
        continue;
      }

      const step = Math.min(segmentDistance, remainingDistance);
      const ratio = step / segmentDistance;
      current = {
        x: this.clamp01(current.x + dx * ratio),
        y: this.clamp01(current.y + dy * ratio),
      };

      traveledDistance += step;
      remainingDistance -= step;
      latestRegionType = this.resolveRegionTypeAtPoint(current);

      if (step >= segmentDistance - 0.000001) {
        nodeIndex += 1;
      }
    }

    const staminaTick = applyWorldEntityStaminaTick(
      {
        state: {
          maxStamina: entity.maxStamina,
          currentStamina: entity.currentStamina,
          staminaRegenPerTick: entity.staminaRegenPerTick,
        },
        movementDistance: traveledDistance,
        regionType: latestRegionType,
      },
      {
        maxStamina: this.defaultEntityMaxStamina,
        regenPerTick: this.defaultEntityStaminaRegenPerTick,
        moveCostPerWorldUnit: this.entityMoveCostPerWorldUnit,
      },
    );

    entity.maxStamina = staminaTick.maxStamina;
    entity.currentStamina = staminaTick.currentStamina;
    entity.staminaRegenPerTick = staminaTick.staminaRegenPerTick;
    entity.visibility.anchorCoordinates = current;
    entity.routePolylineIndex = nodeIndex;

    const destinationReached = nodeIndex >= polyline.length - 1;
    if (!destinationReached) {
      entity.state = staminaTick.currentStamina <= 0 ? 'blocked_waiting' : 'traveling';
      return;
    }

    entity.routeWaypointIndex = cursor.toIndex;
    entity.routeProgress = cursor.toIndex / Math.max(1, waypointCount - 1);
    entity.visibility.anchorZoneId = route.waypoints[cursor.toIndex]?.zoneId;
    entity.routePolyline = undefined;
    entity.routePolylineIndex = undefined;

    const arrivedWaypoint = route.waypoints[cursor.toIndex];
    this.enterRestingState(entity, arrivedWaypoint, route);
  }

  private hasActiveEntityForArchetype(archetypeId: string): boolean {
    for (const entity of this.activeEntities.values()) {
      if (entity.archetypeId === archetypeId) {
        return true;
      }
    }
    return false;
  }

  private isBanditArchetypeId(archetypeId: string): boolean {
    const archetype = this.archetypes.get(archetypeId);
    if (archetype) {
      return archetype.kind === 'bandit';
    }
    return archetypeId.toLowerCase().includes('bandit');
  }

  private isCityLikeRouteZone(zoneId: string | undefined): boolean {
    const normalized = String(zoneId ?? '').trim().toLowerCase();
    return normalized === 'arklein'
      || normalized === 'brainhold'
      || normalized === 'city_brainhold'
      || normalized.startsWith('city_');
  }

  private toBanditRoadsideZoneId(zoneId: string | undefined, index: number): string {
    const normalized = String(zoneId ?? '').trim();
    if (!normalized) {
      return `bandit_roadside_stop_${index + 1}`;
    }
    return this.isCityLikeRouteZone(normalized)
      ? `bandit_roadside_${normalized}_${index + 1}`
      : normalized;
  }

  private sanitizeRouteForBanditPolicy(route: WorldRoute): WorldRoute {
    const hasBandits = route.allowedArchetypes.some((archetypeId) => this.isBanditArchetypeId(archetypeId));
    if (!hasBandits) {
      return route;
    }

    return {
      ...route,
      waypoints: route.waypoints.map((waypoint, index) => {
        const { cityId: _cityId, ...rest } = waypoint;
        void _cityId;
        return {
          ...rest,
          zoneId: this.toBanditRoadsideZoneId(rest.zoneId, index),
        };
      }),
      restChance: Math.max(0.35, Number(route.restChance ?? 0.35)),
    };
  }

  private normalizeArchetype(archetype: WorldNpcArchetype): WorldNpcArchetype {
    const normalized = { ...archetype };

    if (!normalized.sourceType) {
      normalized.sourceType = normalized.merchantId ? 'merchant' : 'npc';
    }
    if (!normalized.sourceId) {
      normalized.sourceId = normalized.sourceType === 'merchant'
        ? normalized.merchantId
        : normalized.npcTemplateId;
    }
    if (normalized.sourceType === 'merchant') {
      normalized.merchantId = normalized.sourceId || normalized.merchantId;
      normalized.npcTemplateId = normalized.npcTemplateId || undefined;
    }
    if (normalized.sourceType === 'npc') {
      normalized.npcTemplateId = normalized.sourceId || normalized.npcTemplateId;
    }

    if (normalized.kind === 'merchant') {
      normalized.worldSpriteId = normalized.worldSpriteId || 'trader_world_sprite';
      normalized.portraitId = normalized.portraitId || 'bandit_01';
    }

    if (normalized.kind === 'bandit') {
      if (!normalized.worldSpriteId || normalized.worldSpriteId === 'trader_world_sprite') {
        normalized.worldSpriteId = 'camp_world_sprite';
      }
      normalized.restingWorldSpriteId = normalized.restingWorldSpriteId || 'fire_world_sprite';
      // В проекте нет отдельного bandit image id, используем валидный fallback.
      normalized.portraitId = normalized.portraitId || 'unknown';
    }

    return normalized;
  }

  constructor(private readonly contentService: ContentService) {
    this.logger.log('WorldSimulationService initialized');
  }

  /**
   * Инициализировать симуляцию (загрузить из контента или создать дефолты).
   */
  async initializeSimulation(): Promise<void> {
    this.logger.log('Initializing world simulation...');
    this.rebuildZoneCoordinateIndex();
    this.refreshWorldPathAdapter();

    // Предустановленные архетипы торговцев (подключены к реальным NPC)
    const defaultArchetypes: WorldNpcArchetype[] = [
      {
        id: 'caravan_arklein_mirel',
        name: 'Караван Мирель',
        kind: 'merchant',
        npcTemplateId: 'npc_arklein_mirel',
        merchantId: 'merchant_arklein_mirel',
        sourceType: 'npc',
        sourceId: 'npc_arklein_mirel',
        worldSpriteId: 'trader_world_sprite',
        portraitId: 'unknown',
        economyProfile: {
          homeCity: 'arklein',
          targetCities: ['city_grankor', 'brainhold'],
          goodsCategories: ['cloth', 'weapons'],
          buyBias: 0.84,
          sellBias: 1.16,
        },
        escorts: { npcTemplateId: 'npc_arklein_guard_01', count: 1 },
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'caravan_grankor_drogan',
        name: 'Караван Дрогана',
        kind: 'merchant',
        npcTemplateId: 'npc_grankor_drogan',
        merchantId: 'merchant_grankor_drogan',
        sourceType: 'npc',
        sourceId: 'npc_grankor_drogan',
        worldSpriteId: 'trader_world_sprite',
        portraitId: 'unknown',
        economyProfile: {
          homeCity: 'city_grankor',
          targetCities: ['arklein', 'brainhold'],
          goodsCategories: ['weapons', 'cloth'],
          buyBias: 0.8,
          sellBias: 1.22,
        },
        escorts: { npcTemplateId: 'npc_arklein_guard_01', count: 2 },
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'caravan_brainhold_selene',
        name: 'Караван Селены',
        kind: 'merchant',
        npcTemplateId: 'npc_brainhold_selene',
        merchantId: 'merchant_brainhold_selene',
        sourceType: 'npc',
        sourceId: 'npc_brainhold_selene',
        worldSpriteId: 'trader_world_sprite',
        portraitId: 'unknown',
        economyProfile: {
          homeCity: 'brainhold',
          targetCities: ['arklein', 'city_grankor'],
          goodsCategories: ['cloth', 'weapons'],
          buyBias: 0.82,
          sellBias: 1.18,
        },
        escorts: { npcTemplateId: 'npc_arklein_guard_01', count: 1 },
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'bandit_road_raiders',
        name: 'Дорожная шайка',
        kind: 'bandit',
        npcTemplateId: 'npc_bandit_raider',
        sourceType: 'npc',
        sourceId: 'npc_bandit_raider',
        worldSpriteId: 'camp_world_sprite',
        restingWorldSpriteId: 'fire_world_sprite',
        portraitId: 'bandit_01',
        escorts: { npcTemplateId: 'npc_bandit_raider', count: 2 },
        isEnabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Предустановленные маршруты
    const defaultRoutes: WorldRoute[] = [
      {
        id: 'route_trade_circle_arklein',
        name: 'Торговый круг Мирель',
        waypoints: [
          { zoneId: 'arklein', cityId: 'arklein', stopDurationMin: 60, stopDurationMax: 180 },
          { zoneId: 'city_grankor', cityId: 'city_grankor', stopDurationMin: 80, stopDurationMax: 190 },
          { zoneId: 'city_brainhold', cityId: 'brainhold', stopDurationMin: 90, stopDurationMax: 220 },
          { zoneId: 'arklein', cityId: 'arklein', stopDurationMin: 60, stopDurationMax: 150 },
        ],
        travelTimingDevMinutes: 14,
        travelTimingReleaseHours: 6,
        dangerLevel: 3,
        restChance: 0.2,
        allowedArchetypes: ['caravan_arklein_mirel'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'route_trade_circle_grankor',
        name: 'Торговый круг Дрогана',
        waypoints: [
          { zoneId: 'city_grankor', cityId: 'city_grankor', stopDurationMin: 60, stopDurationMax: 180 },
          { zoneId: 'city_brainhold', cityId: 'brainhold', stopDurationMin: 90, stopDurationMax: 200 },
          { zoneId: 'arklein', cityId: 'arklein', stopDurationMin: 60, stopDurationMax: 170 },
          { zoneId: 'city_grankor', cityId: 'city_grankor', stopDurationMin: 70, stopDurationMax: 180 },
        ],
        travelTimingDevMinutes: 15,
        travelTimingReleaseHours: 8,
        dangerLevel: 5,
        restChance: 0.3,
        allowedArchetypes: ['caravan_grankor_drogan'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'route_trade_circle_brainhold',
        name: 'Торговый круг Селены',
        waypoints: [
          { zoneId: 'city_brainhold', cityId: 'brainhold', stopDurationMin: 90, stopDurationMax: 200 },
          { zoneId: 'arklein', cityId: 'arklein', stopDurationMin: 70, stopDurationMax: 180 },
          { zoneId: 'city_grankor', cityId: 'city_grankor', stopDurationMin: 80, stopDurationMax: 190 },
          { zoneId: 'city_brainhold', cityId: 'brainhold', stopDurationMin: 90, stopDurationMax: 210 },
        ],
        travelTimingDevMinutes: 16,
        travelTimingReleaseHours: 7,
        dangerLevel: 4,
        restChance: 0.25,
        allowedArchetypes: ['caravan_brainhold_selene'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'route_bandit_road_patrol',
        name: 'Разбойничья тропа',
        waypoints: [
          { zoneId: 'arklein', stopDurationMin: 18, stopDurationMax: 42 },
          { zoneId: 'city_grankor', stopDurationMin: 20, stopDurationMax: 48 },
          { zoneId: 'city_brainhold', stopDurationMin: 22, stopDurationMax: 52 },
          { zoneId: 'arklein', stopDurationMin: 18, stopDurationMax: 42 },
        ],
        travelTimingDevMinutes: 18,
        travelTimingReleaseHours: 9,
        dangerLevel: 6,
        restChance: 0.45,
        allowedArchetypes: ['bandit_road_raiders'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Предустановленные правила спавна
    const defaultSpawnRules: WorldSpawnRule[] = [
      {
        id: 'spawn_caravan_arklein_mirel',
        name: 'Караван Мирель',
        spawnType: 'time_based',
        spawnTimeDevMinutes: 5,
        spawnTimeReleaseHours: 24,
        archetypeIds: ['caravan_arklein_mirel'],
        minGroupSize: 1,
        maxGroupSize: 1,
        spawnWeight: 1,
        cooldownDev: 10,
        cooldownRelease: 24,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'spawn_caravan_grankor_drogan',
        name: 'Караван Дрогана',
        spawnType: 'time_based',
        spawnTimeDevMinutes: 6,
        spawnTimeReleaseHours: 24,
        archetypeIds: ['caravan_grankor_drogan'],
        minGroupSize: 1,
        maxGroupSize: 1,
        spawnWeight: 1,
        cooldownDev: 10,
        cooldownRelease: 24,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'spawn_caravan_brainhold_selene',
        name: 'Караван Селены',
        spawnType: 'time_based',
        spawnTimeDevMinutes: 7,
        spawnTimeReleaseHours: 24,
        archetypeIds: ['caravan_brainhold_selene'],
        minGroupSize: 1,
        maxGroupSize: 1,
        spawnWeight: 1,
        cooldownDev: 10,
        cooldownRelease: 24,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'spawn_bandit_road_raiders',
        name: 'Дорожная шайка',
        spawnType: 'time_based',
        spawnTimeDevMinutes: 8,
        spawnTimeReleaseHours: 36,
        archetypeIds: ['bandit_road_raiders'],
        minGroupSize: 1,
        maxGroupSize: 1,
        spawnWeight: 0.65,
        cooldownDev: 12,
        cooldownRelease: 24,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    // Предустановленные рынки
    const defaultCities = ['arklein', 'city_grankor', 'brainhold'];
    for (const cityId of defaultCities) {
      if (!this.marketStates.has(cityId)) {
        const market = this.createEmptyMarket(cityId);
        this.marketStates.set(cityId, market);
      }
    }

    // Загрузить в память (только если не уже загружены через API)
    for (const a of defaultArchetypes) {
      if (!this.archetypes.has(a.id)) this.archetypes.set(a.id, a);
    }
    for (const r of defaultRoutes) {
      if (!this.routes.has(r.id)) this.routes.set(r.id, r);
    }
    for (const s of defaultSpawnRules) {
      if (!this.spawnRules.has(s.id)) this.spawnRules.set(s.id, s);
    }

    // Enforce policy: bandits do not use city stop metadata and camp on the road.
    for (const [routeId, route] of this.routes.entries()) {
      const sanitized = this.sanitizeRouteForBanditPolicy(route);
      if (sanitized === route) {
        continue;
      }
      this.routes.set(routeId, {
        ...sanitized,
        updatedAt: this.simulationTime.toISOString(),
      });
    }

    this.logger.log(`World simulation ready: ${this.archetypes.size} archetypes, ${this.routes.size} routes, ${this.spawnRules.size} rules`);
  }

  /**
   * Главный тик симуляции (вызывается каждые N секунд).
   * Обновляет позиции, цены, события, проверяет спавны.
   */
  async tick(deltaSeconds: number): Promise<void> {
    this.simulationTickCount++;

    // Обновить время симуляции
    this.simulationTime = new Date(this.simulationTime.getTime() + deltaSeconds * 1000);

    // Этап 1: Обновить прогресс маршрутов
    this.updateRouteProgress(deltaSeconds);

    // Этап 2: Проверить respawn замороженных
    this.checkFrozenRespawns();

    // Этап 3: Триггерить новые спавны
    this.checkSpawnRules();

    // Этап 4: Пересчитать цены
    this.updateMarketPrices();

    if (this.simulationTickCount % 10 === 0) {
      this.logger.debug(`Simulation tick ${this.simulationTickCount}, time: ${this.simulationTime.toISOString()}`);
    }
  }

  /**
   * Обновить прогресс сущностей по маршрутам.
   */
  private updateRouteProgress(deltaSeconds: number): void {
    for (const entity of this.activeEntities.values()) {
      if (entity.state === 'resting') {
        this.applyIdleRegen(entity);
        if (entity.nextEventAt && new Date(entity.nextEventAt) <= this.simulationTime) {
          entity.state = 'traveling';
          entity.nextEventAt = undefined;
          entity.routePolyline = undefined;
          entity.routePolylineIndex = undefined;
        }
        continue;
      }

      if (entity.state === 'blocked_waiting') {
        const before = Number(entity.currentStamina ?? 0);
        this.applyIdleRegen(entity);
        const max = Number(entity.maxStamina ?? this.defaultEntityMaxStamina);
        const after = Number(entity.currentStamina ?? 0);
        if (after >= max && max > 0) {
          entity.state = 'traveling';
          entity.routePolyline = undefined;
          entity.routePolylineIndex = undefined;
        } else if (after < before && before > 0) {
          entity.currentStamina = before;
        }
        entity.updatedAt = this.simulationTime.toISOString();
        continue;
      }

      if (entity.state !== 'traveling') {
        continue;
      }

      const route = this.routes.get(entity.routeId);
      if (!route) {
        continue;
      }

      this.moveEntityAlongRoute(entity, route, deltaSeconds);
      entity.updatedAt = this.simulationTime.toISOString();
    }
  }

  /**
   * Добавить товар в рынок города.
   */
  private addCargoToMarket(cityId: string, cargo: ActiveWorldEntity['cargo']): void {
    let market = this.marketStates.get(cityId);
    if (!market) {
      market = this.createEmptyMarket(cityId);
      this.marketStates.set(cityId, market);
    }

    for (const item of cargo ?? []) {
      const goodMarket = market.goods.find((g) => g.goodsId === item.goodsId);
      if (goodMarket) {
        goodMarket.supply += item.quantity;
      }
    }
  }

  /**
   * Проверить respawn замороженных сущностей.
   */
  private checkFrozenRespawns(): void {
    for (const entity of this.activeEntities.values()) {
      if (entity.state !== 'frozen') {
        continue;
      }

      if (entity.frozenUntil && new Date(entity.frozenUntil) <= this.simulationTime) {
        this.logger.log(`Entity ${entity.id} thawing and respawning`);
        entity.state = 'respawning';
        entity.routeProgress = 0;
        entity.frozenUntil = undefined;

        // TODO: Переда Регенерировать груз по текущим ценам
      }
    }
  }

  /**
   * Проверить правила спавна и создать новые сущности.
   */
  private checkSpawnRules(): void {
    for (const rule of this.spawnRules.values()) {
      if (!rule.isActive) {
        continue;
      }

      // Проверить cooldown
      if (rule.lastSpawnTime) {
        const lastSpawn = new Date(rule.lastSpawnTime);
        const isBuildDev = process.env.NODE_ENV !== 'production';
        const cooldown = (isBuildDev ? rule.cooldownDev ?? 10 : rule.cooldownRelease ?? 1) * 60 * 1000;

        if (this.simulationTime.getTime() - lastSpawn.getTime() < cooldown) {
          continue;
        }
      }

      // Проверить вероятность
      if (Math.random() > rule.spawnWeight) {
        continue;
      }

      // Спавнить группу
      const groupSize = rule.minGroupSize + Math.floor(Math.random() * (rule.maxGroupSize - rule.minGroupSize + 1));
      let spawnedAny = false;

      for (let i = 0; i < groupSize; i++) {
        const archetypeId = rule.archetypeIds[Math.floor(Math.random() * rule.archetypeIds.length)];
        const archetype = this.archetypes.get(archetypeId);
        if (!archetype) {
          continue;
        }

        if (this.hasActiveEntityForArchetype(archetypeId)) {
          continue;
        }

        const route = this.getRandomRouteForArchetype(archetype);
        if (!route) {
          continue;
        }

        this.createActiveEntity(archetypeId, route.id);
        spawnedAny = true;
      }

      if (spawnedAny) {
        rule.lastSpawnTime = this.simulationTime.toISOString();
      }
    }
  }

  /**
   * Получить случайный маршрут для архетипа.
   */
  private getRandomRouteForArchetype(archetype: WorldNpcArchetype): WorldRoute | null {
    const validRoutes = Array.from(this.routes.values()).filter((r) =>
      r.allowedArchetypes.includes(archetype.id) && r.isActive,
    );

    if (validRoutes.length === 0) {
      return null;
    }

    return validRoutes[Math.floor(Math.random() * validRoutes.length)];
  }

  /**
   * Создать активную сущность.
   */
  private createActiveEntity(archetypeId: string, routeId: string): void {
    const archetype = this.archetypes.get(archetypeId);
    const route = this.routes.get(routeId);

    if (!archetype || !route) {
      return;
    }

    const firstWaypoint = route.waypoints[0];
    const start = this.getZoneAnchorCoordinates(firstWaypoint?.zoneId);
    const staminaDefaults = resolveWorldEntityStaminaDefaults(
      {},
      {
        maxStamina: this.defaultEntityMaxStamina,
        regenPerTick: this.defaultEntityStaminaRegenPerTick,
        moveCostPerWorldUnit: this.entityMoveCostPerWorldUnit,
      },
    );

    const entity: ActiveWorldEntity = {
      id: `active_${archetypeId}_${Date.now()}`,
      archetypeId,
      routeId,
      state: 'traveling',
      routeProgress: 0,
      routeWaypointIndex: 0,
      members: archetype.npcTemplateId ? [archetype.npcTemplateId] : [],
      visibility: {
        isVisibleToPlayer: true,
        anchorZoneId: firstWaypoint?.zoneId,
        anchorCoordinates: start,
      },
      maxStamina: staminaDefaults.maxStamina,
      currentStamina: staminaDefaults.currentStamina,
      staminaRegenPerTick: staminaDefaults.staminaRegenPerTick,
      interactions: {},
      createdAt: this.simulationTime.toISOString(),
      updatedAt: this.simulationTime.toISOString(),
    };

    // Если торговец, создать груз
    if (archetype.economyProfile) {
      entity.cargo = this.generateCargo(archetype);
    }

    // Добавить охранников
    if (archetype.escorts) {
      for (let i = 0; i < archetype.escorts.count; i++) {
        entity.members.push(archetype.escorts.npcTemplateId);
      }
    }

    this.activeEntities.set(entity.id, entity);
    this.logger.log(`Created active entity ${entity.id}`);
  }

  /**
   * Генерировать груз для торговца.
   */
  private generateCargo(archetype: WorldNpcArchetype): ActiveWorldEntity['cargo'] {
    if (!archetype.economyProfile) {
      return [];
    }

    const cargo: ActiveWorldEntity['cargo'] = [];

    for (const goodsId of archetype.economyProfile.goodsCategories) {
      const market = this.marketStates.get(archetype.economyProfile.homeCity);
      const goodMarket = market?.goods.find((g) => g.goodsId === goodsId);
      const buyPrice = goodMarket?.currentPrice ?? 100;

      cargo.push({
        goodsId,
        quantity: 10 + Math.floor(Math.random() * 40),
        buyPrice: Math.floor(buyPrice * archetype.economyProfile.buyBias),
      });
    }

    return cargo;
  }

  /**
   * Пересчитать цены всех городов.
   */
  private updateMarketPrices(): void {
    for (const market of this.marketStates.values()) {
      for (const goods of market.goods) {
        // Простая формула: цена = базовая * (1 + (спрос - предложение) / 100)
        const priceMultiplier = 1 + (goods.demand - goods.supply) / 100;
        const newPrice = Math.max(goods.basePrice * 0.5, Math.min(goods.basePrice * 2, goods.basePrice * priceMultiplier));

        goods.currentPrice = Math.floor(newPrice);
        goods.trend = Math.round(((newPrice - goods.basePrice) / goods.basePrice) * 100);
        goods.lastUpdatedAt = this.simulationTime.toISOString();
      }
    }
  }

  /**
   * Создать пустой рынок для города.
   */
  private createEmptyMarket(cityId: string): CityMarketState {
    return {
      id: `market_${cityId}`,
      cityId,
      goods: [
        { goodsId: 'spices', basePrice: 100, currentPrice: 100, supply: 50, demand: 60, trend: 0, lastUpdatedAt: this.simulationTime.toISOString() },
        { goodsId: 'cloth', basePrice: 80, currentPrice: 80, supply: 70, demand: 70, trend: 0, lastUpdatedAt: this.simulationTime.toISOString() },
        { goodsId: 'weapons', basePrice: 200, currentPrice: 200, supply: 20, demand: 25, trend: 0, lastUpdatedAt: this.simulationTime.toISOString() },
      ],
      updatedAt: this.simulationTime.toISOString(),
    };
  }

  /**
   * Добавить событие в лог.
   */
  private addEconomicEvent(event: EconomicEvent): void {
    event.id = `evt_${Date.now()}`;
    this.economicEvents.push(event);

    // Хранить только последние 1000 событий
    if (this.economicEvents.length > 1000) {
      this.economicEvents = this.economicEvents.slice(-1000);
    }
  }

  /**
   * Получить снимок мира для отправки на фронтенд.
   */
  getWorldSnapshot(): WorldSimulationSnapshot {
    const sourceTick = this.simulationTickCount;
    const generatedAt = this.simulationTime.toISOString();
    const activeEntities = Array.from(this.activeEntities.values())
      .filter((e) => e.visibility.isVisibleToPlayer)
      .map((e) => {
        const archetype = this.archetypes.get(e.archetypeId);
        const stamina = resolveWorldEntityStaminaDefaults(
          {
            maxStamina: e.maxStamina,
            currentStamina: e.currentStamina,
            staminaRegenPerTick: e.staminaRegenPerTick,
          },
          {
            maxStamina: this.defaultEntityMaxStamina,
            regenPerTick: this.defaultEntityStaminaRegenPerTick,
            moveCostPerWorldUnit: this.entityMoveCostPerWorldUnit,
          },
        );
        return {
          id: e.id,
          archetypeId: e.archetypeId,
          kind: archetype?.kind,
          npcTemplateId: archetype?.npcTemplateId,
          merchantId: archetype?.merchantId,
          sourceType: archetype?.sourceType,
          sourceId: archetype?.sourceId,
          state: e.state,
          spriteId:
            e.state === 'resting' && archetype?.restingWorldSpriteId
              ? archetype.restingWorldSpriteId
              : (archetype?.worldSpriteId ?? 'unknown'),
          portraitId: archetype?.portraitId,
          memberCount: e.members.length,
          zoneId: e.visibility.anchorZoneId ?? 'unknown',
          coordinates: e.visibility.anchorCoordinates ?? { x: 0, y: 0 },
          isHostile: archetype?.kind === 'bandit',
          hasQuest: false, // TODO: Проверить quest bindings
          updatedAt: e.updatedAt,
          sourceTick,
          maxStamina: stamina.maxStamina,
          currentStamina: stamina.currentStamina,
          staminaRegenPerTick: stamina.staminaRegenPerTick,
        };
      });

    return {
      sourceTick,
      generatedAt,
      activeEntities,
      cityMarkets: Array.from(this.marketStates.values()),
      events: this.economicEvents.slice(-100),
    };
  }

  /**
   * === АДМИН-ОПЕРАЦИИ (для админки) ===
   */

  // Управление архетипами
  createArchetype(archetype: WorldNpcArchetype): WorldNpcArchetype {
    const normalized = this.normalizeArchetype(archetype);
    this.archetypes.set(normalized.id, normalized);
    return normalized;
  }

  updateArchetype(archetypeId: string, updates: Partial<WorldNpcArchetype>): WorldNpcArchetype | null {
    const archetype = this.archetypes.get(archetypeId);
    if (!archetype) {
      return null;
    }
    const updated = this.normalizeArchetype({
      ...archetype,
      ...updates,
      updatedAt: this.simulationTime.toISOString(),
    });
    this.archetypes.set(archetypeId, updated);
    return updated;
  }

  getArchetype(archetypeId: string): WorldNpcArchetype | null {
    return this.archetypes.get(archetypeId) ?? null;
  }

  listArchetypes(): WorldNpcArchetype[] {
    return Array.from(this.archetypes.values());
  }

  deleteArchetype(archetypeId: string): {
    success: boolean;
    removedActiveEntities: number;
    updatedRoutes: number;
    updatedSpawnRules: number;
  } {
    if (!this.archetypes.has(archetypeId)) {
      return {
        success: false,
        removedActiveEntities: 0,
        updatedRoutes: 0,
        updatedSpawnRules: 0,
      };
    }

    this.archetypes.delete(archetypeId);

    let removedActiveEntities = 0;
    for (const [entityId, entity] of this.activeEntities.entries()) {
      if (entity.archetypeId !== archetypeId) {
        continue;
      }
      this.activeEntities.delete(entityId);
      removedActiveEntities += 1;
    }

    let updatedRoutes = 0;
    for (const [routeId, route] of this.routes.entries()) {
      if (!route.allowedArchetypes.includes(archetypeId)) {
        continue;
      }

      const allowedArchetypes = route.allowedArchetypes.filter((id) => id !== archetypeId);
      this.routes.set(routeId, {
        ...route,
        allowedArchetypes,
        isActive: allowedArchetypes.length > 0 ? route.isActive : false,
        updatedAt: this.simulationTime.toISOString(),
      });
      updatedRoutes += 1;
    }

    let updatedSpawnRules = 0;
    for (const [ruleId, rule] of this.spawnRules.entries()) {
      if (!rule.archetypeIds.includes(archetypeId)) {
        continue;
      }

      const archetypeIds = rule.archetypeIds.filter((id) => id !== archetypeId);
      this.spawnRules.set(ruleId, {
        ...rule,
        archetypeIds,
        isActive: archetypeIds.length > 0 ? rule.isActive : false,
        updatedAt: this.simulationTime.toISOString(),
      });
      updatedSpawnRules += 1;
    }

    return {
      success: true,
      removedActiveEntities,
      updatedRoutes,
      updatedSpawnRules,
    };
  }

  // Управление маршрутами
  createRoute(route: WorldRoute): WorldRoute {
    const normalized = this.sanitizeRouteForBanditPolicy(route);
    this.routes.set(normalized.id, normalized);
    return normalized;
  }

  updateRoute(routeId: string, updates: Partial<WorldRoute>): WorldRoute | null {
    const route = this.routes.get(routeId);
    if (!route) {
      return null;
    }
    const updated = this.sanitizeRouteForBanditPolicy({
      ...route,
      ...updates,
      updatedAt: this.simulationTime.toISOString(),
    });
    this.routes.set(routeId, updated);
    return updated;
  }

  getRoute(routeId: string): WorldRoute | null {
    return this.routes.get(routeId) ?? null;
  }

  listRoutes(): WorldRoute[] {
    return Array.from(this.routes.values());
  }

  // Управление правилами спавна
  createSpawnRule(rule: WorldSpawnRule): WorldSpawnRule {
    this.spawnRules.set(rule.id, rule);
    return rule;
  }

  updateSpawnRule(ruleId: string, updates: Partial<WorldSpawnRule>): WorldSpawnRule | null {
    const rule = this.spawnRules.get(ruleId);
    if (!rule) {
      return null;
    }
    const updated = { ...rule, ...updates, updatedAt: this.simulationTime.toISOString() };
    this.spawnRules.set(ruleId, updated);
    return updated;
  }

  getSpawnRule(ruleId: string): WorldSpawnRule | null {
    return this.spawnRules.get(ruleId) ?? null;
  }

  listSpawnRules(): WorldSpawnRule[] {
    return Array.from(this.spawnRules.values());
  }

  // Управление активными сущностями (GM commands)
  listActiveEntities(): ActiveWorldEntity[] {
    return Array.from(this.activeEntities.values());
  }

  killEntity(entityId: string): boolean {
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      return false;
    }
    entity.state = 'dead';
    entity.frozenUntil = new Date(this.simulationTime.getTime() + 24 * 3600 * 1000).toISOString();
    return true;
  }

  teleportEntity(entityId: string, zoneId: string, coordinates: { x: number; y: number }): boolean {
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      return false;
    }
    entity.visibility.anchorZoneId = zoneId;
    entity.visibility.anchorCoordinates = coordinates;
    entity.routePolyline = undefined;
    entity.routePolylineIndex = undefined;
    return true;
  }

  freezeEntity(entityId: string, durationHours: number): boolean {
    const entity = this.activeEntities.get(entityId);
    if (!entity) {
      return false;
    }
    entity.state = 'frozen';
    entity.frozenUntil = new Date(this.simulationTime.getTime() + durationHours * 3600 * 1000).toISOString();
    return true;
  }
}

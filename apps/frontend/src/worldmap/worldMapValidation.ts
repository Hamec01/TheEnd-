import type { BattleMapDefinition } from '@theend/rpg-domain';
import type { City } from '../types/city';
import type { NpcDefinition } from '../types/npc';
import type { QuestDefinition, QuestMarkerDefinition } from '../types/quest';
import type { AdminItem, LootTable } from '../services/content/models';
import type { WorldMapZone, ZoneType } from './zoneEditorTypes';
import {
  getDefaultBlocksClick,
  getDefaultEditorLayer,
  getDefaultInteractionMode,
  getDefaultPassiveEffects,
  getDefaultPlayerClickable,
  getDefaultZoneColor,
  type MapEditorLayer,
  type ZoneInteractionMode,
} from './zoneTaxonomy';
import { isInsideZone } from './zoneSystem';

export type WorldMapValidationSeverity =
  | 'error'
  | 'warning'
  | 'info';

export type WorldMapRepairActionId =
  | 'repair_city_location'
  | 'repair_city_area'
  | 'repair_kingdom_area'
  | 'repair_faction_area'
  | 'repair_resource_area'
  | 'repair_quest_area'
  | 'repair_random_event_area'
  | 'repair_danger_area'
  | 'assign_default_color'
  | 'assign_default_layer_contract'
  | 'remove_null_entry';

export type WorldMapValidationIssue = {
  id: string;
  severity: WorldMapValidationSeverity;
  code: string;
  message: string;
  zoneId?: string;
  zoneName?: string;
  editorLayer?: MapEditorLayer;
  field?: string;
  expected?: string;
  actual?: string;
  repairAction?: WorldMapRepairActionId;
};

export type ValidateWorldMapContentArgs = {
  zones: unknown[];
  questMarkers?: unknown[];
  npcs?: unknown[];
  quests?: unknown[];
  cities?: unknown[];
  lootTables?: unknown[];
  battleMaps?: unknown[];
  items?: unknown[];
  professionIds?: string[];
  mineIds?: string[];
  biomes?: unknown[];
  trees?: unknown[];
};

const KNOWN_ZONE_TYPES: Set<ZoneType> = new Set<ZoneType>([
  'city',
  'settlement',
  'location',
  'quest',
  'quest_area',
  'random_event_area',
  'danger_area',
  'faction_area',
  'kingdom_area',
  'city_area',
  'resource_area',
  'hidden_area',
  'story',
  'landmark',
  'danger',
  'grind',
  'resource',
  'profession',
  'dungeon',
  'transition',
  'safe',
  'event',
  'faction',
  'locked',
  'fast_travel',
  'rest',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function asLayer(value: unknown): MapEditorLayer | null {
  if (value === 'areas' || value === 'locations' || value === 'quests' || value === 'resources' || value === 'zones') {
    return value;
  }
  return null;
}

function asInteraction(value: unknown): ZoneInteractionMode | null {
  if (
    value === 'none'
    || value === 'inspect'
    || value === 'enter'
    || value === 'quest'
    || value === 'resource'
    || value === 'battle'
    || value === 'random_event'
    || value === 'danger'
    || value === 'transition'
    || value === 'fast_travel'
    || value === 'rest'
    || value === 'locked'
  ) {
    return value;
  }
  return null;
}

function isQuestMarker(value: unknown): value is QuestMarkerDefinition {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.mapId === 'string'
    && typeof value.x === 'number'
    && typeof value.y === 'number';
}

function getZoneLayer(zone: WorldMapZone): MapEditorLayer {
  return asLayer(zone.editorLayer) ?? getDefaultEditorLayer(zone.type);
}

function normalizeCityReferenceKey(value: string): string {
  const lower = value.trim().toLowerCase();
  if (!lower) {
    return '';
  }
  if (lower.startsWith('city_')) {
    return lower.slice('city_'.length);
  }
  return lower;
}

function buildCityReferenceSet(cities: City[]): Set<string> {
  const out = new Set<string>();

  for (const city of cities) {
    const cityId = asNonEmptyString((city as unknown as Record<string, unknown>).id);
    if (cityId) {
      out.add(cityId.toLowerCase());
      out.add(normalizeCityReferenceKey(cityId));
    }

    const slug = asNonEmptyString((city as unknown as Record<string, unknown>).slug);
    if (slug) {
      out.add(slug.toLowerCase());
      out.add(normalizeCityReferenceKey(slug));
    }

    const name = asNonEmptyString((city as unknown as Record<string, unknown>).name);
    if (name) {
      out.add(name.toLowerCase());
    }
  }

  return out;
}

function hasPassiveEnabled(value: unknown, type: ZoneType): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  const fallback = getDefaultPassiveEffects(type);
  if (typeof fallback === 'boolean') {
    return fallback;
  }
  return fallback.length > 0;
}

function hasColor(zone: WorldMapZone): boolean {
  return typeof zone.color === 'string' && zone.color.trim().length > 0;
}

function pushIssue(
  issues: WorldMapValidationIssue[],
  nextId: { current: number },
  issue: Omit<WorldMapValidationIssue, 'id'>,
): void {
  issues.push({
    id: `wmv-${nextId.current++}`,
    ...issue,
  });
}

function toIdSet<T extends Record<string, unknown>>(items: T[], key: keyof T = 'id'): Set<string> {
  const set = new Set<string>();
  for (const item of items) {
    const value = asNonEmptyString(item[key]);
    if (value) {
      set.add(value);
    }
  }
  return set;
}

function normalizeZoneType(rawType: unknown): ZoneType | null {
  if (typeof rawType !== 'string') {
    return null;
  }
  const type = rawType as ZoneType;
  return KNOWN_ZONE_TYPES.has(type) ? type : null;
}

function getMarkersInsideZone(zone: WorldMapZone, markers: QuestMarkerDefinition[]): QuestMarkerDefinition[] {
  return markers.filter((marker) => marker.mapId === 'worldmap-main' && isInsideZone(zone, marker.x, marker.y, 0));
}

function validateZoneContract(
  zone: WorldMapZone,
  issues: WorldMapValidationIssue[],
  nextId: { current: number },
): void {
  const actualLayer = getZoneLayer(zone);
  const actualInteraction = asInteraction(zone.interactionMode) ?? getDefaultInteractionMode(zone.type);
  const actualClickable = typeof zone.playerClickable === 'boolean' ? zone.playerClickable : getDefaultPlayerClickable(zone.type);
  const actualBlocksClick = typeof zone.blocksClick === 'boolean' ? zone.blocksClick : getDefaultBlocksClick(zone.type);
  const actualPassive = hasPassiveEnabled(zone.passiveEffects, zone.type);

  const pushContractIssue = (
    severity: WorldMapValidationSeverity,
    code: string,
    message: string,
    expected: string,
    actual: string,
    field: string,
    repairAction: WorldMapRepairActionId,
  ) => {
    pushIssue(issues, nextId, {
      severity,
      code,
      message,
      zoneId: zone.id,
      zoneName: zone.name,
      editorLayer: actualLayer,
      field,
      expected,
      actual,
      repairAction,
    });
  };

  if (zone.type === 'city') {
    if (actualLayer !== 'locations') {
      pushContractIssue('error', 'city.layer', 'Город должен быть в слое Локации.', 'locations', actualLayer, 'editorLayer', 'repair_city_location');
    }
    if (actualInteraction !== 'enter') {
      pushContractIssue('error', 'city.interaction', 'Город должен иметь interactionMode=enter.', 'enter', actualInteraction, 'interactionMode', 'repair_city_location');
    }
    if (actualClickable !== true) {
      pushContractIssue('error', 'city.clickable', 'Город должен быть кликабельным для входа.', 'true', String(actualClickable), 'playerClickable', 'repair_city_location');
    }
    if (actualBlocksClick !== true) {
      pushContractIssue('warning', 'city.blocks', 'Город должен иметь blocksClick=true.', 'true', String(actualBlocksClick), 'blocksClick', 'repair_city_location');
    }
    if (actualPassive !== false) {
      pushContractIssue('warning', 'city.passive', 'Для city рекомендуется passiveEffects=false.', 'false', String(actualPassive), 'passiveEffects', 'repair_city_location');
    }
    if (!asNonEmptyString(zone.cityId)) {
      pushIssue(issues, nextId, {
        severity: 'error',
        code: 'city.cityId',
        message: 'У города не указан cityId.',
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: actualLayer,
        field: 'cityId',
        repairAction: 'repair_city_location',
      });
    }
    return;
  }

  if (zone.type === 'location') {
    if (actualLayer !== 'locations') {
      pushContractIssue('warning', 'location.layer', 'Location-маркер должен быть в слое Локации.', 'locations', actualLayer, 'editorLayer', 'assign_default_layer_contract');
    }
    if (actualInteraction !== 'enter') {
      pushContractIssue('warning', 'location.interaction', 'Location-маркер обычно использует interactionMode=enter.', 'enter', actualInteraction, 'interactionMode', 'assign_default_layer_contract');
    }
    if (actualClickable !== true) {
      pushContractIssue('warning', 'location.clickable', 'Location-маркер должен быть кликабельным.', 'true', String(actualClickable), 'playerClickable', 'assign_default_layer_contract');
    }
    return;
  }

  if (zone.type === 'city_area') {
    if (actualLayer !== 'areas') {
      pushContractIssue('warning', 'city_area.layer', 'city_area — это территория города, а не вход в город.', 'areas', actualLayer, 'editorLayer', 'repair_city_area');
    }
    if (actualInteraction !== 'none') {
      pushContractIssue('warning', 'city_area.interaction', 'city_area — это территория города, а не вход в город.', 'none', actualInteraction, 'interactionMode', 'repair_city_area');
    }
    if (actualClickable !== false) {
      pushContractIssue('error', 'city_area.clickable', 'city_area не должна быть кликабельной.', 'false', String(actualClickable), 'playerClickable', 'repair_city_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'city_area.blocks', 'Для входа в город нужен отдельный объект type=city.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_city_area');
    }
    if (actualPassive !== true) {
      pushContractIssue('warning', 'city_area.passive', 'city_area должна иметь passiveEffects=true.', 'true', String(actualPassive), 'passiveEffects', 'repair_city_area');
    }
    return;
  }

  if (zone.type === 'kingdom_area') {
    if (actualLayer !== 'areas') {
      pushContractIssue('warning', 'kingdom_area.layer', 'kingdom_area должна быть в слое Территории.', 'areas', actualLayer, 'editorLayer', 'repair_kingdom_area');
    }
    if (actualInteraction !== 'none') {
      pushContractIssue('warning', 'kingdom_area.interaction', 'kingdom_area должна иметь interactionMode=none.', 'none', actualInteraction, 'interactionMode', 'repair_kingdom_area');
    }
    if (actualClickable !== false) {
      pushContractIssue('error', 'kingdom_area.clickable', 'kingdom_area — политическая территория. Она не должна быть кликабельной.', 'false', String(actualClickable), 'playerClickable', 'repair_kingdom_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'kingdom_area.blocks', 'kingdom_area должна иметь blocksClick=false.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_kingdom_area');
    }
    if (actualPassive !== true) {
      pushContractIssue('warning', 'kingdom_area.passive', 'kingdom_area должна иметь passiveEffects=true, чтобы влиять на законы, цены и правила.', 'true', String(actualPassive), 'passiveEffects', 'repair_kingdom_area');
    }
    return;
  }

  if (zone.type === 'faction_area') {
    if (actualLayer !== 'areas') {
      pushContractIssue('warning', 'faction_area.layer', 'faction_area должна быть в слое Территории.', 'areas', actualLayer, 'editorLayer', 'repair_faction_area');
    }
    if (actualInteraction !== 'none') {
      pushContractIssue('warning', 'faction_area.interaction', 'faction_area должна иметь interactionMode=none.', 'none', actualInteraction, 'interactionMode', 'repair_faction_area');
    }
    if (actualClickable !== false) {
      pushContractIssue('error', 'faction_area.clickable', 'faction_area — зона влияния фракции. Она не должна быть кликабельной.', 'false', String(actualClickable), 'playerClickable', 'repair_faction_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'faction_area.blocks', 'faction_area должна иметь blocksClick=false.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_faction_area');
    }
    if (actualPassive !== true) {
      pushContractIssue('warning', 'faction_area.passive', 'faction_area должна иметь passiveEffects=true.', 'true', String(actualPassive), 'passiveEffects', 'repair_faction_area');
    }
    return;
  }

  if (zone.type === 'resource_area') {
    if (actualLayer !== 'resources') {
      pushContractIssue('warning', 'resource_area.layer', 'resource_area должна быть в слое Ресурсы.', 'resources', actualLayer, 'editorLayer', 'repair_resource_area');
    }
    if (actualInteraction !== 'resource') {
      pushContractIssue('warning', 'resource_area.interaction', 'resource_area должна иметь interactionMode=resource.', 'resource', actualInteraction, 'interactionMode', 'repair_resource_area');
    }
    if (actualClickable !== false) {
      pushContractIssue('error', 'resource_area.clickable', 'resource_area не кликается напрямую. Она должна открываться через Осмотреться.', 'false', String(actualClickable), 'playerClickable', 'repair_resource_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'resource_area.blocks', 'resource_area должна иметь blocksClick=false.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_resource_area');
    }
    if (actualPassive !== true) {
      pushContractIssue('warning', 'resource_area.passive', 'resource_area должна иметь passiveEffects=true.', 'true', String(actualPassive), 'passiveEffects', 'repair_resource_area');
    }
    return;
  }

  if (zone.type === 'quest_area') {
    if (actualLayer !== 'quests') {
      pushContractIssue('warning', 'quest_area.layer', 'quest_area должна быть в слое Квесты.', 'quests', actualLayer, 'editorLayer', 'repair_quest_area');
    }
    if (actualInteraction !== 'quest') {
      pushContractIssue('warning', 'quest_area.interaction', 'quest_area должна иметь interactionMode=quest.', 'quest', actualInteraction, 'interactionMode', 'repair_quest_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'quest_area.blocks', 'quest_area рекомендуется с blocksClick=false.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_quest_area');
    }
    return;
  }

  if (zone.type === 'random_event_area') {
    if (actualLayer !== 'zones') {
      pushContractIssue('warning', 'random_event_area.layer', 'random_event_area должна быть в слое Зоны.', 'zones', actualLayer, 'editorLayer', 'repair_random_event_area');
    }
    if (actualInteraction !== 'random_event') {
      pushContractIssue('warning', 'random_event_area.interaction', 'random_event_area должна иметь interactionMode=random_event.', 'random_event', actualInteraction, 'interactionMode', 'repair_random_event_area');
    }
    if (actualClickable !== false) {
      pushContractIssue('error', 'random_event_area.clickable', 'random_event_area не должна быть кликабельной напрямую.', 'false', String(actualClickable), 'playerClickable', 'repair_random_event_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'random_event_area.blocks', 'random_event_area должна иметь blocksClick=false.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_random_event_area');
    }
    if (actualPassive !== true) {
      pushContractIssue('warning', 'random_event_area.passive', 'random_event_area должна работать как пассивная зона событий.', 'true', String(actualPassive), 'passiveEffects', 'repair_random_event_area');
    }
    return;
  }

  if (zone.type === 'danger_area') {
    if (actualLayer !== 'zones') {
      pushContractIssue('warning', 'danger_area.layer', 'danger_area должна быть в слое Зоны.', 'zones', actualLayer, 'editorLayer', 'repair_danger_area');
    }
    if (actualInteraction !== 'danger') {
      pushContractIssue('warning', 'danger_area.interaction', 'danger_area должна иметь interactionMode=danger.', 'danger', actualInteraction, 'interactionMode', 'repair_danger_area');
    }
    if (actualClickable !== false) {
      pushContractIssue('error', 'danger_area.clickable', 'danger_area — пассивная опасная область/PvP/сильные враги. Она не должна быть прямой кнопкой.', 'false', String(actualClickable), 'playerClickable', 'repair_danger_area');
    }
    if (actualBlocksClick !== false) {
      pushContractIssue('warning', 'danger_area.blocks', 'danger_area должна иметь blocksClick=false.', 'false', String(actualBlocksClick), 'blocksClick', 'repair_danger_area');
    }
    if (actualPassive !== true) {
      pushContractIssue('warning', 'danger_area.passive', 'danger_area должна иметь passiveEffects=true.', 'true', String(actualPassive), 'passiveEffects', 'repair_danger_area');
    }
  }
}

export function validateWorldMapContent(args: ValidateWorldMapContentArgs): WorldMapValidationIssue[] {
  const issues: WorldMapValidationIssue[] = [];
  const nextId = { current: 1 };

  const zonesRaw = Array.isArray(args.zones) ? args.zones : [];
  const questMarkers = (Array.isArray(args.questMarkers) ? args.questMarkers : []).filter(isQuestMarker);
  const quests = (Array.isArray(args.quests) ? args.quests : []).filter(isRecord);
  const cities = (Array.isArray(args.cities) ? args.cities : []).filter(isRecord) as unknown as City[];
  const lootTables = (Array.isArray(args.lootTables) ? args.lootTables : []).filter(isRecord) as unknown as LootTable[];
  const items = (Array.isArray(args.items) ? args.items : []).filter(isRecord) as unknown as AdminItem[];
  const battleMaps = (Array.isArray(args.battleMaps) ? args.battleMaps : []).filter(isRecord) as unknown as BattleMapDefinition[];
  const npcs = (Array.isArray(args.npcs) ? args.npcs : []).filter(isRecord) as unknown as NpcDefinition[];

  const questsById = toIdSet(quests);
  const citiesByReference = buildCityReferenceSet(cities);
  const lootTableIds = toIdSet(lootTables as unknown as Record<string, unknown>[]);
  const itemIds = toIdSet(items as unknown as Record<string, unknown>[]);
  const battleMapIds = toIdSet(battleMaps as unknown as Record<string, unknown>[]);
  const npcIds = toIdSet(npcs as unknown as Record<string, unknown>[]);
  const professionIds = new Set<string>(Array.isArray(args.professionIds) ? args.professionIds.filter((entry) => typeof entry === 'string' && entry.trim().length > 0) : []);
  const mineIds = new Set<string>(Array.isArray(args.mineIds) ? args.mineIds.filter((entry) => typeof entry === 'string' && entry.trim().length > 0) : []);

  if (cities.length === 0 || quests.length === 0 || lootTables.length === 0 || battleMaps.length === 0 || items.length === 0) {
    pushIssue(issues, nextId, {
      severity: 'info',
      code: 'content.references.limited',
      message: 'Проверка ссылок ограничена: полный content database недоступен на фронте.',
    });
  }

  const seenIds = new Map<string, number>();
  const validZones: WorldMapZone[] = [];

  zonesRaw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      pushIssue(issues, nextId, {
        severity: 'error',
        code: 'zone.null',
        message: 'Объект карты пустой или повреждён.',
        field: `zones[${index}]`,
        repairAction: 'remove_null_entry',
      });
      return;
    }

    const id = asNonEmptyString(entry.id);
    const name = asNonEmptyString(entry.name);
    const rawType = entry.type;
    const normalizedType = normalizeZoneType(rawType);

    if (!id) {
      pushIssue(issues, nextId, {
        severity: 'error',
        code: 'zone.id.missing',
        message: 'У объекта карты нет id.',
        zoneName: name ?? undefined,
        field: 'id',
      });
      return;
    }

    if (!name) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.name.missing',
        message: 'У объекта карты нет названия.',
        zoneId: id,
        field: 'name',
      });
    }

    if (!entry.editorLayer) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.layer.missing',
        message: 'Не указан слой редактора. Будет использован слой по типу.',
        zoneId: id,
        zoneName: name ?? undefined,
        field: 'editorLayer',
        repairAction: 'assign_default_layer_contract',
      });
    }

    if (rawType == null || rawType === '') {
      pushIssue(issues, nextId, {
        severity: 'error',
        code: 'zone.type.missing',
        message: 'Не указан тип объекта.',
        zoneId: id,
        zoneName: name ?? undefined,
        field: 'type',
      });
      return;
    }

    if (!normalizedType) {
      pushIssue(issues, nextId, {
        severity: 'error',
        code: 'zone.type.unknown',
        message: 'Тип объекта не поддерживается taxonomy/backend.',
        zoneId: id,
        zoneName: name ?? undefined,
        field: 'type',
        actual: String(rawType),
      });
      return;
    }

    const normalizedZone = entry as unknown as WorldMapZone;
    validZones.push(normalizedZone);

    if (!hasColor(normalizedZone)) {
      pushIssue(issues, nextId, {
        severity: 'info',
        code: 'zone.color.missing',
        message: 'Цвет не задан. Используется цвет по умолчанию.',
        zoneId: id,
        zoneName: name ?? undefined,
        editorLayer: getZoneLayer(normalizedZone),
        field: 'color',
        repairAction: 'assign_default_color',
      });
    }

    seenIds.set(id, (seenIds.get(id) ?? 0) + 1);
  });

  for (const [id, count] of seenIds.entries()) {
    if (count > 1) {
      const zone = validZones.find((entry) => entry.id === id);
      pushIssue(issues, nextId, {
        severity: 'error',
        code: 'zone.id.duplicate',
        message: 'Дублирующийся id объекта карты.',
        zoneId: id,
        zoneName: zone?.name,
        editorLayer: zone ? getZoneLayer(zone) : undefined,
        field: 'id',
      });
    }
  }

  const zoneIdSet = new Set(validZones.map((zone) => zone.id));

  for (const zone of validZones) {
    validateZoneContract(zone, issues, nextId);

    const zoneLayer = getZoneLayer(zone);
    const cityId = asNonEmptyString(zone.cityId);
    const linkedLocationId = asNonEmptyString(zone.linkedLocationId ?? zone.linkedLocation);
    const requiredQuestId = asNonEmptyString(zone.requiredQuestId);
    const requiredItemId = asNonEmptyString(zone.requiredItemId);
    const parentAreaId = asNonEmptyString(zone.parentAreaId);
    const locationSprite = zone.locationSprite;

    if (locationSprite) {
      if (typeof locationSprite.scale === 'number' && locationSprite.scale <= 0) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.sprite.scale.invalid',
          message: 'locationSprite.scale должен быть больше 0.',
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'locationSprite.scale',
        });
      }
      const imageUrl = asNonEmptyString(locationSprite.imageUrl);
      if (imageUrl && /^[a-zA-Z]:[\\/]/.test(imageUrl)) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.sprite.imageUrl.localPath',
          message: 'locationSprite.imageUrl похож на локальный путь Windows. Игра не упадет, но картинка не загрузится в браузере.',
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'locationSprite.imageUrl',
        });
      }
    }

    if (zone.type === 'city' || zone.type === 'city_area') {
      if (cityId && citiesByReference.size > 0 && !citiesByReference.has(cityId.toLowerCase()) && !citiesByReference.has(normalizeCityReferenceKey(cityId))) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.city.reference_missing',
          message: `cityId=${cityId} не найден в списке городов.`,
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'cityId',
        });
      }
    }

    if (zone.type === 'location' && !linkedLocationId) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.location.linked_missing',
        message: 'У zone type=location не указан linkedLocationId.',
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'linkedLocationId',
      });
    }

    if (requiredQuestId && questsById.size > 0 && !questsById.has(requiredQuestId)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.requiredQuest.missing',
        message: `questId=${requiredQuestId} не найден.`,
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'requiredQuestId',
      });
    }

    if (requiredItemId && itemIds.size > 0 && !itemIds.has(requiredItemId)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.requiredItem.missing',
        message: `requiredItemId=${requiredItemId} не найден.`,
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'requiredItemId',
      });
    }

    if (parentAreaId && !zoneIdSet.has(parentAreaId)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.parentArea.missing',
        message: `parentAreaId=${parentAreaId} не найден.`,
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'parentAreaId',
      });
    }

    if (zone.type === 'resource_area' || zone.type === 'resource') {
      const resourceTableId = asNonEmptyString(zone.resourceTableId);
      const resourceKind = asNonEmptyString((zone as WorldMapZone & { resourceKind?: string }).resourceKind);
      const mineId = asNonEmptyString((zone as WorldMapZone & { mineId?: string }).mineId);
      if (resourceTableId && lootTableIds.size > 0 && !lootTableIds.has(resourceTableId)) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.resourceTable.missing',
          message: `resourceTableId=${resourceTableId} не найден.`,
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'resourceTableId',
        });
      }
      if (!resourceTableId && resourceKind !== 'mine') {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.resourceTable.empty',
          message: 'resource_area без resourceTableId: добыча может быть недоступна.',
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'resourceTableId',
        });
      }

      const professionId = asNonEmptyString(zone.professionId);
      if (!professionId) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.profession.empty',
          message: 'resource_area без professionId: проверка профессии недоступна.',
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'professionId',
        });
      } else if (professionIds.size > 0 && !professionIds.has(professionId)) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.profession.missing',
          message: `professionId=${professionId} не найден.`,
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'professionId',
        });
      }

      if (resourceKind === 'mine') {
        if (!mineId) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.mineId.empty',
            message: 'Mine zone requires mineId.',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'mineId',
          });
        } else if (mineIds.size > 0 && !mineIds.has(mineId)) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.mineId.missing',
            message: `mineId=${mineId} not found.`,
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'mineId',
          });
        }

        if (!professionId) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.mine.profession.empty',
            message: 'Mine zone should usually have professionId=mining.',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'professionId',
          });
        } else if (professionId !== 'mining') {
          pushIssue(issues, nextId, {
            severity: 'info',
            code: 'zone.mine.profession.unusual',
            message: `Mine zone usually uses professionId=mining, current value is ${professionId}.`,
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'professionId',
          });
        }

        if (!mineId && resourceTableId) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.mine.resourceTable.notMineId',
            message: 'Resource Table Id is not Mine Id. Fill Mine Id for mining mini-game.',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'mineId',
          });
        }
      }

      if (resourceKind === 'forest') {
        const forestId = asNonEmptyString((zone as any).forestId);
        const biomeId = asNonEmptyString((zone as any).biomeId);
        const treePool = asNonEmptyString((zone as any).treePool);
        const woodcuttingTier = (zone as any).woodcuttingTier;

        if (!forestId) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.forestId.empty',
            message: 'Лесная зона требует указания forestId.',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'forestId',
          });
        }
        const dbBiomes = Array.isArray(args.biomes) ? (args.biomes as any[]) : [];
        const selectedBiome = biomeId ? dbBiomes.find(b => b.id === biomeId) : null;

        if (!biomeId) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.biomeId.empty',
            message: 'Лесная зона требует указания биома (biomeId).',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'biomeId',
          });
        } else if (!selectedBiome) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.biomeId.invalid',
            message: `Указан несуществующий биом: ${biomeId}`,
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'biomeId',
          });
        }

        const hasZoneTrees = treePool !== null && treePool.trim().length > 0;
        const hasBiomeTrees = selectedBiome && (
          (Array.isArray(selectedBiome.resourcePools?.forest) && selectedBiome.resourcePools.forest.length > 0) ||
          (Array.isArray(selectedBiome.defaultTreePool) && selectedBiome.defaultTreePool.length > 0)
        );

        if (!hasZoneTrees && !hasBiomeTrees) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.treePool.empty',
            message: 'В этой зоне и выбранном биоме нет доступных деревьев для рубки.',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'treePool',
          });
        }
        if (woodcuttingTier === undefined || woodcuttingTier === null) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.woodcuttingTier.empty',
            message: 'Лесная зона требует указания уровня рубки (woodcuttingTier).',
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'woodcuttingTier',
          });
        }
      } else if (mineId) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.mineId.withoutMineKind',
          message: 'mineId is set, but resourceKind is not mine.',
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'resourceKind',
        });
      }
    }

    if (zone.type === 'quest_area') {
      const hasQuestReference = Boolean(asNonEmptyString(zone.requiredQuestId));
      const markersInside = getMarkersInsideZone(zone, questMarkers);
      if (!hasQuestReference && markersInside.length === 0) {
        pushIssue(issues, nextId, {
          severity: 'warning',
          code: 'zone.quest_area.unlinked',
          message: 'quest_area должна быть связана с questId или quest marker.',
          zoneId: zone.id,
          zoneName: zone.name,
          editorLayer: zoneLayer,
          field: 'requiredQuestId',
        });
      }
    }

    const targetScene = asNonEmptyString(zone.targetScene);
    if ((zone.type === 'transition' || zone.type === 'fast_travel') && !targetScene) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.targetScene.empty',
        message: `${zone.type} без targetScene: переход не сработает.`,
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'targetScene',
      });
    }

    if (targetScene && targetScene.toLowerCase().startsWith('battlemap_') && battleMapIds.size > 0 && !battleMapIds.has(targetScene)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.battleMap.missing',
        message: `battleMapId=${targetScene} не найден.`,
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'targetScene',
      });
    }

    const enemyTableId = asNonEmptyString(zone.enemyTableId);
    if (enemyTableId && lootTableIds.size > 0 && !lootTableIds.has(enemyTableId)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'zone.enemyTable.missing',
        message: `enemyTableId=${enemyTableId} не найден.`,
        zoneId: zone.id,
        zoneName: zone.name,
        editorLayer: zoneLayer,
        field: 'enemyTableId',
      });
    }

    if (Array.isArray(zone.randomQuestPoolIds) && zone.randomQuestPoolIds.length > 0 && questsById.size > 0) {
      for (const questId of zone.randomQuestPoolIds) {
        if (!questsById.has(questId)) {
          pushIssue(issues, nextId, {
            severity: 'warning',
            code: 'zone.randomQuest.missing',
            message: `questId=${questId} не найден.`,
            zoneId: zone.id,
            zoneName: zone.name,
            editorLayer: zoneLayer,
            field: 'randomQuestPoolIds',
          });
        }
      }
    }
  }

  for (const marker of questMarkers) {
    if (marker.linkedQuestId && questsById.size > 0 && !questsById.has(marker.linkedQuestId)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'marker.quest.missing',
        message: `questId=${marker.linkedQuestId} не найден.`,
        field: 'linkedQuestId',
      });
    }

    if (marker.linkedNpcId && npcIds.size > 0 && !npcIds.has(marker.linkedNpcId)) {
      pushIssue(issues, nextId, {
        severity: 'warning',
        code: 'marker.npc.missing',
        message: `linkedNpcId=${marker.linkedNpcId} не найден.`,
        field: 'linkedNpcId',
      });
    }
  }

  return issues;
}

function resolveDefaultColor(type: ZoneType, layer: MapEditorLayer): string {
  return getDefaultZoneColor(type, layer);
}

function deriveCanonicalCityId(zone: WorldMapZone): string {
  const rawCityId = asNonEmptyString(zone.cityId);
  if (rawCityId) {
    return normalizeCityReferenceKey(rawCityId);
  }

  const probe = `${zone.id} ${zone.name}`.toLowerCase();
  if (probe.includes('арклейн') || probe.includes('arklein')) {
    return 'arklein';
  }

  const cleaned = zone.id
    .toLowerCase()
    .replace(/^city_/, '')
    .replace(/^zone_/, '')
    .replace(/_city$/, '')
    .trim();

  return cleaned || 'arklein';
}

function applyContractDefaults(zone: WorldMapZone, type: ZoneType, layer: MapEditorLayer): WorldMapZone {
  const interactionMode = getDefaultInteractionMode(type);
  const playerClickable = getDefaultPlayerClickable(type);
  const blocksClick = getDefaultBlocksClick(type);
  const passiveDefaults = getDefaultPassiveEffects(type);
  const passiveEffects = typeof passiveDefaults === 'boolean' ? passiveDefaults : passiveDefaults.length > 0;

  return {
    ...zone,
    type,
    editorLayer: layer,
    interactionMode,
    playerClickable,
    blocksClick,
    passiveEffects,
    color: zone.color && zone.color.trim().length > 0 ? zone.color : resolveDefaultColor(type, layer),
    updatedAt: Date.now(),
  };
}

export function applyWorldMapRepairAction(zone: WorldMapZone, action: WorldMapRepairActionId): WorldMapZone {
  if (action === 'assign_default_color') {
    const layer = getZoneLayer(zone);
    return {
      ...zone,
      color: resolveDefaultColor(zone.type, layer),
      updatedAt: Date.now(),
    };
  }

  if (action === 'assign_default_layer_contract') {
    const type = zone.type;
    const layer = getDefaultEditorLayer(type);
    return applyContractDefaults(zone, type, layer);
  }

  if (action === 'repair_city_location') {
    const next = applyContractDefaults(zone, 'city', 'locations');
    return {
      ...next,
      interactionMode: 'enter',
      playerClickable: true,
      blocksClick: true,
      passiveEffects: false,
      cityId: deriveCanonicalCityId(zone),
    };
  }

  if (action === 'repair_city_area') {
    const next = applyContractDefaults(zone, 'city_area', 'areas');
    return {
      ...next,
      interactionMode: 'none',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
      cityId: deriveCanonicalCityId(zone),
    };
  }

  if (action === 'repair_kingdom_area') {
    return {
      ...applyContractDefaults(zone, 'kingdom_area', 'areas'),
      interactionMode: 'none',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
    };
  }

  if (action === 'repair_faction_area') {
    return {
      ...applyContractDefaults(zone, 'faction_area', 'areas'),
      interactionMode: 'none',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
    };
  }

  if (action === 'repair_resource_area') {
    return {
      ...applyContractDefaults(zone, 'resource_area', 'resources'),
      interactionMode: 'resource',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
    };
  }

  if (action === 'repair_quest_area') {
    return {
      ...applyContractDefaults(zone, 'quest_area', 'quests'),
      interactionMode: 'quest',
      playerClickable: true,
      blocksClick: false,
      passiveEffects: false,
    };
  }

  if (action === 'repair_random_event_area') {
    return {
      ...applyContractDefaults(zone, 'random_event_area', 'zones'),
      interactionMode: 'random_event',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
    };
  }

  if (action === 'repair_danger_area') {
    return {
      ...applyContractDefaults(zone, 'danger_area', 'zones'),
      interactionMode: 'danger',
      playerClickable: false,
      blocksClick: false,
      passiveEffects: true,
    };
  }

  return {
    ...zone,
    updatedAt: Date.now(),
  };
}

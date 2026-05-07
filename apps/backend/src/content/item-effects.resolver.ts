import type { Equipment } from '@theend/rpg-domain';
import type { AdminItem, ItemEffect, ItemSet } from './content.types';

/**
 * Технический тип источника эффекта, чтобы потребители (arena/combat/admin)
 * могли показывать происхождение модификатора и при необходимости дебажить его.
 */
export type ResolvedEffectOrigin = 'equipment' | 'augment' | 'item_set' | 'status';

/**
 * Унифицированная запись о резолвнутом эффекте.
 *
 * Важные свойства:
 * - isActive: активен ли эффект в текущем контексте;
 * - inactiveReason: если эффект не активен, почему именно;
 * - effect: сам контракт ItemEffect без UI-логики.
 */
export interface ResolvedEffectSource {
  origin: ResolvedEffectOrigin;
  sourceId: string;
  sourceName?: string;
  itemId?: string;
  slot?: keyof Equipment | string;
  setId?: string;
  statusId?: string;
  effect?: ItemEffect;
  isActive: boolean;
  inactiveReason?: string;
  requiredActivationContexts?: string[];
  matchedActivationContexts?: string[];
}

/**
 * Вход статуса для резолвера модификаторов.
 *
 * Это deliberately-generic контракт: сервисы arena/combat могут передать сюда
 * любые runtime-статусы, если они уже нормализованы к ItemEffect[]-модификаторам.
 */
export interface ActiveStatusInput {
  statusId: string;
  name?: string;
  effects?: ItemEffect[];
  isActive?: boolean;
  activationContexts?: string[];
}

/**
 * Входной контракт для извлечения эффектов экипировки.
 */
export interface EquippedItemEffectsArgs {
  equipment: Partial<Equipment> | Equipment | null | undefined;
  items: ReadonlyArray<AdminItem>;
  activationContexts?: string[];
}

/**
 * Результат извлечения эффектов экипированных предметов.
 *
 * - activeSources: активные sources для прямого применения
 * - inactiveAugmentSources: неактивные аугменты отдельно (по требованиям ТЗ)
 */
export interface EquippedItemEffectsResult {
  activeSources: ResolvedEffectSource[];
  inactiveAugmentSources: ResolvedEffectSource[];
}

/**
 * Подробная запись об активном бонусе сета.
 */
export interface ActiveItemSetBonus {
  setId: string;
  setName: string;
  requiredPieces: number;
  activePieces: number;
  effects: ItemEffect[];
}

/**
 * Входной контракт для резолва активных бонусов сетов.
 */
export interface ActiveItemSetBonusesArgs {
  equipment: Partial<Equipment> | Equipment | null | undefined;
  items: ReadonlyArray<AdminItem>;
  itemSets?: ReadonlyArray<ItemSet>;
}

/**
 * Итоговый DTO для применения в arena/combat.
 *
 * Особенности:
 * - effects: только активные эффекты (ready-to-apply);
 * - sources: активные источники этих эффектов;
 * - inactiveAugments: неактивные аугменты (для UI/логов/диагностики);
 * - activeItemSetBonuses: агрегированная информация по активированным бонусам сетов.
 */
export interface ResolvedEquipmentModifiers {
  effects: ItemEffect[];
  sources: ResolvedEffectSource[];
  inactiveAugments: ResolvedEffectSource[];
  activeItemSetBonuses: ActiveItemSetBonus[];
}

/**
 * Общий вход для полного резолва модификаторов персонажа из экипировки/сетов/статусов.
 */
export interface ResolveCharacterEquipmentModifiersArgs {
  equipment: Partial<Equipment> | Equipment | null | undefined;
  items: ReadonlyArray<AdminItem>;
  itemSets?: ReadonlyArray<ItemSet>;
  activeStatuses?: ReadonlyArray<ActiveStatusInput>;
  activationContexts?: string[];
}

/**
 * Извлекает эффекты экипированных предметов и сокетных аугментов.
 *
 * Правила:
 * 1) Учитываются только equipmentEffects (legacy effects/combatEffects/useEffect НЕ трогаются).
 * 2) Аугмент активен только при совместимости activationContexts.
 * 3) Неактивные аугменты возвращаются отдельно с причиной в inactiveReason.
 */
export function getEquippedItemEffects(args: EquippedItemEffectsArgs): EquippedItemEffectsResult {
  const itemById = createItemMap(args.items);
  const activeSources: ResolvedEffectSource[] = [];
  const inactiveAugmentSources: ResolvedEffectSource[] = [];

  for (const [slot, rawItemId] of Object.entries(args.equipment ?? {})) {
    const itemId = normalizeString(rawItemId);
    if (!itemId) {
      continue;
    }

    const equippedItem = itemById.get(itemId);
    if (!equippedItem || equippedItem.isEnabled === false) {
      continue;
    }

    const equipmentContexts = buildEquipmentContexts(equippedItem, slot, args.activationContexts);

    for (const effect of sanitizeEffects(equippedItem.equipmentEffects)) {
      activeSources.push({
        origin: 'equipment',
        sourceId: equippedItem.id,
        sourceName: equippedItem.name,
        itemId: equippedItem.id,
        slot,
        effect,
        isActive: true,
        requiredActivationContexts: normalizeContextList(effect.activationContexts),
      });
    }

    for (const socket of equippedItem.augmentSlots ?? []) {
      const socketedAugmentItemId = normalizeString(socket.socketedAugmentItemId);
      if (!socketedAugmentItemId) {
        continue;
      }

      const augmentItem = itemById.get(socketedAugmentItemId);
      const augment = augmentItem?.augment;

      if (!augmentItem || augmentItem.isEnabled === false) {
        inactiveAugmentSources.push({
          origin: 'augment',
          sourceId: socket.id,
          sourceName: 'Socketed augment',
          itemId: socketedAugmentItemId,
          slot,
          isActive: false,
          inactiveReason: 'Socketed augment item is missing or disabled.',
        });
        continue;
      }

      if (!augment) {
        inactiveAugmentSources.push({
          origin: 'augment',
          sourceId: augmentItem.id,
          sourceName: augmentItem.name,
          itemId: augmentItem.id,
          slot,
          isActive: false,
          inactiveReason: 'Socketed item has no augment payload.',
        });
        continue;
      }

      const allowedAugmentTypes = socket.allowedAugmentTypes ?? [];
      if (allowedAugmentTypes.length > 0 && !allowedAugmentTypes.includes(augment.type)) {
        inactiveAugmentSources.push({
          origin: 'augment',
          sourceId: augmentItem.id,
          sourceName: augmentItem.name,
          itemId: augmentItem.id,
          slot,
          isActive: false,
          inactiveReason: `Augment type "${augment.type}" is not allowed in socket "${socket.id}".`,
        });
        continue;
      }

      const requiredContexts = normalizeContextList([...(augment.activationContexts ?? []), ...(socket.activationContexts ?? [])]);
      const contextMatch = matchActivationContexts(requiredContexts, equipmentContexts);

      const augmentEffects = sanitizeEffects(augment.effects);
      if (!contextMatch.ok) {
        if (augmentEffects.length === 0) {
          inactiveAugmentSources.push({
            origin: 'augment',
            sourceId: augmentItem.id,
            sourceName: augmentItem.name,
            itemId: augmentItem.id,
            slot,
            isActive: false,
            inactiveReason: contextMatch.reason,
            requiredActivationContexts: requiredContexts,
            matchedActivationContexts: contextMatch.matched,
          });
          continue;
        }

        for (const effect of augmentEffects) {
          inactiveAugmentSources.push({
            origin: 'augment',
            sourceId: augmentItem.id,
            sourceName: augmentItem.name,
            itemId: augmentItem.id,
            slot,
            effect,
            isActive: false,
            inactiveReason: contextMatch.reason,
            requiredActivationContexts: requiredContexts,
            matchedActivationContexts: contextMatch.matched,
          });
        }
        continue;
      }

      for (const effect of augmentEffects) {
        activeSources.push({
          origin: 'augment',
          sourceId: augmentItem.id,
          sourceName: augmentItem.name,
          itemId: augmentItem.id,
          slot,
          effect,
          isActive: true,
          requiredActivationContexts: requiredContexts,
          matchedActivationContexts: contextMatch.matched,
        });
      }
    }
  }

  return {
    activeSources,
    inactiveAugmentSources,
  };
}

/**
 * Возвращает только активные бонусы сетов, если на персонаже надето достаточно предметов набора.
 */
export function getActiveItemSetBonuses(args: ActiveItemSetBonusesArgs): ActiveItemSetBonus[] {
  const itemById = createItemMap(args.items);
  const equippedItemIds = new Set<string>();

  for (const rawItemId of Object.values(args.equipment ?? {})) {
    const itemId = normalizeString(rawItemId);
    if (!itemId) {
      continue;
    }
    const item = itemById.get(itemId);
    if (!item || item.isEnabled === false) {
      continue;
    }
    equippedItemIds.add(itemId);
  }

  const result: ActiveItemSetBonus[] = [];

  for (const itemSet of args.itemSets ?? []) {
    if (!itemSet || itemSet.isEnabled === false) {
      continue;
    }

    const pieceIds = Array.from(new Set((itemSet.pieceItemIds ?? []).filter((entry) => Boolean(normalizeString(entry)))));
    if (pieceIds.length === 0) {
      continue;
    }

    const activePieces = pieceIds.reduce((acc, pieceId) => (equippedItemIds.has(pieceId) ? acc + 1 : acc), 0);

    for (const bonus of itemSet.bonuses ?? []) {
      if (!bonus || typeof bonus.requiredPieces !== 'number') {
        continue;
      }
      if (activePieces < bonus.requiredPieces) {
        continue;
      }

      const effects = sanitizeEffects(bonus.effects);
      if (effects.length === 0) {
        continue;
      }

      result.push({
        setId: itemSet.id,
        setName: itemSet.name,
        requiredPieces: bonus.requiredPieces,
        activePieces,
        effects,
      });
    }
  }

  return result;
}

/**
 * Полный резолв модификаторов персонажа для движков arena/combat.
 *
 * Здесь объединяются 4 группы:
 * - effects экипированных предметов;
 * - effects из socketed augments;
 * - активные бонусы item sets;
 * - modifiers активных статусов.
 */
export function resolveCharacterEquipmentModifiers(
  args: ResolveCharacterEquipmentModifiersArgs,
): ResolvedEquipmentModifiers {
  const equipped = getEquippedItemEffects({
    equipment: args.equipment,
    items: args.items,
    activationContexts: args.activationContexts,
  });

  const activeSetBonuses = getActiveItemSetBonuses({
    equipment: args.equipment,
    items: args.items,
    itemSets: args.itemSets,
  });

  const activeSetSources: ResolvedEffectSource[] = [];
  for (const bonus of activeSetBonuses) {
    for (const effect of bonus.effects) {
      activeSetSources.push({
        origin: 'item_set',
        sourceId: `${bonus.setId}:${bonus.requiredPieces}`,
        sourceName: bonus.setName,
        setId: bonus.setId,
        effect,
        isActive: true,
      });
    }
  }

  const statusSources = resolveActiveStatusSources(args.activeStatuses, args.activationContexts);

  const sources: ResolvedEffectSource[] = [
    ...equipped.activeSources,
    ...activeSetSources,
    ...statusSources,
  ];

  return {
    effects: sources.map((source) => source.effect).filter((effect): effect is ItemEffect => Boolean(effect)),
    sources,
    inactiveAugments: equipped.inactiveAugmentSources,
    activeItemSetBonuses: activeSetBonuses,
  };
}

function resolveActiveStatusSources(
  statuses: ReadonlyArray<ActiveStatusInput> | undefined,
  activationContexts: string[] | undefined,
): ResolvedEffectSource[] {
  const result: ResolvedEffectSource[] = [];
  const runtimeContexts = normalizeContextList(activationContexts);

  for (const status of statuses ?? []) {
    if (!status || status.isActive === false) {
      continue;
    }

    const requiredContexts = normalizeContextList(status.activationContexts);
    const contextMatch = matchActivationContexts(requiredContexts, runtimeContexts);
    if (!contextMatch.ok) {
      continue;
    }

    for (const effect of sanitizeEffects(status.effects)) {
      result.push({
        origin: 'status',
        sourceId: status.statusId,
        sourceName: status.name,
        statusId: status.statusId,
        effect,
        isActive: true,
        requiredActivationContexts: requiredContexts,
        matchedActivationContexts: contextMatch.matched,
      });
    }
  }

  return result;
}

function createItemMap(items: ReadonlyArray<AdminItem>): Map<string, AdminItem> {
  const map = new Map<string, AdminItem>();
  for (const item of items) {
    if (!item || !normalizeString(item.id)) {
      continue;
    }
    map.set(item.id, item);
  }
  return map;
}

function sanitizeEffects(effects: ItemEffect[] | undefined): ItemEffect[] {
  if (!Array.isArray(effects)) {
    return [];
  }
  return effects.filter((entry): entry is ItemEffect => Boolean(entry && typeof entry === 'object' && typeof entry.type === 'string'));
}

/**
 * Формирует пул контекстов для проверки activationContexts аугмента.
 *
 * Логика deliberately-плоская и без привязки к UI:
 * - глобальные runtime contexts (например arena/combat);
 * - контекст слота (slot:weapon);
 * - контекст предмета (itemType:weapon, damageCategory:physical и т.п.).
 */
function buildEquipmentContexts(item: AdminItem, slot: string, runtimeContexts: string[] | undefined): string[] {
  const derived = [
    `slot:${slot}`,
    `item:${item.id}`,
    `itemType:${item.type}`,
    item.subtype ? `itemSubtype:${item.subtype}` : null,
    item.damageCategory ? `damageCategory:${item.damageCategory}` : null,
    item.physicalType ? `physicalType:${item.physicalType}` : null,
    item.elementType ? `elementType:${item.elementType}` : null,
    item.magicSchool ? `magicSchool:${item.magicSchool}` : null,
    ...(item.tags ?? []).map((tag) => `tag:${tag}`),
  ];

  return normalizeContextList([...(runtimeContexts ?? []), ...derived]);
}

/**
 * Совместимость activationContexts:
 * - если requiredContexts пуст, эффект считается активным;
 * - иначе нужен хотя бы один матч required с available.
 */
function matchActivationContexts(requiredContexts: string[], availableContexts: string[]): {
  ok: boolean;
  matched: string[];
  reason?: string;
} {
  if (requiredContexts.length === 0) {
    return { ok: true, matched: [] };
  }

  const availableSet = new Set(availableContexts);
  const matched = requiredContexts.filter((entry) => availableSet.has(entry));
  if (matched.length > 0) {
    return { ok: true, matched };
  }

  return {
    ok: false,
    matched: [],
    reason: `Activation context mismatch: required one of [${requiredContexts.join(', ')}].`,
  };
}

function normalizeContextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeString(entry);
    if (!normalized) {
      continue;
    }
    unique.add(normalized.toLowerCase());
  }

  return [...unique];
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

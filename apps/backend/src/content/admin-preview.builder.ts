/**
 * admin-preview.builder.ts
 *
 * Чистые builder-функции для генерации preview-ответов.
 * Нет зависимостей от NestJS, Prisma или БД — только входные данные и типы.
 */

import { formatItemEffect } from './item-effects.formatter';
import type { AdminItem, ItemEffect, ItemSet, ItemSocket, RuneComplex } from './content.types';
import type {
  InactiveAugmentPreview,
  InstanceSocketStateEntry,
  ItemPreviewResponse,
  ItemSetPreviewResponse,
  RuneComplexPreviewResponse,
  SetBonusPreview,
  SetPreview,
  SocketPreview,
  SocketPreviewStatus,
} from './admin-preview.types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatEffects(effects: ItemEffect[] | undefined): string[] {
  if (!effects || effects.length === 0) {
    return [];
  }
  return effects
    .map((e) => {
      try {
        return formatItemEffect(e, { includeCondition: true });
      } catch {
        return null;
      }
    })
    .filter((s): s is string => s !== null && s.length > 0);
}

function contextsCompatible(
  effectContexts: string[] | undefined,
  activationContexts: string[] | undefined,
): boolean {
  if (!effectContexts || effectContexts.length === 0) {
    return true;
  }
  if (!activationContexts || activationContexts.length === 0) {
    return false;
  }
  return effectContexts.some((ctx) => activationContexts.includes(ctx));
}

function buildSocketStatus(
  socketDef: ItemSocket,
  instanceEntry: InstanceSocketStateEntry | undefined,
  activationContexts: string[] | undefined,
  augmentItem: AdminItem | undefined,
): { status: SocketPreviewStatus; inactiveReason?: string } {
  // Locked takes priority
  const isLocked = instanceEntry?.isLocked ?? socketDef.isLocked ?? false;
  if (isLocked) {
    return { status: 'locked' };
  }

  const socketedAugmentItemId = instanceEntry?.socketedAugmentItemId ?? socketDef.socketedAugmentItemId;
  if (!socketedAugmentItemId) {
    return { status: 'empty' };
  }

  if (!augmentItem || !augmentItem.isEnabled) {
    return { status: 'occupied_inactive', inactiveReason: 'Предмет-аугмент не найден или отключён' };
  }

  const augmentContexts = augmentItem.augment?.activationContexts;
  const socketContexts = instanceEntry
    ? socketDef.activationContexts
    : socketDef.activationContexts;

  // Check augment activationContexts vs provided activationContexts
  if (!contextsCompatible(augmentContexts, activationContexts) && augmentContexts && augmentContexts.length > 0) {
    const needed = augmentContexts.join(', ');
    return {
      status: 'occupied_inactive',
      inactiveReason: `${augmentItem.name} вставлен, но не активен (требуется контекст: ${needed})`,
    };
  }

  // Check socket-level activationContexts
  if (!contextsCompatible(socketContexts, activationContexts) && socketContexts && socketContexts.length > 0) {
    const needed = socketContexts.join(', ');
    return {
      status: 'occupied_inactive',
      inactiveReason: `${augmentItem.name} вставлен, но не активен (сокет требует контекст: ${needed})`,
    };
  }

  return { status: 'occupied_active' };
}

// ---------------------------------------------------------------------------
// buildItemPreview
// ---------------------------------------------------------------------------

export interface BuildItemPreviewOptions {
  /** Контексты активации для фильтрации аугментов (например ['weapon', 'melee']). */
  activationContexts?: string[];
  /** Состояние сокетов конкретного инстанса. Если не передано — берётся из базового шаблона. */
  instanceSocketState?: InstanceSocketStateEntry[];
}

/**
 * Строит полный preview предмета.
 *
 * @param item        — record AdminItem из ContentDatabase
 * @param allItems    — весь список предметов (нужен для lookup аугментов)
 * @param allSets     — весь список сетов (нужен для setPreview)
 * @param options     — контексты + опциональный instanceSocketState
 */
export function buildItemPreview(
  item: AdminItem,
  allItems: ReadonlyArray<AdminItem>,
  allSets: ReadonlyArray<ItemSet>,
  options?: BuildItemPreviewOptions,
): ItemPreviewResponse {
  const itemById = new Map(allItems.map((i) => [i.id, i]));
  const activationContexts = options?.activationContexts;
  const instanceState = options?.instanceSocketState ?? [];
  const instanceStateById = new Map(instanceState.map((e) => [e.socketId, e]));

  // --- humanReadableEffects ---
  const humanReadableEffects: string[] = [
    ...formatEffects(item.equipmentEffects),
  ];

  // --- socketsPreview + inactiveAugments ---
  const socketsPreview: SocketPreview[] = [];
  const inactiveAugments: InactiveAugmentPreview[] = [];

  for (const socketDef of item.augmentSlots ?? []) {
    const instanceEntry = instanceStateById.get(socketDef.id);
    const socketedAugmentItemId =
      instanceEntry?.socketedAugmentItemId ?? socketDef.socketedAugmentItemId;
    const augmentItem = socketedAugmentItemId ? itemById.get(socketedAugmentItemId) : undefined;

    const { status, inactiveReason } = buildSocketStatus(
      socketDef,
      instanceEntry,
      activationContexts,
      augmentItem,
    );

    const augmentEffects = augmentItem ? formatEffects(augmentItem.augment?.effects) : undefined;

    socketsPreview.push({
      socketId: socketDef.id,
      status,
      socketedAugmentItemId: socketedAugmentItemId ?? undefined,
      socketedAugmentName: augmentItem?.name,
      inactiveReason,
      allowedAugmentTypes: socketDef.allowedAugmentTypes,
      source: instanceEntry?.source ?? socketDef.source,
      augmentEffects: augmentEffects && augmentEffects.length > 0 ? augmentEffects : undefined,
    });

    if (status === 'occupied_active' && augmentEffects) {
      humanReadableEffects.push(...augmentEffects);
    }

    if (status === 'occupied_inactive' && augmentItem && socketedAugmentItemId) {
      inactiveAugments.push({
        socketId: socketDef.id,
        augmentItemId: socketedAugmentItemId,
        augmentItemName: augmentItem.name,
        inactiveReason: inactiveReason ?? 'Аугмент неактивен',
        effects: formatEffects(augmentItem.augment?.effects),
      });
    }
  }

  // --- setPreview ---
  let setPreview: SetPreview | undefined;
  if (item.setId) {
    const foundSet = allSets.find((s) => s.id === item.setId);
    if (foundSet) {
      setPreview = buildSetPreview(foundSet);
    }
  }

  return {
    itemId: item.id,
    itemName: item.name,
    humanReadableEffects,
    socketsPreview,
    inactiveAugments,
    setPreview,
  };
}

// ---------------------------------------------------------------------------
// buildItemSetPreview
// ---------------------------------------------------------------------------

function buildSetBonusPreviews(set: ItemSet): SetBonusPreview[] {
  return (set.bonuses ?? []).map((bonus) => ({
    requiredPieces: bonus.requiredPieces,
    description: bonus.description,
    effects: formatEffects(bonus.effects),
  }));
}

function buildSetPreview(set: ItemSet): SetPreview {
  return {
    setId: set.id,
    setName: set.name,
    totalPieces: set.pieceItemIds.length,
    bonuses: buildSetBonusPreviews(set),
  };
}

/**
 * Строит полное превью сета для страницы редактора в админке.
 *
 * @param set       — record ItemSet из ContentDatabase
 * @param allItems  — весь список предметов (для lookup названий piece-предметов)
 */
export function buildItemSetPreview(
  set: ItemSet,
  allItems: ReadonlyArray<AdminItem>,
): ItemSetPreviewResponse {
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  const pieces = set.pieceItemIds.map((id) => {
    const found = itemById.get(id);
    return {
      itemId: id,
      itemName: found?.name ?? id,
      isEnabled: found?.isEnabled ?? false,
    };
  });

  return {
    setId: set.id,
    setName: set.name,
    pieces,
    bonuses: buildSetBonusPreviews(set),
  };
}

// ---------------------------------------------------------------------------
// buildRuneComplexPreview
// ---------------------------------------------------------------------------

/**
 * Строит превью рунного комплекса для страницы редактора в админке.
 *
 * @param complex   — record RuneComplex из ContentDatabase
 * @param allItems  — весь список предметов (для lookup рун)
 */
export function buildRuneComplexPreview(
  complex: RuneComplex,
  allItems: ReadonlyArray<AdminItem>,
): RuneComplexPreviewResponse {
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  const runes = complex.runeItemIds.map((id) => {
    const found = itemById.get(id);
    return {
      itemId: id,
      itemName: found?.name ?? id,
      isEnabled: found?.isEnabled ?? false,
      effects: found ? formatEffects(found.augment?.effects) : [],
    };
  });

  return {
    complexId: complex.id,
    complexName: complex.name,
    runes,
    gameplayDescription: complex.gameplayDescription,
    loreDescription: complex.loreDescription,
  };
}

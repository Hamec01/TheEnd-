/**
 * admin-preview.builder.ts
 *
 * Чистые builder-функции для генерации preview-ответов.
 * Нет зависимостей от NestJS, Prisma или БД - только входные данные и типы.
 */

import { formatItemEffect } from './item-effects.formatter';
import type { AdminItem, ItemEffect, ItemSet, ItemSocket, RuneComplex } from './content.types';
import { matchActivationContexts, normalizeActivationContextList } from './activation-contexts';
import {
  augmentContextMismatchReason,
  augmentMissingOrDisabledReason,
  augmentMissingPayloadReason,
  augmentTypeMismatchReason,
} from './augment-inactive-reasons';
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
  requiredContexts: string[] | undefined,
  activationContexts: string[] | undefined,
): { ok: boolean; required: string[] } {
  const normalizedRequired = normalizeActivationContextList(requiredContexts);
  if (normalizedRequired.length === 0) {
    return { ok: true, required: [] };
  }

  const match = matchActivationContexts(
    normalizedRequired,
    normalizeActivationContextList(activationContexts),
  );
  return {
    ok: match.ok,
    required: normalizedRequired,
  };
}

function buildSocketStatus(
  socketDef: ItemSocket,
  instanceEntry: InstanceSocketStateEntry | undefined,
  activationContexts: string[] | undefined,
  augmentItem: AdminItem | undefined,
): { status: SocketPreviewStatus; inactiveReason?: string } {
  const isLocked = instanceEntry?.isLocked ?? socketDef.isLocked ?? false;
  if (isLocked) {
    return { status: 'locked' };
  }

  const socketedAugmentItemId = instanceEntry?.socketedAugmentItemId ?? socketDef.socketedAugmentItemId;
  if (!socketedAugmentItemId) {
    return { status: 'empty' };
  }

  if (!augmentItem || !augmentItem.isEnabled) {
    return { status: 'occupied_inactive', inactiveReason: augmentMissingOrDisabledReason() };
  }

  const augment = augmentItem.augment;
  if (!augment) {
    return {
      status: 'occupied_inactive',
      inactiveReason: augmentMissingPayloadReason(augmentItem.name),
    };
  }

  if (
    socketDef.allowedAugmentTypes &&
    socketDef.allowedAugmentTypes.length > 0 &&
    !socketDef.allowedAugmentTypes.includes(augment.type)
  ) {
    return {
      status: 'occupied_inactive',
      inactiveReason: augmentTypeMismatchReason(augmentItem.name, augment.type),
    };
  }

  const contextMatch = contextsCompatible(
    [...(augment.activationContexts ?? []), ...(socketDef.activationContexts ?? [])],
    activationContexts,
  );
  if (!contextMatch.ok) {
    return {
      status: 'occupied_inactive',
      inactiveReason: augmentContextMismatchReason(augmentItem.name, contextMatch.required),
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
  /** Состояние сокетов конкретного инстанса. Если не передано - берётся из базового шаблона. */
  instanceSocketState?: InstanceSocketStateEntry[];
}

/**
 * Строит полный preview предмета.
 *
 * @param item        - record AdminItem из ContentDatabase
 * @param allItems    - весь список предметов (нужен для lookup аугментов)
 * @param allSets     - весь список сетов (нужен для setPreview)
 * @param options     - контексты + опциональный instanceSocketState
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

  const humanReadableEffects: string[] = [
    ...formatEffects(item.equipmentEffects),
  ];

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

  let setPreview: SetPreview | undefined;
  if (item.setId) {
    const foundSet = allSets.find((s) => s.id === item.setId);
    if (foundSet) {
      setPreview = buildSetPreview(foundSet, allItems);
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
  return (set.bonuses ?? []).map((bonus) => {
    const penalties = formatEffects((bonus as { penaltyEffects?: ItemEffect[] }).penaltyEffects);
    return {
      requiredPieces: bonus.requiredPieces,
      description: bonus.description,
      effects: formatEffects(bonus.effects),
      penaltyEffects: penalties.length > 0 ? penalties : undefined,
    };
  });
}

function buildSetPreview(set: ItemSet, allItems?: ReadonlyArray<AdminItem>): SetPreview {
  const itemById = allItems ? new Map(allItems.map((i) => [i.id, i])) : null;
  const pieceSummaries = (set.pieceItemIds ?? []).map((id) => ({
    itemId: id,
    itemName: itemById?.get(id)?.name ?? id,
  }));
  return {
    setId: set.id,
    setName: set.name,
    totalPieces: set.pieceItemIds.length,
    pieceSummaries: pieceSummaries.length > 0 ? pieceSummaries : undefined,
    bonuses: buildSetBonusPreviews(set),
  };
}

/**
 * Строит полное preview сета для страницы редактора в админке.
 *
 * @param set       - record ItemSet из ContentDatabase
 * @param allItems  - весь список предметов (для lookup названий piece-предметов)
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
 * @param complex   - record RuneComplex из ContentDatabase
 * @param allItems  - весь список предметов (для lookup рун)
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

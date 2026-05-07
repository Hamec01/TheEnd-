import type { ItemAugmentType, ItemSocketSource } from './content.types';

// ---------------------------------------------------------------------------
// Socket status
// ---------------------------------------------------------------------------

/**
 * Статус сокета для превью:
 * - empty             — сокет пустой, готов к вставке аугмента
 * - occupied_active   — аугмент вставлен и активен в текущем контексте
 * - occupied_inactive — аугмент вставлен, но не активен (несовместимый контекст)
 * - locked            — сокет заблокирован (требует кузнеца для разблокировки)
 */
export type SocketPreviewStatus = 'empty' | 'occupied_active' | 'occupied_inactive' | 'locked';

/**
 * Детальные данные одного сокета для отображения в превью предмета или инстанса.
 */
export interface SocketPreview {
  /** Идентификатор сокета (из ItemSocket.id). */
  socketId: string;
  /** Итоговый статус сокета. */
  status: SocketPreviewStatus;
  /** Идентификатор вставленного аугмента (если есть). */
  socketedAugmentItemId?: string;
  /** Имя вставленного аугмента (если найден в базе). */
  socketedAugmentName?: string;
  /** Причина, по которой аугмент неактивен (для occupied_inactive). */
  inactiveReason?: string;
  /** Допустимые типы аугментов для этого сокета. */
  allowedAugmentTypes?: ItemAugmentType[];
  /** Источник происхождения сокета (base / blacksmith_added / scripted). */
  source?: ItemSocketSource;
  /** Человекочитаемые эффекты вставленного аугмента. */
  augmentEffects?: string[];
}

/**
 * Краткая сводка о неактивном аугменте — используется в inactiveAugments[].
 */
export interface InactiveAugmentPreview {
  socketId: string;
  augmentItemId: string;
  augmentItemName?: string;
  /** Причина неактивности (например, «Камень защиты несовместим с оружием»). */
  inactiveReason: string;
  /** Что дал бы аугмент, если бы был активен. */
  effects: string[];
}

// ---------------------------------------------------------------------------
// Set preview
// ---------------------------------------------------------------------------

export interface SetBonusPreview {
  requiredPieces: number;
  description?: string;
  /** Человекочитаемые эффекты этого бонуса. */
  effects: string[];
}

/**
 * Сводная информация о принадлежности предмета к сету.
 */
export interface SetPreview {
  setId: string;
  setName: string;
  totalPieces: number;
  bonuses: SetBonusPreview[];
}

// ---------------------------------------------------------------------------
// Item preview
// ---------------------------------------------------------------------------

/**
 * Опциональное состояние сокета инстанса для передачи в превью-эндпоинт.
 * Позволяет получить превью конкретного персонажного инстанса предмета.
 */
export interface InstanceSocketStateEntry {
  socketId: string;
  socketedAugmentItemId?: string;
  isLocked?: boolean;
  source?: ItemSocketSource;
}

/**
 * Тело запроса для POST /content/preview/item/:id
 */
export interface ItemPreviewQueryBody {
  /**
   * Контексты активации для фильтрации аугментов
   * (например: ['weapon', 'melee', 'combat']).
   */
  activationContexts?: string[];
  /**
   * Состояние сокетов конкретного инстанса персонажа.
   * Если не передано, используется базовое состояние из шаблона предмета.
   */
  instanceSocketState?: InstanceSocketStateEntry[];
}

/**
 * Полный response превью предмета — для отображения в админке или UI.
 */
export interface ItemPreviewResponse {
  itemId: string;
  itemName: string;
  /** Все активные эффекты предмета (equipmentEffects + активные аугменты) в читаемом виде. */
  humanReadableEffects: string[];
  /** Превью каждого сокета (пустые, занятые, заблокированные). */
  socketsPreview: SocketPreview[];
  /** Перечень неактивных аугментов с причиной. */
  inactiveAugments: InactiveAugmentPreview[];
  /** Информация о сете (если предмет является частью сета). */
  setPreview?: SetPreview;
}

// ---------------------------------------------------------------------------
// ItemSet preview
// ---------------------------------------------------------------------------

export interface ItemSetPiecePreview {
  itemId: string;
  itemName: string;
  isEnabled: boolean;
}

/**
 * Полное превью сета для страницы редактора в админке.
 */
export interface ItemSetPreviewResponse {
  setId: string;
  setName: string;
  pieces: ItemSetPiecePreview[];
  bonuses: SetBonusPreview[];
}

// ---------------------------------------------------------------------------
// RuneComplex preview
// ---------------------------------------------------------------------------

export interface RunePreview {
  itemId: string;
  itemName: string;
  isEnabled: boolean;
  /** Эффекты самой руны (augment.effects) в читаемом виде. */
  effects: string[];
}

/**
 * Превью рунного комплекса для страницы редактора в админке.
 */
export interface RuneComplexPreviewResponse {
  complexId: string;
  complexName: string;
  runes: RunePreview[];
  gameplayDescription?: string;
  loreDescription?: string;
}

import type { Equipment } from '@theend/rpg-domain';

/**
 * Версия контракта instance-state.
 * Нужна для будущих безопасных миграций JSON-структуры без привязки к Prisma-схеме.
 */
export type CharacterItemInstanceStateVersion = 1;

/**
 * Состояние сокета конкретного экземпляра предмета.
 *
 * Это per-instance данные, которые нельзя хранить в legacy quantity inventory,
 * потому что два одинаковых itemId могут иметь разный набор вставок/блокировок.
 */
export interface CharacterItemSocketState {
  socketId: string;
  socketedAugmentItemId?: string | null;
  isLocked?: boolean;
  source?: 'base' | 'blacksmith_added' | 'scripted';
}

/**
 * JSON-состояние экземпляра предмета.
 *
 * Важно: это только для instance-aware предметов.
 * Stackable расходники/материалы продолжают жить в CharacterInventoryItem(quantity).
 */
export interface CharacterItemInstanceState {
  version: CharacterItemInstanceStateVersion;
  augmentSlots?: CharacterItemSocketState[];
  qualityTier?: number;
  forgedAtIso?: string;
  ownerTag?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Структура одной записи equipmentState по конкретному слоту.
 *
 * itemId дублируется намеренно: legacy-слоты остаются основой совместимости,
 * а itemInstanceId позволяет точно указать, какой именно экземпляр предмета надет.
 */
export interface CharacterEquipmentStateSlot {
  itemId?: string | null;
  itemInstanceId?: string | null;
  equippedAtIso?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Полный JSON-контракт для CharacterEquipment.equipmentState.
 */
export interface CharacterEquipmentState {
  version: 1;
  slots: Partial<Record<keyof Equipment, CharacterEquipmentStateSlot>>;
}

/**
 * Тип результата чтения CharacterItemInstance из хранилища.
 */
export interface CharacterItemInstanceRecord {
  id: string;
  characterId: string;
  itemId: string;
  state: CharacterItemInstanceState | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Нормализатор для безопасного чтения произвольного JSON как CharacterItemInstanceState.
 */
export function normalizeCharacterItemInstanceState(value: unknown): CharacterItemInstanceState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const version = raw.version === 1 ? 1 : null;
  if (!version) {
    return null;
  }

  const augmentSlotsRaw = raw.augmentSlots;
  const augmentSlots = Array.isArray(augmentSlotsRaw)
    ? augmentSlotsRaw.reduce<CharacterItemSocketState[]>((acc, entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return acc;
      }

      const row = entry as Record<string, unknown>;
      const socketId = typeof row.socketId === 'string' ? row.socketId.trim() : '';
      if (!socketId) {
        return acc;
      }

      const source = row.source === 'base' || row.source === 'blacksmith_added' || row.source === 'scripted'
        ? row.source
        : undefined;

      acc.push({
        socketId,
        socketedAugmentItemId: typeof row.socketedAugmentItemId === 'string'
          ? row.socketedAugmentItemId.trim()
          : row.socketedAugmentItemId === null
            ? null
            : undefined,
        isLocked: typeof row.isLocked === 'boolean' ? row.isLocked : undefined,
        source,
      });

      return acc;
    }, [])
    : undefined;

  return {
    version,
    augmentSlots,
    qualityTier: typeof raw.qualityTier === 'number' && Number.isFinite(raw.qualityTier)
      ? Math.max(0, Math.floor(raw.qualityTier))
      : undefined,
    forgedAtIso: typeof raw.forgedAtIso === 'string' ? raw.forgedAtIso : undefined,
    ownerTag: typeof raw.ownerTag === 'string' ? raw.ownerTag : undefined,
    metadata: raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : undefined,
  };
}

/**
 * Нормализатор для безопасного чтения произвольного JSON как CharacterEquipmentState.
 */
export function normalizeCharacterEquipmentState(value: unknown): CharacterEquipmentState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const version = raw.version === 1 ? 1 : null;
  if (!version) {
    return null;
  }

  const slotsRaw = raw.slots;
  if (!slotsRaw || typeof slotsRaw !== 'object' || Array.isArray(slotsRaw)) {
    return { version, slots: {} };
  }

  const slots: CharacterEquipmentState['slots'] = {};
  for (const [slotKey, slotValue] of Object.entries(slotsRaw as Record<string, unknown>)) {
    if (!slotValue || typeof slotValue !== 'object' || Array.isArray(slotValue)) {
      continue;
    }

    const row = slotValue as Record<string, unknown>;
    slots[slotKey as keyof Equipment] = {
      itemId: typeof row.itemId === 'string' ? row.itemId : null,
      itemInstanceId: typeof row.itemInstanceId === 'string' ? row.itemInstanceId : null,
      equippedAtIso: typeof row.equippedAtIso === 'string' ? row.equippedAtIso : undefined,
      metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : undefined,
    };
  }

  return { version, slots };
}

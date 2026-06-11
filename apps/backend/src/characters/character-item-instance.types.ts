import type { Equipment } from '@theend/rpg-domain';
import type {
  AdminItem,
  BlacksmithUsedCarpenterComponentSnapshot,
  CarpenterCraftedComponentSnapshot,
  ItemEffect,
  ItemSocket,
} from '../content/content.types';

export interface CharacterItemInstanceStatOverrides {
  damageMin?: number;
  damageMax?: number;
  armorValue?: number;
  price?: number;
  attackRange?: number;
  pierceTargets?: number;
  splashRadius?: number;
  splashCenterMultiplier?: number;
  splashOuterMultiplier?: number;
  bonuses?: Partial<Record<'hp' | 'mp' | 'stamina' | 'strength' | 'constitution' | 'dexterity' | 'intelligence' | 'luck' | 'perception' | 'willpower', number>>;
  equipmentEffects?: ItemEffect[];
  augmentSlots?: ItemSocket[];
  maxAugmentSlots?: number;
  canAddAugmentSlots?: boolean;
  canHaveRuneComplex?: boolean;
}

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
  sourceItemId?: string;
  itemSnapshot?: AdminItem;
  customName?: string;
  statOverrides?: CharacterItemInstanceStatOverrides;
  qualityTierId?: string;
  qualityTier?: number;
  forgeScore?: number;
  forgedAtIso?: string;
  ownerTag?: string;
  craftedFromTemplateId?: string;
  craftedMaterialIds?: string[];
  craftedByProfession?: 'blacksmithing' | 'carpenter';
  carpenterComponent?: CarpenterCraftedComponentSnapshot;
  carpenterComponentsUsed?: BlacksmithUsedCarpenterComponentSnapshot[];
  tags?: string[];
  notes?: string;
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

  const normalizeAdminItemSnapshot = (rawValue: unknown): AdminItem | undefined => {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return undefined;
    }
    const record = rawValue as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!id || !name) {
      return undefined;
    }
    return record as unknown as AdminItem;
  };

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

  const statOverridesRaw = raw.statOverrides;
  const statOverrides = statOverridesRaw && typeof statOverridesRaw === 'object' && !Array.isArray(statOverridesRaw)
    ? (statOverridesRaw as CharacterItemInstanceStatOverrides)
    : undefined;

  return {
    version,
    augmentSlots,
    sourceItemId: typeof raw.sourceItemId === 'string' ? raw.sourceItemId : undefined,
    itemSnapshot: normalizeAdminItemSnapshot(raw.itemSnapshot),
    customName: typeof raw.customName === 'string' ? raw.customName : undefined,
    statOverrides,
    qualityTierId: typeof raw.qualityTierId === 'string' ? raw.qualityTierId : undefined,
    qualityTier: typeof raw.qualityTier === 'number' && Number.isFinite(raw.qualityTier)
      ? Math.max(0, Math.floor(raw.qualityTier))
      : undefined,
    forgeScore: typeof raw.forgeScore === 'number' && Number.isFinite(raw.forgeScore)
      ? raw.forgeScore
      : undefined,
    forgedAtIso: typeof raw.forgedAtIso === 'string' ? raw.forgedAtIso : undefined,
    ownerTag: typeof raw.ownerTag === 'string' ? raw.ownerTag : undefined,
    craftedFromTemplateId: typeof raw.craftedFromTemplateId === 'string' ? raw.craftedFromTemplateId : undefined,
    craftedMaterialIds: Array.isArray(raw.craftedMaterialIds)
      ? raw.craftedMaterialIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : undefined,
    craftedByProfession:
      raw.craftedByProfession === 'blacksmithing' || raw.craftedByProfession === 'carpenter'
        ? raw.craftedByProfession
        : undefined,
    carpenterComponent: raw.carpenterComponent && typeof raw.carpenterComponent === 'object' && !Array.isArray(raw.carpenterComponent)
      ? (raw.carpenterComponent as CarpenterCraftedComponentSnapshot)
      : undefined,
    carpenterComponentsUsed: Array.isArray(raw.carpenterComponentsUsed)
      ? raw.carpenterComponentsUsed.filter((entry): entry is BlacksmithUsedCarpenterComponentSnapshot => (
        Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      ))
      : undefined,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
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

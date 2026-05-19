import type { NpcCombatData, NpcCondition, NpcDefinition, NpcInventoryData, NpcMapBinding, NpcTrainerData } from '../types/npc';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(value: unknown, issues: string[], pathLabel: string): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  issues.push(`${pathLabel} ожидался массив строк, получено ${typeof value}. Установлено [].`);
  return [];
}

function asArray<T>(value: unknown, issues: string[], pathLabel: string): T[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as T[];
  issues.push(`${pathLabel} ожидался массив, получено ${typeof value}. Установлено [].`);
  return [];
}

export interface NpcAdminNormalizationResult {
  npc: NpcDefinition;
  issues: string[];
}

export function normalizeNpcForAdmin(rawNpc: unknown): NpcAdminNormalizationResult {
  const issues: string[] = [];
  const raw = (rawNpc && typeof rawNpc === 'object') ? (rawNpc as Record<string, any>) : {};
  if (!rawNpc || typeof rawNpc !== 'object') {
    issues.push('NPC не является объектом. Загружен пустой шаблон.');
  }

  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) {
    issues.push('Отсутствует строковое поле id.');
  }

  const name = typeof raw.name === 'string' ? raw.name : 'Без имени';
  if (typeof raw.name !== 'string') {
    issues.push('Отсутствует строковое поле name. Установлено "Без имени".');
  }

  const now = new Date().toISOString();

  const mapBindings = asArray<NpcMapBinding>(raw.mapBindings, issues, 'mapBindings').map((entry) => ({
    ...entry,
    id: asString((entry as any)?.id, ''),
    mapId: asString((entry as any)?.mapId, 'worldmap-main'),
    spawnType: asString((entry as any)?.spawnType, 'fixed') as NpcMapBinding['spawnType'],
    visibleToPlayer: asBoolean((entry as any)?.visibleToPlayer, true),
    conditions: Array.isArray((entry as any)?.conditions) ? (entry as any).conditions as NpcCondition[] : (entry as any)?.conditions,
  }));

  const dialogues = asArray(raw.dialogues, issues, 'dialogues');
  const questBindings = asArray(raw.questBindings, issues, 'questBindings');

  let conditions: NpcCondition[] | undefined;
  if (raw.conditions === undefined) {
    conditions = undefined;
  } else if (Array.isArray(raw.conditions)) {
    conditions = raw.conditions as NpcCondition[];
  } else {
    issues.push(`conditions ожидался массив, получено ${typeof raw.conditions}. Установлено [].`);
    conditions = [];
  }

  const rawCombat = raw.combat && typeof raw.combat === 'object' ? raw.combat as Record<string, any> : null;
  const combat: NpcCombatData | undefined = rawCombat ? ({
    ...rawCombat,
    level: asNumber(rawCombat.level, 1),
    role: asString(rawCombat.role, 'none') as NpcCombatData['role'],
    hp: asNumber(rawCombat.hp, 1),
    skillIds: asStringArray(rawCombat.skillIds, issues, 'combat.skillIds'),
    armorItemIds: asStringArray(rawCombat.armorItemIds, issues, 'combat.armorItemIds'),
  }) : undefined;

  const rawInventory = raw.inventory && typeof raw.inventory === 'object' ? raw.inventory as Record<string, any> : null;
  const inventory: NpcInventoryData = {
    ...(rawInventory ?? {}),
    itemIds: asStringArray(rawInventory?.itemIds, issues, 'inventory.itemIds'),
    questItemIds: asStringArray(rawInventory?.questItemIds, issues, 'inventory.questItemIds'),
    lootTableId: rawInventory?.lootTableId,
    goldMin: rawInventory?.goldMin === undefined ? 0 : asNumber(rawInventory.goldMin, 0),
    goldMax: rawInventory?.goldMax === undefined ? 0 : asNumber(rawInventory.goldMax, 0),
  };

  const rawTrainer = raw.trainer && typeof raw.trainer === 'object' ? raw.trainer as Record<string, any> : null;
  const trainer: NpcTrainerData | undefined = rawTrainer ? ({
    ...rawTrainer,
    professionIds: rawTrainer.professionIds === undefined ? undefined : asStringArray(rawTrainer.professionIds, issues, 'trainer.professionIds'),
    skillIds: rawTrainer.skillIds === undefined ? undefined : asStringArray(rawTrainer.skillIds, issues, 'trainer.skillIds'),
    requiresQuestIds: rawTrainer.requiresQuestIds === undefined ? undefined : asStringArray(rawTrainer.requiresQuestIds, issues, 'trainer.requiresQuestIds'),
    requiresReputation: rawTrainer.requiresReputation === undefined ? undefined : asNumber(rawTrainer.requiresReputation, 0),
    priceGold: rawTrainer.priceGold === undefined ? undefined : asNumber(rawTrainer.priceGold, 0),
  }) : undefined;

  const npc: NpcDefinition = {
    ...(raw as any),
    id,
    name,
    status: asString(raw.status, 'draft') as NpcDefinition['status'],
    kind: asString(raw.kind, 'civilian') as NpcDefinition['kind'],
    race: asString(raw.race, 'human') as NpcDefinition['race'],
    description: asString(raw.description, ''),
    mapBindings,
    defaultDisposition: asString(raw.defaultDisposition, 'neutral') as NpcDefinition['defaultDisposition'],
    isUnique: asBoolean(raw.isUnique, true),
    canRespawn: asBoolean(raw.canRespawn, false),
    canFight: asBoolean(raw.canFight, false),
    canTalk: asBoolean(raw.canTalk, true),
    canTrade: asBoolean(raw.canTrade, false),
    canTrain: asBoolean(raw.canTrain, false),
    canGiveQuests: asBoolean(raw.canGiveQuests, false),
    canBeKilled: asBoolean(raw.canBeKilled, false),
    dialogues: dialogues as any,
    questBindings: questBindings as any,
    combat,
    inventory,
    trainer,
    allowedCityIds: raw.allowedCityIds === undefined ? raw.allowedCityIds : asStringArray(raw.allowedCityIds, issues, 'allowedCityIds'),
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
    conditions,
  };

  return { npc, issues };
}

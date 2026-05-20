import type { Equipment } from '@theend/rpg-domain';
import type { AdminItem, ItemEffect, ItemSet, ItemSetBonus } from '../services/content/models';

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  mp: 'мана',
  stamina: 'выносливость',
  strength: 'сила',
  constitution: 'телосложение',
  dexterity: 'ловкость',
  intelligence: 'интеллект',
  luck: 'удача',
  perception: 'восприятие',
  willpower: 'воля',
};

const DAMAGE_CATEGORY_LABELS: Record<string, string> = {
  physical: 'физического',
  elemental: 'стихийного',
  magic: 'магического',
  shamanic: 'шаманского',
  runic: 'рунного',
  poison: 'ядовитого',
  bleed: 'кровоточащего',
  true: 'чистого',
};

export interface EquippedItemSetBonusSummary {
  requiredPieces: number;
  isActive: boolean;
  description?: string;
  effects: unknown[];
  lines: string[];
}

export interface EquippedItemSetSummary {
  setId: string;
  setName: string;
  totalPieces: number;
  equippedPieces: number;
  equippedItemIds: string[];
  activeBonuses: EquippedItemSetBonusSummary[];
  inactiveBonuses: EquippedItemSetBonusSummary[];
  bonuses: EquippedItemSetBonusSummary[];
  state: 'active' | 'near' | 'inactive';
}

interface EquippedItemSetSummaryParams {
  equipment: Equipment;
  itemSets: ItemSet[];
  resolveAdminItemById?: (itemId: string) => AdminItem | null;
}

function signedNumber(value: number, suffix = ''): string {
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function getEffectNumber(effect: ItemEffect): { value: number; suffix: string } | null {
  if (typeof effect.flat === 'number' && Number.isFinite(effect.flat)) {
    return { value: effect.flat, suffix: '' };
  }
  if (typeof effect.value === 'number' && Number.isFinite(effect.value)) {
    return { value: effect.value, suffix: '' };
  }
  if (typeof effect.percent === 'number' && Number.isFinite(effect.percent)) {
    return { value: effect.percent, suffix: '%' };
  }
  return null;
}

function formatDamageScope(effect: ItemEffect): string {
  if (effect.damageCategory) {
    return DAMAGE_CATEGORY_LABELS[effect.damageCategory] ?? effect.damageCategory;
  }
  if (effect.physicalType) {
    return effect.physicalType;
  }
  if (effect.elementType) {
    return effect.elementType;
  }
  if (effect.magicSchool) {
    return effect.magicSchool;
  }
  return 'любого';
}

export function formatItemSetEffect(effect: unknown): string {
  if (!effect || typeof effect !== 'object') {
    return String(effect ?? 'неизвестный эффект');
  }

  const typed = effect as ItemEffect;
  const amount = getEffectNumber(typed);

  if (typed.type === 'stat_bonus') {
    const label = typed.stat ? STAT_LABELS[typed.stat] ?? typed.stat : 'характеристика';
    return amount ? `${signedNumber(amount.value, amount.suffix)} ${label}` : `Бонус к ${label}`;
  }

  if (typed.type === 'incoming_damage_modifier') {
    const scope = formatDamageScope(typed);
    return amount ? `${signedNumber(amount.value, amount.suffix)} входящего ${scope} урона` : `Модификатор входящего ${scope} урона`;
  }

  if (typed.type === 'outgoing_damage_modifier') {
    const scope = formatDamageScope(typed);
    return amount ? `${signedNumber(amount.value, amount.suffix)} исходящего ${scope} урона` : `Модификатор исходящего ${scope} урона`;
  }

  if (typed.type === 'crit_chance_modifier') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} шанса крита` : 'Модификатор шанса крита';
  }

  if (typed.type === 'crit_damage_modifier') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} критического урона` : 'Модификатор критического урона';
  }

  if (typed.type === 'block_chance_modifier') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} блока` : 'Модификатор блока';
  }

  if (typed.type === 'dodge_chance_modifier') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} уклонения` : 'Модификатор уклонения';
  }

  if (typed.type === 'hit_chance_modifier') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} попадания` : 'Модификатор попадания';
  }

  if (typed.type === 'lifesteal') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} вампиризма` : 'Вампиризм';
  }

  if (typed.type === 'status_resistance') {
    return amount ? `${signedNumber(amount.value, amount.suffix)} сопротивления статусу ${typed.statusId ?? ''}`.trim() : `Сопротивление статусу ${typed.statusId ?? ''}`.trim();
  }

  if (typed.type === 'status_immunity') {
    return `Иммунитет к статусу ${typed.statusId ?? ''}`.trim();
  }

  return amount ? `${typed.type}: ${signedNumber(amount.value, amount.suffix)}` : typed.type;
}

function normalizeBonus(bonus: ItemSetBonus, equippedPieces: number): EquippedItemSetBonusSummary {
  const effects = [
    ...((Array.isArray(bonus.effects) ? bonus.effects : []) as unknown[]),
    ...((Array.isArray(bonus.penaltyEffects) ? bonus.penaltyEffects : []) as unknown[]),
  ];

  return {
    requiredPieces: bonus.requiredPieces,
    isActive: equippedPieces >= bonus.requiredPieces,
    description: bonus.description?.trim() || undefined,
    effects,
    lines: effects.map((effect) => formatItemSetEffect(effect)),
  };
}

function getEquippedItemIds(equipment: Equipment): string[] {
  return Array.from(new Set(Object.values(equipment).filter((itemId): itemId is string => Boolean(itemId))));
}

function itemBelongsToSet(itemId: string, itemSet: ItemSet, adminItem: AdminItem | null): boolean {
  if ((itemSet.pieceItemIds ?? []).includes(itemId)) {
    return true;
  }
  return adminItem?.setId === itemSet.id;
}

export function getEquippedItemSetSummaries(params: EquippedItemSetSummaryParams): EquippedItemSetSummary[] {
  const equippedItemIds = getEquippedItemIds(params.equipment);

  return (params.itemSets ?? [])
    .filter((itemSet) => itemSet && itemSet.isEnabled !== false)
    .map((itemSet) => {
      const equippedPieces = equippedItemIds.filter((itemId) => (
        itemBelongsToSet(itemId, itemSet, params.resolveAdminItemById?.(itemId) ?? null)
      ));
      const totalPieces = Math.max((itemSet.pieceItemIds ?? []).length, equippedPieces.length);
      const bonuses = (itemSet.bonuses ?? [])
        .filter((bonus) => bonus && Number.isFinite(bonus.requiredPieces))
        .map((bonus) => normalizeBonus(bonus, equippedPieces.length))
        .sort((left, right) => left.requiredPieces - right.requiredPieces);
      const activeBonuses = bonuses.filter((bonus) => bonus.isActive);
      const inactiveBonuses = bonuses.filter((bonus) => !bonus.isActive);
      const nextInactiveRequirement = inactiveBonuses[0]?.requiredPieces ?? null;

      return {
        setId: itemSet.id,
        setName: itemSet.name,
        totalPieces,
        equippedPieces: equippedPieces.length,
        equippedItemIds: equippedPieces,
        activeBonuses,
        inactiveBonuses,
        bonuses,
        state: activeBonuses.length > 0 ? 'active' : nextInactiveRequirement !== null && nextInactiveRequirement - equippedPieces.length <= 1 ? 'near' : 'inactive',
      } satisfies EquippedItemSetSummary;
    })
    .filter((summary) => summary.equippedPieces > 0 || summary.activeBonuses.length > 0);
}

export function getItemSetSummaryForItem(
  itemId: string | null | undefined,
  summaries: EquippedItemSetSummary[],
  itemSets: ItemSet[],
  adminItem: AdminItem | null,
): EquippedItemSetSummary | null {
  if (!itemId) {
    return null;
  }

  const directSummary = summaries.find((summary) => (
    summary.equippedItemIds.includes(itemId)
    || summary.setId === adminItem?.setId
  ));
  if (directSummary) {
    return directSummary;
  }

  const itemSet = itemSets.find((entry) => (
    entry.isEnabled !== false
    && ((entry.pieceItemIds ?? []).includes(itemId) || entry.id === adminItem?.setId)
  ));
  if (!itemSet) {
    return null;
  }

  const bonuses = (itemSet.bonuses ?? [])
    .filter((bonus) => bonus && Number.isFinite(bonus.requiredPieces))
    .map((bonus) => normalizeBonus(bonus, 0))
    .sort((left, right) => left.requiredPieces - right.requiredPieces);

  return {
    setId: itemSet.id,
    setName: itemSet.name,
    totalPieces: (itemSet.pieceItemIds ?? []).length,
    equippedPieces: 0,
    equippedItemIds: [],
    activeBonuses: [],
    inactiveBonuses: bonuses,
    bonuses,
    state: 'inactive',
  };
}

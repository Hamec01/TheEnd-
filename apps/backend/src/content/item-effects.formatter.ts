import type { DamageCategory, ElementType, ItemEffect, MagicSchool, PhysicalType, StatKey } from './content.types';

export interface FormatItemEffectOptions {
  statusNames?: Partial<Record<string, string>>;
  statNames?: Partial<Record<StatKey, string>>;
  includeCondition?: boolean;
}

const DEFAULT_STAT_NAMES: Record<StatKey, string> = {
  hp: 'здоровью',
  mp: 'мане',
  stamina: 'выносливости',
  strength: 'силе',
  dexterity: 'ловкости',
  constitution: 'телосложению',
  intelligence: 'интеллекту',
  willpower: 'силе воли',
  perception: 'восприятию',
  luck: 'удаче',
};

const DAMAGE_CATEGORY_LABELS: Record<DamageCategory, string> = {
  physical: 'физического урона',
  elemental: 'стихийного урона',
  magic: 'магического урона',
  shamanic: 'шаманского урона',
  runic: 'рунического урона',
  poison: 'урона ядом',
  bleed: 'урона кровотечением',
  true: 'чистого урона',
};

const PHYSICAL_TYPE_LABELS: Record<PhysicalType, string> = {
  slash: 'рубящего урона',
  pierce: 'колющего урона',
  blunt: 'дробящего урона',
  cleave: 'рассекающего урона',
  unarmed: 'урона без оружия',
};

const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
  fire: 'огненного урона',
  water: 'водного урона',
  earth: 'земляного урона',
  air: 'воздушного урона',
  light: 'урона светом',
  dark: 'урона тьмой',
};

const MAGIC_SCHOOL_LABELS: Record<MagicSchool, string> = {
  blood: 'урона магией крови',
  death: 'урона магией смерти',
  life: 'урона магией жизни',
  mind: 'урона магией разума',
  illusion: 'урона магией иллюзий',
  curse: 'урона магией проклятий',
  arcane: 'урона тайной магией',
};

const TRIGGER_LABELS: Record<NonNullable<ItemEffect['trigger']>, string> = {
  on_hit: 'При попадании',
  on_crit: 'При критическом попадании',
  on_use: 'При использовании',
  on_turn_start: 'В начале хода',
  on_turn_end: 'В конце хода',
  always: 'Постоянно',
};

const DEFAULT_STATUS_NAMES: Record<string, string> = {
  blinded: 'ослепление',
  blind: 'ослепление',
  stunned: 'оглушение',
  stun: 'оглушение',
  bleeding: 'кровотечение',
  bleed: 'кровотечение',
  poisoned: 'отравление',
  poison: 'отравление',
  burning: 'горение',
  burn: 'горение',
  frozen: 'заморозка',
  freeze: 'заморозка',
  silenced: 'немота',
  silence: 'немота',
  cursed: 'проклятие',
  curse: 'проклятие',
};

export function formatItemEffect(effect: ItemEffect, options?: FormatItemEffectOptions): string {
  const conditionPart = formatCondition(effect.condition, options?.includeCondition);

  switch (effect.type) {
    case 'stat_bonus': {
      const value = getNumericValue(effect);
      const stat = effect.stat;
      if (!stat) {
        return withCondition('Бонус к характеристикам', conditionPart);
      }
      const statName = options?.statNames?.[stat] ?? DEFAULT_STAT_NAMES[stat] ?? stat;
      return withCondition(`${formatSignedNumber(value)} к ${statName}`, conditionPart);
    }

    case 'incoming_damage_modifier': {
      const value = getPercentValue(effect);
      const damagePart = getDamagePart(effect);
      if (value < 0) {
        return withCondition(`+${absNumber(value)}% к защите от ${damagePart}`, conditionPart);
      }
      return withCondition(`${formatSignedNumber(value)}% к получаемому ${damagePart}`, conditionPart);
    }

    case 'outgoing_damage_modifier': {
      const value = getPercentValue(effect);
      const damagePart = getDamagePart(effect);
      return withCondition(`${formatSignedNumber(value)}% к наносимому ${damagePart}`, conditionPart);
    }

    case 'armor_penetration': {
      const value = getPercentValue(effect);
      return withCondition(`Игнорирует ${absNumber(value)}% брони цели`, conditionPart);
    }

    case 'crit_chance_modifier': {
      const value = getPercentValue(effect);
      return withCondition(`${formatSignedNumber(value)}% к шансу критического удара`, conditionPart);
    }

    case 'crit_damage_modifier': {
      const value = getPercentValue(effect);
      return withCondition(`${formatSignedNumber(value)}% к урону критического удара`, conditionPart);
    }

    case 'crit_chance_taken_modifier': {
      const value = getPercentValue(effect);
      if (value < 0) {
        return withCondition(`-${absNumber(value)}% к шансу получить критический удар`, conditionPart);
      }
      return withCondition(`+${absNumber(value)}% к шансу получить критический удар`, conditionPart);
    }

    case 'lifesteal': {
      const value = getPercentValue(effect);
      return withCondition(`Вампиризм ${absNumber(value)}% от нанесённого урона`, conditionPart);
    }

    case 'apply_status': {
      const statusName = formatStatusName(effect.statusId, options?.statusNames);
      const chance = absNumber(getChancePercent(effect));
      const duration = formatDuration(effect.durationTurns);
      const triggerPrefix = formatTriggerPrefix(effect.trigger);
      const base = `${chance}% шанс наложить ${statusName}${duration}`;
      return withCondition(`${triggerPrefix}${base}`, conditionPart);
    }

    case 'status_resistance': {
      const value = getPercentValue(effect);
      const statusName = formatStatusName(effect.statusId, options?.statusNames);
      return withCondition(`${formatSignedNumber(value)}% сопротивления эффекту «${statusName}»`, conditionPart);
    }

    case 'status_immunity': {
      const statusName = formatStatusName(effect.statusId, options?.statusNames);
      return withCondition(`Иммунитет к эффекту «${statusName}»`, conditionPart);
    }

    case 'block_chance_modifier': {
      const value = getPercentValue(effect);
      return withCondition(`${formatSignedNumber(value)}% к шансу блока`, conditionPart);
    }

    case 'dodge_chance_modifier': {
      const value = getPercentValue(effect);
      return withCondition(`${formatSignedNumber(value)}% к шансу уклонения`, conditionPart);
    }

    case 'hit_chance_modifier': {
      const value = getPercentValue(effect);
      return withCondition(`${formatSignedNumber(value)}% к шансу попадания`, conditionPart);
    }

    case 'extra_attack_chance': {
      const value = getPercentValue(effect);
      return withCondition(`${formatSignedNumber(value)}% к шансу дополнительной атаки`, conditionPart);
    }

    default:
      return withCondition('Неизвестный эффект предмета', conditionPart);
  }
}

function getDamagePart(effect: ItemEffect): string {
  if (effect.physicalType) {
    return PHYSICAL_TYPE_LABELS[effect.physicalType] ?? 'урона';
  }
  if (effect.elementType) {
    return ELEMENT_TYPE_LABELS[effect.elementType] ?? 'урона';
  }
  if (effect.magicSchool) {
    return MAGIC_SCHOOL_LABELS[effect.magicSchool] ?? 'урона';
  }
  if (effect.damageCategory) {
    return DAMAGE_CATEGORY_LABELS[effect.damageCategory] ?? 'урона';
  }
  return 'урона';
}

function getNumericValue(effect: ItemEffect): number {
  if (typeof effect.value === 'number' && Number.isFinite(effect.value)) {
    return effect.value;
  }
  if (typeof effect.flat === 'number' && Number.isFinite(effect.flat)) {
    return effect.flat;
  }
  if (typeof effect.percent === 'number' && Number.isFinite(effect.percent)) {
    return effect.percent;
  }
  return 0;
}

function getPercentValue(effect: ItemEffect): number {
  if (typeof effect.percent === 'number' && Number.isFinite(effect.percent)) {
    return effect.percent;
  }
  if (typeof effect.value === 'number' && Number.isFinite(effect.value)) {
    return effect.value;
  }
  if (typeof effect.flat === 'number' && Number.isFinite(effect.flat)) {
    return effect.flat;
  }
  return 0;
}

function getChancePercent(effect: ItemEffect): number {
  if (typeof effect.chancePercent === 'number' && Number.isFinite(effect.chancePercent)) {
    return effect.chancePercent;
  }
  return getPercentValue(effect);
}

function formatSignedNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '+0';
  }
  return `${value >= 0 ? '+' : ''}${trimTrailingZeros(value)}`;
}

function absNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return trimTrailingZeros(Math.abs(value));
}

function trimTrailingZeros(value: number): string {
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return normalized.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatStatusName(statusId?: string, customNames?: Partial<Record<string, string>>): string {
  if (!statusId || !statusId.trim()) {
    return 'эффект';
  }
  const normalized = statusId.trim();
  const lower = normalized.toLowerCase();
  const mapped = customNames?.[lower] ?? DEFAULT_STATUS_NAMES[lower];
  if (mapped) {
    return mapped;
  }
  return lower
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDuration(durationTurns?: number): string {
  if (typeof durationTurns !== 'number' || !Number.isFinite(durationTurns) || durationTurns <= 0) {
    return '';
  }
  const turns = Math.floor(durationTurns);
  const unit = turns % 10 === 1 && turns % 100 !== 11 ? 'ход' : 'хода';
  return ` на ${turns} ${unit}`;
}

function formatTriggerPrefix(trigger?: ItemEffect['trigger']): string {
  if (!trigger || trigger === 'always') {
    return '';
  }
  const label = TRIGGER_LABELS[trigger] ?? 'При срабатывании';
  return `${label}: `;
}

function formatCondition(condition: string | undefined, includeCondition: boolean | undefined): string {
  if (!includeCondition || !condition || !condition.trim()) {
    return '';
  }
  return ` (условие: ${condition.trim()})`;
}

function withCondition(base: string, conditionPart: string): string {
  if (!conditionPart) {
    return base;
  }
  return `${base}${conditionPart}`;
}

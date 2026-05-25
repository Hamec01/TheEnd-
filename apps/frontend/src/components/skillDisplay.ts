import type { AdminSkillDefinition } from '@theend/rpg-domain';

function list(values: unknown[]): string {
  return values.map((value) => formatSkillValue(value)).filter(Boolean).join(', ');
}

function formatSkillValue(value: unknown): string {
  return String(value ?? '').trim().replace(/_/g, ' ');
}

const STAT_SHORT_LABELS: Record<string, string> = {
  strength: 'STR',
  constitution: 'CON',
  dexterity: 'DEX',
  intelligence: 'INT',
  luck: 'LCK',
  perception: 'PER',
  willpower: 'WIL',
  hp: 'HP',
  mp: 'MP',
  stamina: 'STA',
};

function formatMultiplier(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function getScalingFormula(
  components: Array<{ scalingStat?: string; scalingMultiplier?: number }>,
): string {
  const aggregated = new Map<string, number>();
  for (const component of components) {
    const stat = String(component.scalingStat ?? '').trim().toLowerCase();
    const multiplier = Number(component.scalingMultiplier);
    if (!stat || !Number.isFinite(multiplier) || multiplier === 0) {
      continue;
    }
    aggregated.set(stat, (aggregated.get(stat) ?? 0) + multiplier);
  }

  const entries = Array.from(aggregated.entries()).filter(([, multiplier]) => multiplier !== 0);
  if (entries.length === 0) {
    return '';
  }

  return entries
    .map(([stat, multiplier], index) => {
      const label = STAT_SHORT_LABELS[stat] ?? stat.toUpperCase();
      const value = formatMultiplier(Math.abs(multiplier));
      if (index === 0) {
        return `${multiplier < 0 ? '-' : ''}${value}*${label}`;
      }
      return `${multiplier < 0 ? '-' : '+'}${value}*${label}`;
    })
    .join(' ');
}

export function getSkillResourceSummary(skill: AdminSkillDefinition): string {
  if (skill.costs?.isFree) return 'без затрат';
  const resources = Array.isArray(skill.costs?.resources) ? skill.costs.resources : [];
  const parts = resources
    .map((cost) => `${cost.amount}${cost.amountPerLevel ? `+${cost.amountPerLevel}/ур.` : ''} ${formatSkillValue(cost.type)}`)
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'смотри описание';
}

export function getSkillDetailFacts(skill: AdminSkillDefinition): Array<{ label: string; value: string }> {
  return [
    { label: 'Тип', value: formatSkillValue(skill.type) },
    { label: 'Навык', value: skill.name },
    { label: 'Макс. уровень', value: String(skill.maxLevel) },
    { label: 'Перезарядка', value: `${skill.cooldown?.cooldownTurns ?? 0} ходов` },
  ];
}

export function getSkillSummaryLines(skill: AdminSkillDefinition): string[] {
  const lines = [
    skill.gameplayDescription?.trim() || skill.shortDescription?.trim() || 'Описание не заполнено.',
    `Ресурсы: ${getSkillResourceSummary(skill)}`,
    `Перезарядка: ${skill.cooldown?.cooldownTurns ?? 0} ходов`,
    `Тип: ${formatSkillValue(skill.type)}`,
  ];

  const damage = Array.isArray(skill.damage) ? skill.damage : [];
  if (damage.length > 0) {
    const min = damage.reduce((sum, item) => sum + (Number.isFinite(item.minDamage) ? item.minDamage : 0), 0);
    const max = damage.reduce((sum, item) => sum + (Number.isFinite(item.maxDamage) ? item.maxDamage : 0), 0);
    const scalingFormula = getScalingFormula(damage);
    const kinds = Array.from(new Set(damage.map((item) => item.damageKind).filter(Boolean)));
    const schools = Array.from(new Set(damage.map((item) => item.magicSchool).filter(Boolean)));
    const elements = Array.from(new Set(damage.flatMap((item) => item.elements ?? []).filter(Boolean)));
    lines.push(`Урон: ${min}-${max}${scalingFormula ? ` + ${scalingFormula}` : ''}${kinds.length ? ` · ${list(kinds)}` : ''}`);
    if (schools.length) lines.push(`Школа: ${list(schools)}`);
    if (elements.length) lines.push(`Элемент: ${list(elements)}`);
  }

  const healing = Array.isArray(skill.healing) ? skill.healing : [];
  if (healing.length > 0) {
    const min = healing.reduce((sum, item) => sum + (Number.isFinite(item.minHeal) ? item.minHeal : 0), 0);
    const max = healing.reduce((sum, item) => sum + (Number.isFinite(item.maxHeal) ? item.maxHeal : 0), 0);
    const scalingFormula = getScalingFormula(healing);
    const types = Array.from(new Set(healing.map((item) => item.healType).filter(Boolean)));
    lines.push(`Лечение: ${min}-${max}${scalingFormula ? ` + ${scalingFormula}` : ''}${types.length ? ` · ${list(types)}` : ''}`);
  }

  const effects = Array.isArray(skill.effects) ? skill.effects : [];
  if (effects.length > 0) {
    const preview = effects.slice(0, 4).map((effect) => {
      const duration = effect.durationTurns ? ` ${effect.durationTurns} ход.` : '';
      return `${effect.effectType} ${effect.chancePercent}%${duration}`;
    });
    lines.push(`Эффекты: ${preview.join(', ')}`);
  }

  if (typeof skill.target?.range === 'number') lines.push(`Дистанция: ${skill.target.range}`);
  if (skill.cast?.requiresLineOfSight) lines.push('Требует линию видимости');
  return lines;
}

export function canUseSkillOutsideCombat(skill: AdminSkillDefinition | null | undefined): boolean {
  if (!skill || skill.isHidden || !skill.isPublished) return false;
  const raw = skill as unknown as Record<string, unknown>;
  const explicitlyAllowed = raw.canUseOutsideCombat === true
    || raw.usableOutsideCombat === true
    || (typeof raw.outOfCombat === 'object' && raw.outOfCombat !== null && (raw.outOfCombat as Record<string, unknown>).enabled === true);
  const hasHealing = Array.isArray(skill.healing) && skill.healing.length > 0;
  return explicitlyAllowed || hasHealing;
}

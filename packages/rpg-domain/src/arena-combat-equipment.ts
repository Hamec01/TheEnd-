export interface ArenaIncomingDamageAdjust {
  /** Плоская поправка к итоговому урону (отрицательное — меньше урона). */
  flat: number;
  /** Суммарный процент: итог *= 1 + percent/100 */
  percent: number;
}

/**
 * Заранее агрегированные пассивные модификаторы из экипировки/сетов для шага разрешения удара в арене.
 */
export interface ArenaCombatEquipmentModifiers {
  hitChancePercent: number;
  critChancePercent: number;
  dodgeChancePercent: number;
  blockChancePercent: number;
  critChanceTakenPercent: number;
  outgoingDamagePercent: number;
  incomingPhysical: ArenaIncomingDamageAdjust;
  incomingMagic: ArenaIncomingDamageAdjust;
}

export function emptyArenaCombatEquipmentModifiers(): ArenaCombatEquipmentModifiers {
  const zero = { flat: 0, percent: 0 };
  return {
    hitChancePercent: 0,
    critChancePercent: 0,
    dodgeChancePercent: 0,
    blockChancePercent: 0,
    critChanceTakenPercent: 0,
    outgoingDamagePercent: 0,
    incomingPhysical: { ...zero },
    incomingMagic: { ...zero },
  };
}

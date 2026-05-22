import {
  TargetZone,
  TeamSide,
  createCombatCommandFromType,
  getBattlefieldDistance,
  type CombatQuickSlotId,
  type AdminSkillDefinition,
  type ArenaBattleState,
  type ArenaCombatEntity,
  type CombatCommand,
} from '@theend/rpg-domain';

export type ClickedCombatTarget =
  | { kind: 'self'; actorId: string }
  | { kind: 'entity'; entityId: string }
  | { kind: 'cell'; x: number; y: number };

export type SelectedCombatSource =
  | { kind: 'none' }
  | { kind: 'skill'; slotId?: CombatQuickSlotId; skillId: string }
  | { kind: 'item'; slotId?: CombatQuickSlotId; itemId: string; itemInstanceId?: string }
  | { kind: 'weapon'; slotId?: CombatQuickSlotId; weaponItemId: string; weaponInstanceId?: string };

export interface CombatContextAction {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
  command?: CombatCommand;
}

function toFiniteAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isCellTargetItem(adminItem: unknown): boolean {
  const raw = toRecord(adminItem);
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  return subtype.includes('bomb') || subtype.includes('trap') || subtype.includes('grenade');
}

function isLikelyBomb(adminItem: unknown): boolean {
  const raw = toRecord(adminItem);
  const type = String(raw?.itemType ?? '').toLowerCase();
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  const name = String(raw?.name ?? '').toLowerCase();
  return subtype.includes('bomb') || subtype.includes('grenade') || name.includes('bomb') || name.includes('grenade') || type.includes('explosive');
}

function isLikelyTrap(adminItem: unknown): boolean {
  const raw = toRecord(adminItem);
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  const type = String(raw?.itemType ?? '').toLowerCase();
  const name = String(raw?.name ?? '').toLowerCase();
  return subtype.includes('trap') || name.includes('trap') || type.includes('trap');
}

function hasRestoreEffect(adminItem: unknown): boolean {
  const raw = toRecord(adminItem);
  if (!raw) return false;
  const sources: unknown[] = [];
  if (Array.isArray(raw.effects)) sources.push(...raw.effects);
  if (Array.isArray(raw.combatEffects)) sources.push(...raw.combatEffects);
  const single = toRecord(raw.useEffect);
  if (single) sources.push(single);
  return sources
    .map((e) => toRecord(e))
    .filter(Boolean)
    .some((e) => {
      const t = String(e!.type ?? '').toLowerCase();
      return t.includes('heal') || t.includes('restore') || t.includes('regen') || t.includes('hp') || t.includes('mana') || t.includes('stamina');
    });
}

function getSkillTargetType(def: AdminSkillDefinition | null | undefined): string {
  return normalizeSkillTargetConfig(def).targetType;
}

type NormalizedSkillTargetType = 'self' | 'entity' | 'cell';

type NormalizedItemTargetType = 'entity' | 'cell';

type NormalizedSkillTargetConfig = {
  targetType: NormalizedSkillTargetType;
  canTargetSelf: boolean;
  canTargetAllies: boolean;
  canTargetEnemies: boolean;
  range: number | null;
};

export function normalizeSkillTargetConfig(def: AdminSkillDefinition | null | undefined): NormalizedSkillTargetConfig {
  const raw = toRecord(def as unknown);
  const target = raw ? toRecord(raw.target) : null;

  const rawTargetType = String(
    target?.targetType
    ?? raw?.targetType
    ?? '',
  ).trim().toLowerCase();

  const targetType: NormalizedSkillTargetType = rawTargetType === 'self' || rawTargetType === 'cell'
    ? rawTargetType
    : 'entity';

  const explicitSelf = target?.canTargetSelf ?? raw?.canTargetSelf;
  const explicitAllies = target?.canTargetAllies ?? raw?.canTargetAllies;
  const explicitEnemies = target?.canTargetEnemies ?? raw?.canTargetEnemies;

  const canTargetSelf = typeof explicitSelf === 'boolean'
    ? explicitSelf
    : targetType === 'self';
  const canTargetAllies = typeof explicitAllies === 'boolean'
    ? explicitAllies
    : targetType !== 'cell' && targetType !== 'self';
  const canTargetEnemies = typeof explicitEnemies === 'boolean'
    ? explicitEnemies
    : targetType !== 'self';

  const rawRange = target?.range ?? raw?.range;
  const range = typeof rawRange === 'number' && Number.isFinite(rawRange)
    ? Math.max(0, Math.floor(rawRange))
    : null;

  return {
    targetType,
    canTargetSelf,
    canTargetAllies,
    canTargetEnemies,
    range,
  };
}

export function normalizeItemTargetConfig(adminItem: unknown): { targetType: NormalizedItemTargetType } {
  const wantsCell = isCellTargetItem(adminItem) || isLikelyBomb(adminItem) || isLikelyTrap(adminItem);
  if (wantsCell) {
    return { targetType: 'cell' };
  }
  if (hasRestoreEffect(adminItem)) {
    return { targetType: 'entity' };
  }
  return { targetType: 'entity' };
}

function canSkillTarget(def: AdminSkillDefinition | null | undefined, target: ClickedCombatTarget, actor: ArenaCombatEntity, state: ArenaBattleState): { ok: boolean; reason?: string } {
  const targetCfg = normalizeSkillTargetConfig(def);

  if (targetCfg.targetType === 'self' && target.kind !== 'self') {
    return { ok: false, reason: 'Навык применяется только на себя' };
  }
  if (targetCfg.targetType === 'cell' && target.kind !== 'cell') {
    return { ok: false, reason: 'Навык требует выбор клетки' };
  }
  if (targetCfg.targetType === 'entity' && target.kind === 'cell') {
    return { ok: false, reason: 'Навык требует выбор цели' };
  }

  const actorPos = { battlefieldX: actor.battlefieldX ?? 0, battlefieldY: actor.battlefieldY ?? 0 };
  const resolveEntity = (id: string) => state.entities.find((e) => e.id === id) ?? null;

  if (target.kind === 'self') {
    if (target.actorId !== actor.id) return { ok: false, reason: 'Нельзя применить на эту цель' };
    if (!targetCfg.canTargetSelf) return { ok: false, reason: 'Нельзя применить на себя' };
    return { ok: true };
  }

  if (target.kind === 'entity') {
    const entity = resolveEntity(target.entityId);
    if (!entity || !entity.isAlive) return { ok: false, reason: 'Цель недоступна' };
    const isEnemy = entity.team === TeamSide.Right;
    const isAlly = entity.team === TeamSide.Left;
    if (isEnemy && !targetCfg.canTargetEnemies) return { ok: false, reason: 'Нельзя применить на врага' };
    if (isAlly && !targetCfg.canTargetAllies && entity.id !== actor.id) return { ok: false, reason: 'Нельзя применить на союзника' };
    if (entity.id === actor.id && !targetCfg.canTargetSelf) return { ok: false, reason: 'Нельзя применить на себя' };
    if (targetCfg.range != null) {
      const dist = getBattlefieldDistance(actorPos as any, entity as any);
      if (dist > targetCfg.range) return { ok: false, reason: 'Цель вне дистанции' };
    }
    return { ok: true };
  }

  if (target.kind === 'cell') {
    if (targetCfg.range != null) {
      const dist = Math.abs((actor.battlefieldX ?? 0) - target.x) + Math.abs((actor.battlefieldY ?? 0) - target.y);
      if (dist > targetCfg.range) return { ok: false, reason: 'Цель вне дистанции' };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function buildCombatContextActions(params: {
  selectedSource: SelectedCombatSource;
  clickedTarget: ClickedCombatTarget;
  activeActor: ArenaCombatEntity;
  battleState: ArenaBattleState;
  selectedSkill?: { label: string; definition: AdminSkillDefinition } | null;
  resolveAdminItemById?: (itemId: string) => unknown | null;
}): CombatContextAction[] {
  const { selectedSource, clickedTarget, activeActor, battleState, selectedSkill, resolveAdminItemById } = params;

  const actions: CombatContextAction[] = [];
  const addDisabled = (id: string, label: string, reason: string) => actions.push({ id, label, disabled: true, disabledReason: reason });

  if (selectedSource.kind === 'weapon') {
    const label = `Сменить оружие: ${selectedSource.weaponItemId}`;
    actions.push({
      id: 'weapon_swap',
      label,
      command: createCombatCommandFromType({
        type: 'weapon_swap',
        target: { kind: 'self' },
        sourceSlotId: selectedSource.slotId,
        payload: { weaponItemId: selectedSource.weaponItemId, weaponInstanceId: selectedSource.weaponInstanceId },
      }),
    });
    return actions;
  }

  if (selectedSource.kind === 'skill') {
    const def = selectedSkill?.definition;
    const targetCfg = normalizeSkillTargetConfig(def);
    const commandSkillId = selectedSkill?.definition?.id ?? selectedSource.skillId;
    const labelBase = selectedSkill?.label ?? selectedSource.skillId;
    const check = canSkillTarget(def, clickedTarget, activeActor, battleState);
    const targetType = getSkillTargetType(def);
    const label = clickedTarget.kind === 'cell'
      ? `Применить ${labelBase} сюда`
      : clickedTarget.kind === 'self'
        ? `Применить ${labelBase} на себя`
        : `Применить ${labelBase}`;
    if (!check.ok) {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        const actorPos = { x: activeActor.battlefieldX ?? 0, y: activeActor.battlefieldY ?? 0 };
        const targetEntity = clickedTarget.kind === 'entity'
          ? battleState.entities.find((entity) => entity.id === clickedTarget.entityId) ?? null
          : null;
        const targetPos = clickedTarget.kind === 'cell'
          ? { x: clickedTarget.x, y: clickedTarget.y }
          : targetEntity
            ? { x: targetEntity.battlefieldX ?? 0, y: targetEntity.battlefieldY ?? 0 }
            : actorPos;
        const computedDistance = Math.abs(actorPos.x - targetPos.x) + Math.abs(actorPos.y - targetPos.y);
        console.debug('[combat][skill-target-disabled]', {
          skillId: selectedSource.skillId,
          skillName: selectedSkill?.definition?.name ?? labelBase,
          selectedSource,
          clickedTarget,
          parsedTargetConfig: normalizeSkillTargetConfig(def),
          actorPosition: actorPos,
          targetPosition: targetPos,
          computedDistance,
          disabledReason: check.reason ?? 'Нельзя применить на эту цель',
          targetType,
        });
      }
      addDisabled('skill_cast', label, check.reason ?? 'Нельзя применить на эту цель');
      return actions;
    }

    const target: CombatCommand['target'] = clickedTarget.kind === 'cell'
      ? { kind: 'cell', x: clickedTarget.x, y: clickedTarget.y }
      : clickedTarget.kind === 'self'
        ? { kind: 'self' }
        : { kind: 'entity', entityId: clickedTarget.entityId };

    actions.push({
      id: 'skill_cast',
      label,
      command: createCombatCommandFromType({
        type: 'skill_cast',
        target,
        sourceSlotId: selectedSource.slotId,
        payload: {
          skillId: commandSkillId,
          ...(targetCfg.range != null ? { skillRange: targetCfg.range } : {}),
          targetZone: TargetZone.Chest,
        },
      }),
    });
    return actions;
  }

  if (selectedSource.kind === 'item') {
    const adminItem = resolveAdminItemById?.(selectedSource.itemId) ?? null;
    const itemName = String(toRecord(adminItem)?.name ?? selectedSource.itemId);

    const wantsCell = normalizeItemTargetConfig(adminItem).targetType === 'cell';
    const isBomb = isLikelyBomb(adminItem);
    const isTrap = isLikelyTrap(adminItem);
    const isRestore = hasRestoreEffect(adminItem);

    if (isBomb || wantsCell) {
      if (clickedTarget.kind === 'cell') {
        actions.push({
          id: 'item_throw_cell',
          label: `Бросить ${itemName} сюда`,
          command: createCombatCommandFromType({
            type: 'item_use',
            target: { kind: 'cell', x: clickedTarget.x, y: clickedTarget.y },
            sourceSlotId: selectedSource.slotId,
            payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
          }),
        });
        return actions;
      }
      if (clickedTarget.kind === 'entity') {
        const entity = battleState.entities.find((e) => e.id === clickedTarget.entityId) ?? null;
        if (!entity) {
          addDisabled('item_throw_entity', `Бросить ${itemName}`, 'Цель недоступна');
          return actions;
        }
        actions.push({
          id: 'item_throw_entity_cell',
          label: `Бросить ${itemName} в клетку цели`,
          command: createCombatCommandFromType({
            type: 'item_use',
            target: { kind: 'cell', x: entity.battlefieldX ?? 0, y: entity.battlefieldY ?? 0 },
            sourceSlotId: selectedSource.slotId,
            payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
          }),
        });
        return actions;
      }
      addDisabled('item_throw_invalid', `Бросить ${itemName}`, 'Нельзя применить на эту цель');
      return actions;
    }

    if (isTrap) {
      if (clickedTarget.kind !== 'cell') {
        addDisabled('item_trap', `Поставить ${itemName}`, 'Нужно выбрать клетку');
        return actions;
      }
      actions.push({
        id: 'item_trap_cell',
        label: `Поставить ${itemName}`,
        command: createCombatCommandFromType({
          type: 'item_use',
          target: { kind: 'cell', x: clickedTarget.x, y: clickedTarget.y },
          sourceSlotId: selectedSource.slotId,
          payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
        }),
      });
      return actions;
    }

    // Restore/heal style items: allow self or entity.
    if (isRestore) {
      if (clickedTarget.kind === 'cell') {
        addDisabled('item_use', `Использовать ${itemName}`, 'Нужно выбрать цель');
        return actions;
      }
      const target: CombatCommand['target'] = clickedTarget.kind === 'self'
        ? { kind: 'self' }
        : { kind: 'entity', entityId: clickedTarget.entityId };

      actions.push({
        id: 'item_use_restore',
        label: `Использовать ${itemName}`,
        command: createCombatCommandFromType({
          type: 'item_use',
          target,
          sourceSlotId: selectedSource.slotId,
          payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
        }),
      });
      return actions;
    }

    // Fallback item use: prefer entity/self, disable on cell.
    if (clickedTarget.kind === 'cell') {
      addDisabled('item_use', `Использовать ${itemName}`, 'Нельзя применить на клетку');
      return actions;
    }
    actions.push({
      id: 'item_use',
      label: `Использовать ${itemName}`,
      command: createCombatCommandFromType({
        type: 'item_use',
        target: clickedTarget.kind === 'self' ? { kind: 'self' } : { kind: 'entity', entityId: clickedTarget.entityId },
        sourceSlotId: selectedSource.slotId,
        payload: { itemId: selectedSource.itemId, itemInstanceId: selectedSource.itemInstanceId },
      }),
    });
    return actions;
  }

  // No selected source -> no contextual actions here (BattleField default menu remains).
  return actions;
}

export function buildSelectedSourceHint(params: {
  selectedSource: SelectedCombatSource;
  selectedLabel: string;
  resolveAdminItemById?: (itemId: string) => unknown | null;
}): string {
  const { selectedSource, selectedLabel, resolveAdminItemById } = params;

  if (selectedSource.kind === 'skill') {
    return `Выбрано: ${selectedLabel}. Кликните допустимую цель.`;
  }
  if (selectedSource.kind === 'weapon') {
    return `Выбрано: ${selectedLabel}. Кликните цель, чтобы сменить оружие.`;
  }
  if (selectedSource.kind === 'item') {
    const adminItem = resolveAdminItemById?.(selectedSource.itemId) ?? null;
    if (isLikelyTrap(adminItem)) {
      return `Выбрано: ${selectedLabel}. Кликните свободную клетку.`;
    }
    if (isLikelyBomb(adminItem) || isCellTargetItem(adminItem)) {
      return `Выбрано: ${selectedLabel}. Кликните клетку или цель, куда бросить.`;
    }
    if (hasRestoreEffect(adminItem)) {
      return `Выбрано: ${selectedLabel}. Кликните живую цель.`;
    }
    return `Выбрано: ${selectedLabel}. Кликните допустимую цель.`;
  }
  return `Выбрано: ${selectedLabel}.`;
}

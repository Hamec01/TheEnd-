import {
  ActionType,
  COMBAT_ACTION_COSTS,
  MovementType,
  TargetZone,
  TeamSide,
  createCombatCommandFromType,
  getCombatPlanCostTotal,
  getCombatRoundLimits,
  getSkillCostSummary,
  getBattlefieldDistance,
  isActorStandingOnExitZone,
  type AdminSkillDefinition,
  type CombatCommand,
  getItemById,
  type ItemDefinition,
  type ArenaBattleState,
  type Equipment,
  type InventoryState,
} from '@theend/rpg-domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelCombatReady,
  setCombatReady,
  submitCombatPlan,
  validateCombatPlan,
  type ArenaHubState,
  type CharacterActionSlot,
} from '../api';
import type { AdminItem } from '../services/content/models';
import { ActionPlanner } from './ActionPlanner';
import { BattleField } from './BattleField';
import { CombatLogPanel } from './CombatLogPanel';
import { FighterCard } from './FighterCard';
import { InspectPanel } from './InspectPanel';

interface BattlePanelProps {
  combatId: string;
  playerId: string;
  state: ArenaBattleState;
  inventory: InventoryState;
  actionSlots: CharacterActionSlot[];
  mapImageUrl?: string;
  mapCalibration?: {
    cellSizePx?: number;
    gridOffsetX?: number;
    gridOffsetY?: number;
  };
  selectedSkillId: string | null;
  availableSkills: Array<{ skillId: string; level: number; label: string; definition: AdminSkillDefinition }>;
  onSkillChange: (skillId: string | null) => void;
  onStateChange: (next: ArenaBattleState) => void;
  onStatus: (text: string) => void;
  onUseItem?: (itemId: string, targetId?: string) => Promise<void> | void;
  onBattleFinished?: (next: ArenaBattleState, hubState?: ArenaHubState) => Promise<void> | void;
  onClose?: () => void;
  playerAvatarUrl?: string;
  resolveItemById?: (itemId: string) => ItemDefinition | null;
  resolveAdminItemById?: (itemId: string) => AdminItem | null;
  playerEquipment?: Equipment;
}

type CombatPlanningMode =
  | 'idle'
  | 'selecting_target'
  | 'selecting_cell'
  | 'context_menu_open'
  | 'ready'
  | 'resolving';

interface SelectedCombatSource {
  kind: 'none' | 'basic_attack' | 'skill' | 'item' | 'weapon' | 'guard' | 'strong_guard';
  slotId?: CharacterActionSlot['slotId'];
  skillId?: string;
  itemId?: string;
  itemInstanceId?: string;
  weaponItemId?: string;
  weaponInstanceId?: string;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toFiniteAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function accumulateResourceCost(costs: { mana: number; stamina: number; hp: number }, resource: unknown, amount: unknown): void {
  const key = String(resource ?? '').trim().toLowerCase();
  const safeAmount = toFiniteAmount(amount);
  if (safeAmount <= 0) {
    return;
  }
  if (key === 'mana' || key === 'mp') {
    costs.mana += safeAmount;
    return;
  }
  if (key === 'stamina' || key === 'sta') {
    costs.stamina += safeAmount;
    return;
  }
  if (key === 'hp' || key === 'health') {
    costs.hp += safeAmount;
  }
}

function normalizeAdminItemCosts(rawItem: AdminItem | null): { mana: number; stamina: number; hp: number } {
  const costs = { mana: 0, stamina: 0, hp: 0 };
  const raw = toRecord(rawItem as unknown);
  if (!raw) {
    return costs;
  }
  accumulateResourceCost(costs, 'mana', raw.manaCost);
  accumulateResourceCost(costs, 'stamina', raw.staminaCost);
  accumulateResourceCost(costs, 'hp', raw.hpCost);

  const directCosts = Array.isArray(raw.costs) ? raw.costs : [];
  for (const entry of directCosts) {
    const record = toRecord(entry);
    if (record) {
      accumulateResourceCost(costs, record.resource ?? record.type, record.amount);
    }
  }

  const nestedCosts = toRecord(raw.costs);
  const nestedResources = Array.isArray(nestedCosts?.resources) ? nestedCosts.resources : [];
  for (const entry of nestedResources) {
    const record = toRecord(entry);
    if (record) {
      accumulateResourceCost(costs, record.resource ?? record.type, record.amount);
    }
  }

  return costs;
}

function normalizeAdminItemEffects(rawItem: AdminItem | null): Array<{ type: string; amount: number; target?: string }> {
  const raw = toRecord(rawItem as unknown);
  if (!raw) {
    return [];
  }

  const sources: unknown[] = [];
  const singleEffect = toRecord(raw.useEffect);
  if (singleEffect) {
    sources.push(singleEffect);
  }
  if (Array.isArray(raw.effects)) {
    sources.push(...raw.effects);
  }
  if (Array.isArray(raw.combatEffects)) {
    sources.push(...raw.combatEffects);
  }

  return sources
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      type: String(entry.type ?? '').trim().toLowerCase(),
      amount: toFiniteAmount(entry.amount),
      target: typeof entry.target === 'string' ? entry.target : undefined,
    }))
    .filter((entry) => entry.type.length > 0);
}

function parseZoneFromLogText(text: string): TargetZone | null {
  const match = text.match(/in\s+([A-Z_]+)/i);
  const token = match?.[1]?.toUpperCase();
  if (!token) {
    return null;
  }
  if (token === 'HEAD' || token === 'H') return TargetZone.Head;
  if (token === 'CHEST' || token === 'C') return TargetZone.Chest;
  if (token === 'ABDOMEN' || token === 'A') return TargetZone.Abdomen;
  if (token === 'LEFT_ARM' || token === 'LA') return TargetZone.LeftArm;
  if (token === 'RIGHT_ARM' || token === 'RA') return TargetZone.RightArm;
  if (token === 'LEGS' || token === 'L') return TargetZone.Legs;
  return null;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function classifyCombatStyle(entity: { strength: number; dexterity: number; intelligence: number; combatStyleHint?: 'MELEE' | 'RANGED' | 'MAGIC'; attackRange?: number }): 'MELEE' | 'RANGED' | 'MAGIC' {
  if (entity.combatStyleHint) {
    return entity.combatStyleHint;
  }
  if (typeof entity.attackRange === 'number' && entity.attackRange > 1) {
    return 'RANGED';
  }
  if (entity.intelligence >= entity.strength && entity.intelligence >= entity.dexterity) {
    return 'MAGIC';
  }
  if (entity.dexterity > entity.strength) {
    return 'RANGED';
  }
  return 'MELEE';
}

function getActionCost(actionType: ActionType, movementType: MovementType | null, guardMode: 'guard' | 'strong_guard'): number {
  const actionCost = actionType === ActionType.Attack
    ? (COMBAT_ACTION_COSTS.basic_attack.stamina ?? 0)
    : actionType === ActionType.Defend
      ? (guardMode === 'strong_guard' ? (COMBAT_ACTION_COSTS.strong_guard.stamina ?? 0) : (COMBAT_ACTION_COSTS.guard.stamina ?? 0))
      : 0;
  const moveCost = movementType === MovementType.Step
    ? (COMBAT_ACTION_COSTS.move_1_cell.stamina ?? 0)
    : movementType === MovementType.Extra
      ? (COMBAT_ACTION_COSTS.move_2_cells.stamina ?? 0)
      : movementType === MovementType.Dash
        ? (COMBAT_ACTION_COSTS.dash_3_cells.stamina ?? 0)
        : movementType === MovementType.Disengage
          ? (COMBAT_ACTION_COSTS.disengage.stamina ?? 0)
          : 0;
  return actionCost + moveCost;
}

function formatPlanError(error: string): string {
  switch (error) {
    case 'MAX_COMMANDS_REACHED':
      return 'Достигнут лимит команд.';
    case 'NOT_ENOUGH_AP':
      return 'Недостаточно AP.';
    case 'NOT_ENOUGH_STAMINA':
      return 'Недостаточно stamina.';
    case 'NOT_ENOUGH_MP':
      return 'Недостаточно MP.';
    case 'NOT_ENOUGH_HP':
      return 'Недостаточно HP.';
    case 'TARGET_OUT_OF_RANGE':
      return 'Цель вне дальности.';
    case 'INVALID_TARGET':
      return 'Некорректная цель команды.';
    case 'BATTLE_NOT_PLANNING':
      return 'Сейчас нельзя менять план: раунд уже разыгрывается.';
    case 'ROUND_MISMATCH':
      return 'План относится к другому раунду.';
    case 'GUARD_ALREADY_PLANNED':
      return 'Защитная стойка уже запланирована.';
    case 'WEAPON_ID_REQUIRED':
      return 'Не указано оружие для смены.';
    case 'WEAPON_NOT_FOUND':
      return 'Оружие не найдено.';
    case 'ITEM_IS_NOT_WEAPON':
      return 'Это не оружие.';
    case 'WEAPON_ALREADY_EQUIPPED':
      return 'Это оружие уже экипировано.';
    case 'WEAPON_NOT_OWNED':
      return 'У персонажа нет этого оружия.';
    default:
      return error;
  }
}

function formatPlanWarning(warning: string): string {
  switch (warning) {
    case 'FRIENDLY_FIRE':
      return 'Friendly fire включён: все существа в зоне получат эффект. Позиции могут измениться до выполнения действия.';
    case 'ALLY_IN_AREA':
      return 'Внимание: действие заденет союзника.';
    case 'SELF_IN_AREA':
      return 'Внимание: вы тоже попадете в область действия.';
    case 'NEUTRAL_IN_AREA':
      return 'Внимание: действие заденет нейтральную цель.';
    case 'AREA_TARGETS_MAY_CHANGE':
      return 'Текущая зона действия — preview. Реальные цели пересчитываются при выполнении.';
    case 'LOW_STAMINA_AFTER_ACTION':
      return 'Low stamina: после плана останется мало выносливости.';
    case 'LOW_HP_AFTER_HP_COST':
      return 'Low HP: после плана останется мало здоровья.';
    case 'ACTION_MAY_FAIL_IF_TARGET_MOVES':
      return 'Цель может выйти из зоны удара до выполнения команды.';
    case 'ESCAPE_CAN_BE_INTERRUPTED':
      return 'Побег может быть прерван.';
    default:
      return warning;
  }
}

function formatCommandSpecificPlanError(error: string, commandType?: CombatCommand['type']): string {
  if (error === 'GUARD_ALREADY_PLANNED') {
    return 'Защитная стойка уже запланирована.';
  }
  if (commandType === 'weapon_swap') {
    if (error === 'NOT_ENOUGH_STAMINA') return 'Недостаточно stamina для смены оружия.';
    if (error === 'NOT_ENOUGH_AP') return 'Недостаточно AP для смены оружия.';
    if (error === 'WEAPON_ID_REQUIRED') return 'Не указано оружие для смены.';
    if (error === 'WEAPON_NOT_FOUND') return 'Оружие не найдено.';
    if (error === 'ITEM_IS_NOT_WEAPON') return 'Это не оружие (нельзя сменить на данный предмет).';
    if (error === 'WEAPON_ALREADY_EQUIPPED') return 'Это оружие уже экипировано.';
    if (error === 'WEAPON_NOT_OWNED') return 'У персонажа нет этого оружия.';
    if (error === 'ITEM_NOT_USABLE') return 'Нельзя сменить оружие: персонаж разоружён.';
  }
  if (commandType === 'strong_guard') {
    if (error === 'NOT_ENOUGH_STAMINA') {
      return 'Недостаточно stamina для усиленной защиты.';
    }
    if (error === 'NOT_ENOUGH_AP') {
      return 'Недостаточно AP для усиленной защиты.';
    }
    if (error === 'MAX_COMMANDS_REACHED') {
      return 'Достигнут лимит команд на раунд.';
    }
  }
  if (commandType === 'guard') {
    if (error === 'NOT_ENOUGH_STAMINA') {
      return 'Недостаточно stamina для защиты.';
    }
    if (error === 'NOT_ENOUGH_AP') {
      return 'Недостаточно AP для защиты.';
    }
    if (error === 'MAX_COMMANDS_REACHED') {
      return 'Достигнут лимит команд на раунд.';
    }
  }
  return formatPlanError(error);
}

function getCommandDisplayText(command: CombatCommand, state: ArenaBattleState): string {
  let targetText = 'себя';
  if (command.target.kind === 'entity') {
    const entityTarget = command.target as Extract<CombatCommand['target'], { kind: 'entity' }>;
    targetText = state.entities.find((entity) => entity.id === entityTarget.entityId)?.name ?? 'цель';
  } else if (command.target.kind === 'cell') {
    const cellTarget = command.target as Extract<CombatCommand['target'], { kind: 'cell' }>;
    targetText = `клетка ${cellTarget.x + 1},${cellTarget.y + 1}`;
  }

  switch (command.type) {
    case 'move':
      return `Подойти (${targetText})`;
    case 'dash':
      return `Рывок (${targetText})`;
    case 'disengage':
      return `Отход (${targetText})`;
    case 'basic_attack':
      return `Атака (${targetText})`;
    case 'heavy_attack':
      return `Сильная атака (${targetText})`;
    case 'guard':
      return 'Защита';
    case 'strong_guard':
      return 'Усиленная защита';
    case 'skill_cast':
      return `Навык (${command.payload?.skillId ?? 'unknown'}) -> ${targetText}`;
    case 'item_use':
      return `Предмет (${command.payload?.itemId ?? command.payload?.itemInstanceId ?? 'unknown'}) -> ${targetText}`;
    case 'weapon_swap':
      return 'Смена оружия';
    case 'place_trap':
      return `Ловушка (${targetText})`;
    case 'loot':
      return `Лут (${targetText})`;
    case 'start_retreat':
      return 'Начать побег';
    case 'confirm_retreat':
      return 'Подтвердить побег';
    default:
      return 'Ожидание';
  }
}

function getQueueCommandLine(command: CombatCommand, state: ArenaBattleState, resolveAdminItemById?: ((id: string) => AdminItem | null) | null): string {
  if (command.type === 'strong_guard') {
    return `🛡 Усиленная защита - ${command.apCost} AP / ${command.costs.stamina ?? 0} STA`;
  }
  if (command.type === 'guard') {
    return `🛡 Защита - ${command.apCost} AP / ${command.costs.stamina ?? 0} STA`;
  }
  if (command.type === 'weapon_swap') {
    const wid = command.payload?.weaponItemId ?? command.payload?.weaponInstanceId;
    const weaponName = wid && resolveAdminItemById ? (resolveAdminItemById(wid)?.name ?? wid) : (wid ?? '?');
    return `🔄 Сменить оружие: ${weaponName} — ${command.apCost} AP / ${command.costs.stamina ?? 0} STA`;
  }
  return `${getCommandDisplayText(command, state)} - ${command.apCost} AP / ${command.costs.stamina ?? 0} STA / ${command.costs.mp ?? 0} MP / ${command.costs.hp ?? 0} HP`;
}

function getCommandTimingWarning(command: CombatCommand, index: number): string | null {
  if (index === 0) return null;
  if (command.type === 'strong_guard') {
    return '⚠ Усиленная защита начнет действовать только после выполнения этой команды. Если враг ударит раньше, защита может не успеть сработать.';
  }
  if (command.type === 'guard') {
    return `⚠ Защита начнёт действовать только на ${index + 1}-м шаге раунда. Если враг ударит раньше, защита может не успеть.`;
  }
  return null;
}

function isCellTargetItem(item: AdminItem | null): boolean {
  if (!item) {
    return false;
  }
  const raw = toRecord(item as unknown);
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  return subtype.includes('bomb') || subtype.includes('trap') || subtype.includes('grenade');
}

function isWeaponAdminItem(item: AdminItem | null): boolean {
  if (!item) {
    return false;
  }
  const raw = toRecord(item as unknown);
  const type = String(raw?.itemType ?? '').toLowerCase();
  const subtype = String(raw?.itemSubType ?? '').toLowerCase();
  return type === 'weapon' || subtype.includes('sword') || subtype.includes('axe') || subtype.includes('bow');
}

export function BattlePanel({
  combatId,
  playerId,
  state,
  inventory,
  actionSlots,
  mapImageUrl,
  mapCalibration,
  selectedSkillId,
  availableSkills,
  onSkillChange,
  onStateChange,
  onStatus,
  onUseItem,
  onBattleFinished,
  onClose,
  playerAvatarUrl,
  resolveItemById,
  resolveAdminItemById,
  playerEquipment,
}: BattlePanelProps) {
  const player = useMemo(() => state.entities.find((item) => item.id === playerId), [state, playerId]);
  const enemies = useMemo(() => state.entities.filter((item) => item.team === TeamSide.Right && item.isAlive), [state]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!state.turnDeadlineAt) {
      return null;
    }
    const deadlineMs = Date.parse(state.turnDeadlineAt);
    if (!Number.isFinite(deadlineMs)) {
      return null;
    }
    return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
  }, [nowMs, state.turnDeadlineAt]);

  const playerEscapeState = useMemo(() => state.escapeStates?.[playerId] ?? null, [playerId, state.escapeStates]);
  const playerOnExitZone = useMemo(() => {
    const check = isActorStandingOnExitZone({ battleState: state, actorId: playerId });
    return Boolean(check.ok);
  }, [playerId, state]);

  const [selectedTargetId, setSelectedTargetId] = useState(enemies[0]?.id ?? '');
  const [actionType, setActionType] = useState<ActionType>(ActionType.Attack);
  const [guardMode, setGuardMode] = useState<'guard' | 'strong_guard'>('guard');
  const [movementType, setMovementType] = useState<MovementType | null>(null);
  const [selectedMoveTile, setSelectedMoveTile] = useState<{ x: number; y: number } | null>(null);
  const [inspectEntityId, setInspectEntityId] = useState<string | null>(null);
  const [planningMode, setPlanningMode] = useState<CombatPlanningMode>('idle');
  const [selectedSource, setSelectedSource] = useState<SelectedCombatSource>({ kind: 'none' });
  const [draftCommands, setDraftCommands] = useState<CombatCommand[]>([]);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [planWarningCodes, setPlanWarningCodes] = useState<string[]>([]);
  const [planWarningDetails, setPlanWarningDetails] = useState<Array<{ code: string; commandId?: string; message?: string }>>([]);
  const [planErrors, setPlanErrors] = useState<string[]>([]);
  const isSubmittingRef = useRef(false);
  const previousRoundRef = useRef<number>(state.roundNumber);
  const selectedSkill = useMemo(
    () => availableSkills.find((skill) => skill.skillId === selectedSkillId) ?? null,
    [availableSkills, selectedSkillId],
  );

  const battleInventoryItems = useMemo(
    () => actionSlots
      .filter((slot) => slot.kind === 'item' && Boolean(slot.refId))
      .map((slot) => {
        const itemId = slot.refId;
        if (!itemId) {
          return null;
        }
        const quantity = inventory.items.find((entry) => entry.itemId === itemId)?.quantity ?? 0;
        const item = resolveItemById ? resolveItemById(itemId) : getItemById(itemId);
        if (!item) {
          return {
            id: itemId,
            name: itemId,
            description: 'Missing item definition.',
            icon: '?',
            itemType: 'missing',
            quantity,
            disabled: true,
            disabledReason: 'Предмет не найден в контенте.',
            effectSummary: 'Definition missing',
            costSummary: null,
          };
        }
        const adminItem = resolveAdminItemById ? resolveAdminItemById(itemId) : null;
        const costs = normalizeAdminItemCosts(adminItem);
        const effects = normalizeAdminItemEffects(adminItem);
        const wantsEnemyTarget = effects.some((effect) => effect.type === 'damage_target' || String(effect.target ?? '').toLowerCase().includes('enemy'));
        const costSummary = [
          costs.mana > 0 ? `${costs.mana} mana` : null,
          costs.stamina > 0 ? `${costs.stamina} stamina` : null,
          costs.hp > 0 ? `${costs.hp} HP` : null,
        ].filter(Boolean).join(', ') || null;
        const effectSummary = effects.length > 0
          ? effects.map((effect) => `${effect.type}${effect.amount > 0 ? ` ${effect.amount}` : ''}`).join(', ')
          : (item.description || null);
        const notEnoughMana = costs.mana > (player?.currentMp ?? 0);
        const notEnoughStamina = costs.stamina > (player?.currentStamina ?? 0);
        const invalidTarget = wantsEnemyTarget && !enemies.some((enemy) => enemy.id === selectedTargetId);
        const disabledReason = quantity <= 0
          ? 'Количество закончилось.'
          : notEnoughMana
            ? 'Not enough mana'
            : notEnoughStamina
              ? 'Not enough stamina'
              : invalidTarget
                ? 'Нет цели для предмета.'
                : null;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          icon: item.icon,
          itemType: item.itemType,
          quantity,
          disabled: Boolean(disabledReason),
          disabledReason,
          effectSummary,
          costSummary,
        };
      })
      .filter(Boolean) as Array<{ id: string; name: string; description: string; icon: string; itemType: string; quantity: number; disabled?: boolean; disabledReason?: string | null; effectSummary?: string | null; costSummary?: string | null }>,
    [actionSlots, enemies, inventory.items, player?.currentMp, player?.currentStamina, resolveAdminItemById, resolveItemById, selectedTargetId],
  );

  useEffect(() => {
    console.info('[combatItems] loaded', battleInventoryItems);
  }, [battleInventoryItems]);

  useEffect(() => {
    console.info('[combatSkills] loaded', availableSkills.map((entry) => entry.skillId));
  }, [availableSkills]);

  const lastLog = state.logs.at(-1);
  const recentLogs = useMemo(() => state.logs.slice(-8), [state.logs]);
  const lastHitZone = useMemo(() => (lastLog ? parseZoneFromLogText(lastLog.text) : null), [lastLog]);
  const selectedEnemy = useMemo(
    () => enemies.find((enemy) => enemy.id === selectedTargetId) ?? enemies[0] ?? null,
    [enemies, selectedTargetId],
  );
  const selectedEnemyPlacement = useMemo(
    () => state.entities.find((item) => item.id === selectedTargetId) ?? null,
    [selectedTargetId, state.entities],
  );
  const playerPlacement = useMemo(
    () => state.entities.find((item) => item.id === playerId) ?? null,
    [playerId, state.entities],
  );
  const pendingPlayerPlacement = useMemo(() => {
    if (!playerPlacement) {
      return null;
    }
    return {
      ...playerPlacement,
      battlefieldX: selectedMoveTile?.x ?? playerPlacement.battlefieldX,
      battlefieldY: selectedMoveTile?.y ?? playerPlacement.battlefieldY,
    };
  }, [playerPlacement, selectedMoveTile]);
  const playerStyle = player ? classifyCombatStyle(player) : 'MELEE';
  const inspectedEntity = useMemo(
    () => state.entities.find((entity) => entity.id === inspectEntityId) ?? null,
    [inspectEntityId, state.entities],
  );
  const targetInRange = useMemo(() => {
    if (!pendingPlayerPlacement || !selectedEnemyPlacement) {
      return false;
    }

    const dist = getBattlefieldDistance(pendingPlayerPlacement, selectedEnemyPlacement);
    if (playerStyle === 'MELEE') {
      return dist <= 1;
    }
    if (playerStyle === 'RANGED') {
      const maxRange = typeof player?.attackRange === 'number' && player.attackRange > 1 ? Math.floor(player.attackRange) : 6;
      return dist <= Math.max(2, maxRange);
    }
    const maxRange = typeof player?.attackRange === 'number' && player.attackRange > 1 ? Math.floor(player.attackRange) : 5;
    return dist <= Math.max(2, maxRange);
  }, [pendingPlayerPlacement, player?.attackRange, playerStyle, selectedEnemyPlacement]);

  const feedback = useMemo(() => {
    if (!lastLog) {
      return { playerVisualState: 'idle' as const, enemyVisualState: 'idle' as const, floatingText: null as string | null };
    }

    const playerIsActor = lastLog.actorId === playerId;
    const playerIsTarget = lastLog.targetId === playerId;

    if (lastLog.type === 'HIT') {
      const floatingText = /critical/i.test(lastLog.text) ? `CRIT -${lastLog.amount ?? 0}` : `-${lastLog.amount ?? 0}`;
      return {
        playerVisualState: playerIsActor ? 'attack' as const : playerIsTarget ? 'hit' as const : 'idle' as const,
        enemyVisualState: playerIsActor ? 'hit' as const : playerIsTarget ? 'attack' as const : 'idle' as const,
        floatingText,
      };
    }

    if (lastLog.type === 'BLOCK') {
      return {
        playerVisualState: playerIsActor ? 'block' as const : playerIsTarget ? 'attack' as const : 'idle' as const,
        enemyVisualState: playerIsActor ? 'attack' as const : playerIsTarget ? 'block' as const : 'idle' as const,
        floatingText: 'BLOCK',
      };
    }

    if (lastLog.type === 'MISS') {
      return {
        playerVisualState: playerIsActor ? 'attack' as const : playerIsTarget ? 'dodge' as const : 'idle' as const,
        enemyVisualState: playerIsActor ? 'dodge' as const : playerIsTarget ? 'attack' as const : 'idle' as const,
        floatingText: 'DODGE',
      };
    }

    return { playerVisualState: 'idle' as const, enemyVisualState: 'idle' as const, floatingText: null as string | null };
  }, [lastLog, playerId]);

  const actionWarning = useMemo(() => {
    if (actionType === ActionType.Attack && movementType === MovementType.Dash) {
      return 'После Dash атака недоступна.';
    }
    if (actionType === ActionType.Attack && movementType === MovementType.Disengage) {
      return 'После Disengage атака недоступна.';
    }
    if (actionType === ActionType.Attack && movementType === MovementType.Extra) {
      return 'После 2 клеток движения атака по базовым правилам недоступна.';
    }
    if (getActionCost(actionType, movementType, guardMode) > (player?.currentStamina ?? 0)) {
      return 'Недостаточно stamina для выбранной комбинации действий.';
    }
    if (selectedSkill) {
      const resourceSummary = getSkillCostSummary(selectedSkill.definition, selectedSkill.level);
      const manaCost = resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('mp') ? sum + entry.amount : sum, 0);
      const staminaCost = resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('stamina') ? sum + entry.amount : sum, 0);
      const hpCost = resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('hp') ? sum + entry.amount : sum, 0);
      if (manaCost > (player?.currentMp ?? 0)) {
        return 'Not enough mana';
      }
      if (staminaCost + getActionCost(actionType, movementType, guardMode) > (player?.currentStamina ?? 0)) {
        return 'Not enough stamina';
      }
      if (hpCost >= (player?.currentHp ?? 0)) {
        return 'Not enough HP (skill cost too high)';
      }
    }
    return null;
  }, [actionType, guardMode, movementType, player?.currentMp, player?.currentStamina, player?.currentHp, selectedSkill]);

  // Soft hint — shown in UI but does NOT disable the button
  const actionHint = useMemo(() => {
    if (actionType === ActionType.Attack && selectedMoveTile && !targetInRange) {
      return 'Цель вне досягаемости даже после перемещения.';
    }
    if (actionType === ActionType.Attack && !selectedMoveTile && !targetInRange) {
      return 'Цель далеко — подойди к ней на карте или просто атакуй (сервер проверит дистанцию).';
    }
    return null;
  }, [actionType, selectedMoveTile, targetInRange]);

  const secondsLeft = useMemo(() => {
    if (!state.turnDeadlineAt || state.isFinished) {
      return null;
    }
    const diff = state.turnDeadlineAt - nowMs;
    return Math.max(0, Math.ceil(diff / 1000));
  }, [nowMs, state.isFinished, state.turnDeadlineAt]);

  const readyCount = state.readyActorIds?.length ?? 0;
  const pendingCount = state.pendingActorIds?.length ?? 0;
  const planningStatus = state.roundPhase === 'PLANNING'
    ? `Planning: ${readyCount} ready${pendingCount > 0 ? `, ${pendingCount} pending` : ''}`
    : state.roundPhase === 'RESOLVING'
      ? 'Раунд выполняется...'
      : 'Combat in Progress';

  useEffect(() => {
    if (!enemies.some((enemy) => enemy.id === selectedTargetId)) {
      setSelectedTargetId(enemies[0]?.id ?? '');
    }
  }, [enemies, selectedTargetId]);

  useEffect(() => {
    if (!movementType) {
      setSelectedMoveTile(null);
    }
  }, [movementType]);

  const playerSubmittedPlan = useMemo(
    () => state.submittedPlans?.[playerId],
    [playerId, state.submittedPlans],
  );

  const planLimits = useMemo(() => (player ? getCombatRoundLimits(player) : { maxCommands: 3, maxAP: 3 }), [player]);
  const draftTotals = useMemo(() => getCombatPlanCostTotal(draftCommands), [draftCommands]);
  const isPlanReady = Boolean(playerSubmittedPlan?.ready);
  const isResolving = state.roundPhase === 'RESOLVING' || state.isFinished;

  const guardStatusByActorId = useMemo(() => {
    const statuses = new Map<string, 'none' | 'guard' | 'strong_guard' | 'broken'>();
    for (const event of state.recentCombatEvents ?? []) {
      const actorId = event.actorId ?? event.targetId;
      if (!actorId) {
        continue;
      }
      if (event.type === 'guard_applied') {
        const guardType = String(event.data?.guardType ?? 'guard');
        statuses.set(actorId, guardType === 'strong_guard' ? 'strong_guard' : 'guard');
      }
      if (event.type === 'guard_broken') {
        statuses.set(actorId, 'broken');
      }
    }
    return statuses;
  }, [state.recentCombatEvents]);

  const playerGuardStatusLabel = useMemo(() => {
    const status = guardStatusByActorId.get(playerId);
    if (status === 'strong_guard') {
      return 'Усиленная защита';
    }
    if (status === 'guard') {
      return 'Защита';
    }
    if (status === 'broken') {
      return 'Усиленная защита пробита';
    }
    return null;
  }, [guardStatusByActorId, playerId]);

  const enemyGuardStatusLabel = useMemo(() => {
    if (!selectedEnemy?.id) {
      return null;
    }
    const status = guardStatusByActorId.get(selectedEnemy.id);
    if (status === 'strong_guard') {
      return 'Усиленная защита';
    }
    if (status === 'guard') {
      return 'Защита';
    }
    if (status === 'broken') {
      return 'Усиленная защита пробита';
    }
    return null;
  }, [guardStatusByActorId, selectedEnemy?.id]);

  useEffect(() => {
    if (previousRoundRef.current !== state.roundNumber) {
      previousRoundRef.current = state.roundNumber;
      setDraftCommands([]);
      setPlanErrors([]);
      setPlanWarnings([]);
      setPlanWarningCodes([]);
      setPlanWarningDetails([]);
    }

    if (playerSubmittedPlan && playerSubmittedPlan.roundNumber === state.roundNumber) {
      setDraftCommands(playerSubmittedPlan.commands ?? []);
      setPlanningMode(playerSubmittedPlan.ready ? 'ready' : 'idle');
    }
  }, [playerSubmittedPlan, state.roundNumber]);

  const appendCommandDirect = useCallback(async (command: CombatCommand): Promise<void> => {
    if (!player || isSubmittingRef.current || isResolving) {
      return;
    }
    if (isPlanReady) {
      onStatus('План уже подтверждён. Отмените готовность для редактирования.');
      return;
    }

    const candidateCommands = [...draftCommands, command];
    try {
      isSubmittingRef.current = true;
      const preview = await validateCombatPlan({
        battleId: combatId,
        actorId: player.id,
        roundNumber: state.roundNumber,
        commands: candidateCommands,
      });

      if (!preview.ok) {
        const attemptedType = candidateCommands[candidateCommands.length - 1]?.type;
        const errors = preview.errors.map((code) => formatCommandSpecificPlanError(code, attemptedType));
        setPlanErrors(errors);
        const warningCodes = preview.warnings ?? [];
        setPlanWarningCodes(warningCodes);
        setPlanWarningDetails((preview.warningDetails ?? []).map((item) => ({ code: item.code, commandId: item.commandId, message: item.message })));
        setPlanWarnings([]);
        onStatus(errors[0] ?? 'План отклонён сервером.');
        return;
      }

      setDraftCommands(preview.normalizedCommands ?? candidateCommands);
      setPlanErrors([]);
      const warningCodes = preview.warnings ?? [];
      setPlanWarningCodes(warningCodes);
      setPlanWarningDetails((preview.warningDetails ?? []).map((item) => ({ code: item.code, commandId: item.commandId, message: item.message })));
      const warnings = warningCodes.map((code) => formatPlanWarning(code));
      setPlanWarnings(warnings);
      setSelectedSource({ kind: 'none' });
      setPlanningMode('idle');
      const effectiveCommands = preview.normalizedCommands ?? candidateCommands;
      const lastCommand = effectiveCommands[effectiveCommands.length - 1];
      const lastIndex = effectiveCommands.length - 1;
      const guardHint = lastCommand && lastIndex > 0
        ? getCommandTimingWarning(lastCommand, lastIndex)
        : null;
      onStatus(guardHint ?? (warnings.length > 0 ? warnings[0]! : 'Команда добавлена в очередь.'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown plan error';
      onStatus(message);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [combatId, draftCommands, isPlanReady, isResolving, onStatus, player, state.roundNumber]);

  const addMoveFromTile = useCallback(async (tile: { x: number; y: number; movementType: MovementType }): Promise<void> => {
    const moveType = tile.movementType === MovementType.Dash
      ? 'dash'
      : tile.movementType === MovementType.Disengage
        ? 'disengage'
        : 'move';

    await appendCommandDirect(createCombatCommandFromType({
      type: moveType,
      target: { kind: 'cell', x: tile.x, y: tile.y },
      payload: { movementType: moveType === 'dash' ? 'dash' : moveType === 'disengage' ? 'disengage' : 'walk' },
    }));
  }, [appendCommandDirect]);

  const addEntityTargetCommand = useCallback(async (entityId: string, useQuickAttack = false): Promise<void> => {
    if (!player || isResolving) {
      return;
    }

    if (selectedSource.kind === 'skill' && selectedSource.skillId) {
      await appendCommandDirect(createCombatCommandFromType({
        type: 'skill_cast',
        target: { kind: 'entity', entityId },
        sourceSlotId: selectedSource.slotId,
        payload: { skillId: selectedSource.skillId, targetZone: TargetZone.Chest },
      }));
      return;
    }

    if (selectedSource.kind === 'item' && (selectedSource.itemId || selectedSource.itemInstanceId)) {
      const targetEntity = state.entities.find((entity) => entity.id === entityId);
      const adminItem = selectedSource.itemId && resolveAdminItemById ? resolveAdminItemById(selectedSource.itemId) : null;
      if (targetEntity && isCellTargetItem(adminItem)) {
        await appendCommandDirect(createCombatCommandFromType({
          type: 'item_use',
          target: { kind: 'cell', x: targetEntity.battlefieldX ?? 0, y: targetEntity.battlefieldY ?? 0 },
          sourceSlotId: selectedSource.slotId,
          payload: {
            itemId: selectedSource.itemId,
            itemInstanceId: selectedSource.itemInstanceId,
          },
        }));
      } else {
        await appendCommandDirect(createCombatCommandFromType({
          type: 'item_use',
          target: { kind: 'entity', entityId },
          sourceSlotId: selectedSource.slotId,
          payload: {
            itemId: selectedSource.itemId,
            itemInstanceId: selectedSource.itemInstanceId,
          },
        }));
      }
      return;
    }

    if (selectedSource.kind === 'weapon' && (selectedSource.weaponItemId || selectedSource.weaponInstanceId)) {
      const selectedWeaponId = selectedSource.weaponItemId ?? selectedSource.weaponInstanceId;
      const isAlreadyEquipped = Boolean(selectedWeaponId && player.activeWeaponItemId === selectedWeaponId);

      if (isAlreadyEquipped) {
        await appendCommandDirect(createCombatCommandFromType({
          type: 'basic_attack',
          target: { kind: 'entity', entityId },
          sourceSlotId: selectedSource.slotId,
          payload: { targetZone: TargetZone.Chest },
        }));
        return;
      }

      const swapCommand = createCombatCommandFromType({
        type: 'weapon_swap',
        target: { kind: 'self' },
        sourceSlotId: selectedSource.slotId,
        payload: {
          weaponItemId: selectedSource.weaponItemId,
          weaponInstanceId: selectedSource.weaponInstanceId,
        },
      });

      const wantsSwapAndAttack = window.confirm('Оружие не экипировано. Добавить в план "Сменить и атаковать"?\nОК = Сменить и атаковать, Отмена = только сменить.');
      if (!wantsSwapAndAttack) {
        await appendCommandDirect(swapCommand);
        return;
      }

      await appendCommandDirect(swapCommand);
      await appendCommandDirect(createCombatCommandFromType({
        type: 'basic_attack',
        target: { kind: 'entity', entityId },
        sourceSlotId: selectedSource.slotId,
        payload: { targetZone: TargetZone.Chest },
      }));
      return;
    }

    if (useQuickAttack || selectedSource.kind === 'basic_attack') {
      await appendCommandDirect(createCombatCommandFromType({
        type: 'basic_attack',
        target: { kind: 'entity', entityId },
        payload: { targetZone: TargetZone.Chest },
      }));
    }
  }, [appendCommandDirect, isResolving, player, resolveAdminItemById, selectedSource, state.entities]);

  const createSelectionCommands = useCallback((forcedType?: ActionType): CombatCommand[] => {
    if (!player) {
      return [];
    }

    const selectedType = forcedType ?? actionType;
    const targetId = selectedTargetId || enemies[0]?.id || '';
    const commands: CombatCommand[] = [];

    if (movementType && selectedMoveTile) {
      const moveType = movementType === MovementType.Dash
        ? 'dash'
        : movementType === MovementType.Disengage
          ? 'disengage'
          : 'move';

      commands.push(createCombatCommandFromType({
        type: moveType,
        target: { kind: 'cell', x: selectedMoveTile.x, y: selectedMoveTile.y },
        payload: { movementType: moveType === 'dash' ? 'dash' : moveType === 'disengage' ? 'disengage' : 'walk' },
      }));
    }

    if (selectedType === ActionType.Attack) {
      if (!targetId) {
        return commands;
      }
      commands.push(
        selectedSkill
          ? createCombatCommandFromType({
            type: 'skill_cast',
            target: { kind: 'entity', entityId: targetId },
            sourceSlotId: actionSlots.find((slot) => slot.kind === 'skill' && slot.refId === selectedSkill.skillId)?.slotId,
            payload: { skillId: selectedSkill.skillId, targetZone: TargetZone.Chest },
          })
          : createCombatCommandFromType({
            type: 'basic_attack',
            target: { kind: 'entity', entityId: targetId },
            payload: { targetZone: TargetZone.Chest },
          }),
      );
    } else if (selectedType === ActionType.Defend) {
      commands.push(createCombatCommandFromType({
        type: guardMode === 'strong_guard' ? 'strong_guard' : 'guard',
        target: { kind: 'self' },
      }));
    } else if (selectedType === ActionType.Wait) {
      commands.push(createCombatCommandFromType({ type: 'wait', target: { kind: 'self' } }));
    } else if (selectedType === ActionType.Move && movementType && selectedMoveTile) {
      // Move action already represented by movement command above.
    }

    return commands;
  }, [actionSlots, actionType, enemies, guardMode, movementType, player, selectedMoveTile, selectedSkill, selectedTargetId]);

  const appendSelectedCommands = useCallback(async (forcedType?: ActionType): Promise<void> => {
    if (!player || isResolving) {
      onStatus('Player entity not found.');
      return;
    }
    if (isSubmittingRef.current) {
      return;
    }
    if (isPlanReady) {
      onStatus('План уже подтверждён. Отмените готовность для редактирования.');
      return;
    }
    if (!forcedType && actionWarning) {
      onStatus(actionWarning);
      return;
    }

    const nextCommands = createSelectionCommands(forcedType);
    if (nextCommands.length === 0) {
      onStatus('Не удалось сформировать команду. Выберите цель/клетку.');
      return;
    }

    const candidateCommands = [...draftCommands, ...nextCommands];

    try {
      isSubmittingRef.current = true;
      const preview = await validateCombatPlan({
        battleId: combatId,
        actorId: player.id,
        roundNumber: state.roundNumber,
        commands: candidateCommands,
      });

      if (!preview.ok) {
        const attemptedType = candidateCommands[candidateCommands.length - 1]?.type;
        const errors = preview.errors.map((code) => formatCommandSpecificPlanError(code, attemptedType));
        setPlanErrors(errors);
        const warningCodes = preview.warnings ?? [];
        setPlanWarningCodes(warningCodes);
        setPlanWarningDetails((preview.warningDetails ?? []).map((item) => ({ code: item.code, commandId: item.commandId, message: item.message })));
        setPlanWarnings([]);
        onStatus(errors[0] ?? 'План отклонён сервером.');
        return;
      }

      setDraftCommands(preview.normalizedCommands ?? candidateCommands);
      setPlanErrors([]);
      const warningCodes = preview.warnings ?? [];
      setPlanWarningCodes(warningCodes);
      setPlanWarningDetails((preview.warningDetails ?? []).map((item) => ({ code: item.code, commandId: item.commandId, message: item.message })));
      const warnings = warningCodes.map((code) => formatPlanWarning(code));
      setPlanWarnings(warnings);
      const effectiveCommands = preview.normalizedCommands ?? candidateCommands;
      const lastCommand = effectiveCommands[effectiveCommands.length - 1];
      const lastIndex = effectiveCommands.length - 1;
      const guardHint = lastCommand && lastIndex > 0
        ? getCommandTimingWarning(lastCommand, lastIndex)
        : null;
      onStatus(guardHint ?? (warnings.length > 0 ? warnings[0]! : 'Команда добавлена в очередь.'));
      setSelectedMoveTile(null);
      setMovementType(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown plan error';
      onStatus(message);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [actionWarning, combatId, createSelectionCommands, draftCommands, isPlanReady, isResolving, onStatus, player, state.roundNumber]);

  const submitReady = useCallback(async (): Promise<void> => {
    if (!player || isSubmittingRef.current || isResolving) {
      return;
    }

    try {
      isSubmittingRef.current = true;

      const submitResult = await submitCombatPlan({
        battleId: combatId,
        actorId: player.id,
        roundNumber: state.roundNumber,
        commands: draftCommands,
        ready: true,
      });

      if (!submitResult.ok) {
        const formatted = [formatPlanError(submitResult.errorCode)];
        setPlanErrors(formatted);
        setPlanWarningCodes([]);
        setPlanWarningDetails([]);
        setPlanWarnings(warningCodes.map((code) => formatPlanWarning(code)));
        onStatus(formatted[0] ?? 'План не принят.');
        return;
      }

      onStateChange(submitResult.battleState);
      setPlanErrors([]);
      setPlanningMode(submitResult.battleState.roundPhase === 'RESOLVING' ? 'resolving' : 'ready');
      if (submitResult.battleState.isFinished) {
        onStatus(`Battle finished. Winner: ${submitResult.battleState.winner ?? 'none'}.`);
        await onBattleFinished?.(submitResult.battleState);
      } else {
        onStatus('План подтверждён. Ожидание противника...');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown ready error';
      onStatus(message);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [combatId, draftCommands, isResolving, onBattleFinished, onStateChange, onStatus, player, state.roundNumber]);

  const toggleReady = useCallback(async (): Promise<void> => {
    if (!player || isSubmittingRef.current || isResolving) {
      return;
    }
    if (!isPlanReady) {
      const dangerousFriendlyFire = planWarningCodes.some((code) => code === 'FRIENDLY_FIRE' || code === 'ALLY_IN_AREA' || code === 'SELF_IN_AREA' || code === 'NEUTRAL_IN_AREA');
      if (dangerousFriendlyFire) {
        const confirmed = window.confirm('В плане есть действия, которые могут задеть союзников или нейтральные цели. Продолжить?');
        if (!confirmed) {
          onStatus('Подтверждение отменено. Проверьте предупреждения в плане.');
          return;
        }
      }
      await submitReady();
      return;
    }

    try {
      isSubmittingRef.current = true;
      const result = await cancelCombatReady({ combatId, actorId: player.id, roundNumber: state.roundNumber });
      onStateChange(result.state);
      setPlanningMode('idle');
      onStatus('Готовность отменена. План можно редактировать.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cancel-ready error';
      onStatus(message);
    } finally {
      isSubmittingRef.current = false;
    }
  }, [combatId, isPlanReady, isResolving, onStateChange, onStatus, planWarningCodes, player, state.roundNumber, submitReady]);

  const undoDraftCommand = useCallback(() => {
    if (isPlanReady) {
      onStatus('Сначала отмените готовность, затем редактируйте очередь.');
      return;
    }
    setDraftCommands((prev) => prev.slice(0, -1));
    setPlanningMode('idle');
    setPlanErrors([]);
  }, [isPlanReady, onStatus]);

  const clearDraftCommands = useCallback(() => {
    if (isPlanReady) {
      onStatus('Сначала отмените готовность, затем редактируйте очередь.');
      return;
    }
    setDraftCommands([]);
    setSelectedSource({ kind: 'none' });
    setPlanningMode('idle');
    setPlanErrors([]);
    setPlanWarnings([]);
  }, [isPlanReady, onStatus]);

  const submitRound = useCallback(async (): Promise<void> => {
    await appendSelectedCommands();
  }, [appendSelectedCommands]);

  const applyMoveSelection = useCallback((tile: { x: number; y: number; movementType: MovementType; willTriggerOpportunity: boolean }) => {
    setMovementType(tile.movementType);
    setSelectedMoveTile({ x: tile.x, y: tile.y });
    setPlanningMode('selecting_cell');
    if (tile.willTriggerOpportunity) {
      onStatus('Маршрут опасен: будет удар вслед.');
    } else {
      onStatus(`Move planned to ${tile.x + 1}:${tile.y + 1}`);
    }
  }, [onStatus]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const handleHotkeys = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.shiftKey && !event.ctrlKey && !event.altKey && event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          void submitRound();
        }
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        if (event.repeat) {
          return;
        }
        event.preventDefault();
        void toggleReady();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        clearDraftCommands();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undoDraftCommand();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'e') {
        event.preventDefault();
        setActionType(ActionType.Defend);
        setGuardMode(event.shiftKey ? 'strong_guard' : 'guard');
        setSelectedSource({ kind: event.shiftKey ? 'strong_guard' : 'guard' });
        void appendCommandDirect(createCombatCommandFromType({
          type: event.shiftKey ? 'strong_guard' : 'guard',
          target: { kind: 'self' },
        }));
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'Escape') {
        event.preventDefault();
        setSelectedMoveTile(null);
        setMovementType(null);
        onSkillChange(null);
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[0-9]$/.test(event.key)) {
        const slotId = event.key === '0' ? 'quick10' : (`quick${event.key}` as CharacterActionSlot['slotId']);
        const slot = actionSlots.find((item) => item.slotId === slotId);
        if (slot?.kind === 'skill' && slot.refId) {
          setSelectedSource({ kind: 'skill', slotId, skillId: slot.refId });
          onSkillChange(slot.refId);
          setActionType(ActionType.Attack);
          setPlanningMode('selecting_target');
          onStatus(`Выбран слот ${slotId}. Выберите цель.`);
          event.preventDefault();
        }
        if ((slot?.kind === 'item' || slot?.kind === 'weapon') && slot.refId) {
          if (slot.kind === 'weapon') {
            setSelectedSource({ kind: 'weapon', slotId, weaponItemId: slot.refId, weaponInstanceId: slot.weaponInstanceId ?? slot.itemInstanceId ?? undefined });
            setPlanningMode('selecting_target');
            onStatus(`Выбран слот ${slotId}. Выберите цель или себя.`);
          } else {
            setSelectedSource({ kind: 'item', slotId, itemId: slot.refId, itemInstanceId: slot.itemInstanceId ?? undefined });
            setPlanningMode('selecting_target');
            onStatus(`Выбран слот ${slotId}. Выберите цель или клетку.`);
          }
          event.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleHotkeys);
    return () => window.removeEventListener('keydown', handleHotkeys);
  }, [actionSlots, appendCommandDirect, clearDraftCommands, onSkillChange, onStatus, resolveAdminItemById, submitRound, toggleReady, undoDraftCommand]);

  if (!player) {
    return <p>Player entity not found.</p>;
  }

  return (
    <div className="battle-fullscreen-root" role="dialog" aria-modal="true">
      <div className="battle-fullscreen">
        <div className="battle-header">
          <div className="battle-header-left">
            <h2>Arena Combat</h2>
            <span>Round {state.roundNumber}</span>
          </div>
          <div className="battle-header-center">
            <span>{state.isFinished ? `Battle Over: ${state.winner ?? 'none'} wins` : planningStatus}</span>
            {secondsLeft !== null ? (
              <span className="battle-turn-timer" title={`Turn deadline: ${new Date(state.turnDeadlineAt ?? 0).toLocaleTimeString()}`}>
                Turn: {formatCountdown(secondsLeft)}
              </span>
            ) : null}
          </div>
          <div className="battle-header-right">
            <button type="button" onClick={() => onClose?.()} aria-label="Close battle">✕</button>
          </div>
        </div>

        <div className="battle-main-grid">
          <div className="battle-left-column battle-column">
            <div className="column-player-section">
              <FighterCard
                key={`player-${state.logs.length}`}
                fighter={player}
                highlighted
                side="player"
                avatarUrl={player.avatarUrl ?? playerAvatarUrl}
                visualState={feedback.playerVisualState}
                floatingText={feedback.floatingText}
                subtitle={playerGuardStatusLabel ? `You - ${playerGuardStatusLabel}` : 'You'}
              />
            </div>

            <div className="column-command-section">
              <div className="battle-detail-popover" style={{ marginBottom: 12 }}>
                <strong>Hotbar quick1-quick10</strong>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginTop: 8 }}>
                  {actionSlots.map((slot) => {
                    const isSelected = selectedSource.slotId === slot.slotId;
                    const adminItem = (slot.kind === 'item' || slot.kind === 'weapon') && slot.refId && resolveAdminItemById ? resolveAdminItemById(slot.refId) : null;
                    const slotIsWeapon = slot.kind === 'weapon' || (slot.kind === 'item' && isWeaponAdminItem(adminItem));
                    const isEquippedWeapon = slotIsWeapon && slot.refId && player.activeWeaponItemId === slot.refId;
                    return (
                      <button
                        key={slot.slotId}
                        type="button"
                        className={isSelected ? 'is-active' : ''}
                        onClick={() => {
                          if (!slot.kind || !slot.refId) {
                            onStatus('Слот пуст.');
                            return;
                          }
                          if (slot.kind === 'skill') {
                            setSelectedSource({ kind: 'skill', slotId: slot.slotId, skillId: slot.refId });
                            onSkillChange(slot.refId);
                            setPlanningMode('selecting_target');
                            onStatus(`Выбран слот ${slot.slotId}: ${slot.refId}. Выберите цель.`);
                            return;
                          }
                          if (slot.kind === 'item' || slot.kind === 'weapon') {
                            if (slotIsWeapon) {
                              if (isEquippedWeapon) {
                                onStatus('Оружие уже экипировано. Клик по врагу добавит атаку этим оружием.');
                              }
                              setSelectedSource({ kind: 'weapon', slotId: slot.slotId, weaponItemId: slot.refId, weaponInstanceId: slot.weaponInstanceId ?? slot.itemInstanceId ?? undefined });
                              setPlanningMode('selecting_target');
                              if (!isEquippedWeapon) {
                                onStatus('Кликните цель или себя для смены оружия.');
                              }
                            } else {
                              setSelectedSource({ kind: 'item', slotId: slot.slotId, itemId: slot.refId, itemInstanceId: slot.itemInstanceId ?? undefined });
                              setPlanningMode('selecting_target');
                              onStatus(`Выбран предмет ${slot.refId}. Выберите цель или клетку.`);
                            }
                          }
                        }}
                      >
                        {slot.slotId}
                        <br />
                        {slot.refId ?? 'empty'}
                        {isEquippedWeapon ? <><br />[active]</> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <ActionPlanner
                enemies={enemies}
                selectedTargetId={selectedTargetId}
                actionType={actionType}
                guardMode={guardMode}
                currentDistance={state.distance}
                movementType={movementType}
                selectedMoveTile={selectedMoveTile}
                currentStamina={player.currentStamina}
                maxStamina={player.maxStamina}
                currentMp={player.currentMp}
                maxMp={player.maxMp}
                availableSkills={availableSkills}
                inventoryItems={battleInventoryItems}
                selectedSkillId={selectedSkillId}
                actionWarning={actionWarning ?? actionHint}
                onActionTypeChange={setActionType}
                onGuardModeChange={setGuardMode}
                onSkillChange={onSkillChange}
                onTargetChange={setSelectedTargetId}
                onUseInventoryItem={(itemId) => {
                  console.info('[combatItems] use', { itemId, targetId: selectedTargetId });
                  if (onUseItem) {
                    void onUseItem(itemId, selectedTargetId);
                  }
                }}
                onSubmit={submitRound}
                showSubmitButton={false}
                disabled={state.isFinished || enemies.length === 0 || Boolean(actionWarning)}
              />

              <div className="battle-detail-popover" style={{ marginTop: 12 }}>
                <strong>План раунда</strong>
                {draftCommands.length === 0 ? <p>План раунда пуст. Выберите действие или нажмите "Готово", чтобы занять защитную стойку.</p> : null}
                {draftCommands.map((command, index) => (
                  <p key={command.id}>
                    {index + 1}. {getQueueCommandLine(command, state, resolveAdminItemById)}
                    {(command.type === 'basic_attack' || command.type === 'heavy_attack') ? ' | ⚠ Если цель уйдёт из range до удара, атака сорвётся.' : ''}
                    {command.type === 'weapon_swap' && player.offHandItemId && (() => {
                      const wid = command.payload?.weaponItemId ?? command.payload?.weaponInstanceId;
                      const wi = wid && resolveAdminItemById ? resolveAdminItemById(wid) : null;
                      return wi?.handsRequired === 2 ? ' | ⚠ Щит будет убран из активной руки.' : null;
                    })()}
                    {planWarningDetails.some((item) => item.commandId === command.id && (item.code === 'FRIENDLY_FIRE' || item.code === 'ALLY_IN_AREA' || item.code === 'SELF_IN_AREA' || item.code === 'NEUTRAL_IN_AREA')) ? ' | ⚠ Friendly fire' : ''}
                    {getCommandTimingWarning(command, index) ? ` | ${getCommandTimingWarning(command, index)}` : ''}
                  </p>
                ))}
                <p>Команды: {draftTotals.commands} / {planLimits.maxCommands}</p>
                <p>AP: {draftTotals.ap} / {planLimits.maxAP}</p>
                <p>STA: {draftTotals.stamina} / {player.currentStamina} | MP: {draftTotals.mp} / {player.currentMp} | HP: {draftTotals.hp} / {player.currentHp}</p>
                {planErrors.length > 0 ? <p style={{ color: '#d64545' }}>{planErrors[0]}</p> : null}
                {planWarnings.length > 0 ? <p style={{ color: '#d58f2a' }}>{planWarnings[0]}</p> : null}
                {planWarningCodes.some((code) => code === 'FRIENDLY_FIRE' || code === 'ALLY_IN_AREA' || code === 'SELF_IN_AREA' || code === 'NEUTRAL_IN_AREA')
                  ? <p style={{ color: '#d58f2a' }}>⚠ В плане есть действия, которые заденут союзников/нейтралов/вас.</p>
                  : null}
              </div>
            </div>
          </div>

          <div className="battle-center-column battle-column">
            <div className="battle-center-log card">
              <CombatLogPanel logs={state.logs} />
            </div>

              <BattleField
                entities={state.entities}
                battlefieldTiles={state.battlefieldTiles}
                battleMapWidth={state.battleMapWidth}
                battleMapHeight={state.battleMapHeight}
                viewportWidth={state.viewportWidth}
                viewportHeight={state.viewportHeight}
                mapImageUrl={mapImageUrl}
                mapCalibration={mapCalibration}
                distance={state.distance}
                selectedTargetId={selectedTargetId}
                playerId={playerId}
                playerAvatarUrl={playerAvatarUrl}
                movementType={movementType}
                selectedMoveTile={selectedMoveTile}
                lastLog={lastLog}
                recentLogs={recentLogs}
                onTargetSelect={(targetId) => {
                  setSelectedTargetId(targetId);
                  setPlanningMode('selecting_target');
                  if (selectedSource.kind !== 'none') {
                    void addEntityTargetCommand(targetId, false);
                  }
                }}
                onStatusMessage={onStatus}
                onQuickAttack={(targetId) => {
                  setSelectedTargetId(targetId);
                  setPlanningMode('selecting_target');
                  void addEntityTargetCommand(targetId, true);
                }}
              onQuickMove={(tile) => {
                applyMoveSelection(tile);
                if (selectedSource.kind === 'none') {
                  void addMoveFromTile(tile);
                }
              }}
              onMoveTileSelect={(tile) => {
                applyMoveSelection(tile);
                if (selectedSource.kind === 'none') {
                  void addMoveFromTile(tile);
                }
              }}
              onCancelSelection={() => setSelectedMoveTile(null)}
              onInspectEntity={(entityId) => setInspectEntityId(entityId)}
              playerVisualState={feedback.playerVisualState}
              enemyVisualState={feedback.enemyVisualState}
              floatingText={feedback.floatingText}
              animationTick={state.logs.length}
            />

            <div className="battle-center-controls card">
              {remainingSeconds != null ? (
                <div style={{ marginBottom: 10 }} title="Если время истечёт, будет отправлен текущий план. Если план пустой, персонаж встанет в защиту.">
                  Осталось: {remainingSeconds} сек{remainingSeconds <= 10 ? ' (Раунд скоро завершится)' : ''}
                </div>
              ) : null}
              {playerEscapeState?.active ? (
                <div style={{ marginBottom: 10 }}>
                  Побег: осталось {playerEscapeState.remainingRounds} раунда(ов)
                </div>
              ) : null}
              <button
                type="button"
                className="secondary-button"
                disabled={state.isFinished || enemies.length === 0 || Boolean(actionWarning) || isPlanReady}
                onClick={submitRound}
              >
                ДОБАВИТЬ КОМАНДУ
              </button>
              <button type="button" className="secondary-button" disabled={isPlanReady || draftCommands.length === 0} onClick={undoDraftCommand}>
                ОТМЕНИТЬ ПОСЛЕДНЮЮ
              </button>
              <button type="button" className="secondary-button" disabled={isPlanReady || draftCommands.length === 0} onClick={clearDraftCommands}>
                ОЧИСТИТЬ
              </button>
              {state.phase === 'planning' && state.battleType !== 'arena' && playerOnExitZone && !playerEscapeState?.active ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={state.isFinished || enemies.length === 0 || isPlanReady}
                  title="Сбежать из боя можно только из зоны выхода. Побег займёт 3 раунда."
                  onClick={() => {
                    const confirmed = window.confirm('Вы уверены? Нужно продержаться 3 раунда в зоне выхода.');
                    if (!confirmed) {
                      return;
                    }
                    void appendCommandDirect(createCombatCommandFromType({
                      type: 'start_retreat',
                      target: { kind: 'self' },
                    }));
                  }}
                >
                  СБЕЖАТЬ ИЗ БОЯ
                </button>
              ) : null}
              <button
                type="button"
                className="confirm-turn-button battle-confirm-large"
                disabled={state.isFinished || enemies.length === 0}
                title={isPlanReady ? 'Отменить готовность' : 'Подтвердить план раунда'}
                onClick={toggleReady}
              >
                {isPlanReady ? 'ОТМЕНИТЬ ГОТОВНОСТЬ' : 'ГОТОВО'}
              </button>
            </div>
          </div>

          <div className="battle-right-column battle-column">
            <div className="column-enemy-section">
              {selectedEnemy ? (
                <FighterCard
                  key={`enemy-${state.logs.length}`}
                  fighter={selectedEnemy}
                  side="enemy"
                  avatarUrl={selectedEnemy.avatarUrl}
                  visualState={feedback.enemyVisualState}
                  floatingText={feedback.floatingText}
                  subtitle={enemyGuardStatusLabel ? `Target - ${enemyGuardStatusLabel}` : 'Target'}
                />
              ) : (
                <div className="no-enemy-placeholder">No target</div>
              )}
            </div>
          </div>
        </div>

        {inspectedEntity ? (
          <div className="battle-inspect-backdrop" onClick={() => setInspectEntityId(null)} role="presentation">
            <div className="battle-inspect-dialog" onClick={(event) => event.stopPropagation()} role="presentation">
              <InspectPanel
                entity={inspectedEntity}
                playerId={playerId}
                onClose={() => setInspectEntityId(null)}
                resolveItemById={resolveItemById}
                playerEquipment={playerEquipment}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

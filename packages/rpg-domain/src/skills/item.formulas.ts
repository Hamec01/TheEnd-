import type { CombatCommand, CombatPlanErrorCode, CombatPlanWarningCode } from '../combat-plan';
import type { ArenaBattleState, ArenaCombatEntity } from '../arena-battle';
import type { ItemDefinition } from '../items';
import { getItemById } from '../items';

export interface NormalizedItemUseCommandResult {
  ok: boolean;
  command?: CombatCommand;
  errors?: CombatPlanErrorCode[];
  warnings?: CombatPlanWarningCode[];
  message?: string;
}

export interface ResolveItemUseResult {
  ok: boolean;
  events: any[];
  errors?: CombatPlanErrorCode[];
  warnings?: CombatPlanWarningCode[];
  message?: string;
}

/**
 * Normalize item_use command: checks ownership, quantity, usability, and prepares command for execution.
 */
export function normalizeItemUseCommand(params: {
  actor: ArenaCombatEntity;
  battleState: ArenaBattleState;
  itemId: string;
  itemInstanceId?: string;
  target: CombatCommand['target'];
  quantity?: number;
}): NormalizedItemUseCommandResult {
  const { actor, battleState, itemId, itemInstanceId, target, quantity = 1 } = params;
  const item: ItemDefinition = getItemById(itemId);
  const errors: CombatPlanErrorCode[] = [];
  const warnings: CombatPlanWarningCode[] = [];

  // Ownership/quantity check (pseudo, real logic may differ)
  const inv = (actor as { inventory?: { items?: Array<{ itemId: string; quantity: number; id?: string }> } }).inventory;
  const invItem = inv?.items?.find(
    (it) => it.itemId === itemId && (!itemInstanceId || it.id === itemInstanceId)
  );
  if (!invItem) {
    errors.push('ITEM_NOT_OWNED');
    return { ok: false, errors, message: 'Item not owned by actor.' };
  }
  if (invItem.quantity < quantity) {
    errors.push('ITEM_NOT_ENOUGH_QUANTITY');
    return { ok: false, errors, message: 'Not enough item quantity.' };
  }
  if (item.itemType !== 'consumable') {
    errors.push('ITEM_NOT_USABLE');
    return { ok: false, errors, message: 'Item is not usable in combat.' };
  }

  // TODO: Add more checks (cooldown, usability, etc.)

  // Build command
  const command: CombatCommand = {
    id: `cmd_${Math.random().toString(36).slice(2, 10)}`,
    type: 'item_use',
    sourceSlotId: undefined,
    target,
    apCost: 1, // TODO: calculate real AP cost
    costs: {}, // TODO: calculate real resource costs if any
    payload: { itemId, itemInstanceId },
    createdAt: new Date().toISOString(),
  };

  return { ok: true, command, warnings };
}

/**
 * Resolve item_use: applies effects, reduces quantity, generates events.
 */
export function resolveItemUse(params: {
  actor: ArenaCombatEntity;
  battleState: ArenaBattleState;
  command: CombatCommand;
}): ResolveItemUseResult {
  const { actor, battleState, command } = params;
  const events: any[] = [];
  const errors: CombatPlanErrorCode[] = [];
  const warnings: CombatPlanWarningCode[] = [];

  // TODO: Implement effect pipeline, quantity/charges reduction, event generation
  // For now, just a stub event
  events.push({
    type: 'item_used',
    actorId: actor.id,
    itemId: command.payload?.itemId,
    target: command.target,
    message: 'Item used (stub event)',
  });

  return { ok: true, events, warnings };
}

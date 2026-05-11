import {
  ActionType,
  COMBAT_ACTION_COSTS,
  DistanceBand,
  MovementType,
  getSkillCostSummary,
  type AdminSkillDefinition,
  type ArenaCombatEntity,
} from '@theend/rpg-domain';
import { useMemo, useState } from 'react';

type GuardMode = 'guard' | 'strong_guard';

interface ActionPlannerProps {
  enemies: ArenaCombatEntity[];
  selectedTargetId: string;
  actionType: ActionType;
  guardMode: GuardMode;
  currentDistance: DistanceBand;
  movementType: MovementType | null;
  selectedMoveTile?: { x: number; y: number } | null;
  currentStamina: number;
  maxStamina: number;
  currentMp: number;
  maxMp: number;
  availableSkills: Array<{ skillId: string; label: string; level: number; definition: AdminSkillDefinition }>;
  inventoryItems: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    itemType: string;
    quantity: number;
    disabled?: boolean;
    disabledReason?: string | null;
    effectSummary?: string | null;
    costSummary?: string | null;
  }>;
  selectedSkillId: string | null;
  actionWarning?: string | null;
  onActionTypeChange: (actionType: ActionType) => void;
  onGuardModeChange: (guardMode: GuardMode) => void;
  onSkillChange: (skillId: string | null) => void;
  onTargetChange: (id: string) => void;
  onUseInventoryItem?: (itemId: string) => void | Promise<void>;
  onSubmit: () => void;
  disabled: boolean;
  showSubmitButton?: boolean;
}

const DISTANCE_LABELS: Record<DistanceBand, string> = {
  [DistanceBand.Far]: 'ДАЛЕКО',
  [DistanceBand.Near]: 'СРЕДНЯЯ',
  [DistanceBand.Melee]: 'БЛИЖНЯЯ',
};

const MOVEMENT_LABELS: Record<MovementType, string> = {
  [MovementType.Step]: 'Move 1 cell',
  [MovementType.Extra]: 'Extra move 2 cells',
  [MovementType.Dash]: 'Dash up to 3 cells',
  [MovementType.Disengage]: 'Disengage 1 cell',
};

const MOVEMENT_COSTS: Record<MovementType, number> = {
  [MovementType.Step]: COMBAT_ACTION_COSTS.move_1_cell.stamina ?? 0,
  [MovementType.Extra]: COMBAT_ACTION_COSTS.move_2_cells.stamina ?? 0,
  [MovementType.Dash]: COMBAT_ACTION_COSTS.dash_3_cells.stamina ?? 0,
  [MovementType.Disengage]: COMBAT_ACTION_COSTS.disengage.stamina ?? 0,
};

const ACTION_COSTS: Record<Exclude<ActionType, ActionType.Defend>, number> = {
  [ActionType.Attack]: COMBAT_ACTION_COSTS.basic_attack.stamina ?? 0,
  [ActionType.Move]: 0,
  [ActionType.Wait]: COMBAT_ACTION_COSTS.wait.stamina ?? 0,
};

function getEstimatedTotalCost(actionType: ActionType, movementType: MovementType | null, guardMode: GuardMode): number {
  const defendCost = guardMode === 'strong_guard'
    ? (COMBAT_ACTION_COSTS.strong_guard.stamina ?? 0)
    : (COMBAT_ACTION_COSTS.guard.stamina ?? 0);
  const actionCost = actionType === ActionType.Defend ? defendCost : ACTION_COSTS[actionType as Exclude<ActionType, ActionType.Defend>];
  return actionCost + (movementType ? MOVEMENT_COSTS[movementType] : 0);
}

export function ActionPlanner(props: ActionPlannerProps) {
  const [activePanelTab, setActivePanelTab] = useState<'skills' | 'inventory'>('skills');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const skillOptions = props.availableSkills;
  const selectedInventoryEntry = useMemo(
    () => props.inventoryItems.find((item) => item.id === selectedInventoryItem) ?? null,
    [props.inventoryItems, selectedInventoryItem],
  );

  const estimatedCost = getEstimatedTotalCost(props.actionType, props.movementType, props.guardMode);
  const selectedSkill = useMemo(
    () => props.availableSkills.find((skill) => skill.skillId === props.selectedSkillId) ?? null,
    [props.availableSkills, props.selectedSkillId],
  );
  const resourceSummary = useMemo(
    () => selectedSkill ? getSkillCostSummary(selectedSkill.definition, selectedSkill.level) : [],
    [selectedSkill],
  );
  const manaCost = useMemo(
    () => resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('mp') ? sum + entry.amount : sum, 0),
    [resourceSummary],
  );
  const skillStaminaCost = useMemo(
    () => resourceSummary.reduce((sum, entry) => String(entry.type).toLowerCase().includes('stamina') ? sum + entry.amount : sum, 0),
    [resourceSummary],
  );
  const totalStaminaLoad = estimatedCost + skillStaminaCost;
  const selectedEnemy = props.enemies.find((enemy) => enemy.id === props.selectedTargetId) ?? null;

  return (
    <div className="action-planner compact-planner inner-card">
      <h3>Actions</h3>

      <div className="planner-main-actions" role="group" aria-label="Main actions">
        <button
          type="button"
          className={props.actionType === ActionType.Attack && !props.selectedSkillId ? 'is-active' : ''}
          onClick={() => {
            props.onActionTypeChange(ActionType.Attack);
            if (props.selectedSkillId) {
              props.onSkillChange(null);
            }
          }}
        >
          Атаковать
        </button>
        <button
          type="button"
          className={props.actionType === ActionType.Attack && Boolean(props.selectedSkillId) ? 'is-active' : ''}
          onClick={() => {
            props.onActionTypeChange(ActionType.Attack);
            if (!props.selectedSkillId && skillOptions.length > 0) {
              props.onSkillChange(skillOptions[0]!.skillId);
            }
          }}
        >
          Навык
        </button>
        <button
          type="button"
          className={props.actionType === ActionType.Defend && props.guardMode === 'guard' ? 'is-active' : ''}
          onClick={() => {
            props.onGuardModeChange('guard');
            props.onActionTypeChange(ActionType.Defend);
          }}
          title="Обычная защитная стойка. 1 AP / 15 STA"
        >
          Защита
        </button>
        <button
          type="button"
          className={props.actionType === ActionType.Defend && props.guardMode === 'strong_guard' ? 'is-active' : ''}
          onClick={() => {
            props.onGuardModeChange('strong_guard');
            props.onActionTypeChange(ActionType.Defend);
          }}
          title="Встать в усиленную защитную стойку до конца раунда. Повышает шанс блока, снижает физический урон, немного защищает от магии и даёт end-round regen, если стойка не сбита. 1 AP / 20 STA"
        >
          Усиленная защита
        </button>
        <button type="button" className={props.actionType === ActionType.Move ? 'is-active' : ''} onClick={() => props.onActionTypeChange(ActionType.Move)}>
          Движение
        </button>
        <button type="button" className={props.actionType === ActionType.Wait ? 'is-active' : ''} onClick={() => props.onActionTypeChange(ActionType.Wait)}>
          Ожидание
        </button>
      </div>

      <div className="planner-selects-row">
        <div className="planner-select-item">
          <label htmlFor="target-select">Враг</label>
          <select id="target-select" value={props.selectedTargetId} onChange={(event) => props.onTargetChange(event.target.value)} className="compact-select">
            {props.enemies.map((enemy) => (
              <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
            ))}
          </select>
        </div>

        <div className="planner-select-item">
          <label htmlFor="skill-select">Навык</label>
          <select
            id="skill-select"
            value={props.selectedSkillId ?? ''}
            onChange={(event) => {
              props.onSkillChange(event.target.value || null);
              props.onActionTypeChange(ActionType.Attack);
            }}
            disabled={skillOptions.length === 0}
            className="compact-select"
          >
            <option value="">Basic attack</option>
            {skillOptions.map((skill) => (
              <option key={skill.skillId} value={skill.skillId}>{skill.label} (lvl {skill.level})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="planner-status-rows">
        <div className="planner-status-row"><span>Дистанция:</span><strong>{DISTANCE_LABELS[props.currentDistance]}</strong></div>
        <div className="planner-status-row"><span>Стойка:</span><strong>{props.actionType === ActionType.Defend ? (props.guardMode === 'strong_guard' ? 'Усиленная защита (1 AP / 20 STA)' : 'Защита (1 AP / 15 STA)') : 'Нет'}</strong></div>
        <div className="planner-status-row"><span>STA Load:</span><strong>{totalStaminaLoad}</strong></div>
        <div className="planner-status-row"><span>STA:</span><strong>{props.currentStamina} / {props.maxStamina}</strong></div>
        <div className="planner-status-row"><span>MP:</span><strong>{props.currentMp} / {props.maxMp}</strong></div>
        {props.movementType ? <div className="planner-status-row"><span>Движение:</span><strong>{MOVEMENT_LABELS[props.movementType]}{props.selectedMoveTile ? ` → ${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : ''}</strong></div> : null}
      </div>

      <div className="battle-detail-popover">
        <strong>{selectedSkill?.label ?? 'Basic Attack'}</strong>
        <p>Target: {selectedEnemy?.name ?? 'None'}</p>
        <p>Mana cost: {manaCost}</p>
        <p>Stamina cost: {skillStaminaCost + (props.actionType === ActionType.Defend
          ? (props.guardMode === 'strong_guard' ? (COMBAT_ACTION_COSTS.strong_guard.stamina ?? 0) : (COMBAT_ACTION_COSTS.guard.stamina ?? 0))
          : ACTION_COSTS[props.actionType as Exclude<ActionType, ActionType.Defend>])}</p>
        <p>Move cost: {props.movementType ? MOVEMENT_COSTS[props.movementType] : 0}</p>
        {selectedSkill ? <p>Skill level: {selectedSkill.level}</p> : null}
      </div>

      {props.actionWarning ? <div className="battle-detail-popover"><p>{props.actionWarning}</p></div> : null}

      <div className="battle-side-panel-tabs">
        <button type="button" className={activePanelTab === 'skills' ? 'is-active' : ''} onClick={() => setActivePanelTab('skills')}>
          Skills
        </button>
        <button type="button" className={activePanelTab === 'inventory' ? 'is-active' : ''} onClick={() => setActivePanelTab('inventory')}>
          Inventory
        </button>
      </div>

      {activePanelTab === 'skills' && (
        <div className="battle-side-panel-content">
          <div className="skill-icon-grid">
            {props.availableSkills.map((skill) => (
              <button
                key={skill.skillId}
                type="button"
                className={`skill-icon-item ${props.selectedSkillId === skill.skillId ? 'is-active' : ''}`}
                onClick={() => {
                  props.onSkillChange(skill.skillId);
                  props.onActionTypeChange(ActionType.Attack);
                }}
                title={skill.label}
              >
                <span className="skill-icon-glyph">{skill.label.slice(0, 2).toUpperCase()}</span>
                <span className="skill-icon-label">{skill.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanelTab === 'inventory' && (
        <div className="battle-side-panel-content">
          {props.inventoryItems.length > 0 ? (
            <div className="item-icon-grid">
              {props.inventoryItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`item-icon-item ${selectedInventoryItem === item.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedInventoryItem(item.id)}
                  title={`${item.name} x${item.quantity}${item.disabledReason ? ` — ${item.disabledReason}` : ''}`}
                >
                  <span className="item-icon-glyph">{item.name.slice(0, 1)}</span>
                  <span className="item-icon-label">{item.name} x{item.quantity}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="battle-detail-popover">
              <p>Inventory is empty.</p>
            </div>
          )}

          <div className="battle-detail-popover">
            {selectedInventoryEntry ? (
              <>
                <strong>{selectedInventoryEntry.name}</strong>
                <p>{selectedInventoryEntry.description}</p>
                <p>Type: {selectedInventoryEntry.itemType}</p>
                <p>Quantity: {selectedInventoryEntry.quantity}</p>
                {selectedInventoryEntry.effectSummary ? <p>Effect: {selectedInventoryEntry.effectSummary}</p> : null}
                {selectedInventoryEntry.costSummary ? <p>Cost: {selectedInventoryEntry.costSummary}</p> : null}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!props.onUseInventoryItem || selectedInventoryEntry.disabled}
                  onClick={() => {
                    if (props.onUseInventoryItem && !selectedInventoryEntry.disabled) {
                      void props.onUseInventoryItem(selectedInventoryEntry.id);
                    }
                  }}
                >
                  {selectedInventoryEntry.disabled ? (selectedInventoryEntry.disabledReason ?? 'Недоступно') : 'Использовать'}
                </button>
              </>
            ) : (
              <p>Select an item to inspect.</p>
            )}
          </div>
        </div>
      )}

      {props.showSubmitButton !== false && (
        <button className="confirm-turn-button" disabled={props.disabled} onClick={props.onSubmit}>
          ГОТОВО
        </button>
      )}
    </div>
  );
}

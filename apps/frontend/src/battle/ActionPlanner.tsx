import {
  ActionType,
  DistanceBand,
  MovementType,
  TargetZone,
  getSkillCostSummary,
  type AdminSkillDefinition,
  type ArenaCombatEntity,
} from '@theend/rpg-domain';
import { useMemo, useState } from 'react';

interface ActionPlannerProps {
  enemies: ArenaCombatEntity[];
  selectedTargetId: string;
  actionType: ActionType;
  attackZone: TargetZone;
  defenseZones: TargetZone[];
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
  }>;
  selectedSkillId: string | null;
  actionWarning?: string | null;
  onActionTypeChange: (actionType: ActionType) => void;
  onSkillChange: (skillId: string | null) => void;
  onTargetChange: (id: string) => void;
  onAttackZoneChange: (zone: TargetZone) => void;
  onDefenseZonesChange: (zones: TargetZone[]) => void;
  onSubmit: () => void;
  disabled: boolean;
  showSubmitButton?: boolean;
  recentHitZone?: TargetZone | null;
  recentBlockedZone?: TargetZone | null;
}

type BodyZoneId = 'head' | 'chest' | 'stomach' | 'left_arm' | 'right_arm' | 'legs';

interface BodyZoneConfig {
  id: BodyZoneId;
  zone: TargetZone;
  title: string;
  label: string;
  hint: string;
}

const BODY_ZONES: BodyZoneConfig[] = [
  { id: 'head', zone: TargetZone.Head, title: 'Head / Голова', label: 'Голова', hint: 'Криты и давление.' },
  { id: 'left_arm', zone: TargetZone.LeftArm, title: 'Left Arm / Левая рука', label: 'Левая рука', hint: 'Сбивает темп и контроль.' },
  { id: 'right_arm', zone: TargetZone.RightArm, title: 'Right Arm / Правая рука', label: 'Правая рука', hint: 'Давление на оружейную руку.' },
  { id: 'chest', zone: TargetZone.Chest, title: 'Chest / Грудь', label: 'Грудь', hint: 'Надежная атакующая зона.' },
  { id: 'stomach', zone: TargetZone.Abdomen, title: 'Abdomen / Живот', label: 'Живот', hint: 'Рискованная центральная зона.' },
  { id: 'legs', zone: TargetZone.Legs, title: 'Legs / Ноги', label: 'Ноги', hint: 'Замедляет и срывает отход.' },
];

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
  [MovementType.Step]: 6,
  [MovementType.Extra]: 16,
  [MovementType.Dash]: 14,
  [MovementType.Disengage]: 10,
};

const ACTION_COSTS: Record<ActionType, number> = {
  [ActionType.Attack]: 10,
  [ActionType.Defend]: 8,
  [ActionType.Move]: 0,
  [ActionType.Wait]: 0,
};

function getGuardLabel(defenseZones: TargetZone[]): string {
  if (defenseZones.length === 0) {
    return 'Без защиты';
  }
  if (defenseZones.length === 1) {
    return 'Агрессивная';
  }
  return 'Нормальная';
}

function getEstimatedTotalCost(actionType: ActionType, movementType: MovementType | null): number {
  return ACTION_COSTS[actionType] + (movementType ? MOVEMENT_COSTS[movementType] : 0);
}

interface BodyTargetSelectorProps {
  mode: 'attack' | 'defense';
  selectedZones: TargetZone[];
  maxSelections: number;
  onChange: (zones: TargetZone[]) => void;
  disabled?: boolean;
  title?: string;
  recentHitZone?: TargetZone | null;
  recentBlockedZone?: TargetZone | null;
}

function BodyTargetSelector({
  mode,
  selectedZones,
  maxSelections,
  onChange,
  disabled = false,
  title,
  recentHitZone,
  recentBlockedZone,
}: BodyTargetSelectorProps) {
  function toggleZone(zone: TargetZone): void {
    if (disabled) {
      return;
    }

    if (mode === 'attack') {
      onChange([zone]);
      return;
    }

    const alreadySelected = selectedZones.includes(zone);
    if (alreadySelected) {
      onChange(selectedZones.filter((item) => item !== zone));
      return;
    }

    const next = [...selectedZones, zone];
    if (next.length > maxSelections) {
      next.shift();
    }
    onChange(next);
  }

  return (
    <div className={`body-target-selector mode-${mode} ${disabled ? 'is-disabled' : ''}`}>
      {title ? <h4>{title}</h4> : null}
      <div className="body-silhouette" role="group" aria-label={title ?? mode}>
        {BODY_ZONES.map((item) => {
          const isSelected = selectedZones.includes(item.zone);
          const isHitFlash = recentHitZone === item.zone;
          const isBlockedFlash = recentBlockedZone === item.zone;
          const zoneClassName = [
            'body-zone',
            `zone-${item.id}`,
            isSelected ? 'is-selected' : '',
            isSelected && mode === 'attack' ? 'is-attack' : '',
            isSelected && mode === 'defense' ? 'is-defense' : '',
            isHitFlash ? 'is-hit-flash' : '',
            isBlockedFlash ? 'is-block-flash' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={`${mode}-${item.id}`}
              type="button"
              className={zoneClassName}
              onClick={() => toggleZone(item.zone)}
              title={`${item.title} | ${item.hint}`}
              disabled={disabled}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ActionPlanner(props: ActionPlannerProps) {
  const [activePanelTab, setActivePanelTab] = useState<'skills' | 'inventory'>('skills');
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string | null>(null);
  const selectedDefenseZones = props.defenseZones.slice(0, 2);
  const skillOptions = props.availableSkills;
  const selectedInventoryEntry = useMemo(
    () => props.inventoryItems.find((item) => item.id === selectedInventoryItem) ?? null,
    [props.inventoryItems, selectedInventoryItem],
  );

  const estimatedCost = getEstimatedTotalCost(props.actionType, props.movementType);
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
        <button type="button" className={props.actionType === ActionType.Attack && !props.selectedSkillId ? 'is-active' : ''} onClick={() => {
          props.onActionTypeChange(ActionType.Attack);
          if (props.selectedSkillId) {
            props.onSkillChange(null);
          }
        }}>
          Атаковать
        </button>
        <button type="button" className={props.actionType === ActionType.Attack && Boolean(props.selectedSkillId) ? 'is-active' : ''} onClick={() => {
          props.onActionTypeChange(ActionType.Attack);
          if (!props.selectedSkillId && skillOptions.length > 0) {
            props.onSkillChange(skillOptions[0]!.skillId);
          }
        }}>
          Навык
        </button>
        <button type="button" className={props.actionType === ActionType.Defend ? 'is-active' : ''} onClick={() => props.onActionTypeChange(ActionType.Defend)}>
          Защита
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
        <div className="planner-status-row"><span>Защита:</span><strong>{getGuardLabel(props.defenseZones)}</strong></div>
        <div className="planner-status-row"><span>STA Load:</span><strong>{totalStaminaLoad}</strong></div>
        <div className="planner-status-row"><span>STA:</span><strong>{props.currentStamina} / {props.maxStamina}</strong></div>
        <div className="planner-status-row"><span>MP:</span><strong>{props.currentMp} / {props.maxMp}</strong></div>
        {props.movementType ? <div className="planner-status-row"><span>Движение:</span><strong>{MOVEMENT_LABELS[props.movementType]}{props.selectedMoveTile ? ` → ${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : ''}</strong></div> : null}
      </div>

      <div className="planner-targeting-layout compact-zones">
        <BodyTargetSelector
          mode="attack"
          maxSelections={1}
          selectedZones={[props.attackZone]}
          onChange={(zones) => zones[0] && props.onAttackZoneChange(zones[0])}
          disabled={props.actionType !== ActionType.Attack}
          title="Зона атаки"
          recentHitZone={props.recentHitZone}
        />

        <div>
          <BodyTargetSelector
            mode="defense"
            maxSelections={2}
            selectedZones={selectedDefenseZones}
            onChange={(zones) => props.onDefenseZonesChange(zones)}
            disabled={false}
            title="Зоны защиты"
            recentBlockedZone={props.recentBlockedZone}
          />
          <button type="button" className="secondary-button" onClick={() => props.onDefenseZonesChange([])}>
            Сбросить защиту
          </button>
        </div>
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

          <div className="battle-detail-popover">
            <strong>{selectedSkill?.label ?? 'Basic Attack'}</strong>
            <p>Target: {selectedEnemy?.name ?? 'None'}</p>
            <p>Mana cost: {manaCost}</p>
            <p>Stamina cost: {skillStaminaCost + ACTION_COSTS[props.actionType]}</p>
            <p>Move cost: {props.movementType ? MOVEMENT_COSTS[props.movementType] : 0}</p>
            {selectedSkill ? <p>Skill level: {selectedSkill.level}</p> : null}
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
                  title={`${item.name} x${item.quantity}`}
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
              </>
            ) : (
              <p>Select an item to inspect.</p>
            )}
          </div>
        </div>
      )}

      {props.showSubmitButton !== false && (
        <button className="confirm-turn-button" disabled={props.disabled} onClick={props.onSubmit}>
          СДЕЛАТЬ ХОД
        </button>
      )}
    </div>
  );
}

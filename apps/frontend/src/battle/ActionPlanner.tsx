import {
  ActionType,
  CombatSkillType,
  DistanceBand,
  MovementType,
  TargetZone,
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
  availableSkills: Array<{ id: CombatSkillType; label: string }>;
  inventoryItems: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    itemType: string;
    quantity: number;
  }>;
  selectedSkill: CombatSkillType;
  actionWarning?: string | null;
  onActionTypeChange: (actionType: ActionType) => void;
  onSkillChange: (skill: CombatSkillType) => void;
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
  [DistanceBand.Far]: 'Far',
  [DistanceBand.Near]: 'Near',
  [DistanceBand.Melee]: 'Melee',
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

const SKILL_MANA_COSTS: Partial<Record<CombatSkillType, number>> = {
  [CombatSkillType.None]: 0,
  [CombatSkillType.PowerStrike]: 15,
  [CombatSkillType.CrushingBlock]: 20,
  [CombatSkillType.Rage]: 25,
  [CombatSkillType.Fireball]: 18,
  [CombatSkillType.FrostLance]: 16,
};

const SKILL_STAMINA_COSTS: Partial<Record<CombatSkillType, number>> = {
  [CombatSkillType.ShieldBash]: 14,
  [CombatSkillType.Whirlwind]: 22,
};

function getGuardLabel(defenseZones: TargetZone[]): string {
  if (defenseZones.length === 0) {
    return 'Reckless Attack';
  }
  if (defenseZones.length === 1) {
    return 'Aggressive Guard';
  }
  return 'Normal Guard';
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
  const skillOptions = props.availableSkills.filter((skill) => skill.id !== CombatSkillType.None);
  const selectedInventoryEntry = useMemo(
    () => props.inventoryItems.find((item) => item.id === selectedInventoryItem) ?? null,
    [props.inventoryItems, selectedInventoryItem],
  );

  const estimatedCost = getEstimatedTotalCost(props.actionType, props.movementType);
  const manaCost = SKILL_MANA_COSTS[props.selectedSkill] ?? 0;
  const skillStaminaCost = SKILL_STAMINA_COSTS[props.selectedSkill] ?? 0;
  const totalStaminaLoad = estimatedCost + skillStaminaCost;
  const selectedEnemy = props.enemies.find((enemy) => enemy.id === props.selectedTargetId) ?? null;

  return (
    <div className="action-planner compact-planner inner-card">
      <h3>Actions</h3>

      <div className="planner-main-actions" role="group" aria-label="Main actions">
        <button type="button" className={props.actionType === ActionType.Attack && props.selectedSkill === CombatSkillType.None ? 'is-active' : ''} onClick={() => {
          props.onActionTypeChange(ActionType.Attack);
          if (props.selectedSkill !== CombatSkillType.None) {
            props.onSkillChange(CombatSkillType.None);
          }
        }}>
          Attack
        </button>
        <button type="button" className={props.actionType === ActionType.Attack && props.selectedSkill !== CombatSkillType.None ? 'is-active' : ''} onClick={() => {
          props.onActionTypeChange(ActionType.Attack);
          if (props.selectedSkill === CombatSkillType.None && skillOptions.length > 0) {
            props.onSkillChange(skillOptions[0]!.id);
          }
        }}>
          Skill
        </button>
        <button type="button" className={props.actionType === ActionType.Defend ? 'is-active' : ''} onClick={() => props.onActionTypeChange(ActionType.Defend)}>
          Defend
        </button>
        <button type="button" className={props.actionType === ActionType.Move ? 'is-active' : ''} onClick={() => props.onActionTypeChange(ActionType.Move)}>
          Move
        </button>
        <button type="button" className={props.actionType === ActionType.Wait ? 'is-active' : ''} onClick={() => props.onActionTypeChange(ActionType.Wait)}>
          Wait
        </button>
      </div>

      <div className="planner-selects-row">
        <div className="planner-select-item">
          <label htmlFor="target-select">Enemy</label>
          <select id="target-select" value={props.selectedTargetId} onChange={(event) => props.onTargetChange(event.target.value)} className="compact-select">
            {props.enemies.map((enemy) => (
              <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
            ))}
          </select>
        </div>

        <div className="planner-select-item">
          <label htmlFor="skill-select">Skill</label>
          <select
            id="skill-select"
            value={props.selectedSkill}
            onChange={(event) => {
              const skill = event.target.value as CombatSkillType;
              props.onSkillChange(skill);
              props.onActionTypeChange(ActionType.Attack);
            }}
            disabled={skillOptions.length === 0}
            className="compact-select"
          >
            <option value={CombatSkillType.None}>None</option>
            {skillOptions.map((skill) => (
              <option key={skill.id} value={skill.id}>{skill.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="planner-status-chips">
        <span className="status-chip">Distance: <strong>{DISTANCE_LABELS[props.currentDistance]}</strong></span>
        <span className="status-chip">Guard: <strong>{getGuardLabel(props.defenseZones)}</strong></span>
        <span className="status-chip">STA load: <strong>{totalStaminaLoad}</strong></span>
        <span className="status-chip">STA: <strong>{props.currentStamina}/{props.maxStamina}</strong></span>
        <span className="status-chip">MP: <strong>{props.currentMp}/{props.maxMp}</strong></span>
        {props.movementType ? <span className="status-chip">Move: <strong>{MOVEMENT_LABELS[props.movementType]}</strong>{props.selectedMoveTile ? ` → ${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : ''}</span> : null}
      </div>

      <div className="planner-targeting-layout compact-zones">
        <BodyTargetSelector
          mode="attack"
          maxSelections={1}
          selectedZones={[props.attackZone]}
          onChange={(zones) => zones[0] && props.onAttackZoneChange(zones[0])}
          disabled={props.actionType !== ActionType.Attack}
          title="Attack Zone"
          recentHitZone={props.recentHitZone}
        />

        <div>
          <BodyTargetSelector
            mode="defense"
            maxSelections={2}
            selectedZones={selectedDefenseZones}
            onChange={(zones) => props.onDefenseZonesChange(zones)}
            disabled={false}
            title="Defense Zones"
            recentBlockedZone={props.recentBlockedZone}
          />
          <button type="button" className="secondary-button" onClick={() => props.onDefenseZonesChange([])}>
            Clear Defense for Reckless Attack
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
                key={skill.id}
                type="button"
                className={`skill-icon-item ${props.selectedSkill === skill.id ? 'is-active' : ''}`}
                onClick={() => {
                  props.onSkillChange(skill.id);
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
            <strong>{props.availableSkills.find((item) => item.id === props.selectedSkill)?.label ?? 'Basic Attack'}</strong>
            <p>Target: {selectedEnemy?.name ?? 'None'}</p>
            <p>Mana cost: {manaCost}</p>
            <p>Stamina cost: {skillStaminaCost + ACTION_COSTS[props.actionType]}</p>
            <p>Move cost: {props.movementType ? MOVEMENT_COSTS[props.movementType] : 0}</p>
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

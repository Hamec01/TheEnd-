import {
  ActionType,
  CombatSkillType,
  DistanceBand,
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
  preferredDistance: DistanceBand;
  selectedMoveTile?: { x: number; y: number } | null;
  currentStamina: number;
  maxStamina: number;
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
  onActionTypeChange: (actionType: ActionType) => void;
  onSkillChange: (skill: CombatSkillType) => void;
  onTargetChange: (id: string) => void;
  onAttackZoneChange: (zone: TargetZone) => void;
  onDefenseZonesChange: (zones: TargetZone[]) => void;
  onPreferredDistanceChange: (distance: DistanceBand) => void;
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
  oldCode: 'H' | 'C' | 'A' | 'LA' | 'RA' | 'L';
  hint: string;
}

const BODY_ZONES: BodyZoneConfig[] = [
  { id: 'head', zone: TargetZone.Head, title: 'Head / Голова', label: 'Голова', oldCode: 'H', hint: 'High crit chance, possible stun in future.' },
  { id: 'left_arm', zone: TargetZone.LeftArm, title: 'Left Arm / Левая рука', label: 'Левая рука', oldCode: 'LA', hint: 'May reduce attack control and disarm in future.' },
  { id: 'right_arm', zone: TargetZone.RightArm, title: 'Right Arm / Правая рука', label: 'Правая рука', oldCode: 'RA', hint: 'May reduce weapon control and disarm in future.' },
  { id: 'chest', zone: TargetZone.Chest, title: 'Chest / Грудь', label: 'Грудь', oldCode: 'C', hint: 'Can pressure stamina and breathing in future.' },
  { id: 'stomach', zone: TargetZone.Abdomen, title: 'Stomach / Живот / Тело', label: 'Живот / Тело', oldCode: 'A', hint: 'Can enable bleed and internal damage in future.' },
  { id: 'legs', zone: TargetZone.Legs, title: 'Legs / Ноги', label: 'Ноги', oldCode: 'L', hint: 'Can reduce dodge and initiative in future.' },
];

const LEGACY_ZONE_TO_BODY: Record<BodyZoneConfig['oldCode'], TargetZone> = {
  H: TargetZone.Head,
  C: TargetZone.Chest,
  A: TargetZone.Abdomen,
  LA: TargetZone.LeftArm,
  RA: TargetZone.RightArm,
  L: TargetZone.Legs,
};

const BODY_TO_LEGACY_ZONE: Record<TargetZone, BodyZoneConfig['oldCode']> = {
  [TargetZone.Head]: 'H',
  [TargetZone.Chest]: 'C',
  [TargetZone.Abdomen]: 'A',
  [TargetZone.LeftArm]: 'LA',
  [TargetZone.RightArm]: 'RA',
  [TargetZone.Legs]: 'L',
};

const DISTANCE_LABELS: Record<DistanceBand, string> = {
  [DistanceBand.Far]: 'Ranged',
  [DistanceBand.Near]: 'Medium',
  [DistanceBand.Melee]: 'Melee',
};

function zoneLabel(zone: TargetZone): string {
  return BODY_ZONES.find((item) => item.zone === zone)?.label ?? zone;
}

function estimateStaminaCost(actionType: ActionType): number {
  if (actionType === ActionType.Attack) {
    return 12;
  }
  if (actionType === ActionType.Defend) {
    return 8;
  }
  if (actionType === ActionType.Move) {
    return 6;
  }
  return 0;
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
              title={`${item.title} | Legacy: ${item.oldCode} | ${item.hint}`}
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
  const selectedEnemy = props.enemies.find((enemy) => enemy.id === props.selectedTargetId) ?? null;
  const selectedDefenseZones = props.defenseZones.slice(0, 2);
  const skillOptions = props.availableSkills.filter((skill) => skill.id !== CombatSkillType.None);
  const selectedInventoryEntry = useMemo(
    () => props.inventoryItems.find((item) => item.id === selectedInventoryItem) ?? null,
    [props.inventoryItems, selectedInventoryItem],
  );

  const currentActionLabel =
    props.actionType === ActionType.Move
      ? 'Retreat'
      : props.actionType === ActionType.Defend
        ? 'Potion / Defend'
        : props.selectedSkill !== CombatSkillType.None
          ? 'Skill'
          : 'Attack';

  const estimatedCost = estimateStaminaCost(props.actionType);

  return (
    <div className="action-planner compact-planner inner-card">
      <h3>Actions</h3>

      <div className="planner-main-actions" role="group" aria-label="Main actions">
        <button
          type="button"
          className={currentActionLabel === 'Attack' ? 'is-active' : ''}
          onClick={() => {
            props.onActionTypeChange(ActionType.Attack);
            props.onSkillChange(CombatSkillType.None);
          }}
          title="Basic Attack"
        >
          Attack
        </button>
        <button
          type="button"
          className={currentActionLabel === 'Skill' ? 'is-active' : ''}
          onClick={() => {
            props.onActionTypeChange(ActionType.Attack);
            if (props.selectedSkill === CombatSkillType.None && skillOptions.length > 0) {
              props.onSkillChange(skillOptions[0].id);
            }
          }}
          title="Use Combat Skill"
        >
          Skill
        </button>
        <button
          type="button"
          className={currentActionLabel === 'Potion / Defend' ? 'is-active' : ''}
          onClick={() => props.onActionTypeChange(ActionType.Defend)}
          title="Defend / Use Potion"
        >
          Defend
        </button>
        <button
          type="button"
          className={currentActionLabel === 'Retreat' ? 'is-active' : ''}
          onClick={() => {
            props.onActionTypeChange(ActionType.Move);
            props.onPreferredDistanceChange(DistanceBand.Far);
          }}
          title="Retreat to Ranged"
        >
          Retreat
        </button>
      </div>

      <div className="planner-selects-row">
        <div className="planner-select-item">
          <label htmlFor="target-select">Enemy</label>
          <select
            id="target-select"
            value={props.selectedTargetId}
            onChange={(event) => props.onTargetChange(event.target.value)}
            className="compact-select"
          >
            {props.enemies.map((enemy) => (
              <option key={enemy.id} value={enemy.id}>
                {enemy.name}
              </option>
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
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="planner-status-chips">
        <span className="status-chip">Action: <strong>{currentActionLabel}</strong></span>
        <span className="status-chip">Cost: <strong>{estimatedCost}</strong></span>
        <span className="status-chip">Dist: <strong>{DISTANCE_LABELS[props.currentDistance]}</strong></span>
        <span className="status-chip">STA: <strong>{props.currentStamina}/{props.maxStamina}</strong></span>
      </div>

      <div className="planner-targeting-layout compact-zones">
        <BodyTargetSelector
          mode="attack"
          maxSelections={1}
          selectedZones={[props.attackZone]}
          onChange={(zones) => {
            if (zones[0]) {
              props.onAttackZoneChange(zones[0]);
            }
          }}
          disabled={props.actionType !== ActionType.Attack}
          title="Attack"
          recentHitZone={props.recentHitZone}
        />

        <BodyTargetSelector
          mode="defense"
          maxSelections={2}
          selectedZones={selectedDefenseZones}
          onChange={(zones) => props.onDefenseZonesChange(zones)}
          disabled={props.actionType === ActionType.Move}
          title="Defend"
          recentBlockedZone={props.recentBlockedZone}
        />
      </div>

      {props.actionType === ActionType.Move && (
        <div className="planner-move-section">
          <label htmlFor="distance-select">Retreat to:</label>
          <select
            id="distance-select"
            value={props.preferredDistance}
            onChange={(event) => props.onPreferredDistanceChange(event.target.value as DistanceBand)}
            className="compact-select"
          >
            <option value={DistanceBand.Far}>Ranged</option>
            <option value={DistanceBand.Near}>Medium</option>
            <option value={DistanceBand.Melee}>Melee</option>
          </select>
          <div className="move-tile-display">
            {props.selectedMoveTile ? `Target: ${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : 'Click on board'}
          </div>
        </div>
      )}

      <div className="battle-side-panel-tabs">
        <button
          type="button"
          className={activePanelTab === 'skills' ? 'is-active' : ''}
          onClick={() => setActivePanelTab('skills')}
        >
          Skills
        </button>
        <button
          type="button"
          className={activePanelTab === 'inventory' ? 'is-active' : ''}
          onClick={() => setActivePanelTab('inventory')}
        >
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
            <p>Damage type: Physical</p>
            <p>Mana cost: {props.selectedSkill === CombatSkillType.None ? 0 : 8}</p>
            <p>Stamina cost: {estimateStaminaCost(ActionType.Attack)}</p>
            <p>Range: melee</p>
            <p>Target: single enemy</p>
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

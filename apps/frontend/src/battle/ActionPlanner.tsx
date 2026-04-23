import {
  ActionType,
  CombatSkillType,
  DistanceBand,
  type ArenaCombatEntity,
  TargetZone,
} from '@theend/rpg-domain';

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
  selectedSkill: CombatSkillType;
  onActionTypeChange: (actionType: ActionType) => void;
  onSkillChange: (skill: CombatSkillType) => void;
  onTargetChange: (id: string) => void;
  onAttackZoneChange: (zone: TargetZone) => void;
  onDefenseZonesChange: (zones: TargetZone[]) => void;
  onPreferredDistanceChange: (distance: DistanceBand) => void;
  onSubmit: () => void;
  disabled: boolean;
}

const ZONES = [
  TargetZone.Head,
  TargetZone.Chest,
  TargetZone.Abdomen,
  TargetZone.LeftArm,
  TargetZone.RightArm,
  TargetZone.Legs,
];

const DISTANCES = [DistanceBand.Melee, DistanceBand.Near, DistanceBand.Far];

function zoneLabel(zone: TargetZone): string {
  if (zone === TargetZone.Head) {
    return 'Head';
  }
  if (zone === TargetZone.Chest) {
    return 'Chest';
  }
  if (zone === TargetZone.Abdomen) {
    return 'Abdomen';
  }
  if (zone === TargetZone.LeftArm) {
    return 'Left arm';
  }
  if (zone === TargetZone.RightArm) {
    return 'Right arm';
  }
  return 'Legs';
}

function zoneShortLabel(zone: TargetZone): string {
  if (zone === TargetZone.Head) {
    return 'H';
  }
  if (zone === TargetZone.Chest) {
    return 'C';
  }
  if (zone === TargetZone.Abdomen) {
    return 'A';
  }
  if (zone === TargetZone.LeftArm) {
    return 'LA';
  }
  if (zone === TargetZone.RightArm) {
    return 'RA';
  }
  return 'L';
}

export function ActionPlanner(props: ActionPlannerProps) {
  return (
    <div className="action-planner inner-card">
      <h3>Round plan</h3>

      <div className="planner-row">
        <label>Act</label>
        <select value={props.actionType} onChange={(event) => props.onActionTypeChange(event.target.value as ActionType)}>
          <option value={ActionType.Attack}>Attack</option>
          <option value={ActionType.Defend}>Defend</option>
          <option value={ActionType.Move}>Move</option>
        </select>
      </div>

      <div className="planner-row">
        <label>Target</label>
        <select value={props.selectedTargetId} onChange={(event) => props.onTargetChange(event.target.value)}>
          {props.enemies.map((enemy) => (
            <option key={enemy.id} value={enemy.id}>
              {enemy.name}
            </option>
          ))}
        </select>
      </div>

      <div className="planner-row planner-row-compact">
        <label>STA</label>
        <div className="planner-resource">{props.currentStamina}/{props.maxStamina}</div>
      </div>

      <div className="planner-row planner-row-compact">
        <label>Skill</label>
        {props.actionType === ActionType.Attack ? (
          <select value={props.selectedSkill} onChange={(event) => props.onSkillChange(event.target.value as CombatSkillType)}>
            {props.availableSkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="planner-resource">Unavailable</div>
        )}
      </div>

      {props.actionType === ActionType.Move ? (
        <>
          <div className="planner-row">
            <label>Range</label>
            <select
              value={props.preferredDistance}
              onChange={(event) => props.onPreferredDistanceChange(event.target.value as DistanceBand)}
            >
              {DISTANCES.map((distance) => (
                <option key={distance} value={distance}>
                  {distance}
                </option>
              ))}
            </select>
            <div className="planner-resource">Current: {props.currentDistance}</div>
          </div>
          <div className="planner-row planner-row-compact">
            <label>Tile</label>
            <div className="planner-resource">
              {props.selectedMoveTile ? `${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : 'Click grid'}
            </div>
          </div>
        </>
      ) : null}

      <div className="planner-zones">
        <div>
          <h4>ATK</h4>
          <div className="zone-options">
            {ZONES.map((zone) => (
              <label key={`atk-${zone}`} className="zone-option" title={zoneLabel(zone)}>
                <input
                  type="radio"
                  name="attack-zone"
                  value={zone}
                  checked={props.attackZone === zone}
                  disabled={props.actionType !== ActionType.Attack}
                  onChange={() => props.onAttackZoneChange(zone)}
                />
                <span>{zoneShortLabel(zone)}</span>
              </label>
            ))}
          </div>

        </div>

        <div>
          <h4>DEF</h4>
          <div className="zone-options">
            {ZONES.map((zone) => {
              const checked = props.defenseZones.includes(zone);
              const canToggleOn = checked || props.defenseZones.length < 2;

              return (
                <label key={`def-${zone}`} className="zone-option" title={zoneLabel(zone)}>
                  <input
                    type="checkbox"
                    name={`defense-zone-${zone}`}
                    value={zone}
                    checked={checked}
                    disabled={props.actionType === ActionType.Move || (!checked && !canToggleOn)}
                    onChange={() => {
                      const nextZones = checked
                        ? props.defenseZones.filter((value) => value !== zone)
                        : [...props.defenseZones, zone];
                      props.onDefenseZonesChange(nextZones.slice(0, 2));
                    }}
                  />
                  <span>{zoneShortLabel(zone)}</span>
                </label>
              );
            })}
          </div>

        </div>
      </div>

      <p className="muted">
        {props.actionType === ActionType.Move
          ? 'Move: choose a tile on the grid.'
          : 'ATK: 1, DEF: up to 2.'}
      </p>

      <button disabled={props.disabled} onClick={props.onSubmit}>
        Commit ({props.actionType})
      </button>
    </div>
  );
}

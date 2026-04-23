import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ActionType, DistanceBand, TargetZone, } from '@theend/rpg-domain';
const ZONES = [
    TargetZone.Head,
    TargetZone.Chest,
    TargetZone.Abdomen,
    TargetZone.LeftArm,
    TargetZone.RightArm,
    TargetZone.Legs,
];
const DISTANCES = [DistanceBand.Melee, DistanceBand.Near, DistanceBand.Far];
function zoneLabel(zone) {
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
function zoneShortLabel(zone) {
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
export function ActionPlanner(props) {
    return (_jsxs("div", { className: "action-planner inner-card", children: [_jsx("h3", { children: "Round plan" }), _jsxs("div", { className: "planner-row", children: [_jsx("label", { children: "Act" }), _jsxs("select", { value: props.actionType, onChange: (event) => props.onActionTypeChange(event.target.value), children: [_jsx("option", { value: ActionType.Attack, children: "Attack" }), _jsx("option", { value: ActionType.Defend, children: "Defend" }), _jsx("option", { value: ActionType.Move, children: "Move" })] })] }), _jsxs("div", { className: "planner-row", children: [_jsx("label", { children: "Target" }), _jsx("select", { value: props.selectedTargetId, onChange: (event) => props.onTargetChange(event.target.value), children: props.enemies.map((enemy) => (_jsx("option", { value: enemy.id, children: enemy.name }, enemy.id))) })] }), _jsxs("div", { className: "planner-row planner-row-compact", children: [_jsx("label", { children: "STA" }), _jsxs("div", { className: "planner-resource", children: [props.currentStamina, "/", props.maxStamina] })] }), _jsxs("div", { className: "planner-row planner-row-compact", children: [_jsx("label", { children: "Skill" }), props.actionType === ActionType.Attack ? (_jsx("select", { value: props.selectedSkill, onChange: (event) => props.onSkillChange(event.target.value), children: props.availableSkills.map((skill) => (_jsx("option", { value: skill.id, children: skill.label }, skill.id))) })) : (_jsx("div", { className: "planner-resource", children: "Unavailable" }))] }), props.actionType === ActionType.Move ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "planner-row", children: [_jsx("label", { children: "Range" }), _jsx("select", { value: props.preferredDistance, onChange: (event) => props.onPreferredDistanceChange(event.target.value), children: DISTANCES.map((distance) => (_jsx("option", { value: distance, children: distance }, distance))) }), _jsxs("div", { className: "planner-resource", children: ["Current: ", props.currentDistance] })] }), _jsxs("div", { className: "planner-row planner-row-compact", children: [_jsx("label", { children: "Tile" }), _jsx("div", { className: "planner-resource", children: props.selectedMoveTile ? `${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : 'Click grid' })] })] })) : null, _jsxs("div", { className: "planner-zones", children: [_jsxs("div", { children: [_jsx("h4", { children: "ATK" }), _jsx("div", { className: "zone-options", children: ZONES.map((zone) => (_jsxs("label", { className: "zone-option", title: zoneLabel(zone), children: [_jsx("input", { type: "radio", name: "attack-zone", value: zone, checked: props.attackZone === zone, disabled: props.actionType !== ActionType.Attack, onChange: () => props.onAttackZoneChange(zone) }), _jsx("span", { children: zoneShortLabel(zone) })] }, `atk-${zone}`))) })] }), _jsxs("div", { children: [_jsx("h4", { children: "DEF" }), _jsx("div", { className: "zone-options", children: ZONES.map((zone) => {
                                    const checked = props.defenseZones.includes(zone);
                                    const canToggleOn = checked || props.defenseZones.length < 2;
                                    return (_jsxs("label", { className: "zone-option", title: zoneLabel(zone), children: [_jsx("input", { type: "checkbox", name: `defense-zone-${zone}`, value: zone, checked: checked, disabled: props.actionType === ActionType.Move || (!checked && !canToggleOn), onChange: () => {
                                                    const nextZones = checked
                                                        ? props.defenseZones.filter((value) => value !== zone)
                                                        : [...props.defenseZones, zone];
                                                    props.onDefenseZonesChange(nextZones.slice(0, 2));
                                                } }), _jsx("span", { children: zoneShortLabel(zone) })] }, `def-${zone}`));
                                }) })] })] }), _jsx("p", { className: "muted", children: props.actionType === ActionType.Move
                    ? 'Move: choose a tile on the grid.'
                    : 'ATK: 1, DEF: up to 2.' }), _jsxs("button", { disabled: props.disabled, onClick: props.onSubmit, children: ["Commit (", props.actionType, ")"] })] }));
}

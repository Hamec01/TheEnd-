import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { ActionType, CombatSkillType, DistanceBand, TargetZone, } from '@theend/rpg-domain';
import { useMemo, useState } from 'react';
const BODY_ZONES = [
    { id: 'head', zone: TargetZone.Head, title: 'Head / Голова', label: 'Голова', oldCode: 'H', hint: 'High crit chance, possible stun in future.' },
    { id: 'left_arm', zone: TargetZone.LeftArm, title: 'Left Arm / Левая рука', label: 'Левая рука', oldCode: 'LA', hint: 'May reduce attack control and disarm in future.' },
    { id: 'right_arm', zone: TargetZone.RightArm, title: 'Right Arm / Правая рука', label: 'Правая рука', oldCode: 'RA', hint: 'May reduce weapon control and disarm in future.' },
    { id: 'chest', zone: TargetZone.Chest, title: 'Chest / Грудь', label: 'Грудь', oldCode: 'C', hint: 'Can pressure stamina and breathing in future.' },
    { id: 'stomach', zone: TargetZone.Abdomen, title: 'Stomach / Живот / Тело', label: 'Живот / Тело', oldCode: 'A', hint: 'Can enable bleed and internal damage in future.' },
    { id: 'legs', zone: TargetZone.Legs, title: 'Legs / Ноги', label: 'Ноги', oldCode: 'L', hint: 'Can reduce dodge and initiative in future.' },
];
const LEGACY_ZONE_TO_BODY = {
    H: TargetZone.Head,
    C: TargetZone.Chest,
    A: TargetZone.Abdomen,
    LA: TargetZone.LeftArm,
    RA: TargetZone.RightArm,
    L: TargetZone.Legs,
};
const BODY_TO_LEGACY_ZONE = {
    [TargetZone.Head]: 'H',
    [TargetZone.Chest]: 'C',
    [TargetZone.Abdomen]: 'A',
    [TargetZone.LeftArm]: 'LA',
    [TargetZone.RightArm]: 'RA',
    [TargetZone.Legs]: 'L',
};
const DISTANCE_LABELS = {
    [DistanceBand.Far]: 'Ranged',
    [DistanceBand.Near]: 'Medium',
    [DistanceBand.Melee]: 'Melee',
};
function zoneLabel(zone) {
    return BODY_ZONES.find((item) => item.zone === zone)?.label ?? zone;
}
function estimateStaminaCost(actionType) {
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
function BodyTargetSelector({ mode, selectedZones, maxSelections, onChange, disabled = false, title, recentHitZone, recentBlockedZone, }) {
    function toggleZone(zone) {
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
    return (_jsxs("div", { className: `body-target-selector mode-${mode} ${disabled ? 'is-disabled' : ''}`, children: [title ? _jsx("h4", { children: title }) : null, _jsx("div", { className: "body-silhouette", role: "group", "aria-label": title ?? mode, children: BODY_ZONES.map((item) => {
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
                    return (_jsx("button", { type: "button", className: zoneClassName, onClick: () => toggleZone(item.zone), title: `${item.title} | Legacy: ${item.oldCode} | ${item.hint}`, disabled: disabled, children: _jsx("span", { children: item.label }) }, `${mode}-${item.id}`));
                }) })] }));
}
export function ActionPlanner(props) {
    const [activePanelTab, setActivePanelTab] = useState('skills');
    const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
    const selectedEnemy = props.enemies.find((enemy) => enemy.id === props.selectedTargetId) ?? null;
    const selectedDefenseZones = props.defenseZones.slice(0, 2);
    const skillOptions = props.availableSkills.filter((skill) => skill.id !== CombatSkillType.None);
    const selectedInventoryEntry = useMemo(() => props.inventoryItems.find((item) => item.id === selectedInventoryItem) ?? null, [props.inventoryItems, selectedInventoryItem]);
    const currentActionLabel = props.actionType === ActionType.Move
        ? 'Retreat'
        : props.actionType === ActionType.Defend
            ? 'Potion / Defend'
            : props.selectedSkill !== CombatSkillType.None
                ? 'Skill'
                : 'Attack';
    const estimatedCost = estimateStaminaCost(props.actionType);
    return (_jsxs("div", { className: "action-planner compact-planner inner-card", children: [_jsx("h3", { children: "Actions" }), _jsxs("div", { className: "planner-main-actions", role: "group", "aria-label": "Main actions", children: [_jsx("button", { type: "button", className: currentActionLabel === 'Attack' ? 'is-active' : '', onClick: () => {
                            props.onActionTypeChange(ActionType.Attack);
                            props.onSkillChange(CombatSkillType.None);
                        }, title: "Basic Attack", children: "Attack" }), _jsx("button", { type: "button", className: currentActionLabel === 'Skill' ? 'is-active' : '', onClick: () => {
                            props.onActionTypeChange(ActionType.Attack);
                            if (props.selectedSkill === CombatSkillType.None && skillOptions.length > 0) {
                                props.onSkillChange(skillOptions[0].id);
                            }
                        }, title: "Use Combat Skill", children: "Skill" }), _jsx("button", { type: "button", className: currentActionLabel === 'Potion / Defend' ? 'is-active' : '', onClick: () => props.onActionTypeChange(ActionType.Defend), title: "Defend / Use Potion", children: "Defend" }), _jsx("button", { type: "button", className: currentActionLabel === 'Retreat' ? 'is-active' : '', onClick: () => {
                            props.onActionTypeChange(ActionType.Move);
                            props.onPreferredDistanceChange(DistanceBand.Far);
                        }, title: "Retreat to Ranged", children: "Retreat" })] }), _jsxs("div", { className: "planner-selects-row", children: [_jsxs("div", { className: "planner-select-item", children: [_jsx("label", { htmlFor: "target-select", children: "Enemy" }), _jsx("select", { id: "target-select", value: props.selectedTargetId, onChange: (event) => props.onTargetChange(event.target.value), className: "compact-select", children: props.enemies.map((enemy) => (_jsx("option", { value: enemy.id, children: enemy.name }, enemy.id))) })] }), _jsxs("div", { className: "planner-select-item", children: [_jsx("label", { htmlFor: "skill-select", children: "Skill" }), _jsxs("select", { id: "skill-select", value: props.selectedSkill, onChange: (event) => {
                                    const skill = event.target.value;
                                    props.onSkillChange(skill);
                                    props.onActionTypeChange(ActionType.Attack);
                                }, disabled: skillOptions.length === 0, className: "compact-select", children: [_jsx("option", { value: CombatSkillType.None, children: "None" }), skillOptions.map((skill) => (_jsx("option", { value: skill.id, children: skill.label }, skill.id)))] })] })] }), _jsxs("div", { className: "planner-status-chips", children: [_jsxs("span", { className: "status-chip", children: ["Action: ", _jsx("strong", { children: currentActionLabel })] }), _jsxs("span", { className: "status-chip", children: ["Cost: ", _jsx("strong", { children: estimatedCost })] }), _jsxs("span", { className: "status-chip", children: ["Dist: ", _jsx("strong", { children: DISTANCE_LABELS[props.currentDistance] })] }), _jsxs("span", { className: "status-chip", children: ["STA: ", _jsxs("strong", { children: [props.currentStamina, "/", props.maxStamina] })] })] }), _jsxs("div", { className: "planner-targeting-layout compact-zones", children: [_jsx(BodyTargetSelector, { mode: "attack", maxSelections: 1, selectedZones: [props.attackZone], onChange: (zones) => {
                            if (zones[0]) {
                                props.onAttackZoneChange(zones[0]);
                            }
                        }, disabled: props.actionType !== ActionType.Attack, title: "Attack", recentHitZone: props.recentHitZone }), _jsx(BodyTargetSelector, { mode: "defense", maxSelections: 2, selectedZones: selectedDefenseZones, onChange: (zones) => props.onDefenseZonesChange(zones), disabled: props.actionType === ActionType.Move, title: "Defend", recentBlockedZone: props.recentBlockedZone })] }), props.actionType === ActionType.Move && (_jsxs("div", { className: "planner-move-section", children: [_jsx("label", { htmlFor: "distance-select", children: "Retreat to:" }), _jsxs("select", { id: "distance-select", value: props.preferredDistance, onChange: (event) => props.onPreferredDistanceChange(event.target.value), className: "compact-select", children: [_jsx("option", { value: DistanceBand.Far, children: "Ranged" }), _jsx("option", { value: DistanceBand.Near, children: "Medium" }), _jsx("option", { value: DistanceBand.Melee, children: "Melee" })] }), _jsx("div", { className: "move-tile-display", children: props.selectedMoveTile ? `Target: ${props.selectedMoveTile.x + 1}:${props.selectedMoveTile.y + 1}` : 'Click on board' })] })), _jsxs("div", { className: "battle-side-panel-tabs", children: [_jsx("button", { type: "button", className: activePanelTab === 'skills' ? 'is-active' : '', onClick: () => setActivePanelTab('skills'), children: "Skills" }), _jsx("button", { type: "button", className: activePanelTab === 'inventory' ? 'is-active' : '', onClick: () => setActivePanelTab('inventory'), children: "Inventory" })] }), activePanelTab === 'skills' && (_jsxs("div", { className: "battle-side-panel-content", children: [_jsx("div", { className: "skill-icon-grid", children: props.availableSkills.map((skill) => (_jsxs("button", { type: "button", className: `skill-icon-item ${props.selectedSkill === skill.id ? 'is-active' : ''}`, onClick: () => {
                                props.onSkillChange(skill.id);
                                props.onActionTypeChange(ActionType.Attack);
                            }, title: skill.label, children: [_jsx("span", { className: "skill-icon-glyph", children: skill.label.slice(0, 2).toUpperCase() }), _jsx("span", { className: "skill-icon-label", children: skill.label })] }, skill.id))) }), _jsxs("div", { className: "battle-detail-popover", children: [_jsx("strong", { children: props.availableSkills.find((item) => item.id === props.selectedSkill)?.label ?? 'Basic Attack' }), _jsx("p", { children: "Damage type: Physical" }), _jsxs("p", { children: ["Mana cost: ", props.selectedSkill === CombatSkillType.None ? 0 : 8] }), _jsxs("p", { children: ["Stamina cost: ", estimateStaminaCost(ActionType.Attack)] }), _jsx("p", { children: "Range: melee" }), _jsx("p", { children: "Target: single enemy" })] })] })), activePanelTab === 'inventory' && (_jsxs("div", { className: "battle-side-panel-content", children: [props.inventoryItems.length > 0 ? (_jsx("div", { className: "item-icon-grid", children: props.inventoryItems.map((item) => (_jsxs("button", { type: "button", className: `item-icon-item ${selectedInventoryItem === item.id ? 'is-active' : ''}`, onClick: () => setSelectedInventoryItem(item.id), title: `${item.name} x${item.quantity}`, children: [_jsx("span", { className: "item-icon-glyph", children: item.name.slice(0, 1) }), _jsxs("span", { className: "item-icon-label", children: [item.name, " x", item.quantity] })] }, item.id))) })) : (_jsx("div", { className: "battle-detail-popover", children: _jsx("p", { children: "Inventory is empty." }) })), _jsx("div", { className: "battle-detail-popover", children: selectedInventoryEntry ? (_jsxs(_Fragment, { children: [_jsx("strong", { children: selectedInventoryEntry.name }), _jsx("p", { children: selectedInventoryEntry.description }), _jsxs("p", { children: ["Type: ", selectedInventoryEntry.itemType] }), _jsxs("p", { children: ["Quantity: ", selectedInventoryEntry.quantity] })] })) : (_jsx("p", { children: "Select an item to inspect." })) })] })), props.showSubmitButton !== false && (_jsx("button", { className: "confirm-turn-button", disabled: props.disabled, onClick: props.onSubmit, children: "\u0421\u0414\u0415\u041B\u0410\u0422\u042C \u0425\u041E\u0414" }))] }));
}

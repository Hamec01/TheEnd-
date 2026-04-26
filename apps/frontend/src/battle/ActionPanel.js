import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const ActionPanel = ({ actions, onActionSelect, isDisabled = false, availableResources = {}, }) => {
    const [activeTab, setActiveTab] = useState('attack');
    const canUseAction = (action) => {
        if (!availableResources)
            return true;
        const resourceKey = action.costType === 'action' ? 'actions' : action.costType;
        const resource = availableResources[resourceKey];
        return resource !== undefined ? resource >= action.cost : true;
    };
    const filterActionsByTab = () => {
        const tabMap = {
            attack: ['basic_attack', 'power_attack', 'slash'],
            defense: ['defend', 'parry', 'dodge'],
            skill: ['special_move', 'ultimate', 'buff'],
        };
        return actions.filter((a) => {
            const prefix = a.id.split('_')[0];
            return tabMap[activeTab]?.includes(prefix) || activeTab === 'attack';
        });
    };
    const filteredActions = filterActionsByTab();
    return (_jsxs("div", { className: "action-panel", style: { visibility: isDisabled ? 'hidden' : 'visible' }, children: [_jsx("div", { className: "action-panel-header", children: _jsx("h4", { children: "Actions" }) }), _jsxs("div", { className: "action-tabs", children: [_jsx("button", { className: `action-tab-button ${activeTab === 'attack' ? 'is-active' : ''}`, onClick: () => setActiveTab('attack'), children: "\u2694\uFE0F Attack" }), _jsx("button", { className: `action-tab-button ${activeTab === 'defense' ? 'is-active' : ''}`, onClick: () => setActiveTab('defense'), children: "\uD83D\uDEE1\uFE0F Defense" }), _jsx("button", { className: `action-tab-button ${activeTab === 'skill' ? 'is-active' : ''}`, onClick: () => setActiveTab('skill'), children: "\u2728 Skill" })] }), _jsx("div", { className: "action-list", children: filteredActions.map((action) => {
                    const isDisabledAction = !canUseAction(action);
                    return (_jsxs("button", { className: `action-item ${isDisabledAction ? 'is-disabled' : ''}`, onClick: () => !isDisabledAction && onActionSelect(action), disabled: isDisabledAction, children: [_jsxs("div", { className: "action-item-name", children: [_jsx("strong", { children: action.name }), _jsxs("span", { className: "action-item-cost", children: [action.cost, " ", action.costType] })] }), _jsx("div", { className: "action-item-icon", children: action.icon })] }, action.id));
                }) }), filteredActions.length === 0 && (_jsx("div", { style: { padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }, children: "No actions available" }))] }));
};

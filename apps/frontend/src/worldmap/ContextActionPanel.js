import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ContextActionPanel(props) {
    const { mode, selectedNode, onAction } = props;
    const recentEvents = [
        'Вы получили 120 опыта',
        'Добавлен предмет: Кожа волка',
        'Потрачено: 15 золота',
        'Вы вошли в локацию: Арклейн',
        'Бой начался',
    ];
    const quests = [
        'Гибель каравана',
        'Доставка в Брейнхольд',
        'Охота на волков',
    ];
    if (!selectedNode || mode === 'empty') {
        return (_jsxs("aside", { className: "wm-context card", children: [_jsxs("section", { className: "wm-context-block", children: [_jsx("h3", { children: "\u0417\u0430\u0434\u0430\u043D\u0438\u044F" }), quests.map((quest) => (_jsx("p", { children: quest }, quest)))] }), _jsxs("section", { className: "wm-context-block", children: [_jsx("h3", { children: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F" }), recentEvents.map((event) => (_jsxs("p", { className: "muted", children: ["+ ", event] }, event)))] }), _jsx("p", { className: "muted", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0447\u043A\u0443 \u043D\u0430 \u043A\u0430\u0440\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F." })] }));
    }
    if (mode === 'combat') {
        return (_jsxs("aside", { className: "wm-context card", children: [_jsx("h3", { children: "Ambush on the Road" }), _jsxs("p", { className: "muted", children: ["A hostile group blocks your path near ", selectedNode.name, "."] }), _jsxs("div", { className: "wm-action-grid", children: [_jsx("button", { onClick: () => onAction('enter-battle', 'combat'), children: "Enter Battle" }), _jsx("button", { onClick: () => onAction('scout-enemy', 'scout'), children: "Scout Enemy" }), _jsx("button", { onClick: () => onAction('retreat', 'rest'), children: "Retreat" })] })] }));
    }
    if (mode === 'npc') {
        return (_jsxs("aside", { className: "wm-context card", children: [_jsx("h3", { children: "NPC Message" }), _jsxs("p", { className: "muted", children: ["A guard blocks your way in ", selectedNode.name, ". Choose your response."] }), _jsxs("div", { className: "wm-action-grid", children: [_jsx("button", { onClick: () => onAction('talk', 'talk'), children: "Talk" }), _jsx("button", { onClick: () => onAction('trade', 'trade'), children: "Trade" }), _jsx("button", { onClick: () => onAction('attack', 'combat'), children: "Attack" }), _jsx("button", { onClick: () => onAction('leave', 'rest'), children: "Leave" })] })] }));
    }
    return (_jsxs("aside", { className: "wm-context card", children: [_jsxs("section", { className: "wm-context-block", children: [_jsx("h3", { children: selectedNode.name }), _jsxs("p", { className: "wm-meta-row", children: [_jsx("span", { children: selectedNode.type }), _jsx("span", { children: selectedNode.faction })] }), _jsxs("p", { className: "wm-meta-row", children: [_jsxs("span", { children: ["Danger: ", selectedNode.danger] }), _jsxs("span", { children: ["Lvl ", selectedNode.recommendedLevel] }), _jsx("span", { children: selectedNode.access })] }), _jsx("p", { className: "muted", children: selectedNode.description }), _jsx("div", { className: "wm-action-grid", children: selectedNode.actions.map((action) => (_jsx("button", { onClick: () => onAction(action.id, action.kind), children: action.label }, action.id))) })] }), _jsxs("section", { className: "wm-context-block", children: [_jsx("h3", { children: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F" }), recentEvents.slice(0, 3).map((event) => (_jsxs("p", { className: "muted", children: ["+ ", event] }, event)))] })] }));
}

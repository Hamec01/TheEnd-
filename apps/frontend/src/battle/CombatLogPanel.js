import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function CombatLogPanel({ logs }) {
    return (_jsxs("div", { className: "combat-log", children: [_jsx("h3", { children: "\u0416\u0443\u0440\u043D\u0430\u043B \u0431\u043E\u044F" }), _jsxs("div", { className: "combat-log-body", children: [logs.length === 0 ? _jsx("p", { children: "\u0421\u043E\u0431\u044B\u0442\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442." }) : null, logs.slice(-12).map((entry, index) => (_jsx("p", { children: entry.text }, `${entry.round}-${entry.actorId}-${index}`)))] })] }));
}

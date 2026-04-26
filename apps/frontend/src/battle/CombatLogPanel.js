import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from 'react';
export function CombatLogPanel({ logs }) {
    const bodyRef = useRef(null);
    const visibleLogs = useMemo(() => logs.slice(-40), [logs]);
    useEffect(() => {
        if (!bodyRef.current) {
            return;
        }
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [visibleLogs]);
    function logClass(entry) {
        if (entry.type === 'HIT') {
            if (/critical/i.test(entry.text)) {
                return 'log-critical';
            }
            return 'log-damage';
        }
        if (entry.type === 'BLOCK') {
            return 'log-block';
        }
        if (entry.type === 'MISS') {
            return 'log-system';
        }
        if (entry.type === 'DEATH') {
            return 'log-enemy';
        }
        return 'log-player';
    }
    return (_jsxs("div", { className: "combat-log battle-log-panel", children: [_jsx("h3", { children: "\u0416\u0443\u0440\u043D\u0430\u043B \u0431\u043E\u044F" }), _jsxs("div", { className: "combat-log-body", ref: bodyRef, children: [logs.length === 0 ? _jsx("p", { children: "\u0421\u043E\u0431\u044B\u0442\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442." }) : null, visibleLogs.map((entry, index) => (_jsxs("p", { className: logClass(entry), children: [_jsxs("span", { className: "combat-log-round", children: ["R", entry.round] }), " ", entry.text] }, `${entry.round}-${entry.actorId}-${index}`)))] })] }));
}

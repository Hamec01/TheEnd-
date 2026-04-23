import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export function TopStatusBar(props) {
    const { name, gold, level, exp, statusValue, oreValue, crystalValue, woodValue, meatValue, herbValue, onStats, onSkills, onInventory, onMap, onClan, onExit, } = props;
    const [goldPulse, setGoldPulse] = useState(null);
    const [prevGold, setPrevGold] = useState(gold);
    useEffect(() => {
        if (gold === prevGold) {
            return;
        }
        setGoldPulse(gold > prevGold ? 'up' : 'down');
        setPrevGold(gold);
        const timeout = window.setTimeout(() => setGoldPulse(null), 420);
        return () => window.clearTimeout(timeout);
    }, [gold, prevGold]);
    return (_jsxs("header", { className: "wm-topbar card", children: [_jsxs("div", { className: "wm-brand", children: [_jsx("strong", { children: "THEEND" }), _jsx("span", { children: name })] }), _jsxs("nav", { className: "wm-nav", children: [_jsx("button", { onClick: onStats, children: "\u0421\u0442\u0430\u0442\u044B" }), _jsx("button", { onClick: onInventory, children: "\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u044C" }), _jsx("button", { onClick: onSkills, children: "\u041D\u0430\u0432\u044B\u043A\u0438" }), _jsx("button", { onClick: onStats, children: "\u041F\u0435\u0440\u0441\u043E\u043D\u0430\u0436" }), _jsx("button", { onClick: onMap, children: "\u041A\u0430\u0440\u0442\u0430" }), _jsx("button", { onClick: onInventory, children: "\u042D\u043A\u0438\u043F\u0438\u0440\u043E\u0432\u043A\u0430" }), _jsx("button", { onClick: onStats, children: "\u0420\u0435\u0439\u0434\u044B" }), _jsx("button", { onClick: onClan, children: "\u041A\u043B\u0430\u043D" }), _jsx("button", { onClick: onStats, children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438" }), _jsx("button", { onClick: onExit, children: "\u0412\u044B\u0445\u043E\u0434" })] }), _jsxs("div", { className: "wm-stats-strip", children: [_jsxs("span", { title: "Current gold balance", className: goldPulse ? `is-${goldPulse}` : '', children: ["\uD83E\uDE99 ", gold] }), _jsxs("span", { title: "Current character level", children: ["\u2736 ", level] }), _jsxs("span", { title: "Current XP progress to next level", children: [exp, " xp"] }), _jsxs("span", { title: "Power", children: ["\u2694 ", statusValue] }), _jsxs("span", { title: "Ore", children: ["\u26CF ", oreValue] }), _jsxs("span", { title: "Crystals", children: ["\u25C8 ", crystalValue] }), _jsxs("span", { title: "Wood", children: ["\uD83E\uDEB5 ", woodValue] }), _jsxs("span", { title: "Rations", children: ["\uD83C\uDF56 ", meatValue] }), _jsxs("span", { title: "Herbs", children: ["\u2618 ", herbValue] })] })] }));
}

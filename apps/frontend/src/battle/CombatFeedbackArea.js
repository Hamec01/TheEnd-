import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
export const CombatFeedbackArea = ({ messages, maxMessages = 50 }) => {
    const containerRef = useRef(null);
    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);
    // Trim messages to max if needed
    const displayMessages = messages.slice(-maxMessages);
    return (_jsx("div", { className: "combat-feedback-area", ref: containerRef, children: displayMessages.length === 0 ? (_jsx("div", { style: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }, children: "Combat log will appear here" })) : (displayMessages.map((msg) => (_jsx("div", { className: `feedback-entry ${msg.type}`, children: msg.text }, msg.id)))) }));
};

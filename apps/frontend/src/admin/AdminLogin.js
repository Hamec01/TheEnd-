import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AdminFieldLabel, translateAdminErrorMessage } from './adminUi';
import { useState } from 'react';
export function AdminLogin({ onLogin }) {
    const [password, setPassword] = useState('');
    const [persist, setPersist] = useState(false);
    const [error, setError] = useState(null);
    function submit(event) {
        event.preventDefault();
        const ok = onLogin(password, persist);
        if (!ok) {
            setError(translateAdminErrorMessage('Invalid password'));
            return;
        }
        setError(null);
    }
    return (_jsx("div", { className: "admin-login-page", children: _jsxs("form", { className: "card admin-login-card", onSubmit: submit, children: [_jsx("h2", { children: "\u0412\u0445\u043E\u0434 \u0432 \u0430\u0434\u043C\u0438\u043D\u043A\u0443" }), _jsx("p", { className: "muted", children: "\u0417\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u0430\u044F \u0437\u043E\u043D\u0430 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u043E\u043C." }), _jsxs("label", { children: [_jsx(AdminFieldLabel, { label: "\u041F\u0430\u0440\u043E\u043B\u044C", hint: "\u0421\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u043E\u0434 \u0434\u043B\u044F \u0432\u0445\u043E\u0434\u0430 \u0432 \u043F\u0430\u043D\u0435\u043B\u044C \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u043E\u043C." }), _jsx("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value) })] }), _jsxs("label", { className: "zone-editor-checkbox", children: [_jsx("input", { type: "checkbox", checked: persist, onChange: (event) => setPersist(event.target.checked) }), _jsx("span", { children: "\u0417\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u044C \u0432\u0445\u043E\u0434 \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435" })] }), error ? _jsx("p", { className: "admin-error", children: error }) : null, _jsx("button", { type: "submit", children: "\u0412\u043E\u0439\u0442\u0438" })] }) }));
}

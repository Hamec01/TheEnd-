import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { translateAdminErrorMessage } from '../adminUi';
import { seedDefaultContentIfEmpty } from '../../services/content/seedService';
export function DashboardPage() {
    const [status, setStatus] = useState('Готово');
    async function handleSeed() {
        try {
            const result = await seedDefaultContentIfEmpty();
            setStatus(translateAdminErrorMessage(result.message));
        }
        catch (error) {
            setStatus(`Ошибка импорта: ${translateAdminErrorMessage(error.message)}`);
        }
    }
    return (_jsxs("div", { className: "admin-page-grid", children: [_jsxs("section", { children: [_jsx("h3", { children: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u043E\u043C" }), _jsx("p", { children: "\u0417\u0434\u0435\u0441\u044C \u043C\u043E\u0436\u043D\u043E \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u0430\u043C\u0438, \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0430\u043C\u0438, \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u043C\u0438, \u0442\u0430\u0431\u043B\u0438\u0446\u0430\u043C\u0438 \u0434\u043E\u0431\u044B\u0447\u0438 \u0438 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F\u043C\u0438 \u043F\u0440\u044F\u043C\u043E \u0438\u0437 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430." })] }), _jsxs("section", { children: [_jsx("button", { onClick: handleSeed, children: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043A\u043E\u043D\u0442\u0435\u043D\u0442" }), _jsx("p", { className: "muted", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442 \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0437\u0430\u0445\u0430\u0440\u0434\u043A\u043E\u0436\u0435\u043D\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0438 \u0442\u043E\u0440\u0433\u043E\u0432\u0446\u0435\u0432, \u0435\u0441\u043B\u0438 \u0431\u0430\u0437\u0430 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430 \u0435\u0449\u0451 \u043F\u0443\u0441\u0442\u0430\u044F." })] }), _jsxs("section", { children: [_jsx("strong", { children: "\u0421\u0442\u0430\u0442\u0443\u0441:" }), " ", status] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const LINKS = [
    { path: '/admin', label: 'Обзор' },
    { path: '/admin/items', label: 'Предметы' },
    { path: '/admin/merchants', label: 'Торговцы' },
    { path: '/admin/materials', label: 'Материалы' },
    { path: '/admin/loot-tables', label: 'Таблицы добычи' },
    { path: '/admin/images', label: 'Изображения' },
];
export function AdminLayout({ title, currentPath, onNavigate, onLogout, children }) {
    return (_jsxs("div", { className: "admin-shell", children: [_jsxs("aside", { className: "admin-sidebar card", children: [_jsx("h2", { children: "\u0410\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C" }), _jsx("nav", { children: LINKS.map((link) => (_jsx("button", { className: currentPath === link.path ? 'is-active' : '', onClick: () => onNavigate(link.path), children: link.label }, link.path))) }), _jsx("button", { className: "admin-logout", onClick: onLogout, children: "\u0412\u044B\u0439\u0442\u0438" })] }), _jsxs("section", { className: "admin-main", children: [_jsx("header", { className: "card admin-header", children: _jsxs("div", { className: "admin-header-copy", children: [_jsx("h1", { children: title }), _jsx("p", { className: "muted", children: "\u041D\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u0443\u0440\u0441\u043E\u0440 \u043D\u0430 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u043E\u043B\u044F, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0443." })] }) }), _jsx("main", { className: "card admin-content", children: children })] })] }));
}

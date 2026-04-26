import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { isAdminAuthenticated, loginAdmin, logoutAdmin } from '../services/adminAuth';
import { AdminLayout } from './AdminLayout';
import { AdminLogin } from './AdminLogin';
import { DashboardPage } from './pages/DashboardPage';
import { ImagesPage } from './pages/ImagesPage';
import { ItemsPage } from './pages/ItemsPage';
import { LootTablesPage } from './pages/LootTablesPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { MerchantsPage } from './pages/MerchantsPage';
function normalizeAdminPath(path) {
    if (path === '/admin/items' || path === '/admin/merchants' || path === '/admin/materials' || path === '/admin/loot-tables' || path === '/admin/images') {
        return path;
    }
    return '/admin';
}
export function AdminApp({ currentPath, onNavigate }) {
    const [isAuthenticated, setAuthenticated] = useState(() => isAdminAuthenticated());
    const route = normalizeAdminPath(currentPath);
    const title = useMemo(() => {
        switch (route) {
            case '/admin/items':
                return 'Предметы';
            case '/admin/merchants':
                return 'Торговцы';
            case '/admin/materials':
                return 'Материалы';
            case '/admin/loot-tables':
                return 'Таблицы добычи';
            case '/admin/images':
                return 'Изображения';
            default:
                return 'Обзор';
        }
    }, [route]);
    function login(password, persist) {
        const ok = loginAdmin(password, persist);
        setAuthenticated(ok);
        return ok;
    }
    function logout() {
        logoutAdmin();
        setAuthenticated(false);
    }
    if (!isAuthenticated) {
        return _jsx(AdminLogin, { onLogin: login });
    }
    let page;
    switch (route) {
        case '/admin/items':
            page = _jsx(ItemsPage, {});
            break;
        case '/admin/merchants':
            page = _jsx(MerchantsPage, {});
            break;
        case '/admin/materials':
            page = _jsx(MaterialsPage, {});
            break;
        case '/admin/loot-tables':
            page = _jsx(LootTablesPage, {});
            break;
        case '/admin/images':
            page = _jsx(ImagesPage, {});
            break;
        default:
            page = _jsx(DashboardPage, {});
            break;
    }
    return (_jsx(AdminLayout, { title: title, currentPath: route, onNavigate: onNavigate, onLogout: logout, children: page }));
}

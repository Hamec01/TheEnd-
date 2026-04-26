import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from './App';
import { AdminApp } from './admin/AdminApp';
function normalizePath(pathname) {
    if (!pathname || pathname === '') {
        return '/';
    }
    return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}
function toPlayerPath(pathname) {
    const normalized = normalizePath(pathname);
    if (normalized === '/inventory' || normalized === '/map' || normalized === '/combat' || normalized === '/merchant') {
        return normalized;
    }
    return '/';
}
export function RootApp() {
    const [path, setPath] = useState(() => normalizePath(window.location.pathname));
    useEffect(() => {
        const onPop = () => setPath(normalizePath(window.location.pathname));
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    const navigate = useCallback((nextPath, options) => {
        const normalized = normalizePath(nextPath);
        const current = normalizePath(window.location.pathname);
        if (current !== normalized) {
            if (options?.replace) {
                window.history.replaceState({}, '', normalized);
            }
            else {
                window.history.pushState({}, '', normalized);
            }
        }
        setPath(normalized);
    }, []);
    const isAdmin = useMemo(() => path === '/admin' || path.startsWith('/admin/'), [path]);
    if (isAdmin) {
        return _jsx(AdminApp, { currentPath: path, onNavigate: navigate });
    }
    return _jsx(App, { currentPlayerRoute: toPlayerPath(path), onNavigate: navigate });
}

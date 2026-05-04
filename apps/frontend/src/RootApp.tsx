import { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from './App';
import { AdminApp } from './admin/AdminApp';

export type PlayerPath = '/' | '/inventory' | '/map' | '/combat' | '/merchant' | '/character' | '/stats' | '/skills' | '/equipment' | '/journal';

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '') {
    return '/';
  }
  return pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

function toPlayerPath(pathname: string): PlayerPath {
  const normalized = normalizePath(pathname);
  const validPaths: PlayerPath[] = ['/', '/inventory', '/map', '/combat', '/merchant', '/character', '/stats', '/skills', '/equipment', '/journal'];
  if (validPaths.includes(normalized as PlayerPath)) {
    return normalized as PlayerPath;
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

  const navigate = useCallback((nextPath: string, options?: { replace?: boolean }) => {
    const normalized = normalizePath(nextPath);
    const current = normalizePath(window.location.pathname);

    if (current !== normalized) {
      if (options?.replace) {
        window.history.replaceState({}, '', normalized);
      } else {
        window.history.pushState({}, '', normalized);
      }
    }

    setPath(normalized);
  }, []);

  const isAdmin = useMemo(() => path === '/admin' || path.startsWith('/admin/'), [path]);

  if (isAdmin) {
    return <AdminApp currentPath={path} onNavigate={navigate} />;
  }

  return <App currentPlayerRoute={toPlayerPath(path)} onNavigate={navigate} />;
}

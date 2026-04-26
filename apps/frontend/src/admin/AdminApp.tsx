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

interface AdminAppProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

type AdminRoute = '/admin' | '/admin/items' | '/admin/merchants' | '/admin/materials' | '/admin/loot-tables' | '/admin/images';

function normalizeAdminPath(path: string): AdminRoute {
  if (path === '/admin/items' || path === '/admin/merchants' || path === '/admin/materials' || path === '/admin/loot-tables' || path === '/admin/images') {
    return path;
  }
  return '/admin';
}

export function AdminApp({ currentPath, onNavigate }: AdminAppProps) {
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

  function login(password: string, persist: boolean): boolean {
    const ok = loginAdmin(password, persist);
    setAuthenticated(ok);
    return ok;
  }

  function logout() {
    logoutAdmin();
    setAuthenticated(false);
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={login} />;
  }

  let page: React.ReactNode;
  switch (route) {
    case '/admin/items':
      page = <ItemsPage />;
      break;
    case '/admin/merchants':
      page = <MerchantsPage />;
      break;
    case '/admin/materials':
      page = <MaterialsPage />;
      break;
    case '/admin/loot-tables':
      page = <LootTablesPage />;
      break;
    case '/admin/images':
      page = <ImagesPage />;
      break;
    default:
      page = <DashboardPage />;
      break;
  }

  return (
    <AdminLayout title={title} currentPath={route} onNavigate={onNavigate} onLogout={logout}>
      {page}
    </AdminLayout>
  );
}

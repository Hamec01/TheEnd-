import { useMemo, useState } from 'react';
import { isAdminAuthenticated, loginAdmin, logoutAdmin } from '../services/adminAuth';
import { AdminLayout } from './AdminLayout';
import { AdminLogin } from './AdminLogin';
import { DashboardPage } from './pages/DashboardPage';
import { BattleMapsPage } from './pages/BattleMapsPage';
import { ImagesPage } from './pages/ImagesPage';
import { ItemsPage } from './pages/ItemsPage';
import { LootTablesPage } from './pages/LootTablesPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { MerchantsPage } from './pages/MerchantsPage';
import { QuestItemsPage } from './pages/QuestItemsPage';
import { QuestsPage } from './pages/QuestsPage';
import { SkillsPage } from './pages/SkillsPage';
import { NpcsPage } from './pages/NpcsPage';
import { DialoguesPage } from './pages/DialoguesPage';
import { ZoneEditorPage } from './pages/ZoneEditorPage';

interface AdminAppProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

type AdminRoute = '/admin' | '/admin/items' | '/admin/skills' | '/admin/quests' | '/admin/quest-items' | '/admin/merchants' | '/admin/materials' | '/admin/npcs' | '/admin/dialogues' | '/admin/loot-tables' | '/admin/images' | '/admin/battle-maps' | '/admin/zone-editor';

function normalizeAdminPath(path: string): AdminRoute {
  if (
    path === '/admin/items'
    || path === '/admin/skills'
    || path === '/admin/quests'
    || path === '/admin/quest-items'
    || path === '/admin/merchants'
    || path === '/admin/materials'
    || path === '/admin/npcs'
    || path === '/admin/dialogues'
    || path === '/admin/loot-tables'
    || path === '/admin/images'
    || path === '/admin/battle-maps'
    || path === '/admin/zone-editor'
  ) {
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
      case '/admin/skills':
        return 'Skills';
      case '/admin/quests':
        return 'Квесты';
      case '/admin/quest-items':
        return 'Квестовые предметы';
      case '/admin/merchants':
        return 'Торговцы';
      case '/admin/materials':
        return 'Материалы';
      case '/admin/npcs':
        return 'Персонажи';
      case '/admin/dialogues':
        return 'Диалоги';
      case '/admin/loot-tables':
        return 'Таблицы добычи';
      case '/admin/images':
        return 'Изображения';
      case '/admin/battle-maps':
        return 'Battle Maps';
      case '/admin/zone-editor':
        return 'Zone Editor';
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
    case '/admin/skills':
      page = <SkillsPage />;
      break;
    case '/admin/quests':
      page = <QuestsPage />;
      break;
    case '/admin/quest-items':
      page = <QuestItemsPage />;
      break;
    case '/admin/merchants':
      page = <MerchantsPage />;
      break;
    case '/admin/materials':
      page = <MaterialsPage />;
      break;
    case '/admin/npcs':
      page = <NpcsPage />;
      break;
    case '/admin/dialogues':
      page = <DialoguesPage />;
      break;
    case '/admin/loot-tables':
      page = <LootTablesPage />;
      break;
    case '/admin/images':
      page = <ImagesPage />;
      break;
    case '/admin/battle-maps':
      page = <BattleMapsPage />;
      break;
    case '/admin/zone-editor':
      page = <ZoneEditorPage />;
      break;
    default:
      page = <DashboardPage />;
      break;
  }

  return (
    <AdminLayout
      title={title}
      currentPath={route}
      onNavigate={onNavigate}
      onLogout={logout}
      isEditorRoute={route === '/admin/battle-maps' || route === '/admin/zone-editor'}
    >
      {page}
    </AdminLayout>
  );
}

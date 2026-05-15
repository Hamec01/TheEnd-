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
import { QuestInteractionsPage } from './pages/QuestInteractionsPage';
import { QuestsPage } from './pages/QuestsPage';
import { SkillsPage } from './pages/SkillsPage';
import { NpcsPage } from './pages/NpcsPage';
import { DialoguesPage } from './pages/DialoguesPage';
import { ZoneEditorPage } from './pages/ZoneEditorPage';
import { CitiesPage } from './pages/CitiesPage';
import { BackupPage } from './pages/BackupPage';
import { ItemSetsPage } from './pages/ItemSetsPage';
import { LocationsPage } from './pages/LocationsPage';

interface AdminAppProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

type AdminRoute = '/admin' | '/admin/items' | '/admin/item-sets' | '/admin/skills' | '/admin/quests' | '/admin/quest-items' | '/admin/quest-interactions' | '/admin/merchants' | '/admin/materials' | '/admin/npcs' | '/admin/dialogues' | '/admin/loot-tables' | '/admin/images' | '/admin/battle-maps' | '/admin/zone-editor' | '/admin/cities' | '/admin/locations' | '/admin/backup';

function normalizeAdminPath(path: string): AdminRoute {
  if (
    path === '/admin/items'
    || path === '/admin/item-sets'
    || path === '/admin/skills'
    || path === '/admin/quests'
    || path === '/admin/quest-items'
    || path === '/admin/quest-interactions'
    || path === '/admin/merchants'
    || path === '/admin/materials'
    || path === '/admin/npcs'
    || path === '/admin/dialogues'
    || path === '/admin/loot-tables'
    || path === '/admin/images'
    || path === '/admin/battle-maps'
    || path === '/admin/zone-editor'
    || path === '/admin/cities'
    || path === '/admin/locations'
    || path === '/admin/backup'
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
      case '/admin/item-sets':
        return 'Сеты предметов';
      case '/admin/skills':
        return 'Skills';
      case '/admin/quests':
        return 'Квесты';
      case '/admin/quest-items':
        return 'Квестовые предметы';
      case '/admin/quest-interactions':
        return 'Quest Interactions';
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
      case '/admin/cities':
        return 'Cities';
      case '/admin/locations':
        return 'Локации';
      case '/admin/backup':
        return 'Backup / Content Tools';
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
      page = <ItemsPage onNavigate={onNavigate} />;
      break;
    case '/admin/item-sets':
      page = <ItemSetsPage onNavigate={onNavigate} />;
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
    case '/admin/quest-interactions':
      page = <QuestInteractionsPage />;
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
    case '/admin/cities':
      page = <CitiesPage />;
      break;
    case '/admin/locations':
      page = <LocationsPage />;
      break;
    case '/admin/backup':
      page = <BackupPage />;
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
      isEditorRoute={route === '/admin/battle-maps' || route === '/admin/zone-editor' || route === '/admin/cities'}
    >
      {page}
    </AdminLayout>
  );
}

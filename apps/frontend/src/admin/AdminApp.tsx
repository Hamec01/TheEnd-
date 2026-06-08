import { useEffect, useMemo, useState } from 'react';
import { isAdminAuthenticated, loginAdmin, logoutAdmin } from '../services/adminAuth';
import type { ContentAutosaveStatus } from '../services/content/contentApi';
import { getContentAutosaveStatus, triggerContentAutosave } from '../services/content/contentApi';
import { AdminLayout } from './AdminLayout';
import { AdminLogin } from './AdminLogin';
import { BackupPage } from './pages/BackupPage';
import { BattleMapsPage } from './pages/BattleMapsPage';
import { CitiesPage } from './pages/CitiesPage';
import { CraftingRecipesPage } from './pages/CraftingRecipesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DialoguesPage } from './pages/DialoguesPage';
import { ImagesPage } from './pages/ImagesPage';
import { ItemInstancesPage } from './pages/ItemInstancesPage';
import { ItemSetsPage } from './pages/ItemSetsPage';
import { ItemsPage } from './pages/ItemsPage';
import { LocationsPage } from './pages/LocationsPage';
import { LootTablesPage } from './pages/LootTablesPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { MerchantsPage } from './pages/MerchantsPage';
import { NpcsPage } from './pages/NpcsPage';
import { ProfessionsPage } from './pages/ProfessionsPage';
import { QuestInteractionsPage } from './pages/QuestInteractionsPage';
import { QuestItemsPage } from './pages/QuestItemsPage';
import { QuestsPage } from './pages/QuestsPage';
import { SkillsPage } from './pages/SkillsPage';
import { SoundsPage } from './pages/SoundsPage';
import { VisualFxPage } from './pages/VisualFxPage';
import { WorldSimulationAdmin } from './pages/WorldSimulationAdmin';
import { ZoneEditorPage } from './pages/ZoneEditorPage';
import { LivingWorldPage } from './pages/LivingWorldPage';

interface AdminAppProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

type AdminRoute =
  | '/admin'
  | '/admin/items'
  | '/admin/item-instances'
  | '/admin/item-sets'
  | '/admin/crafting-recipes'
  | '/admin/skills'
  | '/admin/visual-fx'
  | '/admin/quests'
  | '/admin/quest-items'
  | '/admin/quest-interactions'
  | '/admin/merchants'
  | '/admin/materials'
  | '/admin/npcs'
  | '/admin/dialogues'
  | '/admin/loot-tables'
  | '/admin/images'
  | '/admin/battle-maps'
  | '/admin/zone-editor'
  | '/admin/cities'
  | '/admin/locations'
  | '/admin/backup'
  | '/admin/world-sim'
  | '/admin/sounds'
  | '/admin/biomes'
  | '/admin/trees'
  | '/admin/professions';

function normalizeAdminPath(path: string): AdminRoute {
  const allowed = new Set<AdminRoute>([
    '/admin',
    '/admin/items',
    '/admin/item-instances',
    '/admin/item-sets',
    '/admin/crafting-recipes',
    '/admin/skills',
    '/admin/visual-fx',
    '/admin/quests',
    '/admin/quest-items',
    '/admin/quest-interactions',
    '/admin/merchants',
    '/admin/materials',
    '/admin/npcs',
    '/admin/dialogues',
    '/admin/loot-tables',
    '/admin/images',
    '/admin/battle-maps',
    '/admin/zone-editor',
    '/admin/cities',
    '/admin/locations',
    '/admin/backup',
    '/admin/world-sim',
    '/admin/sounds',
    '/admin/biomes',
    '/admin/trees',
    '/admin/professions',
  ]);
  return allowed.has(path as AdminRoute) ? (path as AdminRoute) : '/admin';
}

export function AdminApp({ currentPath, onNavigate }: AdminAppProps) {
  const [isAuthenticated, setAuthenticated] = useState(() => isAdminAuthenticated());
  const [autosaveStatus, setAutosaveStatus] = useState<ContentAutosaveStatus | null>(null);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const route = normalizeAdminPath(currentPath);

  const title = useMemo(() => {
    switch (route) {
      case '/admin/items':
        return 'Предметы';
      case '/admin/item-instances':
        return 'Item Instances';
      case '/admin/item-sets':
        return 'Сеты предметов';
      case '/admin/crafting-recipes':
        return 'Рецепты / Производство';
      case '/admin/skills':
        return 'Skills';
      case '/admin/visual-fx':
        return 'Visual FX';
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
      case '/admin/world-sim':
        return '🌍 Симуляция мира';
      case '/admin/sounds':
        return '🎵 Звуки';
      case '/admin/professions':
        return '💼 Карьера';
      case '/admin/biomes':
        return '🌍 Живой мир';
      case '/admin/trees':
        return '🌍 Живой мир';
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

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;

    const loadStatus = async () => {
      try {
        const status = await getContentAutosaveStatus();
        if (!isMounted) {
          return;
        }
        setAutosaveStatus(status);
        setAutosaveState(status.lastError ? 'error' : 'idle');
      } catch {
        if (!isMounted) {
          return;
        }
        setAutosaveState('error');
      }
    };

    void loadStatus();
    const timer = window.setInterval(() => {
      void loadStatus();
    }, 15_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  async function handleSaveNow() {
    setAutosaveState('saving');
    try {
      const status = await triggerContentAutosave();
      setAutosaveStatus(status);
      setAutosaveState(status.lastError ? 'error' : 'idle');
    } catch {
      setAutosaveState('error');
    }
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={login} />;
  }

  let page: React.ReactNode;
  switch (route) {
    case '/admin/items':
      page = <ItemsPage onNavigate={onNavigate} />;
      break;
    case '/admin/item-instances':
      page = <ItemInstancesPage />;
      break;
    case '/admin/item-sets':
      page = <ItemSetsPage onNavigate={onNavigate} />;
      break;
    case '/admin/crafting-recipes':
      page = <CraftingRecipesPage />;
      break;
    case '/admin/skills':
      page = <SkillsPage />;
      break;
    case '/admin/visual-fx':
      page = <VisualFxPage />;
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
    case '/admin/world-sim':
      page = <WorldSimulationAdmin />;
      break;
    case '/admin/sounds':
      page = <SoundsPage />;
      break;
    case '/admin/professions':
      page = <ProfessionsPage />;
      break;
    case '/admin/biomes':
      page = <LivingWorldPage onNavigate={onNavigate} />;
      break;
    case '/admin/trees':
      page = <LivingWorldPage initialTab="trees" onNavigate={onNavigate} />;
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
      autosaveStatus={autosaveStatus}
      autosaveState={autosaveState}
      onSaveNow={() => { void handleSaveNow(); }}
      isEditorRoute={route === '/admin/battle-maps' || route === '/admin/zone-editor' || route === '/admin/cities'}
    >
      {page}
    </AdminLayout>
  );
}

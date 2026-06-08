import type { ReactNode } from 'react';
import type { ContentAutosaveStatus } from '../services/content/contentApi';

interface AdminLayoutProps {
  title: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  autosaveStatus?: ContentAutosaveStatus | null;
  autosaveState?: 'idle' | 'saving' | 'error';
  onSaveNow?: () => void;
  isEditorRoute?: boolean;
  children: ReactNode;
}

const LINK_GROUPS: Array<{ title: string; links: Array<{ path: string; label: string }> }> = [
  {
    title: 'General',
    links: [
      { path: '/admin', label: 'Overview' },
      { path: '/admin/backup', label: 'Backup' },
      { path: '/admin/sounds', label: '🎵 Звуки' },
      { path: '/admin/world-sim', label: '🌍 Симуляция мира' },
    ],
  },
  {
    title: 'Content',
    links: [
      { path: '/admin/items', label: 'Предметы' },
      { path: '/admin/item-instances', label: 'Item Instances' },
      { path: '/admin/materials', label: 'Материалы' },
      { path: '/admin/loot-tables', label: 'Таблицы добычи' },
      { path: '/admin/crafting-recipes', label: 'Рецепты / Производство' },
      { path: '/admin/item-sets', label: 'Сеты предметов' },
      { path: '/admin/skills', label: 'Skills' },
      { path: '/admin/visual-fx', label: 'Visual FX' },
      { path: '/admin/quests', label: 'Квесты' },
      { path: '/admin/quest-items', label: 'Квестовые предметы' },
      { path: '/admin/quest-interactions', label: 'Quest Interactions' },
      { path: '/admin/npcs', label: 'Персонажи' },
      { path: '/admin/dialogues', label: 'Диалоги' },
      { path: '/admin/merchants', label: 'Торговцы' },
      { path: '/admin/images', label: 'Изображения' },
    ],
  },
  {
    title: 'World',
    links: [
      { path: '/admin/cities', label: 'Города' },
      { path: '/admin/locations', label: 'Локации' },
      { path: '/admin/zone-editor', label: 'Zone Editor' },
      { path: '/admin/battle-maps', label: 'Battle Maps' },
      { path: '/admin/world-sim', label: '🌍 Симуляция мира' },
      { path: '/admin/biomes', label: '🌍 Живой мир' },
    ],
  },
  {
    title: 'Карьера',
    links: [
      { path: '/admin/professions', label: 'Профессии' },
    ],
  },
];

function formatAutosaveStatus(status: ContentAutosaveStatus | null | undefined): string {
  if (!status) {
    return 'Autosave status loading...';
  }

  if (status.lastError) {
    return `Autosave error: ${status.lastError}`;
  }

  if (!status.lastSavedAt) {
    return 'Autosave is waiting for the first backup.';
  }

  const savedAt = new Date(status.lastSavedAt).toLocaleTimeString();
  const nextAt = status.nextScheduledAt ? new Date(status.nextScheduledAt).toLocaleTimeString() : null;
  return nextAt
    ? `Autosave OK: ${savedAt}, slot ${status.currentSlot}/${status.slotCount}, next ${nextAt}`
    : `Autosave OK: ${savedAt}, slot ${status.currentSlot}/${status.slotCount}`;
}

export function AdminLayout({
  title,
  currentPath,
  onNavigate,
  onLogout,
  autosaveStatus,
  autosaveState = 'idle',
  onSaveNow,
  isEditorRoute = false,
  children,
}: AdminLayoutProps) {
  const autosaveMessage = formatAutosaveStatus(autosaveStatus);
  const autosaveColor = autosaveStatus?.lastError
    ? '#ff8f8f'
    : autosaveState === 'saving'
      ? '#d5b47a'
      : '#7ed28f';

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar card">
        <h2>Админ-панель</h2>
        <nav>
          {LINK_GROUPS.map((group) => (
            <section key={group.title} className="admin-nav-group">
              <h3>{group.title}</h3>
              {group.links.map((link) => (
                <button
                  key={link.path}
                  className={currentPath === link.path ? 'is-active' : ''}
                  onClick={() => onNavigate(link.path)}
                >
                  {link.label}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <button className="admin-logout" onClick={onLogout}>Выйти</button>
      </aside>

      <section className="admin-main">
        <header className="card admin-header">
          <div className="admin-header-copy">
            <h1>{title}</h1>
            <p className="muted">Наведите курсор на название поля, чтобы увидеть подсказку.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <p className="muted" style={{ margin: 0, color: autosaveColor, fontWeight: 600 }}>
              {autosaveMessage}
            </p>
            {onSaveNow ? (
              <button type="button" onClick={onSaveNow} disabled={autosaveState === 'saving'}>
                {autosaveState === 'saving' ? 'Saving...' : 'SAVE NOW'}
              </button>
            ) : null}
          </div>
        </header>
        <main className={`card admin-content ${isEditorRoute ? 'is-editor-route' : ''}`}>{children}</main>
      </section>
    </div>
  );
}

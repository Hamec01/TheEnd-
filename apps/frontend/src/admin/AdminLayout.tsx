import type { ReactNode } from 'react';
import { featureFlags } from '../config/featureFlags';
import type { ContentAutosaveStatus } from '../services/content/contentApi';
import { AdminSaveToast } from './AdminSaveToast';

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
    title: 'GENERAL',
    links: [
      { path: '/admin', label: 'OVERVIEW' },
      { path: '/admin/backup', label: 'BACKUP' },
      { path: '/admin/diplomacy', label: 'ОТНОШЕНИЯ / ДИПЛОМАТИЯ' },
      { path: '/admin/sounds', label: '🎵 ЗВУКИ' },
      { path: '/admin/world-sim', label: '🌍 СИМУЛЯЦИЯ МИРА' },
    ],
  },
  {
    title: 'CONTENT',
    links: [
      { path: '/admin/items', label: 'ПРЕДМЕТЫ' },
      { path: '/admin/item-instances', label: 'ITEM INSTANCES' },
      { path: '/admin/materials', label: 'МАТЕРИАЛЫ' },
      { path: '/admin/loot-tables', label: 'ТАБЛИЦЫ ДОБЫЧИ' },
      { path: '/admin/crafting-recipes', label: 'РЕЦЕПТЫ / ПРОИЗВОДСТВО' },
      { path: '/admin/item-sets', label: 'СЕТЫ ПРЕДМЕТОВ' },
      { path: '/admin/skills', label: 'SKILLS' },
      { path: '/admin/visual-fx', label: 'VISUAL FX' },
      { path: '/admin/quests', label: 'КВЕСТЫ' },
      { path: '/admin/quest-items', label: 'КВЕСТОВЫЕ ПРЕДМЕТЫ' },
      { path: '/admin/quest-interactions', label: 'QUEST INTERACTIONS' },
      { path: '/admin/npcs', label: 'ПЕРСОНАЖИ' },
      { path: '/admin/dialogues', label: 'ДИАЛОГИ' },
      { path: '/admin/merchants', label: 'ТОРГОВЦЫ' },
      { path: '/admin/images', label: 'ИЗОБРАЖЕНИЯ' },
      { path: '/admin/sprite-studio', label: 'SPRITE STUDIO' },
    ],
  },
  {
    title: 'WORLD',
    links: [
      { path: '/admin/cities', label: 'ГОРОДА' },
      { path: '/admin/locations', label: 'ЛОКАЦИИ' },
      { path: '/admin/zone-editor', label: 'ZONE EDITOR' },
      { path: '/admin/battle-maps', label: 'BATTLE MAPS' },
      { path: '/admin/diplomacy', label: 'ОТНОШЕНИЯ / ДИПЛОМАТИЯ' },
      { path: '/admin/world-sim', label: '🌍 СИМУЛЯЦИЯ МИРА' },
      { path: '/admin/biomes', label: '🌍 ЖИВОЙ МИР' },
    ],
  },
  {
    title: 'КАРЬЕРА',
    links: [
      { path: '/admin/professions', label: 'ПРОФЕССИИ' },
    ],
  },
];

const FILTERED_LINK_GROUPS = LINK_GROUPS.map((group) => ({
  ...group,
  links: group.links.filter((link) => link.path !== '/admin/sprite-studio' || featureFlags.enableSpriteStudioAdmin),
})).filter((group) => group.links.length > 0);

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
      <AdminSaveToast />
      <aside className="admin-sidebar card">
        <h2>АДМИН-ПАНЕЛЬ</h2>
        <nav>
          {FILTERED_LINK_GROUPS.map((group) => (
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
        <button className="admin-logout" onClick={onLogout}>ВЫЙТИ</button>
      </aside>

      <section className="admin-main">
        <header className="card admin-header">
          <div className="admin-header-copy">
            <h1>{title}</h1>
            <p className="muted">Наведи курсор на название поля, чтобы увидеть подсказку.</p>
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

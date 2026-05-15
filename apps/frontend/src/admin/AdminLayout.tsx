interface AdminLayoutProps {
  title: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  isEditorRoute?: boolean;
  children: React.ReactNode;
}

const LINK_GROUPS: Array<{ title: string; links: Array<{ path: string; label: string }> }> = [
  {
    title: 'General',
    links: [{ path: '/admin', label: 'Overview' }, { path: '/admin/backup', label: 'Backup' }],
  },
  {
    title: 'Content',
    links: [
      { path: '/admin/items', label: 'Предметы' },
      { path: '/admin/item-sets', label: 'Сеты предметов' },
      { path: '/admin/skills', label: 'Skills' },
      { path: '/admin/quests', label: 'Квесты' },
      { path: '/admin/quest-items', label: 'Квестовые предметы' },
      { path: '/admin/quest-interactions', label: 'Quest Interactions' },
      { path: '/admin/npcs', label: 'Персонажи' },
      { path: '/admin/dialogues', label: 'Диалоги' },
      { path: '/admin/merchants', label: 'Торговцы' },
      { path: '/admin/materials', label: 'Материалы' },
      { path: '/admin/loot-tables', label: 'Таблицы добычи' },
      { path: '/admin/images', label: 'Изображения' },
    ],
  },
  {
    title: 'World',
    links: [
      { path: '/admin/cities', label: 'Города' },
      { path: '/admin/locations', label: 'ЛОКАЦИИ' },
      { path: '/admin/zone-editor', label: 'Zone Editor' },
      { path: '/admin/battle-maps', label: 'Battle Maps' },
    ],
  },
];

export function AdminLayout({ title, currentPath, onNavigate, onLogout, isEditorRoute = false, children }: AdminLayoutProps) {
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
        </header>
        <main className={`card admin-content ${isEditorRoute ? 'is-editor-route' : ''}`}>{children}</main>
      </section>
    </div>
  );
}

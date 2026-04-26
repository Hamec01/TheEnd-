interface AdminLayoutProps {
  title: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const LINKS: Array<{ path: string; label: string }> = [
  { path: '/admin', label: 'Обзор' },
  { path: '/admin/items', label: 'Предметы' },
  { path: '/admin/merchants', label: 'Торговцы' },
  { path: '/admin/materials', label: 'Материалы' },
  { path: '/admin/loot-tables', label: 'Таблицы добычи' },
  { path: '/admin/images', label: 'Изображения' },
];

export function AdminLayout({ title, currentPath, onNavigate, onLogout, children }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar card">
        <h2>Админ-панель</h2>
        <nav>
          {LINKS.map((link) => (
            <button
              key={link.path}
              className={currentPath === link.path ? 'is-active' : ''}
              onClick={() => onNavigate(link.path)}
            >
              {link.label}
            </button>
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
        <main className="card admin-content">{children}</main>
      </section>
    </div>
  );
}

const env = import.meta.env as Record<string, string | undefined>;

export const ADMIN_PASSWORD = env.VITE_ADMIN_PASSWORD ?? env.ADMIN_PASSWORD ?? 'admin123';

export const ADMIN_SESSION_KEY = 'theend.admin.session.v1';

import { ADMIN_PASSWORD, ADMIN_SESSION_KEY } from '../config/adminConfig';
function readRaw() {
    if (typeof window === 'undefined') {
        return null;
    }
    const raw = window.sessionStorage.getItem(ADMIN_SESSION_KEY) ?? window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export function isAdminAuthenticated() {
    const session = readRaw();
    return Boolean(session?.isAdmin);
}
export function loginAdmin(password, persist = false) {
    if (password !== ADMIN_PASSWORD) {
        return false;
    }
    const session = {
        isAdmin: true,
        loggedInAt: new Date().toISOString(),
    };
    const encoded = JSON.stringify(session);
    if (typeof window !== 'undefined') {
        if (persist) {
            window.localStorage.setItem(ADMIN_SESSION_KEY, encoded);
            window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }
        else {
            window.sessionStorage.setItem(ADMIN_SESSION_KEY, encoded);
            window.localStorage.removeItem(ADMIN_SESSION_KEY);
        }
    }
    return true;
}
export function logoutAdmin() {
    if (typeof window === 'undefined') {
        return;
    }
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

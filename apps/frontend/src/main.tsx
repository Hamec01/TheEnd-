import React from 'react';
import ReactDOM from 'react-dom/client';
import { RootApp } from './RootApp';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { installGlobalAdminSaveListener, isAdminPath } from './admin/adminSaveRegistry';
import './styles.css';

async function clearLocalDevServiceWorkers() {
  const isLocalhost = /^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(window.location.hostname);
  if (!isLocalhost || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
  } catch {
    // Best-effort cleanup for stale local PWA registrations.
  }

  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys.map((key) => (
        /workbox|vite-plugin-pwa|theend/i.test(key)
          ? caches.delete(key)
          : Promise.resolve(false)
      )),
    );
  } catch {
    // Ignore cache cleanup failures in local dev.
  }
}

if (isAdminPath(window.location.pathname)) {
  installGlobalAdminSaveListener();
}

void clearLocalDevServiceWorkers().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <RootApp />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
});

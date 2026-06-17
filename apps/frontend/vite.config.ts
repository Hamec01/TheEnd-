import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

function normalizeProxyTarget(value: string | undefined): string {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return 'http://localhost:3001';
  }
  return trimmed.replace(/\/api\/?$/, '');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = normalizeProxyTarget(env.VITE_API_PROXY_TARGET || env.VITE_API_BASE_URL || env.VITE_API_URL);

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.mts', '.json'],
    },
    server: {
      port: 5173,
      fs: {
        allow: [repoRoot],
      },
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/assets/upload': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});

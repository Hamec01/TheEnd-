import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure TS/TSX sources win over stale JS mirrors in src.
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.mts', '.json'],
  },
  server: {
    port: 5173,
  },
});

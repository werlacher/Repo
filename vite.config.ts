import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only app: the dev server listens on localhost only.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  base: './',
  // icon sets are big JSON chunks that load on demand; that's expected for a local app
  build: { chunkSizeWarningLimit: 10000 },
});

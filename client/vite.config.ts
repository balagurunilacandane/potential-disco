import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BRAIN = process.env.BRAIN_URL ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1600 },
  server: {
    port: 5173,
    proxy: {
      '/api': BRAIN,
      '/ws': { target: BRAIN.replace(/^http/, 'ws'), ws: true },
    },
  },
});

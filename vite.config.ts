import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { coinsFileApi } from './vite-plugins/coinsFileApi';

export default defineConfig({
  plugins: [react(), tailwindcss(), coinsFileApi()],
  // Relative paths so the build also works inside Tauri / Capacitor wrappers.
  base: './',
  server: {
    // Saving to coins.json should not trigger a full page reload.
    watch: { ignored: ['**/data/coins*.json'] },
  },
});

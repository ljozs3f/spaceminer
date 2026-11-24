import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const localDomain = process.env['LOCAL_DOMAIN'];

export default defineConfig({
  plugins: [vue()],
  // Phaser alone is about 1.4 MB minified, more than Vite's default warning limit of 500 kB
  build: { chunkSizeWarningLimit: 1600 },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // the dev server is also served through nginx on the local HTTPS domain
    allowedHosts: localDomain ? [localDomain] : [],
    // bind mounts on macOS / Windows hosts may not deliver file change events
    watch: { usePolling: process.env['VITE_USE_POLLING'] === 'true' },
  },
});

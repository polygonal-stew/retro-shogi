import { defineConfig, splitVendorChunkPlugin } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [splitVendorChunkPlugin()],
  base: '/retro-shogi/',
  build: {
    chunkSizeWarningLimit: 1000,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend lives in web/ and builds to web/dist, which the local server serves.
export default defineConfig({
  root: 'web',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // refractor bundles grammars for every language so any PR file highlights.
    // This is a localhost tool served once, so the larger bundle is a non-issue.
    chunkSizeWarningLimit: 1000,
  },
  plugins: [react()],
});

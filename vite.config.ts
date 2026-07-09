import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend lives in web/ and builds to web/dist, which the local server serves.
export default defineConfig({
  root: 'web',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [react()],
});

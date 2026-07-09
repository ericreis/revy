import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/serverEntry.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: false,
  shims: false,
});

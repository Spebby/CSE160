import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/asgn5.ts'),
      name: 'asgn5',
      formats: ['es'],
      fileName: () => 'asgn5.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});

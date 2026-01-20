import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'public',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Glyph',
      formats: ['es', 'cjs', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'glyph.esm.js';
        if (format === 'cjs') return 'glyph.cjs.js';
        return 'glyph.min.js';
      }
    },
    minify: 'esbuild',
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      output: {
        // Ensure CSS is extracted
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name || 'asset';
        },
        // Preserve exports for CJS
        exports: 'named'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});

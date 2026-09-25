import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'assets',
    emptyOutDir: true,
    assetsDir: '',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunk-[hash].js',
        assetFileNames: 'index.[ext]',
      },
    },
  },
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

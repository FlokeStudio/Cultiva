import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: '../public',
  
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        calendar: resolve(__dirname, 'src/pages/calendar/index.html'),
      }
    }
  },
  
  server: {
    port: 3000,
  },
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/', // garante que funcione no deploy
  build: {
    outDir: 'dist',
  }
});

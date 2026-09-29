import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le navigateur appelle /api sur le meme port que l'app : Vite relaie vers le backend (pas de CORS a configurer).
const backend = process.env.API_URL ?? 'http://localhost:8083';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': backend } },
  preview: { port: 4173, proxy: { '/api': backend } },
});

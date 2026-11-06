import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// Le navigateur appelle /api sur le meme port que l'app : Vite relaie vers le backend (pas de CORS a configurer).
const backend = process.env.API_URL ?? 'http://localhost:8083';

// Le relais est fait cote serveur : l'en-tete Origin du navigateur (localhost:5173) est retire,
// sinon le backend traiterait la requete comme cross-origin et la refuserait.
const relaisApi: ProxyOptions = {
  target: backend,
  configure: (proxy) => proxy.on('proxyReq', (requete) => requete.removeHeader('origin')),
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': relaisApi } },
  preview: { port: 4173, proxy: { '/api': relaisApi } },
});

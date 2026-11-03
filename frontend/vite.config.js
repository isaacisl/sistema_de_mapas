import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Rotas do Flask que o front chama (em dev, o Vite repassa para o Flask na porta 5000)
const FLASK = 'http://127.0.0.1:5000';
const ROTAS_API = ['/analisar-csv', '/gerar-mapa', '/gerar-mapa-html', '/static'];

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // No build, o Flask serve os arquivos em /static/dist/
  base: command === 'build' ? '/static/dist/' : '/',
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(ROTAS_API.map(r => [r, FLASK])),
  },
}));

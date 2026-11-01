import { defineConfig } from 'vite';
export default defineConfig({
  // Worker-only dependencies must be discovered before the first import opens.
  optimizeDeps: { include: ['fflate', 'fzstd'] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});

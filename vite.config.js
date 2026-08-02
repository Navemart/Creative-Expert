import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config. The dev server proxies /api/* to the Express server
// so the frontend can call fetch('/api/clients') without worrying about CORS.
export default defineConfig(() => {
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          timeout: 60000,
          proxyTimeout: 60000,
        },
      },
    },
  };
});
